/**
 * Ingestion View — Admin
 *
 * Manual triggers: add tweet by URL, fetch profile tweets, CSV import.
 */

import * as api from '../lib/api.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">Ingestion</h2>
        <p class="view-subtitle">Manually trigger content ingestion</p>
      </div>
    </div>
    <div id="ingest-notice"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">

      <!-- Add Tweet -->
      <div class="admin-card">
        <h3 class="admin-card-title">Add Post from URL</h3>
        <div class="form-group">
          <label class="form-label">Tweet / Post URL</label>
          <input class="admin-input" id="tweet-url" placeholder="https://x.com/user/status/123456">
        </div>
        <button class="admin-btn admin-btn-primary" id="fetch-tweet-btn">Fetch &amp; Store</button>
        <div id="tweet-result" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- Fetch Profile -->
      <div class="admin-card">
        <h3 class="admin-card-title">Fetch Profile Tweets</h3>
        <div class="form-group">
          <label class="form-label">Profile URL or Username</label>
          <input class="admin-input" id="profile-url" placeholder="https://x.com/username or @username">
        </div>
        <button class="admin-btn admin-btn-primary" id="fetch-profile-btn">Fetch Profile</button>
        <div id="profile-result" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- CSV Import -->
      <div class="admin-card" style="grid-column:1/-1">
        <h3 class="admin-card-title">CSV Import</h3>
        <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-md)">
          Paste CSV content with columns: url, text, source, category, date
        </p>
        <div class="form-group">
          <label class="form-label">CSV Content</label>
          <textarea class="admin-input admin-textarea" id="csv-content" rows="6" placeholder="url,text,source,category,date&#10;https://...,Breaking news...,Reuters,breaking-news,2026-03-22"></textarea>
        </div>
        <button class="admin-btn admin-btn-primary" id="csv-import-btn">Import CSV</button>
        <div id="csv-result" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- Screenshot Extraction -->
      <div class="admin-card" style="grid-column:1/-1">
        <h3 class="admin-card-title">Screenshot Extraction</h3>
        <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-md)">
          Extract post content from a screenshot URL using AI vision.
        </p>
        <div class="form-group">
          <label class="form-label">Image URL</label>
          <input class="admin-input" id="screenshot-url" placeholder="https://example.com/screenshot.png">
        </div>
        <button class="admin-btn admin-btn-primary" id="screenshot-btn">Extract Content</button>
        <div id="screenshot-result" style="margin-top:var(--space-sm)"></div>
      </div>

    </div>
  `;

  document.getElementById('fetch-tweet-btn').addEventListener('click', handleFetchTweet);
  document.getElementById('fetch-profile-btn').addEventListener('click', handleFetchProfile);
  document.getElementById('csv-import-btn').addEventListener('click', handleCSVImport);
  document.getElementById('screenshot-btn').addEventListener('click', handleScreenshot);
}

async function handleFetchTweet() {
  const url = document.getElementById('tweet-url').value.trim();
  if (!url) return;
  const btn = document.getElementById('fetch-tweet-btn');
  const result = document.getElementById('tweet-result');
  btn.disabled = true;
  btn.textContent = 'Fetching\u2026';
  result.innerHTML = '';
  try {
    const data = await api.fetchTweet(url);
    result.innerHTML = `<div class="admin-notice admin-notice-success">Post stored successfully.${data.id ? ` ID: ${esc(data.id)}` : ''}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch & Store';
  }
}

async function handleFetchProfile() {
  const url = document.getElementById('profile-url').value.trim();
  if (!url) return;
  const btn = document.getElementById('fetch-profile-btn');
  const result = document.getElementById('profile-result');
  btn.disabled = true;
  btn.textContent = 'Fetching\u2026';
  result.innerHTML = '';
  try {
    const data = await api.fetchProfileTweets(url);
    const count = data.count || data.posts?.length || 'unknown';
    result.innerHTML = `<div class="admin-notice admin-notice-success">${count} posts fetched from profile.</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Fetch Profile';
  }
}

async function handleCSVImport() {
  const csv = document.getElementById('csv-content').value.trim();
  if (!csv) return;
  const btn = document.getElementById('csv-import-btn');
  const result = document.getElementById('csv-result');
  btn.disabled = true;
  btn.textContent = 'Importing\u2026';
  result.innerHTML = '';
  try {
    const data = await api.importCSV(csv);
    const count = data.processed || data.count || 'unknown';
    result.innerHTML = `<div class="admin-notice admin-notice-success">${count} posts imported.</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import CSV';
  }
}

async function handleScreenshot() {
  const url = document.getElementById('screenshot-url').value.trim();
  if (!url) return;
  const btn = document.getElementById('screenshot-btn');
  const result = document.getElementById('screenshot-result');
  btn.disabled = true;
  btn.textContent = 'Extracting\u2026';
  result.innerHTML = '';
  try {
    const data = await api.processScreenshot(url);
    result.innerHTML = `
      <div class="admin-notice admin-notice-success">Content extracted.</div>
      <pre style="background:var(--color-bg-surface);padding:var(--space-md);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-text-secondary);overflow-x:auto;margin-top:var(--space-sm)">${esc(JSON.stringify(data, null, 2))}</pre>
    `;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Extract Content';
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
