(function() {
  'use strict';

  const STORAGE_KEY = 'euro-sounds-muted';
  let ctx = null;
  let muted = localStorage.getItem(STORAGE_KEY) === 'true';
  let ambientStarted = false;
  let ambientGain = null;
  let masterGain = null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(fn) {
    if (muted || reducedMotion) return;
    try {
      const ac = getCtx();
      fn(ac, masterGain);
    } catch (e) {}
  }

  function click() {
    play((ac, dest) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.03, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.05);
    });
  }

  function pop() {
    play((ac, dest) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ac.currentTime + 0.03);
      osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.1);
    });
  }

  function whoosh() {
    play((ac, dest) => {
      const bufferSize = ac.sampleRate * 0.2;
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noise = ac.createBufferSource();
      noise.buffer = buffer;

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, ac.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2000, ac.currentTime + 0.1);
      filter.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.2);
      filter.Q.value = 2;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.025, ac.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(ac.currentTime);
      noise.stop(ac.currentTime + 0.2);
    });
  }

  function chimeUp() {
    play((ac, dest) => {
      const t = ac.currentTime;
      [520, 780].forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.03, t + i * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.15);
      });
    });
  }

  function chimeDown() {
    play((ac, dest) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.1);
      gain.gain.setValueAtTime(0.025, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.12);
    });
  }

  function startAmbient() {
    // Ambient removed by design -- sound effects only
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(STORAGE_KEY, muted);
    if (masterGain) {
      masterGain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    }
    updateMuteButton();
    if (!muted && !ambientStarted) startAmbient();
    return muted;
  }

  function updateMuteButton() {
    const btn = document.getElementById('euro-sound-toggle');
    if (btn) {
      btn.innerHTML = muted
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.08"/></svg>';
      btn.title = muted ? 'Unmute sounds' : 'Mute sounds';
    }
  }

  function wireEvents() {
    let firstInteraction = false;

    document.addEventListener('click', (e) => {
      if (!firstInteraction) {
        firstInteraction = true;
        getCtx();
        if (!muted && !reducedMotion) startAmbient();
      }

      const target = e.target.closest('.nb, .chip, .eac-chip, .eac-send, .eac-fab, .btn, .eac-nav-btn');
      if (target) click();

      const eraHdr = e.target.closest('.era-hdr');
      if (eraHdr) pop();

      if (e.target.closest('#euro-sound-toggle')) {
        toggleMute();
      }
    }, true);

    const detailPanel = document.getElementById('dp');
    if (detailPanel) {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'class') {
            const isOpen = detailPanel.classList.contains('open') || detailPanel.classList.contains('show');
            if (isOpen) chimeUp();
            else chimeDown();
            break;
          }
        }
      });
      observer.observe(detailPanel, { attributes: true });
    }

    const eraSections = document.querySelectorAll('.era-sec');
    if (eraSections.length > 0) {
      const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.2) {
            whoosh();
          }
        });
      }, { threshold: 0.2, rootMargin: '0px' });

      eraSections.forEach(sec => scrollObserver.observe(sec));
    }

    const modeCards = document.querySelectorAll('.mode-card, .mode-grid > div');
    if (modeCards.length > 0) {
      modeCards.forEach(card => {
        card.addEventListener('click', () => pop());
      });
    }

    updateMuteButton();
  }

  function init() {
    if (reducedMotion) return;
    wireEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  window.EuroSounds = { click, pop, whoosh, chimeUp, chimeDown, toggleMute, startAmbient };
})();
