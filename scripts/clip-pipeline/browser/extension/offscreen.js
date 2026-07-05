/**
 * Offscreen MP4 converter - FFmpeg runs on main thread (no worker import issues).
 */
import createFFmpegCore from './vendor/ffmpeg-core.js';

let ffmpeg = null;
let loadPromise = null;
let ready = false;

async function loadFfmpeg() {
  const wasmURL = chrome.runtime.getURL('vendor/ffmpeg-core.wasm');

  const instance = await createFFmpegCore({
    locateFile: (path) => {
      if (path.endsWith('.wasm')) return wasmURL;
      return path;
    },
  });

  return instance;
}

async function getFfmpeg() {
  if (ffmpeg) return ffmpeg;
  if (!loadPromise) {
    loadPromise = loadFfmpeg().then((instance) => {
      ffmpeg = instance;
      return instance;
    });
  }
  return loadPromise;
}

async function convertWebmToMp4(arrayBuffer) {
  const ff = await getFfmpeg();

  ff.FS.writeFile('input.webm', new Uint8Array(arrayBuffer));

  const args = [
    '-nostdin', '-y',
    '-i', 'input.webm',
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-vf', "scale='min(1280,iw)':-2",
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-movflags', '+faststart',
    'output.mp4',
  ];

  ff.exec(...args);
  const code = ff.ret;
  ff.reset();

  if (code !== 0) {
    throw new Error(`FFmpeg exited with code ${code}`);
  }

  return ff.FS.readFile('output.mp4');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DO_CONVERT') {
    (async () => {
      try {
        const mp4 = await convertWebmToMp4(message.buffer);
        const bytes = mp4 instanceof Uint8Array ? mp4 : new Uint8Array(mp4);
        sendResponse({ ok: true, bytes });
      } catch (err) {
        console.error('[Noteworthy offscreen]', err);
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  if (message.type === 'PING_OFFSCREEN') {
    sendResponse({ ok: true, ready });
    return true;
  }

  return false;
});

(async () => {
  try {
    await getFfmpeg();
    ready = true;
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' }).catch(() => {});
    console.log('[Noteworthy offscreen] FFmpeg ready');
  } catch (err) {
    console.error('[Noteworthy offscreen] FFmpeg load failed:', err);
  }
})();
