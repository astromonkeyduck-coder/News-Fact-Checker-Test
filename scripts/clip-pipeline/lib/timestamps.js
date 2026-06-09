'use strict';

/**
 * Parse timestamp strings to seconds.
 * Supports: seconds (number string), MM:SS, HH:MM:SS, HH:MM:SS.ms
 */

function parseTimestamp(value) {
  if (value == null || value === '') {
    throw new Error('Timestamp is required');
  }

  const trimmed = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = parseFloat(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error(`Invalid timestamp: ${value}`);
    }
    return seconds;
  }

  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid timestamp format: ${value}. Use HH:MM:SS, MM:SS, or seconds.`);
  }

  let hours = 0;
  let minutes;
  let secondsPart;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    secondsPart = parts[2];
  } else {
    minutes = parseInt(parts[0], 10);
    secondsPart = parts[1];
  }

  const seconds = parseFloat(secondsPart);

  if ([hours, minutes].some((n) => !Number.isFinite(n) || n < 0) || !Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`Cannot format invalid seconds: ${seconds}`);
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

function validateClipRange(startInput, endInput, maxDurationSeconds = 120) {
  const start = parseTimestamp(startInput);
  const end = parseTimestamp(endInput);

  if (start >= end) {
    throw new Error(`Clip start (${startInput}) must be before end (${endInput})`);
  }

  const duration = end - start;
  if (maxDurationSeconds != null && duration > maxDurationSeconds) {
    throw new Error(
      `Clip duration ${duration.toFixed(1)}s exceeds max ${maxDurationSeconds}s. Use --max-duration to override.`
    );
  }

  return { start, end, duration };
}

module.exports = {
  parseTimestamp,
  formatTimestamp,
  validateClipRange,
};
