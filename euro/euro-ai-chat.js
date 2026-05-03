(function() {
  'use strict';

  const API_URL = '/api/euro-tutor';
  const STORAGE_KEY = 'euro-ai-chat-history';

  const QUICK_ACTIONS = [
    { label: 'Quiz Me', prompt: 'Give me a challenging AP Euro multiple-choice question. Include 4 answer choices (A-D), then after I answer, explain why the correct answer is right and why the others are wrong.' },
    { label: 'Practice SAQ', prompt: 'Give me an AP Euro Short Answer Question with parts a, b, and c. After I respond, grade each part against the rubric.' },
    { label: 'Practice DBQ', prompt: 'Walk me through a DBQ practice exercise. Give me a prompt and 3-4 brief document summaries, then guide me through building an argument that hits all 7 rubric points.' },
    { label: 'Practice LEQ', prompt: 'Give me an LEQ prompt and help me plan a response that would score all 6 rubric points. Start by helping me write a strong thesis.' },
    { label: 'Explain a Topic', prompt: 'I need help understanding a topic. Ask me which unit or topic I want to review, then give me a clear, exam-focused explanation with key evidence I should know.' },
    { label: 'Night Before Tips', prompt: 'Give me your best night-before-the-exam strategy for AP Euro. What should I focus on in my final review session to maximize my score?' },
    { label: 'Grade My Essay', prompt: 'I want you to grade my essay. Tell me to paste it, then evaluate it against the official AP rubric point by point, giving specific feedback on how to earn each point I missed.' },
  ];

  function getPageContext() {
    const path = window.location.pathname;
    if (path.includes('/sprite')) {
      const modeLabel = document.querySelector('.breadcrumb-mode');
      const mode = modeLabel ? modeLabel.textContent : null;
      return `Geo-SPRITE dashboard${mode ? ` (${mode} mode)` : ' (landing page)'}`;
    }
    const activeTab = document.querySelector('.nb.on');
    const view = activeTab ? activeTab.textContent.trim() : null;
    const openEras = document.querySelectorAll('.era-hdr:not(.collapsed)');
    const eraNames = Array.from(openEras).map(h => h.querySelector('h2')?.textContent?.trim()).filter(Boolean).slice(0, 3);
    const detailPanel = document.getElementById('dp');
    const detailTitle = detailPanel && detailPanel.classList.contains('open') ? document.getElementById('dpT')?.textContent : null;
    let ctx = `AP Euro Timeline`;
    if (view) ctx += ` (${view} view)`;
    if (eraNames.length) ctx += ` — viewing eras: ${eraNames.join(', ')}`;
    if (detailTitle) ctx += ` — detail open: ${detailTitle}`;
    return ctx;
  }

  function gatherEvidence() {
    const path = window.location.pathname;
    const entries = [];

    if (path.includes('/sprite')) {
      if (typeof window.DATA !== 'undefined' && Array.isArray(window.DATA)) {
        const visible = window.DATA.slice(0, 10);
        visible.forEach(e => {
          entries.push({
            id: e.id,
            title: e.title,
            date: e.date,
            description: e.description ? e.description.substring(0, 200) : '',
            causes: e.causes || [],
            effects: e.effects || [],
            memoryHook: e.funnyHook || '',
            comparisonOpportunities: e.comparisonUse ? [e.comparisonUse.substring(0, 150)] : [],
            continuityChangeOpportunities: e.ccotUse ? [e.ccotUse.substring(0, 150)] : [],
          });
        });
      }
      return entries;
    }

    if (typeof window.DATA !== 'undefined' && Array.isArray(window.DATA)) {
      const openEras = document.querySelectorAll('.era-hdr:not(.collapsed)');
      const eraIds = Array.from(openEras).map(h => {
        const badge = h.querySelector('.era-badge');
        return badge ? badge.textContent.trim().toLowerCase().replace(/[^a-z]/g, '') : '';
      });

      let relevant = [];

      const detailPanel = document.getElementById('dp');
      const detailTitle = detailPanel && detailPanel.classList.contains('open') ? document.getElementById('dpT')?.textContent : null;
      if (detailTitle) {
        const detailEntry = window.DATA.find(e => e.title === detailTitle);
        if (detailEntry) relevant.push(detailEntry);
        const connected = [...(detailEntry?.connectedBefore || []), ...(detailEntry?.connectedAfter || [])];
        connected.forEach(cid => {
          const ce = window.DATA.find(e => e.id === cid);
          if (ce) relevant.push(ce);
        });
      }

      if (relevant.length < 8) {
        const tier1 = window.DATA.filter(e => e.tier === 1);
        const shuffled = tier1.sort(() => Math.random() - 0.5);
        relevant = [...relevant, ...shuffled.slice(0, 8 - relevant.length)];
      }

      relevant.slice(0, 10).forEach(e => {
        entries.push({
          id: e.id,
          title: e.title,
          date: e.date,
          description: e.description ? e.description.substring(0, 200) : '',
          causes: (e.causes || []).slice(0, 3),
          effects: (e.effects || []).slice(0, 3),
          memoryHook: e.memoryHook || '',
          comparisonOpportunities: (e.comparisonOpportunities || []).slice(0, 2),
          continuityChangeOpportunities: (e.continuityChangeOpportunities || []).slice(0, 2),
        });
      });
    }

    return entries;
  }

  function parseNavCommands(html) {
    return html.replace(/\[\[NAV:([\w]+):([\w\-\/:.]+)\]\]/g, (match, action, target) => {
      let label = '';
      let icon = '';
      switch (action) {
        case 'detail':
          label = 'View Event';
          icon = '→';
          break;
        case 'view':
          label = target.charAt(0).toUpperCase() + target.slice(1) + ' View';
          icon = '⊞';
          break;
        case 'search':
          label = `Search "${target}"`;
          icon = '⌕';
          break;
        case 'sprite':
          label = target.charAt(0).toUpperCase() + target.slice(1) + ' Mode';
          icon = '◈';
          break;
        case 'link':
          label = target.includes('sprite') ? 'Geo-SPRITE' : 'Timeline';
          icon = '↗';
          break;
        default:
          label = target;
          icon = '→';
      }
      return `<button class="eac-nav-btn" data-nav-action="${action}" data-nav-target="${target}" title="${match}">${icon} ${label}</button>`;
    });
  }

  let currentAudio = null;
  let currentTtsBtn = null;

  function stripForTts(text) {
    return text
      .replace(/\[\[NAV:[\w]+:[\w\-\/:.]+\]\]/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/^[-•]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .trim()
      .substring(0, 4000);
  }

  async function playTts(text, btn) {
    if (currentAudio && currentTtsBtn === btn) {
      currentAudio.pause();
      currentAudio = null;
      btn.classList.remove('playing');
      btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Listen';
      currentTtsBtn = null;
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      if (currentTtsBtn) {
        currentTtsBtn.classList.remove('playing');
        currentTtsBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Listen';
      }
      currentAudio = null;
    }

    btn.classList.add('loading');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Loading...';

    try {
      const clean = stripForTts(text);
      const res = await fetch('/.netlify/functions/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          voice_id: 'nPczCjzI2devNBz1zQrb',
          model_id: 'eleven_multilingual_v2',
          stability: 0.5,
          similarity_boost: 0.75,
        }),
      });

      if (!res.ok) throw new Error('TTS request failed');

      const data = await res.json();
      const audio = new Audio('data:audio/mpeg;base64,' + data.audio);
      currentAudio = audio;
      currentTtsBtn = btn;

      btn.classList.remove('loading');
      btn.classList.add('playing');
      btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop';

      audio.addEventListener('ended', () => {
        btn.classList.remove('playing');
        btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Listen';
        currentAudio = null;
        currentTtsBtn = null;
      });

      audio.play();
    } catch (e) {
      btn.classList.remove('loading');
      btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Listen';
    }
  }

  function executeNav(action, target) {
    const path = window.location.pathname;

    switch (action) {
      case 'detail':
        if (typeof window.openDetail === 'function') {
          window.openDetail(target);
        }
        break;
      case 'view':
        if (typeof window.switchView === 'function') {
          window.switchView(target);
        }
        break;
      case 'search':
        if (path.includes('/euro')) {
          const searchInput = document.getElementById('si');
          if (searchInput) {
            searchInput.value = target;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;
      case 'sprite':
        if (typeof window.openMode === 'function') {
          window.openMode(target);
        } else {
          window.location.href = '/sprite/#' + target;
        }
        break;
      case 'link':
        window.location.href = target;
        break;
    }
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveHistory(messages) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {}
  }

  function renderMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>')
      .replace(/<p><(h[234]|ul|li)/g, '<$1')
      .replace(/<\/(h[234]|ul|li)><\/p>/g, '</$1>');
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
.eac-fab{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:50px;background:var(--acc,#1D5BA0);color:#fff;font-family:var(--font-ui,'Inter',system-ui,sans-serif);font-size:14px;font-weight:600;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(29,91,160,0.35);transition:all .2s ease}
.eac-fab:hover{transform:translateY(-2px);box-shadow:0 6px 28px rgba(29,91,160,0.45)}
.eac-fab svg{width:20px;height:20px;fill:currentColor}
.eac-fab.hidden{display:none}

.eac-panel{position:fixed;bottom:24px;right:24px;z-index:10000;width:420px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 48px);border-radius:16px;background:var(--bgC,#fff);border:1px solid var(--bdr,#DDD9CE);box-shadow:0 12px 48px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden;font-family:var(--font-ui,'Inter',system-ui,sans-serif);opacity:0;transform:translateY(20px) scale(0.95);pointer-events:none;transition:all .25s cubic-bezier(0.4,0,0.2,1)}
.eac-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all}

.eac-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bdr,#DDD9CE);background:var(--bgE,#fff);flex-shrink:0}
.eac-header h3{font-size:15px;font-weight:700;color:var(--tx,#1C1C1C);margin:0;display:flex;align-items:center;gap:8px}
.eac-header h3 span{font-size:10px;font-weight:700;color:var(--acc,#1D5BA0);letter-spacing:0.1em;text-transform:uppercase;background:var(--accL,#EBF0F8);padding:2px 8px;border-radius:12px}
.eac-close{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:var(--txM,#7A7A7A);font-size:18px;transition:all .15s}
.eac-close:hover{background:var(--accM,rgba(29,91,160,0.07));color:var(--tx,#1C1C1C)}

.eac-messages{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px}
.eac-messages::-webkit-scrollbar{width:5px}
.eac-messages::-webkit-scrollbar-thumb{background:var(--bdr,#DDD9CE);border-radius:4px}

.eac-welcome{text-align:center;padding:20px 16px;color:var(--tx2,#3D3D3D)}
.eac-welcome h4{font-size:16px;font-weight:700;margin-bottom:6px;color:var(--tx,#1C1C1C)}
.eac-welcome p{font-size:13px;line-height:1.5;color:var(--txM,#7A7A7A);margin-bottom:16px}

.eac-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:0 8px}
.eac-chip{padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;background:var(--bgE,#fff);border:1px solid var(--bdr,#DDD9CE);cursor:pointer;transition:all .15s;color:var(--tx2,#3D3D3D);white-space:nowrap}
.eac-chip:hover{border-color:var(--acc,#1D5BA0);color:var(--acc,#1D5BA0);background:var(--accL,#EBF0F8)}

.eac-msg{max-width:88%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.6;word-wrap:break-word}
.eac-msg p{margin:0 0 8px}
.eac-msg p:last-child{margin:0}
.eac-msg h2,.eac-msg h3,.eac-msg h4{font-size:14px;font-weight:700;margin:8px 0 4px;color:var(--tx,#1C1C1C)}
.eac-msg ul{margin:4px 0;padding-left:18px;list-style:disc}
.eac-msg li{margin-bottom:4px}
.eac-msg code{background:var(--accM,rgba(29,91,160,0.07));padding:1px 5px;border-radius:4px;font-size:12px}
.eac-msg strong{font-weight:700;color:var(--tx,#1C1C1C)}
.eac-msg-user{align-self:flex-end;background:var(--acc,#1D5BA0);color:#fff;border-bottom-right-radius:4px}
.eac-msg-user strong{color:#fff}
.eac-msg-ai{align-self:flex-start;background:var(--bgE,#F8F6F1);color:var(--tx,#1C1C1C);border-bottom-left-radius:4px;border:1px solid var(--bdr,#DDD9CE)}

.eac-ai-row{display:flex;align-items:flex-start;gap:8px;align-self:flex-start;max-width:92%}
.eac-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;margin-top:2px;border:1.5px solid var(--bdr,#DDD9CE)}
.eac-ai-row .eac-msg-ai{max-width:100%}
.eac-ai-row .eac-msg-footer{display:flex;align-items:center;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid var(--bdr,#DDD9CE)}
.eac-tts-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-size:10px;font-weight:600;background:none;border:1px solid var(--bdr,#DDD9CE);color:var(--txM,#7A7A7A);cursor:pointer;transition:all .15s;font-family:inherit}
.eac-tts-btn:hover{border-color:var(--acc,#1D5BA0);color:var(--acc,#1D5BA0)}
.eac-tts-btn.playing{border-color:var(--acc,#1D5BA0);color:var(--acc,#1D5BA0);background:var(--accL,#EBF0F8)}
.eac-tts-btn.loading{opacity:0.6;cursor:wait}
.eac-tts-btn svg{width:12px;height:12px;fill:currentColor}

.eac-nav-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;margin:2px 2px;border-radius:14px;font-size:11px;font-weight:600;background:var(--accL,#EBF0F8);border:1px solid var(--acc,#1D5BA0);color:var(--acc,#1D5BA0);cursor:pointer;transition:all .15s;font-family:inherit;vertical-align:middle}
.eac-nav-btn:hover{background:var(--acc,#1D5BA0);color:#fff;transform:scale(1.03)}

.eac-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 16px}
.eac-typing span{width:6px;height:6px;border-radius:50%;background:var(--txM,#7A7A7A);animation:eacBounce .6s infinite alternate}
.eac-typing span:nth-child(2){animation-delay:.2s}
.eac-typing span:nth-child(3){animation-delay:.4s}
@keyframes eacBounce{to{opacity:.3;transform:translateY(-4px)}}

.eac-input-row{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--bdr,#DDD9CE);background:var(--bgE,#fff);flex-shrink:0}
.eac-input{flex:1;border:1.5px solid var(--bdr,#DDD9CE);border-radius:10px;padding:10px 14px;font-size:13px;background:var(--bg,#F8F6F1);color:var(--tx,#1C1C1C);outline:none;resize:none;min-height:40px;max-height:120px;line-height:1.4;font-family:inherit}
.eac-input::placeholder{color:var(--txM,#7A7A7A)}
.eac-input:focus{border-color:var(--acc,#1D5BA0);box-shadow:0 0 0 3px var(--accM,rgba(29,91,160,0.07))}
.eac-send{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--acc,#1D5BA0);border:none;cursor:pointer;color:#fff;transition:all .15s;flex-shrink:0}
.eac-send:hover{transform:scale(1.05)}
.eac-send:disabled{opacity:0.4;cursor:not-allowed;transform:none}
.eac-send svg{width:16px;height:16px;fill:currentColor}

.eac-clear{font-size:11px;color:var(--txM,#7A7A7A);background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all .15s}
.eac-clear:hover{color:var(--acc,#1D5BA0);background:var(--accM,rgba(29,91,160,0.07))}

.eac-persona{display:flex;align-items:center;gap:6px;padding:8px 16px;border-bottom:1px solid var(--bdr,#DDD9CE);background:var(--bg,#F8F6F1);flex-shrink:0;font-size:11px}
.eac-persona label{color:var(--tx2,#3D3D3D);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none}
.eac-persona-switch{position:relative;width:34px;height:18px;flex-shrink:0}
.eac-persona-switch input{opacity:0;width:0;height:0}
.eac-persona-slider{position:absolute;inset:0;background:var(--bdr,#DDD9CE);border-radius:9px;cursor:pointer;transition:all .2s}
.eac-persona-slider::before{content:'';position:absolute;width:14px;height:14px;left:2px;top:2px;background:#fff;border-radius:50%;transition:all .2s}
.eac-persona-switch input:checked+.eac-persona-slider{background:var(--acc,#1D5BA0)}
.eac-persona-switch input:checked+.eac-persona-slider::before{transform:translateX(16px)}

@media(max-width:500px){
  .eac-panel{width:100vw;height:100vh;max-height:100vh;bottom:0;right:0;border-radius:0}
  .eac-fab{bottom:16px;right:16px;padding:10px 16px;font-size:13px}
}
`;
    document.head.appendChild(style);
  }

  function createDOM() {
    const fab = document.createElement('button');
    fab.className = 'eac-fab';
    fab.setAttribute('aria-label', 'Open Mr. Clemens AI');
    fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>Mr. Clemens AI`;

    const panel = document.createElement('div');
    panel.className = 'eac-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Mr. Clemens AI Tutor');
    panel.innerHTML = `
      <div class="eac-header">
        <h3>Mr. Clemens AI <span>TUTOR</span></h3>
        <div style="display:flex;align-items:center;gap:4px">
          <button class="eac-clear" title="Clear conversation">Clear</button>
          <button class="eac-close" aria-label="Close">&times;</button>
        </div>
      </div>
      <div class="eac-persona">
        <label>
          <span class="eac-persona-switch"><input type="checkbox" id="eacClemensToggle"><span class="eac-persona-slider"></span></span>
          <span id="eacPersonaLabel">Mr. Clemens Mode</span>
        </label>
      </div>
      <div class="eac-messages"></div>
      <div class="eac-input-row">
        <textarea class="eac-input" placeholder="Ask anything about AP Euro..." rows="1"></textarea>
        <button class="eac-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    return { fab, panel };
  }

  function init() {
    injectStyles();
    const { fab, panel } = createDOM();
    const messagesEl = panel.querySelector('.eac-messages');
    const input = panel.querySelector('.eac-input');
    const sendBtn = panel.querySelector('.eac-send');
    const closeBtn = panel.querySelector('.eac-close');
    const clearBtn = panel.querySelector('.eac-clear');

    let messages = loadHistory();
    let isStreaming = false;
    let clemensMode = sessionStorage.getItem('euro-clemens-mode') === 'true';
    const clemensToggle = panel.querySelector('#eacClemensToggle');
    const personaLabel = panel.querySelector('#eacPersonaLabel');
    clemensToggle.checked = clemensMode;
    personaLabel.textContent = clemensMode ? 'Mr. Clemens Mode ON' : 'Mr. Clemens Mode';
    clemensToggle.addEventListener('change', () => {
      clemensMode = clemensToggle.checked;
      sessionStorage.setItem('euro-clemens-mode', clemensMode);
      personaLabel.textContent = clemensMode ? 'Mr. Clemens Mode ON' : 'Mr. Clemens Mode';
      if (messages.length === 0) renderMessages();
    });

    function bindNavButtons(container) {
      container.querySelectorAll('.eac-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const action = btn.dataset.navAction;
          const target = btn.dataset.navTarget;
          executeNav(action, target);
        });
      });
    }

    function renderWelcome() {
      const div = document.createElement('div');
      div.className = 'eac-welcome';
      const title = clemensMode ? 'Alright you guys, buckle up!' : 'Ready to ace AP Euro?';
      const desc = clemensMode
        ? 'If you\'re ready to get them brain cows milked, pick a study mode and let\'s crush this exam. I know every topic, every date, every bonehead move every king ever made, and I\'ll make it all stick.'
        : 'I know every topic from the Renaissance to the EU. I\'ll give you real evidence, specific dates, and push you toward a 5. Pick a study mode:';
      div.innerHTML = `
        <h4>${title}</h4>
        <p>${desc}</p>
        <div class="eac-chips">
          ${QUICK_ACTIONS.map((a, i) => `<button class="eac-chip" data-idx="${i}">${a.label}</button>`).join('')}
        </div>
      `;
      messagesEl.appendChild(div);

      div.querySelectorAll('.eac-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const action = QUICK_ACTIONS[parseInt(chip.dataset.idx)];
          sendMessage(action.prompt);
        });
      });
    }

    function buildAiRow(content) {
      const row = document.createElement('div');
      row.className = 'eac-ai-row';
      row.innerHTML = '<img class="eac-avatar" src="/clemenspfp.jpg" alt="Mr. Clemens">';
      const div = document.createElement('div');
      div.className = 'eac-msg eac-msg-ai';
      const rendered = renderMarkdown(content);
      div.innerHTML = parseNavCommands(rendered);
      const footer = document.createElement('div');
      footer.className = 'eac-msg-footer';
      const ttsBtn = document.createElement('button');
      ttsBtn.className = 'eac-tts-btn';
      ttsBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg> Listen';
      ttsBtn.addEventListener('click', () => playTts(content, ttsBtn));
      footer.appendChild(ttsBtn);
      div.appendChild(footer);
      bindNavButtons(div);
      row.appendChild(div);
      return row;
    }

    function renderMessages() {
      messagesEl.innerHTML = '';
      if (messages.length === 0) {
        renderWelcome();
        return;
      }
      messages.forEach(msg => {
        if (msg.role === 'user') {
          const div = document.createElement('div');
          div.className = 'eac-msg eac-msg-user';
          div.innerHTML = escapeHtml(msg.content);
          messagesEl.appendChild(div);
        } else {
          messagesEl.appendChild(buildAiRow(msg.content));
        }
      });
      scrollToBottom();
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addTypingIndicator() {
      const div = document.createElement('div');
      div.className = 'eac-typing';
      div.innerHTML = '<span></span><span></span><span></span>';
      messagesEl.appendChild(div);
      scrollToBottom();
      return div;
    }

    async function sendMessage(text) {
      if (isStreaming || !text.trim()) return;
      isStreaming = true;
      sendBtn.disabled = true;

      messages.push({ role: 'user', content: text.trim() });
      saveHistory(messages);
      renderMessages();

      input.value = '';
      input.style.height = 'auto';

      const typing = addTypingIndicator();

      try {
        const pageContext = getPageContext();
        const evidence = gatherEvidence();

        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            pageContext,
            evidence,
            persona: clemensMode ? 'clemens' : 'standard',
          }),
        });

        typing.remove();

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          showError(err.error || err.message || 'Something went wrong. Try again.');
          isStreaming = false;
          sendBtn.disabled = false;
          return;
        }

        const data = await res.json();
        const content = data.content || 'No response received.';

        messages.push({ role: 'assistant', content });
        saveHistory(messages);

        messagesEl.appendChild(buildAiRow(content));
        scrollToBottom();
      } catch (err) {
        typing.remove();
        showError('Network error. Check your connection and try again.');
      }

      isStreaming = false;
      sendBtn.disabled = false;
    }

    function showError(msg) {
      const row = document.createElement('div');
      row.className = 'eac-ai-row';
      row.innerHTML = '<img class="eac-avatar" src="/clemenspfp.jpg" alt="Mr. Clemens">';
      const div = document.createElement('div');
      div.className = 'eac-msg eac-msg-ai';
      div.style.borderColor = '#c05020';
      div.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
      row.appendChild(div);
      messagesEl.appendChild(row);
      scrollToBottom();
    }

    function togglePanel(open) {
      const isOpen = panel.classList.contains('open');
      if (open === undefined) open = !isOpen;
      panel.classList.toggle('open', open);
      fab.classList.toggle('hidden', open);
      if (open) {
        input.focus();
        scrollToBottom();
      }
    }

    fab.addEventListener('click', () => togglePanel(true));
    closeBtn.addEventListener('click', () => togglePanel(false));

    clearBtn.addEventListener('click', () => {
      messages = [];
      saveHistory(messages);
      renderMessages();
    });

    sendBtn.addEventListener('click', () => sendMessage(input.value));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        togglePanel(false);
      }
    });

    renderMessages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
