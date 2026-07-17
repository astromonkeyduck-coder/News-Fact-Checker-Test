#!/usr/bin/env node
/**
 * Replay one FDA source through the deterministic pipeline WITHOUT touching
 * the database or publishing anything.
 *
 * Usage:
 *   npm run fda:replay -- --fixture=<name>          # tests/food-safety/fixtures/<name>.html
 *   npm run fda:replay -- --url=https://www.fda.gov/...   # live fetch (read-only)
 *   node scripts/food-safety/replay.js --fixture=recall-multi-product --json
 *
 * Prints the parse result, the normalized event candidate, product rows,
 * validation outcome, severity reasons, and the publish decision that WOULD
 * be made under current flags. Never writes.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LIB = path.resolve(__dirname, '../../netlify/functions/lib/food-safety');
const FIXTURES_DIR = path.resolve(__dirname, '../../tests/food-safety/fixtures');

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}
const flag = (name) => process.argv.includes(`--${name}`);

async function main() {
  const fixture = arg('fixture');
  const url = arg('url');
  if (!fixture && !url) {
    console.error('Usage: fda:replay -- --fixture=<name> | --url=<fda-url> [--json]');
    const available = fs.existsSync(FIXTURES_DIR)
      ? fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))
      : [];
    if (available.length) console.error(`Available fixtures: ${available.join(', ')}`);
    process.exit(1);
  }

  const { parseCanonicalPage, fetchCanonicalPage } = require(path.join(LIB, 'providers/fda/canonicalPage'));
  const { buildEventCandidate } = require(path.join(LIB, 'buildEvent'));
  const { validateEventCandidate, decidePublishState } = require(path.join(LIB, 'validate'));
  const { scopeFilter } = require(path.join(LIB, 'classify'));
  const { canonicalKeyForPage } = require(path.join(LIB, 'correlate'));

  let html; let canonicalUrl; let meta = null;
  if (fixture) {
    const htmlPath = path.join(FIXTURES_DIR, `${fixture}.html`);
    const metaPath = path.join(FIXTURES_DIR, `${fixture}.meta.json`);
    if (!fs.existsSync(htmlPath)) {
      console.error(`Fixture not found: ${htmlPath}`);
      process.exit(1);
    }
    html = fs.readFileSync(htmlPath, 'utf8');
    meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
    canonicalUrl = meta.source_url || 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/unknown-fixture';
    console.log(`Fixture: ${fixture}${meta.captured_at ? ` (captured ${meta.captured_at})` : ''}`);
  } else {
    console.log(`Fetching live (read-only): ${url}`);
    const page = await fetchCanonicalPage(url);
    html = page.html;
    canonicalUrl = page.canonicalUrl;
  }

  const parse = parseCanonicalPage(html, canonicalUrl);

  const scope = scopeFilter({
    title: parse.title || '',
    description: `${parse.recallReason || ''}\n${(parse.announcementText || '').slice(0, 1000)}\n${parse.productDescription || ''}`,
    url: canonicalUrl,
  });

  const canonicalKey = canonicalKeyForPage(canonicalUrl);
  const { event, products, warnings, evidence } = buildEventCandidate(parse, {
    sourceKind: parse.layout === 'outbreak_advisory' ? 'fda_rss_outbreak' : 'fda_rss_recall',
    canonicalKey,
  });

  const validation = validateEventCandidate(event, { products, parseWarnings: warnings });
  const decision = decidePublishState(event, {
    reviewReasons: validation.valid ? validation.reviewReasons : [...validation.errors, ...validation.reviewReasons],
    materialChanged: true,
    previousPublishState: null,
  });

  if (flag('json')) {
    console.log(JSON.stringify({ parse, scope, event, products, validation, decision, evidence }, null, 2));
    return;
  }

  console.log('\n── Scope ──────────────────────────────');
  console.log(`  include: ${scope.include}${scope.reason ? ` (${scope.reason})` : ''}`);
  console.log('\n── Event candidate ────────────────────');
  const show = [
    'canonical_key', 'event_kind', 'display_title', 'short_dek', 'public_action',
    'company', 'brands', 'product_name', 'hazard_category', 'hazard_name',
    'organism', 'allergens', 'status', 'illnesses', 'hospitalizations', 'deaths',
    'geographic_scope', 'case_states', 'distribution_states', 'retailers',
    'severity', 'extraction_confidence',
  ];
  for (const k of show) {
    const v = event[k];
    if (v !== null && v !== undefined) console.log(`  ${k}: ${JSON.stringify(v)}`);
  }
  console.log(`  severity_reasons: ${JSON.stringify(event.severity_reasons)}`);
  console.log(`\n── Products (${products.length}) ─────────────────────`);
  products.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${[p.brand, p.product_name, p.package_size, p.upc && `UPC ${p.upc}`, p.lot_code && `lot ${p.lot_code}`].filter(Boolean).join(' · ')}`);
  });
  if (products.length > 10) console.log(`  … and ${products.length - 10} more`);
  console.log('\n── Validation ─────────────────────────');
  console.log(`  valid: ${validation.valid}`);
  if (validation.errors.length) console.log(`  errors: ${validation.errors.join('; ')}`);
  if (validation.reviewReasons.length) console.log(`  review: ${validation.reviewReasons.join('; ')}`);
  if (warnings.length) console.log(`  warnings: ${warnings.join('; ')}`);
  console.log('\n── Publish decision (dry run) ─────────');
  console.log(`  state: ${decision.publishState}${decision.reason ? ` (${decision.reason})` : ''}`);
  console.log('\n(no database writes performed)');
}

main().catch((e) => {
  console.error('replay failed:', e.message);
  process.exit(1);
});
