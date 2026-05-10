/* ═══════════════════════════════════════════════════════════════
   NEURO VISUALS — SVG Neuron Backgrounds & Interactive Diagrams
   AP Psychology Master Review System
   ═══════════════════════════════════════════════════════════════ */

const NeuroVisuals = (() => {
  'use strict';

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Utility ──────────────────────────────────────────────── */
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function seededRng(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'href') {
        el.setAttribute('href', v);
        el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', v);
      } else {
        el.setAttribute(k, v);
      }
    }
    return el;
  }

  /* ═══════════════════════════════════════════════════════════
     NEURON BACKGROUND GENERATOR
     ═══════════════════════════════════════════════════════════ */
  function generateNeuronBackground(container) {
    if (!container) return;
    container.innerHTML = '';

    const w = window.innerWidth;
    const h = window.innerHeight;
    const svg = svgEl('svg', {
      viewBox: `0 0 ${w} ${h}`,
      width: '100%',
      height: '100%',
      preserveAspectRatio: 'xMidYMid slice',
      'aria-hidden': 'true'
    });

    const defs = svgEl('defs');

    // Radial gradient for neuron somas
    const somaGrad = svgEl('radialGradient', { id: 'somaGrad', cx: '40%', cy: '35%' });
    somaGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ef6f61', 'stop-opacity': '0.25' }));
    somaGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#ef6f61', 'stop-opacity': '0.05' }));
    defs.appendChild(somaGrad);

    // Glow filter
    const glow = svgEl('filter', { id: 'neuronGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    const blur = svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '3', result: 'blur' });
    const merge = svgEl('feMerge');
    merge.appendChild(svgEl('feMergeNode', { in: 'blur' }));
    merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    glow.appendChild(blur);
    glow.appendChild(merge);
    defs.appendChild(glow);

    svg.appendChild(defs);

    const neuronCount = Math.min(12, Math.max(6, Math.floor(w * h / 120000)));
    const neurons = [];

    // Place neurons on a jittered grid
    const cols = Math.ceil(Math.sqrt(neuronCount * (w / h)));
    const rows = Math.ceil(neuronCount / cols);
    const cellW = w / cols;
    const cellH = h / rows;

    for (let i = 0; i < neuronCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = cellW * col + cellW * rand(0.2, 0.8);
      const y = cellH * row + cellH * rand(0.2, 0.8);
      neurons.push({ x, y, r: rand(12, 22) });
    }

    const bgGroup = svgEl('g', { opacity: '0.08' });
    const fgGroup = svgEl('g', { opacity: '0.14' });

    // Draw axon connections between nearby neurons
    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        const dist = Math.hypot(neurons[j].x - neurons[i].x, neurons[j].y - neurons[i].y);
        if (dist < Math.max(w, h) * 0.45 && Math.random() > 0.4) {
          const midX = (neurons[i].x + neurons[j].x) / 2 + rand(-80, 80);
          const midY = (neurons[i].y + neurons[j].y) / 2 + rand(-80, 80);
          const path = svgEl('path', {
            d: `M${neurons[i].x},${neurons[i].y} Q${midX},${midY} ${neurons[j].x},${neurons[j].y}`,
            fill: 'none',
            stroke: '#38bdf8',
            'stroke-width': rand(0.5, 1.5),
            'stroke-opacity': rand(0.3, 0.6),
            class: 'axon-path'
          });
          bgGroup.appendChild(path);

          // Synapse points at connection ends
          if (Math.random() > 0.5) {
            const synapse = svgEl('circle', {
              cx: neurons[j].x,
              cy: neurons[j].y,
              r: rand(2, 4),
              fill: '#22d3ee',
              opacity: rand(0.3, 0.7),
              class: 'synapse-pulse'
            });
            if (!REDUCED_MOTION) {
              synapse.style.animationDelay = `${rand(0, 8)}s`;
              synapse.style.animationDuration = `${rand(3, 6)}s`;
            }
            fgGroup.appendChild(synapse);
          }
        }
      }
    }

    // Draw dendrites
    neurons.forEach(n => {
      const dendCount = randInt(3, 7);
      for (let d = 0; d < dendCount; d++) {
        const angle = (d / dendCount) * Math.PI * 2 + rand(-0.3, 0.3);
        const len = rand(30, 80);
        const endX = n.x + Math.cos(angle) * len;
        const endY = n.y + Math.sin(angle) * len;
        const cpX = n.x + Math.cos(angle) * len * 0.5 + rand(-15, 15);
        const cpY = n.y + Math.sin(angle) * len * 0.5 + rand(-15, 15);

        const dendrite = svgEl('path', {
          d: `M${n.x},${n.y} Q${cpX},${cpY} ${endX},${endY}`,
          fill: 'none',
          stroke: '#ef6f61',
          'stroke-width': rand(0.4, 1.2),
          'stroke-opacity': rand(0.25, 0.5),
          'stroke-linecap': 'round',
          class: 'dendrite-branch'
        });
        bgGroup.appendChild(dendrite);

        // Branch tips
        if (Math.random() > 0.5) {
          const tipAngle = angle + rand(-0.6, 0.6);
          const tipLen = rand(10, 25);
          const tipX = endX + Math.cos(tipAngle) * tipLen;
          const tipY = endY + Math.sin(tipAngle) * tipLen;
          const tip = svgEl('path', {
            d: `M${endX},${endY} L${tipX},${tipY}`,
            fill: 'none',
            stroke: '#ef6f61',
            'stroke-width': rand(0.3, 0.7),
            'stroke-opacity': rand(0.15, 0.35),
            'stroke-linecap': 'round'
          });
          bgGroup.appendChild(tip);
        }
      }
    });

    // Draw neuron cell bodies (somas)
    neurons.forEach((n, i) => {
      // Outer glow
      const glow = svgEl('circle', {
        cx: n.x, cy: n.y, r: n.r * 2,
        fill: 'url(#somaGrad)',
        class: 'neuron-node'
      });
      if (!REDUCED_MOTION) {
        glow.style.animationDelay = `${i * 0.8}s`;
      }
      fgGroup.appendChild(glow);

      // Cell body
      const soma = svgEl('ellipse', {
        cx: n.x, cy: n.y,
        rx: n.r, ry: n.r * rand(0.85, 1.15),
        fill: 'none',
        stroke: '#ef6f61',
        'stroke-width': rand(0.6, 1.2),
        'stroke-opacity': rand(0.3, 0.5)
      });
      fgGroup.appendChild(soma);

      // Nucleus
      const nucleus = svgEl('circle', {
        cx: n.x + rand(-2, 2),
        cy: n.y + rand(-2, 2),
        r: n.r * rand(0.3, 0.45),
        fill: '#ef6f61',
        'fill-opacity': rand(0.15, 0.25)
      });
      fgGroup.appendChild(nucleus);
    });

    svg.appendChild(bgGroup);
    svg.appendChild(fgGroup);
    container.appendChild(svg);
  }

  /* ═══════════════════════════════════════════════════════════
     INTERACTIVE DIAGRAMS
     ═══════════════════════════════════════════════════════════ */

  /* ── Shared diagram helpers ───────────────────────────────── */
  function diagramDefs(svg, prefix) {
    const defs = svgEl('defs');
    // Glow filter
    const gf = svgEl('filter', { id: prefix + 'Glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    gf.appendChild(svgEl('feGaussianBlur', { stdDeviation: '4', result: 'g' }));
    const gm = svgEl('feMerge');
    gm.appendChild(svgEl('feMergeNode', { in: 'g' }));
    gm.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    gf.appendChild(gm);
    defs.appendChild(gf);
    // Soft glow
    const sf = svgEl('filter', { id: prefix + 'Soft', x: '-30%', y: '-30%', width: '160%', height: '160%' });
    sf.appendChild(svgEl('feGaussianBlur', { stdDeviation: '2.5', result: 's' }));
    const sm = svgEl('feMerge');
    sm.appendChild(svgEl('feMergeNode', { in: 's' }));
    sm.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    sf.appendChild(sm);
    defs.appendChild(sf);
    svg.appendChild(defs);
    return defs;
  }
  function diagramLabel(svg, x, y, text, opts = {}) {
    const { size = 10, color = '#a8b5c7', weight = '600', anchor = 'middle', family = 'Inter, system-ui, sans-serif', glow } = opts;
    if (glow) svg.appendChild(svgEl('ellipse', { cx: x, cy: y - 1, rx: text.length * 2.8 + 6, ry: 7, fill: glow, opacity: 0.08 }));
    const t = svgEl('text', { x, y, fill: color, 'font-size': size, 'font-weight': weight, 'text-anchor': anchor, 'font-family': family });
    t.textContent = text;
    svg.appendChild(t);
    return t;
  }
  function diagramTitle(svg, w, y, text) {
    svg.appendChild(svgEl('line', { x1: 40, y1: y + 8, x2: w - 40, y2: y + 8, stroke: '#a8b5c7', 'stroke-width': 0.5, opacity: 0.08 }));
    return diagramLabel(svg, w / 2, y, text, { size: 15, color: '#f4f7fb', weight: '700', family: "'Playfair Display', Georgia, serif" });
  }

  /* ── Neuron Firing Flow ───────────────────────────────────── */
  function createNeuronFiringDiagram(container) {
    if (!container) return;
    const w = 700, h = 320;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const defs = diagramDefs(svg, 'nf');

    // Axon gradient with animated flow
    const axGrad = svgEl('linearGradient', { id: 'nfAxonGrad', x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
    axGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ef6f61', 'stop-opacity': '0.9' }));
    axGrad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': '#f7c948', 'stop-opacity': '1' }));
    axGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#38bdf8', 'stop-opacity': '0.9' }));
    if (!REDUCED_MOTION) {
      axGrad.appendChild(svgEl('animate', { attributeName: 'x1', values: '-100%;0%', dur: '3s', repeatCount: 'indefinite' }));
      axGrad.appendChild(svgEl('animate', { attributeName: 'x2', values: '0%;100%', dur: '3s', repeatCount: 'indefinite' }));
    }
    defs.appendChild(axGrad);

    // Soma radial gradient
    const somaGrad = svgEl('radialGradient', { id: 'nfSomaGrad', cx: '40%', cy: '35%' });
    somaGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ef6f61', 'stop-opacity': '0.25' }));
    somaGrad.appendChild(svgEl('stop', { offset: '70%', 'stop-color': '#ef6f61', 'stop-opacity': '0.08' }));
    somaGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#ef6f61', 'stop-opacity': '0' }));
    defs.appendChild(somaGrad);

    // Membrane potential gradient (background strip)
    const mpGrad = svgEl('linearGradient', { id: 'nfMembrane', x1: '0%', x2: '100%' });
    mpGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ef6f61', 'stop-opacity': '0.04' }));
    mpGrad.appendChild(svgEl('stop', { offset: '40%', 'stop-color': '#f7c948', 'stop-opacity': '0.06' }));
    mpGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#38bdf8', 'stop-opacity': '0.04' }));
    defs.appendChild(mpGrad);

    // Background membrane potential strip
    svg.appendChild(svgEl('rect', { x: 0, y: 120, width: w, height: 60, fill: 'url(#nfMembrane)', rx: 4 }));

    // Soma with layered glow
    svg.appendChild(svgEl('ellipse', { cx: 80, cy: 150, rx: 55, ry: 48, fill: 'url(#nfSomaGrad)' }));
    svg.appendChild(svgEl('ellipse', { cx: 80, cy: 150, rx: 45, ry: 40, fill: 'none', stroke: '#ef6f61', 'stroke-width': 2, opacity: 0.65 }));
    svg.appendChild(svgEl('ellipse', { cx: 80, cy: 150, rx: 38, ry: 34, fill: 'none', stroke: '#ef6f61', 'stroke-width': 0.5, opacity: 0.2 }));
    // Nucleus
    svg.appendChild(svgEl('circle', { cx: 75, cy: 145, r: 16, fill: '#ef6f61', 'fill-opacity': 0.15, stroke: '#ef6f61', 'stroke-width': 0.8, 'stroke-opacity': 0.3 }));
    svg.appendChild(svgEl('circle', { cx: 73, cy: 143, r: 6, fill: '#ef6f61', 'fill-opacity': 0.25 }));

    // Dendrites with branching
    const dendPaths = [
      'M35,150 Q10,120 5,85', 'M40,128 Q15,95 8,62', 'M40,172 Q15,195 5,218',
      'M45,120 Q28,88 32,55', 'M45,180 Q28,208 22,235'
    ];
    dendPaths.forEach(d => {
      svg.appendChild(svgEl('path', { d, fill: 'none', stroke: '#ef6f61', 'stroke-width': 1.8, opacity: 0.45, 'stroke-linecap': 'round' }));
      // Branch tips
      const pts = d.match(/-?\d+/g).map(Number);
      const ex = pts[pts.length - 2], ey = pts[pts.length - 1];
      svg.appendChild(svgEl('line', { x1: ex, y1: ey, x2: ex + rand(-12, 5), y2: ey + rand(-12, 12), stroke: '#ef6f61', 'stroke-width': 0.8, opacity: 0.3, 'stroke-linecap': 'round' }));
    });

    // Axon hillock (tapered)
    svg.appendChild(svgEl('path', { d: 'M125,150 L165,150', fill: 'none', stroke: '#ef6f61', 'stroke-width': 4, opacity: 0.5, 'stroke-linecap': 'round' }));
    svg.appendChild(svgEl('circle', { cx: 125, cy: 150, r: 4, fill: '#ef6f61', opacity: 0.3 }));

    // Axon path
    const axonPathD = 'M125,150 L490,150';
    svg.appendChild(svgEl('path', { d: axonPathD, fill: 'none', stroke: 'url(#nfAxonGrad)', 'stroke-width': 2.5, opacity: 0.35, id: 'axonMainPath' }));
    // Subtle glow underline
    svg.appendChild(svgEl('path', { d: axonPathD, fill: 'none', stroke: '#38bdf8', 'stroke-width': 6, opacity: 0.04 }));

    // Myelin sheath segments with glow
    const myelinXs = [170, 232, 294, 356, 418];
    myelinXs.forEach(mx => {
      svg.appendChild(svgEl('rect', { x: mx, y: 136, width: 48, height: 28, rx: 14, fill: '#38bdf8', opacity: 0.04 }));
      svg.appendChild(svgEl('rect', { x: mx, y: 136, width: 48, height: 28, rx: 14, fill: 'none', stroke: '#38bdf8', 'stroke-width': 1.5, opacity: 0.35 }));
    });

    // Nodes of Ranvier (glowing)
    const nodeXs = [218, 280, 342, 404];
    nodeXs.forEach(nx => {
      svg.appendChild(svgEl('circle', { cx: nx, cy: 150, r: 6, fill: '#22d3ee', opacity: 0.08 }));
      svg.appendChild(svgEl('circle', { cx: nx, cy: 150, r: 3, fill: '#22d3ee', opacity: 0.7, class: REDUCED_MOTION ? '' : 'synapse-pulse' }));
    });

    // Axon terminals with bulbs
    const termPaths = [
      { d: 'M490,150 Q510,135 530,125', ex: 530, ey: 125 },
      { d: 'M490,150 Q515,150 535,150', ex: 535, ey: 150 },
      { d: 'M490,150 Q510,165 530,175', ex: 530, ey: 175 }
    ];
    termPaths.forEach(tp => {
      svg.appendChild(svgEl('path', { d: tp.d, fill: 'none', stroke: '#38bdf8', 'stroke-width': 2, opacity: 0.5, 'stroke-linecap': 'round' }));
      svg.appendChild(svgEl('circle', { cx: tp.ex, cy: tp.ey, r: 8, fill: '#22d3ee', 'fill-opacity': 0.10, stroke: '#22d3ee', 'stroke-width': 1.5, opacity: 0.6, class: REDUCED_MOTION ? '' : 'synapse-pulse' }));
      svg.appendChild(svgEl('circle', { cx: tp.ex, cy: tp.ey, r: 3, fill: '#22d3ee', opacity: 0.4 }));
    });

    // Travelling pulse with trail
    if (!REDUCED_MOTION) {
      // Trail (wider, dimmer)
      const trail = svgEl('circle', { r: 10, fill: '#f7c948', opacity: 0 });
      const ta = svgEl('animateMotion', { dur: '2.5s', repeatCount: 'indefinite', begin: '0.08s' });
      ta.appendChild(svgEl('mpath', { href: '#axonMainPath' }));
      trail.appendChild(ta);
      trail.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.15;0.15;0', keyTimes: '0;0.08;0.85;1', dur: '2.5s', repeatCount: 'indefinite' }));
      svg.appendChild(trail);
      // Main pulse
      const pulse = svgEl('circle', { r: 5, fill: '#f7c948', filter: 'url(#nfGlow)', opacity: 0 });
      const pa = svgEl('animateMotion', { dur: '2.5s', repeatCount: 'indefinite', begin: '0s' });
      pa.appendChild(svgEl('mpath', { href: '#axonMainPath' }));
      pulse.appendChild(pa);
      pulse.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.95;0.95;0', keyTimes: '0;0.05;0.88;1', dur: '2.5s', repeatCount: 'indefinite' }));
      svg.appendChild(pulse);
    }

    // Labels with glow backdrops
    const labels = [
      { x: 80, y: 215, text: 'Cell Body (Soma)', color: '#ef6f61' },
      { x: 15, y: 50, text: 'Dendrites', color: '#ef6f61' },
      { x: 148, y: 120, text: 'Axon Hillock', color: '#a8b5c7' },
      { x: 280, y: 120, text: 'Myelin Sheath', color: '#38bdf8' },
      { x: 312, y: 184, text: 'Nodes of Ranvier', color: '#22d3ee' },
      { x: 545, y: 205, text: 'Axon Terminals', color: '#22d3ee' },
    ];
    labels.forEach(l => diagramLabel(svg, l.x, l.y, l.text, { size: 9.5, color: l.color, glow: l.color }));

    // Key principle
    svg.appendChild(svgEl('rect', { x: 100, y: 237, width: 390, height: 22, rx: 11, fill: '#f7c948', opacity: 0.05, stroke: '#f7c948', 'stroke-width': 0.5, 'stroke-opacity': 0.15 }));
    diagramLabel(svg, 295, 252, 'All-or-None: Neuron fires fully or not at all', { size: 10, color: '#f7c948', weight: '700' });

    // Phase badges along bottom
    const phases = [
      { x: 80, label: 'Resting\nPotential', color: '#a8b5c7' },
      { x: 200, label: 'Threshold\nReached', color: '#f7c948' },
      { x: 340, label: 'Action Potential\n(Depolarization)', color: '#ef6f61' },
      { x: 490, label: 'Refractory\nPeriod', color: '#38bdf8' }
    ];
    phases.forEach(p => {
      svg.appendChild(svgEl('circle', { cx: p.x, cy: 280, r: 3, fill: p.color, opacity: 0.5 }));
      p.label.split('\n').forEach((line, i) => {
        const t = svgEl('text', { x: p.x, y: 290 + i * 12, fill: p.color, 'font-size': 8.5, 'font-weight': '600', 'font-family': 'Inter, system-ui, sans-serif', 'text-anchor': 'middle' });
        t.textContent = line;
        svg.appendChild(t);
      });
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Synapse Diagram ──────────────────────────────────────── */
  function createSynapseDiagram(container) {
    if (!container) return;
    const w = 700, h = 400;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const defs = diagramDefs(svg, 'syn');

    // Cleft gradient
    const cleftGrad = svgEl('linearGradient', { id: 'synCleft', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
    cleftGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#38bdf8', 'stop-opacity': '0.06' }));
    cleftGrad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': '#132944', 'stop-opacity': '0.12' }));
    cleftGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#38bdf8', 'stop-opacity': '0.06' }));
    defs.appendChild(cleftGrad);

    diagramTitle(svg, w, 28, 'Synapse & Neurotransmission');

    // Presynaptic terminal
    svg.appendChild(svgEl('rect', { x: 38, y: 60, width: 204, height: 264, rx: 22, fill: '#ef6f61', opacity: 0.03 }));
    svg.appendChild(svgEl('rect', { x: 40, y: 62, width: 200, height: 260, rx: 20, fill: 'none', stroke: '#ef6f61', 'stroke-width': 2, opacity: 0.55 }));
    diagramLabel(svg, 140, 50, 'Presynaptic Neuron', { size: 11, color: '#ef6f61', weight: '700', glow: '#ef6f61' });

    // Vesicles with neurotransmitters
    const vesicles = [
      { x: 100, y: 115 }, { x: 160, y: 130 }, { x: 120, y: 175 },
      { x: 170, y: 195 }, { x: 90, y: 218 }, { x: 150, y: 248 }
    ];
    vesicles.forEach((v, i) => {
      svg.appendChild(svgEl('circle', { cx: v.x, cy: v.y, r: 16, fill: '#f7c948', opacity: 0.04 }));
      svg.appendChild(svgEl('circle', { cx: v.x, cy: v.y, r: 14, fill: 'none', stroke: '#f7c948', 'stroke-width': 1.5, opacity: 0.55 }));
      for (let d = 0; d < 4; d++) {
        const dot = svgEl('circle', { cx: v.x + rand(-5, 5), cy: v.y + rand(-5, 5), r: 2, fill: '#f7c948', opacity: 0.65 });
        if (!REDUCED_MOTION && i < 3) dot.classList.add('synapse-pulse');
        svg.appendChild(dot);
      }
    });
    diagramLabel(svg, 140, 290, 'Synaptic Vesicles', { size: 9, color: '#f7c948', glow: '#f7c948' });

    // Synaptic cleft with gradient fill
    svg.appendChild(svgEl('rect', { x: 260, y: 58, width: 100, height: 266, fill: 'url(#synCleft)' }));
    svg.appendChild(svgEl('line', { x1: 260, y1: 58, x2: 260, y2: 324, stroke: '#38bdf8', 'stroke-width': 1.2, opacity: 0.25, 'stroke-dasharray': '3,5' }));
    svg.appendChild(svgEl('line', { x1: 360, y1: 58, x2: 360, y2: 324, stroke: '#38bdf8', 'stroke-width': 1.2, opacity: 0.25, 'stroke-dasharray': '3,5' }));
    diagramLabel(svg, 310, 50, 'Synaptic Cleft', { size: 11, color: '#38bdf8', weight: '700', glow: '#38bdf8' });

    // Neurotransmitters crossing gap with animated paths
    const ntPositions = [
      { x1: 240, y: 125, x2: 370 }, { x1: 240, y: 165, x2: 370 },
      { x1: 240, y: 205, x2: 370 }, { x1: 240, y: 248, x2: 370 },
      { x1: 240, y: 285, x2: 370 }
    ];
    ntPositions.forEach((nt, i) => {
      // Flight path line
      svg.appendChild(svgEl('line', { x1: nt.x1, y1: nt.y, x2: nt.x2, y2: nt.y, stroke: '#f7c948', 'stroke-width': 0.5, opacity: 0.08, 'stroke-dasharray': '2,4' }));
      // NT dot in cleft
      const cx = 280 + (i % 3) * 25;
      const dot = svgEl('circle', { cx, cy: nt.y, r: 3.5, fill: '#f7c948', opacity: 0.75, filter: 'url(#synSoft)' });
      if (!REDUCED_MOTION) dot.classList.add('synapse-pulse');
      svg.appendChild(dot);
    });

    // Postsynaptic membrane
    svg.appendChild(svgEl('rect', { x: 378, y: 60, width: 204, height: 264, rx: 22, fill: '#22d3ee', opacity: 0.03 }));
    svg.appendChild(svgEl('rect', { x: 380, y: 62, width: 200, height: 260, rx: 20, fill: 'none', stroke: '#22d3ee', 'stroke-width': 2, opacity: 0.55 }));
    diagramLabel(svg, 480, 50, 'Postsynaptic Neuron', { size: 11, color: '#22d3ee', weight: '700', glow: '#22d3ee' });

    // Receptor sites (lock-and-key style)
    const receptors = [
      { y: 125, matched: true }, { y: 175, matched: true },
      { y: 225, matched: false }, { y: 278, matched: true }
    ];
    receptors.forEach(r => {
      const rx = 390;
      // Receptor pocket
      svg.appendChild(svgEl('path', {
        d: `M${rx},${r.y - 12} Q${rx - 10},${r.y} ${rx},${r.y + 12}`,
        fill: 'none', stroke: r.matched ? '#22d3ee' : '#a8b5c7', 'stroke-width': 2.5, opacity: 0.55, 'stroke-linecap': 'round'
      }));
      // Glow behind matched
      if (r.matched) {
        svg.appendChild(svgEl('circle', { cx: rx - 10, cy: r.y, r: 8, fill: '#22d3ee', opacity: 0.06 }));
        svg.appendChild(svgEl('circle', { cx: rx - 14, cy: r.y, r: 3.5, fill: '#f7c948', opacity: 0.75 }));
      } else {
        // Blocked receptor (X mark)
        svg.appendChild(svgEl('line', { x1: rx - 16, y1: r.y - 4, x2: rx - 8, y2: r.y + 4, stroke: '#ef6f61', 'stroke-width': 1.5, opacity: 0.4 }));
        svg.appendChild(svgEl('line', { x1: rx - 16, y1: r.y + 4, x2: rx - 8, y2: r.y - 4, stroke: '#ef6f61', 'stroke-width': 1.5, opacity: 0.4 }));
      }
    });
    diagramLabel(svg, 460, 310, 'Receptor Sites', { size: 9, color: '#22d3ee', glow: '#22d3ee' });

    // Reuptake arrow with animated dash
    const reuptakePath = svgEl('path', {
      d: 'M275,285 C255,310 210,318 190,285', fill: 'none', stroke: '#a78bfa', 'stroke-width': 1.8, opacity: 0.45, 'stroke-dasharray': '4,4', 'stroke-linecap': 'round'
    });
    if (!REDUCED_MOTION) reuptakePath.style.animation = 'labelFlow 2s linear infinite';
    svg.appendChild(reuptakePath);
    svg.appendChild(svgEl('path', { d: 'M194,290 L190,285 L196,283', fill: 'none', stroke: '#a78bfa', 'stroke-width': 1.5, opacity: 0.45 }));
    diagramLabel(svg, 215, 330, 'Reuptake', { size: 9.5, color: '#a78bfa', glow: '#a78bfa' });

    // Key concepts panel
    svg.appendChild(svgEl('rect', { x: 50, y: 350, width: w - 100, height: 26, rx: 13, fill: '#132944', opacity: 0.4, stroke: '#a8b5c7', 'stroke-width': 0.4, 'stroke-opacity': 0.1 }));
    diagramLabel(svg, w / 2, 367, 'Agonist: mimics NT  ·  Antagonist: blocks receptor  ·  Reuptake inhibitor: prevents reabsorption', { size: 9, color: '#a8b5c7' });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Operant Conditioning Quadrant ────────────────────────── */
  function createOperantQuadrant(container) {
    if (!container) return;
    const w = 620, h = 480;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    diagramDefs(svg, 'oq');

    diagramTitle(svg, w, 28, 'Operant Conditioning Quadrant');

    // Axis labels with glow
    const axisLabels = [
      { x: w / 2, y: 60, text: 'ADD Stimulus (+)', color: '#4ade80' },
      { x: w / 2, y: 468, text: 'REMOVE Stimulus (−)', color: '#fb7185' },
      { x: 32, y: 200, text: '↑ Increase', color: '#38bdf8', rotate: -90 },
      { x: 32, y: 365, text: '↓ Decrease', color: '#ef6f61', rotate: -90 }
    ];
    axisLabels.forEach(l => {
      const t = svgEl('text', { x: l.x, y: l.y, fill: l.color, 'font-size': 10, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif', 'letter-spacing': '0.04em' });
      if (l.rotate) t.setAttribute('transform', `rotate(${l.rotate}, ${l.x}, ${l.y})`);
      t.textContent = l.text;
      svg.appendChild(t);
    });

    // Grid cross with glow
    svg.appendChild(svgEl('line', { x1: 55, y1: 270, x2: w - 20, y2: 270, stroke: '#a8b5c7', 'stroke-width': 1.5, opacity: 0.10 }));
    svg.appendChild(svgEl('line', { x1: w / 2, y1: 72, x2: w / 2, y2: 455, stroke: '#a8b5c7', 'stroke-width': 1.5, opacity: 0.10 }));
    // Glowing center node
    svg.appendChild(svgEl('circle', { cx: w / 2, cy: 270, r: 6, fill: '#f7c948', opacity: 0.15 }));
    svg.appendChild(svgEl('circle', { cx: w / 2, cy: 270, r: 2.5, fill: '#f7c948', opacity: 0.5 }));

    const quads = [
      { x: 60, y: 78, w: 240, h: 182, title: 'Positive Reinforcement', icon: '+R', example: 'Giving a treat after good behavior', effect: '▲ Behavior INCREASES', color: '#4ade80' },
      { x: 320, y: 78, w: 240, h: 182, title: 'Negative Reinforcement', icon: '−R', example: 'Removing a loud noise when task is done', effect: '▲ Behavior INCREASES', color: '#38bdf8' },
      { x: 60, y: 280, w: 240, h: 182, title: 'Positive Punishment', icon: '+P', example: 'Adding extra chores after misbehavior', effect: '▼ Behavior DECREASES', color: '#ef6f61' },
      { x: 320, y: 280, w: 240, h: 182, title: 'Negative Punishment', icon: '−P', example: 'Taking away phone privileges', effect: '▼ Behavior DECREASES', color: '#fb7185' }
    ];

    quads.forEach(q => {
      // Multi-layer background
      svg.appendChild(svgEl('rect', { x: q.x, y: q.y, width: q.w, height: q.h, rx: 14, fill: q.color, opacity: 0.04 }));
      svg.appendChild(svgEl('rect', { x: q.x, y: q.y, width: q.w, height: q.h, rx: 14, fill: 'none', stroke: q.color, 'stroke-width': 1.5, opacity: 0.30 }));
      // Top accent glow bar
      svg.appendChild(svgEl('rect', { x: q.x + 20, y: q.y, width: q.w - 40, height: 2, rx: 1, fill: q.color, opacity: 0.4 }));

      // Icon badge
      const badgeX = q.x + q.w - 30, badgeY = q.y + 22;
      svg.appendChild(svgEl('circle', { cx: badgeX, cy: badgeY, r: 14, fill: q.color, opacity: 0.08, stroke: q.color, 'stroke-width': 1, 'stroke-opacity': 0.25 }));
      const iconT = svgEl('text', { x: badgeX, y: badgeY + 4, fill: q.color, 'font-size': 10, 'font-weight': '800', 'text-anchor': 'middle', 'font-family': "'SFMono-Regular', Consolas, monospace" });
      iconT.textContent = q.icon;
      svg.appendChild(iconT);

      // Title
      diagramLabel(svg, q.x + q.w / 2 - 10, q.y + 30, q.title, { size: 12.5, color: q.color, weight: '700' });

      // Divider
      svg.appendChild(svgEl('line', { x1: q.x + 20, y1: q.y + 42, x2: q.x + q.w - 20, y2: q.y + 42, stroke: q.color, 'stroke-width': 0.5, opacity: 0.15 }));

      // Example (wrapped)
      const words = q.example.split(' ');
      let line = '', lineY = q.y + 68;
      words.forEach(word => {
        const test = line + (line ? ' ' : '') + word;
        if (test.length > 32) {
          diagramLabel(svg, q.x + q.w / 2, lineY, line, { size: 10, color: '#a8b5c7', weight: '400' });
          line = word; lineY += 16;
        } else line = test;
      });
      if (line) diagramLabel(svg, q.x + q.w / 2, lineY, line, { size: 10, color: '#a8b5c7', weight: '400' });

      // Arrow icon
      const arrowY = q.y + q.h - 48;
      const isUp = q.effect.includes('INCREASES');
      svg.appendChild(svgEl('path', {
        d: isUp ? `M${q.x + q.w / 2},${arrowY + 8} L${q.x + q.w / 2},${arrowY - 4} M${q.x + q.w / 2 - 5},${arrowY} L${q.x + q.w / 2},${arrowY - 6} L${q.x + q.w / 2 + 5},${arrowY}`
              : `M${q.x + q.w / 2},${arrowY - 4} L${q.x + q.w / 2},${arrowY + 8} M${q.x + q.w / 2 - 5},${arrowY + 4} L${q.x + q.w / 2},${arrowY + 10} L${q.x + q.w / 2 + 5},${arrowY + 4}`,
        fill: 'none', stroke: q.color, 'stroke-width': 2, opacity: 0.5, 'stroke-linecap': 'round'
      }));

      // Effect badge
      svg.appendChild(svgEl('rect', { x: q.x + 30, y: q.y + q.h - 30, width: q.w - 60, height: 20, rx: 10, fill: q.color, opacity: 0.06, stroke: q.color, 'stroke-width': 0.6, 'stroke-opacity': 0.2 }));
      diagramLabel(svg, q.x + q.w / 2, q.y + q.h - 16, q.effect, { size: 9.5, color: q.color, weight: '700', family: "'SFMono-Regular', Consolas, monospace" });
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Normal Distribution Curve ────────────────────────────── */
  function createNormalCurve(container) {
    if (!container) return;
    const w = 620, h = 340;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const defs = diagramDefs(svg, 'nc');

    const cxC = w / 2, baseline = 260, spread = 165;

    // SD region gradients
    const sdGrads = [
      { id: 'ncSD1', color: '#38bdf8', op: 0.12 },
      { id: 'ncSD2', color: '#38bdf8', op: 0.07 },
      { id: 'ncSD3', color: '#38bdf8', op: 0.03 }
    ];
    sdGrads.forEach(g => {
      const rg = svgEl('linearGradient', { id: g.id, x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
      rg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': g.color, 'stop-opacity': g.op }));
      rg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': g.color, 'stop-opacity': '0.01' }));
      defs.appendChild(rg);
    });

    // Curve outline gradient
    const curveGrad = svgEl('linearGradient', { id: 'ncCurveStroke', x1: '0%', x2: '100%' });
    curveGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#a78bfa' }));
    curveGrad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': '#38bdf8' }));
    curveGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#a78bfa' }));
    defs.appendChild(curveGrad);

    diagramTitle(svg, w, 22, 'Normal Distribution (Bell Curve)');

    // Helper to get curve Y
    function curveY(x) { return baseline - Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI) * 560; }
    function curvePx(sd) { return cxC + sd * (spread / 3); }

    // Filled SD regions (back to front)
    const sdRegions = [
      { from: -3, to: 3, fill: 'url(#ncSD3)' },
      { from: -2, to: 2, fill: 'url(#ncSD2)' },
      { from: -1, to: 1, fill: 'url(#ncSD1)' }
    ];
    sdRegions.forEach(r => {
      let d = `M ${curvePx(r.from)} ${baseline}`;
      for (let x = r.from; x <= r.to; x += 0.05) d += ` L${curvePx(x)},${curveY(x)}`;
      d += ` L${curvePx(r.to)} ${baseline} Z`;
      svg.appendChild(svgEl('path', { d, fill: r.fill, stroke: 'none' }));
    });

    // Full curve outline
    let outlineD = '';
    for (let x = -3.2; x <= 3.2; x += 0.04) {
      const px = curvePx(x), py = curveY(x);
      outlineD += (x === -3.2 ? 'M' : ' L') + `${px},${py}`;
    }
    svg.appendChild(svgEl('path', { d: outlineD, fill: 'none', stroke: 'url(#ncCurveStroke)', 'stroke-width': 2.5, opacity: 0.75, 'stroke-linecap': 'round' }));
    // Glow underline
    svg.appendChild(svgEl('path', { d: outlineD, fill: 'none', stroke: '#38bdf8', 'stroke-width': 6, opacity: 0.06 }));

    // Axis
    svg.appendChild(svgEl('line', { x1: curvePx(-3.2), y1: baseline, x2: curvePx(3.2), y2: baseline, stroke: '#a8b5c7', 'stroke-width': 1, opacity: 0.20 }));

    // SD lines and labels
    [-3, -2, -1, 0, 1, 2, 3].forEach(sd => {
      const x = curvePx(sd);
      const topY = curveY(sd);
      svg.appendChild(svgEl('line', { x1: x, y1: baseline, x2: x, y2: topY, stroke: '#38bdf8', 'stroke-width': sd === 0 ? 1.5 : 0.8, opacity: sd === 0 ? 0.5 : 0.20, 'stroke-dasharray': sd === 0 ? '' : '3,4' }));
      // Dot at curve intersection
      if (Math.abs(sd) <= 2) svg.appendChild(svgEl('circle', { cx: x, cy: topY, r: 3, fill: '#38bdf8', opacity: 0.6 }));
      const label = svgEl('text', { x, y: baseline + 16, fill: sd === 0 ? '#38bdf8' : '#a8b5c7', 'font-size': sd === 0 ? 12 : 10, 'font-weight': sd === 0 ? '700' : '600', 'font-family': "'SFMono-Regular', Consolas, monospace", 'text-anchor': 'middle' });
      label.textContent = sd === 0 ? 'μ' : `${sd > 0 ? '+' : ''}${sd}σ`;
      svg.appendChild(label);
    });

    // Mean marker
    svg.appendChild(svgEl('circle', { cx: cxC, cy: curveY(0) - 2, r: 4, fill: '#f7c948', opacity: 0.6, filter: 'url(#ncSoft)' }));

    // Percentages with background badges
    const pcts = [
      { sd: -0.5, y: baseline - 85, text: '34.1%' }, { sd: 0.5, y: baseline - 85, text: '34.1%' },
      { sd: -1.5, y: baseline - 42, text: '13.6%' }, { sd: 1.5, y: baseline - 42, text: '13.6%' },
      { sd: -2.5, y: baseline - 18, text: '2.1%' }, { sd: 2.5, y: baseline - 18, text: '2.1%' }
    ];
    pcts.forEach(p => {
      const px = curvePx(p.sd);
      svg.appendChild(svgEl('rect', { x: px - 18, y: p.y - 9, width: 36, height: 15, rx: 7.5, fill: '#38bdf8', opacity: 0.06, stroke: '#38bdf8', 'stroke-width': 0.4, 'stroke-opacity': 0.15 }));
      diagramLabel(svg, px, p.y + 2, p.text, { size: 9.5, color: '#d4deeb', weight: '700' });
    });

    // Bottom info badges
    svg.appendChild(svgEl('rect', { x: cxC - 155, y: baseline + 30, width: 310, height: 18, rx: 9, fill: '#132944', opacity: 0.5 }));
    diagramLabel(svg, cxC, baseline + 42, 'Mean = Median = Mode', { size: 9.5, color: '#a8b5c7' });

    // Empirical rule badges
    const rules = [
      { pct: '68%', sd: '±1σ', color: '#38bdf8' },
      { pct: '95%', sd: '±2σ', color: '#a78bfa' },
      { pct: '99.7%', sd: '±3σ', color: '#22d3ee' }
    ];
    rules.forEach((r, i) => {
      const rx = cxC - 130 + i * 130;
      svg.appendChild(svgEl('rect', { x: rx - 50, y: baseline + 54, width: 100, height: 20, rx: 10, fill: r.color, opacity: 0.06, stroke: r.color, 'stroke-width': 0.5, 'stroke-opacity': 0.2 }));
      diagramLabel(svg, rx, baseline + 68, `${r.pct} within ${r.sd}`, { size: 9, color: r.color, weight: '600' });
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Classical Conditioning Diagram ───────────────────────── */
  function createClassicalConditioning(container) {
    if (!container) return;
    const w = 700, h = 400;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    diagramDefs(svg, 'cc');

    diagramTitle(svg, w, 25, 'Classical Conditioning Process');

    // Vertical timeline line
    svg.appendChild(svgEl('line', { x1: 18, y1: 52, x2: 18, y2: 335, stroke: '#ef6f61', 'stroke-width': 1.5, opacity: 0.12 }));

    const phases = [
      { y: 55, label: 'BEFORE CONDITIONING', color: '#a8b5c7', items: [
        { x: 100, top: 'UCS (Food)', bottom: 'UCR (Salivation)', topColor: '#ef6f61', botColor: '#f08a7d' },
        { x: 420, top: 'NS (Bell)', bottom: 'No Response', topColor: '#a8b5c7', botColor: '#a8b5c7' }
      ]},
      { y: 160, label: 'DURING (Acquisition)', color: '#38bdf8', items: [
        { x: 190, top: 'NS (Bell) + UCS (Food)', bottom: 'UCR (Salivation)', topColor: '#38bdf8', botColor: '#f08a7d' }
      ]},
      { y: 265, label: 'AFTER CONDITIONING', color: '#4ade80', items: [
        { x: 190, top: 'CS (Bell)', bottom: 'CR (Salivation)', topColor: '#22d3ee', botColor: '#4ade80' }
      ]}
    ];

    phases.forEach((phase, pi) => {
      // Timeline node
      svg.appendChild(svgEl('circle', { cx: 18, cy: phase.y + 3, r: 5, fill: phase.color, opacity: 0.15, stroke: phase.color, 'stroke-width': 1.2, 'stroke-opacity': 0.4 }));
      svg.appendChild(svgEl('circle', { cx: 18, cy: phase.y + 3, r: 2, fill: phase.color, opacity: 0.6 }));

      // Phase label
      const lbl = svgEl('text', { x: 32, y: phase.y + 6, fill: phase.color, 'font-size': 9, 'font-weight': '700', 'letter-spacing': '0.1em', 'font-family': 'Inter, system-ui, sans-serif' });
      lbl.textContent = phase.label;
      svg.appendChild(lbl);
      svg.appendChild(svgEl('line', { x1: 32, y1: phase.y + 12, x2: w - 20, y2: phase.y + 12, stroke: phase.color, 'stroke-width': 0.5, opacity: 0.10 }));

      phase.items.forEach(item => {
        const by = phase.y + 36;

        // Source box with glow
        svg.appendChild(svgEl('rect', { x: item.x - 85, y: by - 14, width: 170, height: 30, rx: 8, fill: item.topColor, opacity: 0.06 }));
        svg.appendChild(svgEl('rect', { x: item.x - 85, y: by - 14, width: 170, height: 30, rx: 8, fill: 'none', stroke: item.topColor, 'stroke-width': 1.2, opacity: 0.35 }));
        diagramLabel(svg, item.x, by + 5, item.top, { size: 11.5, color: item.topColor, weight: '600' });

        // Animated arrow
        const arrowX1 = item.x + 92, arrowX2 = item.x + 128;
        svg.appendChild(svgEl('line', { x1: arrowX1, y1: by, x2: arrowX2, y2: by, stroke: '#f7c948', 'stroke-width': 2, opacity: 0.25 }));
        svg.appendChild(svgEl('path', { d: `M${arrowX2 - 6},${by - 5} L${arrowX2 + 2},${by} L${arrowX2 - 6},${by + 5}`, fill: 'none', stroke: '#f7c948', 'stroke-width': 2, opacity: 0.4 }));
        // Glowing energy dot on arrow
        if (!REDUCED_MOTION) {
          const eDot = svgEl('circle', { cx: arrowX1, cy: by, r: 2.5, fill: '#f7c948', opacity: 0.7, class: 'synapse-pulse' });
          eDot.style.animationDelay = `${pi * 0.8}s`;
          svg.appendChild(eDot);
        }

        // Result box
        svg.appendChild(svgEl('rect', { x: item.x + 135, y: by - 14, width: 170, height: 30, rx: 8, fill: item.botColor, opacity: 0.06 }));
        svg.appendChild(svgEl('rect', { x: item.x + 135, y: by - 14, width: 170, height: 30, rx: 8, fill: 'none', stroke: item.botColor, 'stroke-width': 1.2, opacity: 0.35 }));
        diagramLabel(svg, item.x + 220, by + 5, item.bottom, { size: 11.5, color: item.botColor, weight: '600' });
      });
    });

    // Key principles panel
    svg.appendChild(svgEl('rect', { x: 30, y: 340, width: w - 60, height: 46, rx: 10, fill: '#132944', opacity: 0.4, stroke: '#a8b5c7', 'stroke-width': 0.4, 'stroke-opacity': 0.1 }));
    svg.appendChild(svgEl('circle', { cx: 48, cy: 354, r: 3, fill: '#f7c948', opacity: 0.5 }));
    diagramLabel(svg, 60, 357, 'CS must come BEFORE UCS for successful acquisition.', { size: 9.5, color: '#a8b5c7', anchor: 'start' });
    svg.appendChild(svgEl('circle', { cx: 48, cy: 372, r: 3, fill: '#22d3ee', opacity: 0.5 }));
    diagramLabel(svg, 60, 375, 'Spontaneous recovery applies to both classical and operant conditioning.', { size: 9.5, color: '#a8b5c7', anchor: 'start' });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Multi-Store Memory Model Diagram ─────────────────────── */
  function createMemoryModel(container) {
    if (!container) return;
    const w = 700, h = 300;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });

    const font = "'Inter', system-ui, sans-serif";
    const serif = "Georgia, serif";

    const title = svgEl('text', { x: w / 2, y: 28, fill: '#f4f7fb', 'font-size': 15, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': serif });
    title.textContent = 'Multi-Store Memory Model';
    svg.appendChild(title);

    const stores = [
      { x: 90, y: 100, w: 130, label: 'Sensory\nMemory', sub: 'Iconic / Echoic', color: '#a78bfa', duration: '< 1 sec' },
      { x: 300, y: 100, w: 140, label: 'Short-Term /\nWorking Memory', sub: 'Phonological loop\nVisuospatial sketchpad', color: '#38bdf8', duration: '~20 sec' },
      { x: 530, y: 100, w: 130, label: 'Long-Term\nMemory', sub: 'Unlimited capacity', color: '#4ade80', duration: 'Permanent' }
    ];

    stores.forEach(s => {
      svg.appendChild(svgEl('rect', { x: s.x - s.w / 2, y: s.y - 35, width: s.w, height: 70, rx: 10, fill: s.color, opacity: 0.06, stroke: s.color, 'stroke-width': 1.5, 'stroke-opacity': 0.4 }));
      const lines = s.label.split('\n');
      lines.forEach((line, i) => {
        const t = svgEl('text', { x: s.x, y: s.y - 8 + i * 16, fill: s.color, 'font-size': 13, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': font });
        t.textContent = line;
        svg.appendChild(t);
      });
      // Duration
      const dur = svgEl('text', { x: s.x, y: s.y + 50, fill: s.color, 'font-size': 9, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': "'SFMono-Regular', Consolas, monospace", opacity: 0.6 });
      dur.textContent = s.duration;
      svg.appendChild(dur);
      // Sub details
      if (s.sub) {
        const subLines = s.sub.split('\n');
        subLines.forEach((sl, i) => {
          const st = svgEl('text', { x: s.x, y: s.y + 65 + i * 13, fill: '#a8b5c7', 'font-size': 9, 'text-anchor': 'middle', 'font-family': font, opacity: 0.6 });
          st.textContent = sl;
          svg.appendChild(st);
        });
      }
    });

    // Arrows between stores
    const arrows = [
      { x1: 155, x2: 230, y: 100, label: 'Attention', color: '#a78bfa' },
      { x1: 370, x2: 465, y: 100, label: 'Encoding', color: '#38bdf8' }
    ];
    arrows.forEach(a => {
      svg.appendChild(svgEl('line', { x1: a.x1, y1: a.y, x2: a.x2, y2: a.y, stroke: a.color, 'stroke-width': 2, opacity: 0.4 }));
      svg.appendChild(svgEl('path', { d: `M${a.x2 - 6},${a.y - 5} L${a.x2},${a.y} L${a.x2 - 6},${a.y + 5}`, fill: 'none', stroke: a.color, 'stroke-width': 2, opacity: 0.4 }));
      const lbl = svgEl('text', { x: (a.x1 + a.x2) / 2, y: a.y - 10, fill: a.color, 'font-size': 9, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': font, opacity: 0.7 });
      lbl.textContent = a.label;
      svg.appendChild(lbl);
    });

    // Retrieval arrow (curved, going back)
    svg.appendChild(svgEl('path', {
      d: 'M465 130 Q400 180 370 130', fill: 'none', stroke: '#22d3ee', 'stroke-width': 1.5, opacity: 0.3, 'stroke-dasharray': '4,3'
    }));
    const retLabel = svgEl('text', { x: 415, y: 175, fill: '#22d3ee', 'font-size': 9, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': font, opacity: 0.5 });
    retLabel.textContent = 'Retrieval';
    svg.appendChild(retLabel);

    // Forgetting arrows (downward)
    [90, 300].forEach(x => {
      svg.appendChild(svgEl('line', { x1: x, y1: 135, x2: x, y2: 165, stroke: '#ef6f61', 'stroke-width': 1, opacity: 0.25 }));
      const f = svgEl('text', { x: x, y: 178, fill: '#ef6f61', 'font-size': 8, 'text-anchor': 'middle', 'font-family': font, opacity: 0.4 });
      f.textContent = 'Forgotten';
      svg.appendChild(f);
    });

    // Bottom note
    const note = svgEl('text', { x: w / 2, y: 260, fill: '#a8b5c7', 'font-size': 10, 'text-anchor': 'middle', 'font-family': font });
    note.textContent = 'Information must pass through each stage to be encoded correctly.';
    svg.appendChild(note);
    const note2 = svgEl('text', { x: w / 2, y: 278, fill: '#a8b5c7', 'font-size': 10, 'text-anchor': 'middle', 'font-family': font });
    note2.textContent = 'Automatic processing happens without effort; effortful processing requires conscious attention.';
    svg.appendChild(note2);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Brain Region Map ──────────────────────────────────────── */
  function createBrainRegionMap(container) {
    if (!container) return;
    const w = 700, h = 420;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const font = "'Inter', system-ui, sans-serif";

    // Brain outline
    const outline = 'M350 40 C250 40 170 70 140 130 C110 190 115 230 120 270 C125 310 105 350 130 380 C155 410 200 430 260 435 C320 440 360 435 400 420 C440 405 480 380 510 340 C540 300 555 260 545 210 C535 160 510 110 460 70 C430 50 390 40 350 40Z';
    svg.appendChild(svgEl('path', { d: outline, fill: 'none', stroke: '#a8b5c7', 'stroke-width': 1.5, opacity: 0.3 }));

    const regions = [
      { path: 'M200 80 Q250 70 300 75 Q310 120 280 170 Q230 190 180 170 Q150 130 170 90Z', color: '#ef6f61', name: 'Frontal Lobe', x: 140, y: 60, desc: 'Planning, personality,\nspeech production (Broca\'s)' },
      { path: 'M310 70 Q380 60 430 80 Q460 120 440 170 Q400 190 350 180 Q310 150 310 110Z', color: '#38bdf8', name: 'Parietal Lobe', x: 420, y: 55, desc: 'Somatosensory,\nspatial awareness' },
      { path: 'M150 200 Q170 180 220 190 Q250 220 240 270 Q220 310 180 320 Q140 310 125 280 Q115 240 130 210Z', color: '#a78bfa', name: 'Temporal Lobe', x: 90, y: 310, desc: 'Auditory, memory,\nWernicke\'s area' },
      { path: 'M460 170 Q500 190 530 230 Q545 270 530 310 Q500 340 470 330 Q440 300 440 250 Q445 200 460 170Z', color: '#22d3ee', name: 'Occipital Lobe', x: 530, y: 200, desc: 'Visual processing' },
      { path: 'M380 350 Q420 370 440 400 Q420 430 380 430 Q340 425 320 400 Q330 370 360 355Z', color: '#4ade80', name: 'Cerebellum', x: 450, y: 390, desc: 'Balance, coordination,\nprocedural learning' },
      { path: 'M260 350 Q280 370 300 390 Q290 415 260 420 Q230 415 220 390 Q230 370 250 355Z', color: '#f59e0b', name: 'Brain Stem', x: 180, y: 400, desc: 'Breathing, heart rate,\nbasic life functions' },
    ];

    regions.forEach(r => {
      svg.appendChild(svgEl('path', { d: r.path, fill: r.color, opacity: 0.08, stroke: r.color, 'stroke-width': 1.5, 'stroke-opacity': 0.4 }));
      const lines = r.name.split('\n');
      const t = svgEl('text', { x: r.x, y: r.y, fill: r.color, 'font-size': 11, 'font-weight': '700', 'font-family': font });
      t.textContent = r.name;
      svg.appendChild(t);
      if (r.desc) {
        r.desc.split('\n').forEach((line, i) => {
          const d = svgEl('text', { x: r.x, y: r.y + 14 + i * 12, fill: '#a8b5c7', 'font-size': 9, 'font-family': font, opacity: 0.7 });
          d.textContent = line;
          svg.appendChild(d);
        });
      }
    });

    // Limbic system label (central)
    svg.appendChild(svgEl('ellipse', { cx: 310, cy: 250, rx: 50, ry: 35, fill: '#ef6f61', opacity: 0.05, stroke: '#ef6f61', 'stroke-width': 1, 'stroke-opacity': 0.3, 'stroke-dasharray': '4,3' }));
    const lt = svgEl('text', { x: 310, y: 248, fill: '#ef6f61', 'font-size': 10, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': font, opacity: 0.7 });
    lt.textContent = 'LIMBIC SYSTEM';
    svg.appendChild(lt);
    const ls = svgEl('text', { x: 310, y: 262, fill: '#a8b5c7', 'font-size': 8, 'text-anchor': 'middle', 'font-family': font, opacity: 0.5 });
    ls.textContent = 'Thalamus · Hypothalamus · Hippocampus · Amygdala';
    svg.appendChild(ls);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Sleep Cycle Graph ───────────────────────────────────── */
  function createSleepCycleGraph(container) {
    if (!container) return;
    const w = 700, h = 350;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const font = "'Inter', system-ui, sans-serif";
    const mono = "'SFMono-Regular', Consolas, monospace";

    const title = svgEl('text', { x: w / 2, y: 25, fill: '#f4f7fb', 'font-size': 14, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': 'Georgia, serif' });
    title.textContent = 'Sleep Cycle Stages Across a Night';
    svg.appendChild(title);

    // Y-axis: stages
    const stages = ['Awake', 'REM', 'Stage 1', 'Stage 2', 'Stage 3'];
    const yPositions = [55, 95, 140, 190, 250];
    stages.forEach((s, i) => {
      const t = svgEl('text', { x: 58, y: yPositions[i] + 4, fill: i === 1 ? '#ef6f61' : '#a8b5c7', 'font-size': 9, 'font-weight': '600', 'text-anchor': 'end', 'font-family': font });
      t.textContent = s;
      svg.appendChild(t);
      svg.appendChild(svgEl('line', { x1: 65, y1: yPositions[i], x2: 670, y2: yPositions[i], stroke: '#a8b5c7', 'stroke-width': 0.5, opacity: 0.1 }));
    });

    // X-axis: hours
    for (let h2 = 0; h2 <= 8; h2++) {
      const x = 65 + h2 * 75.6;
      const t = svgEl('text', { x, y: 280, fill: '#a8b5c7', 'font-size': 8, 'text-anchor': 'middle', 'font-family': mono });
      t.textContent = h2 + 'h';
      svg.appendChild(t);
    }

    // Sleep cycle path (5 cycles, REM gets longer)
    const cycleData = [
      { x: 65, y: 55 },   // awake
      { x: 90, y: 140 },  // stage 1
      { x: 120, y: 190 }, // stage 2
      { x: 160, y: 250 }, // stage 3
      { x: 190, y: 190 }, // back to 2
      { x: 210, y: 95 },  // REM (short)
      { x: 230, y: 140 }, // stage 1
      { x: 260, y: 190 }, // stage 2
      { x: 300, y: 250 }, // stage 3
      { x: 330, y: 190 }, // back to 2
      { x: 360, y: 95 },  // REM (medium)
      { x: 395, y: 140 }, // stage 1
      { x: 420, y: 190 }, // stage 2
      { x: 445, y: 240 }, // stage 3 (shallower)
      { x: 465, y: 190 }, // back to 2
      { x: 505, y: 95 },  // REM (longer)
      { x: 540, y: 140 }, // stage 1
      { x: 560, y: 190 }, // stage 2
      { x: 580, y: 190 }, // stays in 2
      { x: 620, y: 95 },  // REM (longest)
      { x: 660, y: 55 },  // wake
    ];

    let pathD = `M${cycleData[0].x},${cycleData[0].y}`;
    for (let i = 1; i < cycleData.length; i++) {
      const p = cycleData[i - 1], c = cycleData[i];
      pathD += ` C${p.x + 15},${p.y} ${c.x - 15},${c.y} ${c.x},${c.y}`;
    }
    svg.appendChild(svgEl('path', { d: pathD, fill: 'none', stroke: '#38bdf8', 'stroke-width': 2.5, opacity: 0.7 }));

    // REM highlights
    const remRanges = [[200, 230], [345, 395], [485, 540], [600, 660]];
    remRanges.forEach((r, i) => {
      svg.appendChild(svgEl('rect', { x: r[0], y: 82, width: r[1] - r[0], height: 26, rx: 4, fill: '#ef6f61', opacity: 0.08 + i * 0.03 }));
    });

    // Labels
    const labels = [
      { x: 100, y: 300, text: 'Hypnagogic sensations (Stage 1)', color: '#a78bfa' },
      { x: 350, y: 310, text: 'REM periods get LONGER through the night →', color: '#ef6f61' },
      { x: 500, y: 330, text: 'REM rebound: compensates for REM deprivation', color: '#f7c948' },
    ];
    labels.forEach(l => {
      const t = svgEl('text', { x: l.x, y: l.y, fill: l.color, 'font-size': 9, 'font-weight': '600', 'font-family': font });
      t.textContent = l.text;
      svg.appendChild(t);
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Erikson's 8 Stages ──────────────────────────────────── */
  function createEriksonStages(container) {
    if (!container) return;
    const w = 700, h = 520;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const font = "'Inter', system-ui, sans-serif";

    const title = svgEl('text', { x: w / 2, y: 25, fill: '#f4f7fb', 'font-size': 14, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': 'Georgia, serif' });
    title.textContent = "Erikson's 8 Psychosocial Stages";
    svg.appendChild(title);

    const stageData = [
      { conflict: 'Trust vs Mistrust', age: 'Infancy', q: 'Can I trust the world?', color: '#ef6f61' },
      { conflict: 'Autonomy vs Shame', age: 'Toddler', q: 'Can I do things myself?', color: '#f08a7d' },
      { conflict: 'Initiative vs Guilt', age: 'Preschool', q: 'Is it okay for me to act?', color: '#f7c948' },
      { conflict: 'Industry vs Inferiority', age: 'School Age', q: 'Am I competent?', color: '#4ade80' },
      { conflict: 'Identity vs Role Confusion', age: 'Adolescence', q: 'Who am I?', color: '#38bdf8' },
      { conflict: 'Intimacy vs Isolation', age: 'Young Adult', q: 'Can I love and be loved?', color: '#a78bfa' },
      { conflict: 'Generativity vs Stagnation', age: 'Middle Adult', q: 'Am I contributing?', color: '#22d3ee' },
      { conflict: 'Integrity vs Despair', age: 'Late Adult', q: 'Was my life meaningful?', color: '#fb7185' },
    ];

    const startY = 50;
    const rowH = 56;

    stageData.forEach((s, i) => {
      const y = startY + i * rowH;
      // Connecting line to next
      if (i < stageData.length - 1) {
        svg.appendChild(svgEl('line', { x1: 40, y1: y + 40, x2: 40, y2: y + rowH, stroke: s.color, 'stroke-width': 2, opacity: 0.25 }));
      }
      // Stage number circle
      svg.appendChild(svgEl('circle', { cx: 40, cy: y + 20, r: 14, fill: s.color, opacity: 0.1, stroke: s.color, 'stroke-width': 1.5, 'stroke-opacity': 0.5 }));
      const num = svgEl('text', { x: 40, y: y + 24, fill: s.color, 'font-size': 11, 'font-weight': '800', 'text-anchor': 'middle', 'font-family': font });
      num.textContent = i + 1;
      svg.appendChild(num);
      // Age badge
      svg.appendChild(svgEl('rect', { x: 65, y: y + 8, width: 80, height: 22, rx: 4, fill: s.color, opacity: 0.08, stroke: s.color, 'stroke-width': 0.8, 'stroke-opacity': 0.3 }));
      const age = svgEl('text', { x: 105, y: y + 23, fill: s.color, 'font-size': 9, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': font });
      age.textContent = s.age;
      svg.appendChild(age);
      // Conflict name
      const conflict = svgEl('text', { x: 160, y: y + 23, fill: '#f4f7fb', 'font-size': 13, 'font-weight': '700', 'font-family': font });
      conflict.textContent = s.conflict;
      svg.appendChild(conflict);
      // Question
      const q = svgEl('text', { x: 160, y: y + 40, fill: '#a8b5c7', 'font-size': 10, 'font-style': 'italic', 'font-family': font, opacity: 0.7 });
      q.textContent = '"' + s.q + '"';
      svg.appendChild(q);
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Research Design Decision Tree ───────────────────────── */
  function createResearchDesignTree(container) {
    if (!container) return;
    const w = 700, h = 400;
    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%' });
    const font = "'Inter', system-ui, sans-serif";

    const title = svgEl('text', { x: w / 2, y: 25, fill: '#f4f7fb', 'font-size': 14, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': 'Georgia, serif' });
    title.textContent = 'Research Design Decision Tree';
    svg.appendChild(title);

    function box(x, y, w2, h2, text, color, sub) {
      svg.appendChild(svgEl('rect', { x: x - w2 / 2, y: y - h2 / 2, width: w2, height: h2, rx: 8, fill: color, opacity: 0.08, stroke: color, 'stroke-width': 1.5, 'stroke-opacity': 0.5 }));
      const t = svgEl('text', { x, y: y + (sub ? -4 : 4), fill: color, 'font-size': 11, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': font });
      t.textContent = text;
      svg.appendChild(t);
      if (sub) {
        const s = svgEl('text', { x, y: y + 10, fill: '#a8b5c7', 'font-size': 8, 'text-anchor': 'middle', 'font-family': font, opacity: 0.6 });
        s.textContent = sub;
        svg.appendChild(s);
      }
    }

    function arrow(x1, y1, x2, y2, label, color) {
      svg.appendChild(svgEl('line', { x1, y1, x2, y2, stroke: color || '#a8b5c7', 'stroke-width': 1.5, opacity: 0.4 }));
      svg.appendChild(svgEl('circle', { cx: x2, cy: y2, r: 3, fill: color || '#a8b5c7', opacity: 0.4 }));
      if (label) {
        const t = svgEl('text', { x: (x1 + x2) / 2 + 8, y: (y1 + y2) / 2 - 4, fill: color || '#a8b5c7', 'font-size': 9, 'font-weight': '600', 'font-family': font, opacity: 0.6 });
        t.textContent = label;
        svg.appendChild(t);
      }
    }

    // Root question
    box(350, 65, 260, 40, 'Can you manipulate a variable?', '#38bdf8');

    // YES branch
    arrow(350, 85, 180, 140, 'YES', '#4ade80');
    box(180, 155, 180, 44, 'Experiment', '#4ade80', 'IV, DV, random assignment, control');

    // Causation badge
    svg.appendChild(svgEl('rect', { x: 110, y: 190, width: 140, height: 20, rx: 10, fill: '#4ade80', opacity: 0.1, stroke: '#4ade80', 'stroke-width': 0.8, 'stroke-opacity': 0.3 }));
    const cause = svgEl('text', { x: 180, y: 204, fill: '#4ade80', 'font-size': 8, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': font });
    cause.textContent = 'CAN establish cause & effect';
    svg.appendChild(cause);

    // NO branch
    arrow(350, 85, 500, 140, 'NO', '#ef6f61');
    box(500, 155, 200, 36, 'Non-Experimental Method', '#ef6f61');

    // No causation badge
    svg.appendChild(svgEl('rect', { x: 430, y: 185, width: 140, height: 20, rx: 10, fill: '#ef6f61', opacity: 0.1, stroke: '#ef6f61', 'stroke-width': 0.8, 'stroke-opacity': 0.3 }));
    const noCause = svgEl('text', { x: 500, y: 199, fill: '#ef6f61', 'font-size': 8, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': font });
    noCause.textContent = 'CANNOT establish causation';
    svg.appendChild(noCause);

    // Non-experimental methods
    const methods = [
      { x: 350, y: 270, name: 'Case Study', desc: 'In-depth, single individual', color: '#a78bfa' },
      { x: 500, y: 270, name: 'Correlational', desc: 'Relationship, no manipulation', color: '#38bdf8' },
      { x: 650, y: 270, name: 'Naturalistic', desc: 'Observe in natural setting', color: '#22d3ee' },
      { x: 500, y: 350, name: 'Meta-Analysis', desc: 'Combine multiple studies', color: '#f7c948' },
    ];

    arrow(500, 173, 350, 250, '', '#a8b5c7');
    arrow(500, 173, 500, 250, '', '#a8b5c7');
    arrow(500, 173, 650, 250, '', '#a8b5c7');
    arrow(500, 173, 500, 330, '', '#a8b5c7');

    methods.forEach(m => {
      box(m.x, m.y, 130, 40, m.name, m.color, m.desc);
    });

    // Third variable warning
    const warn = svgEl('text', { x: 500, y: 310, fill: '#ef6f61', 'font-size': 8, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': font, opacity: 0.6 });
    warn.textContent = 'Correlation ≠ Causation (third variable problem)';
    svg.appendChild(warn);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ═══════════════════════════════════════════════════════════
     HERO BRAIN VISUAL — 4-Layer Depth Parallax System
     Layer 0: botanical/vine network (deepest)
     Layer 1: brain silhouette + region zones
     Layer 2: neurons + axons + dendrites (rich network)
     Layer 3: synapse pulses + concept labels (closest)
     ═══════════════════════════════════════════════════════════ */
  function createHeroBrainVisual(container) {
    if (!container) return;
    container.innerHTML = '';

    const w = 520, h = 520;
    const vb = `0 0 ${w} ${h}`;
    const uid = 'hb' + (Date.now() % 1e5) + '_';
    const $id = name => uid + name;
    const $url = name => `url(#${uid}${name})`;

    const rng = seededRng(42);
    const sRand = (min, max) => rng() * (max - min) + min;
    const sRandInt = (min, max) => Math.floor(sRand(min, max + 1));
    const sRandom = () => rng();

    function makeLayer(cls) {
      const div = document.createElement('div');
      div.className = 'hero-depth-layer ' + cls;
      const s = svgEl('svg', { viewBox: vb, width: '100%', height: '100%', 'aria-hidden': 'true' });
      div.appendChild(s);
      container.appendChild(div);
      return s;
    }

    function buildFilter(id, stdDev, opts) {
      const f = svgEl('filter', { id, x: opts.x || '-50%', y: opts.y || '-50%', width: opts.w || '200%', height: opts.h || '200%' });
      const blur = svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: stdDev, result: 'blur' });
      f.appendChild(blur);
      if (opts.colorMatrix) {
        f.appendChild(svgEl('feColorMatrix', { in: 'blur', type: 'matrix', values: opts.colorMatrix, result: 'colorBlur' }));
        const m = svgEl('feMerge');
        m.appendChild(svgEl('feMergeNode', { in: 'colorBlur' }));
        m.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
        f.appendChild(m);
      } else {
        const m = svgEl('feMerge');
        m.appendChild(svgEl('feMergeNode', { in: 'blur' }));
        m.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
        f.appendChild(m);
      }
      return f;
    }

    function buildRadial(id, cx, cy, r, stops) {
      const g = svgEl('radialGradient', { id, cx, cy, r });
      stops.forEach(s => g.appendChild(svgEl('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] })));
      return g;
    }

    // Populated by psyche_animations.js initParticles() for floating dust particles
    const particleDiv = document.createElement('div');
    particleDiv.className = 'particle-layer';
    container.appendChild(particleDiv);

    /* ── LAYER 0: Botanical/vine network (deepest) ─────── */
    const L0 = makeLayer('layer-botanical');
    const L0defs = svgEl('defs');
    L0defs.appendChild(buildRadial($id('brainCoreGlow'), '50%', '42%', '42%', [
      ['0%', '#ef6f61', '0.22'], ['35%', '#ef6f61', '0.10'],
      ['70%', '#b83246', '0.04'], ['100%', '#b83246', '0']
    ]));
    L0.appendChild(L0defs);
    L0.appendChild(svgEl('circle', { cx: 260, cy: 230, r: 220, fill: $url('brainCoreGlow') }));
    const vineGroup = svgEl('g', { opacity: '0.12' });
    const vines = [
      'M80 480 Q120 400 140 320 Q160 240 180 200 Q200 160 220 140',
      'M440 480 Q400 380 370 300 Q340 220 320 180 Q300 140 280 120',
      'M60 300 Q100 280 140 260 Q180 240 200 220',
      'M460 320 Q420 290 380 260 Q340 230 310 200',
      'M160 480 Q180 420 200 360 Q210 300 220 260',
      'M360 480 Q340 400 320 340 Q310 280 290 240',
      'M100 180 Q130 160 160 140 Q180 130 190 120',
      'M420 200 Q390 170 360 150 Q340 130 320 110',
      'M50 400 Q90 360 120 310 Q140 270 155 240',
      'M470 400 Q430 350 400 300 Q380 260 360 230',
      'M30 220 Q60 210 90 200 Q120 188 145 175',
      'M490 250 Q460 240 430 225 Q400 210 375 195',
    ];
    vines.forEach(d => {
      vineGroup.appendChild(svgEl('path', { d, fill: 'none', stroke: '#ef6f61', 'stroke-width': sRand(0.6, 1.4), 'stroke-linecap': 'round' }));
      const pts = d.match(/\d+/g).map(Number);
      const ex = pts[pts.length - 2] + sRand(-30, 30);
      const ey = pts[pts.length - 1] + sRand(-30, 30);
      vineGroup.appendChild(svgEl('path', {
        d: `M${pts[pts.length - 2]},${pts[pts.length - 1]} Q${ex + sRand(-15, 15)},${ey + sRand(-15, 15)} ${ex},${ey}`,
        fill: 'none', stroke: '#ef6f61', 'stroke-width': sRand(0.3, 0.8), 'stroke-linecap': 'round', opacity: 0.6
      }));
      if (sRandom() > 0.4) {
        const mx = ex + sRand(-18, 18);
        const my = ey + sRand(-18, 18);
        vineGroup.appendChild(svgEl('path', {
          d: `M${ex},${ey} L${mx},${my}`,
          fill: 'none', stroke: '#ef6f61', 'stroke-width': sRand(0.2, 0.5), 'stroke-linecap': 'round', opacity: 0.35
        }));
      }
    });
    L0.appendChild(vineGroup);

    /* ── LAYER 1: Brain silhouette + region zones ──────── */
    const L1 = makeLayer('layer-brain');
    const L1defs = svgEl('defs');
    L1defs.appendChild(buildRadial($id('brainFillGrad'), '48%', '42%', '50%', [
      ['0%', '#ef6f61', '0.08'], ['40%', '#ef6f61', '0.04'], ['100%', '#071426', '0.01']
    ]));
    L1defs.appendChild(buildFilter($id('glowCoral'), '4', {
      colorMatrix: '1 0 0 0 0.2  0 0.3 0 0 0  0 0 0.2 0 0  0 0 0 1 0'
    }));
    L1defs.appendChild(buildRadial($id('regionFrontal'), '40%', '35%', '55%', [
      ['0%', '#ef6f61', '0.12'], ['100%', '#ef6f61', '0']
    ]));
    L1defs.appendChild(buildRadial($id('regionParietal'), '55%', '30%', '50%', [
      ['0%', '#38bdf8', '0.10'], ['100%', '#38bdf8', '0']
    ]));
    L1defs.appendChild(buildRadial($id('regionTemporal'), '30%', '65%', '50%', [
      ['0%', '#22d3ee', '0.10'], ['100%', '#22d3ee', '0']
    ]));
    L1defs.appendChild(buildRadial($id('regionOccipital'), '70%', '55%', '45%', [
      ['0%', '#a78bfa', '0.10'], ['100%', '#a78bfa', '0']
    ]));
    L1defs.appendChild(buildRadial($id('regionLimbic'), '50%', '48%', '30%', [
      ['0%', '#ef6f61', '0.18'], ['60%', '#b83246', '0.06'], ['100%', '#b83246', '0']
    ]));
    const brainClip = svgEl('clipPath', { id: $id('brainClip') });
    brainClip.appendChild(svgEl('path', { d: 'M255 58 C240 56 222 58 205 64 C188 70 172 80 158 94 C144 108 132 124 124 142 C116 160 110 178 108 196 C106 210 106 224 108 238 C110 252 108 266 104 278 C100 290 94 302 96 316 C98 330 106 344 118 356 C130 368 146 378 164 386 C182 394 200 398 218 400 C236 402 254 402 270 398 C286 394 302 388 316 378 C330 368 342 354 352 338 C362 322 370 304 374 284 C378 264 380 244 378 224 C376 204 372 184 364 166 C356 148 346 132 334 118 C322 104 308 92 292 82 C276 72 262 64 255 58Z' }));
    L1defs.appendChild(brainClip);
    L1.appendChild(L1defs);

    // Detailed brain outline with gyri/sulci
    const brainPath = 'M255 58 C240 56 222 58 205 64 C196 67 188 72 180 78 C176 81 172 84 168 88 C164 92 160 96 158 100 C154 106 150 113 147 120 C144 127 140 134 138 142 C135 150 132 158 130 166 C128 174 126 182 124 190 C122 198 120 206 118 214 C116 222 115 230 114 238 C113 246 112 254 112 262 C112 270 112 278 110 285 C108 292 105 298 104 306 C103 314 104 322 108 330 C112 338 118 345 126 352 C134 359 143 365 153 370 C163 375 174 380 185 384 C196 388 208 390 220 392 C232 394 244 394 256 393 C268 392 280 390 291 386 C302 382 312 376 322 369 C332 362 340 354 347 344 C354 334 360 323 365 310 C370 297 373 284 375 270 C377 256 377 242 376 228 C375 214 372 200 368 188 C364 176 358 164 352 154 C346 144 340 136 332 128 C324 120 316 114 308 108 C300 102 292 96 284 90 C276 84 268 78 262 72 C258 68 256 62 255 58Z';
    // Outer glow halo
    L1.appendChild(svgEl('path', { d: brainPath, fill: 'none', stroke: '#ef6f61', 'stroke-width': 6, opacity: 0.04, filter: $url('glowCoral') }));
    // Volumetric fill
    L1.appendChild(svgEl('path', { d: brainPath, fill: $url('brainFillGrad'), stroke: 'none' }));
    // Main outline with gyri bumps
    L1.appendChild(svgEl('path', { d: brainPath, fill: 'none', stroke: '#ef6f61', 'stroke-width': 1.5, opacity: 0.35 }));
    // Inner contour line for depth
    L1.appendChild(svgEl('path', {
      d: 'M255 72 C238 70 218 74 200 82 C182 90 166 104 154 122 C142 140 134 162 130 184 C126 206 126 228 128 250 C130 268 126 286 120 302 C114 318 118 336 130 350 C142 364 160 376 180 384 C200 392 224 396 248 396 C272 396 296 388 316 374 C336 360 350 342 360 320 C370 298 376 274 376 250 C376 226 372 202 364 180 C356 158 344 138 330 122 C316 106 300 94 282 84 C268 76 258 72 255 72Z',
      fill: 'none', stroke: '#ef6f61', 'stroke-width': 0.6, opacity: 0.12
    }));

    // Sulci / fissure lines (anatomical landmarks)
    const sulci = [
      // Central sulcus (frontal/parietal boundary)
      { d: 'M230 72 C228 100 236 140 242 180 C248 210 244 240 238 268', color: '#38bdf8', w: 0.9 },
      // Lateral (Sylvian) fissure
      { d: 'M130 220 C155 228 185 235 215 232 C245 229 275 222 305 218 C325 215 345 216 360 220', color: '#38bdf8', w: 0.8 },
      // Parieto-occipital sulcus
      { d: 'M330 120 C324 148 320 178 326 210 C332 240 340 268 350 290', color: '#a78bfa', w: 0.7 },
      // Precentral sulcus
      { d: 'M195 80 C198 108 204 138 196 170 C190 195 185 215 178 235', color: '#ef6f61', w: 0.6 },
      // Superior temporal sulcus
      { d: 'M140 260 C165 268 192 272 218 270 C244 268 268 262 288 256', color: '#22d3ee', w: 0.5 },
    ];
    sulci.forEach(s => {
      L1.appendChild(svgEl('path', { d: s.d, fill: 'none', stroke: s.color, 'stroke-width': s.w, opacity: 0.18, 'stroke-dasharray': '5,7', 'stroke-linecap': 'round' }));
    });

    // Brainstem hint
    L1.appendChild(svgEl('path', {
      d: 'M240 396 C238 406 236 416 238 426 C240 436 244 442 248 446 C252 442 256 436 258 426 C260 416 258 406 256 396',
      fill: 'none', stroke: '#ef6f61', 'stroke-width': 1.2, opacity: 0.15, 'stroke-linecap': 'round'
    }));
    L1.appendChild(svgEl('path', {
      d: 'M242 446 C244 454 246 460 248 460 C250 460 252 454 254 446',
      fill: 'none', stroke: '#ef6f61', 'stroke-width': 0.8, opacity: 0.10, 'stroke-linecap': 'round'
    }));

    // Region zone fills (clipped to brain)
    const regionGroup = svgEl('g', { 'clip-path': $url('brainClip') });

    regionGroup.appendChild(svgEl('path', {
      d: 'M120 100 C140 70 200 55 255 58 C230 58 195 80 175 110 C155 140 145 170 140 200 C135 220 130 230 120 230 C110 220 110 170 120 140Z',
      fill: $url('regionFrontal'), class: 'region-zone', 'data-region': 'frontal'
    }));
    regionGroup.appendChild(svgEl('path', {
      d: 'M255 58 C280 60 310 75 335 100 C355 120 370 150 375 185 C375 200 370 215 355 220 C330 225 280 232 250 230 C240 200 238 150 245 100 C248 80 252 65 255 58Z',
      fill: $url('regionParietal'), class: 'region-zone', 'data-region': 'parietal'
    }));
    regionGroup.appendChild(svgEl('path', {
      d: 'M112 240 C112 260 110 285 108 300 C105 320 110 345 130 365 C155 380 185 392 220 396 C240 396 255 395 265 390 C240 370 210 340 185 310 C160 280 140 260 130 245 C122 238 115 238 112 240Z',
      fill: $url('regionTemporal'), class: 'region-zone', 'data-region': 'temporal'
    }));
    regionGroup.appendChild(svgEl('path', {
      d: 'M355 220 C365 230 372 250 375 270 C377 290 374 310 365 330 C355 348 340 362 320 373 C300 384 280 390 265 392 C280 370 305 340 325 310 C340 280 350 250 355 220Z',
      fill: $url('regionOccipital'), class: 'region-zone', 'data-region': 'occipital'
    }));
    regionGroup.appendChild(svgEl('ellipse', {
      cx: 248, cy: 220, rx: 65, ry: 50,
      fill: $url('regionLimbic'), class: 'region-zone', 'data-region': 'limbic'
    }));
    L1.appendChild(regionGroup);

    // Region labels with backdrop glow
    const regionLabels = [
      { x: 165, y: 120, text: 'FRONTAL', color: '#ef6f61' },
      { x: 310, y: 100, text: 'PARIETAL', color: '#38bdf8' },
      { x: 145, y: 310, text: 'TEMPORAL', color: '#22d3ee' },
      { x: 375, y: 230, text: 'OCCIPITAL', color: '#a78bfa' },
      { x: 248, y: 218, text: 'LIMBIC', color: '#ef6f61' },
    ];
    regionLabels.forEach(rl => {
      // Glow backdrop behind label
      L1.appendChild(svgEl('ellipse', { cx: rl.x, cy: rl.y - 2, rx: 30, ry: 8, fill: rl.color, opacity: 0.06 }));
      const t = svgEl('text', { x: rl.x, y: rl.y, fill: rl.color, 'font-size': 8, 'font-weight': '700', 'text-anchor': 'middle', opacity: 0.38, 'letter-spacing': '0.14em', 'font-family': 'Inter, system-ui, sans-serif' });
      t.textContent = rl.text;
      L1.appendChild(t);
    });

    /* ── LAYER 2: Rich neural network ──────────────────── */
    const L2 = makeLayer('layer-neurons');
    const L2defs = svgEl('defs');
    const axGrad = svgEl('linearGradient', { id: $id('heroAxonGrad'), x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
    axGrad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#ef6f61', 'stop-opacity': '0.7' }));
    axGrad.appendChild(svgEl('stop', { offset: '50%', 'stop-color': '#38bdf8', 'stop-opacity': '0.9' }));
    axGrad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#22d3ee', 'stop-opacity': '0.7' }));
    if (!REDUCED_MOTION) {
      axGrad.appendChild(svgEl('animate', { attributeName: 'x1', values: '-50%;50%', dur: '6s', repeatCount: 'indefinite' }));
      axGrad.appendChild(svgEl('animate', { attributeName: 'x2', values: '50%;150%', dur: '6s', repeatCount: 'indefinite' }));
    }
    L2defs.appendChild(axGrad);
    L2.appendChild(L2defs);

    // 32 neurons with varied morphology
    const neurons = [
      // Frontal lobe (coral)
      { x: 160, y: 140, r: 10, c: '#ef6f61', region: 'frontal' },
      { x: 200, y: 160, r: 8, c: '#ef6f61', region: 'frontal' },
      { x: 145, y: 185, r: 7, c: '#ef6f61', region: 'frontal' },
      { x: 185, y: 115, r: 6, c: '#ef6f61', region: 'frontal' },
      { x: 170, y: 100, r: 5, c: '#ef6f61', region: 'frontal' },
      { x: 130, y: 155, r: 5, c: '#ef6f61', region: 'frontal' },
      // Parietal lobe (blue)
      { x: 275, y: 105, r: 9, c: '#38bdf8', region: 'parietal' },
      { x: 315, y: 135, r: 8, c: '#38bdf8', region: 'parietal' },
      { x: 255, y: 145, r: 7, c: '#38bdf8', region: 'parietal' },
      { x: 340, y: 160, r: 6, c: '#38bdf8', region: 'parietal' },
      { x: 295, y: 115, r: 5, c: '#38bdf8', region: 'parietal' },
      // Temporal lobe (cyan)
      { x: 140, y: 275, r: 9, c: '#22d3ee', region: 'temporal' },
      { x: 178, y: 305, r: 7, c: '#22d3ee', region: 'temporal' },
      { x: 205, y: 265, r: 8, c: '#22d3ee', region: 'temporal' },
      { x: 155, y: 245, r: 6, c: '#22d3ee', region: 'temporal' },
      { x: 195, y: 290, r: 5, c: '#22d3ee', region: 'temporal' },
      // Occipital lobe (purple)
      { x: 355, y: 235, r: 8, c: '#a78bfa', region: 'occipital' },
      { x: 365, y: 275, r: 7, c: '#a78bfa', region: 'occipital' },
      { x: 340, y: 200, r: 6, c: '#a78bfa', region: 'occipital' },
      { x: 350, y: 310, r: 6, c: '#a78bfa', region: 'occipital' },
      // Limbic system (deep coral)
      { x: 245, y: 215, r: 11, c: '#ef6f61', region: 'limbic' },
      { x: 270, y: 245, r: 8, c: '#ef6f61', region: 'limbic' },
      { x: 222, y: 240, r: 7, c: '#ef6f61', region: 'limbic' },
      { x: 260, y: 195, r: 6, c: '#ef6f61', region: 'limbic' },
      { x: 235, y: 260, r: 5, c: '#ef6f61', region: 'limbic' },
      // Cross-region / deep
      { x: 215, y: 190, r: 6, c: '#38bdf8', region: 'frontal' },
      { x: 290, y: 180, r: 7, c: '#38bdf8', region: 'parietal' },
      { x: 330, y: 330, r: 7, c: '#22d3ee', region: 'temporal' },
      { x: 290, y: 345, r: 6, c: '#22d3ee', region: 'temporal' },
      { x: 310, y: 265, r: 6, c: '#a78bfa', region: 'occipital' },
      { x: 240, y: 170, r: 5, c: '#38bdf8', region: 'parietal' },
      { x: 280, y: 300, r: 5, c: '#22d3ee', region: 'temporal' },
    ];

    // Connections (index pairs) — dense inter-region connectivity
    const connections = [
      // Frontal internal
      [0,1],[1,2],[0,3],[3,4],[4,5],[0,5],[1,25],
      // Parietal internal
      [6,7],[7,9],[6,10],[8,10],[8,6],[9,18],
      // Temporal internal
      [11,12],[12,15],[11,14],[13,14],[13,15],[12,31],
      // Occipital internal
      [16,17],[16,18],[17,19],[18,29],
      // Limbic internal
      [20,21],[20,22],[21,24],[22,24],[20,23],[23,8],
      // Cross-region: frontal <-> parietal
      [3,6],[1,8],[25,30],[30,8],[4,10],
      // Cross-region: frontal <-> limbic
      [2,22],[1,20],[25,20],[0,23],
      // Cross-region: parietal <-> occipital
      [7,16],[9,18],[26,16],[7,29],
      // Cross-region: temporal <-> limbic
      [13,22],[14,24],[11,22],[24,31],
      // Cross-region: temporal <-> occipital
      [17,27],[19,27],[29,21],
      // Long-range connections
      [5,11],[6,16],[20,13],[21,17],[28,19],[27,28],
    ];

    // Draw axon connections with enhanced styling
    const axonGroup = svgEl('g', { opacity: '0.45', 'shape-rendering': 'optimizeSpeed' });
    connections.forEach(([a, b], idx) => {
      const n1 = neurons[a], n2 = neurons[b];
      const dist = Math.hypot(n2.x - n1.x, n2.y - n1.y);
      const mx = (n1.x + n2.x) / 2 + sRand(-18, 18);
      const my = (n1.y + n2.y) / 2 + sRand(-18, 18);
      const pathD = `M${n1.x},${n1.y} Q${mx},${my} ${n2.x},${n2.y}`;

      if (dist > 80) {
        axonGroup.appendChild(svgEl('path', {
          d: pathD, fill: 'none', stroke: '#38bdf8', 'stroke-width': sRand(2.5, 4),
          'stroke-linecap': 'round', opacity: 0.06
        }));
      }

      axonGroup.appendChild(svgEl('path', {
        d: pathD, fill: 'none',
        stroke: dist > 120 ? $url('heroAxonGrad') : '#38bdf8',
        'stroke-width': sRand(0.7, 1.6), 'stroke-linecap': 'round',
        class: 'hero-axon-path', id: `axon-${idx}`
      }));

      if (dist > 90) {
        const segments = Math.floor(dist / 40);
        for (let s = 1; s <= segments; s++) {
          const t = s / (segments + 1);
          const sx = n1.x * (1 - t) * (1 - t) + 2 * mx * t * (1 - t) + n2.x * t * t;
          const sy = n1.y * (1 - t) * (1 - t) + 2 * my * t * (1 - t) + n2.y * t * t;
          axonGroup.appendChild(svgEl('rect', {
            x: sx - 8, y: sy - 3, width: 16, height: 6, rx: 3,
            fill: 'none', stroke: '#38bdf8', 'stroke-width': 0.6, opacity: 0.20,
            transform: `rotate(${Math.atan2(n2.y - n1.y, n2.x - n1.x) * 180 / Math.PI}, ${sx}, ${sy})`
          }));
        }
      }

      if (sRandom() > 0.5) {
        axonGroup.appendChild(svgEl('circle', {
          cx: n2.x + sRand(-2, 2), cy: n2.y + sRand(-2, 2), r: sRand(2, 3.5),
          fill: '#22d3ee', opacity: sRand(0.15, 0.30)
        }));
      }
    });
    L2.appendChild(axonGroup);

    const dendGroup = svgEl('g', { opacity: '0.28', 'shape-rendering': 'optimizeSpeed' });
    neurons.forEach(n => {
      const dendCount = n.r > 8 ? sRandInt(4, 6) : n.r > 6 ? sRandInt(2, 4) : sRandInt(1, 3);
      for (let i = 0; i < dendCount; i++) {
        const angle = (i / dendCount) * Math.PI * 2 + sRand(-0.4, 0.4);
        const len = sRand(14, 38);
        const ex = n.x + Math.cos(angle) * len;
        const ey = n.y + Math.sin(angle) * len;
        const cpx = n.x + Math.cos(angle) * len * 0.5 + sRand(-8, 8);
        const cpy = n.y + Math.sin(angle) * len * 0.5 + sRand(-8, 8);

        let dPath = `M${n.x},${n.y} Q${cpx},${cpy} ${ex},${ey}`;
        if (n.r >= 7 && sRandom() > 0.5) {
          const spAngle = angle + sRand(-1.0, 1.0);
          const spLen = sRand(5, 10);
          dPath += ` M${ex},${ey} L${ex + Math.cos(spAngle) * spLen},${ey + Math.sin(spAngle) * spLen}`;
        }
        dendGroup.appendChild(svgEl('path', {
          d: dPath,
          fill: 'none', stroke: n.c, 'stroke-width': sRand(0.3, 0.9), 'stroke-linecap': 'round'
        }));
      }
    });
    L2.appendChild(dendGroup);

    neurons.forEach((n, i) => {
      if (n.r >= 7) {
        L2.appendChild(svgEl('circle', {
          cx: n.x, cy: n.y, r: n.r * 2.8,
          fill: n.c, opacity: 0.05, class: 'neuron-halo'
        }));
      }
      L2.appendChild(svgEl('circle', {
        cx: n.x, cy: n.y, r: n.r * 1.8,
        fill: n.c, opacity: 0.06, class: 'neuron-node'
      }));
      L2.appendChild(svgEl('circle', {
        cx: n.x, cy: n.y, r: n.r,
        fill: n.c, 'fill-opacity': 0.06,
        stroke: n.c, 'stroke-width': n.r > 7 ? 1.8 : 1.2,
        opacity: 0.55, class: 'neuron-soma', 'data-idx': i, 'data-region': n.region
      }));
      L2.appendChild(svgEl('circle', {
        cx: n.x + sRand(-1, 1), cy: n.y + sRand(-1, 1),
        r: n.r * 0.32, fill: n.c, opacity: 0.30
      }));
    });

    // Store neuron data for cascade system
    container._heroBrainData = { neurons, connections };

    /* ── LAYER 3: Synapse pulses + concept labels ──────── */
    const L3 = makeLayer('layer-labels');
    const L3defs = svgEl('defs');
    L3defs.appendChild(buildFilter($id('glowSignal'), '5', { x: '-60%', y: '-60%', w: '220%', h: '220%' }));
    L3defs.appendChild(buildFilter($id('heroGlow'), '5', { x: '-40%', y: '-40%', w: '180%', h: '180%' }));
    L3.appendChild(L3defs);

    const synapsePoints = [
      { x: 180, y: 155, d: 0 }, { x: 255, y: 130, d: 1.2 }, { x: 320, y: 155, d: 2.5 },
      { x: 245, y: 235, d: 0.8 }, { x: 160, y: 285, d: 3 }, { x: 355, y: 250, d: 1.8 },
      { x: 280, y: 300, d: 4 }, { x: 310, y: 335, d: 2.2 },
      { x: 200, y: 200, d: 1.5 }, { x: 290, y: 170, d: 3.5 },
      { x: 230, y: 280, d: 0.5 }, { x: 340, y: 185, d: 2.8 },
    ];
    synapsePoints.forEach(sp => {
      const dur = sRand(3, 5);
      const ring = svgEl('circle', { cx: sp.x, cy: sp.y, r: 4, fill: 'none', stroke: '#f7c948', 'stroke-width': 0.5, opacity: 0, class: 'synapse-ring' });
      if (!REDUCED_MOTION) {
        ring.appendChild(svgEl('animate', { attributeName: 'r', values: '4;14;18', dur: dur + 's', begin: sp.d + 's', repeatCount: 'indefinite' }));
        ring.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;0.25;0', dur: dur + 's', begin: sp.d + 's', repeatCount: 'indefinite' }));
      }
      L3.appendChild(ring);
      const dot = svgEl('circle', { cx: sp.x, cy: sp.y, r: 3, fill: '#f7c948', opacity: 0.6, filter: $url('glowSignal'), class: 'synapse-pulse' });
      if (!REDUCED_MOTION) { dot.style.animationDelay = `${sp.d}s`; dot.style.animationDuration = `${dur}s`; }
      L3.appendChild(dot);
    });

    // Concept labels with pill backdrop and animated connecting lines
    const concepts = [
      { x: 38, y: 110, text: 'Neuron Firing', view: 'visuals', ax: 150, ay: 140, region: 'frontal' },
      { x: 420, y: 80, text: 'Memory', view: 'visuals', ax: 310, ay: 135, region: 'parietal' },
      { x: 445, y: 190, text: 'Research Methods', view: 'research', ax: 365, ay: 235, region: 'occipital' },
      { x: 38, y: 340, text: 'Conditioning', view: 'visuals', ax: 140, ay: 275, region: 'temporal' },
      { x: 440, y: 320, text: 'Data & Stats', view: 'stats', ax: 355, ay: 275, region: 'occipital' },
      { x: 45, y: 225, text: 'AAQ / EBQ', view: 'aaq', ax: 145, ay: 200, region: 'frontal' },
      { x: 420, y: 400, text: 'Cognition', view: 'ced-map', ax: 290, ay: 345, region: 'temporal' },
      { x: 38, y: 430, text: 'Dreams & Sleep', view: 'ced-map', ax: 180, ay: 365, region: 'temporal' },
    ];
    concepts.forEach((l, ci) => {
      const isLeft = l.x < 260;
      const g = svgEl('g', {
        class: 'concept-node', 'data-view': l.view, 'data-region': l.region,
        style: 'cursor:pointer', tabindex: '0', role: 'button',
        'aria-label': 'Navigate to ' + l.text, focusable: 'true'
      });

      // Animated connecting line (dots flow toward brain)
      const lineX1 = l.x + (isLeft ? 60 : -55);
      const connLine = svgEl('line', {
        x1: lineX1, y1: l.y, x2: l.ax, y2: l.ay,
        stroke: '#a8b5c7', 'stroke-width': 0.7, opacity: 0.20,
        'stroke-dasharray': '2,4',
        class: 'concept-connector'
      });
      if (!REDUCED_MOTION) {
        connLine.style.animationDelay = `${ci * 0.4}s`;
      }
      g.appendChild(connLine);

      // Pill backdrop
      const textLen = l.text.length * 6.2 + 16;
      const pillX = isLeft ? l.x - 4 : l.x - textLen + 4;
      g.appendChild(svgEl('rect', {
        x: pillX, y: l.y - 12, width: textLen, height: 18, rx: 9,
        fill: '#0d1b2f', opacity: 0.65,
        stroke: '#a8b5c7', 'stroke-width': 0.4, 'stroke-opacity': 0.15
      }));

      // Label text
      const t = svgEl('text', {
        x: l.x, y: l.y, fill: '#d4deeb', 'font-size': 11, 'font-weight': '600',
        'font-family': "'Playfair Display', Georgia, serif",
        'text-anchor': isLeft ? 'start' : 'end'
      });
      t.textContent = l.text;
      g.appendChild(t);

      // Pulsing indicator ring (double circle)
      const dotX = l.x + (isLeft ? -8 : 8);
      const dotY = l.y - 3;
      const ringEl = svgEl('circle', { cx: dotX, cy: dotY, r: 5, fill: 'none', stroke: '#ef6f61', 'stroke-width': 0.6, opacity: 0.2, class: 'concept-ring-pulse' });
      if (!REDUCED_MOTION) {
        ringEl.appendChild(svgEl('animate', { attributeName: 'r', values: '5;8;5', dur: '3s', repeatCount: 'indefinite' }));
        ringEl.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0.2;0.45;0.2', dur: '3s', repeatCount: 'indefinite' }));
      }
      g.appendChild(ringEl);
      g.appendChild(svgEl('circle', { cx: dotX, cy: dotY, r: 2.5, fill: '#ef6f61', opacity: 0.7 }));

      L3.appendChild(g);
    });

    const signalPool = svgEl('g', { class: 'signal-pool' });
    for (let i = 0; i < 8; i++) {
      const sig = svgEl('circle', { r: 3.5, fill: '#f7c948', opacity: 0, filter: $url('glowSignal'), class: 'cascade-signal', 'data-pool': i });
      signalPool.appendChild(sig);
      // Signal trail (wider, fading)
      const trail = svgEl('circle', { r: 6, fill: '#f7c948', opacity: 0, class: 'cascade-trail', 'data-pool': i });
      signalPool.appendChild(trail);
    }
    // Flash ring pool for neuron activation
    for (let i = 0; i < 8; i++) {
      const flash = svgEl('circle', { r: 0, fill: 'none', stroke: '#f7c948', 'stroke-width': 1.5, opacity: 0, class: 'neuron-flash-ring', 'data-pool': i });
      signalPool.appendChild(flash);
    }
    L3.appendChild(signalPool);
  }

  /* ═══════════════════════════════════════════════════════════
     UNIT PATHWAY — Five units as connected neural nodes
     ═══════════════════════════════════════════════════════════ */
  function createUnitPathway(container, units) {
    if (!container || !units || !units.length) return;
    const nodeSize = 76;
    const gapX = 185;
    const w = units.length * gapX + 70;
    const h = 270;
    const startX = 65;
    const nodeY = 82;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${w} ${h}`,
      width: '100%',
      preserveAspectRatio: 'xMidYMid meet',
      class: 'unit-pathway-svg',
      'aria-label': 'Five-unit AP Psychology neural pathway'
    });

    const defs = svgEl('defs');
    const pathGlow = svgEl('filter', { id: 'pathGlow' });
    pathGlow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '3', result: 'g' }));
    const pm = svgEl('feMerge');
    pm.appendChild(svgEl('feMergeNode', { in: 'g' }));
    pm.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    pathGlow.appendChild(pm);
    defs.appendChild(pathGlow);

    // Soft glow for nodes
    const nodeGlow = svgEl('filter', { id: 'upNodeGlow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    nodeGlow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '4', result: 'ng' }));
    const ngm = svgEl('feMerge');
    ngm.appendChild(svgEl('feMergeNode', { in: 'ng' }));
    ngm.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
    nodeGlow.appendChild(ngm);
    defs.appendChild(nodeGlow);

    svg.appendChild(defs);

    const unitColors = ['#ef6f61', '#38bdf8', '#a78bfa', '#f08a7d', '#22d3ee'];

    // Draw connecting axon paths between nodes
    for (let i = 0; i < units.length - 1; i++) {
      const x1 = startX + i * gapX + nodeSize / 2;
      const x2 = startX + (i + 1) * gapX - nodeSize / 2 + 10;
      const mx = (x1 + x2) / 2;
      const my = nodeY + rand(-12, 12);
      const pathD = `M${x1 + 10},${nodeY} C${mx},${my} ${mx},${my} ${x2 - 10},${nodeY}`;

      // Glow underline
      svg.appendChild(svgEl('path', {
        d: pathD, fill: 'none', stroke: unitColors[i], 'stroke-width': 6, opacity: 0.06, 'stroke-linecap': 'round'
      }));
      // Primary axon
      svg.appendChild(svgEl('path', {
        d: pathD, fill: 'none', stroke: unitColors[i], 'stroke-width': 2.5, opacity: 0.40, 'stroke-linecap': 'round', class: 'pathway-axon'
      }));
      // Gradient overlay (next color)
      svg.appendChild(svgEl('path', {
        d: pathD, fill: 'none', stroke: unitColors[i + 1], 'stroke-width': 2,
        opacity: 0.20, 'stroke-linecap': 'round', 'stroke-dasharray': `${(x2 - x1) / 2},${(x2 - x1)}`
      }));

      // Synapse junction with glow
      svg.appendChild(svgEl('circle', { cx: mx, cy: (nodeY + my) / 2, r: 8, fill: '#f7c948', opacity: 0.06 }));
      const dot = svgEl('circle', { cx: mx, cy: (nodeY + my) / 2, r: 4, fill: '#f7c948', opacity: 0.65, class: 'synapse-pulse' });
      if (!REDUCED_MOTION) dot.style.animationDelay = `${i * 0.7}s`;
      svg.appendChild(dot);
    }

    // Draw unit nodes
    units.forEach((u, i) => {
      const cx = startX + i * gapX;
      const cy = nodeY;
      const color = unitColors[i] || '#38bdf8';

      // Outermost halo (cinematic glow)
      svg.appendChild(svgEl('circle', { cx, cy, r: nodeSize / 2 + 16, fill: color, opacity: 0.02 }));
      // Outer ring
      svg.appendChild(svgEl('circle', { cx, cy, r: nodeSize / 2 + 8, fill: 'none', stroke: color, 'stroke-width': 0.8, opacity: 0.18 }));

      // Node body with layered depth
      svg.appendChild(svgEl('circle', { cx, cy, r: nodeSize / 2 + 2, fill: color, opacity: 0.03 }));
      svg.appendChild(svgEl('circle', { cx, cy, r: nodeSize / 2, fill: '#0d1b2f', stroke: color, 'stroke-width': 2.2, opacity: 0.92 }));

      // Inner glow gradient
      svg.appendChild(svgEl('circle', { cx, cy, r: nodeSize / 2 - 5, fill: color, opacity: 0.05 }));
      // Inner ring
      svg.appendChild(svgEl('circle', { cx, cy, r: nodeSize / 2 - 12, fill: 'none', stroke: color, 'stroke-width': 0.5, opacity: 0.12 }));

      // Unit number
      const num = svgEl('text', {
        x: cx, y: cy + 2, fill: color, 'font-size': 26, 'font-weight': '800',
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-family': "'Playfair Display', Georgia, serif"
      });
      num.textContent = u.id;
      svg.appendChild(num);

      // Weight badge with enhanced style
      svg.appendChild(svgEl('rect', { x: cx - 30, y: cy + nodeSize / 2 + 8, width: 60, height: 20, rx: 10, fill: color, opacity: 0.10 }));
      svg.appendChild(svgEl('rect', { x: cx - 30, y: cy + nodeSize / 2 + 8, width: 60, height: 20, rx: 10, fill: 'none', stroke: color, 'stroke-width': 1, opacity: 0.30 }));
      const wt = svgEl('text', { x: cx, y: cy + nodeSize / 2 + 22, fill: color, 'font-size': 9.5, 'font-weight': '700', 'text-anchor': 'middle', 'font-family': "'SFMono-Regular', Consolas, monospace" });
      wt.textContent = u.weight;
      svg.appendChild(wt);

      // Title
      const titleWords = u.title.split(/\s+/);
      let line1 = '', line2 = '';
      titleWords.forEach(word => {
        if ((line1 + ' ' + word).trim().length <= 14 && !line2) line1 = (line1 + ' ' + word).trim();
        else line2 = (line2 + ' ' + word).trim();
      });

      const t1 = svgEl('text', { x: cx, y: cy + nodeSize / 2 + 44, fill: '#d4deeb', 'font-size': 10, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif' });
      t1.textContent = line1;
      svg.appendChild(t1);
      if (line2) {
        const t2 = svgEl('text', { x: cx, y: cy + nodeSize / 2 + 57, fill: '#a8b5c7', 'font-size': 10, 'font-weight': '500', 'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif' });
        t2.textContent = line2;
        svg.appendChild(t2);
      }

      // Topic count badge
      const topicY = cy + nodeSize / 2 + (line2 ? 72 : 60);
      svg.appendChild(svgEl('rect', { x: cx - 22, y: topicY - 8, width: 44, height: 14, rx: 7, fill: '#132944', opacity: 0.5 }));
      const topicT = svgEl('text', { x: cx, y: topicY + 2, fill: '#a8b5c7', 'font-size': 8.5, 'font-weight': '600', 'text-anchor': 'middle', 'font-family': 'Inter, system-ui, sans-serif', opacity: 0.7 });
      topicT.textContent = `${u.topics.length} topics`;
      svg.appendChild(topicT);
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ── Public API ───────────────────────────────────────────── */
  let resizeTimeout;
  function initBackground() {
    const bg = document.querySelector('.neuro-bg');
    if (!bg) return;
    generateNeuronBackground(bg);
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => generateNeuronBackground(bg), 300);
    });
  }

  return {
    initBackground,
    generateNeuronBackground,
    createNeuronFiringDiagram,
    createSynapseDiagram,
    createOperantQuadrant,
    createNormalCurve,
    createClassicalConditioning,
    createMemoryModel,
    createBrainRegionMap,
    createSleepCycleGraph,
    createEriksonStages,
    createResearchDesignTree,
    createHeroBrainVisual,
    createUnitPathway
  };
})();
