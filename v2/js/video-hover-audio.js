/**
 * Hover-to-preview audio for feed and story videos.
 *
 * Desktop pointer only. Fades in on hover, fades out on leave unless the
 * reader explicitly unmuted via native controls. Crossfades when moving
 * between videos. Videos keep playing muted on loop; hover never pauses.
 *
 * Requires one click/keypress on the page first (browser autoplay policy).
 */

import {
  fadeVideoIn,
  fadeVideoOut,
  cancelVideoFade,
  ensureVideoPlaying,
  ensureVideoSrc,
  isVideoAudible,
  HOVER_FADE_IN_MS,
  HOVER_FADE_OUT_MS,
} from './video-audio.js';

const HOVER_TARGET_VOLUME = 0.78;
const CROSSFADE_MS = HOVER_FADE_IN_MS;

function hoverCapable() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const programmatic = new WeakSet();
const boundWraps = new WeakSet();
const volumeBound = new WeakSet();

let pointerX = 0;
let pointerY = 0;
let activeHoverVideo = null;
let pageAudioUnlocked = false;

function notifyDuck() {
  try {
    window.NoteworthySFX?.refreshVideoDuck?.();
  } catch {
    /* optional */
  }
}

function unlockPageAudio() {
  pageAudioUnlocked = true;
}

function wrapForVideo(video) {
  return video?.closest?.('.pm-media') || video?.parentElement;
}

function videoAtPointer() {
  const el = document.elementFromPoint(pointerX, pointerY);
  const wrap = el?.closest?.('.pm-media');
  return wrap?.querySelector?.('video') || null;
}

function isUserUnlocked(video) {
  return video?.dataset?.userAudio === 'true';
}

function markProgrammatic(video, ms) {
  if (!video) return;
  programmatic.add(video);
  window.setTimeout(() => programmatic.delete(video), ms + 60);
}

function fadeInHover(video) {
  if (!video || !pageAudioUnlocked) return;

  if (isUserUnlocked(video)) {
    ensureVideoSrc(video);
    ensureVideoPlaying(video);
    return;
  }

  ensureVideoSrc(video);
  ensureVideoPlaying(video);

  const ms = prefersReducedMotion() ? 0 : CROSSFADE_MS;
  markProgrammatic(video, ms);
  fadeVideoIn(video, {
    duration: ms,
    targetVolume: HOVER_TARGET_VOLUME,
    onComplete: notifyDuck,
  });
}

function fadeOutHover(video, { duration = HOVER_FADE_OUT_MS, force = false } = {}) {
  if (!video || (!force && isUserUnlocked(video))) return;
  const ms = prefersReducedMotion() ? 0 : duration;
  markProgrammatic(video, ms);
  fadeVideoOut(video, {
    duration: ms,
    pause: false,
    resetMuted: true,
    onComplete: notifyDuck,
  });
}

function activateHover(video) {
  if (!video || activeHoverVideo === video) return;

  const prev = activeHoverVideo;
  activeHoverVideo = video;

  if (prev && prev !== video) {
    fadeOutHover(prev, { duration: CROSSFADE_MS, force: true });
  }

  fadeInHover(video);
}

function deactivateHover(video) {
  if (!video) return;

  window.requestAnimationFrame(() => {
    const next = videoAtPointer();
    if (next && next !== video) return;

    if (activeHoverVideo === video) {
      activeHoverVideo = null;
    }

    fadeOutHover(video, { force: false });
  });
}

function onVolumeChange(video) {
  if (programmatic.has(video)) return;

  if (isVideoAudible(video)) {
    video.dataset.userAudio = 'true';
  } else if (video.muted || video.volume <= 0.01) {
    delete video.dataset.userAudio;
    cancelVideoFade(video);
  }

  notifyDuck();
}

function bindVolumeListener(video) {
  if (volumeBound.has(video)) return;
  volumeBound.add(video);
  video.addEventListener('volumechange', () => onVolumeChange(video));
}

function bindWrapHover(wrap) {
  if (boundWraps.has(wrap)) return;
  boundWraps.add(wrap);

  const onEnter = () => {
    const v = wrap.querySelector('video');
    if (v) activateHover(v);
  };

  const onLeave = () => {
    const v = wrap.querySelector('video');
    if (v) deactivateHover(v);
  };

  wrap.addEventListener('pointerenter', onEnter);
  wrap.addEventListener('pointerleave', onLeave);
  wrap.addEventListener('mouseenter', onEnter);
  wrap.addEventListener('mouseleave', onLeave);
}

export function bindVideoHoverAudio(video) {
  if (!hoverCapable() || !video) return;
  if (video.dataset.hoverAudioBound === 'true') return;

  video.dataset.hoverAudioBound = 'true';
  bindVolumeListener(video);

  const wrap = wrapForVideo(video);
  if (wrap) bindWrapHover(wrap);
}

/** Upgrade every video already on the page (e.g. after a hot reload). */
export function refreshVideoHoverAudio(root = document) {
  if (!hoverCapable()) return;
  root.querySelectorAll('.pm-media video').forEach((video) => {
    bindVideoHoverAudio(video);
  });
}

if (typeof document !== 'undefined' && hoverCapable()) {
  document.addEventListener('pointerdown', unlockPageAudio, { capture: true, passive: true });
  document.addEventListener('keydown', unlockPageAudio, { capture: true, passive: true });

  document.addEventListener(
    'pointermove',
    (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    },
    { passive: true, capture: true }
  );
}

if (typeof window !== 'undefined') {
  window.VideoHoverAudio = { refresh: refreshVideoHoverAudio, unlock: unlockPageAudio };
}
