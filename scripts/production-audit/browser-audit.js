#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUTPUT_DIR = path.resolve(process.env.AUDIT_OUTPUT_DIR || 'audit-artifacts');
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4173';
const CHROME_BIN = process.env.CHROME_BIN;
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

if (!CHROME_BIN) {
  console.error('CHROME_BIN is required');
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function installApiMocks(page) {
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    let url;
    try {
      url = new URL(request.url());
    } catch {
      request.continue();
      return;
    }

    if (url.origin !== BASE_URL || !url.pathname.startsWith('/.netlify/functions/')) {
      request.continue();
      return;
    }

    const name = url.pathname.split('/').pop();
    let body = {};
    let status = 200;

    switch (name) {
      case 'get-auth0-config':
        body = { error: 'not configured in browser audit' };
        break;
      case 'posts-read':
        body = { posts: [], pagination: { page: 1, limit: 20, hasMore: false } };
        break;
      case 'live-stories':
        body = { success: true, stories: [] };
        break;
      case 'send-email':
        body = { success: true, message: 'Subscribed! Check your inbox.' };
        break;
      case 'weatherProxy':
      case 'weather-proxy':
        body = { current: null, alerts: [] };
        break;
      default:
        body = {};
        break;
    }

    request.respond({
      status,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify(body),
    });
  });
}

function unique(items) {
  return [...new Set(items)];
}

async function auditViewport(browser, config) {
  const page = await browser.newPage();
  await page.setViewport(config.viewport);
  await installApiMocks(page);

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') consoleErrors.push(text);
    if (message.type() === 'warning') consoleWarnings.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith(BASE_URL)) failedRequests.push({ url, error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.url().startsWith(BASE_URL) && response.status() >= 400) {
      badResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const started = Date.now();
  await page.goto(`${BASE_URL}/v2/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await sleep(4_000);

  const newsletter = await page.evaluate(async () => {
    const input = document.querySelector('.newsletter-form input[type="email"]');
    const button = document.querySelector('.newsletter-form button[type="submit"]');
    const hint = document.querySelector('.newsletter-hint');
    if (!input || !button || !hint) return { passed: false, reason: 'Newsletter controls missing' };
    input.value = 'audit@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      if (hint.classList.contains('is-success')) {
        return {
          passed: true,
          message: hint.textContent.trim(),
          buttonDisabled: button.disabled,
          inputValue: input.value,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return {
      passed: false,
      reason: 'Success state not reached',
      message: hint.textContent.trim(),
      buttonDisabled: button.disabled,
    };
  });

  let mobileNavigation = { applicable: false };
  if (config.mobile) {
    mobileNavigation = await page.evaluate(async () => {
      const toggle = document.querySelector('.nav-toggle');
      const menu = document.querySelector('.nav-menu');
      if (!toggle || !menu) return { applicable: true, passed: false, reason: 'Mobile navigation controls missing' };
      toggle.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const opened = toggle.getAttribute('aria-expanded') === 'true' && menu.classList.contains('open');
      toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const closed = toggle.getAttribute('aria-expanded') === 'false' && !menu.classList.contains('open');
      return {
        applicable: true,
        passed: opened && closed,
        opened,
        closed,
        focusReturned: document.activeElement === toggle,
        bodyOverflow: document.body.style.overflow,
      };
    });
  }

  const layout = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('button, input, select, textarea, [role="button"], a')]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 100),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          inline: getComputedStyle(element).display === 'inline',
        };
      });
    const imagesWithoutDimensions = [...document.images]
      .filter((image) => !image.hasAttribute('width') || !image.hasAttribute('height'))
      .map((image) => image.currentSrc || image.src)
      .slice(0, 50);
    const forms = [...document.forms].map((form) => ({
      id: form.id || null,
      className: form.className || null,
      action: form.getAttribute('action'),
      method: form.getAttribute('method'),
      emailInputs: form.querySelectorAll('input[type="email"]').length,
      labelledEmailInputs: [...form.querySelectorAll('input[type="email"]')]
        .filter((input) => (input.labels && input.labels.length) || input.getAttribute('aria-label')).length,
    }));
    return {
      title: document.title,
      lang: document.documentElement.lang,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content || null,
      hasMain: Boolean(document.querySelector('main')),
      h1Count: document.querySelectorAll('h1').length,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      smallNonInlineTargets: controls.filter((item) => !item.inline && (item.width < 44 || item.height < 44)).slice(0, 80),
      controlsCount: controls.length,
      imagesWithoutDimensions,
      forms,
    };
  });

  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const axeViolations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodeCount: violation.nodes.length,
      nodes: violation.nodes.slice(0, 12).map((node) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
  });

  await page.screenshot({
    path: path.join(OUTPUT_DIR, `homepage-${config.name}.png`),
    fullPage: true,
  });

  const result = {
    name: config.name,
    viewport: config.viewport,
    durationMs: Date.now() - started,
    layout,
    newsletter,
    mobileNavigation,
    axeViolations,
    consoleErrors: unique(consoleErrors).slice(0, 80),
    consoleWarnings: unique(consoleWarnings).slice(0, 80),
    pageErrors: unique(pageErrors).slice(0, 80),
    failedRequests: failedRequests.slice(0, 80),
    badResponses: badResponses.slice(0, 80),
  };

  await page.close();
  return result;
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_BIN,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const viewports = [
      { name: 'mobile', mobile: true, viewport: { width: 390, height: 844, deviceScaleFactor: 1 } },
      { name: 'desktop', mobile: false, viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 } },
    ];
    const results = [];
    for (const viewport of viewports) results.push(await auditViewport(browser, viewport));

    const seriousAxe = results.flatMap((result) => result.axeViolations)
      .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
    const failures = [];
    for (const result of results) {
      if (!result.layout.hasMain) failures.push(`${result.name}: missing main landmark`);
      if (result.layout.h1Count !== 1) failures.push(`${result.name}: expected one h1, found ${result.layout.h1Count}`);
      if (result.layout.horizontalOverflow > 2) failures.push(`${result.name}: horizontal overflow ${result.layout.horizontalOverflow}px`);
      if (!result.newsletter.passed) failures.push(`${result.name}: newsletter interaction failed`);
      if (result.mobileNavigation.applicable && !result.mobileNavigation.passed) failures.push(`${result.name}: mobile navigation interaction failed`);
      if (result.pageErrors.length) failures.push(`${result.name}: ${result.pageErrors.length} uncaught page error(s)`);
    }
    if (seriousAxe.length) failures.push(`${seriousAxe.length} serious/critical axe violation group(s)`);

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      failures,
      results,
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'browser-audit.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, 'browser-audit.status'), failures.length ? '1\n' : '0\n');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  fs.writeFileSync(path.join(OUTPUT_DIR, 'browser-audit.status'), '2\n');
  console.error(error);
  process.exitCode = 2;
});
