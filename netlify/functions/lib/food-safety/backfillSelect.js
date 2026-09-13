/**
 * Shared selection logic for historical openFDA backfill scripts and tests.
 */

'use strict';

const { scopeFilter } = require('./classify');
const { consumerFacingFilter } = require('./consumerFacingFilter');

function parseClassFilter(raw) {
  if (!raw) return null;
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim().toUpperCase().replace(/^CLASS\s*/i, ''))
    .filter((c) => /^I{1,3}|IV|V$/.test(c));
  return parts.length ? new Set(parts) : null;
}

function classToken(classification) {
  const m = String(classification || '').match(/\bclass\s*(I{1,3}|IV|V)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function matchesClassFilter(record, classFilter) {
  if (!classFilter || !classFilter.size) return true;
  const cls = classToken(record.classification);
  if (!cls) return false;
  return classFilter.has(cls);
}

/**
 * Evaluate one normalized openFDA record for historical backfill.
 *
 * @returns {{
 *   enqueue: boolean,
 *   line: string,
 *   scope: object,
 *   consumer: object|null,
 *   skipReason: string|null,
 *   statBucket: 'enqueued'|'excluded_scope'|'excluded_industrial'|'excluded_supplement'|'excluded_class'|null
 * }}
 */
function evaluateBackfillRecord(record, opts = {}) {
  const consumerOnly = opts.consumerOnly !== false;
  const classFilter = opts.classFilter || null;

  const scope = scopeFilter({
    title: record.productDescription || '',
    description: record.reasonForRecall || '',
    productType: 'Food',
  });

  if (!scope.include) {
    return {
      enqueue: false,
      line: formatLine(record),
      scope,
      consumer: null,
      skipReason: scope.reason,
      statBucket: 'excluded_scope',
    };
  }

  if (!matchesClassFilter(record, classFilter)) {
    return {
      enqueue: false,
      line: formatLine(record),
      scope,
      consumer: null,
      skipReason: `excluded_class:${record.classification || 'unknown'}`,
      statBucket: 'excluded_class',
    };
  }

  let consumer = null;
  if (consumerOnly) {
    consumer = consumerFacingFilter(record);
    if (!consumer.include) {
      const bucket = consumer.category === 'supplement'
        ? 'excluded_supplement'
        : 'excluded_industrial';
      return {
        enqueue: false,
        line: formatLine(record),
        scope,
        consumer,
        skipReason: consumer.reason,
        statBucket: bucket,
      };
    }
  }

  return {
    enqueue: true,
    line: formatLine(record),
    scope,
    consumer,
    skipReason: null,
    statBucket: 'enqueued',
  };
}

function formatLine(record) {
  return `${record.recallNumber || '(no recall #)'} · ${record.classification || '?'} · ${(record.recallingFirm || '').slice(0, 40)} · ${(record.productDescription || '').slice(0, 60)}`;
}

/**
 * Scan a list of records with the same stop rules as the CLI backfill script.
 */
function selectBackfillRecords(records, opts = {}) {
  const maxScan = opts.maxScan ?? records.length;
  const maxEnqueue = Number.isFinite(opts.maxEnqueue) ? opts.maxEnqueue : Infinity;
  const stats = createStats();
  const selected = [];
  const skips = [];

  for (const record of records) {
    if (stats.scanned >= maxScan || stats.enqueued >= maxEnqueue) break;

    stats.scanned += 1;
    const result = evaluateBackfillRecord(record, opts);

    if (result.scope.include) stats.food_safety_scope += 1;

    const qualifies = result.scope.include
      && result.statBucket !== 'excluded_class'
      && (opts.consumerOnly === false || (result.consumer && result.consumer.include));

    if (qualifies) stats.consumer_facing += 1;

    if (!result.enqueue) {
      if (result.statBucket && stats[result.statBucket] != null) {
        stats[result.statBucket] += 1;
      }
      if (opts.printSkips) {
        skips.push({ line: result.line, reason: result.skipReason });
      }
      continue;
    }

    selected.push({ record, line: result.line });
    stats.enqueued += 1;
  }

  return { selected, stats, skips };
}

function createStats() {
  return {
    scanned: 0,
    food_safety_scope: 0,
    consumer_facing: 0,
    enqueued: 0,
    excluded_scope: 0,
    excluded_industrial: 0,
    excluded_supplement: 0,
    excluded_class: 0,
  };
}

module.exports = {
  parseClassFilter,
  matchesClassFilter,
  evaluateBackfillRecord,
  selectBackfillRecords,
  formatLine,
  createStats,
};
