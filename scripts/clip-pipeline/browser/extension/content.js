/**
 * Noteworthy YouTube clip extension — content script.
 */
(function () {
  'use strict';

  const DEFAULT_BUFFER_SECONDS = 30;
  const MIN_BYTES = 5000;
  const MIN_TOTAL_BYTES = 100000;
  /** Restart only after this many 1s chunks (~2 min) to cap memory — not when buffer fills */
  const MAX_SESSION_CHUNKS = 120;

  let bufferSeconds = DEFAULT_BUFFER_SECONDS;
  let recorder = null;
  let attachedVideo = null;
  let activeStream = null;
  let button = null;
  let statusEl = null;
  let saving = false;
  let activeMimeType = '';
  /** @type {Blob[]} — all chunks from the current recorder session (never drop mid-session) */
  let sessionChunks = [];
  /** @type {Blob | null} */
  let initChunk = null;
  /** @type {Blob | null} */
  let latestBlob = null;
  /** @type {Promise<void>} */
  let chunkQueue = Promise.resolve();

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  async function drainChunkQueue(timeoutMs = 4000) {
    const deadline = Date.now() + timeoutMs;
    let pending = chunkQueue;
    await withTimeout(
      pending,
      Math.max(500, deadline - Date.now()),
      'Buffer sync timed out — refresh YouTube and try again'
    );

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (chunkQueue === pending) break;
      pending = chunkQueue;
      await withTimeout(
        pending,
        Math.max(200, deadline - Date.now()),
        'Buffer sync timed out — refresh YouTube and try again'
      );
    }
  }

  async function flushRecorderData(timeoutMs = 1200) {
    if (!recorder || recorder.state !== 'recording') return;

    await withTimeout(
      new Promise((resolve) => {
        const done = () => resolve();
        recorder.addEventListener('dataavailable', done, { once: true });
        try {
          recorder.requestData();
        } catch {
          resolve();
        }
      }),
      timeoutMs,
      'Recorder flush timed out'
    ).catch(() => {
      /* proceed with buffered chunks */
    });
  }

  function loadSettings(cb) {
    chrome.storage.sync.get({ bufferSeconds: DEFAULT_BUFFER_SECONDS }, (data) => {
      bufferSeconds = data.bufferSeconds || DEFAULT_BUFFER_SECONDS;
      if (button) button.textContent = `Save last ${bufferSeconds}s`;
      cb();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.bufferSeconds) return;
    bufferSeconds = changes.bufferSeconds.newValue || DEFAULT_BUFFER_SECONDS;
    if (button) button.textContent = `Save last ${bufferSeconds}s`;
    updateSaveButtonState();
  });

  function findVideo() {
    return (
      document.querySelector('video.html5-main-video') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('ytd-watch-flexy video') ||
      document.querySelector('video')
    );
  }

  function pickMimeType() {
    // WebM only — Chrome MediaRecorder MP4 fragments are unplayable until finalized.
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('error', Boolean(isError));
  }

  async function blobHasWebmHeader(blob) {
    if (!blob || blob.size < 4) return false;
    try {
      const header = new Uint8Array(await withTimeout(
        blob.slice(0, 4).arrayBuffer(),
        2000,
        'Timed out reading capture header'
      ));
      return header[0] === 0x1a
        && header[1] === 0x45
        && header[2] === 0xdf
        && header[3] === 0xa3;
    } catch {
      return false;
    }
  }

  function updateSaveButtonState() {
    if (!button) return;
    const headerReady = Boolean(initChunk);
    const bufferReady = sessionChunks.length >= bufferSeconds && headerReady;
    button.disabled = saving || !bufferReady;
    button.title = bufferReady
      ? `Save last ${bufferSeconds}s as MP4 (Alt+Shift+C)`
      : `Buffering ${sessionChunks.length}/${bufferSeconds}s — keep playing`;
  }

  function setSaving(active) {
    saving = active;
    if (button) {
      button.style.opacity = active ? '0.65' : '1';
    }
    updateSaveButtonState();
  }

  function stopRecorder() {
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorder = null;
  }

  function buildSessionBlob(chunks) {
    if (!chunks.length) return null;
    if (chunks.length === 1) return chunks[0];
    return new Blob(chunks, { type: activeMimeType || 'video/webm' });
  }

  /** Soft cap — restart only after long sessions, never when buffer first fills. */
  async function restartSessionIfTooLong(video) {
    if (sessionChunks.length < MAX_SESSION_CHUNKS || saving) return;
    setStatus('Starting fresh buffer (session limit)…');
    startBuffer(video);
  }

  function startRecorder(video) {
    if (!video || video.readyState < 2 || saving) return;

    let stream = activeStream;
    if (!stream) {
      try {
        stream = video.captureStream();
      } catch (err) {
        setStatus('Capture blocked (DRM?). Try another stream.', true);
        console.error('[Noteworthy clip]', err);
        return;
      }
      if (!stream.getVideoTracks().length) {
        setStatus('No video track to capture.', true);
        return;
      }
      activeStream = stream;
    }

    activeMimeType = pickMimeType();
    if (!activeMimeType) {
      setStatus('MediaRecorder not supported.', true);
      return;
    }

    try {
      recorder = new MediaRecorder(stream, {
        mimeType: activeMimeType,
        videoBitsPerSecond: 2500000,
      });
    } catch (err) {
      setStatus('Could not start recorder.', true);
      console.error('[Noteworthy clip]', err);
      return;
    }

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) return;

      chunkQueue = chunkQueue.then(async () => {
        if (!initChunk && await blobHasWebmHeader(event.data)) {
          initChunk = event.data;
        }

        sessionChunks.push(event.data);
        latestBlob = event.data;

        if (!saving) {
          const kb = Math.round(sessionChunks.reduce((n, b) => n + b.size, 0) / 1024);
          if (sessionChunks.length >= bufferSeconds) {
            setStatus(`Ready — ${sessionChunks.length}s buffered (saves last ${bufferSeconds}s, ${kb} KB)`);
          } else {
            const initOk = initChunk ? 'ready' : 'waiting for header';
            setStatus(`Buffering ${sessionChunks.length}/${bufferSeconds}s (${kb} KB, ${initOk})`);
          }
          updateSaveButtonState();
          if (attachedVideo) {
            restartSessionIfTooLong(attachedVideo);
          }
        }
      }).catch((err) => {
        console.error('[Noteworthy clip] chunk handler:', err);
      });
    };

    recorder.onerror = () => setStatus('Recorder error — refresh page.', true);

    recorder.start(1000);
    setStatus(`Recording — need ${bufferSeconds}s before save`);
  }

  function startBuffer(video) {
    if (!video || video.readyState < 2 || saving) return;

    stopRecorder();
    activeStream = null;
    latestBlob = null;
    sessionChunks = [];
    initChunk = null;

    startRecorder(video);
  }

  function isValidMp4Bytes(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.byteLength < MIN_BYTES) return false;
    return u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70;
  }

  function normalizeBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) return new Uint8Array(data);
    if (data && data.buffer instanceof ArrayBuffer) {
      return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength || data.length);
    }
    throw new Error('Invalid MP4 bytes from converter');
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        resolve(String(dataUrl).split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  const REPO_DIR = '~/breaking-news-game';

  function getExtensionId() {
    try {
      return chrome.runtime?.id || null;
    } catch {
      return null;
    }
  }

  function isExtensionContextValid() {
    return Boolean(getExtensionId());
  }

  function isContextInvalidatedError(err) {
    const message = err?.message || String(err || '');
    return /context invalidated|refresh this YouTube page/i.test(message);
  }

  function sendExtensionMessage(payload, timeoutMs = 45000) {
    return withTimeout(
      new Promise((resolve, reject) => {
        if (!isExtensionContextValid()) {
          reject(new Error('Extension was reloaded. Refresh this YouTube page (F5), then try Save again.'));
          return;
        }

        chrome.runtime.sendMessage(payload, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            const message = runtimeError.message || String(runtimeError);
            if (/context invalidated|extension.*invalid/i.test(message)) {
              reject(new Error('Extension was reloaded. Refresh this YouTube page (F5), then try Save again.'));
            } else {
              reject(new Error(message));
            }
            return;
          }
          resolve(response);
        });
      }),
      timeoutMs,
      'Extension did not respond — reload the extension at chrome://extensions, refresh YouTube, and try again'
    );
  }

  function nativeInstallCmd() {
    const extId = getExtensionId() || 'YOUR_EXTENSION_ID';
    return `cd ${REPO_DIR} && npm run clip:install-native-host -- ${extId}`;
  }

  function setupHelpText() {
    if (!isExtensionContextValid()) {
      return 'Refresh this YouTube page (F5), then open the Noteworthy extension popup if setup is still needed.';
    }
    return (
      'One-time setup (copy into Terminal, quit Chrome, reopen, reload extension):\n\n' +
      `${nativeInstallCmd()}\n\n` +
      'Or open the Noteworthy extension popup for a copy button.'
    );
  }

  async function validateChunksForSave(chunks) {
    if (chunks.length > 1 && !initChunk) {
      throw new Error(
        'Capture not ready yet. Keep the video playing until the buffer fills, then save.'
      );
    }

    if (chunks.length < bufferSeconds) {
      throw new Error(
        `Buffer not full (${chunks.length}/${bufferSeconds}s). Keep the video playing, then save.`
      );
    }

    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    if (totalBytes < MIN_TOTAL_BYTES) {
      throw new Error(
        `Not enough video data (${Math.round(totalBytes / 1024)} KB). Play unmuted for ${bufferSeconds}s, then save.`
      );
    }

    const merged = buildSessionBlob(chunks);
    if (!merged || !(await blobHasWebmHeader(merged.slice(0, 4)))) {
      throw new Error('Invalid capture — refresh YouTube, play the video, then try again.');
    }
  }

  async function convertViaLocalServerRaw(merged, filename, trimSeconds) {
    setStatus('Converting to MP4…');
    const headers = { 'Content-Type': 'application/octet-stream' };
    if (trimSeconds > 0) {
      headers['X-Trim-Seconds'] = String(trimSeconds);
    }
    const response = await fetch('http://127.0.0.1:39284/convert/raw', {
      method: 'POST',
      headers,
      body: merged,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error) detail = errJson.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }

    const mp4Bytes = new Uint8Array(await response.arrayBuffer());
    if (mp4Bytes.byteLength < MIN_BYTES || mp4Bytes[4] !== 0x66 || mp4Bytes[5] !== 0x74) {
      throw new Error('Converter returned invalid MP4');
    }

    downloadBlob(new Blob([mp4Bytes], { type: 'video/mp4' }), filename);
    return { ok: true, via: 'local', downloaded: true };
  }

  async function uploadMergedViaBackground(merged, filename, trimSeconds = 0) {
    const uploadId = `up-${Date.now()}`;
    const totalBytes = merged.size;
    const b64 = await blobToBase64(merged);
    const B64_SLICE = 480000;

    const begin = await sendExtensionMessage({
      type: 'CLIP_UPLOAD_BEGIN',
      uploadId,
      chunkCount: 1,
      filename,
      merged: true,
      expectedBytes: totalBytes,
      trimSeconds,
    });
    if (!begin?.ok) {
      throw new Error(begin?.error || 'Upload begin failed');
    }

    setStatus('Uploading clip…');
    for (let offset = 0; offset < b64.length; offset += B64_SLICE) {
      const chunkResult = await sendExtensionMessage({
        type: 'CLIP_UPLOAD_CHUNK',
        uploadId,
        index: 0,
        data: b64.slice(offset, offset + B64_SLICE),
        append: offset > 0,
      });
      if (!chunkResult?.ok) {
        throw new Error(chunkResult?.error || 'Upload failed');
      }
    }

    setStatus('Converting to MP4…');
    const finish = await sendExtensionMessage({
      type: 'CLIP_UPLOAD_FINISH',
      uploadId,
      trimSeconds,
    });
    if (!finish?.ok) {
      throw new Error(finish?.error || 'Convert failed');
    }
    return finish;
  }

  async function mergedWebmBlob(chunks) {
    const blob = buildSessionBlob(chunks);
    if (!blob) {
      throw new Error('No capture chunks to merge');
    }
    return blob;
  }

  async function uploadMergedWebmForConvert(chunks, filename) {
    const merged = await mergedWebmBlob(chunks);
    if (!(await blobHasWebmHeader(merged.slice(0, 4)))) {
      throw new Error('Invalid WebM capture — refresh YouTube, play the video, then save again.');
    }

    const trimSeconds = chunks.length > bufferSeconds ? bufferSeconds : 0;
    let lastError = null;

    try {
      const health = await fetch('http://127.0.0.1:39284/health', { method: 'GET' });
      if (health.ok) {
        const status = await health.json();
        if (status?.ok) {
          return await convertViaLocalServerRaw(merged, filename, trimSeconds);
        }
      }
    } catch (err) {
      lastError = err;
      console.warn('[Noteworthy clip] Local convert failed:', err.message);
    }

    try {
      return await uploadMergedViaBackground(merged, filename, trimSeconds);
    } catch (err) {
      lastError = err;
      console.warn('[Noteworthy clip] Background convert failed:', err.message);
    }

    throw lastError || new Error('Could not convert clip — is npm run clip:convert-server running?');
  }

  async function convertChunksToMp4(chunks, filename) {
    return uploadMergedWebmForConvert(chunks, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function chunksForSave() {
    const body = sessionChunks.length ? sessionChunks.slice() : (latestBlob ? [latestBlob] : []);
    if (!body.length) {
      return body;
    }

    if (initChunk) {
      const headHasHeader = await blobHasWebmHeader(body[0]);
      if (!headHasHeader) {
        const rest = body.filter((chunk) => chunk !== initChunk);
        return [initChunk, ...rest];
      }
    }

    return body;
  }

  async function captureBlobForSave() {
    const chunks = await chunksForSave();
    const blob = chunks[chunks.length - 1] || latestBlob;
    return { blob, chunks };
  }

  function restartBufferIfNeeded() {
    if (attachedVideo) {
      setTimeout(() => startBuffer(attachedVideo), 300);
    }
  }

  async function saveLast() {
    if (saving) {
      return { ok: false, error: 'Already saving…' };
    }

    setSaving(true);
    setStatus('Preparing clip…');

    let filename = '';
    let chunks = [];

    try {
      await drainChunkQueue(4000);
      await flushRecorderData(1200);
      await drainChunkQueue(1500);

      ({ chunks } = await captureBlobForSave());
      await validateChunksForSave(chunks);

      const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
      if (totalBytes < MIN_BYTES) {
        throw new Error('Not enough video buffered yet. Let it play longer, then save again.');
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `youtube-last-${bufferSeconds}s-${stamp}.mp4`;

      setStatus('Converting to MP4…');

      if (!isExtensionContextValid()) {
        throw new Error('Extension was reloaded. Refresh this YouTube page (F5), then try Save again.');
      }

      const result = await convertChunksToMp4(chunks, filename);

      if (result.savedTo || result.downloaded) {
        const where = result.savedTo ? `Downloads (${result.via || 'native'})` : 'Downloads';
        setStatus(`Saved MP4 to ${where}`);
        restartBufferIfNeeded();
        return {
          ok: true,
          seconds: bufferSeconds,
          format: 'mp4',
          via: result.via,
          savedTo: result.savedTo || null,
          downloaded: Boolean(result.downloaded),
        };
      }

      if (!result.bytes) {
        throw new Error('MP4 conversion failed');
      }

      const mp4Bytes = normalizeBytes(result.bytes);
      if (!isValidMp4Bytes(mp4Bytes)) {
        throw new Error('Converter returned invalid MP4 (missing ftyp header).');
      }

      const mp4Blob = new Blob([mp4Bytes], { type: 'video/mp4' });
      downloadBlob(mp4Blob, filename);
      setStatus(`Saved ${bufferSeconds}s MP4 (${result.via || 'convert'})`);
      restartBufferIfNeeded();
      return { ok: true, seconds: bufferSeconds, format: 'mp4', via: result.via };
    } catch (err) {
      console.error('[Noteworthy clip] save failed:', err);
      const baseName = (filename || `youtube-last-${bufferSeconds}s-failed`).replace(/\.mp4$/i, '');
      const contextDead = isContextInvalidatedError(err);

      if (contextDead) {
        setStatus('Extension reloaded — refresh this page (F5)', true);
        alert(
          'The extension was updated or reloaded while this tab was open.\n\n' +
            '1. Refresh YouTube (F5)\n' +
            '2. Let the video play until the buffer fills\n' +
            '3. Click Save again'
        );
        return { ok: false, error: err.message };
      }

      if (chunks.length > 0) {
        const merged = await mergedWebmBlob(chunks);
        downloadBlob(merged, `${baseName}.webm`);
        setStatus('Saved WebM fallback — see alert', true);
        alert(
          `MP4 convert failed: ${err.message}\n\n` +
            `Saved merged WebM: ${baseName}.webm\n\n` +
            'For automatic MP4 next time, run in Terminal (leave open):\n' +
            'npm run clip:convert-server\n\n' +
            'Then reload the extension at chrome://extensions and try again.\n\n' +
            'Convert this file manually:\n' +
            `npm run clip:convert-webm -- ~/Downloads/${baseName}.webm --rights-basis "Manual review"`
        );
        restartBufferIfNeeded();
        return { ok: true, seconds: bufferSeconds, format: 'webm', warning: err.message };
      }

      setStatus(err.message || 'Save failed', true);
      alert(err.message || 'Save failed');
      restartBufferIfNeeded();
      return { ok: false, error: err.message };
    } finally {
      setSaving(false);
      updateSaveButtonState();
    }
  }

  function mountUi() {
    if (document.getElementById('noteworthy-yt-clip-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'noteworthy-yt-clip-wrap';

    statusEl = document.createElement('div');
    statusEl.className = 'nw-clip-status';
    statusEl.textContent = 'Waiting for video…';

    button = document.createElement('button');
    button.id = 'noteworthy-yt-clip-save';
    button.type = 'button';
    button.textContent = `Save last ${bufferSeconds}s`;
    button.title = 'Save last N seconds as MP4 (Alt+Shift+C)';
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const result = await saveLast();
      if (!result.ok && result.error) alert(result.error);
    });

    wrap.appendChild(statusEl);
    wrap.appendChild(button);
    document.body.appendChild(wrap);
  }

  function attachToCurrentVideo() {
    if (saving) return;

    const video = findVideo();
    if (!video) {
      setStatus('No video on this page');
      return;
    }

    if (video === attachedVideo && recorder && recorder.state === 'recording') {
      return;
    }

    if (video !== attachedVideo) {
      attachedVideo = video;
      startBuffer(video);

      if (!video.dataset.noteworthyClipHooked) {
        video.dataset.noteworthyClipHooked = '1';
        video.addEventListener('play', () => {
          if (!recorder || recorder.state !== 'recording') startBuffer(video);
        });
        video.addEventListener('loadeddata', () => {
          if (!recorder || recorder.state !== 'recording') startBuffer(video);
        });
      }
      return;
    }

    // Same video but recorder died — restart without clearing if we still have chunks.
    if (!recorder || recorder.state !== 'recording') {
      startBuffer(video);
    }
  }

  function onNavigate() {
    attachedVideo = null;
    activeStream = null;
    stopRecorder();
    latestBlob = null;
    sessionChunks = [];
    initChunk = null;
    setTimeout(attachToCurrentVideo, 1200);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SAVE_LAST') {
      saveLast().then((result) => {
        if (!result.ok && result.error) alert(result.error);
        sendResponse(result);
      });
      return true;
    }
    return false;
  });

  loadSettings(() => {
    mountUi();
    updateSaveButtonState();
    attachToCurrentVideo();
    setInterval(attachToCurrentVideo, 2000);

    window.addEventListener('yt-navigate-finish', onNavigate);
    window.addEventListener('yt-page-data-updated', onNavigate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') attachToCurrentVideo();
    });
  });
})();
