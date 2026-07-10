'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');

function filePath(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(filePath(relativePath), content.replace(/\r\n/g, '\n'));
}

function replaceOnce(relativePath, search, replacement, label) {
  const source = read(relativePath);
  const matches = typeof search === 'string'
    ? source.split(search).length - 1
    : [...source.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : `${search.flags}g`))].length;
  if (matches !== 1) {
    throw new Error(`${relativePath}: expected one ${label || 'match'}, found ${matches}`);
  }
  write(relativePath, source.replace(search, replacement));
}

function parseSource(relativePath, source = read(relativePath)) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
}

function applyRanges(relativePath, ranges) {
  if (!ranges.length) return;
  let source = read(relativePath);
  const sorted = ranges.slice().sort((a, b) => b.start - a.start);
  let lastStart = source.length + 1;
  for (const range of sorted) {
    if (range.end > lastStart) throw new Error(`${relativePath}: overlapping codemod ranges`);
    source = source.slice(0, range.start) + (range.replacement || '') + source.slice(range.end);
    lastStart = range.start;
  }
  write(relativePath, source);
}

function findHandlerFunction(sourceFile) {
  let handler = null;
  function visit(node) {
    if (handler) return;
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && node.left.getText(sourceFile) === 'exports.handler'
      && (ts.isArrowFunction(node.right) || ts.isFunctionExpression(node.right))) {
      handler = node.right;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!handler || !handler.body || !ts.isBlock(handler.body)) {
    throw new Error(`${sourceFile.fileName}: exports.handler function not found`);
  }
  return handler;
}

function addRequire(relativePath, requireLine) {
  let source = read(relativePath);
  if (source.includes(requireLine)) return;
  const sourceFile = parseSource(relativePath, source);
  const imports = sourceFile.statements.filter((statement) => {
    if (!ts.isVariableStatement(statement)) return false;
    return statement.declarationList.declarations.some((declaration) => (
      declaration.initializer
      && ts.isCallExpression(declaration.initializer)
      && declaration.initializer.expression.getText(sourceFile) === 'require'
    ));
  });
  const anchor = imports.length ? imports[imports.length - 1].end : 0;
  source = source.slice(0, anchor) + `\n${requireLine}` + source.slice(anchor);
  write(relativePath, source);
}

function insertGuardBeforeHandlerTry(relativePath, options) {
  const source = read(relativePath);
  if (source.includes(`scope: '${options.scope}'`)) return;
  const sourceFile = parseSource(relativePath, source);
  const handler = findHandlerFunction(sourceFile);
  const tryStatement = handler.body.statements.find(ts.isTryStatement);
  if (!tryStatement) throw new Error(`${relativePath}: direct handler try statement not found`);

  const guard = `  if (event.httpMethod === 'POST') {\n`
    + `    const guardResponse = await enforcePublicRateLimit(event, {\n`
    + `      scope: '${options.scope}',\n`
    + `      limit: ${options.limit},\n`
    + `      windowMs: ${options.windowMs},\n`
    + `      maxBodyBytes: ${options.maxBodyBytes},\n`
    + `      headers,\n`
    + `    });\n`
    + `    if (guardResponse) return guardResponse;\n`
    + `  }\n\n`;

  applyRanges(relativePath, [{
    start: tryStatement.getFullStart(),
    end: tryStatement.getFullStart(),
    replacement: `\n${guard}`,
  }]);
}

function addValidationErrorHandling(relativePath) {
  let source = read(relativePath);
  if (source.includes('error instanceof ValidationError')) return;
  const sourceFile = parseSource(relativePath, source);
  const handler = findHandlerFunction(sourceFile);
  const catches = [];
  function visit(node) {
    if (ts.isCatchClause(node)) catches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(handler.body);
  if (!catches.length) throw new Error(`${relativePath}: handler catch clause not found`);
  const target = catches.sort((a, b) => b.end - a.end)[0];
  const variable = target.variableDeclaration && target.variableDeclaration.name
    ? target.variableDeclaration.name.getText(sourceFile)
    : 'error';
  const insertion = `\n    if (${variable} instanceof ValidationError) {\n`
    + `      return {\n`
    + `        statusCode: ${variable}.statusCode || 400,\n`
    + `        headers: { ...headers, 'Cache-Control': 'no-store' },\n`
    + `        body: JSON.stringify({ error: ${variable}.message }),\n`
    + `      };\n`
    + `    }\n`;
  applyRanges(relativePath, [{
    start: target.block.getStart(sourceFile) + 1,
    end: target.block.getStart(sourceFile) + 1,
    replacement: insertion,
  }]);
}

function removeWeakEmailValidation(relativePath) {
  const source = read(relativePath);
  const sourceFile = parseSource(relativePath, source);
  const ranges = [];
  function visit(node) {
    if (ts.isIfStatement(node) && node.expression.getText(sourceFile).includes("email.includes('@')")) {
      ranges.push({ start: node.getFullStart(), end: node.end, replacement: '' });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (ranges.length !== 1) {
    throw new Error(`${relativePath}: expected one weak email validation block, found ${ranges.length}`);
  }
  applyRanges(relativePath, ranges);
}

function containsSensitiveIdentifier(node) {
  let sensitive = false;
  function visit(current) {
    if (sensitive) return;
    if (ts.isIdentifier(current)
      && /^(email|userEmail|fullName|firstName|lastName|displayName|foundContact|contact|resendApiKey|apiKey|token|secret)$/i.test(current.text)) {
      sensitive = true;
      return;
    }
    if (ts.isPropertyAccessExpression(current)
      && /^(email|name|RESEND_API_KEY|AUTH0_CLIENT_SECRET|SUPABASE_SERVICE_ROLE_KEY)$/i.test(current.name.text)) {
      sensitive = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return sensitive;
}

function stripSensitiveConsoleStatements(relativePath) {
  const source = read(relativePath);
  const sourceFile = parseSource(relativePath, source);
  const ranges = [];
  function visit(node) {
    if (ts.isExpressionStatement(node)
      && ts.isCallExpression(node.expression)
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.expression.getText(sourceFile) === 'console'
      && containsSensitiveIdentifier(node.expression)) {
      ranges.push({ start: node.getFullStart(), end: node.end, replacement: '' });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  applyRanges(relativePath, ranges);
}

function patchNewsletter() {
  const target = 'netlify/functions/send-email.js';
  addRequire(target, "const { enforcePublicRateLimit } = require('./lib/publicMutationGuard');");
  addRequire(target, "const { ValidationError, normalizeDisplayName, normalizeEmail, parseJsonObject } = require('./lib/publicInputValidation');");
  insertGuardBeforeHandlerTry(target, {
    scope: 'newsletter-signup',
    limit: 5,
    windowMs: 15 * 60 * 1000,
    maxBodyBytes: 8 * 1024,
  });

  replaceOnce(
    target,
    /const\s*\{\s*email\s*,\s*fullName\s*\}\s*=\s*JSON\.parse\(event\.body\);/,
    `const parsedBody = parseJsonObject(event.body);\n`
      + `    if (typeof parsedBody.company === 'string' && parsedBody.company.trim()) {\n`
      + `      return {\n`
      + `        statusCode: 200,\n`
      + `        headers: { ...headers, 'Cache-Control': 'no-store' },\n`
      + `        body: JSON.stringify({ success: true, message: 'Please check your inbox.' }),\n`
      + `      };\n`
      + `    }\n`
      + `    const email = normalizeEmail(parsedBody.email);\n`
      + `    const fullName = normalizeDisplayName(parsedBody.fullName);`,
    'newsletter JSON parser',
  );
  removeWeakEmailValidation(target);
  addValidationErrorHandling(target);
  stripSensitiveConsoleStatements(target);
}

function patchPushSubscribe() {
  const target = 'netlify/functions/push-subscribe.js';
  addRequire(target, "const { enforcePublicRateLimit } = require('./lib/publicMutationGuard');");
  addRequire(target, "const { ValidationError, normalizeEmail, normalizePushEndpoint, parseJsonObject, sanitizeNotificationPreferences, sanitizePushSubscription } = require('./lib/publicInputValidation');");
  insertGuardBeforeHandlerTry(target, {
    scope: 'push-subscribe',
    limit: 30,
    windowMs: 10 * 60 * 1000,
    maxBodyBytes: 64 * 1024,
  });
  replaceOnce(target, 'const body = JSON.parse(event.body);', 'const body = parseJsonObject(event.body);', 'push JSON parser');

  replaceOnce(
    target,
    'const subscriptionKey = getSubscriberKey(subscription.endpoint);',
    `const normalizedSubscription = sanitizePushSubscription(subscription);\n`
      + `        const normalizedUserEmail = normalizeEmail(userEmail, { optional: true });\n`
      + `        const safePreferences = sanitizeNotificationPreferences(preferences, {\n`
      + `          breakingNews: true,\n`
      + `          liveUpdates: true,\n`
      + `          majorDevelopments: true,\n`
      + `          earthquakes: true,\n`
      + `          weatherAlerts: true,\n`
      + `        });\n`
      + `        const subscriptionKey = getSubscriberKey(normalizedSubscription.endpoint);`,
    'subscribe key derivation',
  );
  replaceOnce(target, 'subscription: subscription,', 'subscription: normalizedSubscription,', 'stored subscription');
  replaceOnce(target, 'userEmail: userEmail || null,', 'userEmail: normalizedUserEmail,', 'stored push email');
  replaceOnce(
    target,
    /preferences:\s*preferences\s*\|\|\s*\{\s*breakingNews:\s*true,\s*liveUpdates:\s*true,\s*majorDevelopments:\s*true,\s*earthquakes:\s*true,\s*weatherAlerts:\s*true\s*\}/,
    'preferences: safePreferences',
    'push preference defaults',
  );
  replaceOnce(
    target,
    'const subscriptionKey = getSubscriberKey(subscription.endpoint);',
    `const normalizedEndpoint = normalizePushEndpoint(subscription.endpoint);\n`
      + `        const subscriptionKey = getSubscriberKey(normalizedEndpoint);`,
    'unsubscribe key derivation',
  );

  let source = read(target);
  source = source.replace(/^\s*subscriptionId:\s*subscriptionKey,?\s*$/m, '');
  write(target, source);
  addValidationErrorHandling(target);
  stripSensitiveConsoleStatements(target);
}

function patchGuardOnlyFunction(target, scope, limit, maxBodyBytes) {
  addRequire(target, "const { enforcePublicRateLimit } = require('./lib/publicMutationGuard');");
  insertGuardBeforeHandlerTry(target, {
    scope,
    limit,
    windowMs: 10 * 60 * 1000,
    maxBodyBytes,
  });
}

function patchAdminAuth() {
  replaceOnce(
    'admin/js/admin-auth.js',
    'return res.status !== 403 && res.status !== 401;',
    'return res.ok;',
    'fail-open server verification',
  );
}

function replaceVariableStatement(relativePath, variableName, predicate, replacement) {
  const source = read(relativePath);
  const sourceFile = parseSource(relativePath, source);
  const ranges = [];
  function visit(node) {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (declaration.name.getText(sourceFile) === variableName
          && (!predicate || predicate(declaration, sourceFile))) {
          ranges.push({ start: node.getFullStart(), end: node.end, replacement });
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (ranges.length !== 1) {
    throw new Error(`${relativePath}: expected one ${variableName} declaration, found ${ranges.length}`);
  }
  applyRanges(relativePath, ranges);
}

function patchServiceWorker() {
  const target = 'sw.js';
  let source = read(target);
  source = source.replace(
    /const CACHE_VERSION = '([^']+)'\s*;/,
    (match, version) => `const CACHE_VERSION = '${version}-hardening';`,
  );
  if (!source.includes("-hardening';")) throw new Error(`${target}: cache version not updated`);
  write(target, source);

  replaceOnce(
    target,
    'return cache.addAll(STATIC_ASSETS);',
    `return Promise.allSettled(\n`
      + `      STATIC_ASSETS.map((asset) => cache.add(asset)),\n`
      + `    ).then((results) => {\n`
      + `      const failed = results.filter((result) => result.status === 'rejected').length;\n`
      + `      if (failed) console.warn(\`[SW] Skipped \${failed} unavailable precache asset(s)\`);\n`
      + `    });`,
    'atomic service-worker precache',
  );

  source = read(target);
  const pushMarker = "self.addEventListener('push', function(event) {";
  if (!source.includes('function sanitizeNotificationUrl(')) {
    const markerIndex = source.indexOf(pushMarker);
    if (markerIndex < 0) throw new Error(`${target}: push event marker not found`);
    const helpers = `function sanitizeNotificationUrl(value, { sameOrigin = true } = {}) {\n`
      + `  if (typeof value !== 'string' || !value.trim()) return null;\n`
      + `  try {\n`
      + `    const url = new URL(value, self.location.origin);\n`
      + `    const localHttp = url.protocol === 'http:' && url.origin === self.location.origin;\n`
      + `    if (url.protocol !== 'https:' && !localHttp) return null;\n`
      + `    if (sameOrigin && url.origin !== self.location.origin) return null;\n`
      + `    return url.href;\n`
      + `  } catch {\n`
      + `    return null;\n`
      + `  }\n`
      + `}\n\n`
      + `function parsePushPayload(eventData) {\n`
      + `  const fallback = {\n`
      + `    title: 'Noteworthy News',\n`
      + `    body: 'You have a new update.',\n`
      + `    url: '/',\n`
      + `  };\n`
      + `  if (!eventData) return fallback;\n`
      + `  try {\n`
      + `    const parsed = eventData.json();\n`
      + `    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)\n`
      + `      ? parsed\n`
      + `      : fallback;\n`
      + `  } catch {\n`
      + `    return fallback;\n`
      + `  }\n`
      + `}\n\n`;
    source = source.slice(0, markerIndex) + helpers + source.slice(markerIndex);
    write(target, source);
  }

  replaceVariableStatement(
    target,
    'data',
    (declaration, sourceFile) => declaration.initializer
      && declaration.initializer.getText(sourceFile).includes('event.data.json'),
    '  const data = parsePushPayload(event.data);',
  );

  source = read(target)
    .replace("url: data.url || '/',", "url: sanitizeNotificationUrl(data.url, { sameOrigin: true }) || new URL('/', self.location.origin).href,")
    .replace('mapUrl: data.mapUrl || null,', 'mapUrl: sanitizeNotificationUrl(data.mapUrl, { sameOrigin: false }),')
    .replace("client.url.includes('noteworthynews.co')", 'new URL(client.url).origin === self.location.origin');
  write(target, source);

  replaceVariableStatement(
    target,
    'targetUrl',
    (declaration, sourceFile) => declaration.initializer
      && declaration.initializer.getText(sourceFile).includes('notificationData'),
    `  const targetUrl = action === 'view-map'\n`
      + `    ? sanitizeNotificationUrl(notificationData.mapUrl, { sameOrigin: false })\n`
      + `    : sanitizeNotificationUrl(notificationData.url, { sameOrigin: true });\n`
      + `  if (!targetUrl) return;`,
  );
}

function patchSecurityHeaders() {
  const target = 'netlify.toml';
  let source = read(target);
  if (source.includes('Strict-Transport-Security')) return;
  const headerBlock = /(\[\[headers\]\]\s*\n\s*for\s*=\s*"\/\*"\s*\n\s*\[headers\.values\]\s*\n)/;
  if (!headerBlock.test(source)) throw new Error(`${target}: global headers block not found`);
  source = source.replace(
    headerBlock,
    `$1  Strict-Transport-Security = "max-age=86400"\n  X-Permitted-Cross-Domain-Policies = "none"\n`,
  );
  write(target, source);
}

function patchNewsletterHoneypot() {
  const htmlTarget = 'v2/index.html';
  let html = read(htmlTarget);
  if (!html.includes('id="newsletter-company"')) {
    const inputPattern = /(<input\b[^>]*id="newsletter-email"[^>]*>)/i;
    if (!inputPattern.test(html)) throw new Error(`${htmlTarget}: newsletter email input not found`);
    html = html.replace(
      inputPattern,
      `$1\n              <input id="newsletter-company" name="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden" value="">`,
    );
    write(htmlTarget, html);
  }

  const jsTarget = 'v2/js/main.js';
  let js = read(jsTarget);
  if (!js.includes("const newsletterHoneypot = document.getElementById('newsletter-company');")) {
    replaceOnce(
      jsTarget,
      "const newsletterInput = document.getElementById('newsletter-email');",
      "const newsletterInput = document.getElementById('newsletter-email');\n  const newsletterHoneypot = document.getElementById('newsletter-company');",
      'newsletter input declaration',
    );
  }

  js = read(jsTarget);
  if (!js.includes('newsletterHoneypot ? newsletterHoneypot.value')) {
    const sourceFile = parseSource(jsTarget, js);
    const ranges = [];
    function visit(node) {
      if (ts.isCallExpression(node)
        && node.expression.getText(sourceFile) === 'JSON.stringify'
        && node.arguments.length === 1
        && ts.isObjectLiteralExpression(node.arguments[0])) {
        const object = node.arguments[0];
        const hasEmail = object.properties.some((property) => {
          if (ts.isShorthandPropertyAssignment(property)) return property.name.text === 'email';
          if (ts.isPropertyAssignment(property)) return property.name.getText(sourceFile).replace(/["']/g, '') === 'email';
          return false;
        });
        const withinNewsletter = node.getStart(sourceFile) > js.indexOf("newsletterForm.addEventListener('submit'");
        if (hasEmail && withinNewsletter) {
          ranges.push({
            start: object.end - 1,
            end: object.end - 1,
            replacement: `${object.properties.length ? ',' : ''} company: newsletterHoneypot ? newsletterHoneypot.value : ''`,
          });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (ranges.length !== 1) throw new Error(`${jsTarget}: expected one newsletter JSON body, found ${ranges.length}`);
    applyRanges(jsTarget, ranges);
  }
}

function patchProductionWorkflow() {
  const target = '.github/workflows/production-readiness.yml';
  let source = read(target);
  if (source.includes('Run production hardening unit tests')) return;
  const marker = '      - name: Run static security audit\n';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`${target}: static audit step not found`);
  const step = `      - name: Run production hardening unit tests\n`
    + `        run: node --test scripts/production-audit/hardening.test.js\n\n`;
  source = source.slice(0, index) + step + source.slice(index);
  write(target, source);
}

function validateSyntax() {
  const targets = [
    'admin/js/admin-auth.js',
    'netlify/functions/send-email.js',
    'netlify/functions/push-subscribe.js',
    'netlify/functions/follow-live-story.js',
    'netlify/functions/notification-preferences.js',
    'sw.js',
    'v2/js/main.js',
  ];
  for (const target of targets) {
    const sourceFile = parseSource(target);
    if (sourceFile.parseDiagnostics.length) {
      const message = sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.messageText).join('; ');
      throw new Error(`${target}: syntax validation failed: ${message}`);
    }
  }
}

patchAdminAuth();
patchNewsletter();
patchPushSubscribe();
patchGuardOnlyFunction('netlify/functions/follow-live-story.js', 'follow-live-story', 40, 64 * 1024);
patchGuardOnlyFunction('netlify/functions/notification-preferences.js', 'notification-preferences', 60, 32 * 1024);
patchServiceWorker();
patchSecurityHeaders();
patchNewsletterHoneypot();
patchProductionWorkflow();
validateSyntax();

console.log('Production hardening codemod applied successfully.');
