#!/usr/bin/env node
/**
 * Bounded openFDA enforcement backfill (Tier 2 — enrichment/backfill only,
 * never the low-latency trigger).
 *
 * Usage:
 *   npm run fda:backfill -- --since=2026-06-01 --dry-run
 *   npm run fda:backfill -- --since=2026-06-01 --until=2026-07-01 --limit=50
 *   npm run fda:backfill -- --since=2026-06-01 --cursor=100   # resume at skip=100
 *
 * --dry-run prints what would be enqueued without writing.
 * Without --dry-run, food enforcement records become pending
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

async function main() {
  const since = arg('since');
  const until = arg('until');
  const maxItems = parseInt(arg('limit', '100'), 10);
  let cursor = parseInt(arg('cursor', '0'), 10);
  const dryRun = flag('dry-run');

  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.error('Usage: fda:backfill -- --since=YYYY-MM-DD [--until=YYYY-MM-DD] [--limit=N] [--cursor=N] [--dry-run]');
    process.exit(1);
  }

  const { queryEnforcement, normalizeEnforcementRecord } = require(path.join(LIB, 'providers/fda/openfda'));

  const from = since.replace(/-/g, '');
  const to = until ? until.replace(/-/g, '') : '99991231';
  const search = `report_date:[${from} TO ${to}] AND product_type:"Food"`;

  console.log(`openFDA backfill ${since} → ${until || 'now'} (limit ${maxItems}, cursor ${cursor}, ${dryRun ? 'DRY RUN' : 'LIVE'})`);

  let upsertSourceDocument = null;
  if (!dryRun) {
    ({ upsertSourceDocument } = require(path.join(LIB, 'store')));
  }

  let processed = 0; let enqueued = 0; let skippedScope = 0;
  const { scopeFilter } = require(path.join(LIB, 'classify'));

  while (processed < maxItems) {
    const batch = Math.min(PAGE_SIZE, maxItems - processed);
    const res = await queryEnforcement({ search, limit: batch, skip: cursor });
    const results = (res && res.results) || [];
    if (!results.length) break;

    for (const raw of results) {
      processed += 1;
      cursor += 1;
      const rec = normalizeEnforcementRecord(raw);

      const scope = scopeFilter({
        title: rec.productDescription || '',
        description: rec.reasonForRecall || '',
        productType: raw.product_type || '',
      });
      if (!scope.include) {
        skippedScope += 1;
        continue;
      }

      const line = `${rec.recallNumber || '(no recall #)'} · ${rec.classification || '?'} · ${(rec.recallingFirm || '').slice(0, 40)} · ${(rec.productDescription || '').slice(0, 60)}`;
      if (dryRun) {
        console.log(`  would enqueue: ${line}`);
        enqueued += 1;
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
        enqueued += 1;
        console.log(`  enqueued: ${line}`);
      }
    }

    if (results.length < batch) break;
  }

  console.log(`\nDone. scanned=${processed} enqueued=${enqueued} out_of_scope=${skippedScope} next_cursor=${cursor}`);
  if (dryRun) console.log('(dry run: nothing written)');
}

main().catch((e) => {
  console.error('backfill failed:', e.message);
  process.exit(1);
});
