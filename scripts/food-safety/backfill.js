#!/usr/bin/env node
/**
 * Bounded openFDA enforcement backfill (Tier 2 — enrichment/backfill only,
 * never the low-latency trigger).
 *
 * Usage:
 *   npm run fda:backfill -- --since=2026-05-01 --limit=250 --max-enqueue=10 --class=I,II --consumer-only --dry-run
 *   npm run fda:backfill -- --since=2026-06-01 --until=2026-07-01 --limit=50
 *   npm run fda:backfill -- --since=2026-06-01 --cursor=100
 *   npm run fda:backfill -- --since=2026-06-01 --include-industrial --print-skips
 *
 * --dry-run prints what would be enqueued without writing.
 * --limit=N            maximum records scanned (default 100)
 * --max-enqueue=N      stop after N qualifying records would be enqueued
 * --consumer-only      require consumerFacingFilter (default true)
 * --include-industrial override consumerFacingFilter
 * --class=I or --class=I,II   recall classification filter
 * --print-skips        log each skipped record with its exclusion reason
 *
 * Without --dry-run, qualifying food enforcement records become pending
 * food_safety_source_documents (source_kind=openfda_enforcement) that the
 * background processor reconciles. openFDA records alone never auto-publish
 * a new public alert (validate.js review rules enforce this downstream).
 *
 * Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for non-dry-run.
 * OPENFDA_API_KEY is optional (higher rate limits).
 */

'use strict';

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch (_) { /* optional */ }

const LIB = path.resolve(__dirname, '../../netlify/functions/lib/food-safety');

function arg(name, dflt = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
}
const flag = (name) => process.argv.includes(`--${name}`);

const PAGE_SIZE = 100;

function parseOptions(argv = process.argv) {
  const since = argv.find((a) => a.startsWith('--since='))?.split('=').slice(1).join('=') || null;
  const until = argv.find((a) => a.startsWith('--until='))?.split('=').slice(1).join('=') || null;
  const maxScan = parseInt(
    argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '100',
    10,
  );
  const maxEnqueueRaw = argv.find((a) => a.startsWith('--max-enqueue='));
  const maxEnqueue = maxEnqueueRaw ? parseInt(maxEnqueueRaw.split('=')[1], 10) : Infinity;
  const cursor = parseInt(
    argv.find((a) => a.startsWith('--cursor='))?.split('=')[1] || '0',
    10,
  );
  const dryRun = argv.includes('--dry-run');
  const printSkips = argv.includes('--print-skips');
  const includeIndustrial = argv.includes('--include-industrial');
  const consumerOnly = includeIndustrial ? false : (argv.includes('--consumer-only') || !argv.includes('--no-consumer-only'));
  const classRaw = argv.find((a) => a.startsWith('--class='))?.split('=').slice(1).join('=') || null;

  const { parseClassFilter } = require(path.join(LIB, 'backfillSelect'));
  return {
    since,
    until,
    maxScan,
    maxEnqueue,
    cursor,
    dryRun,
    printSkips,
    consumerOnly,
    classFilter: parseClassFilter(classRaw),
  };
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

function printSummary(stats, nextCursor, dryRun) {
  console.log(
    `\nscanned=${stats.scanned}\n`
    + `food_safety_scope=${stats.food_safety_scope}\n`
    + `consumer_facing=${stats.consumer_facing}\n`
    + `enqueued=${stats.enqueued}\n`
    + `excluded_scope=${stats.excluded_scope}\n`
    + `excluded_industrial=${stats.excluded_industrial}\n`
    + `excluded_supplement=${stats.excluded_supplement}\n`
    + `next_cursor=${nextCursor}`,
  );
  if (dryRun) console.log('(dry run: nothing written)');
}

async function main() {
  const opts = parseOptions();
  if (!opts.since || !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
    console.error('Usage: fda:backfill -- --since=YYYY-MM-DD [--until=YYYY-MM-DD] [--limit=N] [--max-enqueue=N] [--class=I|I,II] [--consumer-only] [--include-industrial] [--cursor=N] [--print-skips] [--dry-run]');
    process.exit(1);
  }

  const { queryEnforcement } = require(path.join(LIB, 'providers/fda/openfda'));
  const { evaluateBackfillRecord } = require(path.join(LIB, 'backfillSelect'));

  const from = opts.since.replace(/-/g, '');
  const to = opts.until ? opts.until.replace(/-/g, '') : '99991231';
  const search = `report_date:[${from} TO ${to}] AND product_type:"Food"`;

  console.log(
    `openFDA backfill ${opts.since} → ${opts.until || 'now'} `
    + `(scan limit ${opts.maxScan}, max enqueue ${Number.isFinite(opts.maxEnqueue) ? opts.maxEnqueue : '∞'}, `
    + `cursor ${opts.cursor}, consumer-only ${opts.consumerOnly}, `
    + `class ${opts.classFilter ? [...opts.classFilter].join('|') : 'any'}, `
    + `${opts.dryRun ? 'DRY RUN' : 'LIVE'})`,
  );

  let upsertSourceDocument = null;
  if (!opts.dryRun) {
    ({ upsertSourceDocument } = require(path.join(LIB, 'store')));
  }

  const stats = createStats();
  let cursor = opts.cursor;

  while (stats.scanned < opts.maxScan && stats.enqueued < opts.maxEnqueue) {
    const batch = Math.min(PAGE_SIZE, opts.maxScan - stats.scanned);
    const res = await queryEnforcement({ search, limit: batch, skip: cursor });
    const results = (res && res.results) || [];
    if (!results.length) break;

    for (const rec of results) {
      if (stats.scanned >= opts.maxScan || stats.enqueued >= opts.maxEnqueue) break;

      stats.scanned += 1;
      cursor += 1;

      const result = evaluateBackfillRecord(rec, {
        consumerOnly: opts.consumerOnly,
        classFilter: opts.classFilter,
      });

      if (result.scope.include) stats.food_safety_scope += 1;

      const qualifies = result.scope.include
        && result.statBucket !== 'excluded_class'
        && (!opts.consumerOnly || (result.consumer && result.consumer.include));

      if (qualifies) stats.consumer_facing += 1;

      if (!result.enqueue) {
        if (result.statBucket && stats[result.statBucket] != null) {
          stats[result.statBucket] += 1;
        }
        if (opts.printSkips) {
          console.log(`  skip: ${result.line} · ${result.skipReason}`);
        }
        continue;
      }

      if (opts.dryRun) {
        console.log(`  would enqueue: ${result.line}`);
        stats.enqueued += 1;
        continue;
      }

      const { isNew } = await upsertSourceDocument({
        provider: 'fda',
        source_kind: 'openfda_enforcement',
        external_id: rec.recallNumber || rec.eventId || null,
        openfda_event_id: rec.eventId || null,
        recall_numbers: rec.recallNumber ? [rec.recallNumber] : null,
        published_at: rec.reportDate || null,
        parsed_payload: rec,
        processing_status: 'pending',
      });
      if (isNew) {
        stats.enqueued += 1;
        console.log(`  enqueued: ${result.line}`);
      }
    }

    if (results.length < batch) break;
  }

  printSummary(stats, cursor, opts.dryRun);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('backfill failed:', e.message);
    process.exit(1);
  });
}

module.exports = {
  parseOptions,
  createStats,
  printSummary,
};
