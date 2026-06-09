/**
 * Noteworthy YouTube clip extension — content script.
 */
(function () {
  'use strict';

  const DEFAULT_BUFFER_SECONDS = 30;
  const MIN_BYTES = 5000;
  const MIN_TOTAL_BYTES = 100000;

  let bufferSeconds = DEFAULT_BUFFER_SECONDS;
  let recorder = null;
  let attachedVideo = null;
  let activeStream = null;
  let button = null;
  let statusEl = null;
  let saving = false;
  let activeMimeType = '';
  /** @type {Blob[]} */
  let chunkRing = [];
  /** @type {Blob | null} */
  let initChunk = null;
  /** @type {number | null} */
  let initChunkSeq = null;
  /** @type {number} */
  let globalChunkSeq = 0;
  /** @type {number} */
  let ringBaseSeq = 0;
  /** @type {boolean} */
  let rolloverPending = false;
  /** @type {Blob | null} */
  let latestBlob = null;
  /** @type {Promise<void>} */
  let chunkQueue = Promise.resolve();

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
    if (attachedVideo) startBuffer(attachedVideo);
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
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return header[0] === 0x1a
      && header[1] === 0x45
      && header[2] === 0xdf
      && header[3] === 0xa3;
  }

  function updateSaveButtonState() {
    if (!button) return;
    const initAdjacent = initChunkSeq !== null && initChunkSeq === ringBaseSeq - 1;
    const headerReady = Boolean(initChunk) && (initAdjacent || chunkRing[0] === initChunk);
    const bufferReady = chunkRing.length >= bufferSeconds && headerReady;
    button.disabled = saving || !bufferReady;
    button.title = bufferReady
      ? `Save last ${bufferSeconds}s as MP4 (Alt+Shift+C)`
      : `Buffering ${chunkRing.length}/${bufferSeconds}s — keep playing`;
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

  function startBuffer(video) {
    if (!video || video.readyState < 2 || saving) return;

    stopRecorder();
    latestBlob = null;
    chunkRing = [];
    initChunk = null;
    initChunkSeq = null;
    globalChunkSeq = 0;
    ringBaseSeq = 0;
    rolloverPending = false;

    let stream;
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
        const seq = globalChunkSeq;
        globalChunkSeq += 1;

        if (await blobHasWebmHeader(event.data)) {
          initChunk = event.data;
          initChunkSeq = seq;
        }

        chunkRing.push(event.data);
        while (chunkRing.length > bufferSeconds) {
          chunkRing.shift();
          ringBaseSeq += 1;
        }
        latestBlob = event.data;

        const headHasHeader = await blobHasWebmHeader(chunkRing[0]);
        const initAdjacent = initChunkSeq !== null && initChunkSeq === ringBaseSeq - 1;
        if (!headHasHeader && !initAdjacent && attachedVideo && !rolloverPending && !saving) {
          rolloverRecorder(attachedVideo);
          return;
        }

        if (!saving) {
          const kb = Math.round(chunkRing.reduce((n, b) => n + b.size, 0) / 1024);
          const initOk = headHasHeader || initAdjacent ? 'ready' : 'waiting for header';
          setStatus(`Buffering ${chunkRing.length}s / ${bufferSeconds}s (${kb} KB, ${initOk})`);
          updateSaveButtonState();
        }
      }).catch((err) => {
        console.error('[Noteworthy clip] chunk handler:', err);
      });
    };

    recorder.onerror = () => setStatus('Recorder error — refresh page.', true);

    recorder.start(2000);
    setStatus(`Recording ${bufferSeconds}s buffer…`);
  }

  function rolloverRecorder(video) {
    if (rolloverPending || saving || !video) return;
    rolloverPending = true;
    stopRecorder();
    chunkRing = [];
    initChunk = null;
    initChunkSeq = null;
    globalChunkSeq = 0;
    ringBaseSeq = 0;
    rolloverPending = false;
    setStatus('Refreshing capture buffer…');
    startBuffer(video);
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

  function sendExtensionMessage(payload) {
    return new Promise((resolve, reject) => {
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
    });
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
    const headHasHeader = chunks.length > 0 && await blobHasWebmHeader(chunks[0]);
    const initAdjacent = initChunkSeq !== null && initChunkSeq === ringBaseSeq - 1;
    if (!headHasHeader && !(initChunk && initAdjacent)) {
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

    if (!(await blobHasWebmHeader(chunks[0]))) {
      throw new Error('Invalid capture — refresh YouTube, play the video, then try again.');
    }
  }

  async function convertViaLocalServerRaw(merged, filename) {
    setStatus('Converting to MP4…');
    const response = await fetch('http://127.0.0.1:39284/convert/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
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

  async function uploadMergedViaBackground(merged, filename) {
    const uploadId = `up-${Date.now()}`;
    const B64_SLICE = 480000;

    const begin = await sendExtensionMessage({
      type: 'CLIP_UPLOAD_BEGIN',
      uploadId,
      chunkCount: 1,
      filename,
      merged: true,
    });
    if (!begin?.ok) {
      throw new Error(begin?.error || 'Upload begin failed');
    }

    setStatus('Uploading clip…');
    const b64 = await blobToBase64(merged);
    for (let offset = 0; offset < b64.length; offset += B64_SLICE) {
      const slice = b64.slice(offset, offset + B64_SLICE);
      const chunkResult = await sendExtensionMessage({
        type: 'CLIP_UPLOAD_CHUNK',
        uploadId,
        index: 0,
        data: slice,
        append: offset > 0,
        byteLength: offset === 0 ? merged.size : undefined,
      });
      if (!chunkResult?.ok) {
        throw new Error(chunkResult?.error || 'Upload failed');
      }
    }

    setStatus('Converting to MP4…');
    const finish = await sendExtensionMessage({
      type: 'CLIP_UPLOAD_FINISH',
      uploadId,
    });
    if (!finish?.ok) {
      throw new Error(finish?.error || 'Convert failed');
    }
    return finish;
  }

  function mergedWebmBlob(chunks) {
    return chunks.length === 1
      ? chunks[0]
      : new Blob(chunks, { type: activeMimeType || 'video/webm' });
  }

  async function uploadMergedWebmForConvert(chunks, filename) {
    const merged = mergedWebmBlob(chunks);
    if (!(await blobHasWebmHeader(merged.slice(0, 4)))) {
      throw new Error('Invalid WebM capture — refresh YouTube, play the video, then save again.');
    }

    let lastError = null;

    try {
      const health = await fetch('http://127.0.0.1:39284/health', { method: 'GET' });
      if (health.ok) {
        const status = await health.json();
        if (status?.ok) {
          return await convertViaLocalServerRaw(merged, filename);
        }
      }
    } catch (err) {
      lastError = err;
      console.warn('[Noteworthy clip] Local convert failed:', err.message);
    }

    try {
      return await uploadMergedViaBackground(merged, filename);
    } catch (err) {
      lastError = err;
      console.warn('[Noteworthy clip] Native convert failed:', err.message);
    }

    throw lastError || new Error('Could not convert clip — reload the extension and try again.');
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
    const body = chunkRing.length ? chunkRing.slice() : (latestBlob ? [latestBlob] : []);
    if (!body.length) {
      return body;
    }
    if (await blobHasWebmHeader(body[0])) {
      return body;
    }
    if (initChunk && initChunkSeq === ringBaseSeq - 1) {
      return [initChunk, ...body];
    }
    throw new Error('Capture gap — keep playing for a few seconds, then save again.');
  }

  async function captureBlobForSave() {
    if (recorder && recorder.state === 'recording') {
      await new Promise((resolve) => {
        const onData = () => resolve();
        recorder.addEventListener('dataavailable', onData, { once: true });
        try {
          recorder.requestData();
        } catch {
          resolve();
        }
        setTimeout(resolve, 800);
      });
    }

    const chunks = await chunksForSave();
    const blob = chunks[chunks.length - 1] || latestBlob;
    return { blob, chunks };
  }

  function restartBufferIfNeeded() {
    if (attachedVideo && activeStream) {
      setTimeout(() => startBuffer(attachedVideo), 300);
    }
  }

  async function saveLast() {
    if (saving) {
      return { ok: false, error: 'Already saving…' };
    }

    setSaving(true);
    setStatus('Preparing clip…');

    await chunkQueue;

    const { blob, chunks } = await captureBlobForSave();
    try {
      await validateChunksForSave(chunks);
    } catch (validationErr) {
      setSaving(false);
      setStatus(validationErr.message, true);
      return { ok: false, error: validationErr.message };
    }

    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    if (!blob || totalBytes < MIN_BYTES) {
      setSaving(false);
      setStatus('Not enough video yet. Play ~10s then retry.', true);
      return { ok: false, error: 'Not enough video buffered yet. Let it play longer.' };
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `youtube-last-${bufferSeconds}s-${stamp}.mp4`;

    setStatus('Converting to MP4…');

    try {
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
      console.error('[Noteworthy clip] MP4 failed:', err);
      const baseName = filename.replace(/\.mp4$/i, '');
      const contextDead = isContextInvalidatedError(err);

      if (contextDead) {
        setStatus('Extension reloaded — refresh this page (F5)', true);
        alert(
          'The extension was updated or reloaded while this tab was open.\n\n' +
            '1. Refresh YouTube (F5)\n' +
            '2. Let the video play until the buffer fills\n' +
            '3. Click Save again\n\n' +
            'No setup command is needed if the popup already says "Automatic MP4 ready".'
        );
        restartBufferIfNeeded();
        return { ok: false, error: err.message };
      }

      if (chunks.length > 1) {
        const merged = mergedWebmBlob(chunks);
        downloadBlob(merged, `${baseName}.webm`);
        setStatus('Saved WebM fallback — run convert command (see alert)', true);
        alert(
          `MP4 convert failed: ${err.message}\n\n` +
            `Saved merged WebM: ${baseName}.webm\n\n` +
            'Convert manually:\n' +
            `npm run clip:convert-webm -- ~/Downloads/${baseName}.webm --rights-basis "Manual review"`
        );
      } else {
        const webmName = `${baseName}.webm`;
        const webmBlob = mergedWebmBlob(chunks);
        downloadBlob(webmBlob, webmName);
        setStatus('Saved WebM — convert locally (see alert)', true);
        alert(
          `MP4 convert failed: ${err.message}\n\n` +
            `Saved WebM: ${webmName}\n\n` +
            setupHelpText() + '\n\n' +
            'Or convert manually:\n' +
            `npm run clip:convert-webm -- ~/Desktop/${webmName} --rights-basis "Manual review"`
        );
      }
      restartBufferIfNeeded();
      return { ok: true, seconds: bufferSeconds, format: 'webm', warning: err.message };
    } finally {
      setSaving(false);
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

    attachedVideo = video;
    startBuffer(video);

    if (!video.dataset.noteworthyClipHooked) {
      video.dataset.noteworthyClipHooked = '1';
      video.addEventListener('play', () => startBuffer(video));
      video.addEventListener('loadeddata', () => startBuffer(video));
    }
  }

  function onNavigate() {
    attachedVideo = null;
    activeStream = null;
    stopRecorder();
    latestBlob = null;
    chunkRing = [];
    initChunk = null;
    initChunkSeq = null;
    globalChunkSeq = 0;
    ringBaseSeq = 0;
    rolloverPending = false;
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
