#!/usr/bin/env node
/**
 * Reconcile stored food-safety events against openFDA enforcement records:
 * recall-status changes (Ongoing → Completed/Terminated), classification
 * backfill, and stale active events.
 *
 * openFDA is Tier 2: it may update lifecycle metadata on existing events but
 * NEVER creates a new public alert by itself.
 *
 * Usage:
 *   npm run fda:reconcile -- --dry-run
 *   npm run fda:reconcile -- --limit=20
 *
 * Requires SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
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

async function main() {
  const dryRun = flag('dry-run');
  const limit = parseInt(arg('limit', '25'), 10);

  const { supabase } = require(path.join(LIB, 'store'));
  const { findByRecallNumber, normalizeEnforcementRecord } = require(path.join(LIB, 'providers/fda/openfda'));

  console.log(`Reconcile up to ${limit} active events against openFDA (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  const { data: events, error } = await supabase
    .from('food_safety_events')
    .select('id, canonical_key, display_title, status, fda_recall_classification, recall_numbers, source_updated_at')
    .in('status', ['new', 'active', 'ongoing', 'updated', 'expanded'])
    .not('recall_numbers', 'is', null)
    .order('source_updated_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  if (!events || !events.length) {
    console.log('No active events with recall numbers to reconcile.');
    return;
  }

  let checked = 0; let changed = 0;
  for (const ev of events) {
    checked += 1;
    const recallNumber = ev.recall_numbers[0];
    const res = await findByRecallNumber(recallNumber);
    const raw = res && res.results && res.results[0];
    if (!raw) {
      console.log(`  ${recallNumber}: no openFDA record yet (weekly lag is normal)`);
      continue;
    }
    const rec = normalizeEnforcementRecord(raw);

    const updates = {};
    if (rec.status === 'Terminated' && ev.status !== 'terminated') {
      updates.status = 'terminated';
    }
    if (rec.classification && !ev.fda_recall_classification) {
      updates.fda_recall_classification = rec.classification;
    }

    if (!Object.keys(updates).length) {
      console.log(`  ${recallNumber}: in sync (${rec.status || 'no status'})`);
      continue;
    }

    changed += 1;
    console.log(`  ${recallNumber}: "${(ev.display_title || '').slice(0, 60)}" → ${JSON.stringify(updates)}`);
    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('food_safety_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', ev.id);
      if (upErr) console.error(`    update failed: ${upErr.message}`);
    }
  }

  console.log(`\nDone. checked=${checked} changed=${changed}${dryRun ? ' (dry run: nothing written)' : ''}`);
}

main().catch((e) => {
  console.error('reconcile failed:', e.message);
  process.exit(1);
});
