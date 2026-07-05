/**
 * V2 - Minimal video toolbar (volume, rewind, speed, mute)
 * Used by feed cards and featured hero videos.
 */

import { fadeVideoVolume, cancelVideoFade } from './video-audio.js';

const SPEEDS = [0.75, 1, 1.25];
const SEEK_BACK_SEC = 10;
const VOLUME_FADE_MS = 200;

const STORAGE_VOL = 'nn-video-volume';
const STORAGE_SPEED = 'nn-video-speed';

export const MUTED_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

export const UNMUTED_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';

const REPLAY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';

export function getPreferredVolume() {
  try {
    const v = parseFloat(sessionStorage.getItem(STORAGE_VOL));
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch (_) { /* ignore */ }
  return 0.85;
}

export function getPreferredSpeed() {
  try {
    const s = parseFloat(sessionStorage.getItem(STORAGE_SPEED));
    if (SPEEDS.includes(s)) return s;
  } catch (_) { /* ignore */ }
  return 1;
}

export function savePreferredVolume(vol) {
  try {
    sessionStorage.setItem(STORAGE_VOL, String(Math.max(0, Math.min(1, vol))));
  } catch (_) { /* ignore */ }
}

export function savePreferredSpeed(speed) {
  try {
    sessionStorage.setItem(STORAGE_SPEED, String(speed));
  } catch (_) { /* ignore */ }
}

function formatSpeedLabel(rate) {
  if (rate === 1) return '1×';
  return `${rate}×`;
}

function getVideoWrap(video) {
  return video?.closest?.('.post-card-video, .featured-story-image.post-card-video') || video?.parentElement;
}

export function buildVideoToolbarHTML() {
  const vol = Math.round(getPreferredVolume() * 100);
  const speed = getPreferredSpeed();
  return `<div class="video-toolbar" role="toolbar" aria-label="Video controls">
    <button type="button" class="video-ctl video-ctl--seek" data-action="seek-back" aria-label="Back 10 seconds">${REPLAY_SVG}</button>
    <button type="button" class="video-ctl video-ctl--speed" data-action="speed" aria-label="Playback speed">
      <span class="video-ctl__speed-label">${formatSpeedLabel(speed)}</span>
    </button>
    <div class="video-ctl-vol">
      <span class="video-ctl-vol-icon" aria-hidden="true">${UNMUTED_SVG}</span>
      <input type="range" class="video-ctl-slider" min="0" max="100" value="${vol}" aria-label="Volume level">
    </div>
    <button type="button" class="video-ctl video-ctl--mute" data-action="mute" aria-label="Mute">${MUTED_SVG}</button>
  </div>`;
}

export function updateToolbarState(video) {
  const wrap = getVideoWrap(video);
  if (!wrap) return;
  const toolbar = wrap.querySelector('.video-toolbar');
  if (!toolbar) return;

  const silent = video.dataset.userMuted === 'true' || video.muted || video.volume <= 0.01;
  const muteBtn = toolbar.querySelector('[data-action="mute"]');
  const volIcon = toolbar.querySelector('.video-ctl-vol-icon');
  const slider = toolbar.querySelector('.video-ctl-slider');
  const speedLabel = toolbar.querySelector('.video-ctl__speed-label');

  if (muteBtn) {
    muteBtn.innerHTML = silent ? MUTED_SVG : UNMUTED_SVG;
    muteBtn.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
  }
  if (volIcon) {
    volIcon.innerHTML = silent ? MUTED_SVG : UNMUTED_SVG;
  }
  if (slider && silent) {
    slider.value = '0';
  } else if (slider && !silent) {
    slider.value = String(Math.round((video.volume > 0.01 ? video.volume : getPreferredVolume()) * 100));
  }
  if (speedLabel && video.playbackRate) {
    const rate = SPEEDS.find((s) => Math.abs(s - video.playbackRate) < 0.01) ?? video.playbackRate;
    speedLabel.textContent = formatSpeedLabel(rate);
  }
}

function stopCardNav(e) {
  e.preventDefault();
  e.stopPropagation();
}

function setupMobilePin(wrap, video) {
  const mq = window.matchMedia('(max-width: 767px)');
  if (!mq.matches || wrap.dataset.mobilePinBound === 'true') return;
  wrap.dataset.mobilePinBound = 'true';

  video.addEventListener('click', (e) => {
    if (!mq.matches) return;
    if (e.target.closest('.video-toolbar')) return;
    wrap.classList.add('is-controls-open');
  });

  document.addEventListener(
    'click',
    (e) => {
      if (!mq.matches || !wrap.classList.contains('is-controls-open')) return;
      if (!wrap.contains(e.target)) wrap.classList.remove('is-controls-open');
    },
    true
  );
}

/**
 * @param {HTMLVideoElement} video
 * @param {{ isHero?: boolean, onMuteClick?: (e: Event, video: HTMLVideoElement) => void }} options
 */
export function initVideoToolbar(video, options = {}) {
  const wrap = getVideoWrap(video);
  if (!wrap) return;

  if (!wrap.querySelector('.video-toolbar')) {
    wrap.insertAdjacentHTML('beforeend', buildVideoToolbarHTML());
  }

  if (video.dataset.toolbarBound === 'true') {
    updateToolbarState(video);
    return;
  }
  video.dataset.toolbarBound = 'true';

  const toolbar = wrap.querySelector('.video-toolbar');
  const speedBtn = toolbar.querySelector('[data-action="speed"]');
  const speedLabel = toolbar.querySelector('.video-ctl__speed-label');
  const slider = toolbar.querySelector('.video-ctl-slider');
  const muteBtn = toolbar.querySelector('[data-action="mute"]');
  const seekBtn = toolbar.querySelector('[data-action="seek-back"]');

  let speedIdx = SPEEDS.indexOf(getPreferredSpeed());
  if (speedIdx < 0) speedIdx = 1;
  video.playbackRate = SPEEDS[speedIdx];
  if (speedLabel) speedLabel.textContent = formatSpeedLabel(SPEEDS[speedIdx]);

  const applyVolume = (targetVol, animate = true) => {
    const vol = Math.max(0, Math.min(1, targetVol));
    if (vol > 0) {
      video.dataset.userMuted = 'false';
      if (animate) {
        fadeVideoVolume(video, vol, VOLUME_FADE_MS, () => updateToolbarState(video));
      } else {
        cancelVideoFade(video);
        video.volume = vol;
        video.muted = false;
        updateToolbarState(video);
      }
      savePreferredVolume(vol);
    } else {
      video.dataset.userMuted = 'true';
      if (animate) {
        fadeVideoVolume(video, 0, VOLUME_FADE_MS, () => {
          video.muted = true;
          updateToolbarState(video);
        });
      } else {
        video.volume = 0;
        video.muted = true;
        updateToolbarState(video);
      }
    }
  };

  toolbar.addEventListener('click', stopCardNav);
  toolbar.addEventListener('mousedown', stopCardNav);
  toolbar.addEventListener('touchstart', stopCardNav, { passive: true });

  if (seekBtn) {
    seekBtn.addEventListener('click', (e) => {
      stopCardNav(e);
      video.currentTime = Math.max(0, video.currentTime - SEEK_BACK_SEC);
      seekBtn.classList.add('is-pulse');
      setTimeout(() => seekBtn.classList.remove('is-pulse'), 220);
    });
  }

  if (speedBtn && speedLabel) {
    speedBtn.addEventListener('click', (e) => {
      stopCardNav(e);
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      const rate = SPEEDS[speedIdx];
      video.playbackRate = rate;
      speedLabel.textContent = formatSpeedLabel(rate);
      speedBtn.setAttribute('aria-label', `Playback speed ${formatSpeedLabel(rate)}`);
      savePreferredSpeed(rate);
      speedBtn.classList.add('is-pulse');
      setTimeout(() => speedBtn.classList.remove('is-pulse'), 220);
    });
    speedBtn.setAttribute('aria-label', `Playback speed ${formatSpeedLabel(SPEEDS[speedIdx])}`);
  }

  if (slider) {
    slider.addEventListener('input', (e) => {
      stopCardNav(e);
      const vol = Number(slider.value) / 100;
      cancelVideoFade(video);
      video.volume = vol;
      if (vol > 0) {
        video.muted = false;
        video.dataset.userMuted = 'false';
      }
      updateToolbarState(video);
    });

    slider.addEventListener('change', (e) => {
      stopCardNav(e);
      const vol = Number(slider.value) / 100;
      applyVolume(vol, true);
    });

    slider.addEventListener('mousedown', stopCardNav);
    slider.addEventListener('touchstart', stopCardNav, { passive: true });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      stopCardNav(e);
      if (typeof options.onMuteClick === 'function') {
        options.onMuteClick(e, video);
      } else {
        const willMute = video.dataset.userMuted !== 'true';
        video.dataset.userMuted = willMute ? 'true' : 'false';
        if (willMute) {
          applyVolume(0, true);
        } else {
          applyVolume(getPreferredVolume(), true);
        }
      }
    });
  }

  setupMobilePin(wrap, video);
  updateToolbarState(video);
}
