/**
 * Admin API Client — Noteworthy News
 *
 * Every request includes Authorization: Bearer <jwt>.
 * No query-string tokens. No sessionStorage secrets.
 */

let _getToken = null;

export function setTokenProvider(fn) {
  _getToken = fn;
}

async function getHeaders(contentType = 'application/json') {
  const token = _getToken ? await _getToken() : null;
  if (!token) throw new Error('Not authenticated');

  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function request(path, options = {}) {
  const { method = 'GET', body, contentType = 'application/json' } = options;
  const headers = await getHeaders(contentType);
  const url = `/.netlify/functions/${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = { error: res.statusText }; }
    const err = new Error(detail.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// ── Posts ──────────────────────────────────────────

export async function listPosts(limit = 50) {
  const res = await fetch(`/.netlify/functions/posts-read?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load posts');
  return res.json();
}

export function deletePost(postId) {
  return request('remove-post', { method: 'POST', body: { postId } });
}

export function updatePost(postId, fields) {
  return request('update-post-data', { method: 'POST', body: { postId, ...fields } });
}

export function uploadPostMedia(postId, dataUrl, filename) {
  return request('upload-post-media', { method: 'POST', body: { postId, dataUrl, filename } });
}

export function processScreenshot(url) {
  return request('process-post-screenshot', { method: 'POST', body: { url } });
}

// ── Ingestion ─────────────────────────────────────

export function fetchTweet(tweetUrl) {
  return request('fetch-tweets-simple', { method: 'POST', body: { tweetUrl } });
}

export function fetchProfileTweets(profileUrl) {
  return request('fetch-profile-tweets', { method: 'POST', body: { tweetUrl: profileUrl } });
}

export function importCSV(csvContent) {
  return request('process-csv-posts', { method: 'POST', body: { csv: csvContent } });
}

// ── Newsletter ────────────────────────────────────

export async function listTemplates() {
  const headers = await getHeaders();
  const res = await fetch('/.netlify/functions/newsletter-templates', { headers });
  if (!res.ok) throw new Error('Failed to load templates');
  return res.json();
}

export async function getTemplate(id) {
  const headers = await getHeaders();
  const res = await fetch(`/.netlify/functions/newsletter-templates?id=${id}`, { headers });
  if (!res.ok) throw new Error('Failed to load template');
  return res.json();
}

export function saveTemplate(template) {
  return request('newsletter-templates', { method: 'POST', body: template });
}

export function deleteTemplate(id) {
  return request('newsletter-templates', { method: 'DELETE', body: { id } });
}

export function generateNewsletterHtml(prompt, options = {}) {
  return request('generate-newsletter-html', { method: 'POST', body: { prompt, ...options } });
}

export function sendNewsletter(options) {
  return request('send-newsletter', { method: 'POST', body: options });
}

// ── Video Watermarker ─────────────────────────────

export async function getWatermarkUploadUrl(fileName, fileSize) {
  const headers = await getHeaders();
  const qs = new URLSearchParams({ fileName, fileSize: String(fileSize) }).toString();
  const res = await fetch(`/.netlify/functions/watermark-upload-url?${qs}`, { headers });
  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = { error: res.statusText }; }
    throw new Error(detail.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function createWatermarkJob(payload) {
  return request('watermark-create-job', { method: 'POST', body: payload });
}

export async function getWatermarkJobStatus(jobId) {
  const headers = await getHeaders();
  const res = await fetch(`/.netlify/functions/watermark-job-status?id=${encodeURIComponent(jobId)}`, { headers });
  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = { error: res.statusText }; }
    throw new Error(detail.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Analytics ─────────────────────────────────────

export async function queryLogs(params = {}) {
  const headers = await getHeaders();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/.netlify/functions/log-data?${qs}`, { headers });
  if (!res.ok) throw new Error('Failed to query logs');
  return res.json();
}

export async function getUserProfile(email) {
  const headers = await getHeaders();
  const res = await fetch(`/.netlify/functions/get-user-profile?email=${encodeURIComponent(email)}`, { headers });
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}

// ── System / Maintenance ──────────────────────────

export function rebuildIndex() {
  return request('rebuild-index', { method: 'POST', body: {} });
}

export function removeLongPosts() {
  return request('remove-long-posts', { method: 'POST', body: {} });
}

export function removeOldAlertPosts() {
  return request('remove-old-alert-posts', { method: 'POST', body: {} });
}

export function sendBreakingNewsAlert(alert) {
  return request('send-breaking-news-alert', { method: 'POST', body: alert });
}

// ── Live Stories ──────────────────────────────────

export function listLiveStories() {
  return request('admin-live-stories?action=list');
}

export function getLiveStory(slug) {
  return request(`admin-live-stories?slug=${encodeURIComponent(slug)}`);
}

export function createLiveStory(fields) {
  return request('admin-live-stories', { method: 'POST', body: { action: 'createStory', ...fields } });
}

export function updateLiveStory(fields) {
  return request('admin-live-stories', { method: 'POST', body: { action: 'updateStory', ...fields } });
}

export function addLiveStoryUpdate(fields) {
  return request('admin-live-stories', { method: 'POST', body: { action: 'addUpdate', ...fields } });
}
