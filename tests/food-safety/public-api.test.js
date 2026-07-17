/**
 * Public payload safety tests: the strict allowlists must never leak
 * internal evidence, review state, confidence, hashes, or raw source
 * documents; compact card summaries must obey the numeric truth rules.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const LIB = path.resolve(__dirname, '../../netlify/functions/lib/food-safety');

const { toPublicEvent, toPublicProduct, toPublicVersion } = require(path.join(LIB, 'validate'));
const {
  buildCompactSummary, buildGeographyLabel, buildMetricSummary, buildTags,
} = require(path.join(LIB, 'publish'));

const FULL_EVENT_ROW = {
  id: '11111111-2222-3333-4444-555555555555',
  canonical_key: 'fda:page:abc',
  event_kind: 'recall',
  provider: 'fda',
  source_url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example',
  title: 'Official Title',
  display_title: 'Product recalled over possible Salmonella contamination',
  short_dek: 'Company · Salmonella · Do not eat',
  public_action: 'Do not eat',
  company: 'Company',
  product_name: 'Product',
  hazard_category: 'pathogen',
  hazard_name: 'Salmonella',
  status: 'active',
  illnesses: null,
  hospitalizations: null,
  deaths: null,
  geographic_scope: 'multistate',
  case_states: null,
  distribution_states: ['CA', 'TX'],
  severity: 3,
  post_id: 'fda-abc',
  images: [{
    url: '/.netlify/functions/get-uploaded-image?key=x',
    alt: 'Product package',
    caption: null,
    credit: 'FDA',
    role: 'product_photo',
    // internal fields that must be stripped:
    sourcePageUrl: 'https://www.fda.gov/internal',
    hash: 'deadbeef',
    downloadBytes: 12345,
  }],
  source_links: [
    { url: 'https://www.fda.gov/safety/example', label: 'FDA recall announcement', role: 'canonical', internalNote: 'x' },
    { url: 'https://evil.example.com/page', label: 'bad', role: 'related' },
  ],

  // internal-only fields that must NEVER appear publicly:
  publish_state: 'published',
  review_reason: 'secret note',
  extraction_method: 'deterministic',
  extraction_confidence: 0.9,
  source_hash: 'abc123',
  material_hash: 'def456',
  severity_reasons: ['internal'],
  recall_reason_text: 'internal raw',
};

test('toPublicEvent strips every internal processing field', () => {
  const pub = toPublicEvent(FULL_EVENT_ROW);
  const forbidden = [
    'publish_state', 'review_reason', 'extraction_method', 'extraction_confidence',
    'source_hash', 'material_hash', 'severity_reasons', 'recall_reason_text',
    'canonical_key',
  ];
  for (const f of forbidden) {
    assert.ok(!(f in pub), `${f} leaked into public payload`);
  }
  assert.equal(pub.display_title, FULL_EVENT_ROW.display_title);
  assert.equal(pub.severity, 3);
});

test('toPublicEvent strips internal image metadata and disallowed source links', () => {
  const pub = toPublicEvent(FULL_EVENT_ROW);
  assert.equal(pub.images.length, 1);
  const img = pub.images[0];
  assert.ok(!('sourcePageUrl' in img));
  assert.ok(!('hash' in img));
  assert.ok(!('downloadBytes' in img));
  assert.equal(img.credit, 'FDA');

  // Non-allowlisted hostname dropped from public source links.
  assert.equal(pub.source_links.length, 1);
  assert.match(pub.source_links[0].url, /^https:\/\/www\.fda\.gov\//);
  assert.ok(!('internalNote' in pub.source_links[0]));
});

test('toPublicProduct strips source evidence', () => {
  const pub = toPublicProduct({
    brand: 'B', product_name: 'P', upc: '123456789012',
    source_evidence: { text: 'internal excerpt' },
    event_id: 'uuid', id: 'uuid2',
  });
  assert.ok(!('source_evidence' in pub));
  assert.ok(!('event_id' in pub));
  assert.ok(!('id' in pub));
  assert.equal(pub.upc, '123456789012');
});

test('toPublicVersion exposes only version basics and material changes', () => {
  const pub = toPublicVersion({
    version_number: 2,
    observed_at: '2026-07-12T00:00:00Z',
    source_updated_at: '2026-07-12T00:00:00Z',
    material_changes: [{ type: 'illness_total', from: 10, to: 25, label: 'Illness total updated: 10 → 25' }],
    changed_fields: { secret: true },
    snapshot: { whole: 'event' },
    source_document_ids: ['uuid'],
    source_hash: 'abc',
  });
  assert.ok(!('snapshot' in pub));
  assert.ok(!('changed_fields' in pub));
  assert.ok(!('source_document_ids' in pub));
  assert.ok(!('source_hash' in pub));
  assert.equal(pub.version_number, 2);
  assert.equal(pub.material_changes.length, 1);
});

// ── Compact card summary truth rules ───────────────────────────────────────

test('metric summary omits unreported numbers; no fabricated "0 deaths"', () => {
  assert.equal(buildMetricSummary({ illnesses: null, hospitalizations: null, deaths: null }), null);
  assert.equal(buildMetricSummary({ illnesses: 12, hospitalizations: 4, deaths: null }), '12 sick · 4 hospitalized');
  // Explicit official zeros render only alongside a real illness total.
  assert.equal(buildMetricSummary({ illnesses: 12, hospitalizations: 0, deaths: 0 }), '12 sick · 0 hospitalized · 0 deaths');
  assert.equal(buildMetricSummary({ illnesses: null, hospitalizations: null, deaths: 0 }), null);
});

test('geography label never claims Nationwide without explicit scope', () => {
  assert.equal(buildGeographyLabel({ geographic_scope: 'nationwide' }), 'Nationwide');
  assert.equal(buildGeographyLabel({ geographic_scope: 'multistate', case_states: ['OH', 'MI', 'KY'] }), '3 states');
  assert.equal(buildGeographyLabel({ geographic_scope: 'multistate', distribution_states: ['CA', 'TX'] }), '2 states');
  assert.equal(buildGeographyLabel({ geographic_scope: 'unknown' }), null);
});

test('compact summary is card-safe: no products, versions, or raw source', () => {
  const compact = buildCompactSummary(FULL_EVENT_ROW, { productCount: 12, hasMapData: true });
  assert.equal(compact.product_count, 12);
  assert.equal(compact.has_map_data, true);
  assert.ok(!('products' in compact));
  assert.ok(!('images' in compact));
  assert.ok(!('source_links' in compact));
  const json = JSON.stringify(compact);
  assert.ok(json.length < 2000, `compact summary too large: ${json.length} bytes`);
  assert.ok(!json.includes('secret'));
});

// ── posts-read allowlist ───────────────────────────────────────────────────

test('posts-read public field allowlist includes only compact food-safety fields', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../netlify/functions/posts-read.js'), 'utf8',
  );
  assert.ok(/["']food_safety_summary["']/.test(src), 'food_safety_summary missing from allowlist');
  assert.ok(/["']food_safety_event_id["']/.test(src), 'food_safety_event_id missing from allowlist');
  // Internal fields must not be exposed through posts-read.
  for (const bad of ['food_safety_evidence', 'review_reason', 'extraction_confidence', 'parsed_payload']) {
    assert.ok(!new RegExp(`["']${bad}["']`).test(src), `${bad} must not be in posts-read allowlist`);
  }
});

// ── Tags ───────────────────────────────────────────────────────────────────

test('tags derive from validated fields only', () => {
  const tags = buildTags({
    event_kind: 'outbreak', organism: 'Cyclospora',
    geographic_scope: 'multistate', severity: 5,
  });
  assert.ok(tags.includes('food-safety'));
  assert.ok(tags.includes('outbreak'));
  assert.ok(tags.includes('cyclospora'));
  assert.ok(tags.includes('breaking'));
});
