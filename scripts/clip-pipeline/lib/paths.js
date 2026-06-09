'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../..');

const DATA_ROOT = path.join(REPO_ROOT, 'data');
const CLIP_JOBS_DIR = path.join(DATA_ROOT, 'clip-jobs');
const CLIPS_RAW_DIR = path.join(DATA_ROOT, 'clips', 'raw');
const CLIPS_OUTPUT_DIR = path.join(DATA_ROOT, 'clips', 'output');
const CLIPS_THUMBS_DIR = path.join(DATA_ROOT, 'clips', 'thumbs');
const CLIPS_PROBE_DIR = path.join(DATA_ROOT, 'clips', 'probe');
const CLIPS_BUFFER_DIR = path.join(DATA_ROOT, 'clips', 'buffer');
const BUFFER_STATE_PATH = path.join(CLIPS_BUFFER_DIR, 'active.json');
const AUDIT_LOG_PATH = path.join(CLIP_JOBS_DIR, 'audit.jsonl');

function isDryRun(argv = process.argv) {
  return process.env.CLIP_DRY_RUN === 'true' || argv.includes('--dry-run');
}

module.exports = {
  REPO_ROOT,
  DATA_ROOT,
  CLIP_JOBS_DIR,
  CLIPS_RAW_DIR,
  CLIPS_OUTPUT_DIR,
  CLIPS_THUMBS_DIR,
  CLIPS_PROBE_DIR,
  CLIPS_BUFFER_DIR,
  BUFFER_STATE_PATH,
  AUDIT_LOG_PATH,
  isDryRun,
};
