#!/usr/bin/env node
'use strict';

/**
 * Localhost-only review server for clip jobs.
 * Human approval required before X upload.
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');
const { listJobs, getJob, updateJob, appendAuditLog } = require('./clip-job-store');
const { summarizeProbe } = require('./ffmpeg-utils');
const { hasRightsBasis } = require('./lib/rights-guard');
const { REPO_ROOT, DATA_ROOT, isDryRun } = require('./lib/paths');
const { uploadClipToX, isXUploadConfigured } = require('./x-upload');

const PORT = parseInt(process.env.CLIP_REVIEW_PORT || '8791', 10);
const HOST = '127.0.0.1';
const REVIEW_TOKEN = process.env.CLIP_REVIEW_TOKEN || '';

function checkAuth(reqUrl) {
  if (!REVIEW_TOKEN) return true;
  return reqUrl.searchParams.get('token') === REVIEW_TOKEN;
}

function safeDataPath(urlPath) {
  const relative = urlPath.replace(/^\/media\//, '');
  const resolved = path.resolve(DATA_ROOT, relative);
  if (!resolved.startsWith(DATA_ROOT)) {
    return null;
  }
  return resolved;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

async function loadProbeSummary(job) {
  if (!job.ffprobe_path || !fs.existsSync(job.ffprobe_path)) return null;
  const raw = JSON.parse(await fsp.readFile(job.ffprobe_path, 'utf8'));
  return summarizeProbe(raw);
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mediaUrl(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return '';
  const rel = path.relative(DATA_ROOT, absPath);
  const tokenQ = REVIEW_TOKEN ? `?token=${encodeURIComponent(REVIEW_TOKEN)}` : '';
  return `/media/${rel.split(path.sep).join('/')}${tokenQ}`;
}

async function renderJobPage(job) {
  const summary = await loadProbeSummary(job);
  const videoSrc = mediaUrl(job.output_path);
  const thumbSrc = mediaUrl(job.thumbnail_path);
  const xConfigured = isXUploadConfigured();
  const canUpload = job.status === 'approved' && hasRightsBasis(job) && xConfigured;
  const canApprove = job.status === 'review_ready';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clip Review — ${escHtml(job.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; background: #0f1115; color: #e8eaed; }
    h1 { font-size: 1.4rem; }
    .meta { color: #9aa0a6; margin-bottom: 1rem; }
    video { width: 100%; max-height: 480px; background: #000; border-radius: 8px; }
    img { max-width: 320px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    textarea { width: 100%; min-height: 80px; background: #1a1d24; color: #e8eaed; border: 1px solid #333; border-radius: 6px; padding: 0.5rem; }
    button, .btn { padding: 0.5rem 1rem; margin: 0.25rem 0.25rem 0.25rem 0; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
    .approve { background: #1e8e3e; color: #fff; }
    .reject { background: #c5221f; color: #fff; }
    .secondary { background: #333; color: #fff; }
    .warn { background: #3c2f00; color: #f9ab00; padding: 0.75rem; border-radius: 6px; margin: 1rem 0; }
    .card { background: #1a1d24; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    a { color: #8ab4f8; }
    code { background: #222; padding: 0.1rem 0.3rem; border-radius: 3px; }
  </style>
</head>
<body>
  <p><a href="/">← All jobs</a></p>
  <h1>${escHtml(job.title)}</h1>
  <p class="meta">Status: <strong>${escHtml(job.status)}</strong> · ID: <code>${escHtml(job.id)}</code></p>

  ${!hasRightsBasis(job) ? '<div class="warn">rights_basis is missing — X upload blocked until documented.</div>' : ''}

  <div class="card">
    <p><strong>Attribution:</strong> ${escHtml(job.source_attribution || '(none)')}</p>
    <p><strong>Rights basis:</strong> ${escHtml(job.rights_basis || '(missing)')}</p>
    <p><strong>Clip range:</strong> ${escHtml(job.requested_clip_start)} → ${escHtml(job.requested_clip_end)}</p>
    ${summary ? `<p><strong>Duration:</strong> ${summary.duration?.toFixed(2)}s · ${summary.width}x${summary.height} · ${summary.videoCodec}/${summary.audioCodec}</p>` : ''}
    <p><strong>Output path:</strong> <code>${escHtml(job.output_path)}</code></p>
  </div>

  ${videoSrc ? `<video controls src="${escHtml(videoSrc)}"></video>` : '<p>No video preview available.</p>'}
  ${thumbSrc ? `<p><img src="${escHtml(thumbSrc)}" alt="Thumbnail"></p>` : ''}

  <div class="card">
    <label for="postText"><strong>Draft X post text</strong> (edit before upload — no auto-generated claims)</label>
    <textarea id="postText">${escHtml(job.draft_post_text || '')}</textarea>
  </div>

  <div>
    ${canApprove ? `<button class="approve" onclick="doAction('approve')">Approve</button>` : ''}
    ${job.status === 'review_ready' || job.status === 'approved' ? `<button class="reject" onclick="doAction('reject')">Reject</button>` : ''}
    <button class="secondary" onclick="copyPath()">Copy file path</button>
    ${canUpload ? `<button class="secondary" onclick="doAction('upload')">Upload to X</button>` : ''}
    ${job.status === 'approved' && !xConfigured ? '<span class="warn" style="display:inline-block">X upload not configured (set X_USER_ACCESS_TOKEN + X_UPLOAD_ENABLED=true)</span>' : ''}
  </div>

  <script>
    const jobId = ${JSON.stringify(job.id)};
    const outputPath = ${JSON.stringify(job.output_path || '')};
    const token = ${JSON.stringify(REVIEW_TOKEN)};

    async function doAction(action) {
      const postText = document.getElementById('postText').value;
      const q = token ? '?token=' + encodeURIComponent(token) : '';
      const res = await fetch('/api/' + action + '/' + jobId + q, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postText }),
      });
      const data = await res.json();
      alert(data.message || (data.ok ? 'OK' : 'Failed'));
      if (data.ok) location.reload();
    }

    function copyPath() {
      navigator.clipboard.writeText(outputPath).then(() => alert('Path copied'));
    }
  </script>
</body>
</html>`;
}

async function renderIndex() {
  const jobs = await listJobs();
  const rows = jobs
    .map(
      (j) =>
        `<li><a href="/job/${j.id}${REVIEW_TOKEN ? `?token=${encodeURIComponent(REVIEW_TOKEN)}` : ''}">${escHtml(j.title)}</a> — ${escHtml(j.status)}</li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Clip Review</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;background:#0f1115;color:#e8eaed}a{color:#8ab4f8}</style>
</head><body>
<h1>Clip Pipeline Review</h1>
<p>Localhost only. Human approval required before posting to X.</p>
<ul>${rows || '<li>No jobs yet.</li>'}</ul>
</body></html>`;
}

async function handleApi(action, jobId, body) {
  if (action === 'approve') {
    const job = await getJob(jobId);
    if (job.status !== 'review_ready') {
      return { ok: false, message: `Cannot approve from status ${job.status}` };
    }
    await updateJob(jobId, { status: 'approved', draft_post_text: body.postText || job.draft_post_text || '' });
    await appendAuditLog('job_approved', jobId, { via: 'review-server' });
    return { ok: true, message: 'Approved' };
  }

  if (action === 'reject') {
    await updateJob(jobId, { status: 'rejected', error_message: 'Rejected via review server' });
    await appendAuditLog('job_rejected', jobId, { via: 'review-server' });
    return { ok: true, message: 'Rejected' };
  }

  if (action === 'upload') {
    const job = await getJob(jobId);
    if (job.status !== 'approved') {
      return { ok: false, message: 'Job must be approved before upload' };
    }
    if (!hasRightsBasis(job)) {
      return { ok: false, message: 'rights_basis required' };
    }
    if (isDryRun()) {
      return { ok: true, message: 'DRY-RUN — would upload to X' };
    }
    const result = await uploadClipToX(job, body.postText || job.draft_post_text);
    return { ok: true, message: `Uploaded: ${result.xPostId}` };
  }

  return { ok: false, message: 'Unknown action' };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function main() {
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://${HOST}:${PORT}`);

      if (!checkAuth(reqUrl)) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
      }

      if (reqUrl.pathname.startsWith('/media/')) {
        const filePath = safeDataPath(reqUrl.pathname);
        if (!filePath || !fs.existsSync(filePath)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const stat = await fsp.stat(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath), 'Content-Length': stat.size });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      if (req.method === 'POST' && reqUrl.pathname.startsWith('/api/')) {
        const parts = reqUrl.pathname.split('/').filter(Boolean);
        const action = parts[1];
        const jobId = parts[2];
        const body = await readBody(req);
        const result = await handleApi(action, jobId, body);
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (reqUrl.pathname.startsWith('/job/')) {
        const jobId = reqUrl.pathname.split('/')[2];
        const job = await getJob(jobId);
        const html = await renderJobPage(job);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') {
        const html = await renderIndex();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[review-server] http://${HOST}:${PORT}/`);
    console.log(`[review-server] Serving media from ${DATA_ROOT}`);
    if (REVIEW_TOKEN) console.log('[review-server] Token auth enabled (CLIP_REVIEW_TOKEN)');
  });
}

main();
