#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'audit-artifacts');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const tracked = execFileSync('git', ['ls-files'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
}).split(/\r?\n/).filter(Boolean);

const TEXT_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.json',
  '.toml', '.yml', '.yaml', '.md', '.txt', '.swift', '.sql', '.xml', '.plist',
  '.pbxproj', '.entitlements', '.sh', '.py',
]);

function readText(file) {
  try {
    const full = path.join(ROOT, file);
    const stat = fs.statSync(full);
    if (stat.size > 5_000_000 || !TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) return '';
    return fs.readFileSync(full, 'utf8');
  } catch {
    return '';
  }
}

function lineOf(text, regex) {
  const match = text.match(regex);
  if (!match || match.index == null) return null;
  return text.slice(0, match.index).split(/\r?\n/).length;
}

function evidence(file, regex, note) {
  const text = readText(file);
  const line = lineOf(text, regex);
  return line ? { file, line, note } : null;
}

const findings = [];
function addFinding(severity, id, title, details, evidenceItems = []) {
  findings.push({
    severity,
    id,
    title,
    details,
    evidence: evidenceItems.filter(Boolean),
  });
}

const functionFiles = tracked.filter((file) => /^netlify\/functions\/[^/]+\.(?:js|ts)$/.test(file));
const mutationMarkers = /(?:httpMethod|method)[^\n]{0,100}(?:POST|PUT|PATCH|DELETE)|\.(?:setJSON|set|delete|deleteAll|insert|upsert|update)\s*\(|resend\.emails\.send|sendNotification\s*\(|new\s+OpenAI\s*\(|openai\./i;
const authMarkers = /requireAdminAuth|requireAdminAuthOrSecret|requireAuth\s*\(|verifyToken\s*\(|isAdminSecretValid|timingSafeEqual|CRON_SECRET|WEBHOOK_SECRET|x-api-key|authorization/i;
const rateLimitMarkers = /rate.?limit|checkRateLimit|enforceRateLimit|turnstile|captcha|honeypot/i;
const publicMutationCandidates = [];
const publicCostWithoutRateLimit = [];
const authenticatedWildcardCors = [];
const mutationWithoutMethodGuard = [];

for (const file of functionFiles) {
  const text = readText(file);
  if (!text) continue;
  const mutatesOrCosts = mutationMarkers.test(text);
  const authenticated = authMarkers.test(text);
  if (mutatesOrCosts && !authenticated) publicMutationCandidates.push(file);
  if (mutatesOrCosts && !authenticated && !rateLimitMarkers.test(text)) publicCostWithoutRateLimit.push(file);
  if (authenticated && /Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(text)) {
    authenticatedWildcardCors.push(file);
  }
  if (mutatesOrCosts && !/(?:httpMethod|method)|schedule|scheduled/i.test(text)) {
    mutationWithoutMethodGuard.push(file);
  }
}

const netlify = readText('netlify.toml');
const omitLine = netlify.match(/SECRETS_SCAN_OMIT_KEYS\s*=\s*"([^"]*)"/);
if (omitLine) {
  const omitted = omitLine[1].split(',').map((value) => value.trim()).filter(Boolean);
  const risky = omitted.filter((name) => /KEY|TOKEN|SECRET|PASSWORD/i.test(name) && name !== 'AUTH0_CLIENT_ID');
  if (risky.length) {
    addFinding(
      'high',
      'SEC-001',
      'Secret scanning suppresses secret-like environment names',
      `Netlify secret scanning is explicitly told to ignore: ${risky.join(', ')}. A real value committed under one of these names could evade the deployment safeguard.`,
      [evidence('netlify.toml', /SECRETS_SCAN_OMIT_KEYS/, 'Secret-scan omission list')],
    );
  }
}

if (!/Strict-Transport-Security/i.test(netlify)) {
  addFinding(
    'medium',
    'SEC-002',
    'HSTS is not configured',
    'HTTPS is expected in production, but browsers are not instructed to remember HTTPS-only access. A conservative max-age without includeSubDomains can be staged safely.',
    [evidence('netlify.toml', /\[\[headers\]\]/, 'Current global header block')],
  );
}

if (!/Content-Security-Policy\s*=/i.test(netlify)) {
  addFinding(
    'high',
    'SEC-003',
    'No enforcing site-wide Content Security Policy',
    'The public SPA stores Auth0 refresh-token material in localStorage and the site has substantial inline/third-party script surface. XSS therefore has an unusually high account-impact radius. A report-only rollout and inline-script migration are prerequisites to enforcement.',
    [
      evidence('netlify.toml', /X-Content-Type-Options/, 'Existing security headers do not include a global CSP'),
      evidence('v2/js/auth.js', /cacheLocation:\s*['"]localstorage['"]/, 'Auth0 session material is persisted in localStorage'),
    ],
  );
}

const authMiddleware = readText('netlify/functions/middleware/requireAuth.js');
if (/BUILTIN_ADMIN_EMAILS/.test(authMiddleware)) {
  addFinding(
    'medium',
    'AUTH-001',
    'Admin identities are hard-coded in public source',
    'Admin allowlisting should be configuration-only so access can be revoked without a deploy and personal identifiers are not permanently embedded in repository history.',
    [evidence('netlify/functions/middleware/requireAuth.js', /BUILTIN_ADMIN_EMAILS/, 'Hard-coded administrator identifiers')],
  );
}

if (/queryStringParameters\?\.token/.test(authMiddleware)) {
  addFinding(
    'high',
    'AUTH-002',
    'Legacy admin secrets are accepted in query strings',
    'Secrets in URLs can leak through browser history, logs, screenshots, analytics, and Referer headers. The compatibility path should accept only an Authorization or dedicated header before it is retired.',
    [evidence('netlify/functions/middleware/requireAuth.js', /queryStringParameters\?\.token/, 'Query-string token transport')],
  );
}

if (/AUTH0_CLIENT_ID[\s\S]{0,700}verifyOptions\.audience/.test(authMiddleware)) {
  addFinding(
    'high',
    'AUTH-003',
    'General API authorization accepts an Auth0 ID-token audience',
    'The verifier accepts the SPA client ID as a general API audience, and the admin client intentionally sends an ID token as its bearer credential. ID tokens establish identity; privileged API calls should use access tokens minted for AUTH0_AUDIENCE and required scopes.',
    [
      evidence('netlify/functions/middleware/requireAuth.js', /AUTH0_CLIENT_ID[\s\S]{0,700}verifyOptions\.audience/, 'Client ID is accepted by the generic verifier'),
      evidence('admin/js/admin-auth.js', /getIdTokenClaims/, 'Admin API bearer token is sourced from ID-token claims'),
    ],
  );
}

const adminAuth = readText('admin/js/admin-auth.js');
if (/res\.status\s*!==\s*403\s*&&\s*res\.status\s*!==\s*401/.test(adminAuth)) {
  addFinding(
    'medium',
    'AUTH-004',
    'Admin UI verification treats server errors as authorization success',
    'The browser considers every response other than 401/403 to mean admin, including 404, 429, and 500. Server endpoints still enforce authorization, but the control panel fails open and can expose a misleading privileged UI during outages.',
    [evidence('admin/js/admin-auth.js', /res\.status\s*!==\s*403/, 'Fail-open admin probe')],
  );
}

const newsletter = readText('netlify/functions/send-email.js');
if (newsletter) {
  if (!rateLimitMarkers.test(newsletter)) {
    addFinding(
      'critical',
      'MAIL-001',
      'Public newsletter endpoint can be used as an email-amplification and cost-abuse proxy',
      'Any origin can submit arbitrary recipient addresses, trigger Resend sends, and cause audience scans without a shared rate limit, bot challenge, or proof of mailbox ownership. This threatens sender reputation and enables harassment.',
      [evidence('netlify/functions/send-email.js', /resend\.emails\.send/, 'Public endpoint sends email to the supplied address')],
    );
  }
  if (/email\.includes\(['"]@['"]\)/.test(newsletter)) {
    addFinding(
      'medium',
      'MAIL-002',
      'Newsletter email validation is structurally weak',
      'Checking only for an @ character allows malformed values and oversized input. Normalize, bound, and validate before any provider call.',
      [evidence('netlify/functions/send-email.js', /email\.includes\(['"]@['"]\)/, 'Current validation')],
    );
  }
  if (/Buffer\.from\(email\)\.toString\(['"]base64['"]\)/.test(newsletter)) {
    addFinding(
      'high',
      'MAIL-003',
      'Unsubscribe identity is only base64-encoded, not authenticated',
      'Base64 is reversible and forgeable. Newsletter preference and unsubscribe links should use a signed, expiring token so one address cannot be altered into another.',
      [evidence('netlify/functions/send-email.js', /Buffer\.from\(email\)\.toString\(['"]base64['"]\)/, 'Unsigned email token')],
    );
  }
  const sendPosition = newsletter.indexOf('const autoReplyResult = await resend.emails.send');
  const contactPosition = newsletter.indexOf('resend.contacts.create');
  if (sendPosition >= 0 && contactPosition >= 0 && sendPosition < contactPosition) {
    addFinding(
      'high',
      'MAIL-004',
      'Welcome email is sent before durable audience enrollment',
      'A provider or rate-limit failure after the welcome send leaves a user told they subscribed when no subscription was stored. Enrollment should complete first, then transactional mail should be sent, with explicit compensation/retry behavior.',
      [
        evidence('netlify/functions/send-email.js', /const autoReplyResult = await resend\.emails\.send/, 'Welcome message sent'),
        evidence('netlify/functions/send-email.js', /resend\.contacts\.create/, 'Audience enrollment happens later'),
      ],
    );
  }
  if (/console\.(?:log|warn|error)\([^\n]{0,160}\bemail\b/.test(newsletter)) {
    addFinding(
      'medium',
      'MAIL-005',
      'Subscriber addresses and inferred names are logged extensively',
      'Production function logs contain newsletter PII and provider details. Use redacted identifiers and structured error codes instead of raw addresses/names.',
      [evidence('netlify/functions/send-email.js', /console\.(?:log|warn|error)\([^\n]{0,160}\bemail\b/, 'PII logging')],
    );
  }
}

const push = readText('netlify/functions/push-subscribe.js');
if (push) {
  if (!rateLimitMarkers.test(push)) {
    addFinding(
      'high',
      'PUSH-001',
      'Push-subscription storage is publicly writable without rate limiting',
      'Attackers can create arbitrary subscription blobs and repeatedly rewrite the global index. Validate browser subscription shape, limit body size, and use a shared rate limiter.',
      [evidence('netlify/functions/push-subscribe.js', /action === ["']subscribe["']/, 'Public subscription mutation')],
    );
  }
  if (/preferences:\s*preferences\s*\|\|/.test(push)) {
    addFinding(
      'high',
      'PUSH-002',
      'Push preferences and userEmail are stored without an allowlist or ownership proof',
      'Arbitrary nested payloads and spoofed email addresses are persisted. Store only known boolean preference keys, bound every field, and derive identity from verified authentication when linking an account.',
      [evidence('netlify/functions/push-subscribe.js', /preferences:\s*preferences\s*\|\|/, 'Unvalidated preference object')],
    );
  }
  if (/store\.get\(INDEX_KEY[\s\S]{0,700}store\.set\(INDEX_KEY/.test(push)) {
    addFinding(
      'high',
      'PUSH-003',
      'Subscription index uses a non-atomic read-modify-write sequence',
      'Concurrent subscribe/unsubscribe requests can overwrite each other and silently lose active subscriptions. Prefer listing prefixed subscription keys or an atomic database/index operation.',
      [evidence('netlify/functions/push-subscribe.js', /store\.get\(INDEX_KEY/, 'Read-modify-write index')],
    );
  }
}

const clientRoots = /^(?:v2|src|js|assets|admin|category|public)\//;
const serverSecretNames = /SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|RESEND_API_KEY|APNS_PRIVATE_KEY|VAPID_PRIVATE_KEY|AWS_SECRET_ACCESS_KEY|NEWSLETTER_KEY|ADMIN_TOKEN|CRON_SECRET/;
const clientSecretReferences = tracked.filter((file) => clientRoots.test(file) && serverSecretNames.test(readText(file)));
if (clientSecretReferences.length) {
  addFinding(
    'critical',
    'SEC-004',
    'Server-only secret names are referenced from client-delivered code',
    'Review these files immediately to ensure no server secret can be bundled or rendered into public output.',
    clientSecretReferences.slice(0, 20).map((file) => ({ file, line: 1, note: 'Client-delivered path references a server secret name' })),
  );
}

const secretSignatures = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['openai-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['resend-key', /\bre_[A-Za-z0-9_-]{20,}\b/],
];
const possibleSecrets = [];
for (const file of tracked) {
  const text = readText(file);
  if (!text) continue;
  for (const [kind, regex] of secretSignatures) {
    const line = lineOf(text, regex);
    if (line) possibleSecrets.push({ kind, file, line });
  }
}
if (possibleSecrets.length) {
  addFinding(
    'critical',
    'SEC-005',
    'Possible committed secret signatures detected',
    'Values are deliberately redacted from this report. Rotate any confirmed credential and purge it from history.',
    possibleSecrets.map((item) => ({ file: item.file, line: item.line, note: item.kind })),
  );
}

const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));

const report = {
  generatedAt: new Date().toISOString(),
  functionCount: functionFiles.length,
  findings,
  heuristicInventories: {
    publicMutationCandidates,
    publicCostWithoutRateLimit,
    authenticatedWildcardCors,
    mutationWithoutMethodGuard,
    clientSecretReferences,
    possibleSecrets,
  },
};

fs.writeFileSync(path.join(OUTPUT_DIR, 'security-analysis.json'), JSON.stringify(report, null, 2));

const lines = [];
lines.push(`Netlify function handlers: ${functionFiles.length}`);
lines.push(`Confirmed/static findings: ${findings.length}`);
for (const finding of findings) {
  lines.push('');
  lines.push(`[${finding.severity.toUpperCase()}] ${finding.id} ${finding.title}`);
  lines.push(finding.details);
  for (const item of finding.evidence) lines.push(`  - ${item.file}:${item.line} — ${item.note}`);
}
lines.push('');
lines.push('Heuristic: mutation/cost candidates without an obvious auth marker (manual review):');
lines.push(...(publicMutationCandidates.length ? publicMutationCandidates : ['none']));
lines.push('');
lines.push('Heuristic: authenticated handlers declaring wildcard CORS locally:');
lines.push(...(authenticatedWildcardCors.length ? authenticatedWildcardCors : ['none']));
lines.push('');
lines.push('Possible committed secret signatures (values redacted):');
lines.push(possibleSecrets.length ? JSON.stringify(possibleSecrets, null, 2) : 'none');
lines.push('');

const textReport = `${lines.join('\n')}\n`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'security-analysis.txt'), textReport);
process.stdout.write(textReport);
