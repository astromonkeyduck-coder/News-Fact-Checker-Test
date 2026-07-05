/**
 * Post Store - canonical storage interface for x-posts Netlify Blobs
 *
 * Every read/write to the x-posts blob store should go through this module.
 * This ensures:
 *   - Consistent key format (post-{id}.json)
 *   - Consistent index shape ({ ids: string[] }) - urls field is retired
 *   - Single place to understand blob operations
 *   - Deduplication on index writes
 *   - Bounded index size (MAX_INDEX_SIZE)
 */

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "x-posts";
const INDEX_KEY = "index.json";
const MAX_INDEX_SIZE = 200;

/**
 * Get a configured x-posts store instance.
 * Prefers explicit credentials; falls back to auto-detection.
 */
function getPostStore(opts = {}) {
  const siteID =
    opts.siteID ||
    process.env.NETLIFY_SITE_ID;
  const token =
    opts.token ||
    process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;

  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore({ name: STORE_NAME });
}

/**
 * Build the blob key for a post.
 * Normalises away any leading "post-" the caller might have included.
 */
function postKey(id) {
  const clean = id.startsWith("post-") ? id.slice(5) : id;
  const withExt = clean.endsWith(".json") ? clean : `${clean}.json`;
  return `post-${withExt}`;
}

function postIdFromKey(key) {
  return key.replace(/^post-/, "").replace(/\.json$/, "");
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

async function readIndex(store) {
  try {
    const blob = await store.get(INDEX_KEY, { type: "json" });
    if (blob && Array.isArray(blob.ids)) {
      return blob.ids;
    }
  } catch (_) {
    // index doesn't exist yet
  }
  return [];
}

async function readPost(store, id) {
  try {
    return await store.get(postKey(id), { type: "json" });
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

async function writePost(store, id, data) {
  const key = postKey(id);
  const payload =
    typeof data === "string" ? data : JSON.stringify(data);
  await store.set(key, payload, { contentType: "application/json" });
}

/**
 * Add one or more ids to the front of the index.
 * Deduplicates and caps at MAX_INDEX_SIZE.
 * Returns the new ids array.
 */
async function addToIndex(store, newIds) {
  const idsToAdd = Array.isArray(newIds) ? newIds : [newIds];
  const current = await readIndex(store);
  const seen = new Set();
  const merged = [];

  for (const id of [...idsToAdd, ...current]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }

  const capped = merged.slice(0, MAX_INDEX_SIZE);
  await writeIndex(store, capped);
  return capped;
}

/**
 * Remove one or more ids from the index.
 * Returns the new ids array.
 */
async function removeFromIndex(store, idsToRemove) {
  const removeSet = new Set(
    Array.isArray(idsToRemove) ? idsToRemove : [idsToRemove]
  );
  const current = await readIndex(store);
  const filtered = current.filter((id) => !removeSet.has(id));
  await writeIndex(store, filtered);
  return filtered;
}

/**
 * Overwrite the index entirely. Used by rebuild-index and pruning functions.
 */
async function writeIndex(store, ids) {
  await store.set(INDEX_KEY, JSON.stringify({ ids }), {
    contentType: "application/json",
  });
}

/**
 * Delete a post blob and remove it from the index.
 */
async function deletePost(store, id) {
  const key = postKey(id);
  try {
    await store.delete(key);
  } catch (_) {
    // blob may already be gone
  }
  await removeFromIndex(store, id);
}

module.exports = {
  STORE_NAME,
  INDEX_KEY,
  MAX_INDEX_SIZE,
  getPostStore,
  postKey,
  postIdFromKey,
  readIndex,
  readPost,
  writePost,
  addToIndex,
  removeFromIndex,
  writeIndex,
  deletePost,
};
