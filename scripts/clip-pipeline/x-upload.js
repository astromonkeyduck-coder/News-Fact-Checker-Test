#!/usr/bin/env node
'use strict';

/**
 * X (Twitter) media upload and post — OPTIONAL.
 * Isolated from read-only import-x-posts cron (X_BEARER_TOKEN).
 * Requires human-approved job + rights_basis + X_USER_ACCESS_TOKEN.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { getJob, updateJob, appendAuditLog } = require('./clip-job-store');
const { assertRightsForUpload } = require('./lib/rights-guard');
const { isDryRun } = require('./lib/paths');

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEETS_URL = 'https://api.x.com/2/tweets';

function isXUploadConfigured() {
  return (
    process.env.X_UPLOAD_ENABLED === 'true' &&
    Boolean(process.env.X_USER_ACCESS_TOKEN)
  );
}

function getUserToken() {
  const token = process.env.X_USER_ACCESS_TOKEN;
  if (!token) {
    throw new Error('X_USER_ACCESS_TOKEN is not set');
  }
  return token;
}

function printManualInstructions(filePath, postText) {
  console.log('\n--- Manual X upload instructions ---');
  console.log('X upload is disabled or credentials missing.');
  console.log(`Clip file: ${filePath}`);
  if (postText) console.log(`Suggested post text (review/edit before posting):\n${postText}`);
  console.log('Upload the MP4 manually via X composer or Media Studio.');
  console.log('-------------------------------------\n');
}

async function xFetch(url, { method = 'GET', headers = {}, body = null } = {}) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`X API ${method} ${url} → ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

async function waitForMediaProcessing(mediaId, token) {
  for (let i = 0; i < 30; i += 1) {
    const status = await xFetch(
      `${UPLOAD_URL}?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const state = status.processing_info?.state;
    if (state === 'succeeded' || !status.processing_info) {
      return status;
    }
    if (state === 'failed') {
      throw new Error(`X media processing failed: ${JSON.stringify(status.processing_info?.error || status)}`);
    }

    const waitSec = status.processing_info?.check_after_secs || 2;
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  throw new Error('X media processing timed out');
}

async function uploadMediaFile(filePath, token) {
  const stat = await fsp.stat(filePath);
  const totalBytes = stat.size;
  const mediaType = 'video/mp4';

  const init = await xFetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: String(totalBytes),
      media_type: mediaType,
      media_category: 'tweet_video',
    }),
  });

  const mediaId = init.media_id_string;
  let segmentIndex = 0;

  const fd = await fsp.open(filePath, 'r');
  try {
    let offset = 0;
    while (offset < totalBytes) {
      const toRead = Math.min(CHUNK_SIZE, totalBytes - offset);
      const buffer = Buffer.alloc(toRead);
      await fd.read(buffer, 0, toRead, offset);

      const form = new FormData();
      form.append('command', 'APPEND');
      form.append('media_id', mediaId);
      form.append('segment_index', String(segmentIndex));
      form.append('media', new Blob([buffer]), path.basename(filePath));

      await xFetch(UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      offset += toRead;
      segmentIndex += 1;
    }
  } finally {
    await fd.close();
  }

  await xFetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  });

  await waitForMediaProcessing(mediaId, token);
  return mediaId;
}

async function createTweet(text, mediaId, token) {
  return xFetch(TWEETS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.slice(0, 280),
      media: { media_ids: [mediaId] },
    }),
  });
}

async function uploadClipToX(jobOrPath, postText, { dryRun = false } = {}) {
  const dry = dryRun || isDryRun();

  let job;
  let filePath;
  let text;

  if (typeof jobOrPath === 'string' && fs.existsSync(jobOrPath)) {
    filePath = jobOrPath;
    text = postText || '';
  } else {
    job = jobOrPath;
    assertRightsForUpload(job);
    if (job.status !== 'approved' && job.status !== 'uploaded') {
      throw new Error(`Job must be approved before upload (current: ${job.status})`);
    }
    filePath = job.output_path;
    text = postText || job.draft_post_text || '';
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Clip file not found: ${filePath}`);
  }

  if (!text.trim()) {
    throw new Error('Post text is required. Provide draft text — do not auto-generate sensational claims.');
  }

  if (!isXUploadConfigured()) {
    printManualInstructions(filePath, text);
    return { manual: true, filePath };
  }

  if (dry) {
    console.log('[x-upload] DRY-RUN — would upload:', filePath);
    console.log('[x-upload] Post text:', text);
    return { dryRun: true, filePath, postText: text };
  }

  const token = getUserToken();
  console.log('[x-upload] Uploading media…');
  const mediaId = await uploadMediaFile(filePath, token);

  console.log('[x-upload] Creating post…');
  const tweet = await createTweet(text, mediaId, token);
  const xPostId = tweet.data?.id;

  if (job?.id) {
    await updateJob(job.id, { status: 'uploaded', x_post_id: xPostId });
    await appendAuditLog('x_uploaded', job.id, { x_post_id: xPostId, post_text: text });
  }

  return { xPostId, mediaId, tweet };
}

async function main() {
  const dryRun = isDryRun();
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const [first, second] = args;

  if (!first) {
    console.error('Usage: node x-upload.js CLIP.mp4 "Post text" [--dry-run]');
    console.error('   or: node x-upload.js --job-id UUID [--post-text "..."] [--dry-run]');
    process.exit(1);
  }

  try {
    if (first === '--job-id') {
      const jobId = second;
      let postText = '';
      for (let i = 2; i < args.length; i += 1) {
        if (args[i] === '--post-text') postText = args[++i];
      }
      const job = await getJob(jobId);
      const result = await uploadClipToX(job, postText, { dryRun });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const filePath = first;
    const postText = second || '';
    const result = await uploadClipToX(filePath, postText, { dryRun });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      console.error('[x-upload] Auth error — check X_USER_ACCESS_TOKEN scopes (tweet.write, media.write).');
    } else if (err.status === 429) {
      console.error('[x-upload] Rate limited — retry later.');
    }
    console.error(`[x-upload] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadClipToX, isXUploadConfigured, printManualInstructions };
