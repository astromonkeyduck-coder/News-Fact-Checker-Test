#!/usr/bin/env node
'use strict';

const { createJob } = require('./clip-job-store');
const { fetchYouTubeMetadata } = require('./youtube-metadata');
const { assertSourceUrlAllowed } = require('./lib/source-guard');
const { warnIfMissingRights } = require('./lib/rights-guard');
const { isDryRun } = require('./lib/paths');

function parseArgs(argv) {
  const out = {
    dryRun: isDryRun(argv),
    fetchYoutube: false,
    fields: {},
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') continue;
    if (arg === '--fetch-youtube') {
      out.fetchYoutube = true;
      continue;
    }
    if (arg === '--title') out.fields.title = argv[++i];
    else if (arg === '--source-type') out.fields.source_type = argv[++i];
    else if (arg === '--source-url') out.fields.source_url = argv[++i];
    else if (arg === '--local-file') out.fields.local_file_path = argv[++i];
    else if (arg === '--youtube-video-id') out.fields.youtube_video_id = argv[++i];
    else if (arg === '--rights-basis') out.fields.rights_basis = argv[++i];
    else if (arg === '--source-attribution') out.fields.source_attribution = argv[++i];
    else if (arg === '--event-started-at') out.fields.event_started_at = argv[++i];
    else if (arg === '--draft-post-text') out.fields.draft_post_text = argv[++i];
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.fields.title) {
    console.error(`Usage: node create-job.js --title "Event title" \\
  --source-type direct_hls|rtmp|local_file|youtube_metadata_only \\
  [--source-url URL] [--local-file PATH] \\
  [--youtube-video-id ID] [--fetch-youtube] \\
  --rights-basis "Rights documentation" \\
  [--source-attribution "@Channel"] [--dry-run]`);
    process.exit(1);
  }

  const sourceType = args.fields.source_type || 'local_file';
  assertSourceUrlAllowed(sourceType, args.fields.source_url);
  warnIfMissingRights(args.fields);

  if (args.fetchYoutube && args.fields.youtube_video_id) {
    const meta = await fetchYouTubeMetadata(args.fields.youtube_video_id, { dryRun: args.dryRun });
    if (!meta.dryRun) {
      args.fields.youtube_metadata_json = meta;
      if (!args.fields.title && meta.title) {
        args.fields.title = meta.title;
      }
    }
  }

  if (args.dryRun) {
    console.log('[create-job] DRY-RUN — would create job:');
    console.log(JSON.stringify(args.fields, null, 2));
    process.exit(0);
  }

  const job = await createJob(args.fields);
  console.log('[create-job] Created clip job:');
  console.log(JSON.stringify(job, null, 2));
}

main().catch((err) => {
  console.error(`[create-job] ERROR: ${err.message}`);
  process.exit(1);
});
