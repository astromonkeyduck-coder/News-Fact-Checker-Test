/**
 * Noteworthy News V2 - Ambient Audio + CRT Waveform Visualizer
 *
 * Plays NewsfeedGlow.mp3 on loop, with a header mute/unmute toggle.
 * Draws a real-time frequency-bar visualizer on a fixed canvas at the
 * bottom of the viewport, styled with accent-blue glow.
 *
 * Audio is opt-in (muted by default). State persisted in localStorage.
 * AudioContext is only created after the first user gesture.
 */

import { UISounds } from './ui-sounds.js';

const STORAGE_KEY = 'nw-ambient-audio';
const SRC = '/NewsfeedGlow.mp3';
const FFT_SIZE = 128;
const BAR_GAP = 2;
const CANVAS_H = 48;
const IDLE_BAR_H = 4;

let audioEl = null;
let ctx = null;
let analyser = null;
let gainNode = null;
let source = null;
let canvas = null;
let cCtx = null;
let freqData = null;
let playing = false;
let initialized = false;
let rafId = null;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function savedState() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function saveState(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch {}
}

function createAudio() {
  audioEl = document.createElement('audio');
  audioEl.src = SRC;
  audioEl.loop = true;
  audioEl.preload = 'none';
  audioEl.crossOrigin = 'anonymous';
}

function ensureContext() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  source = ctx.createMediaElementSource(audioEl);
  analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.8;
  gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  source.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(ctx.destination);
  freqData = new Uint8Array(analyser.frequencyBinCount);
}

function updateIcon() {
  const btn = document.getElementById('audioToggle');
  if (!btn) return;
  btn.classList.toggle('is-playing', playing);
  btn.setAttribute('aria-label', playing ? 'Mute background music' : 'Play background music');
  btn.title = playing ? 'Mute' : 'Play music';
}

async function startPlayback() {
  ensureContext();
  if (ctx.state === 'suspended') await ctx.resume();
  gainNode.gain.setTargetAtTime(1, ctx.currentTime, 0.08);
  try { await audioEl.play(); } catch {}
  playing = true;
  saveState(true);
  updateIcon();
  startVisualizer();
}

function stopPlayback() {
  if (gainNode && ctx) gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  playing = false;
  saveState(false);
  updateIcon();
}

export function toggleAudio() {
  if (playing) {
    UISounds.toggle(false);
    stopPlayback();
  } else {
    UISounds.toggle(true);
    startPlayback();
  }
}

// ── Visualizer ─────────────────────────────────────

function sizeCanvas() {
  if (!canvas) return;
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = CANVAS_H * (window.devicePixelRatio || 1);
}

let idlePhase = 0;

function draw() {
  rafId = requestAnimationFrame(draw);
  if (!cCtx || !canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  cCtx.clearRect(0, 0, w, h);

  const bins = analyser ? analyser.frequencyBinCount : 64;
  const barW = Math.max(1, (w / bins) - BAR_GAP * dpr);

  if (analyser && playing) {
    analyser.getByteFrequencyData(freqData);
  }

  const grad = cCtx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#3B8BF2');
  grad.addColorStop(1, '#7DD3FC');

  cCtx.shadowColor = '#3B8BF2';
  cCtx.shadowBlur = playing ? 8 * dpr : 2 * dpr;
  cCtx.fillStyle = grad;
  cCtx.globalAlpha = playing ? 0.85 : 0.3;

  idlePhase += 0.02;

  for (let i = 0; i < bins; i++) {
    let barH;
    if (playing && freqData) {
      barH = (freqData[i] / 255) * h;
      barH += (Math.random() - 0.5) * 4 * dpr;
      barH = Math.max(2 * dpr, barH);
    } else {
      barH = (IDLE_BAR_H + Math.sin(idlePhase + i * 0.3) * 2) * dpr;
    }
    const x = i * (barW + BAR_GAP * dpr);
    const radius = Math.min(barW / 2, 3 * dpr);
    cCtx.beginPath();
    cCtx.moveTo(x + radius, h);
    cCtx.lineTo(x + barW - radius, h);
    cCtx.lineTo(x + barW - radius, h - barH + radius);
    cCtx.arcTo(x + barW - radius, h - barH, x + barW / 2, h - barH, radius);
    cCtx.arcTo(x, h - barH, x, h - barH + radius, radius);
    cCtx.lineTo(x, h);
    cCtx.closePath();
    cCtx.fill();
  }

  cCtx.shadowBlur = 0;
  cCtx.globalAlpha = 1;
}

function startVisualizer() {
  if (rafId != null) return;
  draw();
}

// ── Init ───────────────────────────────────────────

export function initAmbientAudio() {
  createAudio();

  canvas = document.getElementById('audio-visualizer');
  if (canvas && !prefersReducedMotion) {
    cCtx = canvas.getContext('2d');
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    startVisualizer();
  }

  const btn = document.getElementById('audioToggle');
  if (btn) {
    btn.addEventListener('click', toggleAudio);
  }

  updateIcon();

  const autoStart = savedState() === 'on';
  if (autoStart) {
    const kick = () => {
      startPlayback();
      document.removeEventListener('click', kick);
      document.removeEventListener('keydown', kick);
      document.removeEventListener('scroll', kick);
    };
    document.addEventListener('click', kick, { once: false });
    document.addEventListener('keydown', kick, { once: false });
    document.addEventListener('scroll', kick, { once: false, passive: true });
  }
}
