/**
 * Newsletter View - Admin
 *
 * List templates, load, AI generation, send.
 */

import * as api from '../lib/api.js';

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">Newsletter</h2>
        <p class="view-subtitle">Manage templates and send newsletters</p>
      </div>
      <div class="toolbar">
        <button class="admin-btn admin-btn-secondary" id="nl-refresh">Refresh</button>
      </div>
    </div>
    <div id="nl-notice"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">

      <!-- Templates List -->
      <div class="admin-card">
        <h3 class="admin-card-title">Templates</h3>
        <div id="nl-templates-list">
          <div class="admin-loading">Loading templates\u2026</div>
        </div>
      </div>

      <!-- AI Generation -->
      <div class="admin-card">
        <h3 class="admin-card-title">AI Generation</h3>
        <div class="form-group">
          <label class="form-label">Prompt</label>
          <textarea class="admin-input admin-textarea" id="nl-ai-prompt" rows="4" placeholder="Generate a newsletter about this week's top stories\u2026"></textarea>
        </div>
        <button class="admin-btn admin-btn-primary" id="nl-generate-btn">Generate HTML</button>
        <div id="nl-generate-result" style="margin-top:var(--space-sm)"></div>
      </div>

      <!-- Send Newsletter -->
      <div class="admin-card" style="grid-column:1/-1">
        <h3 class="admin-card-title">Send Newsletter</h3>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Subject</label>
            <input class="admin-input" id="nl-subject" placeholder="Newsletter subject line">
          </div>
          <div class="form-group">
            <label class="form-label">Test Email (optional)</label>
            <input class="admin-input" id="nl-test-email" placeholder="test@example.com">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Template ID (from list above)</label>
          <input class="admin-input" id="nl-template-id" placeholder="Template ID to send">
        </div>
        <div class="toolbar" style="margin-top:var(--space-md)">
          <button class="admin-btn admin-btn-secondary" id="nl-test-send-btn">Send Test</button>
          <button class="admin-btn admin-btn-danger" id="nl-send-btn">Send to All Subscribers</button>
        </div>
        <div id="nl-send-result" style="margin-top:var(--space-sm)"></div>
      </div>

    </div>
  `;

  document.getElementById('nl-refresh').addEventListener('click', loadTemplates);
  document.getElementById('nl-generate-btn').addEventListener('click', handleGenerate);
  document.getElementById('nl-test-send-btn').addEventListener('click', () => handleSend(true));
  document.getElementById('nl-send-btn').addEventListener('click', () => handleSend(false));
  loadTemplates();
}

async function loadTemplates() {
  const el = document.getElementById('nl-templates-list');
  el.innerHTML = '<div class="admin-loading">Loading\u2026</div>';
  try {
    const data = await api.listTemplates();
    const templates = data.templates || data || [];
    if (!Array.isArray(templates) || !templates.length) {
      el.innerHTML = '<div class="admin-empty">No templates found.</div>';
      return;
    }
    el.innerHTML = `
      <div class="admin-table-wrap" style="max-height:300px">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Name</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${templates.map(t => `
              <tr>
                <td class="text-mono">${esc(truncate(t.id || t.key || '', 16))}</td>
                <td>${esc(t.name || t.subject || '\u2014')}</td>
                <td class="text-mono">${esc((t.date || t.createdAt || '').toString().slice(0, 10))}</td>
                <td>
                  <button class="admin-btn admin-btn-sm admin-btn-secondary nl-load-btn" data-id="${esc(t.id || t.key || '')}">Load</button>
                  <button class="admin-btn admin-btn-sm admin-btn-danger nl-del-btn" data-id="${esc(t.id || t.key || '')}">Del</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    el.querySelectorAll('.nl-load-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        document.getElementById('nl-template-id').value = id;
        nlNotice(`Template "${id}" selected.`, 'info');
      });
    });
    el.querySelectorAll('.nl-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Delete template "${btn.dataset.id}"?`)) return;
        try {
          await api.deleteTemplate(btn.dataset.id);
          nlNotice('Template deleted.', 'success');
          loadTemplates();
        } catch (err) {
          nlNotice(`Delete failed: ${err.message}`, 'error');
        }
      });
    });
  } catch (err) {
    el.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  }
}

async function handleGenerate() {
  const prompt = document.getElementById('nl-ai-prompt').value.trim();
  if (!prompt) return;
  const btn = document.getElementById('nl-generate-btn');
  const result = document.getElementById('nl-generate-result');
  btn.disabled = true;
  btn.textContent = 'Generating\u2026';
  result.innerHTML = '';
  try {
    const data = await api.generateNewsletterHtml(prompt);
    const html = data.html || data.content || JSON.stringify(data);
    result.innerHTML = `
      <div class="admin-notice admin-notice-success">HTML generated.</div>
      <details style="margin-top:var(--space-sm)">
        <summary style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-accent);cursor:pointer">Preview HTML</summary>
        <pre style="background:var(--color-bg-surface);padding:var(--space-md);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-text-secondary);overflow-x:auto;max-height:300px;margin-top:var(--space-xs)">${esc(html)}</pre>
      </details>
    `;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate HTML';
  }
}

async function handleSend(isTest) {
  const subject = document.getElementById('nl-subject').value.trim();
  const templateId = document.getElementById('nl-template-id').value.trim();
  const testEmail = document.getElementById('nl-test-email').value.trim();

  if (!subject) return nlNotice('Subject is required.', 'error');
  if (!templateId) return nlNotice('Template ID is required.', 'error');
  if (!isTest && !confirm('Send newsletter to ALL subscribers? This cannot be undone.')) return;

  const btn = isTest ? document.getElementById('nl-test-send-btn') : document.getElementById('nl-send-btn');
  const result = document.getElementById('nl-send-result');
  btn.disabled = true;
  btn.textContent = 'Sending\u2026';
  result.innerHTML = '';

  try {
    const options = { subject, templateId };
    if (isTest && testEmail) options.testEmail = testEmail;
    if (isTest) options.test = true;
    const data = await api.sendNewsletter(options);
    result.innerHTML = `<div class="admin-notice admin-notice-success">${isTest ? 'Test sent' : 'Newsletter sent'}. ${esc(data.message || '')}</div>`;
  } catch (err) {
    result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = isTest ? 'Send Test' : 'Send to All Subscribers';
  }
}

function nlNotice(msg, type) {
  const el = document.getElementById('nl-notice');
  if (!el) return;
  el.innerHTML = msg ? `<div class="admin-notice admin-notice-${type}">${esc(msg)}</div>` : '';
  if (type === 'success' || type === 'info') setTimeout(() => { el.innerHTML = ''; }, 4000);
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
