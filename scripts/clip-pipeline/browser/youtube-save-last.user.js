// ==UserScript==
// @name         Noteworthy - Save Last 30s (YouTube)
// @namespace    noteworthy-news
// @version      1.0.0
// @description  Floating button on YouTube to download the last 30 seconds currently playing in your browser.
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==
//
// LEGAL: You are responsible for rights, YouTube Terms of Service, and copyright
// before republishing any clip. This records what is already playing in YOUR
// browser - it does not bypass DRM or download from YouTube servers directly.
// Some streams (DRM) may block capture; use official feeds when possible.

(function () {
  'use strict';

  const BUFFER_SECONDS = 30;
  const SLICE_MS = 1000;

  /** @type {BlobPart[]} */
  let chunks = [];
  /** @type {MediaRecorder | null} */
  let recorder = null;
  /** @type {HTMLVideoElement | null} */
  let attachedVideo = null;
  /** @type {HTMLButtonElement | null} */
  let button = null;
  /** @type {HTMLDivElement | null} */
  let statusEl = null;

  function findVideo() {
    return (
      document.querySelector('video.html5-main-video') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('ytd-watch-flexy video') ||
      document.querySelector('video')
    );
  }

  function pickMimeType() {
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
    statusEl.style.color = isError ? '#ff8a80' : '#aaa';
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
    if (!video || video.readyState < 2) return;

    stopRecorder();
    chunks = [];

    let stream;
    try {
      stream = video.captureStream();
    } catch (err) {
      setStatus('Capture blocked on this stream (DRM?).', true);
      console.error('[Noteworthy clip] captureStream failed:', err);
      return;
    }

    if (!stream.getVideoTracks().length) {
      setStatus('No video track to capture.', true);
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      setStatus('MediaRecorder not supported in this browser.', true);
      return;
    }

    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      setStatus('Could not start recorder.', true);
      console.error('[Noteworthy clip] MediaRecorder failed:', err);
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
        while (chunks.length > BUFFER_SECONDS) {
          chunks.shift();
        }
        setStatus(`Buffering… ${chunks.length}s / ${BUFFER_SECONDS}s`);
      }
    };

    recorder.onerror = () => {
      setStatus('Recorder error - try refreshing.', true);
    };

    recorder.start(SLICE_MS);
    setStatus(`Recording buffer (${BUFFER_SECONDS}s)`);
  }

  function saveLast() {
    if (!chunks.length) {
      alert('Nothing buffered yet. Let the video play for a few seconds, then try again.');
      return;
    }

    const blob = new Blob(chunks, { type: chunks[0].type || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = `youtube-last-${BUFFER_SECONDS}s-${stamp}.webm`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved ~${Math.min(chunks.length, BUFFER_SECONDS)}s clip`);
  }

  function mountUi() {
    if (button) return;

    const wrap = document.createElement('div');
    wrap.id = 'noteworthy-yt-clip-wrap';
    wrap.style.cssText =
      'position:fixed;bottom:72px;right:20px;z-index:2147483646;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:system-ui,sans-serif;pointer-events:none;';

    button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Save last ${BUFFER_SECONDS}s`;
    button.title = 'Download the last 30 seconds from the player (browser capture)';
    button.style.cssText =
      'pointer-events:auto;padding:10px 14px;font-size:13px;font-weight:700;color:#fff;background:#b91c1c;border:none;border-radius:8px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);';
    button.onmouseenter = () => {
      button.style.background = '#991b1b';
    };
    button.onmouseleave = () => {
      button.style.background = '#b91c1c';
    };
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveLast();
    };

    statusEl = document.createElement('div');
    statusEl.style.cssText =
      'pointer-events:none;font-size:11px;color:#aaa;background:rgba(0,0,0,.75);padding:4px 8px;border-radius:4px;max-width:220px;text-align:right;';

    wrap.appendChild(statusEl);
    wrap.appendChild(button);
    document.body.appendChild(wrap);
    setStatus('Waiting for video…');
  }

  function attachToCurrentVideo() {
    const video = findVideo();
    if (!video) {
      setStatus('No video found on page');
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
    stopRecorder();
    chunks = [];
    setTimeout(attachToCurrentVideo, 1200);
  }

  mountUi();
  attachToCurrentVideo();
  setInterval(attachToCurrentVideo, 2000);

  window.addEventListener('yt-navigate-finish', onNavigate);
  window.addEventListener('yt-page-data-updated', onNavigate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      attachToCurrentVideo();
    }
  });
})();
