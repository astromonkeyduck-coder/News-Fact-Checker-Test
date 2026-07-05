/**
 * Video Watermarker View - Admin
 *
 * Internal Noteworthy News creator tool: paste an authorized Facebook video
 * link (compliant Graph API retrieval) or upload a video manually, then export
 * a Noteworthy News watermarked MP4.
 *
 * Backend routes are all admin-authenticated. This view only orchestrates the
 * presigned upload -> create job -> poll status -> preview/download flow.
 */

import * as api from '../lib/api.js';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
const ALLOWED_EXT = ['mp4', 'mov', 'webm', 'm4v'];

let pollTimer = null;

export function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-title">Facebook Video Watermarker</h2>
        <p class="view-subtitle">Paste an authorized Facebook video link or upload a video manually, then export a Noteworthy News watermarked version.</p>
      </div>
    </div>

    <div id="wm-notice"></div>

    <div class="wm-layout">
      <div class="wm-col">

        <!-- Shared credit + placement -->
        <div class="admin-card">
          <h3 class="admin-card-title">Credit &amp; placement</h3>
          <div class="form-group">
            <label class="form-label" for="wm-credit">Source credit</label>
            <input class="admin-input" id="wm-credit" placeholder="username (without @)" autocomplete="off">
            <p style="font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-text-muted);margin-top:6px">
              Shown as the second watermark line. Leave blank to use <code>Facebook</code>.
            </p>
          </div>
          <div class="form-group">
            <label class="form-label" for="wm-position">Watermark position</label>
            <select class="admin-input admin-select" id="wm-position">
              <option value="lower-left">Lower left (default)</option>
              <option value="lower-right">Lower right</option>
              <option value="upper-left">Upper left</option>
              <option value="upper-right">Upper right</option>
            </select>
          </div>
          <label style="display:flex;gap:10px;align-items:flex-start;font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);cursor:pointer">
            <input type="checkbox" id="wm-rights" style="margin-top:3px;flex-shrink:0">
            <span>I confirm I own this video, have permission to use it, or have the legal right to transform and publish it.</span>
          </label>
        </div>

        <!-- Facebook link -->
        <div class="admin-card">
          <h3 class="admin-card-title">From a Facebook link</h3>
          <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-md)">
            Some Facebook links cannot be fetched automatically. If automatic retrieval is not permitted, you will be asked to upload the file manually below.
          </p>
          <div class="form-group">
            <label class="form-label" for="wm-fb-url">Facebook video link</label>
            <input class="admin-input" id="wm-fb-url" placeholder="https://www.facebook.com/watch/?v=..." autocomplete="off">
          </div>
          <button class="admin-btn admin-btn-primary" id="wm-process-btn">Process Video</button>
        </div>

        <!-- Manual upload -->
        <div class="admin-card" id="wm-manual-card">
          <h3 class="admin-card-title">Upload video manually</h3>
          <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-md)">
            Accepts MP4, MOV, or WebM. Use this when a Facebook link cannot be fetched automatically.
          </p>
          <div id="wm-dropzone" style="border:2px dashed var(--color-border,#23314a);border-radius:12px;padding:var(--space-xl);text-align:center;cursor:pointer;transition:border-color .15s,background .15s">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-muted)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p style="font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-text-secondary);margin:10px 0 2px">
              <strong id="wm-file-label">Drop a video here or click to choose</strong>
            </p>
            <p style="font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-text-muted)">Max 150 MB and 10 minutes by default (limits set by the server)</p>
            <input type="file" id="wm-file-input" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v" hidden>
          </div>
          <button class="admin-btn admin-btn-secondary" id="wm-upload-btn" style="margin-top:var(--space-md)" disabled>Watermark uploaded video</button>
          <div id="wm-upload-progress" style="margin-top:var(--space-sm)"></div>
        </div>
      </div>

      <!-- Preview / status column -->
      <div class="wm-col">
        <div class="admin-card">
          <h3 class="admin-card-title">Watermark preview</h3>
          <div style="position:relative;background:#111;border-radius:10px;aspect-ratio:16/9;display:flex;align-items:flex-end;overflow:hidden">
            <div id="wm-caption" style="padding:10px 14px;line-height:1.15;text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.9)">
              <div style="color:#fff;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:18px">Noteworthy News</div>
              <div id="wm-caption-line2" style="color:#fff;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:18px">VIDEO: Facebook/FB</div>
            </div>
          </div>
          <p style="font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-text-muted);margin-top:8px">
            Exact text rendered onto the exported video.
          </p>
        </div>

        <div class="admin-card" id="wm-status-card" style="display:none">
          <h3 class="admin-card-title">Status</h3>
          <div id="wm-status-body"></div>
          <div id="wm-result" style="margin-top:var(--space-md)"></div>
        </div>
      </div>
    </div>
  `;

  // State
  let selectedFile = null;
  let jobActive = false;

  const els = {
    notice: byId('wm-notice'),
    credit: byId('wm-credit'),
    position: byId('wm-position'),
    rights: byId('wm-rights'),
    fbUrl: byId('wm-fb-url'),
    processBtn: byId('wm-process-btn'),
    manualCard: byId('wm-manual-card'),
    dropzone: byId('wm-dropzone'),
    fileInput: byId('wm-file-input'),
    fileLabel: byId('wm-file-label'),
    uploadBtn: byId('wm-upload-btn'),
    uploadProgress: byId('wm-upload-progress'),
    captionLine2: byId('wm-caption-line2'),
    statusCard: byId('wm-status-card'),
    statusBody: byId('wm-status-body'),
    result: byId('wm-result'),
  };

  // Disable both action buttons while any job/upload is in flight, so a second
  // click can't spawn a duplicate job. Re-enabled on a terminal job state.
  function setActionsDisabled(disabled) {
    els.processBtn.disabled = disabled;
    els.uploadBtn.disabled = disabled || !selectedFile;
  }

  // Live caption preview
  els.credit.addEventListener('input', () => {
    els.captionLine2.textContent = composeCreditLine(els.credit.value);
  });

  // ── Facebook flow ──────────────────────────────────────────────
  els.processBtn.addEventListener('click', async () => {
    if (jobActive) return;
    clearNotice();
    const url = els.fbUrl.value.trim();
    if (!url) return notice('Enter a Facebook video link, or upload a file manually.', 'error');
    if (!els.rights.checked) return notice('Please confirm the rights checkbox before processing.', 'error');

    setActionsDisabled(true);
    els.processBtn.textContent = 'Checking link\u2026';
    try {
      const res = await api.createWatermarkJob({
        mode: 'facebook',
        facebookUrl: url,
        credit: els.credit.value.trim(),
        position: els.position.value,
        rightsConfirmed: true,
      });

      if (res.fallback) {
        // Graceful fallback - guide the user to manual upload.
        if (!els.credit.value.trim() && res.detectedUsername) {
          els.credit.value = res.detectedUsername;
          els.captionLine2.textContent = composeCreditLine(res.detectedUsername);
        }
        notice(res.message || 'Facebook does not allow this video to be fetched automatically. Upload the video file manually instead.', 'info');
        highlightManual();
        els.processBtn.textContent = 'Process Video';
        setActionsDisabled(false);
        return;
      }
      els.processBtn.textContent = 'Process Video';
      startJob(res.jobId);
    } catch (err) {
      notice(err.message || 'Could not start processing.', 'error');
      els.processBtn.textContent = 'Process Video';
      setActionsDisabled(false);
    }
  });

  // ── Manual upload flow ─────────────────────────────────────────
  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropzone.style.borderColor = 'var(--color-accent)';
    els.dropzone.style.background = 'rgba(59,139,242,.06)';
  });
  els.dropzone.addEventListener('dragleave', resetDropzoneStyle);
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    resetDropzoneStyle();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) chooseFile(e.dataTransfer.files[0]);
  });
  els.fileInput.addEventListener('change', () => {
    if (els.fileInput.files && els.fileInput.files[0]) chooseFile(els.fileInput.files[0]);
  });

  function resetDropzoneStyle() {
    els.dropzone.style.borderColor = 'var(--color-border,#23314a)';
    els.dropzone.style.background = 'transparent';
  }

  function chooseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
      notice('Unsupported file type. Use MP4, MOV, or WebM.', 'error');
      return;
    }
    selectedFile = file;
    els.fileLabel.textContent = `${file.name} (${formatBytes(file.size)})`;
    els.uploadBtn.disabled = false;
  }

  els.uploadBtn.addEventListener('click', async () => {
    if (jobActive) return;
    clearNotice();
    if (!selectedFile) return;
    if (!els.rights.checked) return notice('Please confirm the rights checkbox before processing.', 'error');

    setActionsDisabled(true);
    els.uploadBtn.textContent = 'Uploading\u2026';
    els.uploadProgress.innerHTML = progressBar(0, 'Requesting upload\u2026');
    try {
      const ticket = await api.getWatermarkUploadUrl(selectedFile.name, selectedFile.size);
      await putWithProgress(ticket.uploadUrl, selectedFile, ticket.headers, (pct) => {
        els.uploadProgress.innerHTML = progressBar(pct, `Uploading ${pct}%`);
      });
      els.uploadProgress.innerHTML = progressBar(100, 'Upload complete');

      els.uploadBtn.textContent = 'Creating job\u2026';
      const res = await api.createWatermarkJob({
        mode: 'manual',
        objectKey: ticket.objectKey,
        credit: els.credit.value.trim(),
        position: els.position.value,
        rightsConfirmed: true,
      });
      els.uploadBtn.textContent = 'Watermark uploaded video';
      startJob(res.jobId);
    } catch (err) {
      notice(err.message || 'Upload failed.', 'error');
      els.uploadProgress.innerHTML = '';
      els.uploadBtn.textContent = 'Watermark uploaded video';
      setActionsDisabled(false);
    }
  });

  // ── Job polling ────────────────────────────────────────────────
  function startJob(jobId) {
    stopPolling();
    jobActive = true;
    setActionsDisabled(true);
    els.statusCard.style.display = '';
    els.result.innerHTML = '';
    renderStatus('waiting', 0);
    poll(jobId);
    pollTimer = setInterval(() => poll(jobId), 3000);
  }

  function endJob() {
    stopPolling();
    jobActive = false;
    setActionsDisabled(false);
  }

  async function poll(jobId) {
    try {
      const s = await api.getWatermarkJobStatus(jobId);
      renderStatus(s.status, s.progress || 0);
      if (s.status === 'complete') {
        endJob();
        showResult(s);
      } else if (s.status === 'failed') {
        endJob();
        els.result.innerHTML = `<div class="admin-notice admin-notice-error">${esc(s.error || 'Processing failed.')}</div>`;
        if (s.errorCode === 'FB_FETCH_UNAVAILABLE') highlightManual();
      } else if (s.status === 'expired') {
        endJob();
        els.result.innerHTML = `<div class="admin-notice admin-notice-info">This job expired. Please run it again.</div>`;
      }
    } catch (err) {
      // Transient errors are tolerated; keep polling.
      console.warn('[watermarker] poll error', err.message);
    }
  }

  function showResult(s) {
    els.result.innerHTML = `
      <div class="admin-notice admin-notice-success">Your watermarked video is ready.</div>
      <video src="${esc(s.downloadUrl)}" controls playsinline style="width:100%;border-radius:10px;margin-top:var(--space-sm);background:#000"></video>
      <a class="admin-btn admin-btn-primary" href="${esc(s.downloadUrl)}" download style="margin-top:var(--space-sm);display:inline-block;text-decoration:none">Download MP4</a>
    `;
  }

  function renderStatus(status, progress) {
    const steps = ['waiting', 'fetching', 'processing', 'complete'];
    const isFailed = status === 'failed';
    const activeIdx = steps.indexOf(status);
    const chips = steps
      .map((step, i) => {
        const done = !isFailed && activeIdx >= 0 && i < activeIdx;
        const active = step === status;
        const color = isFailed
          ? 'var(--color-text-muted)'
          : active
            ? 'var(--color-accent)'
            : done
              ? 'var(--color-text-secondary)'
              : 'var(--color-text-muted)';
        const bg = active ? 'rgba(59,139,242,.14)' : 'transparent';
        return `<span style="font-family:var(--font-ui);font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.04em;padding:4px 10px;border-radius:20px;color:${color};background:${bg};border:1px solid var(--color-border,#23314a)">${step}</span>`;
      })
      .join('');

    const labels = {
      waiting: 'Queued\u2026',
      fetching: 'Fetching video\u2026',
      processing: 'Adding watermark\u2026',
      complete: 'Complete',
    };
    const label = isFailed ? 'Failed' : labels[status] || status;
    els.statusBody.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:var(--space-sm)">${chips}</div>
      ${isFailed ? '' : progressBar(progress, label)}
    `;
  }

  function highlightManual() {
    els.manualCard.style.boxShadow = '0 0 0 2px var(--color-accent)';
    els.manualCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { els.manualCard.style.boxShadow = ''; }, 2400);
  }

  function notice(msg, type) {
    els.notice.innerHTML = `<div class="admin-notice admin-notice-${type}">${esc(msg)}</div>`;
    if (type !== 'error') setTimeout(() => clearNotice(), 8000);
  }
  function clearNotice() { els.notice.innerHTML = ''; }
}

// ── Helpers ───────────────────────────────────────────────────────

function byId(id) { return document.getElementById(id); }

function composeCreditLine(raw) {
  const clean = String(raw || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
  if (!clean || clean.toLowerCase() === 'facebook') return 'VIDEO: Facebook/FB';
  return `VIDEO: @${clean}/FB`;
}

function progressBar(pct, label) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `
    <div style="font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-text-secondary);margin-bottom:4px">${esc(label)}</div>
    <div style="height:8px;border-radius:6px;background:var(--color-border,#23314a);overflow:hidden">
      <div style="height:100%;width:${p}%;background:var(--color-accent);transition:width .3s"></div>
    </div>`;
}

function putWithProgress(url, file, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (headers) {
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(file);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}
