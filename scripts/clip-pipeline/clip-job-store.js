'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { CLIP_JOBS_DIR, AUDIT_LOG_PATH } = require('./lib/paths');

const STATUSES = [
  'created',
  'recording',
  'ready_to_clip',
  'clipping',
  'transcoding',
  'review_ready',
  'approved',
  'uploaded',
  'failed',
  'rejected',
  'retracted',
];

const VALID_TRANSITIONS = {
  created: ['recording', 'ready_to_clip', 'clipping', 'failed'],
  recording: ['ready_to_clip', 'failed'],
  ready_to_clip: ['clipping', 'failed'],
  clipping: ['transcoding', 'review_ready', 'failed'],
  transcoding: ['review_ready', 'failed'],
  review_ready: ['approved', 'rejected', 'failed'],
  approved: ['uploaded', 'failed', 'rejected'],
  uploaded: ['retracted'],
  failed: ['created', 'ready_to_clip'],
  rejected: ['ready_to_clip', 'clipping'],
  retracted: [],
};

function ensureDir() {
  fs.mkdirSync(CLIP_JOBS_DIR, { recursive: true });
}

function jobPath(id) {
  return path.join(CLIP_JOBS_DIR, `${id}.json`);
}

function createEmptyJob(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || '',
    source_type: overrides.source_type || 'local_file',
    source_url: overrides.source_url || null,
    local_file_path: overrides.local_file_path || null,
    youtube_video_id: overrides.youtube_video_id || null,
    youtube_metadata_json: overrides.youtube_metadata_json || null,
    rights_basis: overrides.rights_basis || '',
    source_attribution: overrides.source_attribution || '',
    event_started_at: overrides.event_started_at || null,
    requested_clip_start: overrides.requested_clip_start || null,
    requested_clip_end: overrides.requested_clip_end || null,
    output_path: overrides.output_path || null,
    thumbnail_path: overrides.thumbnail_path || null,
    ffprobe_path: overrides.ffprobe_path || null,
    status: overrides.status || 'created',
    x_post_id: overrides.x_post_id || null,
    draft_post_text: overrides.draft_post_text || '',
    error_message: overrides.error_message || null,
    created_at: overrides.created_at || now,
    updated_at: overrides.updated_at || now,
  };
}

async function writeJobAtomic(job) {
  ensureDir();
  const target = jobPath(job.id);
  const temp = `${target}.${process.pid}.tmp`;
  job.updated_at = new Date().toISOString();
  await fsp.writeFile(temp, JSON.stringify(job, null, 2), 'utf8');
  await fsp.rename(temp, target);
  return job;
}

async function createJob(fields) {
  const job = createEmptyJob(fields);
  await writeJobAtomic(job);
  await appendAuditLog('job_created', job.id, { title: job.title, source_type: job.source_type });
  return job;
}

async function getJob(id) {
  const file = jobPath(id);
  if (!fs.existsSync(file)) {
    throw new Error(`Clip job not found: ${id}`);
  }
  const raw = await fsp.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function updateJob(id, patch, { skipTransitionCheck = false } = {}) {
  const job = await getJob(id);
  const nextStatus = patch.status ?? job.status;

  if (!skipTransitionCheck && patch.status && patch.status !== job.status) {
    const allowed = VALID_TRANSITIONS[job.status] || [];
    if (!allowed.includes(patch.status)) {
      throw new Error(`Invalid status transition: ${job.status} → ${patch.status}`);
    }
  }

  if (!STATUSES.includes(nextStatus)) {
    throw new Error(`Invalid status: ${nextStatus}`);
  }

  const updated = { ...job, ...patch, id: job.id, updated_at: new Date().toISOString() };
  await writeJobAtomic(updated);
  return updated;
}

async function listJobs(filter = {}) {
  ensureDir();
  const files = (await fsp.readdir(CLIP_JOBS_DIR)).filter((f) => f.endsWith('.json'));
  const jobs = [];

  for (const file of files) {
    try {
      const raw = await fsp.readFile(path.join(CLIP_JOBS_DIR, file), 'utf8');
      const job = JSON.parse(raw);
      if (filter.status && job.status !== filter.status) continue;
      jobs.push(job);
    } catch {
      // skip corrupt files
    }
  }

  jobs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return jobs;
}

async function appendAuditLog(event, jobId, details = {}) {
  ensureDir();
  const entry = {
    ts: new Date().toISOString(),
    event,
    job_id: jobId,
    ...details,
  };
  await fsp.appendFile(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

module.exports = {
  STATUSES,
  VALID_TRANSITIONS,
  createEmptyJob,
  createJob,
  getJob,
  updateJob,
  listJobs,
  appendAuditLog,
};
