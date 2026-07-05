/* ═══════════════════════════════════════════════════════════════
   PSYCHE ANIMATIONS - Central Animation Engine
   Single rAF loop, mouse parallax, signal pulses, particles,
   scroll reveals, motion intensity control
   ═══════════════════════════════════════════════════════════════ */
const PsycheAnimations = (() => {
  'use strict';

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motionLevel = 1; // 0=calm, 1=standard, 2=cinematic
  let rafId = null;
  let heroVisible = true;
  let mouseX = 0.5, mouseY = 0.5;
  let smoothMouseX = 0.5, smoothMouseY = 0.5;
  let lastFrame = 0;
  const FPS_30 = 1000 / 30;

  // Particle state
  const particles = [];
  const MAX_PARTICLES = 20;
  let particleContainer = null;

  // Signal pulse state
  const signalPulses = [];
  let heroAxonPaths = [];
  let signalTimer = 0;
  const SIGNAL_INTERVAL = 3000;

  // Cascade system state
  let cascadeData = null;       // { neurons, connections } from heroBrainVisual
  let cascadeQueue = [];        // pending cascade activations
  let activeFlashes = [];       // currently flashing neurons
  let signalPoolEls = null;     // pre-allocated signal DOM elements
  let flashPoolEls = null;      // pre-allocated flash ring DOM elements
  let trailPoolEls = null;      // pre-allocated trail DOM elements
  let nextSignalIdx = 0;
  let nextFlashIdx = 0;
  const CASCADE_DELAY = 280;    // ms between chain links
  const FLASH_DURATION = 450;   // ms for neuron flash

  /* ── Motion Level Control ───────────────────────────────── */
  function setMotionLevel(level) {
    motionLevel = level;
    document.documentElement.dataset.motion = ['calm', 'standard', 'cinematic'][level];
    try { localStorage.setItem('psycheMotion', level); } catch (e) {}
    document.querySelectorAll('.motion-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.level) === level);
    });
    if (level === 0) {
      stopLoop();
      hideParticles();
    } else {
      startLoop();
    }
  }

  function loadMotionLevel() {
    if (REDUCED_MOTION) { setMotionLevel(0); return; }
    try {
      const saved = localStorage.getItem('psycheMotion');
      if (saved !== null) { setMotionLevel(parseInt(saved)); return; }
    } catch (e) {}
    setMotionLevel(1);
  }

  /* ── Mouse Tracking ─────────────────────────────────────── */
  function initMouseTracking() {
    document.addEventListener('mousemove', e => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    });
    document.addEventListener('touchmove', e => {
      if (e.touches.length) {
        mouseX = e.touches[0].clientX / window.innerWidth;
        mouseY = e.touches[0].clientY / window.innerHeight;
      }
    }, { passive: true });
  }

  /* ── Parallax ───────────────────────────────────────────── */
  function updateParallax() {
    const intensity = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--parallax-intensity')) || 0;
    if (intensity === 0) return;

    smoothMouseX += (mouseX - smoothMouseX) * 0.08;
    smoothMouseY += (mouseY - smoothMouseY) * 0.08;

    const cx = (smoothMouseX - 0.5) * 2;
    const cy = (smoothMouseY - 0.5) * 2;

    const layers = document.querySelectorAll('.hero-depth-layer');
    const depths = [-80, -40, 0, 30];
    layers.forEach((layer, i) => {
      const d = depths[i] || 0;
      const factor = (d / 80) * intensity * 15;
      layer.style.transform = `translate3d(${cx * factor}px, ${cy * factor}px, ${d}px)`;
    });
  }

  /* ── Signal Pulses Along Axon Paths ─────────────────────── */
  function initSignalPaths() {
    heroAxonPaths = Array.from(document.querySelectorAll('.hero-axon-path'));

    // Initialize cascade system from hero brain data
    const brainContainer = document.getElementById('heroBrainVisual');
    if (brainContainer && brainContainer._heroBrainData) {
      cascadeData = brainContainer._heroBrainData;
      signalPoolEls = Array.from(document.querySelectorAll('.cascade-signal'));
      trailPoolEls = Array.from(document.querySelectorAll('.cascade-trail'));
      flashPoolEls = Array.from(document.querySelectorAll('.neuron-flash-ring'));
    }
  }

  function spawnSignalPulse() {
    if (!heroAxonPaths.length) return;

    // If cascade system is available, prefer cascade firing
    if (cascadeData && signalPoolEls && signalPoolEls.length) {
      spawnCascade();
      return;
    }

    // Fallback: original single-dot signal on axon path
    const pathEl = heroAxonPaths[Math.floor(Math.random() * heroAxonPaths.length)];
    const totalLen = pathEl.getTotalLength();
    if (!totalLen) return;

    const svg = pathEl.ownerSVGElement;
    if (!svg) return;
    const ns = 'http://www.w3.org/2000/svg';
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', '#f7c948');
    dot.setAttribute('opacity', '0');
    dot.classList.add('axon-signal');
    svg.appendChild(dot);

    signalPulses.push({
      el: dot,
      path: pathEl,
      totalLen,
      progress: 0,
      speed: 0.003 + Math.random() * 0.002
    });
  }

  /* ── Cascade Firing System ───────────────────────────────── */
  function spawnCascade() {
    if (!cascadeData) return;
    const { neurons, connections } = cascadeData;
    const startIdx = Math.floor(Math.random() * neurons.length);
    fireCascadeAt(startIdx, 0, new Set());
  }

  function fireCascadeAt(neuronIdx, delay, visited) {
    if (!cascadeData || visited.has(neuronIdx)) return;
    visited.add(neuronIdx);
    if (visited.size > 8) return; // limit chain depth

    cascadeQueue.push({ neuronIdx, fireAt: performance.now() + delay, visited });
  }

  function processCascadeQueue(now) {
    for (let i = cascadeQueue.length - 1; i >= 0; i--) {
      const item = cascadeQueue[i];
      if (now >= item.fireAt) {
        cascadeQueue.splice(i, 1);
        doNeuronFire(item.neuronIdx, item.visited);
      }
    }
  }

  function doNeuronFire(neuronIdx, visited) {
    if (!cascadeData) return;
    const { neurons, connections } = cascadeData;
    const n = neurons[neuronIdx];
    if (!n) return;

    // Flash the neuron soma
    flashNeuron(n, neuronIdx);

    // Brief region zone pulse
    pulseRegion(n.region);

    // Send signals down outgoing axons
    connections.forEach(([a, b], connIdx) => {
      let targetIdx = -1;
      if (a === neuronIdx && !visited.has(b)) targetIdx = b;
      else if (b === neuronIdx && !visited.has(a)) targetIdx = a;
      if (targetIdx < 0) return;
      if (Math.random() > 0.6) return; // not every connection fires

      const pathEl = document.getElementById(`axon-${connIdx}`);
      if (!pathEl) return;
      const totalLen = pathEl.getTotalLength();
      if (!totalLen) return;

      const reverse = (a !== neuronIdx);
      launchSignalOnPath(pathEl, totalLen, reverse);
      fireCascadeAt(targetIdx, CASCADE_DELAY + Math.random() * 150, new Set(visited));
    });
  }

  function flashNeuron(n, idx) {
    if (!flashPoolEls || !flashPoolEls.length) return;
    const el = flashPoolEls[nextFlashIdx % flashPoolEls.length];
    nextFlashIdx++;

    el.setAttribute('cx', n.x);
    el.setAttribute('cy', n.y);
    el.setAttribute('r', n.r * 1.5);
    el.setAttribute('opacity', '0.7');
    el.setAttribute('stroke', n.c === '#ef6f61' ? '#f7c948' : '#22d3ee');

    activeFlashes.push({
      el, startTime: performance.now(), x: n.x, y: n.y, maxR: n.r * 4
    });

    // Flash the soma element via CSS class
    const somaEl = document.querySelector(`.neuron-soma[data-idx="${idx}"]`);
    if (somaEl) {
      somaEl.classList.add('firing');
      setTimeout(() => somaEl.classList.remove('firing'), FLASH_DURATION);
    }
  }

  function updateFlashes(now) {
    for (let i = activeFlashes.length - 1; i >= 0; i--) {
      const f = activeFlashes[i];
      const elapsed = Math.max(0, now - f.startTime);
      const t = elapsed / FLASH_DURATION;
      if (t >= 1) {
        f.el.setAttribute('opacity', '0');
        f.el.setAttribute('r', '0');
        activeFlashes.splice(i, 1);
        continue;
      }
      const r = Math.max(0, f.maxR * t);
      const opacity = 0.6 * (1 - t);
      f.el.setAttribute('r', r);
      f.el.setAttribute('opacity', opacity);
    }
  }

  function launchSignalOnPath(pathEl, totalLen, reverse) {
    if (!signalPoolEls || !signalPoolEls.length) return;
    const dotEl = signalPoolEls[nextSignalIdx % signalPoolEls.length];
    const trailEl = trailPoolEls ? trailPoolEls[nextSignalIdx % trailPoolEls.length] : null;
    nextSignalIdx++;

    signalPulses.push({
      el: dotEl,
      trailEl,
      path: pathEl,
      totalLen,
      progress: reverse ? 1 : 0,
      speed: (0.003 + Math.random() * 0.002) * (reverse ? -1 : 1),
      pooled: true
    });
  }

  function pulseRegion(regionName) {
    const zone = document.querySelector(`.region-zone[data-region="${regionName}"]`);
    if (!zone) return;
    zone.classList.add('region-pulsing');
    setTimeout(() => zone.classList.remove('region-pulsing'), 600);
  }

  function updateSignalPulses(dt) {
    for (let i = signalPulses.length - 1; i >= 0; i--) {
      const p = signalPulses[i];
      p.progress += p.speed * dt;
      const done = p.speed > 0 ? p.progress >= 1 : p.progress <= 0;
      if (done) {
        if (p.pooled) {
          p.el.setAttribute('opacity', '0');
          if (p.trailEl) p.trailEl.setAttribute('opacity', '0');
        } else {
          p.el.remove();
        }
        signalPulses.splice(i, 1);
        continue;
      }
      const absProgress = Math.abs(p.speed > 0 ? p.progress : 1 - p.progress);
      const pt = p.path.getPointAtLength(Math.abs(p.progress) * p.totalLen);
      p.el.setAttribute('cx', pt.x);
      p.el.setAttribute('cy', pt.y);
      const fade = absProgress < 0.1 ? absProgress / 0.1 : absProgress > 0.85 ? (1 - absProgress) / 0.15 : 1;
      p.el.setAttribute('opacity', fade * 0.85);

      // Trail follows behind
      if (p.trailEl) {
        const trailProgress = Math.max(0, Math.min(1, Math.abs(p.progress) - 0.05)) * p.totalLen;
        const tp = p.path.getPointAtLength(trailProgress);
        p.trailEl.setAttribute('cx', tp.x);
        p.trailEl.setAttribute('cy', tp.y);
        p.trailEl.setAttribute('opacity', fade * 0.25);
      }
    }
  }

  /* ── Particles ──────────────────────────────────────────── */
  function initParticles() {
    particleContainer = document.querySelector('.particle-layer');
    if (!particleContainer) return;
    const colors = ['#ef6f61', '#38bdf8', '#22d3ee', '#f7c948', '#a78bfa'];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const div = document.createElement('div');
      div.className = 'particle';
      const size = 1 + Math.random() * 2.5;
      div.style.width = size + 'px';
      div.style.height = size + 'px';
      div.style.background = colors[Math.floor(Math.random() * colors.length)];
      div.style.boxShadow = `0 0 ${size * 2}px currentColor`;
      particleContainer.appendChild(div);
      particles.push({
        el: div,
        x: Math.random() * 100,
        y: Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.015,
        vy: -0.005 - Math.random() * 0.01,
        baseOpacity: 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function updateParticlesWithAudio(time, audioBass, audioMid) {
    const speedMult = 1 + audioBass * 0.8;
    const opacityBoost = audioMid * 0.2;
    particles.forEach(p => {
      p.x += p.vx * speedMult;
      p.y += p.vy * speedMult;
      if (p.y < -5) { p.y = 105; p.x = Math.random() * 100; }
      if (p.x < -5) p.x = 105;
      if (p.x > 105) p.x = -5;
      const flicker = Math.sin(time * 0.001 + p.phase) * 0.1;
      // Edge fade: particles near viewport edges fade out
      const edgeFade = Math.min(
        p.y / 10, (100 - p.y) / 10,
        p.x / 8, (100 - p.x) / 8,
        1
      );
      p.el.style.transform = `translate(${p.x}vw, ${p.y}vh)`;
      p.el.style.opacity = Math.max(0, (p.baseOpacity + flicker + opacityBoost) * edgeFade);
    });
  }

  /* ── Scroll Parallax for Decoratives ───────────────────── */
  let scrollParallaxInited = false;
  function initScrollParallax() {
    if (scrollParallaxInited || REDUCED_MOTION) return;
    scrollParallaxInited = true;
    const rorschachs = document.querySelectorAll('.rorschach');
    const grids = document.querySelectorAll('.psyche-garden-grid');
    if (!rorschachs.length && !grids.length) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking || motionLevel === 0) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        rorschachs.forEach((el, i) => {
          const rate = (i % 2 === 0) ? 0.03 : -0.02;
          el.style.transform = `translateY(${scrollY * rate}px)`;
        });
        grids.forEach((el, i) => {
          const rate = (i % 2 === 0) ? -0.015 : 0.02;
          el.style.transform = `translateY(${scrollY * rate}px) ${el.style.transform?.includes('rotate') ? 'rotate(12deg)' : ''}`;
        });
        ticking = false;
      });
    }, { passive: true });
  }

  function hideParticles() {
    particles.forEach(p => { p.el.style.opacity = 0; });
  }

  /* ── Scroll Reveal ──────────────────────────────────────── */
  function initScrollReveal() {
    if (REDUCED_MOTION) return;

    // Auto-assign stagger delays to grid children
    document.querySelectorAll('.module-grid, .practice-strip-grid, .unit-pathway-cards, .vocab-grid').forEach(grid => {
      const children = grid.querySelectorAll('.reveal-on-scroll');
      children.forEach((child, i) => {
        if (!child.dataset.revealDelay) {
          child.dataset.revealDelay = String(i * 70);
        }
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && motionLevel > 0) {
          const delay = parseInt(entry.target.dataset.revealDelay || '0');
          setTimeout(() => entry.target.classList.add('revealed'), delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
  }

  /* ── Hero Visibility ────────────────────────────────────── */
  function initHeroObserver() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const obs = new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
      if (heroVisible && motionLevel > 0 && !rafId) startLoop();
    }, { threshold: 0.05 });
    obs.observe(hero);
  }

  /* ── Central Animation Loop ─────────────────────────────── */
  function loop(timestamp) {
    if (motionLevel === 0) { rafId = null; return; }

    const dt = timestamp - lastFrame;
    if (motionLevel === 1 && dt < FPS_30) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    lastFrame = timestamp;

    // Audio frequency analysis (runs every frame regardless of hero visibility)
    if (typeof AudioReactive !== 'undefined') {
      AudioReactive.analyse();
      AudioReactive.checkBeatAdvance();
    }

    if (heroVisible) {
      updateParallax();

      // Audio-reactive particle boost
      const audioBass = (typeof AudioReactive !== 'undefined' && AudioReactive.isActive()) ? AudioReactive.getBass() : 0;
      const audioMid = (typeof AudioReactive !== 'undefined' && AudioReactive.isActive()) ? AudioReactive.getMid() : 0;
      updateParticlesWithAudio(timestamp, audioBass, audioMid);

      // Audio-reactive signal spawn rate
      const audioTreble = (typeof AudioReactive !== 'undefined' && AudioReactive.isActive()) ? AudioReactive.getTreble() : 0;
      const adjustedInterval = SIGNAL_INTERVAL - (audioTreble * 2200);
      signalTimer += dt;
      if (signalTimer > Math.max(400, adjustedInterval)) {
        signalTimer = 0;
        spawnSignalPulse();
      }
      updateSignalPulses(dt);
      processCascadeQueue(timestamp);
      updateFlashes(timestamp);
    }

    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId || motionLevel === 0 || REDUCED_MOTION) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ── Motion Controls UI ─────────────────────────────────── */
  function initMotionControls() {
    const toggle = document.querySelector('.motion-controls-toggle');
    const panel = document.querySelector('.motion-controls');
    if (toggle && panel) {
      toggle.addEventListener('click', () => panel.classList.toggle('open'));
    }
    document.querySelectorAll('.motion-btn').forEach(btn => {
      btn.addEventListener('click', () => setMotionLevel(parseInt(btn.dataset.level)));
    });
    document.addEventListener('click', e => {
      if (panel && !panel.contains(e.target)) panel.classList.remove('open');
    });
  }

  /* ── Pathway Signal Animation ───────────────────────────── */
  function initPathwaySignal() {
    const pathwaySvg = document.querySelector('.unit-pathway-svg');
    if (!pathwaySvg || REDUCED_MOTION) return;

    const axons = pathwaySvg.querySelectorAll('.pathway-axon');
    if (!axons.length) return;

    let currentAxon = 0;

    function firePathwaySignal() {
      if (motionLevel === 0) { setTimeout(firePathwaySignal, 2000); return; }
      const path = axons[currentAxon];
      if (!path) { currentAxon = 0; setTimeout(firePathwaySignal, 500); return; }
      const totalLen = path.getTotalLength();
      const ns = 'http://www.w3.org/2000/svg';
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', '#f7c948');
      dot.setAttribute('opacity', '0');
      dot.setAttribute('filter', 'url(#pathGlow)');
      pathwaySvg.appendChild(dot);

      let prog = 0;
      function step() {
        prog += 0.02;
        if (prog >= 1) { dot.remove(); return; }
        const pt = path.getPointAtLength(prog * totalLen);
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
        const fade = prog < 0.1 ? prog / 0.1 : prog > 0.8 ? (1 - prog) / 0.2 : 1;
        dot.setAttribute('opacity', fade * 0.8);
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);

      currentAxon = (currentAxon + 1) % axons.length;
      setTimeout(firePathwaySignal, 2000);
    }
    setTimeout(firePathwaySignal, 1000);
  }

  /* ── Public Init ────────────────────────────────────────── */
  function init() {
    loadMotionLevel();
    initMouseTracking();
    initParticles();
    initHeroObserver();
    initScrollReveal();
    initMotionControls();
    initScrollParallax();

    // Init audio system
    if (typeof AudioReactive !== 'undefined') AudioReactive.init();

    setTimeout(() => {
      initSignalPaths();
      initPathwaySignal();
    }, 500);

    if (motionLevel > 0 && !REDUCED_MOTION) startLoop();
  }

  return { init, setMotionLevel };
})();
