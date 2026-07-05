/**
 * V2 - HTML5 video volume fade utilities
 *
 * Smooth volume ramps for feed/hero videos. Uses `video.volume` for fades;
 * `muted` is only used as an autoplay gate and when fully silent.
 */

const states = new WeakMap();

const DEFAULT_FADE_IN_MS = 350;
const DEFAULT_FADE_OUT_MS = 250;
const HERO_FADE_IN_MS = 200;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function easeInOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) return 4 * t * t * t;
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getState(video) {
  let state = states.get(video);
  if (!state) {
    state = { rafId: null };
    states.set(video, state);
  }
  return state;
}

export function cancelVideoFade(video) {
  if (!video) return;
  const state = states.get(video);
  if (state?.rafId != null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

export function fadeVideoVolume(video, target, durationMs, onComplete) {
  cancelVideoFade(video);
  if (!video) {
    onComplete?.();
    return Promise.resolve();
  }

  const targetVol = Math.max(0, Math.min(1, target));

  if (prefersReducedMotion() || durationMs <= 0) {
    video.volume = targetVol;
    if (targetVol > 0) video.muted = false;
    else video.muted = true;
    onComplete?.();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startVol = video.volume;
    const start = performance.now();
    const state = getState(video);

    const tick = (now) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = easeInOutCubic(progress);
      video.volume = startVol + (targetVol - startVol) * eased;
      if (targetVol > 0 && video.volume > 0.001) video.muted = false;
      if (targetVol <= 0 && progress >= 1) video.muted = true;

      if (progress >= 1) {
        state.rafId = null;
        onComplete?.();
        resolve();
        return;
      }
      state.rafId = requestAnimationFrame(tick);
    };

    state.rafId = requestAnimationFrame(tick);
  });
}

export function fadeVideoIn(video, opts = {}) {
  if (!video) return Promise.resolve();
  const duration = opts.duration ?? DEFAULT_FADE_IN_MS;
  const targetVolume = opts.targetVolume ?? 1;
  const onComplete = opts.onComplete;

  if (video.volume <= 0) video.volume = 0;
  video.muted = false;

  return fadeVideoVolume(video, targetVolume, duration, onComplete);
}

export function fadeVideoOut(video, opts = {}) {
  if (!video) return Promise.resolve();
  const duration = opts.duration ?? DEFAULT_FADE_OUT_MS;
  const pause = opts.pause !== false;
  const resetMuted = opts.resetMuted !== false;
  const onComplete = opts.onComplete;

  return fadeVideoVolume(video, 0, duration, () => {
    if (resetMuted) video.muted = true;
    if (pause && !video.paused) video.pause();
    onComplete?.();
  });
}

export function isVideoAudible(video) {
  return !!video && !video.muted && video.volume > 0.01 && !video.paused;
}

export function ensureVideoSrc(video) {
  if (!video.src && video.dataset.src) {
    video.src = video.dataset.src;
    video.load();
  }
}

/** Start playback; falls back to muted autoplay if the browser blocks sound. */
export function ensureVideoPlaying(video) {
  ensureVideoSrc(video);
  const attempt = video.play();
  if (!attempt) return Promise.resolve();
  return attempt.catch(() => {
    video.muted = true;
    video.volume = 0;
    return video.play().catch(() => {});
  });
}

export { DEFAULT_FADE_IN_MS, DEFAULT_FADE_OUT_MS, HERO_FADE_IN_MS };
