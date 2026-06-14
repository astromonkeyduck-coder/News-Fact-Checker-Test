/**
 * Live Stories View — Admin
 *
 * Editorial control center for the Follow Live Story feature:
 *   - create live stories
 *   - set status / confidence / severity / pin / archive
 *   - post timeline updates with a tiered alert level
 *   - preview how an update appears across surfaces (web / push / lock screen /
 *     Dynamic Island compact + expanded)
 *   - guardrail: urgent / final alerts require explicit confirmation
 *   - view the per-story send-log audit trail
 */

import * as api from '../lib/api.js';

const STATUSES = [
  ['breaking', 'Breaking'],
  ['developing', 'Developing'],
  ['verified', 'Verified'],
  ['disputed', 'Disputed'],
  ['resolved', 'Resolved'],
  ['false_report', 'False report'],
];
const KINDS = [
  ['minor', 'Update'],
  ['major', 'Major update'],
  ['correction', 'Correction'],
  ['final', 'Final update'],
];
const ALERT_LEVELS = [
  ['silent', 'Silent — timeline only (no push)'],
  ['badge', 'Badge — quiet, bumps app badge'],
  ['normal', 'Normal push to followers'],
  ['urgent', 'Urgent push (requires confirm)'],
  ['final', 'Final alert (requires confirm)'],
];
const CONFIDENCES = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
const CONFIRM_LEVELS = ['urgent', 'final'];

let stories = [];
let activeSlug = null;

export function render(container) {
  injectStyles();
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">Live Stories</h2>
        <p class="view-subtitle">Create followable stories and push timeline updates</p>
      </div>
      <div class="toolbar">
        <button class="admin-btn admin-btn-secondary" id="ls-refresh">Refresh</button>
        <button class="admin-btn admin-btn-primary" id="ls-new">New Live Story</button>
      </div>
    </div>
    <div id="ls-notice"></div>
    <div id="ls-create" style="display:none"></div>
    <div id="ls-list"><div class="admin-loading">Loading stories\u2026</div></div>
    <div id="ls-detail"></div>
  `;

  document.getElementById('ls-refresh').addEventListener('click', loadStories);
  document.getElementById('ls-new').addEventListener('click', toggleCreateForm);
  loadStories();
}

async function loadStories() {
  const listEl = document.getElementById('ls-list');
  listEl.innerHTML = '<div class="admin-loading">Loading stories\u2026</div>';
  try {
    const data = await api.listLiveStories();
    stories = data.stories || [];
    renderList();
    if (activeSlug) openDetail(activeSlug);
  } catch (err) {
    listEl.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  }
}

function renderList() {
  const listEl = document.getElementById('ls-list');
  if (!stories.length) {
    listEl.innerHTML = '<div class="admin-empty">No live stories yet. Create one to get started.</div>';
    return;
  }
  listEl.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>Story</th><th>Status</th><th>Sev</th><th>Followers</th><th>Last update</th><th></th></tr>
        </thead>
        <tbody>
          ${stories.map(s => `
            <tr data-slug="${esc(s.slug)}">
              <td>
                <div style="font-weight:600">${esc(s.title)}${s.pinned ? ' \u{1F4CC}' : ''}${s.archived ? ' <span style="color:var(--color-text-muted)">(archived)</span>' : ''}</div>
                <div class="text-mono" style="font-size:var(--text-2xs);color:var(--color-text-muted)">/story/${esc(s.slug)}</div>
              </td>
              <td>${statusPill(s.status)}</td>
              <td class="text-mono">${esc(s.severity)}</td>
              <td class="text-mono">${esc(s.follower_count || 0)}</td>
              <td class="text-mono">${formatDate(s.last_update_at)}</td>
              <td><button class="admin-btn admin-btn-sm admin-btn-secondary ls-open" data-slug="${esc(s.slug)}">Open</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  listEl.querySelectorAll('.ls-open').forEach(btn => {
    btn.addEventListener('click', () => openDetail(btn.dataset.slug));
  });
}

/* ── Create ───────────────────────────────────────── */

function toggleCreateForm() {
  const el = document.getElementById('ls-create');
  if (el.style.display === 'block') { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div class="admin-card" style="margin-bottom:var(--space-lg)">
      <h3 class="admin-card-title">New Live Story</h3>
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="admin-input" id="lsc-title" placeholder="e.g. NASA ISS coolant leak">
      </div>
      <div class="form-group">
        <label class="form-label">Summary</label>
        <textarea class="admin-input admin-textarea" id="lsc-summary" rows="2" placeholder="One-line context"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Status</label>${select('lsc-status', STATUSES, 'developing')}</div>
        <div class="form-group"><label class="form-label">Severity (1-5)</label><input class="admin-input" id="lsc-severity" type="number" min="1" max="5" value="3"></div>
        <div class="form-group"><label class="form-label">Confidence</label>${select('lsc-confidence', CONFIDENCES, 'medium')}</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Category</label><input class="admin-input" id="lsc-category" placeholder="e.g. Space, Weather, Markets"></div>
        <div class="form-group"><label class="form-label">Pinned</label><select class="admin-input" id="lsc-pinned"><option value="false">No</option><option value="true">Yes</option></select></div>
      </div>
      <div class="toolbar" style="margin-top:var(--space-md)">
        <button class="admin-btn admin-btn-primary" id="lsc-save">Create Story</button>
        <button class="admin-btn admin-btn-secondary" id="lsc-cancel">Cancel</button>
      </div>
      <div id="lsc-notice" style="margin-top:var(--space-sm)"></div>
    </div>
  `;
  document.getElementById('lsc-cancel').addEventListener('click', () => { el.style.display = 'none'; });
  document.getElementById('lsc-save').addEventListener('click', createStory);
}

async function createStory() {
  const btn = document.getElementById('lsc-save');
  const noticeEl = document.getElementById('lsc-notice');
  const title = document.getElementById('lsc-title').value.trim();
  if (!title) { noticeEl.innerHTML = errBox('Title is required'); return; }

  btn.disabled = true; btn.textContent = 'Creating\u2026';
  try {
    const res = await api.createLiveStory({
      title,
      summary: document.getElementById('lsc-summary').value.trim(),
      status: document.getElementById('lsc-status').value,
      severity: Number(document.getElementById('lsc-severity').value),
      confidence: document.getElementById('lsc-confidence').value,
      category: document.getElementById('lsc-category').value.trim(),
      pinned: document.getElementById('lsc-pinned').value === 'true',
    });
    document.getElementById('ls-create').style.display = 'none';
    notice('Story created.', 'success');
    activeSlug = res.story.slug;
    await loadStories();
  } catch (err) {
    noticeEl.innerHTML = errBox(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Create Story';
  }
}

/* ── Detail ───────────────────────────────────────── */

async function openDetail(slug) {
  activeSlug = slug;
  const detail = document.getElementById('ls-detail');
  detail.innerHTML = '<div class="admin-loading">Loading story\u2026</div>';
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let data;
  try {
    data = await api.getLiveStory(slug);
  } catch (err) {
    detail.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
    return;
  }

  const s = data.story;
  const updates = data.updates || [];
  const sendLog = data.sendLog || [];

  detail.innerHTML = `
    <div class="admin-card" style="margin-top:var(--space-lg)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-md);flex-wrap:wrap">
        <h3 class="admin-card-title" style="margin:0">${esc(s.title)} ${statusPill(s.status)}</h3>
        <a class="admin-btn admin-btn-sm admin-btn-secondary" href="/story/${esc(s.slug)}" target="_blank" rel="noopener">View live \u2197</a>
      </div>

      <div class="form-row" style="margin-top:var(--space-md)">
        <div class="form-group"><label class="form-label">Status</label>${select('lsd-status', STATUSES, s.status)}</div>
        <div class="form-group"><label class="form-label">Confidence</label>${select('lsd-confidence', CONFIDENCES, s.confidence)}</div>
        <div class="form-group"><label class="form-label">Severity</label><input class="admin-input" id="lsd-severity" type="number" min="1" max="5" value="${esc(s.severity)}"></div>
      </div>
      <div class="toolbar">
        <button class="admin-btn admin-btn-secondary" id="lsd-save-meta">Save story fields</button>
        <button class="admin-btn admin-btn-secondary" id="lsd-pin">${s.pinned ? 'Unpin' : 'Pin'}</button>
        <button class="admin-btn admin-btn-danger" id="lsd-archive">${s.archived ? 'Unarchive' : 'Archive'}</button>
        <span style="font-size:var(--text-xs);color:var(--color-text-muted);align-self:center">${esc(s.follower_count || 0)} followers</span>
      </div>
      <div id="lsd-meta-notice" style="margin-top:var(--space-sm)"></div>
    </div>

    <div class="admin-card" style="margin-top:var(--space-lg)">
      <h3 class="admin-card-title">Post timeline update</h3>
      <div class="form-group">
        <label class="form-label">Update text</label>
        <textarea class="admin-input admin-textarea" id="lsu-body" rows="3" placeholder="What just happened?"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Kind</label>${select('lsu-kind', KINDS, 'minor')}</div>
        <div class="form-group"><label class="form-label">Move status to (optional)</label>${select('lsu-newstatus', [['', 'Keep current']].concat(STATUSES), '')}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Alert level</label>
        ${select('lsu-alert', ALERT_LEVELS, 'normal')}
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Source label (optional)</label><input class="admin-input" id="lsu-source-label" placeholder="e.g. Reuters"></div>
        <div class="form-group"><label class="form-label">Source URL (optional)</label><input class="admin-input" id="lsu-source-url" placeholder="https://"></div>
      </div>

      <label class="form-label">Preview</label>
      <div id="lsu-preview" class="ls-preview-grid"></div>

      <div class="toolbar" style="margin-top:var(--space-md)">
        <button class="admin-btn admin-btn-primary" id="lsu-send">Post update</button>
      </div>
      <div id="lsu-notice" style="margin-top:var(--space-sm)"></div>
    </div>

    <div class="admin-card" style="margin-top:var(--space-lg)">
      <h3 class="admin-card-title">Timeline (${updates.length})</h3>
      <div class="ls-timeline-admin">
        ${updates.length ? updates.map(u => `
          <div class="ls-tl-item">
            <div class="ls-tl-meta">${esc((KINDS.find(k => k[0] === u.kind) || ['', u.kind])[1])} \u00b7 ${alertChip(u.alert_level)} \u00b7 ${formatDate(u.created_at)} \u00b7 ${esc(u.created_by || '')}</div>
            <div class="ls-tl-body">${esc(u.body)}</div>
          </div>
        `).join('') : '<div class="admin-empty">No updates yet.</div>'}
      </div>
    </div>

    <div class="admin-card" style="margin-top:var(--space-lg)">
      <h3 class="admin-card-title">Send log (audit)</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>When</th><th>Level</th><th>Recipients</th><th>Sent</th><th>Failed</th><th>Skipped</th><th>Actor</th></tr></thead>
          <tbody>
            ${sendLog.length ? sendLog.map(l => `
              <tr>
                <td class="text-mono">${formatDate(l.created_at)}</td>
                <td>${alertChip(l.alert_level)}</td>
                <td class="text-mono">${esc(l.recipients)}</td>
                <td class="text-mono">${esc(l.sent)}</td>
                <td class="text-mono">${esc(l.failed)}</td>
                <td class="text-mono">${esc(l.skipped)}</td>
                <td>${esc(l.actor || '')}</td>
              </tr>
            `).join('') : '<tr><td colspan="7" class="admin-empty">No dispatches yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindDetail(s);
  updatePreview(s);
}

function bindDetail(s) {
  document.getElementById('lsd-save-meta').addEventListener('click', () => saveMeta(s));
  document.getElementById('lsd-pin').addEventListener('click', () => quickUpdate(s, { pinned: !s.pinned }));
  document.getElementById('lsd-archive').addEventListener('click', () => {
    if (!s.archived && !confirm('Archive this story? It will be hidden from the public live list.')) return;
    quickUpdate(s, { archived: !s.archived });
  });

  ['lsu-body', 'lsu-kind', 'lsu-alert', 'lsu-newstatus', 'lsu-source-label'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => updatePreview(s));
    if (el) el.addEventListener('change', () => updatePreview(s));
  });

  document.getElementById('lsu-send').addEventListener('click', () => postUpdate(s));
}

async function saveMeta(s) {
  const noticeEl = document.getElementById('lsd-meta-notice');
  try {
    await api.updateLiveStory({
      slug: s.slug,
      status: document.getElementById('lsd-status').value,
      confidence: document.getElementById('lsd-confidence').value,
      severity: Number(document.getElementById('lsd-severity').value),
    });
    noticeEl.innerHTML = '<div class="admin-notice admin-notice-success">Saved.</div>';
    await loadStories();
  } catch (err) {
    noticeEl.innerHTML = errBox(err.message);
  }
}

async function quickUpdate(s, patch) {
  const noticeEl = document.getElementById('lsd-meta-notice');
  try {
    await api.updateLiveStory({ slug: s.slug, ...patch });
    await loadStories();
  } catch (err) {
    noticeEl.innerHTML = errBox(err.message);
  }
}

async function postUpdate(s) {
  const noticeEl = document.getElementById('lsu-notice');
  const btn = document.getElementById('lsu-send');
  const body = document.getElementById('lsu-body').value.trim();
  if (!body) { noticeEl.innerHTML = errBox('Update text is required'); return; }

  const alertLevel = document.getElementById('lsu-alert').value;
  const newStatus = document.getElementById('lsu-newstatus').value;

  // High-severity guardrail (client-side confirm; server also enforces confirm).
  let confirmFlag = false;
  if (CONFIRM_LEVELS.includes(alertLevel)) {
    const ok = confirm(
      `This will send an URGENT push to all ${s.follower_count || 0} followers of "${s.title}".\n\nSend now?`
    );
    if (!ok) return;
    confirmFlag = true;
  }

  const payload = {
    slug: s.slug,
    body,
    kind: document.getElementById('lsu-kind').value,
    alert_level: alertLevel,
    newStatus: newStatus || undefined,
    source_label: document.getElementById('lsu-source-label').value.trim() || undefined,
    source_url: document.getElementById('lsu-source-url').value.trim() || undefined,
    confirm: confirmFlag,
  };

  btn.disabled = true; btn.textContent = 'Posting\u2026';
  try {
    const res = await api.addLiveStoryUpdate(payload);
    const d = res.dispatch || {};
    const sentMsg = d.reason === 'silent'
      ? 'Posted (timeline only).'
      : `Posted. Push: ${d.sent || 0} sent, ${d.failed || 0} failed, ${d.skipped || 0} skipped of ${d.recipients || 0}.`;
    notice(sentMsg, 'success');
    document.getElementById('lsu-body').value = '';
    await loadStories();
  } catch (err) {
    // Server asks for confirmation on high-severity levels.
    if (err.detail && err.detail.error === 'confirmation_required') {
      const ok = confirm(err.detail.message || 'Confirm urgent send?');
      if (ok) {
        try {
          const res = await api.addLiveStoryUpdate({ ...payload, confirm: true });
          const d = res.dispatch || {};
          notice(`Posted. Push: ${d.sent || 0} sent of ${d.recipients || 0}.`, 'success');
          document.getElementById('lsu-body').value = '';
          await loadStories();
          return;
        } catch (err2) {
          noticeEl.innerHTML = errBox(err2.message);
        }
      }
    } else {
      noticeEl.innerHTML = errBox(err.message);
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Post update';
  }
}

/* ── Preview ──────────────────────────────────────── */

function updatePreview(s) {
  const previewEl = document.getElementById('lsu-preview');
  if (!previewEl) return;

  const body = document.getElementById('lsu-body').value.trim() || 'Your update text will appear here.';
  const alertLevel = document.getElementById('lsu-alert').value;
  const newStatus = document.getElementById('lsu-newstatus').value;
  const status = newStatus || s.status;
  const statusLabel = (STATUSES.find(x => x[0] === status) || ['', status])[1];
  const titlePrefix = alertLevel === 'final' ? 'FINAL' : statusLabel.toUpperCase();
  const pushTitle = `${titlePrefix}: ${s.title}`;
  const silent = alertLevel === 'badge' || alertLevel === 'silent';
  const noPush = alertLevel === 'silent';

  previewEl.innerHTML = `
    <div class="ls-pv ls-pv-web">
      <div class="ls-pv-cap">Website timeline</div>
      <div class="ls-pv-card">
        <div class="ls-pv-row">${statusPill(status)}<span class="ls-pv-time">now</span></div>
        <div class="ls-pv-body">${esc(body)}</div>
      </div>
    </div>

    <div class="ls-pv">
      <div class="ls-pv-cap">PWA / Android push${noPush ? ' (suppressed)' : silent ? ' (silent)' : ''}</div>
      <div class="ls-pv-notif ${noPush ? 'is-muted' : ''}">
        <div class="ls-pv-appicon">N</div>
        <div>
          <div class="ls-pv-title">${esc(pushTitle)}</div>
          <div class="ls-pv-sub">${esc(body)}</div>
        </div>
      </div>
    </div>

    <div class="ls-pv">
      <div class="ls-pv-cap">iOS Lock Screen${noPush ? ' (suppressed)' : ''}</div>
      <div class="ls-pv-lock ${noPush ? 'is-muted' : ''}">
        <div class="ls-pv-appicon">N</div>
        <div style="flex:1">
          <div class="ls-pv-locktop"><span>NOTEWORTHY NEWS</span><span>now</span></div>
          <div class="ls-pv-title">${esc(pushTitle)}</div>
          <div class="ls-pv-sub">${esc(body)}</div>
        </div>
      </div>
      <div class="ls-pv-note">Native iOS Live Activities require the companion app (Phase 2).</div>
    </div>

    <div class="ls-pv">
      <div class="ls-pv-cap">Dynamic Island (native, Phase 2)</div>
      <div class="ls-pv-di-compact"><span class="ls-pv-di-dot" data-status="${esc(status)}"></span>${esc(statusLabel)}</div>
      <div class="ls-pv-di-expanded">
        <div class="ls-pv-di-head">${statusPill(status)} <span>${esc(s.title)}</span></div>
        <div class="ls-pv-sub">${esc(body)}</div>
      </div>
    </div>
  `;
}

/* ── Helpers ──────────────────────────────────────── */

function select(id, options, selected) {
  return `<select class="admin-input" id="${id}">${options.map(([v, label]) =>
    `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
}

function statusPill(status) {
  const label = (STATUSES.find(x => x[0] === status) || ['', status])[1];
  return `<span class="ls-pill" data-status="${esc(status)}">${esc(label)}</span>`;
}

function alertChip(level) {
  const label = (ALERT_LEVELS.find(x => x[0] === level) || ['', level])[1].split(' ')[0];
  return `<span class="ls-alert-chip" data-level="${esc(level)}">${esc(label)}</span>`;
}

function notice(msg, type) {
  const el = document.getElementById('ls-notice');
  if (!el) return;
  el.innerHTML = msg ? `<div class="admin-notice admin-notice-${type}">${esc(msg)}</div>` : '';
  if (type === 'success') setTimeout(() => { el.innerHTML = ''; }, 4000);
}

function errBox(msg) {
  return `<div class="admin-notice admin-notice-error">${esc(msg)}</div>`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function formatDate(d) {
  if (!d) return '\u2014';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return '\u2014';
    return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '\u2014'; }
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .ls-pill { display:inline-flex; align-items:center; padding:2px 8px; border-radius:var(--radius-full); font-size:var(--text-2xs); font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
    .ls-pill[data-status="breaking"]{ color:#fff; background:var(--color-live); }
    .ls-pill[data-status="developing"]{ color:#1a1300; background:var(--color-warning); }
    .ls-pill[data-status="verified"]{ color:#04210f; background:var(--color-success); }
    .ls-pill[data-status="disputed"]{ color:#1a1300; background:var(--color-warning); }
    .ls-pill[data-status="resolved"]{ color:var(--color-text-secondary); background:rgba(255,255,255,.08); }
    .ls-pill[data-status="false_report"]{ color:#fff; background:var(--color-error); }
    .ls-alert-chip{ display:inline-block; padding:1px 6px; border-radius:var(--radius-sm); font-size:var(--text-2xs); font-weight:600; background:rgba(255,255,255,.07); }
    .ls-alert-chip[data-level="urgent"], .ls-alert-chip[data-level="final"]{ color:var(--color-live); background:var(--color-live-muted); }
    .ls-alert-chip[data-level="silent"]{ color:var(--color-text-muted); }
    .ls-preview-grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:var(--space-md); margin:var(--space-xs) 0 var(--space-sm); }
    .ls-pv-cap{ font-size:var(--text-2xs); text-transform:uppercase; letter-spacing:.08em; color:var(--color-text-muted); margin-bottom:6px; }
    .ls-pv-card,.ls-pv-notif,.ls-pv-lock,.ls-pv-di-expanded{ background:var(--color-bg-elevated); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:10px 12px; }
    .ls-pv-row{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .ls-pv-time{ font-size:var(--text-2xs); color:var(--color-text-muted); }
    .ls-pv-body,.ls-pv-sub{ font-size:var(--text-sm); color:var(--color-text); line-height:1.4; }
    .ls-pv-notif{ display:flex; gap:10px; align-items:flex-start; }
    .ls-pv-lock{ display:flex; gap:10px; align-items:flex-start; backdrop-filter:blur(8px); }
    .ls-pv-appicon{ width:30px; height:30px; border-radius:8px; background:var(--gradient-accent); color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--font-heading); }
    .ls-pv-title{ font-weight:700; font-size:var(--text-sm); }
    .ls-pv-sub{ color:var(--color-text-secondary); }
    .ls-pv-locktop{ display:flex; justify-content:space-between; font-size:var(--text-2xs); color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.06em; }
    .ls-pv-note,.ls-pv-cap .note{ font-size:var(--text-2xs); color:var(--color-text-muted); margin-top:6px; }
    .is-muted{ opacity:.45; }
    .ls-pv-di-compact{ display:inline-flex; align-items:center; gap:6px; background:#000; color:#fff; border-radius:var(--radius-full); padding:5px 12px; font-size:var(--text-xs); font-weight:600; margin-bottom:8px; }
    .ls-pv-di-dot{ width:8px; height:8px; border-radius:50%; background:var(--color-accent); }
    .ls-pv-di-dot[data-status="breaking"],.ls-pv-di-dot[data-status="false_report"]{ background:var(--color-live); }
    .ls-pv-di-dot[data-status="verified"]{ background:var(--color-success); }
    .ls-pv-di-dot[data-status="developing"],.ls-pv-di-dot[data-status="disputed"]{ background:var(--color-warning); }
    .ls-pv-di-expanded{ background:#000; }
    .ls-pv-di-head{ display:flex; align-items:center; gap:8px; margin-bottom:6px; font-weight:700; font-size:var(--text-sm); }
    .ls-timeline-admin .ls-tl-item{ padding:10px 0; border-top:1px solid var(--color-border); }
    .ls-timeline-admin .ls-tl-item:first-child{ border-top:none; }
    .ls-tl-meta{ font-size:var(--text-2xs); color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .ls-tl-body{ font-size:var(--text-sm); }
  `;
  document.head.appendChild(style);
}
