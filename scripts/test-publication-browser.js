'use strict';
// Local, isolated Chromium verification. No user browser profile or live mutations.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');
const origin = process.env.PUBLICATION_PREVIEW_URL || 'http://127.0.0.1:4173';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw Error('Only a local preview is permitted');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/screenshots');
fs.mkdirSync(output, { recursive: true });
const finalOnly = process.argv.includes('--final-pages');
const metricsOnly = process.argv.includes('--metrics');
const focused = process.argv.includes('--focused') || metricsOnly || finalOnly;
const reportPath = path.join(root, finalOnly ? 'docs/publication-browser-final-pages.json' : metricsOnly ? 'docs/publication-browser-metrics.json' : focused ? 'docs/publication-browser-focused-results.json' : 'docs/publication-browser-results.json');
const report = { environment: 'Fresh headless Chromium; local saved-content preview; unthrottled; no user profile', checks: [], pages: [], errors: [] };
function check(name, pass, detail) { report.checks.push({ name, pass: Boolean(pass), detail }); }
(async () => {
 const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'publication-review-'));
 const browser = await puppeteer.launch({ headless: 'new', userDataDir: profile, executablePath: process.env.PUBLICATION_TEST_CHROME || puppeteer.executablePath() });
 try {
  const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(String(e.message)));
  await page.setRequestInterception(true);
  let blockImages = false;
  page.on('request', request => {
   if (blockImages && request.resourceType() === 'image') return request.abort();
   // Public display assets may load, but no third-party post/API mutation may escape this test.
   if (request.method() !== 'GET' && (metricsOnly || !request.url().startsWith(origin + '/'))) return request.abort();
   request.continue();
  });
  async function goto(route) { const response = await page.goto(origin + route, { waitUntil: 'networkidle2', timeout: 30000 }); await page.evaluate(() => document.fonts.ready); return response.status(); }
  async function inspect(name, route, width, screenshot = true) {
   await page.setViewport({ width, height: width < 500 ? 844 : 960, deviceScaleFactor: 1 });
   const status = await goto(route);
   const data = await page.evaluate(() => {
    const h = document.querySelector('h1'), rect = h?.getBoundingClientRect();
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.title, h1: h?.textContent, h1Top: rect?.top, h1Bottom: rect?.bottom, h1Font: h ? getComputedStyle(h).fontSize : null,
     brokenImages: [...document.images].filter(i => !i.hidden && i.complete && !i.naturalWidth).map(i => i.src),
     videos: [...document.querySelectorAll('video')].map(v => ({ paused: v.paused, autoplay: v.autoplay, controls: v.controls, muted: v.muted })),
     fixedOverlays: [...document.querySelectorAll('body *')].filter(el => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 0).map(el => el.className),
     timing: performance.getEntriesByType('navigation').map(e => ({ domContentLoadedMs: Math.round(e.domContentLoadedEventEnd), loadMs: Math.round(e.loadEventEnd), transferBytes: e.transferSize })),
     paints: performance.getEntriesByType('paint').map(e => ({ name: e.name, ms: Math.round(e.startTime) })) };
   });
   report.pages.push({ name, route, status, ...data });
   check(`${name} ${width}px no horizontal overflow`, data.scrollWidth <= width, data.scrollWidth);
   check(`${name} ${width}px resolved`, status === 200, status);
   check(`${name} ${width}px no automatic video playback`, data.videos.every(v => v.paused && !v.autoplay), data.videos);
   if (screenshot) await page.screenshot({ path: path.join(output, `after-${name}-${width}.png`), fullPage: false });
   return data;
  }
  if (finalOnly) {
   await inspect('fda-recall-final', '/article.html?id=fda-page-cea1b405db7be04c', 1440);
   check('Recall action does not contradict source instructions', await page.$$eval('.article-deck,.article-body > p', elements => { const current = elements.map(e => e.innerText).join(' '); return !(/Return for a refund/.test(current) && /do not need to return/.test(current)); }));
   check('FDA distinguishes no reports from no cases', await page.$eval('body', e => /No illnesses had been reported in the source announcement/.test(e.innerText)));
   check('Article records the substantive recall correction', await page.$$eval('.correction-record', elements => elements.some(e => /Return for a refund/.test(e.innerText) && /destroy/i.test(e.innerText))));
   await page.screenshot({ path: path.join(output, 'after-fda-recall-final-full.png'), fullPage: true });
   await inspect('corrections-final', '/corrections.html', 390);
   check('Public corrections page links the corrected recall', await page.$$eval('a', links => links.some(a => a.getAttribute('href') === '/article.html?id=fda-page-cea1b405db7be04c')));
   await page.screenshot({ path: path.join(output, 'after-corrections-final-full.png'), fullPage: true });
   await inspect('contact-final', '/contact.html', 375);
   check('Contact avoids unverified inbox priority promise', await page.$eval('body', e => !/before anything else in the inbox/.test(e.innerText)));
   check('Static contact page uses preview safety flag', await page.$eval('body', e => e.dataset.preview === 'true'));
  } else if (metricsOnly) {
   await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 });
   await page.setCacheEnabled(false);
   await page.evaluateOnNewDocument(() => {
    window.__publicationTestMetrics = { cls: 0, lcpMs: null };
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__publicationTestMetrics.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__publicationTestMetrics.lcpMs = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
   });
   for (const [name, url] of [['production-before', 'https://noteworthynews.co/'], ['local-release-after', origin + '/']]) {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('a[href*="/article.html?id="]', { visible: true, timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
    const data = await page.evaluate(() => ({ title: document.title, width: innerWidth, metrics: window.__publicationTestMetrics, navigation: performance.getEntriesByType('navigation').map(e => ({ domContentLoadedMs: Math.round(e.domContentLoadedEventEnd), loadMs: Math.round(e.loadEventEnd), transferBytes: e.transferSize, encodedBodyBytes: e.encodedBodySize, decodedBodyBytes: e.decodedBodySize })), paints: performance.getEntriesByType('paint').map(e => ({ name: e.name, ms: Math.round(e.startTime) })), resources: performance.getEntriesByType('resource').map(e => ({ type: e.initiatorType, transferBytes: e.transferSize })).reduce((a, e) => { a.count++; a.knownTransferredBytes += e.transferBytes; a.byType[e.type] = (a.byType[e.type] || 0) + 1; return a; }, { count: 0, knownTransferredBytes: 0, byType: {} }) }));
    report.pages.push({ name, url, ...data });
    await page.screenshot({ path: path.join(output, name + '-metrics-1440.png'), fullPage: false });
   }
   report.environment += '; public production read-only comparison; all non-GET requests blocked; HTTP cache disabled; same viewport; origins/network paths differ, so timings are diagnostic rather than a deployment speed comparison';
  } else if (!focused) {
  for (const width of [375, 390, 768, 1280, 1440]) {
   await inspect('home', '/', width);
   await inspect('news-article', '/article.html?id=2096717577204502980', width);
   await inspect('archive', '/archive.html', width);
  }
  await inspect('usgs-article', '/article.html?id=usgs-us7000tgrk', 1440);
  check('USGS source and automated attribution visible', await page.$eval('body', e => /USGS|U.S. Geological Survey/.test(e.innerText) && /Automated/.test(e.innerText)));
  await inspect('fda-article', '/article.html?id=fda-page-1b6014ef53e61d57', 390);
  check('Ambiguous FDA import uses review notice', await page.$eval('body', e => /review|research/i.test(e.innerText) && !/FDA is investigating a Cyclospora outbreak/.test(e.innerText)));
  await inspect('fda-recall', '/article.html?id=fda-page-cea1b405db7be04c', 1440);
  await goto('/article.html?id=fda-page-69ab2fdc073a9d8f');
   check('FDA unknown illness count stays unknown', await page.$eval('body', e => /Illness count[\s\S]{0,30}Not reported/.test(e.innerText) && !/0 sick|0 illnesses/.test(e.innerText)));
  await goto('/article.html?id=2096717577204502980');
  const headline = await page.$eval('h1', e => e.textContent);
  check('Lead headline complete', !headline.includes('…') && headline.includes('sheriff’s office says.'), headline);
  await page.click('[data-copy]');
  await page.waitForFunction(() => /Link copied|Copy this link/.test(document.querySelector('#share-status').textContent), { timeout: 5000 });
  const copyStatus = await page.$eval('#share-status', e => e.textContent);
  check('Copy link succeeds or exposes readable fallback', /Link copied|Copy this link/.test(copyStatus), copyStatus);
  check('Correction action includes article URL', await page.$$eval('a[href^="mailto:"]', links => links.some(a => decodeURIComponent(a.href).includes('/article.html?id=2096717577204502980'))));
  await goto('/archive.html');
  await page.type('#search', 'Miami');
  check('Miami exactly five results', await page.$eval('#result-count', e => /Showing 5 of 5/.test(e.textContent)));
  check('Miami pagination hidden', await page.$eval('#load-more', e => e.hidden));
  check('Search query shareable', new URL(page.url()).searchParams.get('q') === 'Miami', page.url());
  await page.screenshot({ path: path.join(output, 'after-archive-miami.png'), fullPage: true });
  await page.select('#format', 'video');
  check('Miami plus video reduces to two', await page.$eval('#result-count', e => /Showing 2 of 2/.test(e.textContent)));
  await page.select('#category', 'Earthquakes');
  check('Combined filters yield zero, pagination hidden', await page.evaluate(() => /Showing 0 of 0/.test(document.querySelector('#result-count').textContent) && document.querySelector('#load-more').hidden));
  await page.screenshot({ path: path.join(output, 'after-archive-zero.png'), fullPage: true });
  await page.click('#reset-filters');
  check('Reset clears search and filters', await page.evaluate(() => ['q', 'category', 'format'].every(n => document.querySelector('#archive-filters').elements[n].value === '') && !document.querySelector('#archive-filters').elements.alerts.checked));
  await page.select('#category', 'News');
  const initialCount = await page.$eval('#result-count', e => e.textContent);
  await page.click('#load-more');
  const moreCount = await page.$eval('#result-count', e => e.textContent);
  check('Load more preserves category and grows matching count', await page.$eval('#category', e => e.value === 'News') && initialCount !== moreCount, { initialCount, moreCount, url: page.url() });
  await page.reload({ waitUntil: 'networkidle2' });
  check('Reload preserves shareable filters and pagination', await page.$eval('#result-count', e => e.textContent) === moreCount);
  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  await goto('/');
  await page.click('.menu-toggle');
  check('Mobile menu opens', await page.$eval('.menu-toggle', e => e.getAttribute('aria-expanded') === 'true'));
  await page.screenshot({ path: path.join(output, 'after-mobile-menu.png'), fullPage: false });
  await page.keyboard.press('Escape');
  check('Escape closes menu and restores focus', await page.evaluate(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'false' && document.activeElement === document.querySelector('.menu-toggle')));
  check('Cookie controls stay in normal flow', await page.$eval('#publication-consent', e => !['fixed', 'absolute', 'sticky'].includes(getComputedStyle(e).position)));
  await page.click('[data-cookie-settings]');
  check('Footer cookie settings focus control', await page.evaluate(() => Boolean(document.activeElement?.dataset.consent)));
  await page.click('[data-consent="rejected"]');
  check('Reject cookies dismisses choice', !(await page.$('#publication-consent')));
  await page.click('[data-cookie-settings]');
  check('Cookie preferences can be reopened', Boolean(await page.$('#publication-consent')));
  await page.type('#newsletter-email', 'publication-review@example.com');
  await page.click('#newsletter-form button');
  await page.waitForFunction(() => /Test signup completed/.test(document.querySelector('#newsletter-status').textContent));
  check('Newsletter local mock explicitly confirms no live send', await page.$eval('#newsletter-status', e => /No email was sent and no subscriber was added/.test(e.textContent)));
  await page.screenshot({ path: path.join(output, 'after-newsletter-test.png'), fullPage: false });
  await goto('/article.html?id=does-not-exist');
  check('Missing record has specific recovery state', await page.$eval('h1', e => /could not be found/.test(e.textContent)) && Boolean(await page.$('a[href="/archive.html"]')));
  } else {
   await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
   await goto('/article.html?id=2096717577204502980');
   await page.click('[data-copy]');
   await page.waitForFunction(() => /Link copied|Copy this link/.test(document.querySelector('#share-status').textContent), { timeout: 5000 });
   const copy = await page.$eval('#share-status', el => el.textContent);
   check('Copy confirmation settles', /Link copied|Copy this link/.test(copy), copy);
   for (const route of ['/masthead.html', '/subscriptions.html', '/contact.html', '/resources.html', '/privacy.html']) {
    await inspect(route.split('/')[1].split('.')[0], route, 375);
   }
   blockImages = true;
   await page.setCacheEnabled(false);
   await goto('/archive.html');
   await page.type('#search', 'Miami');
   await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 });
   const failures = await page.$$eval('.story-image img', images => images.filter(i => i.complete && !i.naturalWidth).map(i => i.src));
   check('Failed dynamic archive images use explicit fallback', failures.length === 0, failures);
   await page.screenshot({ path: path.join(output, 'after-archive-images-unavailable.png'), fullPage: true });
   blockImages = false;
   await inspect('fda-recall', '/article.html?id=fda-page-cea1b405db7be04c', 1440);
   await goto('/article.html?id=fda-page-69ab2fdc073a9d8f');
   check('FDA unknown illness count stays unknown', await page.$eval('body', e => /Illness count[\s\S]{0,30}Not reported/.test(e.innerText) && !/0 sick|0 illnesses/.test(e.innerText)));
  }
  check('No uncaught browser script errors', report.errors.length === 0, report.errors);
 } finally {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
 }
 const failures = report.checks.filter(c => !c.pass);
 console.log(JSON.stringify({ checks: report.checks.length, failures, pages: report.pages.length, errors: report.errors }, null, 2));
 process.exitCode = failures.length ? 1 : 0;
})().catch(e => { fs.writeFileSync(reportPath, JSON.stringify({ ...report, fatalError: e.message }, null, 2)); console.error(e); process.exitCode = 1; });
