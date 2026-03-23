/**
 * Analytics View — Admin
 *
 * Query logs, basic stats, user profile lookup.
 */

import * as api from '../lib/api.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">Analytics</h2>
        <p class="view-subtitle">View site analytics and user data</p>
      </div>
    </div>
    <div id="analytics-notice"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">

      <!-- Log Query -->
      <div class="admin-card" style="grid-column:1/-1">
        <h3 class="admin-card-title">Query Logs</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date (YYYY-MM-DD)</label>
            <input class="admin-input" id="log-date" type="date" value="${today()}">
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="admin-input admin-select" id="log-type">
              <option value="">All types</option>
              <option value="pageview">Page views</option>
              <option value="click">Clicks</option>
              <option value="scroll">Scroll</option>
              <option value="engagement">Engagement</option>
              <option value="error">Errors</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Limit</label>
            <input class="admin-input" id="log-limit" type="number" value="50" min="1" max="500">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="admin-btn admin-btn-primary" id="log-query-btn" style="width:100%">Query Logs</button>
          </div>
        </div>
        <div id="log-results" style="margin-top:var(--space-md)"></div>
      </div>

      <!-- User Profile Lookup -->
      <div class="admin-card">
        <h3 class="admin-card-title">User Profile Lookup</h3>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="admin-input" id="profile-email" placeholder="user@example.com">
        </div>
        <button class="admin-btn admin-btn-primary" id="profile-lookup-btn">Lookup</button>
        <div id="profile-results" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- Quick Stats -->
      <div class="admin-card">
        <h3 class="admin-card-title">Today's Stats</h3>
        <div id="stats-area">
          <div class="admin-loading">Load logs to see stats.</div>
        </div>
      </div>

    </div>
  `;

  document.getElementById('log-query-btn').addEventListener('click', queryLogs);
  document.getElementById('profile-lookup-btn').addEventListener('click', lookupProfile);
}

async function queryLogs() {
  const date = document.getElementById('log-date').value;
  const type = document.getElementById('log-type').value;
  const limit = document.getElementById('log-limit').value;
  const btn = document.getElementById('log-query-btn');
  const results = document.getElementById('log-results');

  btn.disabled = true;
  btn.textContent = 'Querying\u2026';
  results.innerHTML = '<div class="admin-loading">Loading\u2026</div>';

  try {
    const params = { limit };
    if (date) params.date = date;
    if (type) params.type = type;
    const data = await api.queryLogs(params);

    const logs = Array.isArray(data) ? data : (data.logs || data.events || []);
    if (!logs.length) {
      results.innerHTML = '<div class="admin-empty">No logs found for this query.</div>';
      updateStats([]);
      return;
    }

    results.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Time</th><th>Type</th><th>Page</th><th>Detail</th></tr>
          </thead>
          <tbody>
            ${logs.slice(0, 200).map(l => `
              <tr>
                <td class="text-mono">${esc(formatTime(l.timestamp || l.time || l.date))}</td>
                <td><span class="admin-badge">${esc(l.type || l.event || '\u2014')}</span></td>
                <td class="text-truncate" title="${esc(l.page || l.url || '')}">${esc(truncate(l.page || l.url || '\u2014', 40))}</td>
                <td class="text-truncate" title="${esc(l.detail || l.data || '')}">${esc(truncate(JSON.stringify(l.detail || l.data || ''), 60))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="margin-top:var(--space-sm);font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-text-muted)">${logs.length} event${logs.length === 1 ? '' : 's'} returned</p>
    `;
    updateStats(logs);
  } catch (err) {
    results.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Query Logs';
  }
}

function updateStats(logs) {
  const el = document.getElementById('stats-area');
  if (!logs.length) {
    el.innerHTML = '<div class="admin-empty">No data.</div>';
    return;
  }
  const types = {};
  logs.forEach(l => {
    const t = l.type || l.event || 'unknown';
    types[t] = (types[t] || 0) + 1;
  });
  const sorted = Object.entries(types).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `
    <div class="kv-grid">
      <span class="kv-key">Total events</span>
      <span class="kv-value">${logs.length}</span>
      ${sorted.map(([k, v]) => `
        <span class="kv-key">${esc(k)}</span>
        <span class="kv-value">${v}</span>
      `).join('')}
    </div>
  `;
}

async function lookupProfile() {
  const email = document.getElementById('profile-email').value.trim();
  if (!email) return;
  const btn = document.getElementById('profile-lookup-btn');
  const results = document.getElementById('profile-results');
  btn.disabled = true;
  btn.textContent = 'Loading\u2026';
  results.innerHTML = '';
  try {
    const data = await api.getUserProfile(email);
    const profile = data.profile || data;
    results.innerHTML = `
      <div class="kv-grid" style="margin-top:var(--space-md)">
        ${Object.entries(profile).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => `
          <span class="kv-key">${esc(k)}</span>
          <span class="kv-value">${esc(String(v))}</span>
        `).join('')}
      </div>
    `;
  } catch (err) {
    results.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lookup';
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(d) {
  if (!d) return '\u2014';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d).slice(0, 19);
    return dt.toISOString().slice(11, 19);
  } catch { return '\u2014'; }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '\u2026' : s;
}
