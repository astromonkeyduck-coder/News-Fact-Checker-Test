const OFFSCREEN_PATH = 'offscreen.html';
const NATIVE_HOST = 'com.noteworthy.clip';
const LOCAL_CONVERT_URL = 'http://127.0.0.1:39284/convert';
const LOCAL_CONVERT_RAW_URL = 'http://127.0.0.1:39284/convert/raw';
const LOCAL_HEALTH_URL = 'http://127.0.0.1:39284/health';

let offscreenReady = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OFFSCREEN_READY') {
    offscreenReady = true;
  }
});

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  if (!b64 || typeof b64 !== 'string') {
    throw new Error('Invalid base64 input');
  }
  const clean = b64.replace(/\s/g, '');
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Upload data corrupted — refresh YouTube and try again');
  }
}

function postNativeMessage(payload, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (err) {
      reject(err);
      return;
    }

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      try {
        port.disconnect();
      } catch {
        /* ignore */
      }
      finish(reject, new Error('Native messaging timed out'));
    }, timeoutMs);

    port.onMessage.addListener((response) => {
      finish(resolve, response);
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      finish(
        reject,
        new Error(chrome.runtime.lastError?.message || 'Native host disconnected before responding')
      );
    });

    port.postMessage(payload);
  });
}

async function pingNativeHost() {
  try {
    const response = await postNativeMessage({ type: 'ping' }, 8000);
    if (response?.ok && response.pong) {
      return { ok: true, ffmpeg: response.ffmpeg || null };
    }
    return { ok: false, error: response?.error || 'Native host ping failed' };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function convertViaNativeChunked(webmChunksBase64, filename) {
  const sessionId = `clip-${Date.now()}`;
  await postNativeMessage({
    type: 'begin',
    sessionId,
    chunkCount: webmChunksBase64.length,
    filename,
  }, 15000);

  for (let index = 0; index < webmChunksBase64.length; index += 1) {
    await postNativeMessage({
      type: 'chunk',
      sessionId,
      index,
      data: webmChunksBase64[index],
    }, 30000);
  }

  const response = await postNativeMessage({ type: 'commit', sessionId }, 120000);
  if (response?.ok && response.savedTo) {
    return { savedTo: response.savedTo, size: response.size || 0 };
  }
  throw new Error(response?.error || 'Native convert failed');
}

async function nativeConvertBegin(sessionId, chunkCount, filename) {
  return postNativeMessage({
    type: 'begin',
    sessionId,
    chunkCount,
    filename,
  }, 15000);
}

async function nativeConvertChunk(sessionId, index, data) {
  const MAX_B64 = 750000;
  if (!data || data.length <= MAX_B64) {
    const response = await postNativeMessage({
      type: 'chunk',
      sessionId,
      index,
      data,
      append: false,
    }, 30000);
    return response;
  }

  let offset = 0;
  let append = false;
  let bytesWritten = 0;
  while (offset < data.length) {
    const slice = data.slice(offset, offset + MAX_B64);
    const response = await postNativeMessage({
      type: 'chunk',
      sessionId,
      index,
      data: slice,
      append,
    }, 30000);
    bytesWritten = response?.bytesWritten || bytesWritten;
    offset += MAX_B64;
    append = true;
  }
  return { ok: true, index, bytesWritten };
}

async function nativeConvertCommit(sessionId) {
  const response = await postNativeMessage({ type: 'commit', sessionId }, 120000);
  if (response?.ok && response.savedTo) {
    return { savedTo: response.savedTo, size: response.size || 0 };
  }
  throw new Error(response?.error || 'Native convert failed');
}

async function convertViaLocalServer(webmChunksBase64) {
  const payload = { webmChunksBase64 };

  const response = await fetch(LOCAL_CONVERT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

  return new Uint8Array(await response.arrayBuffer());
}

async function convertViaLocalServerRaw(webmBytes, trimSeconds = 0) {
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (trimSeconds > 0) {
    headers['X-Trim-Seconds'] = String(trimSeconds);
  }

  const body = webmBytes instanceof Uint8Array ? webmBytes : new Uint8Array(webmBytes);
  const response = await fetch(LOCAL_CONVERT_RAW_URL, {
    method: 'POST',
    headers,
    body,
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

  return new Uint8Array(await response.arrayBuffer());
}

/** @type {Map<string, { filename: string, parts: Uint8Array[] }>} */
const clipUploadSessions = new Map();

function clipUploadBegin(uploadId, chunkCount, filename, merged = false, expectedBytes = 0, trimSeconds = 0) {
  clipUploadSessions.set(uploadId, {
    filename,
    parts: new Array(chunkCount),
    merged: Boolean(merged),
    expectedBytes: Number(expectedBytes) || 0,
    trimSeconds: Number(trimSeconds) || 0,
  });
  return { ok: true };
}

function bytesFromPayload(buffer, data, byteLength, index) {
  if (typeof data === 'string' && data.length > 0) {
    return base64ToBytes(data);
  }

  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer);
  }

  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  if (buffer && typeof buffer === 'object' && buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
    return Uint8Array.from(buffer.data);
  }

  throw new Error(`Missing data for chunk ${index + 1}`);
}

function clipUploadChunk(uploadId, index, buffer, data, byteLength, append = false) {
  const session = clipUploadSessions.get(uploadId);
  if (!session) {
    throw new Error('Upload session expired — refresh YouTube and try again');
  }

  if (typeof data === 'string' && data.length > 0) {
    if (append) {
      if (typeof session.parts[index] !== 'string') {
        throw new Error(`Cannot append to missing chunk ${index + 1} — refresh YouTube and try again`);
      }
      session.parts[index] += data;
    } else {
      session.parts[index] = data;
    }
    return { ok: true, bytesWritten: session.parts[index].length };
  }

  const bytes = bytesFromPayload(buffer, data, byteLength, index);
  if (bytes.byteLength === 0) {
    throw new Error(`Chunk ${index + 1} is empty — refresh YouTube and try again`);
  }

  if (append) {
    const existing = session.parts[index];
    if (existing instanceof Uint8Array) {
      const combined = new Uint8Array(existing.byteLength + bytes.byteLength);
      combined.set(existing, 0);
      combined.set(bytes, existing.byteLength);
      session.parts[index] = combined;
    } else if (typeof existing === 'string') {
      throw new Error(`Cannot append binary to text chunk ${index + 1}`);
    } else {
      throw new Error(`Cannot append to missing chunk ${index + 1} — refresh YouTube and try again`);
    }
  } else {
    session.parts[index] = bytes;
  }

  const written = session.parts[index];
  const size = written instanceof Uint8Array ? written.byteLength : written.length;
  return { ok: true, bytesWritten: size };
}

function partsToWebmBase64(parts) {
  return parts.filter(Boolean).map((part) => {
    if (typeof part === 'string') return part;
    const slice = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
    return bufferToBase64(slice);
  });
}

function estimatePartsBytes(parts) {
  return parts.reduce((sum, part) => {
    if (typeof part === 'string') {
      return sum + Math.floor(part.length * 0.75);
    }
    return sum + (part?.byteLength || 0);
  }, 0);
}

async function downloadMp4Bytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: false });
    return { downloaded: true, via: 'local' };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

async function clipUploadFinish(uploadId) {
  const session = clipUploadSessions.get(uploadId);
  clipUploadSessions.delete(uploadId);
  if (!session) {
    throw new Error('Upload session expired — refresh YouTube and try again');
  }

  const expected = session.parts.length;
  const parts = session.parts.filter(Boolean);
  if (parts.length !== expected) {
    throw new Error(`Missing chunks (${parts.length}/${expected}) — refresh YouTube and try again`);
  }

  const totalBytes = estimatePartsBytes(parts);
  if (totalBytes < 5000) {
    throw new Error(
      `Input too small (${totalBytes} bytes) — let the video play until the buffer is full before saving`
    );
  }

  if (session.expectedBytes && totalBytes < Math.floor(session.expectedBytes * 0.9)) {
    throw new Error(
      `Upload incomplete (${totalBytes} of ${session.expectedBytes} bytes) — refresh YouTube and try again`
    );
  }

  const webmChunksBase64 = session.merged
    ? partsToWebmBase64(parts).slice(0, 1)
    : partsToWebmBase64(parts);
  const headerBytes = base64ToBytes(webmChunksBase64[0].slice(0, 16));
  if (!hasWebmHeader(headerBytes.buffer)) {
    throw new Error('Invalid WebM capture — refresh YouTube, play the video, then save again.');
  }

  try {
    const nativeResult = await convertViaNativeChunkedWithSplit(webmChunksBase64, session.filename);
    return { savedTo: nativeResult.savedTo, via: 'native' };
  } catch (nativeErr) {
    console.warn('[Noteworthy] Native convert failed:', nativeErr.message);
  }

  if (await isLocalServerAvailable()) {
    try {
      const mergedPart = parts[0];
      const webmBytes = typeof mergedPart === 'string'
        ? base64ToBytes(mergedPart)
        : (mergedPart instanceof Uint8Array ? mergedPart : new Uint8Array(mergedPart));
      const bytes = await convertViaLocalServerRaw(webmBytes, session.trimSeconds || 0);
      return downloadMp4Bytes(bytes, session.filename);
    } catch (localErr) {
      console.warn('[Noteworthy] Local convert server failed:', localErr.message);
    }
  }

  throw new Error(
    'Could not convert clip. Open the extension popup and confirm "Automatic MP4 ready", or refresh this page and try again.'
  );
}

async function convertViaNativeChunkedWithSplit(webmChunksBase64, filename) {
  const sessionId = `clip-${Date.now()}`;
  await nativeConvertBegin(sessionId, webmChunksBase64.length, filename);

  for (let index = 0; index < webmChunksBase64.length; index += 1) {
    await nativeConvertChunk(sessionId, index, webmChunksBase64[index]);
  }

  return nativeConvertCommit(sessionId).then((result) => ({
    savedTo: result.savedTo,
    via: 'native',
  }));
}

async function getConvertStatus() {
  const [native, localServer] = await Promise.all([
    pingNativeHost(),
    isLocalServerAvailable(),
  ]);

  return {
    ok: true,
    extensionId: chrome.runtime.id,
    native,
    localServer,
    ready: native.ok || localServer,
    preferred: native.ok ? 'native' : (localServer ? 'local' : null),
    nativeError: native.ok ? null : (native.error || 'Native host not connected'),
  };
}

async function hasOffscreenDocument() {
  if (!chrome.offscreen) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
  });
  return contexts.length > 0;
}

async function ensureOffscreenReady() {
  if (!chrome.offscreen) {
    throw new Error('Offscreen API not available');
  }

  if (!(await hasOffscreenDocument())) {
    offscreenReady = false;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['WORKERS'],
      justification: 'Fallback WebM to MP4 conversion',
    });
  }

  if (offscreenReady) return;

  for (let i = 0; i < 60; i += 1) {
    const ping = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'PING_OFFSCREEN' }, (response) => {
        resolve(chrome.runtime.lastError ? null : response);
      });
    });
    if (ping?.ready) {
      offscreenReady = true;
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error('In-browser MP4 converter failed to start');
}

async function isLocalServerAvailable() {
  try {
    const response = await fetch(LOCAL_HEALTH_URL, { method: 'GET' });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

function hasWebmHeader(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  return bytes.length >= 4
    && bytes[0] === 0x1a
    && bytes[1] === 0x45
    && bytes[2] === 0xdf
    && bytes[3] === 0xa3;
}

async function convertViaOffscreen(arrayBuffer) {
  await ensureOffscreenReady();
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'DO_CONVERT', buffer: arrayBuffer }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok || !response.bytes) {
        reject(new Error(response?.error || 'In-browser MP4 conversion failed'));
        return;
      }
      resolve(response.bytes);
    });
  });
}

async function convertWebmToMp4(options = {}) {
  const {
    webmChunksBase64 = [],
    filename = 'youtube-clip.mp4',
    buffer,
    chunks,
  } = options;

  const chunkB64 = webmChunksBase64.length
    ? webmChunksBase64
    : (Array.isArray(chunks) ? chunks.map((buf) => bufferToBase64(buf)) : []);

  if (chunkB64.length === 0 && !buffer) {
    throw new Error('Missing webmChunksBase64');
  }

  const normalizedChunks = chunkB64.length ? chunkB64 : [bufferToBase64(buffer)];

  try {
    const nativeResult = await convertViaNativeChunked(normalizedChunks, filename);
    return { savedTo: nativeResult.savedTo, via: 'native' };
  } catch (nativeErr) {
    console.warn('[Noteworthy] Native host unavailable:', nativeErr.message);
  }

  if (await isLocalServerAvailable()) {
    try {
      const bytes = await convertViaLocalServer(normalizedChunks);
      return downloadMp4Bytes(bytes, filename);
    } catch (localErr) {
      console.warn('[Noteworthy] Local convert server failed:', localErr.message);
    }
  }

  if (normalizedChunks.length > 1) {
    throw new Error(
      'Could not convert clip. Open the extension popup and confirm "Automatic MP4 ready", or refresh this page and try again.'
    );
  }

  const singleBuffer = buffer || base64ToBytes(normalizedChunks[0]).buffer;
  if (!hasWebmHeader(singleBuffer)) {
    throw new Error(
      'Captured WebM is incomplete. Let the video play longer, then save again.'
    );
  }

  try {
    const bytes = await convertViaOffscreen(singleBuffer);
    return { bytes, via: 'wasm' };
  } catch (wasmErr) {
    throw new Error(
      `${wasmErr.message}. Open the extension popup to finish setup.`
    );
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'save-clip') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SAVE_LAST' }).catch(() => {});
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CONVERT_STATUS') {
    getConvertStatus()
      .then((status) => sendResponse(status))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'CLIP_UPLOAD_BEGIN') {
    try {
      sendResponse(clipUploadBegin(
        message.uploadId,
        message.chunkCount,
        message.filename,
        message.merged,
        message.expectedBytes,
        message.trimSeconds
      ));
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  }

  if (message.type === 'CLIP_UPLOAD_CHUNK') {
    try {
      sendResponse(clipUploadChunk(
        message.uploadId,
        message.index,
        message.buffer,
        message.data,
        message.byteLength,
        message.append
      ));
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  }

  if (message.type === 'CLIP_UPLOAD_FINISH') {
    clipUploadFinish(message.uploadId)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'NATIVE_CONVERT_BEGIN') {
    nativeConvertBegin(message.sessionId, message.chunkCount, message.filename)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'NATIVE_CONVERT_CHUNK') {
    nativeConvertChunk(message.sessionId, message.index, message.data)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'NATIVE_CONVERT_COMMIT') {
    nativeConvertCommit(message.sessionId)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'CONVERT_WEBM') {
    convertWebmToMp4({
      webmChunksBase64: message.webmChunksBase64,
      filename: message.filename,
      buffer: message.buffer,
      chunks: message.chunks,
    })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'SAVE_FROM_POPUP') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'SAVE_LAST' }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: 'Open a YouTube watch page first.' });
          return;
        }
        sendResponse(response || { ok: true });
      });
    });
    return true;
  }

  return false;
});
