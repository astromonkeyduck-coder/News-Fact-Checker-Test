/* ═══════════════════════════════════════════════════════════════
   AUDIO REACTIVE — Web Audio API Music Player & Frequency Analyser
   Playlist, player controls, frequency band extraction,
   CSS custom property output for site-wide reactivity
   ═══════════════════════════════════════════════════════════════ */
const AudioReactive = (() => {
  'use strict';

  const PLAYLIST = [
    { src: 'assets/audio/velvet.wav', title: 'Velvet', artist: 'Dylan Sitts' },
    { src: 'assets/audio/crucial-calculations.mp3', title: 'Crucial Calculations', artist: 'Gavin Luke' },
    { src: 'assets/audio/mystic-denial.mp3', title: 'Mystic Denial', artist: 'Anna Dager' }
  ];

  let audioEl = null;
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let freqData = null;
  let currentTrack = 0;
  let isPlaying = false;
  let reactiveEnabled = true;

  // Smoothed frequency bands (0-1)
  let bass = 0, mid = 0, treble = 0;

  /* ── Audio Context Setup ────────────────────────────────── */
  function ensureContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    freqData = new Uint8Array(analyser.frequencyBinCount);

    sourceNode = audioCtx.createMediaElementSource(audioEl);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  /* ── Playlist ───────────────────────────────────────────── */
  function loadTrack(idx) {
    currentTrack = idx % PLAYLIST.length;
    const track = PLAYLIST[currentTrack];
    audioEl.src = track.src;
    updateTrackDisplay();
  }

  function playTrack() {
    ensureContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    audioEl.play();
    isPlaying = true;
    updatePlayButton();
  }

  function pauseTrack() {
    audioEl.pause();
    isPlaying = false;
    updatePlayButton();
  }

  function togglePlay() {
    if (isPlaying) pauseTrack();
    else playTrack();
  }

  function nextTrack() {
    loadTrack(currentTrack + 1);
    if (isPlaying) playTrack();
  }

  function prevTrack() {
    if (audioEl.currentTime > 3) {
      audioEl.currentTime = 0;
    } else {
      loadTrack(currentTrack - 1 + PLAYLIST.length);
      if (isPlaying) playTrack();
    }
  }

  /* ── Frequency Analysis (called from rAF) ───────────────── */
  function analyse() {
    if (!analyser || !isPlaying || !reactiveEnabled) {
      // Decay to zero when not active
      bass += (0 - bass) * 0.1;
      mid += (0 - mid) * 0.1;
      treble += (0 - treble) * 0.1;
      applyCSS();
      return;
    }

    analyser.getByteFrequencyData(freqData);
    const bins = freqData.length; // 128

    // Bass: bins 0-8
    let bassSum = 0;
    for (let i = 0; i < 9; i++) bassSum += freqData[i];
    const rawBass = bassSum / (9 * 255);

    // Mid: bins 9-40
    let midSum = 0;
    for (let i = 9; i < 41; i++) midSum += freqData[i];
    const rawMid = midSum / (32 * 255);

    // Treble: bins 41-80
    let trebSum = 0;
    for (let i = 41; i < Math.min(81, bins); i++) trebSum += freqData[i];
    const rawTreble = trebSum / (40 * 255);

    // Smooth
    bass += (rawBass - bass) * 0.15;
    mid += (rawMid - mid) * 0.15;
    treble += (rawTreble - treble) * 0.15;

    applyCSS();
  }

  function applyCSS() {
    const root = document.documentElement;
    root.style.setProperty('--audio-bass', bass.toFixed(3));
    root.style.setProperty('--audio-mid', mid.toFixed(3));
    root.style.setProperty('--audio-treble', treble.toFixed(3));
    root.dataset.audioActive = (isPlaying && reactiveEnabled) ? '1' : '0';
  }

  /* ── Getters for animation engine ───────────────────────── */
  function getBass() { return bass; }
  function getMid() { return mid; }
  function getTreble() { return treble; }
  function isActive() { return isPlaying && reactiveEnabled; }

  /* ── UI Updates ─────────────────────────────────────────── */
  function updateTrackDisplay() {
    const track = PLAYLIST[currentTrack];
    const titleEl = document.getElementById('playerTrackTitle');
    const artistEl = document.getElementById('playerTrackArtist');
    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
  }

  function updatePlayButton() {
    const btn = document.getElementById('playerPlayBtn');
    if (!btn) return;
    btn.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    const navToggle = document.getElementById('navPlayerToggle');
    if (navToggle) navToggle.classList.toggle('playing', isPlaying);
  }

  function updateProgress() {
    if (!audioEl || !audioEl.duration) return;
    const pct = (audioEl.currentTime / audioEl.duration) * 100;
    const bar = document.getElementById('playerProgressFill');
    if (bar) bar.style.width = pct + '%';
    const timeEl = document.getElementById('playerTime');
    if (timeEl) {
      const cur = formatTime(audioEl.currentTime);
      const dur = formatTime(audioEl.duration);
      timeEl.textContent = `${cur} / ${dur}`;
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    audioEl = document.getElementById('psycheAudio');
    if (!audioEl) return;

    loadTrack(0);
    audioEl.volume = 0.35;

    // First click ANYWHERE on the site starts music
    let firstClickFired = false;
    document.addEventListener('click', () => {
      if (!firstClickFired) {
        firstClickFired = true;
        playTrack();
      }
    }, { once: true });

    // Music icon toggles play/pause + opens dropdown
    const toggleBtn = document.getElementById('navPlayerToggle');
    const wrap = document.getElementById('navPlayerWrap');
    if (toggleBtn && wrap) {
      toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (firstClickFired) {
          if (isPlaying) pauseTrack(); else playTrack();
        }
        wrap.classList.toggle('open');
      });
      document.addEventListener('click', e => {
        if (!wrap.contains(e.target)) wrap.classList.remove('open');
      });
    }

    // Player controls
    document.getElementById('playerPlayBtn')?.addEventListener('click', togglePlay);
    document.getElementById('playerNextBtn')?.addEventListener('click', nextTrack);
    document.getElementById('playerPrevBtn')?.addEventListener('click', prevTrack);

    // Volume
    const volSlider = document.getElementById('playerVolume');
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        audioEl.volume = volSlider.value / 100;
      });
    }

    // Mute
    document.getElementById('playerMuteBtn')?.addEventListener('click', () => {
      audioEl.muted = !audioEl.muted;
      const btn = document.getElementById('playerMuteBtn');
      if (btn) btn.classList.toggle('muted', audioEl.muted);
    });

    // Reactive toggle
    document.getElementById('playerReactiveBtn')?.addEventListener('click', () => {
      reactiveEnabled = !reactiveEnabled;
      const btn = document.getElementById('playerReactiveBtn');
      if (btn) btn.classList.toggle('active', reactiveEnabled);
      if (!reactiveEnabled) {
        document.documentElement.dataset.audioActive = '0';
      }
    });

    // Progress bar seeking
    const progressBar = document.getElementById('playerProgressBar');
    if (progressBar) {
      progressBar.addEventListener('click', e => {
        if (!audioEl.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audioEl.currentTime = pct * audioEl.duration;
      });
    }

    // Auto-advance
    audioEl.addEventListener('ended', nextTrack);

    // Progress update
    audioEl.addEventListener('timeupdate', updateProgress);

    // Keyboard: space for play/pause when not in input
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); togglePlay(); }
    });
  }

  /* ── Portrait Carousel ──────────────────────────────────── */
  const PORTRAITS = [
    { name: 'Sigmund Freud', blurb: 'Father of psychoanalysis. Unconscious mind, defense mechanisms.', units: ['Unit 4', 'Unit 5'] },
    { name: 'Charles Darwin', blurb: 'Theory of evolution by natural selection. Evolutionary perspective.', units: ['Unit 1'] },
    { name: 'Abraham Maslow', blurb: 'Hierarchy of needs. Humanistic psychology, self-actualization.', units: ['Unit 4'] },
    { name: 'B.F. Skinner', blurb: 'Operant conditioning. Reinforcement schedules, shaping.', units: ['Unit 3'] },
    { name: 'John B. Watson', blurb: 'Founder of behaviorism. Little Albert experiment.', units: ['Unit 3'] },
    { name: 'Ivan Pavlov', blurb: 'Classical conditioning. Conditioned reflexes in dogs.', units: ['Unit 3'] }
  ];
  const QUOTE_ATTRS = [
    '— Sigmund Freud', '— John B. Watson', '— Abraham Maslow',
    '— Ivan Pavlov', '— B.F. Skinner', '— B.F. Skinner'
  ];

  let portraitIdx = 0;
  let portraitImages = [];
  let portraitTimer = null;
  let lastBeatTime = 0;

  function initPortraitCarousel() {
    portraitImages = Array.from(document.querySelectorAll('.hero-portrait'));
    if (!portraitImages.length) return;
    startPortraitTimer();
    initQuoteClick();
  }

  function initQuoteClick() {
    const carousel = document.getElementById('heroQuoteCarousel');
    if (!carousel) return;
    const quotes = carousel.querySelectorAll('.hero-quote');
    const attrEl = document.getElementById('heroQuoteAttr');
    if (quotes.length < 2) return;

    let currentQuoteIdx = 0;
    carousel.style.cursor = 'pointer';
    carousel.addEventListener('click', (e) => {
      if (e.target.closest('.hero-quote-speak-btn')) return;
      let nextIdx;
      do { nextIdx = Math.floor(Math.random() * quotes.length); } while (nextIdx === currentQuoteIdx);
      currentQuoteIdx = nextIdx;
      quotes.forEach(q => q.classList.remove('active'));
      quotes[currentQuoteIdx].classList.add('active');
      if (attrEl && QUOTE_ATTRS[currentQuoteIdx]) attrEl.textContent = QUOTE_ATTRS[currentQuoteIdx];
    });
  }

  function advancePortrait() {
    portraitImages.forEach(img => img.classList.remove('active'));
    portraitIdx = (portraitIdx + 1) % PORTRAITS.length;
    if (portraitImages[portraitIdx]) portraitImages[portraitIdx].classList.add('active');

    const p = PORTRAITS[portraitIdx];

    // Update blurb strip in hero-left
    const nameEl = document.getElementById('heroBlurbName');
    const blurbEl = document.getElementById('heroBlurbText');
    const unitsEl = document.getElementById('heroBlurbUnits');
    if (nameEl) nameEl.textContent = p.name;
    if (blurbEl) blurbEl.textContent = p.blurb;
    if (unitsEl) unitsEl.innerHTML = p.units.map(u => `<span class="ced-chip">${u}</span>`).join(' ');
  }

  function startPortraitTimer() {
    if (portraitTimer) clearInterval(portraitTimer);
    portraitTimer = setInterval(() => {
      if (isPlaying && reactiveEnabled && bass > 0.6) return;
      advancePortrait();
    }, 3000);
  }

  function checkBeatAdvance() {
    if (!isPlaying || !reactiveEnabled) return;
    const now = performance.now();
    if (bass > 0.6 && now - lastBeatTime > 1500) {
      lastBeatTime = now;
      advancePortrait();
    }
  }

  return { init, analyse, getBass, getMid, getTreble, isActive, initPortraitCarousel, checkBeatAdvance };
})();
