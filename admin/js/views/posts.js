/**
 * Posts View - Admin
 *
 * List, search, delete, and edit basic fields on posts.
 */

import * as api from '../lib/api.js';

let postsCache = [];

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">Posts</h2>
        <p class="view-subtitle">Manage published posts</p>
      </div>
      <div class="toolbar">
        <input type="text" class="admin-input" id="post-search" placeholder="Search posts\u2026" style="width:240px">
        <button class="admin-btn admin-btn-secondary" id="posts-refresh">Refresh</button>
      </div>
    </div>
    <div id="posts-notice"></div>
    <div id="posts-table-area">
      <div class="admin-loading">Loading posts\u2026</div>
    </div>
    <div id="post-edit-panel" style="display:none"></div>
  `;

  document.getElementById('posts-refresh').addEventListener('click', loadPosts);
  document.getElementById('post-search').addEventListener('input', filterPosts);
  loadPosts();
}

async function loadPosts() {
  const area = document.getElementById('posts-table-area');
  area.innerHTML = '<div class="admin-loading">Loading posts\u2026</div>';
  try {
    const data = await api.listPosts(100);
    postsCache = Array.isArray(data) ? data : (data.posts || []);
    renderTable(postsCache);
  } catch (err) {
    area.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
  }
}

function filterPosts() {
  const q = (document.getElementById('post-search')?.value || '').toLowerCase();
  if (!q) return renderTable(postsCache);
  const filtered = postsCache.filter(p =>
    (p.text || '').toLowerCase().includes(q) ||
    (p.id || '').toLowerCase().includes(q) ||
    (p.author || '').toLowerCase().includes(q) ||
    (p.source || '').toLowerCase().includes(q)
  );
  renderTable(filtered);
}

function renderTable(posts) {
  const area = document.getElementById('posts-table-area');
  if (!posts.length) {
    area.innerHTML = '<div class="admin-empty">No posts found.</div>';
    return;
  }

  area.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Text</th>
            <th>Source</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${posts.map(p => `
            <tr data-id="${esc(p.id)}">
              <td class="text-mono">${esc(truncate(p.id, 20))}</td>
              <td class="text-truncate" title="${esc(p.text || '')}">${esc(truncate(p.text || '(no text)', 80))}</td>
              <td>${esc(p.source || p.author || '\u2014')}</td>
              <td class="text-mono">${formatDate(p.created_at || p.date || p.postedAt)}</td>
              <td>
                <button class="admin-btn admin-btn-sm admin-btn-secondary post-edit-btn" data-id="${esc(p.id)}">Edit</button>
                <button class="admin-btn admin-btn-sm admin-btn-danger post-delete-btn" data-id="${esc(p.id)}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="margin-top:var(--space-sm);font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-text-muted)">${posts.length} post${posts.length === 1 ? '' : 's'}</p>
  `;

  area.querySelectorAll('.post-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
  });
  area.querySelectorAll('.post-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => showEditPanel(btn.dataset.id));
  });
}

async function confirmDelete(postId) {
  if (!confirm(`Delete post "${postId}"? This cannot be undone.`)) return;
  notice('Deleting\u2026', 'info');
  try {
    await api.deletePost(postId);
    notice('Post deleted.', 'success');
    postsCache = postsCache.filter(p => p.id !== postId);
    filterPosts();
  } catch (err) {
    notice(`Delete failed: ${err.message}`, 'error');
  }
}

function showEditPanel(postId) {
  const post = postsCache.find(p => p.id === postId);
  if (!post) return;

  const panel = document.getElementById('post-edit-panel');
  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="admin-card" style="margin-top:var(--space-lg)">
      <h3 class="admin-card-title">Edit Post: ${esc(truncate(postId, 30))}</h3>
      <div class="form-group">
        <label class="form-label">Text</label>
        <textarea class="admin-input admin-textarea" id="edit-text" rows="3">${esc(post.text || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Source</label>
          <input class="admin-input" id="edit-source" value="${esc(post.source || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Author</label>
          <input class="admin-input" id="edit-author" value="${esc(post.author || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <input class="admin-input" id="edit-category" value="${esc(post.category || '')}">
      </div>
      <div class="toolbar" style="margin-top:var(--space-md)">
        <button class="admin-btn admin-btn-primary" id="edit-save">Save Changes</button>
        <button class="admin-btn admin-btn-secondary" id="edit-cancel">Cancel</button>
      </div>
      <div id="edit-notice" style="margin-top:var(--space-sm)"></div>
    </div>
  `;

  document.getElementById('edit-cancel').addEventListener('click', () => {
    panel.style.display = 'none';
  });
  document.getElementById('edit-save').addEventListener('click', async () => {
    const btn = document.getElementById('edit-save');
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';
    try {
      await api.updatePost(postId, {
        text: document.getElementById('edit-text').value,
        source: document.getElementById('edit-source').value,
        author: document.getElementById('edit-author').value,
        category: document.getElementById('edit-category').value,
      });
      const editNotice = document.getElementById('edit-notice');
      editNotice.innerHTML = '<div class="admin-notice admin-notice-success">Saved.</div>';
      await loadPosts();
    } catch (err) {
      const editNotice = document.getElementById('edit-notice');
      editNotice.innerHTML = `<div class="admin-notice admin-notice-error">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });
}

function notice(msg, type) {
  const el = document.getElementById('posts-notice');
  if (!el) return;
  el.innerHTML = msg ? `<div class="admin-notice admin-notice-${type}">${esc(msg)}</div>` : '';
  if (type === 'success') setTimeout(() => { el.innerHTML = ''; }, 3000);
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

function formatDate(d) {
  if (!d) return '\u2014';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d).slice(0, 10);
    return dt.toISOString().slice(0, 16).replace('T', ' ');
  } catch { return '\u2014'; }
}
