#!/usr/bin/env node
'use strict';

/**
 * Retract/delete an uploaded X post and mark job as retracted locally.
 */

const { getJob, updateJob, appendAuditLog } = require('./clip-job-store');
const { isDryRun } = require('./lib/paths');

const TWEETS_URL = 'https://api.x.com/2/tweets';

function getUserToken() {
  const token = process.env.X_USER_ACCESS_TOKEN;
  if (!token) {
    throw new Error('X_USER_ACCESS_TOKEN is not set');
  }
  return token;
}

async function deleteXPost(xPostId, { dryRun = false } = {}) {
  if (dryRun || isDryRun()) {
    console.log(`[x-retract] DRY-RUN - would delete X post ${xPostId}`);
    return { dryRun: true, xPostId };
  }

  const token = getUserToken();
  const url = `${TWEETS_URL}/${xPostId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to delete X post ${xPostId}: ${res.status} ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : {};
}

async function retractJob(jobId, { dryRun = false } = {}) {
  const job = await getJob(jobId);

  if (!job.x_post_id) {
    throw new Error('Job has no x_post_id - nothing to retract on X');
  }

  const result = await deleteXPost(job.x_post_id, { dryRun });

  if (!dryRun) {
    await updateJob(jobId, { status: 'retracted' }, { skipTransitionCheck: true });
    await appendAuditLog('x_retracted', jobId, { x_post_id: job.x_post_id });
  }

  return { jobId, x_post_id: job.x_post_id, result };
}

async function main() {
  const dryRun = isDryRun();
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');

  if (args.length === 0) {
    console.error('Usage: node x-retract.js --job-id UUID [--dry-run]');
    console.error('   or: node x-retract.js --x-post-id POST_ID [--dry-run]');
    process.exit(1);
  }

  try {
    if (args[0] === '--job-id') {
      const result = await retractJob(args[1], { dryRun });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (args[0] === '--x-post-id') {
      const result = await deleteXPost(args[1], { dryRun });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error('Provide --job-id or --x-post-id');
  } catch (err) {
    console.error(`[x-retract] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { retractJob, deleteXPost };
