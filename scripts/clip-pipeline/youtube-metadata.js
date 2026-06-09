#!/usr/bin/env node
'use strict';

/**
 * YouTube Data API metadata resolver — METADATA ONLY.
 * Do NOT use this module to download or rip YouTube video media.
 */

const { isDryRun } = require('./lib/paths');

const API_BASE = 'https://www.googleapis.com/youtube/v3/videos';

function getApiKey() {
  const key = process.env.YT_API_KEY;
  if (!key) {
    throw new Error('YT_API_KEY is not set. Required for YouTube metadata lookup only.');
  }
  return key;
}

function normalizeMetadata(item) {
  const snippet = item.snippet || {};
  const live = item.liveStreamingDetails || {};
  const content = item.contentDetails || {};

  return {
    videoId: item.id,
    title: snippet.title || null,
    channelTitle: snippet.channelTitle || null,
    description: snippet.description || null,
    publishedAt: snippet.publishedAt || null,
    thumbnails: snippet.thumbnails || {},
    liveBroadcastContent: snippet.liveBroadcastContent || null,
    scheduledStartTime: live.scheduledStartTime || null,
    actualStartTime: live.actualStartTime || null,
    actualEndTime: live.actualEndTime || null,
    concurrentViewers: live.concurrentViewers ? parseInt(live.concurrentViewers, 10) : null,
    duration: content.duration || null,
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
    raw: item,
  };
}

async function fetchYouTubeMetadata(videoId, { dryRun = false } = {}) {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('YouTube video ID is required');
  }

  const cleanId = videoId.trim();

  if (dryRun || isDryRun()) {
    console.log('[youtube-metadata] DRY-RUN — would request videos.list for id:', cleanId);
    console.log('[youtube-metadata] METADATA ONLY — no video media download.');
    if (!process.env.YT_API_KEY) {
      console.warn('[youtube-metadata] YT_API_KEY is not set (required for live lookup).');
    }
    return { dryRun: true, videoId: cleanId };
  }

  const apiKey = getApiKey();

  const url = new URL(API_BASE);
  url.searchParams.set('part', 'snippet,contentDetails,liveStreamingDetails');
  url.searchParams.set('id', cleanId);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`No YouTube video found for ID: ${cleanId}`);
  }

  return normalizeMetadata(data.items[0]);
}

async function main() {
  const dryRun = isDryRun();
  const videoId = process.argv[2];

  if (!videoId || videoId.startsWith('--')) {
    console.error('Usage: node youtube-metadata.js VIDEO_ID [--dry-run]');
    console.error('METADATA ONLY — does not download video media.');
    process.exit(1);
  }

  try {
    const meta = await fetchYouTubeMetadata(videoId, { dryRun });
    console.log(JSON.stringify(meta, null, 2));
  } catch (err) {
    console.error(`[youtube-metadata] ERROR: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchYouTubeMetadata, normalizeMetadata };
