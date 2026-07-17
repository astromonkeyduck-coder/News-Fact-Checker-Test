/**
 * Fast discovery pass: poll RSS feeds, the recall index table, and the CORE
 * investigation table; insert unseen/changed source-document candidates.
 *
 * Kept cheap on purpose: no canonical fetching, no parsing beyond feed/table
 * rows, no images. The background processor does the heavy work.
 */

const { FEEDS, RECALL_TABLE_URL, CORE_TABLE_URL, config } = require('./config');
const { fetchFeed } = require('./providers/fda/rss');
const { fetchRecallTable } = require('./providers/fda/recallTable');
const { fetchCoreTable } = require('./providers/fda/coreTable');
const { scopeFilter } = require('./classify');
const {
  upsertSourceDocument, getFeedState, saveFeedState,
} = require('./store');

/**
 * Poll all configured RSS feeds. Returns counts.
 */
async function discoverFromFeeds({ logger = console } = {}) {
  const counts = { seen: 0, new: 0, changed: 0, skippedScope: 0, feedErrors: 0 };

  for (const feed of FEEDS) {
    try {
      const state = await getFeedState(feed.kind, feed.url);
      const result = await fetchFeed(feed, {
        etag: state ? state.etag : null,
        lastModified: state ? state.last_modified : null,
      });
      if (result.notModified) {
        logger.info && logger.info(`[food-safety discover] ${feed.kind} not modified`);
        continue;
      }
      await saveFeedState(feed.kind, feed.url, {
        etag: result.etag,
        lastModified: result.lastModified,
        bodyHash: result.bodyHash,
        httpStatus: result.httpStatus,
      });

      for (const item of result.items) {
        counts.seen += 1;

        // Filtered safety-net feeds: strict scope filter at discovery time
        if (feed.filtered) {
          const scope = scopeFilter({ title: item.title, description: item.description });
          if (!scope.include) {
            counts.skippedScope += 1;
            continue;
          }
        }

        const { isNew, changed } = await upsertSourceDocument({
          provider: 'fda',
          source_kind: feed.kind,
          external_id: item.externalId,
          canonical_url: item.canonicalUrl,
          feed_guid: item.feedGuid,
          published_at: item.publishedAt,
          body_hash: item.contentHash,
          parsed_payload: {
            title: item.title,
            description: item.description,
            filtered: item.filtered,
            feedUrl: item.feedUrl,
          },
        });
        if (isNew) counts.new += 1;
        else if (changed) counts.changed += 1;
      }
    } catch (e) {
      counts.feedErrors += 1;
      logger.error && logger.error(`[food-safety discover] feed ${feed.kind} failed: ${e.message}`);
    }
  }
  return counts;
}

/**
 * Reconcile against the official recall index table (cadence-gated).
 */
async function discoverFromRecallTable({ logger = console, force = false } = {}) {
  const counts = { rows: 0, new: 0, changed: 0, skipped: 0 };
  const state = await getFeedState('fda_recall_table', RECALL_TABLE_URL);
  if (!force && state && state.fetched_at) {
    const ageMin = (Date.now() - new Date(state.fetched_at).getTime()) / 60000;
    if (ageMin < config.recallTableIntervalMin) {
      counts.skipped = 1;
      return counts;
    }
  }

  const result = await fetchRecallTable({
    etag: state ? state.etag : null,
    lastModified: state ? state.last_modified : null,
  });
  await saveFeedState('fda_recall_table', RECALL_TABLE_URL, {
    etag: result.etag, lastModified: result.lastModified, bodyHash: result.bodyHash, httpStatus: 200,
  });
  if (result.notModified) return counts;

  for (const row of result.rows) {
    counts.rows += 1;
    const scope = scopeFilter({
      title: `${row.brand || ''} ${row.productDescription || ''}`,
      description: `${row.recallReason || ''} ${row.excerpt || ''}`,
      productType: row.productType || '',
    });
    if (!scope.include) continue;

    const { isNew, changed } = await upsertSourceDocument({
      provider: 'fda',
      source_kind: 'fda_recall_table',
      external_id: row.canonicalUrl,
      canonical_url: row.canonicalUrl,
      published_at: row.date ? `${row.date}T00:00:00.000Z` : null,
      body_hash: hashRow(row),
      parsed_payload: {
        title: `${row.brand || ''}: ${row.productDescription || ''}`.trim(),
        description: row.recallReason || row.excerpt || '',
        productType: row.productType || '',
        company: row.company,
        terminated: row.terminated,
        tableRow: row,
      },
    });
    if (isNew) counts.new += 1;
    else if (changed) counts.changed += 1;
  }
  return counts;
}

/**
 * Snapshot/diff the CORE investigation table (cadence-gated).
 */
async function discoverFromCoreTable({ logger = console, force = false } = {}) {
  const counts = { rows: 0, new: 0, changed: 0, skipped: 0 };
  const state = await getFeedState('fda_core', CORE_TABLE_URL);
  if (!force && state && state.fetched_at) {
    const ageMin = (Date.now() - new Date(state.fetched_at).getTime()) / 60000;
    if (ageMin < config.coreTableIntervalMin) {
      counts.skipped = 1;
      return counts;
    }
  }

  const result = await fetchCoreTable({
    etag: state ? state.etag : null,
    lastModified: state ? state.last_modified : null,
  });
  await saveFeedState('fda_core', CORE_TABLE_URL, {
    etag: result.etag, lastModified: result.lastModified, bodyHash: result.bodyHash, httpStatus: 200,
  });
  if (result.notModified) return counts;

  if (result.rows.length === 0) {
    // parser drift alarm handled by caller via thrown error in fetchCoreTable
    logger.warn && logger.warn('[food-safety discover] CORE table returned zero rows');
    return counts;
  }

  for (const row of result.rows) {
    counts.rows += 1;
    const { isNew, changed } = await upsertSourceDocument({
      provider: 'fda',
      source_kind: 'fda_core',
      external_id: `core-${row.referenceNumber}`,
      canonical_url: row.advisoryUrl || null,
      official_reference_number: row.referenceNumber,
      published_at: row.datePosted ? `${row.datePosted}T00:00:00.000Z` : null,
      body_hash: row.rowHash,
      parsed_payload: row,
    });
    if (isNew) counts.new += 1;
    else if (changed) counts.changed += 1;
  }
  return counts;
}

function hashRow(row) {
  const { sha256 } = require('./normalize'); // eslint-disable-line global-require
  return sha256(JSON.stringify({
    d: row.date, b: row.brand, p: row.productDescription, r: row.recallReason, t: row.terminated,
  }));
}

async function runDiscovery({ logger = console } = {}) {
  const feedCounts = await discoverFromFeeds({ logger });
  let tableCounts = { rows: 0, new: 0, changed: 0, skipped: 0 };
  let coreCounts = { rows: 0, new: 0, changed: 0, skipped: 0 };
  try {
    tableCounts = await discoverFromRecallTable({ logger });
  } catch (e) {
    logger.error && logger.error(`[food-safety discover] recall table failed: ${e.message}`);
    tableCounts.error = e.message;
  }
  try {
    coreCounts = await discoverFromCoreTable({ logger });
  } catch (e) {
    logger.error && logger.error(`[food-safety discover] CORE table failed: ${e.message}`);
    coreCounts.error = e.message;
  }
  return { feeds: feedCounts, recallTable: tableCounts, coreTable: coreCounts };
}

module.exports = {
  runDiscovery,
  discoverFromFeeds,
  discoverFromRecallTable,
  discoverFromCoreTable,
};
