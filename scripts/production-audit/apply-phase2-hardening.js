'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const absolute = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(absolute(relativePath), 'utf8');
const write = (relativePath, value) => fs.writeFileSync(absolute(relativePath), value.replace(/\r\n/g, '\n'));

function parse(relativePath, source = read(relativePath)) {
  return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

function addRequire(relativePath, line) {
  let source = read(relativePath);
  if (source.includes(line)) return;
  const sourceFile = parse(relativePath, source);
  const imports = sourceFile.statements.filter((statement) => (
    ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some((declaration) => (
      declaration.initializer
      && ts.isCallExpression(declaration.initializer)
      && declaration.initializer.expression.getText(sourceFile) === 'require'
    ))
  ));
  const position = imports.length ? imports[imports.length - 1].end : 0;
  source = source.slice(0, position) + `\n${line}` + source.slice(position);
  write(relativePath, source);
}

function patchCors(relativePath) {
  addRequire(relativePath, "const { getPublicCorsHeaders } = require('./lib/publicCors');");
  let source = read(relativePath);
  if (source.includes('...getPublicCorsHeaders(event)')) return;
  const wildcard = /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']\s*,?/;
  if (!wildcard.test(source)) {
    throw new Error(`${relativePath}: wildcard CORS header not found`);
  }
  source = source.replace(wildcard, '...getPublicCorsHeaders(event),');
  write(relativePath, source);
}

function removeQueryBearerFallback() {
  const target = 'netlify/functions/middleware/requireAuth.js';
  let source = read(target);
  const patterns = [
    /\s*\|\|\s*event\.queryStringParameters\?\.token/g,
    /\s*\|\|\s*event\.queryStringParameters\.token/g,
    /\s*\|\|\s*\(event\.queryStringParameters\s*&&\s*event\.queryStringParameters\.token\)/g,
    /\s*\|\|\s*event\.queryStringParameters\?\[\s*["']token["']\s*\]/g,
  ];
  const original = source;
  for (const pattern of patterns) source = source.replace(pattern, '');
  if (source === original) {
    if (/queryStringParameters[\s\S]{0,120}token/.test(source)) {
      throw new Error(`${target}: unrecognized query-string bearer token fallback`);
    }
    return;
  }
  write(target, source);
}

function narrowSecretScanOmissions() {
  const target = 'netlify.toml';
  let source = read(target);
  const pattern = /(SECRETS_SCAN_OMIT_KEYS\s*=\s*)(["'])([^"']*)(\2)/;
  const match = source.match(pattern);
  if (!match) return;

  const keys = match[3].split(',').map((key) => key.trim()).filter(Boolean);
  const safePublicKey = /(?:PUBLIC|CLIENT_ID|ANON_KEY|DOMAIN|SITE_ID|URL|DSN)/i;
  const secretLike = /(?:SECRET|SERVICE_ROLE|PRIVATE|API_KEY|READ_WRITE_TOKEN|PASSWORD|PUSH_API_KEY|APNS)/i;
  const kept = keys.filter((key) => !secretLike.test(key) || safePublicKey.test(key));
  const removed = keys.filter((key) => !kept.includes(key));
  if (!removed.length) return;

  console.log(`[Phase2] Removed ${removed.length} secret-like key(s) from Netlify secret-scan omissions.`);
  if (kept.length) {
    source = source.replace(pattern, `${match[1]}${match[2]}${kept.join(',')}${match[2]}`);
  } else {
    source = source.replace(new RegExp(`^.*SECRETS_SCAN_OMIT_KEYS.*(?:\\n|$)`, 'm'), '');
  }
  write(target, source);
}

function suppressUnneededPreferenceEmailDisclosure() {
  const functionPath = 'netlify/functions/notification-preferences.js';
  const consumerRoots = ['v2', 'admin', 'app', 'ios', 'src'].filter((directory) => fs.existsSync(absolute(directory)));
  const consumers = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:js|ts|tsx|html)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes('notification-preferences') && /\buserEmail\b/.test(text)) consumers.push(full);
      }
    }
  }
  for (const directory of consumerRoots) walk(absolute(directory));
  if (consumers.length) {
    console.log(`[Phase2] Preserved preference email response because ${consumers.length} client consumer(s) reference it.`);
    return;
  }

  let source = read(functionPath);
  const patterns = [
    /userEmail\s*:\s*(?:record|data|subscription|existing|preferences)\.userEmail/g,
    /userEmail\s*:\s*storedData\.userEmail/g,
  ];
  const original = source;
  for (const pattern of patterns) source = source.replace(pattern, 'userEmail: undefined');
  if (source !== original) write(functionPath, source);
}

function extendHardeningTests() {
  const target = 'scripts/production-audit/hardening.test.js';
  let source = read(target);
  if (source.includes("require('../../netlify/functions/lib/publicCors')")) return;
  source = source.replace(
    "const {\n  isDisallowedBrowserOrigin,\n} = require('../../netlify/functions/lib/publicMutationGuard');",
    "const {\n  isDisallowedBrowserOrigin,\n} = require('../../netlify/functions/lib/publicMutationGuard');\nconst { getPublicCorsHeaders } = require('../../netlify/functions/lib/publicCors');",
  );
  source += `\n\ntest('public CORS headers never return a wildcard origin', () => {\n`
    + `  const previousUrl = process.env.URL;\n`
    + `  process.env.URL = 'https://noteworthynews.co';\n`
    + `  const owned = getPublicCorsHeaders(event({ origin: 'https://noteworthynews.co' }));\n`
    + `  const foreign = getPublicCorsHeaders(event({ origin: 'https://attacker.example' }));\n`
    + `  assert.equal(owned['Access-Control-Allow-Origin'], 'https://noteworthynews.co');\n`
    + `  assert.equal(foreign['Access-Control-Allow-Origin'], 'https://noteworthynews.co');\n`
    + `  assert.notEqual(owned['Access-Control-Allow-Origin'], '*');\n`
    + `  if (previousUrl === undefined) delete process.env.URL;\n`
    + `  else process.env.URL = previousUrl;\n`
    + `});\n`;
  write(target, source);
}

function validateSyntax(relativePaths) {
  for (const relativePath of relativePaths) {
    const sourceFile = parse(relativePath);
    if (sourceFile.parseDiagnostics.length) {
      throw new Error(`${relativePath}: ${sourceFile.parseDiagnostics.map((item) => item.messageText).join('; ')}`);
    }
  }
}

let corsModule = read('netlify/functions/lib/publicCors.js');
corsModule = corsModule.replace(/^' strict';/, "'use strict';");
write('netlify/functions/lib/publicCors.js', corsModule);

for (const functionPath of [
  'netlify/functions/send-email.js',
  'netlify/functions/push-subscribe.js',
  'netlify/functions/follow-live-story.js',
  'netlify/functions/notification-preferences.js',
]) patchCors(functionPath);

removeQueryBearerFallback();
narrowSecretScanOmissions();
suppressUnneededPreferenceEmailDisclosure();
extendHardeningTests();
validateSyntax([
  'netlify/functions/lib/publicCors.js',
  'netlify/functions/send-email.js',
  'netlify/functions/push-subscribe.js',
  'netlify/functions/follow-live-story.js',
  'netlify/functions/notification-preferences.js',
  'netlify/functions/middleware/requireAuth.js',
]);

console.log('Phase-two production hardening applied successfully.');
