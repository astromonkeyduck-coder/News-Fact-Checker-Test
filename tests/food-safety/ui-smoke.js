#!/usr/bin/env node
/**
 * Food Safety UI smoke test (manual; requires Chrome via puppeteer).
 *
 *   node tests/food-safety/ui-smoke.js
 *
 * Serves the repo statically with stubbed posts-read / food-safety-event
 * endpoints (no live network, no Supabase), then verifies in a real browser:
 *   - homepage: food-safety strip cards render kicker/metrics/geography,
 *     normal + earthquake posts unaffected, no console errors
 *   - article: action banner, verified metrics, product table, map SVG,
 *     timeline, official sources — at mobile (390x844) and desktop (1440x900)
 * Screenshots land in /tmp/fs-smoke/.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 8899;

const EVENT_ID = '11111111-2222-3333-4444-555555555555';

const FS_OUTBREAK_POST = {
  id: 'fda-page-8112f1c198094a43',
  title: 'Cyclospora outbreak linked to Iceberg Lettuce',
  story: 'The FDA is investigating a Cyclospora outbreak linked to Iceberg Lettuce.\n\nFDA reports 1,644 illnesses linked to this investigation, 94 hospitalizations linked to this investigation, 0 deaths linked to this investigation across 5 states reporting outbreak-associated cases.\n\nFDA says these illnesses are a subset of Cyclospora illnesses identified nationwide.\n\nWhat to do: Do not eat.',
  text: 'The FDA is investigating a Cyclospora outbreak linked to Iceberg Lettuce.',
  summary: 'Cyclospora · Do not eat',
  category: 'Food Safety',
  source: 'FDA',
  event_type: 'food_outbreak',
  severity: 5,
  datePosted: '2026-07-16T14:00:00Z',
  updated_at: '2026-07-16T20:00:00Z',
  image: '/PREVIEWIMAGEBRUH.jpg',
  image_url: '/PREVIEWIMAGEBRUH.jpg',
  source_url: 'https://www.fda.gov/food/outbreaks-foodborne-illness/investigation-5-state-outbreak-cyclospora-illnesses-iceberg-lettuce-july-2026',
  food_safety_event_id: EVENT_ID,
  food_safety_summary: {
    event_kind: 'outbreak',
    update_number: 2,
    status: 'ongoing',
    product: 'Iceberg Lettuce',
    company: null,
    hazard_category: 'pathogen',
    hazard_label: 'Cyclospora',
    public_action: 'Do not eat',
    geographic_scope: 'multistate',
    geography_label: '5 states',
    metric_summary: '1,644 sick · 94 hospitalized · 0 deaths',
    case_state_count: 5,
    distribution_state_count: 5,
    illnesses: 1644,
    hospitalizations: 94,
    deaths: 0,
    last_official_update: '2026-07-16T20:00:00Z',
    has_map_data: true,
    product_count: 1,
  },
};

const FS_RECALL_POST = {
  id: 'fda-page-3315032717048f71',
  title: 'Khong Guan Corporation recalls Glutinous Rice Balls with Black Sesame Filling over undeclared peanuts',
  story: 'Khong Guan Corporation is recalling glutinous rice balls because they may contain undeclared peanuts.',
  category: 'Food Safety',
  source: 'FDA',
  event_type: 'food_recall',
  severity: 4,
  datePosted: '2026-07-15T10:00:00Z',
  image: '/PREVIEWIMAGEBRUH.jpg',
  food_safety_event_id: '22222222-2222-3333-4444-555555555555',
  food_safety_summary: {
    event_kind: 'allergen_alert',
    update_number: 0,
    status: 'active',
    product: 'Glutinous Rice Balls with Black Sesame Filling',
    company: 'Khong Guan Corporation',
    hazard_category: 'allergen',
    hazard_label: 'Undeclared peanuts',
    public_action: 'Return for a refund',
    geographic_scope: 'multistate',
    geography_label: '9 states',
    metric_summary: 'Undeclared peanuts',
    illnesses: null,
    hospitalizations: null,
    deaths: null,
    has_map_data: true,
    product_count: 2,
  },
};

const NORMAL_POST = {
  id: 'normal-1',
  title: 'BREAKING: Major infrastructure bill signed',
  story: 'A major infrastructure bill was signed today after months of negotiation.',
  category: 'Breaking News',
  source: 'Noteworthy',
  datePosted: '2026-07-17T12:00:00Z',
  image: '/PREVIEWIMAGEBRUH.jpg',
};

const QUAKE_POST = {
  id: 'quake-1',
  title: 'M5.2 earthquake near Ridgecrest, California',
  story: 'A magnitude 5.2 earthquake struck near Ridgecrest.',
  category: 'Earthquake',
  source: 'USGS',
  event_type: 'earthquake',
  magnitude: 5.2,
  datePosted: '2026-07-17T09:00:00Z',
};

const DETAIL = {
  event: {
    id: EVENT_ID,
    event_kind: 'outbreak',
    provider: 'fda',
    source_url: FS_OUTBREAK_POST.source_url,
    title: FS_OUTBREAK_POST.title,
    display_title: FS_OUTBREAK_POST.title,
    short_dek: 'Cyclospora · Do not eat',
    public_action: 'Do not eat',
    product_name: 'Iceberg Lettuce',
    hazard_category: 'pathogen',
    hazard_name: 'Cyclospora',
    organism: 'Cyclospora',
    status: 'ongoing',
    update_number: 2,
    fda_publish_date: '2026-07-10T14:00:00Z',
    source_updated_at: '2026-07-16T20:00:00Z',
    last_illness_onset: '2026-07-08',
    illnesses: 1644,
    hospitalizations: 94,
    deaths: 0,
    geographic_scope: 'multistate',
    case_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    outbreak_case_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    distribution_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    confirmed_distribution_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    possible_additional_distribution: true,
    national_surveillance_context: {
      outbreak_is_subset_of_national: true,
      pathogen_label: 'Cyclospora',
      national_case_count: null,
      statements: [
        'FDA says these illnesses are a subset of Cyclospora illnesses identified nationwide.',
        'CDC national surveillance includes this outbreak and illnesses not part of it.',
        'State counts may include probable cases or cases not yet reported to CDC.',
      ],
    },
    retailers: ['Taco Bell'],
    recommendations: ['Do not eat shredded iceberg lettuce served at implicated locations.'],
    source_links: [
      { url: FS_OUTBREAK_POST.source_url, label: 'FDA outbreak advisory', role: 'canonical' },
      { url: 'https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks', label: 'FDA CORE investigation table', role: 'core_table' },
    ],
    images: [],
    severity: 5,
    post_id: FS_OUTBREAK_POST.id,
  },
  products: [{
    brand: null,
    product_name: 'Shredded Iceberg Lettuce',
    package_size: 'Foodservice cases',
    distribution_states: ['IN', 'KY', 'MI', 'OH', 'WV'],
    retailers: ['Taco Bell'],
  }],
  timeline: [
    { version_number: 1, observed_at: '2026-07-10T14:05:00Z', source_updated_at: '2026-07-10T14:00:00Z', material_changes: [] },
    { version_number: 2, observed_at: '2026-07-14T10:05:00Z', source_updated_at: '2026-07-14T10:00:00Z', material_changes: [{ type: 'illness_total', from: 1500, to: 1644, label: 'Illness total updated: 1500 → 1644' }] },
    { version_number: 3, observed_at: '2026-07-16T20:05:00Z', source_updated_at: '2026-07-16T20:00:00Z', material_changes: [{ type: 'product_identified', label: 'Food source identified: Iceberg Lettuce' }, { type: 'new_case_states', states: ['IN'], label: 'New outbreak-associated case states: IN' }] },
  ],
  map: {
    mode_case_data: true,
    mode_distribution_data: true,
    nationwide_distribution: false,
    outbreak_case_states: [
      { abbr: 'IN', name: 'Indiana' }, { abbr: 'KY', name: 'Kentucky' },
      { abbr: 'MI', name: 'Michigan' }, { abbr: 'OH', name: 'Ohio' },
      { abbr: 'WV', name: 'West Virginia' },
    ],
    confirmed_distribution_states: [
      { abbr: 'IN', name: 'Indiana' }, { abbr: 'KY', name: 'Kentucky' },
      { abbr: 'MI', name: 'Michigan' }, { abbr: 'OH', name: 'Ohio' },
      { abbr: 'WV', name: 'West Virginia' },
    ],
    case_states: [
      { abbr: 'IN', name: 'Indiana' }, { abbr: 'KY', name: 'Kentucky' },
      { abbr: 'MI', name: 'Michigan' }, { abbr: 'OH', name: 'Ohio' },
      { abbr: 'WV', name: 'West Virginia' },
    ],
    distribution_states: [
      { abbr: 'IN', name: 'Indiana' }, { abbr: 'KY', name: 'Kentucky' },
      { abbr: 'MI', name: 'Michigan' }, { abbr: 'OH', name: 'Ohio' },
      { abbr: 'WV', name: 'West Virginia' },
    ],
    case_counts_by_state: null,
    distribution_text: null,
    possible_additional_distribution: true,
    outbreak_case_map_notice: 'Cyclospora illnesses have been reported beyond these 5 states. This map shows only states reporting cases currently linked by FDA and CDC to this specific Taco Bell iceberg-lettuce investigation.',
    labels: {
      tab_cases: 'Cases linked to this outbreak',
      tab_distribution: 'Confirmed product distribution',
      caption_cases: 'States reporting outbreak-associated cases',
      caption_distribution: 'Confirmed product distribution',
      legend_cases: 'Outbreak-associated cases reported',
      legend_distribution: 'Confirmed product distribution',
    },
    as_of: '2026-07-16T20:00:00Z',
  },
};

const POSTS = [NORMAL_POST, FS_OUTBREAK_POST, FS_RECALL_POST, QUAKE_POST];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;

    if (p === '/.netlify/functions/posts-read') {
      const id = url.searchParams.get('id');
      // posts-read always returns an array (single-element for ?id=)
      const body = id ? POSTS.filter((x) => x.id === id) : POSTS;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }
    if (p === '/.netlify/functions/food-safety-event') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(DETAIL));
      return;
    }
    if (p.startsWith('/.netlify/functions/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }

    let file = path.join(ROOT, decodeURIComponent(p === '/' ? '/index.html' : p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  const puppeteer = require('puppeteer');
  fs.mkdirSync('/tmp/fs-smoke', { recursive: true });
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const failures = [];
  const check = (name, cond) => {
    console.log(`${cond ? '  ok ' : '  FAIL'} ${name}`);
    if (!cond) failures.push(name);
  };

  // Pre-existing dev-only noise unrelated to food safety: comment-section
  // talks to a hardcoded localhost:8888 netlify-dev port in local envs.
  const relevantErrors = (errs) => errs.filter(
    (e) => !/localhost:8888|comments-api|ERR_CONNECTION_REFUSED|\[Comments\]/.test(e),
  );

  try {
    // ── Homepage (mobile) ───────────────────────
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`http://localhost:${PORT}/v2/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#strip-posts .dev-card', { timeout: 15000 });

    console.log('\nHomepage (390x844):');
    const stripText = await page.$eval('#strip-posts', (el) => el.textContent);
    check('outbreak card shows Update 2 kicker', stripText.includes('Update 2'));
    check('outbreak card shows official metrics', stripText.includes('1,644 sick') && stripText.includes('94 hospitalized'));
    check('recall card shows allergen + geography', stripText.includes('Undeclared peanuts') && stripText.includes('9 states'));
    check('allergen card shows Allergen Alert kicker', stripText.includes('Allergen Alert'));

    const productThumb = await page.$('#strip-posts .dev-card-thumb--product');
    check('product thumbnails use contain treatment', !!productThumb);

    const heroText = await page.$eval('#hero-card', (el) => el.textContent);
    check('normal breaking post owns the hero', heroText.includes('infrastructure bill'));
    const leadText = await page.$eval('#lead-story', (el) => el.textContent || '');
    check('top stories section renders', leadText.length > 20);
    const homeErrors = relevantErrors(consoleErrors);
    check('no relevant console errors on homepage', homeErrors.length === 0);
    if (homeErrors.length) console.log('   console:', homeErrors.slice(0, 5));
    await page.screenshot({ path: '/tmp/fs-smoke/home-mobile.png' });

    // ── Homepage (desktop) ──────────────────────
    await page.setViewport({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#strip-posts .dev-card', { timeout: 15000 });
    await page.screenshot({ path: '/tmp/fs-smoke/home-desktop.png' });
    console.log('Homepage (1440x900): rendered');

    // ── Food Safety article ─────────────────────
    const art = await browser.newPage();
    const artErrors = [];
    art.on('console', (msg) => { if (msg.type() === 'error') artErrors.push(msg.text()); });
    await art.setViewport({ width: 390, height: 844 });
    await art.goto(`http://localhost:${PORT}/article.html?id=${FS_OUTBREAK_POST.id}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await art.waitForSelector('.fs-banner', { timeout: 15000 });

    console.log('\nFood Safety article (390x844):');
    const banner = await art.$eval('.fs-banner', (el) => el.textContent);
    check('action banner shows consumer action', banner.includes('Do not eat'));
    check('banner shows Update 2 + Outbreak', banner.includes('Update 2') && banner.includes('Outbreak'));

    const changed = await art.$eval('.fs-changed', (el) => el.textContent).catch(() => '');
    check('what-changed from structured diff', changed.includes('Food source identified'));

    const metrics = await art.$eval('.fs-metrics', (el) => el.textContent);
    check('metric cards show reported values', metrics.includes('1,644') && metrics.includes('94'));
    check('explicit zero deaths renders', metrics.includes('Deaths') && metrics.includes('0'));

    const tableRows = await art.$$eval('.fs-products-table tbody tr', (rows) => rows.length);
    check('product table renders rows', tableRows === 1);

    await art.evaluate(() => document.querySelector('#fs-map').scrollIntoView());
    await art.waitForSelector('.fs-map-svg path', { timeout: 15000 });
    const activeStates = await art.$$eval('.fs-map-svg .fs-map-state--active', (els) => els.length);
    check('map highlights exactly the 5 case states', activeStates === 5);
    const mapAlt = await art.$eval('.fs-detail', (el) => el.textContent);
    check('map states truthfully no per-state counts', mapAlt.includes('State-by-state counts were not provided by FDA'));

    const toggle = await art.$$('.fs-map-toggle-btn');
    check('map mode toggle present (cases + distribution)', toggle.length === 2);

    const timeline = await art.$$eval('.fs-timeline-item', (els) => els.length);
    check('timeline shows all versions', timeline === 3);

    const sources = await art.$eval('.fs-sources', (el) => el.textContent);
    check('official sources labeled', sources.includes('Official FDA advisory') && sources.includes('CORE'));

    const kicker = await art.evaluate(() => document.body.textContent.includes('Food Safety'));
    check('Food Safety kicker present', kicker);
    const artRelevant = relevantErrors(artErrors);
    check('no relevant console errors on article', artRelevant.length === 0);
    if (artRelevant.length) console.log('   console:', artRelevant.slice(0, 5));
    await art.screenshot({ path: '/tmp/fs-smoke/article-mobile.png', fullPage: true });

    await art.setViewport({ width: 1440, height: 900 });
    await art.reload({ waitUntil: 'networkidle2' });
    await art.waitForSelector('.fs-banner', { timeout: 15000 });
    await art.screenshot({ path: '/tmp/fs-smoke/article-desktop.png', fullPage: true });
    console.log('Food Safety article (1440x900): rendered');

    // ── Normal article unaffected ───────────────
    const norm = await browser.newPage();
    await norm.setViewport({ width: 1440, height: 900 });
    await norm.goto(`http://localhost:${PORT}/article.html?id=${NORMAL_POST.id}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await norm.waitForSelector('#article-body', { timeout: 15000 });
    console.log('\nNormal article:');
    const fsLeak = await norm.$('.fs-banner');
    check('no food-safety UI leaks into normal articles', !fsLeak);
    const normBody = await norm.$eval('#article-body', (el) => el.textContent);
    check('normal article body renders', normBody.includes('infrastructure bill'));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nAll UI smoke checks passed.');
  process.exit(failures.length ? 1 : 0);
}

module.exports = { startServer, POSTS, DETAIL, FS_OUTBREAK_POST, NORMAL_POST, PORT };

if (require.main === module) {
  main().catch((e) => {
    console.error('ui-smoke failed:', e);
    process.exit(1);
  });
}
