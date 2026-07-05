/**
 * Noteworthy News V4 - Premium UI sound effects engine
 *
 * Lightweight Web Audio synthesis. No external assets.
 * Global API: window.NoteworthySFX
 */

const STORAGE_KEY = 'nw-sfx-enabled';
const LEGACY_OPT_OUT = 'nw-ui-sounds';

const THROTTLE_MS = {
  'subtle-hover': 140,
  'nav-select': 70,
  'primary-action': 60,
  'secondary-action': 60,
  'panel-open': 120,
  'panel-close': 120,
  'story-open': 90,
  'follow-live': 100,
  success: 400,
  error: 400,
  'media-play': 80,
  'media-pause': 80,
  notify: 300,
  sweep: 300,
  flashlight: 120,
  toggle: 100,
};

const VALID_SOUNDS = new Set(Object.keys(THROTTLE_MS));

let audioCtx = null;
let masterGain = null;
let compressor = null;
let unlocked = false;
let enabled = true;
let volume = 0.52;
let voiceModeActive = false;
let delegationBound = false;
let videoWatchBound = false;
let videoAudible = false;

const lastPlayed = new Map();

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function allowsHoverSound() {
  if (prefersReducedMotion()) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function readEnabled() {
  try {
    if (localStorage.getItem(LEGACY_OPT_OUT) === 'off') return false;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'off') return false;
    if (v === 'on') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function persistEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    if (!on) localStorage.setItem(LEGACY_OPT_OUT, 'off');
    else localStorage.removeItem(LEGACY_OPT_OUT);
  } catch {
    /* ignore */
  }
}

function effectiveVolume() {
  if (!enabled || voiceModeActive) return 0;
  if (videoAudible) return volume * 0.22;
  return volume;
}

async function ensureContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  if (!audioCtx) {
    audioCtx = new AC();
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 8;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.08;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      return null;
    }
  }

  masterGain.gain.setTargetAtTime(effectiveVolume(), audioCtx.currentTime, 0.02);
  return audioCtx;
}

function unlockFromGesture() {
  if (unlocked) return;
  unlocked = true;
  ensureContext().catch(() => {});
}

function scheduleCleanup(nodes, ms) {
  window.setTimeout(() => {
    nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    });
  }, ms);
}

function noiseBurst(ctx, t0, dur, out, opts = {}) {
  const { freq = 2200, q = 1.2, peak = 0.08, decay = 0.04 } = opts;
  const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur);
  return [src, bp, g];
}

function tone(ctx, t0, out, opts = {}) {
  const {
    type = 'sine',
    f0,
    f1,
    attack = 0.004,
    hold = 0,
    decay = 0.06,
    peak = 0.09,
  } = opts;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t0 + attack + hold + decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + decay);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + attack + hold + decay + 0.02);
  return [osc, g];
}

function render(name, ctx, t0, out, opts = {}) {
  const nodes = [];

  switch (name) {
    case 'subtle-hover':
      nodes.push(...noiseBurst(ctx, t0, 0.028, out, { freq: 2800, peak: 0.018, decay: 0.022 }));
      nodes.push(...tone(ctx, t0, out, { f0: 520, f1: 680, peak: 0.012, decay: 0.035 }));
      break;
    case 'nav-select':
      nodes.push(...noiseBurst(ctx, t0, 0.032, out, { freq: 2400, peak: 0.055, decay: 0.028 }));
      nodes.push(...tone(ctx, t0, out, { type: 'triangle', f0: 920, peak: 0.045, decay: 0.04 }));
      break;
    case 'primary-action':
      nodes.push(...noiseBurst(ctx, t0, 0.038, out, { freq: 1900, peak: 0.07, decay: 0.032 }));
      nodes.push(...tone(ctx, t0, out, { f0: 200, f1: 120, peak: 0.055, decay: 0.05 }));
      nodes.push(...tone(ctx, t0 + 0.006, out, { type: 'triangle', f0: 1180, f1: 980, peak: 0.05, decay: 0.045 }));
      break;
    case 'secondary-action':
      nodes.push(...noiseBurst(ctx, t0, 0.028, out, { freq: 2600, peak: 0.04, decay: 0.022 }));
      nodes.push(...tone(ctx, t0, out, { type: 'triangle', f0: 1380, peak: 0.032, decay: 0.035 }));
      break;
    case 'panel-open':
      nodes.push(...noiseBurst(ctx, t0, 0.06, out, { freq: 900, q: 0.7, peak: 0.035, decay: 0.07 }));
      nodes.push(...tone(ctx, t0, out, { f0: 180, f1: 320, peak: 0.04, decay: 0.09, hold: 0.01 }));
      nodes.push(...tone(ctx, t0 + 0.02, out, { f0: 440, f1: 620, peak: 0.025, decay: 0.07 }));
      break;
    case 'panel-close':
      nodes.push(...tone(ctx, t0, out, { f0: 520, f1: 360, peak: 0.028, decay: 0.07 }));
      nodes.push(...noiseBurst(ctx, t0 + 0.015, 0.04, out, { freq: 1200, q: 0.9, peak: 0.022, decay: 0.05 }));
      break;
    case 'story-open':
      nodes.push(...noiseBurst(ctx, t0, 0.035, out, { freq: 1700, peak: 0.05, decay: 0.03 }));
      nodes.push(...tone(ctx, t0 + 0.012, out, { f0: 392, peak: 0.04, decay: 0.07 }));
      nodes.push(...tone(ctx, t0 + 0.055, out, { f0: 523.25, peak: 0.035, decay: 0.08 }));
      break;
    case 'follow-live':
      nodes.push(...tone(ctx, t0, out, { type: 'triangle', f0: 660, peak: 0.04, decay: 0.045 }));
      nodes.push(...tone(ctx, t0 + 0.078, out, { type: 'triangle', f0: 880, peak: 0.038, decay: 0.055 }));
      break;
    case 'success':
      nodes.push(...tone(ctx, t0, out, { f0: 523.25, peak: 0.055, decay: 0.09 }));
      nodes.push(...tone(ctx, t0 + 0.1, out, { f0: 659.25, peak: 0.05, decay: 0.11 }));
      break;
    case 'error':
      nodes.push(...tone(ctx, t0, out, { type: 'triangle', f0: 330, f1: 280, peak: 0.04, decay: 0.1 }));
      nodes.push(...tone(ctx, t0 + 0.09, out, { type: 'triangle', f0: 262, f1: 220, peak: 0.032, decay: 0.11 }));
      break;
    case 'media-play':
      nodes.push(...noiseBurst(ctx, t0, 0.02, out, { freq: 3000, peak: 0.025, decay: 0.018 }));
      nodes.push(...tone(ctx, t0, out, { f0: 880, peak: 0.02, decay: 0.025 }));
      break;
    case 'media-pause':
      nodes.push(...tone(ctx, t0, out, { f0: 720, f1: 580, peak: 0.018, decay: 0.03 }));
      break;
    case 'notify':
      nodes.push(...tone(ctx, t0, out, { f0: 880, peak: 0.045, decay: 0.08, hold: 0.04 }));
      break;
    case 'sweep': {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t0);
      osc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.16);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.045, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.2);
      nodes.push(osc, g);
      break;
    }
    case 'flashlight': {
      const isOn = !!opts.value;
      nodes.push(...noiseBurst(ctx, t0, 0.048, out, { freq: isOn ? 2600 : 1700, peak: isOn ? 0.055 : 0.042, decay: 0.045 }));
      nodes.push(...tone(ctx, t0, out, { f0: isOn ? 340 : 240, f1: isOn ? 190 : 130, peak: 0.05, decay: 0.065 }));
      break;
    }
    case 'toggle': {
      const freq = opts.value ? 980 : 620;
      nodes.push(...tone(ctx, t0, out, { f0: freq, peak: 0.04, decay: 0.042 }));
      break;
    }
    default:
      return null;
  }

  scheduleCleanup(nodes, 280);
  return nodes;
}

function shouldThrottle(name) {
  const min = THROTTLE_MS[name] || 60;
  const now = performance.now();
  const last = lastPlayed.get(name) || 0;
  if (now - last < min) return true;
  lastPlayed.set(name, now);
  return false;
}

async function play(name, opts = {}) {
  if (!enabled && !opts.forceMeta) return false;
  if (!VALID_SOUNDS.has(name)) return false;
  if (shouldThrottle(name)) return false;

  const ctx = await ensureContext();
  if (!ctx || !masterGain) return false;

  masterGain.gain.setTargetAtTime(effectiveVolume(), ctx.currentTime, 0.015);

  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(masterGain);

  const nodes = render(name, ctx, ctx.currentTime, bus, opts);
  if (!nodes) {
    try {
      bus.disconnect();
    } catch {
      /* ignore */
    }
    return false;
  }

  window.setTimeout(() => {
    try {
      bus.disconnect();
    } catch {
      /* ignore */
    }
  }, 300);

  return true;
}

function enable() {
  const wasOff = !enabled;
  enabled = true;
  persistEnabled(true);
  updateToggleUI();
  if (wasOff) play('toggle', { value: true, forceMeta: true });
}

function disable() {
  const wasOn = enabled;
  enabled = false;
  persistEnabled(false);
  updateToggleUI();
  if (wasOn) play('toggle', { value: false, forceMeta: true });
}

function toggle() {
  if (enabled) disable();
  else enable();
}

function setVolume(v) {
  volume = Math.max(0, Math.min(1, Number(v) || 0));
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(effectiveVolume(), audioCtx.currentTime, 0.02);
  }
}

function isEnabled() {
  return enabled;
}

function setVoiceModeActive(active) {
  voiceModeActive = !!active;
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(effectiveVolume(), audioCtx.currentTime, 0.03);
  }
}

function isVideoAudible(video) {
  return !!video && !video.paused && !video.muted && video.volume > 0.02;
}

function refreshVideoDuck() {
  const videos = document.querySelectorAll('video');
  let audible = false;
  videos.forEach((v) => {
    if (isVideoAudible(v)) audible = true;
  });
  videoAudible = audible;
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(effectiveVolume(), audioCtx.currentTime, 0.04);
  }
}

function bindVideoWatch() {
  if (videoWatchBound) return;
  videoWatchBound = true;
  const handler = () => refreshVideoDuck();
  document.addEventListener('play', handler, true);
  document.addEventListener('pause', handler, true);
  document.addEventListener('volumechange', handler, true);
  document.addEventListener('loadeddata', handler, true);
}

function resolveClickSound(el) {
  if (!el || el.closest('[data-sfx="off"]')) return null;

  const explicit = el.closest('[data-sfx]');
  if (explicit) {
    const name = explicit.getAttribute('data-sfx');
    if (name && name !== 'off' && VALID_SOUNDS.has(name)) return name;
  }

  if (el.closest('.filter-chip, .dev-arrow, .arch-chip, .arch-more, #load-more, [data-sfx-map="nav-select"]')) {
    return 'nav-select';
  }
  if (el.closest('[data-live-cta], .nav-live-chip')) {
    return 'follow-live';
  }
  if (el.closest('.hero-story-link, .lead-link, .dev-card, .wire-item a, .next-card-link, [data-sfx-map="story-open"]')) {
    return 'story-open';
  }
  if (el.closest('.btn-primary, .utility-btn--primary, [data-sfx-map="primary-action"]')) {
    return 'primary-action';
  }
  if (el.closest('.btn-outline, .btn-ghost, .btn-secondary, .utility-btn--secondary, .utility-btn:not(.utility-btn--primary), [data-sfx-map="secondary-action"]')) {
    return 'secondary-action';
  }

  return null;
}

function resolveHoverSound(el) {
  if (!allowsHoverSound()) return null;
  if (!el || el.closest('[data-sfx-hover="off"]')) return null;

  const explicit = el.closest('[data-sfx-hover]');
  if (explicit) {
    const name = explicit.getAttribute('data-sfx-hover');
    if (name && name !== 'off' && VALID_SOUNDS.has(name)) return name;
  }

  if (el.closest('#hero-card, .hero-story-link, .lead-card, .hero-cta .btn-primary')) {
    return 'subtle-hover';
  }

  return null;
}

function bindDelegation() {
  if (delegationBound) return;
  delegationBound = true;

  document.addEventListener(
    'click',
    (e) => {
      unlockFromGesture();
      if (!enabled) return;
      if (e.target.closest('#audioToggle, [data-sfx-ignore]')) return;

      const sound = resolveClickSound(e.target);
      if (sound) play(sound);
    },
    true
  );

  document.addEventListener(
    'pointerenter',
    (e) => {
      if (!enabled || !allowsHoverSound()) return;
      const el = e.target instanceof Element ? e.target : null;
      const sound = resolveHoverSound(el);
      if (sound) play(sound);
    },
    true
  );
}

function updateToggleUI() {
  const btn = document.getElementById('audioToggle');
  if (!btn) return;
  btn.classList.toggle('sfx-on', enabled);
  btn.classList.toggle('is-playing', enabled);
  btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  btn.setAttribute(
    'aria-label',
    enabled ? 'Sound effects on. Toggle site sound effects' : 'Sound effects off. Toggle site sound effects'
  );
  btn.title = enabled ? 'Sound effects on' : 'Sound effects off';
}

function bindToggle() {
  const btn = document.getElementById('audioToggle');
  if (!btn || btn.dataset.sfxBound === 'true') return;
  btn.dataset.sfxBound = 'true';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    unlockFromGesture();
    toggle();
  });

  updateToggleUI();
}

function bindUnlockGestures() {
  const once = () => {
    unlockFromGesture();
    document.removeEventListener('pointerdown', once, true);
    document.removeEventListener('keydown', once, true);
  };
  document.addEventListener('pointerdown', once, true);
  document.addEventListener('keydown', once, true);
}

export function initSFX() {
  enabled = readEnabled();
  bindUnlockGestures();
  bindDelegation();
  bindVideoWatch();
  bindToggle();
  refreshVideoDuck();
}

export const NoteworthySFX = {
  play,
  enable,
  disable,
  toggle,
  setVolume,
  isEnabled,
  setVoiceModeActive,
  refreshVideoDuck,
  init: initSFX,
};

if (typeof window !== 'undefined') {
  window.NoteworthySFX = NoteworthySFX;
}
