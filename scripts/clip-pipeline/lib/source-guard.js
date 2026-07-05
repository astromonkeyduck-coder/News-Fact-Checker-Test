'use strict';

/**
 * Source URL guardrails.
 * YouTube watch URLs must NOT be used as media sources - metadata only via youtube_video_id.
 */

const YOUTUBE_HOST_PATTERN = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

const SOURCE_TYPES = ['direct_hls', 'rtmp', 'local_file', 'youtube_metadata_only'];

function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return YOUTUBE_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return YOUTUBE_HOST_PATTERN.test(url);
  }
}

function assertValidSourceType(sourceType) {
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(`Invalid source_type "${sourceType}". Must be one of: ${SOURCE_TYPES.join(', ')}`);
  }
}

function assertSourceUrlAllowed(sourceType, sourceUrl) {
  assertValidSourceType(sourceType);

  if (sourceType === 'youtube_metadata_only') {
    if (sourceUrl && isYouTubeUrl(sourceUrl)) {
      throw new Error(
        'Do not use YouTube URLs as source_url. Use youtube_video_id for metadata only. ' +
          'Provide a rights-cleared direct media source separately.'
      );
    }
    return;
  }

  if (sourceType === 'local_file') {
    return;
  }

  if (!sourceUrl || !String(sourceUrl).trim()) {
    throw new Error(`source_url is required for source_type "${sourceType}"`);
  }

  if (isYouTubeUrl(sourceUrl)) {
    throw new Error(
      'YouTube URLs are not allowed as clip media sources. ' +
        'Use a rights-cleared HLS/RTMP feed or local file. YouTube API is metadata-only.'
    );
  }

  const lower = sourceUrl.toLowerCase();
  if (sourceType === 'rtmp' && !lower.startsWith('rtmp://') && !lower.startsWith('rtmps://')) {
    throw new Error('RTMP source_url must start with rtmp:// or rtmps://');
  }

  if (sourceType === 'direct_hls') {
    const looksLikeStream =
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('udp://') ||
      lower.startsWith('srt://');
    if (!looksLikeStream) {
      throw new Error('direct_hls source_url must be an HTTP(S) or supported stream URL');
    }
  }
}

module.exports = {
  SOURCE_TYPES,
  isYouTubeUrl,
  assertValidSourceType,
  assertSourceUrlAllowed,
};
