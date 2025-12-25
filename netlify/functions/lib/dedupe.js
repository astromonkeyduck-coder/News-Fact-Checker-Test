/**
 * Deduplication utilities for Verified Events Engine
 * Builds canonical_id for stable event deduplication
 */

const crypto = require('crypto');

/**
 * Generate canonical ID for an event
 * Format: engine:stable_identifier
 * @param {string} engine - Engine name (usgs, nws, faa, etc.)
 * @param {string} identifier - Stable identifier from source
 * @returns {string} Canonical ID
 */
function buildCanonicalId(engine, identifier) {
  if (!engine || !identifier) {
    throw new Error('Engine and identifier are required for canonical_id');
  }
  return `${engine}:${identifier}`;
}

/**
 * Generate canonical ID with hash fallback
 * Use this when source doesn't provide stable IDs
 * @param {string} engine - Engine name
 * @param {string} sourceUrl - Source URL
 * @param {string} publishedAt - Published timestamp
 * @returns {string} Canonical ID
 */
function buildCanonicalIdFromHash(engine, sourceUrl, publishedAt) {
  const hash = crypto.createHash('sha256');
  hash.update(`${engine}:${sourceUrl}:${publishedAt}`);
  const hashHex = hash.digest('hex').substring(0, 16);
  return `${engine}:${hashHex}`;
}

module.exports = {
  buildCanonicalId,
  buildCanonicalIdFromHash,
};

