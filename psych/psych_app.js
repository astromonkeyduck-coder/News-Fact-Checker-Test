/* ═══════════════════════════════════════════════════════════════
   AP PSYCHOLOGY MASTER REVIEW — Core Application
   Neuro Scholar Theme
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DATA = {};
  let currentView = 'home';
  let vocabFilter = 'all';
  let flashcardIdx = 0;

  /* ── Data Loading ─────────────────────────────────────────── */
  async function loadJSON(path) {
    try {
      const r = await fetch(path);
      if (!r.ok) throw new Error(r.status);
      return r.json();
    } catch (e) { console.warn('Failed to load', path, e); return null; }
  }

  async function loadAllData() {
    const [ced, vocab, visuals, frq, mcq, research, stats, comparison, misconception] = await Promise.all([
      loadJSON('data/psych_ced_data.json'),
      loadJSON('data/vocab_bank.json'),
      loadJSON('data/concept_visual_data.json'),
      loadJSON('data/frq_practice_bank.json'),
      loadJSON('data/mcq_practice_bank.json'),
      loadJSON('data/research_methods_lab.json'),
      loadJSON('data/data_stats_lab.json'),
      loadJSON('data/comparison_bank.json'),
      loadJSON('data/misconception_bank.json')
    ]);
    DATA.ced = ced; DATA.vocab = vocab; DATA.visuals = visuals;
    DATA.frq = frq; DATA.mcq = mcq; DATA.research = research;
    DATA.stats = stats; DATA.comparison = comparison; DATA.misconception = misconception;
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }
  function h(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function unitColor(n) { return getComputedStyle(document.documentElement).getPropertyValue(`--unit-${n}`).trim(); }

  const UNIT_ICONS = {
    1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="4"/><path d="M12 14v6"/><path d="M8 7Q5 4 3 3"/><path d="M16 7Q19 4 21 3"/><path d="M9 13Q5 15 3 16"/><path d="M15 13Q19 15 21 16"/></svg>',
    2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2a8 8 0 018 8c0 3-2 5.5-4 7l-1 1H9l-1-1C6 15.5 4 13 4 10a8 8 0 018-8z"/><path d="M9 22h6"/><path d="M10 18h4"/></svg>',
    3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>',
    4: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    5: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L11 3l-3 9H4"/></svg>'
  };

  /* ── View Routing ─────────────────────────────────────────── */
  function switchView(view) {
    if (view === currentView) return;
    const prev = document.querySelector('.view.active');
    currentView = view;

    // Exit animation on previous view
    if (prev) {
      prev.classList.remove('active');
      prev.classList.add('view-exiting');
      prev.addEventListener('animationend', () => prev.classList.remove('view-exiting'), { once: true });
      setTimeout(() => prev.classList.remove('view-exiting'), 250);
    }

    const target = el(`view-${view}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === view);
      if (t.role === 'tab') t.setAttribute('aria-selected', t.dataset.view === view ? 'true' : 'false');
    });

    // Close mobile nav
    el('mobileNav')?.classList.remove('open');

    // Lazy render
    if (view === 'ced-map' && !el('cedMapContainer').children.length) renderCEDMap();
    if (view === 'vocab' && !el('vocabGrid').children.length) renderVocab();
    if (view === 'visuals' && !el('exhibitPanels').children.length) renderVisuals();
    if (view === 'research' && !el('researchLabContainer').children.length) renderResearchLab();
    if (view === 'stats' && !el('statsLabContainer').children.length) renderStatsLab();
    if (view === 'aaq' && !el('aaqContainer').children.length) renderAAQ();
    if (view === 'ebq' && !el('ebqContainer').children.length) renderEBQ();
    if (view === 'mcq' && !el('mcqContainer').children.length) renderMCQ();
    if (view === 'comparison' && !el('comparisonContainer').children.length) renderComparisons();
    if (view === 'misconceptions' && !el('misconceptionContainer').children.length) renderMisconceptions();
    if (view === 'flashcards' && !el('flashcardContainer').children.length) renderFlashcards();
    if (view === 'night-before' && !el('nightBeforeContainer').children.length) renderNightBefore();

    // Apply stagger indices to immediate grid children
    if (target) {
      requestAnimationFrame(() => {
        target.querySelectorAll('.module-card, .vocab-card, .practice-strip-item, .unit-pathway-card, .comparison-card, .mistake-card, .nb-card, .exhibit-panel, .research-panel, .stats-panel').forEach((item, i) => {
          item.classList.add('stagger-item');
          item.style.setProperty('--stagger-index', Math.min(i, 12));
        });
      });
    }

    el('mainContent').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ── Homepage Rendering ─────────────────────────────────────── */
  function renderHomepage() {
    if (!DATA.ced) return;
    renderUnitPathway();
    renderPracticeStrip();
    renderModuleGrid();
  }

  function renderUnitPathway() {
    if (!DATA.ced) return;
    const pathContainer = el('unitPathwayContainer');
    if (pathContainer && typeof NeuroVisuals !== 'undefined') {
      NeuroVisuals.createUnitPathway(pathContainer, DATA.ced.units);
    }

    const unitFigures = {
      1: { img: 'assets/darwin.jpg', name: 'Charles Darwin', blurb: 'Evolutionary foundations' },
      2: { img: 'assets/maslow.jpg', name: 'Abraham Maslow', blurb: 'Hierarchy of needs' },
      3: { img: 'assets/pavlov.jpg', name: 'Ivan Pavlov', blurb: 'Classical conditioning' },
      4: { img: 'assets/watson.jpg', name: 'John B. Watson', blurb: 'Behavioral psychology' },
      5: { img: 'assets/freud-1935.webp', name: 'Sigmund Freud', blurb: 'Unconscious mind' }
    };

    const cards = el('unitPathwayCards');
    if (!cards) return;
    cards.innerHTML = DATA.ced.units.map(u => {
      const fig = unitFigures[u.id] || {};
      const topicNames = (u.topics || []).slice(0, 3).map(t => h(t.title)).join(' · ');
      return `
      <div class="unit-pathway-card" style="--unit-color:${h(u.color)}" data-view="ced-map">
        <div class="unit-pathway-card-accent"></div>
        ${fig.img ? `
        <div class="unit-pathway-card-portrait">
          <img src="${h(fig.img)}" alt="${h(fig.name)}" loading="lazy">
          <div class="unit-pathway-card-portrait-ring"></div>
        </div>
        <div class="unit-pathway-card-figure">
          <span class="unit-pathway-card-figure-name">${h(fig.name)}</span>
          <span class="unit-pathway-card-figure-blurb">${h(fig.blurb)}</span>
        </div>` : ''}
        <div class="unit-pathway-card-body">
          <div class="unit-pathway-card-title">${h(u.title)}</div>
          <span class="unit-pathway-card-weight">${h(u.weight)}</span>
        </div>
        <div class="unit-pathway-card-topics">
          <span class="unit-pathway-card-topic-count">${u.topics.length} topics</span>
          <span class="unit-pathway-card-topic-list">${topicNames}</span>
        </div>
        <button class="btn btn-sm unit-pathway-card-btn" style="border-color:${h(u.color)};color:${h(u.color)}">Review Unit →</button>
      </div>`;
    }).join('');
  }

  function renderPracticeStrip() {
    const grid = el('practiceStripGrid');
    if (!grid) return;
    const examColors = { MCQ: '#38bdf8', AAQ: '#ef6f61', EBQ: '#a78bfa' };
    const practices = [
      { name: 'Concept Application', desc: 'Apply psychological concepts, theories, and perspectives to real-world scenarios.', appears: ['MCQ', 'AAQ', 'EBQ'], view: 'mcq', color: '#22d3ee',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>' },
      { name: 'Research Methods & Design', desc: 'Analyze and evaluate experimental and non-experimental research designs.', appears: ['MCQ', 'AAQ'], view: 'research', color: '#38bdf8',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>' },
      { name: 'Data Interpretation', desc: 'Interpret quantitative data including graphs, tables, and statistical findings.', appears: ['MCQ', 'AAQ'], view: 'stats', color: '#a78bfa',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
      { name: 'Argumentation', desc: 'Develop defensible claims supported by scientifically derived evidence and reasoning.', appears: ['AAQ', 'EBQ'], view: 'aaq', color: '#ef6f61',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>' }
    ];
    grid.innerHTML = practices.map(p => `
      <div class="practice-strip-item" style="--practice-color:${p.color}">
        <div class="practice-strip-accent"></div>
        <div class="practice-strip-icon">${p.icon}</div>
        <h3>${h(p.name)}</h3>
        <p>${h(p.desc)}</p>
        <div class="practice-strip-tags">
          ${p.appears.map(a => `<span class="practice-exam-pill" style="--pill-color:${examColors[a] || '#a8b5c7'}">${a}</span>`).join('')}
        </div>
        <button class="btn btn-sm practice-strip-btn" data-view="${h(p.view)}" style="border-color:${p.color};color:${p.color}">Practice →</button>
      </div>
    `).join('');
  }

  function renderModuleGrid() {
    const grid = el('moduleGrid');
    if (!grid) return;
    const modules = [
      { name: 'CED Map', desc: 'Complete unit, topic, and learning objective hierarchy.', view: 'ced-map', previewClass: 'module-preview-neurons',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="5" y="8" width="30" height="8" rx="2" fill="#38bdf8" opacity=".3"/><rect x="5" y="20" width="50" height="5" rx="1.5" fill="#a8b5c7" opacity=".2"/><rect x="10" y="30" width="45" height="4" rx="1" fill="#a8b5c7" opacity=".12"/><rect x="10" y="38" width="40" height="4" rx="1" fill="#a8b5c7" opacity=".12"/><rect x="5" y="48" width="25" height="6" rx="2" fill="#22d3ee" opacity=".2"/><circle cx="90" cy="30" r="18" fill="none" stroke="#ef6f61" stroke-width="1.5" opacity=".3"/><circle cx="90" cy="30" r="6" fill="#ef6f61" opacity=".15"/></svg>' },
      { name: 'Vocab Atlas', desc: 'Key terms with memory hooks, scenarios, and FRQ sentences.', view: 'vocab', previewClass: 'module-preview-vocab',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="5" y="5" width="50" height="50" rx="6" fill="#0d1b2f" stroke="#38bdf8" stroke-width="1" opacity=".5"/><text x="12" y="22" fill="#38bdf8" font-size="8" font-weight="700" font-family="Inter,sans-serif" opacity=".7">Action</text><text x="12" y="33" fill="#38bdf8" font-size="8" font-weight="700" font-family="Inter,sans-serif" opacity=".7">Potential</text><rect x="12" y="38" width="35" height="3" rx="1" fill="#a8b5c7" opacity=".2"/><rect x="12" y="44" width="28" height="3" rx="1" fill="#a8b5c7" opacity=".15"/><rect x="65" y="8" width="50" height="14" rx="4" fill="#ef6f61" opacity=".08" stroke="#ef6f61" stroke-width=".8" stroke-opacity=".3"/><text x="72" y="18" fill="#ef6f61" font-size="7" font-family="Inter,sans-serif" opacity=".6">Trap</text><rect x="65" y="28" width="50" height="14" rx="4" fill="#38bdf8" opacity=".08" stroke="#38bdf8" stroke-width=".8" stroke-opacity=".3"/><text x="72" y="38" fill="#38bdf8" font-size="7" font-family="Inter,sans-serif" opacity=".6">FRQ</text></svg>' },
      { name: 'Visual Concept Atlas', desc: 'Interactive neuron, synapse, conditioning, and stats diagrams.', view: 'visuals', previewClass: 'module-preview-neurons',
        preview: '<svg viewBox="0 0 120 60" fill="none"><circle cx="35" cy="25" r="10" fill="none" stroke="#ef6f61" stroke-width="1.5" opacity=".5"/><circle cx="35" cy="25" r="4" fill="#ef6f61" opacity=".2"/><path d="M45 25 L80 25" stroke="#38bdf8" stroke-width="1.5" opacity=".4"/><circle cx="85" cy="25" r="4" fill="#22d3ee" opacity=".4"/><path d="M25 18 Q15 8 8 5" stroke="#ef6f61" stroke-width="1" opacity=".3"/><path d="M25 32 Q15 42 8 48" stroke="#ef6f61" stroke-width="1" opacity=".3"/><circle cx="60" cy="25" r="2" fill="#f7c948" opacity=".6"/><text x="35" y="50" fill="#a8b5c7" font-size="6" text-anchor="middle" font-family="Inter,sans-serif" opacity=".5">Neuron → Synapse → Signal</text></svg>' },
      { name: 'Research Methods Lab', desc: 'Experimental design, IV/DV, sampling, ethics, and biases.', view: 'research', previewClass: 'module-preview-research',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="5" y="10" width="45" height="18" rx="4" fill="#22d3ee" opacity=".06" stroke="#22d3ee" stroke-width="1" opacity=".3"/><text x="12" y="22" fill="#22d3ee" font-size="7" font-weight="600" font-family="Inter,sans-serif" opacity=".6">IV</text><rect x="5" y="34" width="45" height="18" rx="4" fill="#38bdf8" opacity=".06" stroke="#38bdf8" stroke-width="1" opacity=".3"/><text x="12" y="46" fill="#38bdf8" font-size="7" font-weight="600" font-family="Inter,sans-serif" opacity=".6">DV</text><path d="M55 20 L65 20 L65 43 L55 43" fill="none" stroke="#a8b5c7" stroke-width="1" opacity=".3"/><text x="70" y="34" fill="#a8b5c7" font-size="6" font-family="Inter,sans-serif" opacity=".5">cause?</text><rect x="80" y="8" width="35" height="14" rx="3" fill="#ef6f61" opacity=".06" stroke="#ef6f61" stroke-width=".8" opacity=".3"/><text x="87" y="18" fill="#ef6f61" font-size="6" font-family="Inter,sans-serif" opacity=".5">Confound</text></svg>' },
      { name: 'Data & Stats Lab', desc: 'Normal curves, correlation, effect size, and significance.', view: 'stats', previewClass: 'module-preview-stats',
        preview: '<svg viewBox="0 0 120 60" fill="none"><path d="M10 50 Q30 50 40 40 Q50 20 60 10 Q70 20 80 40 Q90 50 110 50" fill="none" stroke="#38bdf8" stroke-width="2" opacity=".5"/><path d="M10 50 Q30 50 40 40 Q50 20 60 10 Q70 20 80 40 Q90 50 110 50 L110 55 L10 55 Z" fill="#38bdf8" opacity=".06"/><line x1="60" y1="10" x2="60" y2="50" stroke="#38bdf8" stroke-width=".8" opacity=".3" stroke-dasharray="2,2"/><text x="60" y="8" fill="#38bdf8" font-size="6" text-anchor="middle" font-family="Inter,sans-serif" opacity=".5">μ</text><text x="40" y="48" fill="#a8b5c7" font-size="5" text-anchor="middle" font-family="monospace" opacity=".4">-1σ</text><text x="80" y="48" fill="#a8b5c7" font-size="5" text-anchor="middle" font-family="monospace" opacity=".4">+1σ</text></svg>' },
      { name: 'AAQ Trainer', desc: 'Six-part argument analysis with research scenarios and scoring.', view: 'aaq', previewClass: 'module-preview-frq',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="5" y="5" width="35" height="50" rx="4" fill="#0d1b2f" stroke="#2563eb" stroke-width="1" opacity=".4"/><rect x="10" y="12" width="25" height="3" rx="1" fill="#a8b5c7" opacity=".2"/><rect x="10" y="18" width="20" height="3" rx="1" fill="#a8b5c7" opacity=".15"/><rect x="10" y="24" width="22" height="3" rx="1" fill="#a8b5c7" opacity=".15"/><rect x="45" y="5" width="35" height="50" rx="4" fill="#0d1b2f" stroke="#38bdf8" stroke-width="1" opacity=".4"/><text x="50" y="16" fill="#38bdf8" font-size="6" font-weight="600" font-family="Inter,sans-serif" opacity=".5">Part A</text><text x="50" y="25" fill="#38bdf8" font-size="6" font-weight="600" font-family="Inter,sans-serif" opacity=".5">Part B</text><text x="50" y="34" fill="#38bdf8" font-size="6" font-weight="600" font-family="Inter,sans-serif" opacity=".5">Part C</text><rect x="85" y="5" width="30" height="50" rx="4" fill="#0d1b2f" stroke="#4ade80" stroke-width="1" opacity=".3"/><rect x="90" y="12" width="6" height="6" rx="1.5" fill="none" stroke="#4ade80" stroke-width="1" opacity=".4"/><rect x="90" y="22" width="6" height="6" rx="1.5" fill="none" stroke="#4ade80" stroke-width="1" opacity=".4"/><rect x="90" y="32" width="6" height="6" rx="1.5" fill="none" stroke="#4ade80" stroke-width="1" opacity=".4"/></svg>' },
      { name: 'EBQ Trainer', desc: 'Three-source evidence-based argument builder with rubric.', view: 'ebq', previewClass: 'module-preview-frq',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="3" y="5" width="35" height="18" rx="4" fill="#0d1b2f" stroke="#2563eb" stroke-width="1" opacity=".4"/><text x="10" y="17" fill="#2563eb" font-size="6" font-family="Inter,sans-serif" opacity=".5">Source A</text><rect x="42" y="5" width="35" height="18" rx="4" fill="#0d1b2f" stroke="#2563eb" stroke-width="1" opacity=".4"/><text x="49" y="17" fill="#2563eb" font-size="6" font-family="Inter,sans-serif" opacity=".5">Source B</text><rect x="81" y="5" width="35" height="18" rx="4" fill="#0d1b2f" stroke="#2563eb" stroke-width="1" opacity=".4"/><text x="88" y="17" fill="#2563eb" font-size="6" font-family="Inter,sans-serif" opacity=".5">Source C</text><path d="M20 23 L60 35 M60 23 L60 35 M98 23 L60 35" stroke="#a8b5c7" stroke-width=".8" opacity=".3"/><rect x="30" y="35" width="60" height="18" rx="4" fill="#0d1b2f" stroke="#ef6f61" stroke-width="1" opacity=".3"/><text x="42" y="47" fill="#ef6f61" font-size="6" font-family="Inter,sans-serif" opacity=".5">Claim + Evidence</text></svg>' },
      { name: 'MCQ Practice', desc: 'AP-style multiple choice with explanations and analysis.', view: 'mcq', previewClass: 'module-preview-vocab',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="10" y="5" width="100" height="12" rx="3" fill="#0d1b2f" stroke="#a8b5c7" stroke-width=".8" opacity=".3"/><rect x="10" y="21" width="100" height="9" rx="3" fill="#0d1b2f" stroke="#a8b5c7" stroke-width=".8" opacity=".2"/><circle cx="16" cy="25.5" r="3" fill="none" stroke="#a8b5c7" stroke-width=".8" opacity=".3"/><rect x="10" y="33" width="100" height="9" rx="3" fill="#4ade80" opacity=".06" stroke="#4ade80" stroke-width=".8" opacity=".3"/><circle cx="16" cy="37.5" r="3" fill="#4ade80" opacity=".3"/><rect x="10" y="45" width="100" height="9" rx="3" fill="#0d1b2f" stroke="#a8b5c7" stroke-width=".8" opacity=".2"/><circle cx="16" cy="49.5" r="3" fill="none" stroke="#a8b5c7" stroke-width=".8" opacity=".3"/></svg>' },
      { name: 'Comparison Lab', desc: 'Side-by-side breakdowns of commonly confused pairs.', view: 'comparison', previewClass: 'module-preview-coral',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="5" y="8" width="45" height="44" rx="5" fill="#0d1b2f" stroke="#38bdf8" stroke-width="1" opacity=".3"/><rect x="70" y="8" width="45" height="44" rx="5" fill="#0d1b2f" stroke="#ef6f61" stroke-width="1" opacity=".3"/><circle cx="60" cy="30" r="10" fill="#ef6f61" opacity=".08" stroke="#ef6f61" stroke-width="1.5" opacity=".4"/><text x="60" y="33" fill="#ef6f61" font-size="7" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif" opacity=".6">VS</text><text x="27" y="25" fill="#38bdf8" font-size="6" text-anchor="middle" font-family="Inter,sans-serif" opacity=".5">Term A</text><text x="92" y="25" fill="#ef6f61" font-size="6" text-anchor="middle" font-family="Inter,sans-serif" opacity=".5">Term B</text></svg>' },
      { name: 'Misconception Lab', desc: 'Common wrong ideas corrected with CED-accurate explanations.', view: 'misconceptions', previewClass: 'module-preview-coral',
        preview: '<svg viewBox="0 0 120 60" fill="none"><rect x="5" y="5" width="110" height="22" rx="4" fill="#ef6f61" opacity=".06" stroke="#ef6f61" stroke-width=".8" opacity=".3"/><path d="M12 12 L18 18 M18 12 L12 18" stroke="#ef6f61" stroke-width="1.5" opacity=".5"/><rect x="22" y="11" width="50" height="3" rx="1" fill="#ef6f61" opacity=".2"/><rect x="5" y="32" width="110" height="22" rx="4" fill="#4ade80" opacity=".06" stroke="#4ade80" stroke-width=".8" opacity=".3"/><path d="M10 42 L14 46 L22 38" fill="none" stroke="#4ade80" stroke-width="1.5" opacity=".5"/><rect x="28" y="40" width="50" height="3" rx="1" fill="#4ade80" opacity=".2"/></svg>' }
    ];
    const moduleColors = {
      'ced-map': '#38bdf8', 'vocab': '#22d3ee', 'visuals': '#ef6f61',
      'research': '#22d3ee', 'stats': '#a78bfa', 'aaq': '#2563eb',
      'ebq': '#2563eb', 'mcq': '#4ade80', 'comparison': '#f08a7d', 'misconceptions': '#ef6f61'
    };
    grid.innerHTML = modules.map((m, i) => {
      const mc = moduleColors[m.view] || '#38bdf8';
      return `
      <div class="module-card reveal-on-scroll" data-reveal-delay="${i * 80}" data-view="${h(m.view)}" style="--module-color:${mc}">
        <div class="module-card-accent"></div>
        <div class="module-card-preview ${h(m.previewClass)}">
          ${m.preview}
          <span class="module-card-badge" style="background:${mc}">${h(m.view).replace('-', ' ').toUpperCase()}</span>
        </div>
        <div class="module-card-body">
          <h3>${h(m.name)}</h3>
          <p>${h(m.desc)}</p>
          <div class="module-card-divider"></div>
          <div class="module-card-footer">
            <span class="ced-chip" style="font-size:9px;border-color:${mc};color:${mc}">${h(m.view).toUpperCase()}</span>
            <button class="btn btn-sm module-card-open-btn" style="border-color:${mc};color:${mc}">Open →</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  /* ── CED Map ──────────────────────────────────────────────── */
  function renderCEDMap() {
    if (!DATA.ced) return;
    const skillColors = {
      'Concept Application': '#22d3ee',
      'Research Methods and Design': '#38bdf8',
      'Data Interpretation': '#a78bfa',
      'Argumentation': '#ef6f61'
    };
    const c = el('cedMapContainer');
    c.innerHTML = DATA.ced.units.map(u => {
      const loCount = u.topics.reduce((s, t) => s + t.learningObjectives.length, 0);
      return `
      <div class="ced-unit-section" style="--unit-color:${h(u.color)}">
        <div class="ced-unit-accent"></div>
        <div class="ced-unit-header" data-toggle="ced-body-${u.id}">
          <div class="ced-unit-header-left">
            <span class="ced-unit-num">Unit ${u.id}</span>
            <h3>${h(u.title)}</h3>
            <div class="ced-unit-meta">
              <span class="ced-unit-weight">${h(u.weight)}</span>
              <span class="ced-unit-count">${u.topics.length} topics · ${loCount} LOs</span>
            </div>
          </div>
          <svg class="ced-unit-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="ced-unit-body" id="ced-body-${u.id}">
          ${u.topics.map(t => `
            <div class="ced-topic" style="--unit-color:${h(u.color)}">
              <div class="ced-topic-header" data-toggle="ced-topic-${h(t.id)}">
                <div class="ced-topic-header-left">
                  <span class="ced-chip">${h(t.id)}</span>
                  <span class="ced-topic-name">${h(t.title)}</span>
                </div>
                <span class="ced-topic-lo-count">${t.learningObjectives.length} LO${t.learningObjectives.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="ced-topic-body" id="ced-topic-${h(t.id)}">
                ${t.learningObjectives.map(lo => `
                  <div class="ced-lo">
                    <div class="ced-lo-header">
                      <span class="ced-lo-badge">${h(lo.code)}</span>
                      ${lo.skills.map(s => `<span class="ced-skill-pill" style="--skill-color:${skillColors[s] || '#a8b5c7'}">${h(s)}</span>`).join('')}
                    </div>
                    <div class="ced-lo-text">${h(lo.text)}</div>
                    <ul class="ced-ek-list">
                      ${lo.essentialKnowledge.map((ek, ei) => `<li class="ced-ek-item${ei % 2 === 0 ? ' ced-ek-even' : ''}">${h(ek)}</li>`).join('')}
                    </ul>
                    ${lo.examNotes ? `<div class="ced-exam-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>${h(lo.examNotes)}</span></div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }).join('');

    // Unit toggle
    c.querySelectorAll('.ced-unit-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const body = el(hdr.dataset.toggle);
        if (body) body.classList.toggle('collapsed');
        hdr.closest('.ced-unit-section').classList.toggle('ced-collapsed');
      });
    });
    // Topic toggle
    c.querySelectorAll('.ced-topic-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const body = el(hdr.dataset.toggle);
        if (body) body.classList.toggle('collapsed');
        hdr.closest('.ced-topic').classList.toggle('ced-topic-collapsed');
      });
    });
  }

  /* ── Vocab Atlas ──────────────────────────────────────────── */
  function renderVocab() {
    if (!DATA.vocab) return;
    const filters = el('vocabFilters');
    const categories = ['All', ...new Set(DATA.vocab.map(v => v.category))];
    filters.innerHTML = categories.map(c => `
      <button class="vocab-filter-btn ${c === 'All' ? 'active' : ''}" data-filter="${c.toLowerCase()}">${c}</button>
    `).join('');
    filters.querySelectorAll('.vocab-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vocabFilter = btn.dataset.filter;
        filters.querySelectorAll('.vocab-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === vocabFilter));
        renderVocabGrid();
      });
    });
    renderVocabGrid();
  }

  function renderVocabGrid() {
    if (!DATA.vocab) return;
    const grid = el('vocabGrid');
    const filtered = vocabFilter === 'all' ? DATA.vocab : DATA.vocab.filter(v => v.category.toLowerCase() === vocabFilter);
    grid.innerHTML = filtered.map(v => `
      <div class="vocab-card" data-vocab-id="${v.id}">
        <div class="vocab-card-header">
          <span class="vocab-card-term">${h(v.term)}</span>
          <span class="ced-chip">${h(v.topic)}</span>
        </div>
        <div class="vocab-card-tags">
          ${v.tags.map(t => `<span class="tag tag-${t.toLowerCase()}">${h(t)}</span>`).join('')}
        </div>
        <div class="vocab-card-def">${h(v.definition)}</div>
        ${v.memoryHook ? `<div class="vocab-card-hook">${h(v.memoryHook)}</div>` : ''}
      </div>
    `).join('');

    grid.querySelectorAll('.vocab-card').forEach(card => {
      card.addEventListener('click', () => openVocabDrawer(parseInt(card.dataset.vocabId)));
    });
  }

  function openVocabDrawer(id) {
    const v = DATA.vocab.find(x => x.id === id);
    if (!v) return;
    const content = el('vocabDrawerContent');
    content.innerHTML = `
      <h2 style="font-size:22px;font-weight:700;margin-bottom:4px;padding-right:40px">${h(v.term)}</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        <span class="ced-chip">Unit ${v.unit} &middot; ${h(v.topic)}</span>
        ${v.tags.map(t => `<span class="tag tag-${t.toLowerCase()}">${h(t)}</span>`).join('')}
      </div>
      <div class="vocab-drawer-section">
        <div class="vocab-drawer-label">Definition</div>
        <p style="font-size:14px;color:var(--text-soft);line-height:1.7">${h(v.definition)}</p>
      </div>
      ${v.memoryHook ? `<div class="vocab-drawer-section"><div class="vocab-drawer-label">Memory Hook</div><p style="font-size:13px;color:var(--synapse-yellow);font-style:italic;line-height:1.6">${h(v.memoryHook)}</p></div>` : ''}
      ${v.stepByStep ? `<div class="vocab-drawer-section"><div class="vocab-drawer-label">Step-by-Step</div><p style="font-size:13px;color:var(--text-soft);line-height:1.7;white-space:pre-line">${h(v.stepByStep)}</p></div>` : ''}
      ${v.scenario ? `<div class="vocab-drawer-section"><div class="vocab-drawer-label">Scenario Application</div><p style="font-size:13px;color:var(--text-soft);line-height:1.7">${h(v.scenario)}</p></div>` : ''}
      ${v.frqSentence ? `<div class="vocab-drawer-section"><div class="vocab-drawer-label">FRQ Sentence</div><div class="stats-interpretation">${h(v.frqSentence)}</div></div>` : ''}
      ${v.confusedWith ? `<div class="vocab-drawer-section"><div class="vocab-drawer-label">Confused With</div><div class="stats-warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span><strong>${h(v.confusedWith)}</strong></span></div></div>` : ''}
      ${v.badSentence ? `<div class="vocab-drawer-section"><div class="vocab-drawer-label">Common Mistake</div><p style="font-size:13px;color:var(--coral-primary);line-height:1.6;text-decoration:line-through;opacity:0.8">${h(v.badSentence)}</p><p style="font-size:13px;color:var(--success);line-height:1.6;margin-top:8px">${h(v.correctedSentence)}</p></div>` : ''}
    `;
    el('vocabDrawer').classList.add('open');
    el('vocabBackdrop').classList.add('open');
  }

  function closeVocabDrawer() {
    el('vocabDrawer').classList.remove('open');
    el('vocabBackdrop').classList.remove('open');
  }

  /* ── Visual Concept Atlas — Museum Exhibit Layout ─────────── */
  let visualFilter = 'all';

  function renderVisuals() {
    if (!DATA.visuals) return;
    renderExhibitFilter();
    renderExhibitPanels();
  }

  function renderExhibitFilter() {
    const filterEl = el('exhibitFilter');
    if (!filterEl) return;
    const units = [
      { key: 'all', label: 'All Diagrams' },
      { key: '1', label: 'Unit 1: Bio' },
      { key: '2', label: 'Unit 2: Cog' },
      { key: '3', label: 'Unit 3: Learn' },
      { key: '0', label: 'Science Practices' }
    ];
    filterEl.innerHTML = units.map(u =>
      `<button class="exhibit-filter-btn ${u.key === visualFilter ? 'active' : ''}" data-unit-filter="${u.key}">${u.label}</button>`
    ).join('');
    filterEl.querySelectorAll('.exhibit-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        visualFilter = btn.dataset.unitFilter;
        filterEl.querySelectorAll('.exhibit-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.unitFilter === visualFilter));
        renderExhibitPanels();
      });
    });
  }

  function renderExhibitPanels() {
    if (!DATA.visuals) return;
    const container = el('exhibitPanels');
    if (!container) return;

    const filtered = visualFilter === 'all' ? DATA.visuals : DATA.visuals.filter(v => String(v.unit) === visualFilter);

    container.innerHTML = filtered.map((v, idx) => `
      <div class="exhibit-panel reveal-on-scroll" data-reveal-delay="${idx * 60}" data-diagram="${h(v.diagramType)}">
        <div class="exhibit-diagram" id="diagram-${h(v.diagramType)}"></div>
        <div class="exhibit-sidebar">
          <div class="exhibit-header">
            <div class="exhibit-number">${String(idx + 1).padStart(2, '0')} / ${h(v.diagramType).toUpperCase()}</div>
            <h3 class="exhibit-title">${h(v.title)}</h3>
            <p class="exhibit-desc">${h(v.description)}</p>
            <div class="exhibit-badges">
              <span class="ced-chip">${h(v.cedCode)}</span>
              ${v.frqRelevance ? `<span class="frq-badge">FRQ: ${h(v.frqRelevance)}</span>` : ''}
              ${v.tags ? v.tags.map(t => `<span class="tag tag-${t.toLowerCase()}">${h(t)}</span>`).join('') : ''}
            </div>
          </div>
          <div class="exhibit-steps">
            <div class="exhibit-steps-label">Step-by-Step</div>
            ${v.steps.map((s, si) => `
              <div class="exhibit-step" data-step="${si}">
                <span class="exhibit-step-num">${si + 1}</span>
                <span class="exhibit-step-text">${h(s)}</span>
              </div>
            `).join('')}
          </div>
          <div class="exhibit-principle">${h(v.keyPrinciple)}</div>
        </div>
      </div>
      ${idx < filtered.length - 1 ? '<div class="exhibit-divider"></div>' : ''}
    `).join('');

    // Step click highlighting
    container.querySelectorAll('.exhibit-step').forEach(step => {
      step.addEventListener('click', () => {
        const panel = step.closest('.exhibit-panel');
        panel.querySelectorAll('.exhibit-step').forEach(s => s.classList.remove('active'));
        step.classList.add('active');
      });
    });

    // Render SVG diagrams
    renderAllDiagrams();

    // Re-init scroll reveals for new elements
    if (typeof PsycheAnimations !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const delay = parseInt(entry.target.dataset.revealDelay || '0');
            setTimeout(() => entry.target.classList.add('revealed'), delay);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      container.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach(e => observer.observe(e));
    }
  }

  const DIAGRAM_MAP = {
    neuronFiring: 'createNeuronFiringDiagram',
    synapse: 'createSynapseDiagram',
    operantQuadrant: 'createOperantQuadrant',
    normalCurve: 'createNormalCurve',
    classicalConditioning: 'createClassicalConditioning',
    memoryModel: 'createMemoryModel',
    brainRegions: 'createBrainRegionMap',
    sleepCycle: 'createSleepCycleGraph',
    eriksonStages: 'createEriksonStages',
    researchDesign: 'createResearchDesignTree'
  };

  function renderAllDiagrams() {
    if (typeof NeuroVisuals === 'undefined') return;
    Object.entries(DIAGRAM_MAP).forEach(([type, fn]) => {
      const container = document.getElementById('diagram-' + type);
      if (container && NeuroVisuals[fn]) NeuroVisuals[fn](container);
    });
  }

  /* ── Research Methods Lab ─────────────────────────────────── */
  function renderResearchLab() {
    if (!DATA.research) return;
    const c = el('researchLabContainer');
    const r = DATA.research;
    c.innerHTML = `
      <div class="research-panel">
        <div class="research-panel-header">
          <h3 style="color:var(--cyan-glow)">Experimental vs Non-Experimental</h3>
          <div class="research-toggle">
            <button class="research-toggle-btn active" data-type="experimental">Experimental</button>
            <button class="research-toggle-btn" data-type="non-experimental">Non-Experimental</button>
          </div>
        </div>
        <div id="researchContent"></div>
      </div>
      <div class="research-panel">
        <div class="research-panel-header"><h3>Sampling Methods</h3></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          ${r.sampling.methods.map(m => `
            <div class="variable-card">
              <div class="variable-card-label iv">${h(m.name)}</div>
              <p style="font-size:13px;color:var(--text-soft);line-height:1.6">${h(m.description)}</p>
              ${m.weakness ? `<div class="stats-warning mt-4" style="margin-top:8px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>${h(m.weakness || '')}</span></div>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="stats-warning mt-4" style="margin-top:16px;background:rgba(247,201,72,0.08);border-left-color:var(--synapse-yellow)">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--synapse-yellow)" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span style="color:var(--synapse-yellow)"><strong>Random Sampling</strong> = how you SELECT participants. <strong>Random Assignment</strong> = how you PLACE them into groups.</span>
        </div>
      </div>
      <div class="research-panel">
        <div class="research-panel-header"><h3>Ethics Checklist</h3></div>
        <ul class="ethics-checklist">
          ${r.ethics.guidelines.map(g => `<li><strong>${h(g.name)}:</strong> ${h(g.description)}</li>`).join('')}
        </ul>
      </div>
      <div class="research-panel">
        <div class="research-panel-header"><h3>Practice Scenarios</h3></div>
        ${r.scenarios.map(s => `
          <div class="neuro-card mb-4" style="margin-bottom:16px">
            <h4 style="font-size:15px;font-weight:700;margin-bottom:8px">${h(s.title)}</h4>
            <p style="font-size:13px;color:var(--text-soft);line-height:1.6;margin-bottom:12px">${h(s.description)}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span class="practice-chip">${h(s.designType)}</span>
              <span class="practice-chip" style="${s.canEstablishCausation ? 'color:var(--success);border-color:rgba(74,222,128,0.3);background:rgba(74,222,128,0.08)' : 'color:var(--coral-primary);border-color:var(--border-neuron);background:var(--coral-dim)'}">
                ${s.canEstablishCausation ? 'Can establish causation' : 'Cannot establish causation'}
              </span>
            </div>
            ${s.iv ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div class="variable-card"><div class="variable-card-label iv">IV</div><p style="font-size:12px;color:var(--text-soft)">${h(s.iv)}</p></div><div class="variable-card"><div class="variable-card-label dv">DV</div><p style="font-size:12px;color:var(--text-soft)">${h(s.dv)}</p></div></div>` : ''}
            ${s.warning ? `<div class="stats-warning mt-4" style="margin-top:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>${h(s.warning)}</span></div>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    renderResearchType('experimental');
    c.querySelectorAll('.research-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        c.querySelectorAll('.research-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderResearchType(btn.dataset.type);
      });
    });
  }

  function renderResearchType(type) {
    const r = DATA.research;
    const container = document.getElementById('researchContent');
    if (!container) return;
    if (type === 'experimental') {
      container.innerHTML = `
        <p style="font-size:14px;color:var(--text-soft);line-height:1.7;margin-bottom:16px">${h(r.experimentalDesign.description)}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
          ${r.experimentalDesign.keyComponents.map(kc => `
            <div class="variable-card" style="border-left-color:var(--${kc.color === 'coral' ? 'coral-primary' : kc.color === 'cyan' ? 'cyan-glow' : 'blue-primary'})">
              <div class="variable-card-label" style="color:var(--${kc.color === 'coral' ? 'coral-primary' : kc.color === 'cyan' ? 'cyan-glow' : 'blue-primary'})">${h(kc.name)}</div>
              <p style="font-size:12px;color:var(--text-soft);line-height:1.5">${h(kc.description)}</p>
            </div>
          `).join('')}
        </div>
        <h4 style="font-size:13px;font-weight:700;margin:20px 0 10px;color:var(--text-main)">Procedures</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
          ${r.experimentalDesign.procedures.map(p => `
            <div class="neuro-card" style="padding:12px"><strong style="font-size:12px;color:var(--blue-primary)">${h(p.name)}</strong><p style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.5">${h(p.description)}</p></div>
          `).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <p style="font-size:14px;color:var(--text-soft);line-height:1.7;margin-bottom:16px">${h(r.nonExperimentalMethods.description)}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${r.nonExperimentalMethods.methods.map(m => `
            <div class="neuro-card" style="padding:16px">
              <strong style="font-size:14px;color:var(--text-main)">${h(m.name)}</strong>
              <p style="font-size:12px;color:var(--text-soft);line-height:1.6;margin:8px 0">${h(m.description)}</p>
              <div style="font-size:11px;color:var(--success);margin-bottom:4px">✓ ${h(m.strength)}</div>
              <div style="font-size:11px;color:var(--coral-primary)">✗ ${h(m.limitation)}</div>
            </div>
          `).join('')}
        </div>
        <div class="stats-warning mt-4" style="margin-top:16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Correlation does NOT equal causation. The third variable problem is specific to correlational research.</span>
        </div>
      `;
    }
  }

  /* ── Data & Stats Lab ─────────────────────────────────────── */
  function renderStatsLab() {
    if (!DATA.stats) return;
    const c = el('statsLabContainer');
    const s = DATA.stats;
    c.innerHTML = `
      <div class="stats-panel">
        <div class="stats-panel-header"><h3 style="font-size:16px;font-weight:700">Normal Distribution</h3></div>
        <div class="stats-graph-area" id="normalCurveStats"></div>
        <div class="stats-interpretation">In a normal distribution, the mean, median, and mode are all equal and located at the center. The empirical rule states: 68% within ±1σ, 95% within ±2σ, 99.7% within ±3σ.</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="stats-panel">
          <div class="stats-panel-header"><h3 style="font-size:16px;font-weight:700;color:var(--coral-primary)">Effect Size</h3></div>
          <p style="font-size:13px;color:var(--text-soft);line-height:1.7;margin-bottom:12px">${h(s.effectSizeVsSignificance.effectSize.definition)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <span class="confidence-badge low">Small: ${h(s.effectSizeVsSignificance.effectSize.scale.small)}</span>
            <span class="confidence-badge medium">Medium: ${h(s.effectSizeVsSignificance.effectSize.scale.medium)}</span>
            <span class="confidence-badge high">Large: ${h(s.effectSizeVsSignificance.effectSize.scale.large)}</span>
          </div>
          <p style="font-size:12px;color:var(--text-muted)">Answers: <strong>${h(s.effectSizeVsSignificance.effectSize.question)}</strong></p>
        </div>
        <div class="stats-panel">
          <div class="stats-panel-header"><h3 style="font-size:16px;font-weight:700;color:var(--blue-primary)">Statistical Significance</h3></div>
          <p style="font-size:13px;color:var(--text-soft);line-height:1.7;margin-bottom:12px">${h(s.effectSizeVsSignificance.statisticalSignificance.definition)}</p>
          <div style="margin-bottom:12px"><span class="practice-chip">Threshold: ${h(s.effectSizeVsSignificance.statisticalSignificance.threshold)}</span></div>
          <p style="font-size:12px;color:var(--text-muted)">Answers: <strong>${h(s.effectSizeVsSignificance.statisticalSignificance.question)}</strong></p>
        </div>
      </div>
      <div class="stats-warning mt-4" style="margin-top:20px;font-size:14px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span><strong>Key Distinction:</strong> ${h(s.effectSizeVsSignificance.keyDistinction)}</span>
      </div>
      <div class="stats-panel mt-8" style="margin-top:32px">
        <div class="stats-panel-header"><h3 style="font-size:16px;font-weight:700">Measures of Central Tendency</h3></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${s.measuresOfCentralTendency.measures.map(m => `
            <div class="neuro-card" style="text-align:center;padding:20px">
              <h4 style="font-size:18px;font-weight:700;color:var(--blue-primary);margin-bottom:8px">${h(m.name)}</h4>
              <p style="font-size:12px;color:var(--text-soft);line-height:1.6">${h(m.description)}</p>
              ${m.formula ? `<code style="display:block;margin-top:8px;font-family:var(--font-mono);font-size:13px;color:var(--cyan-glow)">${h(m.formula)}</code>` : ''}
              <p style="font-size:11px;color:var(--text-muted);margin-top:8px">${h(m.sensitivity)}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="stats-panel mt-8" style="margin-top:20px">
        <div class="stats-panel-header"><h3 style="font-size:16px;font-weight:700">Distributions</h3></div>
        ${s.distributions.types.map(d => `
          <div class="neuro-card mb-4" style="margin-bottom:12px">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:6px">${h(d.name)}</h4>
            <p style="font-size:13px;color:var(--text-soft);line-height:1.6">${h(d.description)}</p>
            ${d.relationship ? `<p style="font-size:12px;color:var(--cyan-glow);margin-top:6px;font-family:var(--font-mono)">${h(d.relationship)}</p>` : ''}
            ${d.example ? `<p style="font-size:11px;color:var(--text-muted);margin-top:4px">Example: ${h(d.example)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;

    if (typeof NeuroVisuals !== 'undefined') {
      const nc = document.getElementById('normalCurveStats');
      if (nc) NeuroVisuals.createNormalCurve(nc);
    }
  }

  /* ── AAQ Trainer ──────────────────────────────────────────── */
  function renderAAQ() {
    if (!DATA.frq) return;
    const c = el('aaqContainer');
    const aaq = DATA.frq.aaq;
    const prompt = aaq.practicePrompts[0];
    c.innerHTML = `
      <div class="frq-layout">
        <div class="frq-source-panel">
          <h3>Research Stimulus</h3>
          <p class="frq-source-text">${h(prompt.stimulus)}</p>
        </div>
        <div class="frq-task-panel">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Tasks</h3>
          ${Object.entries(prompt.tasks).map(([part, task]) => `
            <div class="frq-task-item">
              <div class="frq-task-label">Part ${part}</div>
              <div class="frq-task-prompt">${h(task)}</div>
            </div>
          `).join('')}
        </div>
        <div class="frq-rubric-panel">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Scoring Checklist</h3>
          ${aaq.scoringChecklist.map(item => `
            <div class="frq-rubric-item">
              <div class="frq-rubric-check" tabindex="0" role="checkbox" aria-checked="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg></div>
              <div><strong style="color:var(--blue-primary)">Part ${h(item.part)}:</strong> ${h(item.task)}<br><span style="font-size:11px;color:var(--text-muted)">${h(item.tip)}</span></div>
            </div>
          `).join('')}
          <div class="neuron-divider" style="margin:16px 0"></div>
          <h4 style="font-size:12px;font-weight:700;color:var(--coral-primary);margin-bottom:8px">Common Warnings</h4>
          ${aaq.commonWarnings.map(w => `<div class="frq-task-warning"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${h(w)}</div>`).join('')}
        </div>
      </div>
    `;
    initRubricChecks(c);
  }

  /* ── EBQ Trainer ──────────────────────────────────────────── */
  function renderEBQ() {
    if (!DATA.frq) return;
    const c = el('ebqContainer');
    const ebq = DATA.frq.ebq;
    const prompt = ebq.practicePrompts[0];
    c.innerHTML = `
      <div class="frq-layout">
        <div class="frq-source-panel">
          <h3>Sources</h3>
          ${prompt.sources.map(s => `
            <div class="neuro-card mb-4" style="margin-bottom:12px">
              <div style="font-size:11px;font-weight:700;color:var(--blue-primary);margin-bottom:4px">${h(s.id)} — ${h(s.type)}</div>
              <p style="font-size:13px;color:var(--text-soft);line-height:1.7">${h(s.content)}</p>
            </div>
          `).join('')}
        </div>
        <div class="frq-task-panel">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Your Task</h3>
          <div class="frq-task-item">
            <div class="frq-task-prompt">${h(prompt.task)}</div>
          </div>
        </div>
        <div class="frq-rubric-panel">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Scoring Checklist</h3>
          ${ebq.scoringChecklist.map(item => `
            <div class="frq-rubric-item">
              <div class="frq-rubric-check" tabindex="0" role="checkbox" aria-checked="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg></div>
              <div><strong style="color:var(--blue-primary)">${h(item.part)}:</strong> ${h(item.task)}<br><span style="font-size:11px;color:var(--text-muted)">${h(item.tip)}</span></div>
            </div>
          `).join('')}
          <div class="neuron-divider" style="margin:16px 0"></div>
          <h4 style="font-size:12px;font-weight:700;color:var(--coral-primary);margin-bottom:8px">Common Warnings</h4>
          ${ebq.commonWarnings.map(w => `<div class="frq-task-warning"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>${h(w)}</div>`).join('')}
        </div>
      </div>
    `;
    initRubricChecks(c);
  }

  function initRubricChecks(container) {
    container.querySelectorAll('.frq-rubric-check').forEach(check => {
      check.addEventListener('click', () => {
        const checked = check.classList.toggle('checked');
        check.setAttribute('aria-checked', checked);
      });
      check.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); check.click(); }});
    });
  }

  /* ── MCQ Practice ─────────────────────────────────────────── */
  function renderMCQ() {
    if (!DATA.mcq || !DATA.mcq.length) return;
    const c = el('mcqContainer');
    let currentQ = 0;

    function showQuestion(idx) {
      const q = DATA.mcq[idx];
      c.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <span style="font-size:12px;color:var(--text-muted)">Question ${idx + 1} of ${DATA.mcq.length}</span>
          <div style="display:flex;gap:6px">
            <span class="ced-chip">Unit ${q.unit || 'SP'}</span>
            <span class="practice-chip">${h(q.topic)}</span>
          </div>
        </div>
        ${q.stimulus ? `<div class="mcq-stimulus">${h(q.stimulus)}</div>` : ''}
        <div class="mcq-question">${h(q.question)}</div>
        <div id="mcqOptions">
          ${q.options.map(o => `
            <div class="mcq-option" data-letter="${o.letter}" tabindex="0">
              <span class="mcq-option-letter">${o.letter}</span>
              <span>${h(o.text)}</span>
            </div>
          `).join('')}
        </div>
        <div id="mcqFeedback" style="display:none">
          <div class="mcq-explanation" id="mcqExplanation"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:20px;justify-content:center">
          <button class="btn" id="mcqPrev" ${idx === 0 ? 'disabled style="opacity:0.4"' : ''}>← Previous</button>
          <button class="btn btn-primary" id="mcqNext">${idx < DATA.mcq.length - 1 ? 'Next →' : 'Restart'}</button>
        </div>
      `;

      let answered = false;
      c.querySelectorAll('.mcq-option').forEach(opt => {
        const handler = () => {
          if (answered) return;
          answered = true;
          const letter = opt.dataset.letter;
          opt.classList.add(letter === q.correct ? 'correct' : 'incorrect');
          if (letter !== q.correct) {
            c.querySelector(`.mcq-option[data-letter="${q.correct}"]`).classList.add('correct');
          }
          el('mcqExplanation').textContent = q.explanation;
          el('mcqFeedback').style.display = 'block';
        };
        opt.addEventListener('click', handler);
        opt.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
      });

      el('mcqPrev')?.addEventListener('click', () => { if (idx > 0) showQuestion(idx - 1); });
      el('mcqNext')?.addEventListener('click', () => showQuestion(idx < DATA.mcq.length - 1 ? idx + 1 : 0));
    }

    showQuestion(0);
  }

  /* ── Comparison Lab ───────────────────────────────────────── */
  function renderComparisons() {
    if (!DATA.comparison) return;
    const c = el('comparisonContainer');
    c.innerHTML = DATA.comparison.map(item => `
      <div class="comparison-card">
        <div class="comparison-side">
          <h4>${h(item.termA)}</h4>
          <p>${h(item.descriptionA)}</p>
        </div>
        <div class="comparison-vs">VS</div>
        <div class="comparison-side">
          <h4>${h(item.termB)}</h4>
          <p>${h(item.descriptionB)}</p>
        </div>
      </div>
      <div class="stats-interpretation" style="margin:-12px 0 20px;font-size:12px"><strong>Key Difference:</strong> ${h(item.keyDifference)}</div>
      ${item.examTip ? `<div class="stats-warning" style="margin-bottom:28px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>${h(item.examTip)}</span></div>` : ''}
    `).join('');
  }

  /* ── Misconception Lab ────────────────────────────────────── */
  function renderMisconceptions() {
    if (!DATA.misconception) return;
    const c = el('misconceptionContainer');
    c.innerHTML = DATA.misconception.map(item => `
      <div class="mistake-card">
        <div class="mistake-card-wrong">
          <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></span>
          <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--coral-primary);margin-bottom:4px">${h(item.topic)} — Unit ${item.unit || 'SP'}</div>
            <p style="font-size:13px;color:var(--coral-soft);line-height:1.6">${h(item.wrong)}</p>
          </div>
        </div>
        <div class="mistake-card-correct">
          <span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg></span>
          <div>
            <p style="font-size:13px;color:var(--text-soft);line-height:1.6">${h(item.correct)}</p>
            ${item.clarification ? `<p style="font-size:11px;color:var(--synapse-yellow);margin-top:6px;font-style:italic">${h(item.clarification)}</p>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ── Flashcards ───────────────────────────────────────────── */
  function renderFlashcards() {
    if (!DATA.vocab || !DATA.vocab.length) return;
    showFlashcard(0);
  }

  function showFlashcard(idx) {
    if (!DATA.vocab) return;
    flashcardIdx = idx;
    const v = DATA.vocab[idx];
    const c = el('flashcardContainer');
    c.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${idx + 1} / ${DATA.vocab.length}</div>
      <div class="flashcard" id="flashcard">
        <div class="flashcard-inner">
          <div class="flashcard-front">
            <div style="display:flex;gap:6px;margin-bottom:12px">${v.tags.map(t => `<span class="tag tag-${t.toLowerCase()}">${h(t)}</span>`).join('')}</div>
            <h3>${h(v.term)}</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-top:8px">Click to reveal</p>
          </div>
          <div class="flashcard-back">
            <p>${h(v.definition)}</p>
            ${v.memoryHook ? `<p style="margin-top:12px;font-size:13px;color:var(--synapse-yellow);font-style:italic">${h(v.memoryHook)}</p>` : ''}
            ${v.frqSentence ? `<p style="margin-top:12px;font-size:12px;color:var(--blue-primary)">FRQ: ${h(v.frqSentence)}</p>` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <button class="btn" id="fcPrev" ${idx === 0 ? 'disabled style="opacity:0.4"' : ''}>← Previous</button>
        <button class="btn btn-primary" id="fcNext">${idx < DATA.vocab.length - 1 ? 'Next →' : 'Restart'}</button>
      </div>
    `;
    el('flashcard').addEventListener('click', () => el('flashcard').classList.toggle('flipped'));
    el('fcPrev')?.addEventListener('click', () => { if (idx > 0) showFlashcard(idx - 1); });
    el('fcNext')?.addEventListener('click', () => showFlashcard(idx < DATA.vocab.length - 1 ? idx + 1 : 0));
  }

  /* ── Night Before ─────────────────────────────────────────── */
  const NB_SECTIONS = [
    { id: 'bio', title: 'Biological Bases', color: '#ef6f61', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="4"/><path d="M12 14v6"/><path d="M8 7Q5 4 3 3"/><path d="M16 7Q19 4 21 3"/></svg>' },
    { id: 'sense', title: 'Sensation & Consciousness', color: '#38bdf8', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 5v-2"/><path d="M12 21v-2"/><path d="M5 12H3"/><path d="M21 12h-2"/></svg>' },
    { id: 'learn', title: 'Learning & Memory', color: '#a78bfa', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>' },
    { id: 'social', title: 'Social & Personality', color: '#f08a7d', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
    { id: 'research', title: 'Research & FRQ Skills', color: '#22d3ee', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>' }
  ];

  const NB_CARDS = [
    // ── BIOLOGICAL BASES ──
    { section: 'bio', title: 'Neuron Firing', badge: 'high-yield', content: 'Resting potential (−70mV) → stimulus reaches threshold → depolarization (sodium rushes in) → action potential travels down axon → refractory period. All-or-none: fires completely or not at all. Neuron types: Sensory (in), Interneuron (process), Motor (out) = SIM.' },
    { section: 'bio', title: 'All-or-None Principle', badge: 'trap', content: 'Neuron fires completely or not at all. No partial firing. The correct term is all-or-none (not all-or-nothing). Intensity is coded by RATE of firing, not strength of individual signals.' },
    { section: 'bio', title: 'Neurotransmitter Triad', badge: 'high-yield', content: 'Agonist = mimics NT. Antagonist = blocks receptor. Reuptake inhibitor = prevents reabsorption (e.g. SSRIs). Presynaptic = sending neuron. Postsynaptic = receiving neuron. Synaptic cleft = gap between them.' },
    { section: 'bio', title: 'Neurotransmitters', badge: 'high-yield', content: 'Dopamine = reward/movement (excess → schizophrenia, deficit → Parkinson\'s). Serotonin = mood (deficit → depression). ACh = movement/memory (deficit → Alzheimer\'s). GABA = inhibitory. Glutamate = excitatory/memory. Norepinephrine = alertness. Endorphins = pain control.' },
    { section: 'bio', title: 'Brain Structures', badge: 'high-yield', content: 'Medulla = breathing/heart rate. Thalamus = sensory relay (NOT smell). Cerebellum = balance/coordination. Hippocampus = memory formation. Amygdala = fear/aggression. Hypothalamus = hunger/reward/pituitary. Broca\'s = speech production. Wernicke\'s = speech comprehension.' },
    { section: 'bio', title: 'Four Lobes', content: 'Frontal = decision/planning/personality (last to develop, contains motor cortex). Parietal = touch/pain (sensory cortex). Occipital = vision (back of head). Temporal = hearing/smell/memory (above ears). Left hemisphere = language/logic. Right = emotion/spatial.' },
    { section: 'bio', title: 'Drugs & Consciousness', content: 'Depressants (alcohol) = slow neural activity. Stimulants (caffeine, cocaine) = speed up. Hallucinogens (LSD, marijuana) = distort perception. Tolerance = need more for same effect. Dependence: physical + psychological. Only ~10% become addicted.' },
    { section: 'bio', title: 'Endocrine System', content: 'Pituitary = "master gland" (growth, oxytocin). Adrenal = fight-or-flight (adrenaline, cortisol). Thyroid = metabolism. Hormones are SLOW but long-lasting vs neurotransmitters (fast, brief). HPA axis: hypothalamus → pituitary → adrenals = stress response.' },
    { section: 'bio', title: 'Split Brain & Lateralization', content: 'Corpus callosum connects hemispheres. Severed = split brain. Left visual field → right hemisphere (can\'t name but can draw). Right field → left hemisphere (can name). Contralateral control: left brain controls right body.' },

    // ── SENSATION & CONSCIOUSNESS ──
    { section: 'sense', title: 'Sensation Thresholds', badge: 'high-yield', content: 'Absolute threshold = minimum stimulus detected 50% of time. Difference threshold (JND) = smallest detectable change. Weber\'s law = detection depends on proportional change (~10%). Sensory adaptation = stop noticing unchanging stimulus. Habituation = learned decrease in response.' },
    { section: 'sense', title: 'Vision Anatomy', content: 'Cornea → pupil → lens (accommodation) → retina. Rods = peripheral, B&W, motion. Cones = fovea, color, detail. Blind spot = where optic nerve exits. Trichromatic theory = 3 color receptors (RGB). Opponent-process = 3 opposing pairs → after-images.' },
    { section: 'sense', title: 'Depth & Perception', content: 'Binocular: retinal disparity + convergence. Monocular: relative size, texture gradient, interposition, linear perspective. Gestalt: figure-ground, proximity, similarity, continuity, closure. Perceptual constancy: size, shape, brightness stay stable despite input changes.' },
    { section: 'sense', title: 'Sleep Stages', badge: 'high-yield', content: 'NREM-1: transitioning, hypnagogic jerks. NREM-2: sleep spindles, 20 min. NREM-3: deep/delta waves, 30 min, sleepwalking here. REM: paradoxical (brain active, body paralyzed), dreaming, increases across night. Full cycle = 90 min. REM rebound after deprivation.' },
    { section: 'sense', title: 'Sleep & Circadian', content: 'SCN in hypothalamus controls circadian rhythm via melatonin. Light → less melatonin → more alert. Sleep debt is cumulative. Disorders: insomnia (10%), narcolepsy (straight to REM), sleep apnea (breathing stops). Why sleep: restoration, memory consolidation, growth.' },
    { section: 'sense', title: 'Signal Detection Theory', badge: 'frq', content: 'Decision-making about detecting stimuli depends on stimulus intensity AND psychological state (motivation, expectations). Four outcomes: hit, miss, false alarm, correct rejection. Explains why radiologists miss tumors or why you "hear" your name in noise.' },
    { section: 'sense', title: 'Attention & Blindness', content: 'Selective attention = focus on one thing (cocktail party effect). Inattentional blindness = fail to notice unexpected stimulus. Change blindness = fail to notice obvious change. Both show limits of conscious awareness.' },

    // ── LEARNING & MEMORY ──
    { section: 'learn', title: 'Classical vs Operant', badge: 'high-yield', content: 'Classical: two stimuli paired → involuntary response. Operant: behavior + consequence. Positive = add, Negative = remove, Reinforcement = increase behavior, Punishment = decrease behavior. Know the 2×2 grid cold.' },
    { section: 'learn', title: 'Conditioning Details', content: 'Classical = involuntary (Pavlov, Watson/Baby Albert). Operant = voluntary (Thorndike law of effect, Skinner box). Overjustification = rewards kill intrinsic motivation. Cons of punishment: suppresses not eliminates, teaches fear/aggression. Bandura Bobo doll = observational learning.' },
    { section: 'learn', title: 'Spontaneous Recovery', badge: 'trap', content: 'Applies to BOTH classical AND operant conditioning. Extinguished response reappears after rest period. Students often forget operant. Extinction ≠ forgetting — the association is suppressed, not erased.' },
    { section: 'learn', title: 'Schedules of Reinforcement', badge: 'high-yield', content: 'Fixed-ratio = after set number (piecework). Variable-ratio = unpredictable number (gambling, most resistant to extinction). Fixed-interval = first response after set time (scalloped pattern). Variable-interval = unpredictable time (checking email).' },
    { section: 'learn', title: 'Memory Models', content: 'Multi-store: sensory → short-term → long-term. Working memory: central executive + phonological loop + visuospatial sketchpad. Levels of processing: structural → phonemic → semantic (deepest = best).' },
    { section: 'learn', title: 'Memory Encoding', content: 'Ebbinghaus curve: forgetting is rapid then levels off. Spacing > cramming. Testing effect: practice tests = best prep. Serial position: primacy (beginning) + recency (end) remembered, middle forgotten. Self-reference effect boosts encoding. Chunking: 7±2 items.' },
    { section: 'learn', title: 'Retrieval & Forgetting', badge: 'frq', content: 'Recognition (MCQ) > recall (FRQ). Context-dependent = same place. State-dependent = same state. Mood-congruent = matching emotions. Proactive interference = old blocks new. Retroactive = new blocks old. Misinformation effect: post-event info alters memory.' },
    { section: 'learn', title: 'Interference', badge: 'trap', content: 'Proactive = old blocks new (PRO = forward). Retroactive = new blocks old (RETRO = backward). Mnemonics: proactive = old PROjects forward. retroactive = new RETRO-fits backward. Both are retrieval failures, not storage failures.' },
    { section: 'learn', title: 'Piaget\'s Stages', badge: 'high-yield', content: 'Sensorimotor (0–2): object permanence. Preoperational (2–7): egocentrism, no conservation. Concrete operational (7–11): conservation, logical for concrete. Formal operational (12+): abstract thought, hypothetical reasoning. Schema → assimilation vs accommodation.' },
    { section: 'learn', title: 'Language Development', content: 'Babbling (4–6 mo, all sounds). One-word (12 mo). Two-word telegraphic (24 mo). Overextension = calling all animals "doggy." Critical period hypothesis (Lenneberg). Chomsky: LAD (innate grammar device). Skinner: reinforcement shapes language.' },

    // ── SOCIAL & PERSONALITY ──
    { section: 'social', title: 'The 7 Perspectives', badge: 'high-yield', content: 'Biological, Behavioral, Cognitive, Humanistic, Psychodynamic, Sociocultural, Evolutionary. Be ready to apply EACH to a scenario, compare them, and draw conclusions. This is the #1 most versatile FRQ skill.' },
    { section: 'social', title: 'Attribution Biases', badge: 'high-yield', content: 'FAE = blame others\' disposition, ignore situation. Actor-observer = their failures are dispositional, mine are situational. Self-serving = my success is me, my failure is the situation. Culture matters: collectivist cultures show less FAE.' },
    { section: 'social', title: 'Group Influence', content: 'Social facilitation = others watching helps easy tasks, hurts hard ones. Social loafing = less effort in groups. Deindividuation = losing identity → mob behavior. Group polarization = discussions make views extreme. Groupthink = harmony over honesty.' },
    { section: 'social', title: 'Conformity vs Obedience', badge: 'frq', content: 'Conformity = matching group without direct orders (Asch line study, 37%). Obedience = following authority (Milgram, 65%). Normative influence = fit in. Informational influence = they must know better. Factors: unanimity, proximity, legitimacy.' },
    { section: 'social', title: 'Bystander Effect', content: 'More bystanders = LESS help (diffusion of responsibility). Decision tree: notice → interpret as emergency → assume responsibility → know how → act. Altruism = selfless helping. Reciprocity norm. Social responsibility norm.' },
    { section: 'social', title: 'Positive vs Negative Symptoms', badge: 'trap', content: 'Schizophrenia: Positive = ADDED (hallucinations, delusions, disorganized speech). Negative = ABSENT (flat affect, social withdrawal, avolition). NOT good/bad. Dopamine hypothesis: excess dopamine activity.' },
    { section: 'social', title: 'Psychological Disorders', badge: 'high-yield', content: 'Anxiety: GAD (chronic worry), phobias (specific), panic disorder, OCD. Mood: MDD (2+ weeks), bipolar. Personality: antisocial (no remorse). Dissociative: DID. Biomedical model vs biopsychosocial model. DSM-5 = classification system.' },
    { section: 'social', title: 'Therapy Approaches', content: 'Psychoanalysis: free association, dream analysis. CBT: change thoughts → change behavior. Humanistic: unconditional positive regard (Rogers). Biomedical: drugs (SSRIs, antipsychotics), ECT. Systematic desensitization = gradual exposure + relaxation.' },
    { section: 'social', title: 'Motivation & Emotion', content: 'Maslow hierarchy: physiological → safety → belonging → esteem → self-actualization. Drive reduction theory: homeostasis. Incentive theory: external pulls. James-Lange: body first → emotion. Cannon-Bard: simultaneous. Schachter-Singer: arousal + label.' },
    { section: 'social', title: 'Erikson\'s Stages', content: 'Trust vs Mistrust (infant). Autonomy vs Shame (toddler). Initiative vs Guilt (preschool). Industry vs Inferiority (school age). Identity vs Role Confusion (adolescent). Intimacy vs Isolation (young adult). Generativity vs Stagnation (middle). Integrity vs Despair (late).' },
    { section: 'social', title: 'Intelligence & Testing', content: 'Spearman: g factor (general intelligence). Gardner: multiple intelligences (8 types). Sternberg: triarchic (analytical, creative, practical). IQ: mean 100, SD 15. Reliability = consistency. Validity = measures what it claims. Standardization = normed on population.' },

    // ── RESEARCH & FRQ SKILLS ──
    { section: 'research', title: 'Experimental vs Non-Experimental', badge: 'high-yield', content: 'Only experiments establish cause and effect. Require: IV (manipulated), DV (measured), random assignment, control group. Non-experimental: correlation, case study, naturalistic observation, survey, meta-analysis — CANNOT establish causation.' },
    { section: 'research', title: 'Random Sampling vs Assignment', badge: 'trap', content: 'Sampling = how you SELECT participants (affects generalizability to population). Assignment = how you PLACE into groups (affects internal validity / causation). These are DIFFERENT concepts. Both use "random" but serve different purposes.' },
    { section: 'research', title: 'Correlation ≠ Causation', badge: 'high-yield', content: 'Third variable problem = another factor causes both. Coefficient: −1 to +1. Closer to extremes = stronger relationship. Direction: positive (same direction), negative (opposite). r = 0.8 and r = −0.8 are EQUALLY strong.' },
    { section: 'research', title: 'Effect Size vs Significance', badge: 'trap', content: 'Effect size = HOW BIG the difference (Cohen\'s d: small 0.2, medium 0.5, large 0.8). Significance = IS IT REAL (p < 0.05 = less than 5% chance due to chance). They are SEPARATE. Large sample can give significance with tiny effect.' },
    { section: 'research', title: 'Thinking Traps', content: 'Hindsight bias = "I knew it all along" (after outcome). Overconfidence = overestimating knowledge (before outcome). Illusory correlation = seeing patterns that don\'t exist. Confirmation bias = seeking info that confirms beliefs. Together they make us overestimate intuition.' },
    { section: 'research', title: 'Research Biases', badge: 'frq', content: 'Hawthorne effect = behavior changes when observed. Social desirability = answering to look good. Wording/anchoring effects = question phrasing skews results. Experimenter bias = expectations influence results. Fix: double-blind procedure.' },
    { section: 'research', title: 'AAQ Checklist', badge: 'frq', content: 'A: Identify research method. B: Identify variables (IV/DV). C: Interpret a statistic. D: Ethical concern (be SPECIFIC — not just "ethics"). E: Generalizability issue. F: Make an argument with evidence and reasoning.' },
    { section: 'research', title: 'EBQ Checklist', badge: 'frq', content: 'Make a defensible CLAIM (not a fact, not opinion). Select and USE evidence from provided sources (specific quotes/data). REASONING that connects evidence to claim. Apply a psychological CONCEPT. May need to address counterargument.' },
    { section: 'research', title: 'Argumentation', badge: 'frq', content: 'Defensible claim + scientifically derived evidence + reasoning. No personal opinions or anecdotes. "The evidence suggests…" not "I think…" May need to refute, modify, or defend claims. Always tie back to psychological concepts.' },
    { section: 'research', title: 'Ethics in Research', content: 'Informed consent. Right to withdraw. Debrief after deception. Minimize harm. Confidentiality. IRB approval. APA guidelines. Animal research: justify, minimize suffering. Tuskegee, Milgram, Zimbardo = historical ethical violations.' },
    { section: 'research', title: 'Measures of Central Tendency', content: 'Mean = average (sensitive to outliers). Median = middle value (resistant to outliers). Mode = most frequent. Skewed distributions: positive skew → mean pulled RIGHT. Negative skew → mean pulled LEFT. Range, variance, standard deviation = spread.' }
  ];

  let nbState = { reviewed: new Set(), needsReview: new Set(), currentSection: 'all', shuffled: false, timerInterval: null, timerSeconds: 1800 };

  function renderNightBefore() {
    const c = el('nightBeforeContainer');
    nbState = { reviewed: new Set(), needsReview: new Set(), currentSection: 'all', shuffled: false, timerInterval: null, timerSeconds: 1800 };

    c.innerHTML = `
      <div class="nb-header">
        <div class="nb-progress-wrap">
          <div class="nb-progress-bar"><div class="nb-progress-fill" id="nbProgressFill"></div></div>
          <span class="nb-progress-text" id="nbProgressText">0 / ${NB_CARDS.length} reviewed</span>
        </div>
        <div class="nb-controls">
          <button class="btn btn-sm nb-shuffle-btn" id="nbShuffleBtn">Shuffle</button>
          <button class="btn btn-sm nb-timer-btn" id="nbTimerBtn">Start 30m Timer</button>
        </div>
      </div>
      <div class="nb-timer-display" id="nbTimerDisplay" style="display:none">
        <span class="nb-timer-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
        <span class="nb-timer-value" id="nbTimerValue">30:00</span>
      </div>
      <div class="nb-section-tabs" id="nbSectionTabs">
        <button class="nb-section-tab active" data-nb-section="all">All <span class="nb-tab-count">${NB_CARDS.length}</span></button>
        ${NB_SECTIONS.map(s => {
          const count = NB_CARDS.filter(c => c.section === s.id).length;
          return `<button class="nb-section-tab" data-nb-section="${s.id}" style="--tab-color:${s.color}">${s.title} <span class="nb-tab-count">${count}</span></button>`;
        }).join('')}
      </div>
      <div class="nb-cards-container" id="nbCardsContainer"></div>
      <div class="nb-review-missed" id="nbReviewMissed" style="display:none">
        <h3>Needs Review</h3>
        <p class="nb-review-missed-desc">Cards you flagged for another look.</p>
        <div id="nbMissedCards"></div>
      </div>
    `;

    renderNBCards();
    initNBEvents();
  }

  function renderNBCards() {
    const container = el('nbCardsContainer');
    let cards = NB_CARDS.filter(c => nbState.currentSection === 'all' || c.section === nbState.currentSection);
    if (nbState.shuffled) cards = [...cards].sort(() => Math.random() - 0.5);

    const sectionMeta = {};
    NB_SECTIONS.forEach(s => { sectionMeta[s.id] = s; });

    container.innerHTML = cards.map((card, i) => {
      const sec = sectionMeta[card.section];
      const reviewed = nbState.reviewed.has(card.title);
      const needsReview = nbState.needsReview.has(card.title);
      const badgeHTML = card.badge === 'high-yield' ? '<span class="nb-badge nb-badge-high">High Yield</span>'
        : card.badge === 'trap' ? '<span class="nb-badge nb-badge-trap">Trap Alert</span>'
        : card.badge === 'frq' ? '<span class="nb-badge nb-badge-frq">FRQ Critical</span>' : '';
      return `
        <div class="nb-card ${reviewed ? 'nb-card-reviewed' : ''} ${needsReview ? 'nb-card-flagged' : ''}" data-nb-idx="${i}" data-nb-title="${h(card.title)}" style="--nb-accent:${sec.color}">
          <div class="nb-card-header">
            <span class="nb-card-section-dot" style="background:${sec.color}"></span>
            <h4 class="nb-card-title">${h(card.title)}</h4>
            ${badgeHTML}
            ${reviewed ? '<span class="nb-card-check">✓</span>' : ''}
          </div>
          <div class="nb-card-body" style="display:none">
            <p>${h(card.content)}</p>
            <div class="nb-card-actions">
              <button class="nb-rate-btn nb-rate-knew" data-nb-title="${h(card.title)}">I knew it</button>
              <button class="nb-rate-btn nb-rate-missed" data-nb-title="${h(card.title)}">Need to review</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function initNBEvents() {
    const container = el('nbCardsContainer');
    container.addEventListener('click', e => {
      const card = e.target.closest('.nb-card');
      if (!card) return;

      const rateBtn = e.target.closest('.nb-rate-btn');
      if (rateBtn) {
        const title = rateBtn.dataset.nbTitle;
        nbState.reviewed.add(title);
        if (rateBtn.classList.contains('nb-rate-missed')) {
          nbState.needsReview.add(title);
        } else {
          nbState.needsReview.delete(title);
        }
        card.classList.add('nb-card-reviewed');
        card.classList.toggle('nb-card-flagged', nbState.needsReview.has(title));
        const body = card.querySelector('.nb-card-body');
        if (body) body.style.display = 'none';
        if (!card.querySelector('.nb-card-check')) {
          card.querySelector('.nb-card-header').insertAdjacentHTML('beforeend', '<span class="nb-card-check">✓</span>');
        }
        updateNBProgress();
        updateNBMissed();
        return;
      }

      const body = card.querySelector('.nb-card-body');
      if (body) {
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        card.classList.toggle('nb-card-open', !isOpen);
      }
    });

    el('nbSectionTabs').addEventListener('click', e => {
      const tab = e.target.closest('.nb-section-tab');
      if (!tab) return;
      el('nbSectionTabs').querySelectorAll('.nb-section-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      nbState.currentSection = tab.dataset.nbSection;
      renderNBCards();
    });

    el('nbShuffleBtn').addEventListener('click', () => {
      nbState.shuffled = !nbState.shuffled;
      el('nbShuffleBtn').classList.toggle('active', nbState.shuffled);
      renderNBCards();
    });

    el('nbTimerBtn').addEventListener('click', startNBTimer);
  }

  function updateNBProgress() {
    const total = NB_CARDS.length;
    const done = nbState.reviewed.size;
    const pct = Math.round((done / total) * 100);
    const fill = el('nbProgressFill');
    const text = el('nbProgressText');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${done} / ${total} reviewed (${pct}%)`;
  }

  function updateNBMissed() {
    const panel = el('nbReviewMissed');
    const container = el('nbMissedCards');
    if (nbState.needsReview.size === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const missed = NB_CARDS.filter(c => nbState.needsReview.has(c.title));
    container.innerHTML = missed.map(card => {
      const sec = NB_SECTIONS.find(s => s.id === card.section);
      return `<div class="nb-missed-card" style="--nb-accent:${sec.color}"><h4>${h(card.title)}</h4><p>${h(card.content)}</p></div>`;
    }).join('');
  }

  function startNBTimer() {
    if (nbState.timerInterval) { clearInterval(nbState.timerInterval); nbState.timerInterval = null; }
    nbState.timerSeconds = 1800;
    const display = el('nbTimerDisplay');
    const valueEl = el('nbTimerValue');
    const btn = el('nbTimerBtn');
    display.style.display = 'flex';
    btn.textContent = 'Reset Timer';

    function tick() {
      nbState.timerSeconds--;
      if (nbState.timerSeconds <= 0) {
        clearInterval(nbState.timerInterval);
        nbState.timerInterval = null;
        valueEl.textContent = '0:00';
        display.classList.add('nb-timer-done');
        btn.textContent = 'Start 30m Timer';
        return;
      }
      const m = Math.floor(nbState.timerSeconds / 60);
      const s = nbState.timerSeconds % 60;
      valueEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      display.classList.toggle('nb-timer-urgent', nbState.timerSeconds <= 300);
    }
    nbState.timerInterval = setInterval(tick, 1000);
    tick();
  }

  /* ── Search ───────────────────────────────────────────────── */
  function initSearch() {
    const input = el('globalSearch');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) return;
      // Search vocab
      if (currentView === 'vocab' && DATA.vocab) {
        const grid = el('vocabGrid');
        grid.querySelectorAll('.vocab-card').forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? '' : 'none';
        });
      }
    });
  }

  /* ── Panic Mode ───────────────────────────────────────────── */
  function initPanicMode() {
    const btn = el('panicModeBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.body.classList.toggle('panic-mode');
      btn.textContent = document.body.classList.contains('panic-mode') ? 'Exit Panic Mode' : 'Toggle Panic Mode';
    });
  }

  /* ── Keyboard Navigation ──────────────────────────────────── */
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (e.key === '/') { e.preventDefault(); el('globalSearch')?.focus(); }
      else if (e.key === 'Escape') closeVocabDrawer();
      else if (currentView === 'flashcards') {
        if (e.key === 'ArrowRight' && flashcardIdx < (DATA.vocab?.length || 1) - 1) showFlashcard(flashcardIdx + 1);
        else if (e.key === 'ArrowLeft' && flashcardIdx > 0) showFlashcard(flashcardIdx - 1);
        else if (e.key === ' ') { e.preventDefault(); el('flashcard')?.classList.toggle('flipped'); }
      }
    });
  }

  /* ── Event Delegation ─────────────────────────────────────── */
  function initEventDelegation() {
    document.addEventListener('click', e => {
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) {
        switchView(viewBtn.dataset.view);
        return;
      }
    });

    el('mobileMenuBtn')?.addEventListener('click', () => el('mobileNav')?.classList.toggle('open'));
    el('vocabDrawerClose')?.addEventListener('click', closeVocabDrawer);
    el('vocabBackdrop')?.addEventListener('click', closeVocabDrawer);
  }

  /* ── Scroll-Aware Header ─────────────────────────────────── */
  function initScrollHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('scrolled', window.scrollY > 60);
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── Init ─────────────────────────────────────────────────── */
  async function init() {
    await loadAllData();
    renderHomepage();
    initSearch();
    initPanicMode();
    initKeyboard();
    initEventDelegation();
    initScrollHeader();

    if (typeof NeuroVisuals !== 'undefined') {
      NeuroVisuals.createHeroBrainVisual(el('heroBrainVisual'));
      // Generate botanical background for Psyche Garden
      const botanical = document.getElementById('psycheGardenBotanical');
      if (botanical) NeuroVisuals.generateNeuronBackground(botanical);
    }

    // Concept node clicks in brain visual
    document.querySelectorAll('.concept-node[data-view]').forEach(node => {
      node.addEventListener('click', () => switchView(node.dataset.view));
    });

    // Init Psyche Animations engine
    if (typeof PsycheAnimations !== 'undefined') {
      PsycheAnimations.init();
    }

    // Init portrait carousel
    if (typeof AudioReactive !== 'undefined') {
      AudioReactive.initPortraitCarousel();
    }

    // Quote speak button
    initQuoteSpeak();
  }

  /* ── Quote TTS via ElevenLabs ────────────────────────────── */
  let quoteSpeakAudio = null;
  function initQuoteSpeak() {
    const btn = document.getElementById('quoteSpeak');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('speaking')) {
        if (quoteSpeakAudio) { quoteSpeakAudio.pause(); quoteSpeakAudio = null; }
        btn.classList.remove('speaking');
        return;
      }

      const activeQuote = document.querySelector('.hero-quote.active');
      const attrEl = document.getElementById('heroQuoteAttr');
      if (!activeQuote) return;

      const text = activeQuote.textContent.trim() + ' ' + (attrEl ? attrEl.textContent.trim() : '');
      btn.classList.add('speaking');

      try {
        const res = await fetch('/.netlify/functions/elevenlabs-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice_id: 'JBFqnCBsd6RMkjVDRZzb',
            model_id: 'eleven_multilingual_v2',
            stability: 0.78,
            similarity_boost: 0.85,
            style: 0.15
          })
        });
        if (!res.ok) throw new Error('TTS request failed');
        const data = await res.json();
        const audioSrc = 'data:audio/mpeg;base64,' + data.audio;
        quoteSpeakAudio = new Audio(audioSrc);
        quoteSpeakAudio.volume = 1.0;
        quoteSpeakAudio.addEventListener('ended', () => { btn.classList.remove('speaking'); quoteSpeakAudio = null; });
        quoteSpeakAudio.addEventListener('error', () => { btn.classList.remove('speaking'); quoteSpeakAudio = null; });
        quoteSpeakAudio.play();
      } catch (err) {
        console.error('[QuoteSpeak]', err);
        btn.classList.remove('speaking');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
