/**
 * Noteworthy News V2 - Synthesized UI sound effects (Web Audio API)
 *
 * Short, quiet tones - no external assets. Respects prefers-reduced-motion
 * and localStorage key `nw-ui-sounds` === 'off' to disable.
 */

const OPT_OUT_KEY = 'nw-ui-sounds';

let audioCtx = null;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function isOptedOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'off';
  } catch {
    return false;
  }
}

function gated() {
  return prefersReducedMotion() || isOptedOut();
}

async function getCtx() {
  if (gated() || typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Fire-and-forget async playback */
function play(fn) {
  Promise.resolve()
    .then(fn)
    .catch(() => {});
}

function startScheduledTone(ctx, osc, gain, startT, stopT) {
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startT);
  osc.stop(stopT);
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      /* ignore */
    }
  };
}

export const UISounds = {
  /** ~30ms soft click */
  tap() {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.032);
      startScheduledTone(ctx, osc, g, t0, t0 + 0.04);
    });
  },

  /** Two-note ascending chime - feed loaded, newsletter success */
  success() {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const C5 = 523.25;
      const E5 = 659.25;

      const playNote = (freq, start, end) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.1, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, end);
        startScheduledTone(ctx, osc, g, start, end + 0.02);
      };

      playNote(C5, t0, t0 + 0.09);
      playNote(E5, t0 + 0.1, t0 + 0.2);
    });
  },

  /** Descending tones - errors */
  error() {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const E4 = 329.63;
      const C4 = 261.63;

      const playNote = (freq, start, end) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.08, start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, end);
        startScheduledTone(ctx, osc, g, start, end + 0.02);
      };

      playNote(E4, t0, t0 + 0.11);
      playNote(C4, t0 + 0.12, t0 + 0.25);
    });
  },

  /** Attention tone - alert banner appears */
  notify() {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.1, t0 + 0.02);
      g.gain.setValueAtTime(0.1, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
      startScheduledTone(ctx, osc, g, t0, t0 + 0.17);
    });
  },

  /** Rising sweep - monitor ready / manual refresh complete */
  sweep() {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const dur = 0.18;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t0);
      osc.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.02);
      startScheduledTone(ctx, osc, g, t0, t0 + dur + 0.03);
    });
  },

  /** Mechanical switch click with a low thump - lock-screen flashlight */
  flashlight(isOn) {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;

      // Noise transient through a bandpass: the crisp "click"
      const clickDur = 0.05;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * clickDur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = isOn ? 2600 : 1700;
      bp.Q.value = 1.6;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(isOn ? 0.4 : 0.32, t0);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + clickDur);
      src.onended = () => {
        try {
          src.disconnect();
          bp.disconnect();
          ng.disconnect();
        } catch {
          /* ignore */
        }
      };

      // Low body "thump" - drops in pitch when switching off
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isOn ? 340 : 240, t0);
      osc.frequency.exponentialRampToValueAtTime(isOn ? 190 : 130, t0 + 0.045);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      startScheduledTone(ctx, osc, g, t0, t0 + 0.08);
    });
  },

  /** Pitched click - ambient on/off */
  toggle(isOn) {
    play(async () => {
      const ctx = await getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const freq = isOn ? 1000 : 600;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.11, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.042);
      startScheduledTone(ctx, osc, g, t0, t0 + 0.05);
    });
  },
};
