/**
 * System View - Admin
 *
 * Maintenance operations: rebuild index, cleanup, breaking news alerts.
 */

import * as api from '../lib/api.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">System</h2>
        <p class="view-subtitle">Maintenance operations and alerts</p>
      </div>
    </div>
    <div id="sys-notice"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">

      <!-- Index Maintenance -->
      <div class="admin-card">
        <h3 class="admin-card-title">Post Index</h3>
        <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-md)">
          Rebuild or clean up the post index.
        </p>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
          <button class="admin-btn admin-btn-secondary" id="sys-rebuild-btn">Rebuild Index</button>
          <button class="admin-btn admin-btn-secondary" id="sys-remove-long-btn">Remove Long Posts</button>
          <button class="admin-btn admin-btn-secondary" id="sys-remove-old-btn">Remove Old Alert Posts</button>
        </div>
        <div id="sys-index-result" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- Breaking News Alert -->
      <div class="admin-card">
        <h3 class="admin-card-title">Breaking News Alert</h3>
        <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-md)">
          Send a push notification and email alert to subscribers.
        </p>
        <div class="form-group">
          <label class="form-label">Title</label>
          <input class="admin-input" id="alert-title" placeholder="Breaking: ...">
        </div>
        <div class="form-group">
          <label class="form-label">Summary</label>
          <textarea class="admin-input admin-textarea" id="alert-summary" rows="3" placeholder="Brief description of the breaking event\u2026"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Severity (1\u20135)</label>
          <select class="admin-input admin-select" id="alert-severity">
            <option value="3">3 \u2014 Moderate</option>
            <option value="4">4 \u2014 High</option>
            <option value="5">5 \u2014 Critical</option>
            <option value="2">2 \u2014 Low</option>
            <option value="1">1 \u2014 Minimal</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Source URL (optional)</label>
          <input class="admin-input" id="alert-url" placeholder="https://...">
        </div>
        <button class="admin-btn admin-btn-danger" id="sys-alert-btn">Send Breaking News Alert</button>
        <div id="sys-alert-result" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- System Info -->
      <div class="admin-card" style="grid-column:1/-1">
        <h3 class="admin-card-title">System Information</h3>
        <div class="kv-grid">
          <span class="kv-key">Admin UI Version</span>
          <span class="kv-value">1.0.0</span>
          <span class="kv-key">Auth</span>
          <span class="kv-value">Auth0 JWT + server-verified admin role</span>
          <span class="kv-key">API Transport</span>
          <span class="kv-value">Bearer token in Authorization header</span>
          <span class="kv-key">Storage</span>
          <span class="kv-value">Netlify Blobs (x-posts), Supabase (verified_events)</span>
          <span class="kv-key">Session</span>
          <span class="kv-value">Memory-only (no localStorage/sessionStorage)</span>
        </div>
      </div>

    </div>
  `;

  document.getElementById('sys-rebuild-btn').addEventListener('click', handleRebuildIndex);
  document.getElementById('sys-remove-long-btn').addEventListener('click', handleRemoveLong);
  document.getElementById('sys-remove-old-btn').addEventListener('click', handleRemoveOld);
  document.getElementById('sys-alert-btn').addEventListener('click', handleBreakingAlert);
}

async function handleRebuildIndex() {
  if (!confirm('Rebuild the post index? This rewrites the entire index file.')) return;
  const btn = document.getElementById('sys-rebuild-btn');
  const result = document.getElementById('sys-index-result');
  btn.disabled = true;
  btn.textContent = 'Rebuilding\u2026';
  try {
    const data = await api.rebuildIndex();
    result.innerHTML = `<div class="admin-notice admin-notice-success">Index rebuilt. ${esc(data.message || JSON.stringify(data))}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Rebuild Index';
  }
}

async function handleRemoveLong() {
  if (!confirm('Remove verbose posts (long volcano/weather entries)?')) return;
  const btn = document.getElementById('sys-remove-long-btn');
  const result = document.getElementById('sys-index-result');
  btn.disabled = true;
  try {
    const data = await api.removeLongPosts();
    result.innerHTML = `<div class="admin-notice admin-notice-success">Done. ${esc(data.message || JSON.stringify(data))}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

async function handleRemoveOld() {
  if (!confirm('Remove old alert posts from the index?')) return;
  const btn = document.getElementById('sys-remove-old-btn');
  const result = document.getElementById('sys-index-result');
  btn.disabled = true;
  try {
    const data = await api.removeOldAlertPosts();
    result.innerHTML = `<div class="admin-notice admin-notice-success">Done. ${esc(data.message || JSON.stringify(data))}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

async function handleBreakingAlert() {
  const title = document.getElementById('alert-title').value.trim();
  const summary = document.getElementById('alert-summary').value.trim();
  const severity = parseInt(document.getElementById('alert-severity').value, 10);
  const sourceUrl = document.getElementById('alert-url').value.trim();

  if (!title || !summary) {
    sysNotice('Title and summary are required.', 'error');
    return;
  }

  if (!confirm(`Send breaking news alert "${title}" (severity ${severity}) to all subscribers?`)) return;

  const btn = document.getElementById('sys-alert-btn');
  const result = document.getElementById('sys-alert-result');
  btn.disabled = true;
  btn.textContent = 'Sending\u2026';
  result.innerHTML = '';

  try {
    const payload = { title, summary, severity };
    if (sourceUrl) payload.sourceUrl = sourceUrl;
    const data = await api.sendBreakingNewsAlert(payload);
    result.innerHTML = `<div class="admin-notice admin-notice-success">Alert sent. ${esc(data.message || '')}</div>`;
    document.getElementById('alert-title').value = '';
    document.getElementById('alert-summary').value = '';
    document.getElementById('alert-url').value = '';
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Breaking News Alert';
  }
}

function sysNotice(msg, type) {
  const el = document.getElementById('sys-notice');
  if (!el) return;
  el.innerHTML = msg ? `<div class="admin-notice admin-notice-${type}">${esc(msg)}</div>` : '';
  if (type !== 'error') setTimeout(() => { el.innerHTML = ''; }, 4000);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
