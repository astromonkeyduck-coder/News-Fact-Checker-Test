#!/usr/bin/env node
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { listJobs, getJob, updateJob, appendAuditLog } = require('./clip-job-store');
const { summarizeProbe } = require('./ffmpeg-utils');

function formatBytes(bytes) {
  if (bytes == null) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function cmdList() {
  const jobs = await listJobs({ status: 'review_ready' });
  if (jobs.length === 0) {
    console.log('No jobs in review_ready status.');
    return;
  }
  for (const job of jobs) {
    console.log(`${job.id}  ${job.title}  (${job.status})`);
  }
}

async function loadProbeSummary(job) {
  if (!job.ffprobe_path || !fs.existsSync(job.ffprobe_path)) {
    return null;
  }
  const raw = JSON.parse(await fsp.readFile(job.ffprobe_path, 'utf8'));
  return summarizeProbe(raw);
}

async function cmdShow(jobId) {
  const job = await getJob(jobId);
  const summary = await loadProbeSummary(job);
  let sizeBytes = summary?.sizeBytes;

  if (job.output_path && fs.existsSync(job.output_path)) {
    const stat = await fsp.stat(job.output_path);
    sizeBytes = stat.size;
  }

  console.log('--- Clip Job Review ---');
  console.log(`ID:          ${job.id}`);
  console.log(`Title:       ${job.title}`);
  console.log(`Status:      ${job.status}`);
  console.log(`Attribution: ${job.source_attribution || '(none)'}`);
  console.log(`Rights:      ${job.rights_basis || '(MISSING - upload blocked)'}`);
  console.log(`Clip:        ${job.requested_clip_start} → ${job.requested_clip_end}`);
  console.log(`Output:      ${job.output_path || '(none)'}`);
  console.log(`Thumbnail:   ${job.thumbnail_path || '(none)'}`);
  console.log(`Size:        ${formatBytes(sizeBytes)}`);
  if (summary) {
    console.log(`Duration:    ${summary.duration?.toFixed(2)}s`);
    console.log(`Codecs:      ${summary.videoCodec}/${summary.audioCodec}`);
    console.log(`Resolution:  ${summary.width}x${summary.height}`);
  }
  console.log(`Draft post:  ${job.draft_post_text || '(none)'}`);
}

async function cmdApprove(jobId, postText) {
  const job = await getJob(jobId);
  if (job.status !== 'review_ready') {
    throw new Error(`Job must be review_ready to approve (current: ${job.status})`);
  }
  const updated = await updateJob(jobId, {
    status: 'approved',
    draft_post_text: postText || job.draft_post_text || '',
    error_message: null,
  });
  await appendAuditLog('job_approved', jobId, { draft_post_text: updated.draft_post_text });
  console.log(`[review-job] Approved ${jobId}`);
}

async function cmdReject(jobId, reason) {
  const job = await getJob(jobId);
  if (!['review_ready', 'approved'].includes(job.status)) {
    throw new Error(`Cannot reject job in status: ${job.status}`);
  }
  await updateJob(jobId, {
    status: 'rejected',
    error_message: reason || 'Rejected by reviewer',
  });
  await appendAuditLog('job_rejected', jobId, { reason: reason || 'Rejected by reviewer' });
  console.log(`[review-job] Rejected ${jobId}`);
}

async function cmdExport(jobId, destDir) {
  const job = await getJob(jobId);
  if (!job.output_path || !fs.existsSync(job.output_path)) {
    throw new Error('No output file to export');
  }

  if (!destDir) {
    console.log(`Output:    ${job.output_path}`);
    if (job.thumbnail_path) console.log(`Thumbnail: ${job.thumbnail_path}`);
    return;
  }

  await fsp.mkdir(destDir, { recursive: true });
  const base = path.basename(job.output_path);
  const dest = path.join(destDir, base);
  await fsp.copyFile(job.output_path, dest);

  if (job.thumbnail_path && fs.existsSync(job.thumbnail_path)) {
    const thumbDest = path.join(destDir, path.basename(job.thumbnail_path));
    await fsp.copyFile(job.thumbnail_path, thumbDest);
    console.log(`[review-job] Copied thumbnail → ${thumbDest}`);
  }

  console.log(`[review-job] Exported → ${dest}`);
}

async function main() {
  const [command, jobId, ...rest] = process.argv.slice(2);

  if (!command) {
    console.error('Usage: node review-job.js list|show|approve|reject|export [jobId] [options]');
    process.exit(1);
  }

  try {
    if (command === 'list') {
      await cmdList();
      return;
    }

    if (command === 'show') {
      if (!jobId) throw new Error('jobId required');
      await cmdShow(jobId);
      return;
    }

    if (command === 'approve') {
      if (!jobId) throw new Error('jobId required');
      let postText = '';
      for (let i = 0; i < rest.length; i += 1) {
        if (rest[i] === '--post-text') postText = rest[++i];
      }
      await cmdApprove(jobId, postText);
      return;
    }

    if (command === 'reject') {
      if (!jobId) throw new Error('jobId required');
      let reason = '';
      for (let i = 0; i < rest.length; i += 1) {
        if (rest[i] === '--reason') reason = rest[++i];
      }
      await cmdReject(jobId, reason);
      return;
    }

    if (command === 'export') {
      if (!jobId) throw new Error('jobId required');
      const destDir = rest[0] && !rest[0].startsWith('--') ? rest[0] : null;
      await cmdExport(jobId, destDir);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (err) {
    console.error(`[review-job] ERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
