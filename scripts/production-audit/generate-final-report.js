'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const auditDir = path.join(root, 'audit');

function read(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(fullPath));
    else result.push(fullPath);
  }
  return result;
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function gateStatus(name) {
  const raw = process.env[`GATE_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
  if (raw === undefined) return 'not run';
  return Number(raw) === 0 ? 'passed' : `failed (exit ${raw})`;
}

function statusIcon(status) {
  if (status === 'passed') return '✅';
  if (status === 'not run') return '⚪';
  return '❌';
}

function findJsonByName(pattern) {
  return walk(auditDir).filter((file) => pattern.test(path.basename(file))).map((file) => ({ file, value: readJson(file) }));
}

function countSecurityFindings() {
  const candidates = findJsonByName(/security|finding/i);
  for (const candidate of candidates) {
    const findings = Array.isArray(candidate.value)
      ? candidate.value
      : candidate.value && Array.isArray(candidate.value.findings)
        ? candidate.value.findings
        : null;
    if (!findings) continue;
    const counts = {};
    for (const finding of findings) {
      const severity = String(finding.severity || finding.level || 'unknown').toLowerCase();
      counts[severity] = (counts[severity] || 0) + 1;
    }
    return { counts, total: findings.length, file: path.relative(root, candidate.file) };
  }
  return null;
}

function npmAuditSummary() {
  const candidates = findJsonByName(/npm.*audit|audit.*npm/i);
  for (const candidate of candidates) {
    const metadata = candidate.value && candidate.value.metadata;
    if (metadata && metadata.vulnerabilities) {
      return { ...metadata.vulnerabilities, file: path.relative(root, candidate.file) };
    }
  }
  return null;
}

function lighthouseSummaries() {
  const summaries = [];
  for (const candidate of findJsonByName(/lighthouse|lh.*report|report.*lh/i)) {
    const categories = candidate.value && candidate.value.categories;
    if (!categories) continue;
    const score = (name) => categories[name] && Number.isFinite(categories[name].score)
      ? Math.round(categories[name].score * 100)
      : null;
    summaries.push({
      file: path.relative(root, candidate.file),
      performance: score('performance'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
      seo: score('seo'),
    });
  }
  return summaries;
}

function browserSummary() {
  const candidates = findJsonByName(/browser|axe|accessibility/i);
  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const value = candidate.value;
    const pages = Array.isArray(value.pages) ? value.pages
      : Array.isArray(value.results) ? value.results
        : Array.isArray(value) ? value
          : null;
    if (!pages) continue;
    let violations = 0;
    let consoleErrors = 0;
    let failedChecks = 0;
    for (const page of pages) {
      const axe = page.axe || page.accessibility || page;
      const pageViolations = axe && Array.isArray(axe.violations) ? axe.violations.length : 0;
      violations += pageViolations;
      consoleErrors += Array.isArray(page.consoleErrors) ? page.consoleErrors.length : 0;
      if (page.ok === false || page.passed === false) failedChecks += 1;
    }
    return {
      file: path.relative(root, candidate.file),
      pages: pages.length,
      violations,
      consoleErrors,
      failedChecks,
    };
  }
  return null;
}

const gates = [
  ['locked install', gateStatus('npm_ci')],
  ['production dependency audit', gateStatus('npm_audit')],
  ['production build', gateStatus('build')],
  ['TypeScript check', gateStatus('typecheck')],
  ['focused hardening tests', gateStatus('hardening_tests')],
  ['existing repository checks', gateStatus('repository_checks')],
  ['static security audit', gateStatus('security_audit')],
  ['mobile and desktop browser audit', gateStatus('browser_audit')],
  ['mobile Lighthouse', gateStatus('lighthouse_mobile')],
  ['desktop Lighthouse', gateStatus('lighthouse_desktop')],
];

const files = walk(auditDir).map((file) => path.relative(root, file)).sort();
const security = countSecurityFindings();
const npmAudit = npmAuditSummary();
const lighthouse = lighthouseSummaries();
const browser = browserSummary();

const codeEvidence = [
  ['Admin server probe fails closed', read('admin/js/admin-auth.js').includes('return res.ok;')],
  ['Newsletter mutation guard is installed', read('netlify/functions/send-email.js').includes("scope: 'newsletter-signup'")],
  ['Newsletter input is normalized centrally', read('netlify/functions/send-email.js').includes('normalizeEmail(parsedBody.email)')],
  ['Newsletter bot honeypot is wired end to end', read('v2/index.html').includes('newsletter-company') && read('v2/js/main.js').includes('newsletterHoneypot')],
  ['Push subscriptions are schema-normalized', read('netlify/functions/push-subscribe.js').includes('sanitizePushSubscription') && read('netlify/functions/push-subscribe.js').includes('normalizedSubscription')],
  ['Public push and live-story writes are rate guarded', read('netlify/functions/push-subscribe.js').includes('enforcePublicRateLimit') && read('netlify/functions/follow-live-story.js').includes('enforcePublicRateLimit')],
  ['Service-worker precache tolerates individual stale assets', read('sw.js').includes('Promise.allSettled')],
  ['Notification navigation is protocol/origin sanitized', read('sw.js').includes('sanitizeNotificationUrl')],
  ['Staged HSTS is enabled', read('netlify.toml').includes('Strict-Transport-Security')],
];

const unresolved = [];
const requireAuth = read('netlify/functions/middleware/requireAuth.js');
const adminAuth = read('admin/js/admin-auth.js');
const sendEmail = read('netlify/functions/send-email.js');
const pushSubscribe = read('netlify/functions/push-subscribe.js');
const followLiveStory = read('netlify/functions/follow-live-story.js');
const netlifyToml = read('netlify.toml');

if (/AUTH0_CLIENT_ID/.test(requireAuth) && /audience/i.test(requireAuth)) {
  unresolved.push('Auth0 still contains an ID-token compatibility audience. Moving admin APIs to a dedicated access-token audience requires a coordinated Auth0 tenant and client configuration change.');
}
if (/getIdTokenClaims|getIdToken|id token/i.test(adminAuth)) {
  unresolved.push('The admin client still obtains an ID token for API calls. The server now fails closed at the UI probe, but a dedicated Auth0 API audience remains the correct long-term trust boundary.');
}
if (/TODO[^\n]*double opt|double opt-in[^\n]*not implemented/i.test(sendEmail)) {
  unresolved.push('Newsletter double opt-in remains unimplemented; abuse controls reduce cost exposure but do not prove mailbox ownership.');
}
if (/Buffer\.from\(email\).*base64|toString\(['"]base64['"]\)/s.test(sendEmail) && !/createHmac|signed.*token/i.test(sendEmail)) {
  unresolved.push('Newsletter unsubscribe/preferences identity is still encoded rather than cryptographically signed. Existing links require a backward-compatible token migration.');
}
if (/subscriptions-index|read.*index|index.*set/s.test(pushSubscribe) || /followers-index|index.*set/s.test(followLiveStory)) {
  unresolved.push('Blob-backed secondary indexes still use read-modify-write updates and can lose concurrent writes. Replace them with an atomic datastore/index before high-volume fan-out.');
}
if (!/Content-Security-Policy\s*=/.test(netlifyToml)) {
  unresolved.push('No enforcing Content Security Policy is deployed. A report-only inventory and staged nonce/hash migration are still required because the site contains inline and third-party scripts.');
}
unresolved.push('Production provider behavior, real Auth0 redirects, Supabase service-role calls, Resend delivery, APNs/Web Push delivery, and deployed secret values cannot be exercised safely in pull-request CI.');

const hardGateFailure = gates.some(([, status]) => status.startsWith('failed'));
const missingEvidence = codeEvidence.some(([, present]) => !present);
const overall = hardGateFailure || missingEvidence
  ? 'NOT READY — at least one executable gate or required hardening marker failed.'
  : unresolved.length
    ? 'CODE GATES PASSED WITH EXTERNAL/ARCHITECTURAL BLOCKERS — do not merge as fully production-ready until the blockers below are accepted or resolved.'
    : 'READY — executable gates and required hardening checks passed.';

const changedFiles = git('diff', '--name-only', 'origin/main...HEAD').split('\n').filter(Boolean);
const commit = git('rev-parse', 'HEAD');
const generatedAt = new Date().toISOString();

let markdown = `# Noteworthy News production-readiness audit\n\n`;
markdown += `Generated: ${generatedAt}  \n`;
markdown += `Commit: \`${commit || 'unknown'}\`  \n`;
markdown += `Overall: **${overall}**\n\n`;
markdown += `## Executable gates\n\n`;
for (const [name, status] of gates) markdown += `- ${statusIcon(status)} **${name}:** ${status}\n`;

markdown += `\n## Confirmed hardening evidence\n\n`;
for (const [description, present] of codeEvidence) markdown += `- ${present ? '✅' : '❌'} ${description}\n`;

markdown += `\n## Automated findings\n\n`;
if (npmAudit) markdown += `- Production dependency audit: ${JSON.stringify(npmAudit)}\n`;
else markdown += `- Production dependency audit summary: unavailable; inspect the gate log.\n`;
if (security) markdown += `- Static security findings: ${security.total} total (${JSON.stringify(security.counts)}) in \`${security.file}\`. Heuristic findings require manual triage.\n`;
else markdown += `- Static security findings summary: no parseable report was found.\n`;
if (browser) markdown += `- Browser/accessibility report: ${browser.pages} page profiles, ${browser.violations} axe violation groups, ${browser.consoleErrors} console errors, ${browser.failedChecks} failed checks in \`${browser.file}\`.\n`;
else markdown += `- Browser/accessibility summary: no parseable report was found.\n`;
if (lighthouse.length) {
  for (const result of lighthouse) {
    markdown += `- Lighthouse \`${result.file}\`: performance ${result.performance}, accessibility ${result.accessibility}, best practices ${result.bestPractices}, SEO ${result.seo}.\n`;
  }
} else markdown += `- Lighthouse summary: no parseable reports were found.\n`;

markdown += `\n## Remaining blockers and uncertainties\n\n`;
for (const item of unresolved) markdown += `- ${item}\n`;

markdown += `\n## Changed production surface\n\n`;
for (const file of changedFiles) markdown += `- \`${file}\`\n`;

markdown += `\n## Audit artifacts\n\n`;
if (files.length) for (const file of files) markdown += `- \`${file}\`\n`;
else markdown += `- No audit artifacts were retained in the workspace.\n`;

markdown += `\n## Merge rule\n\n`;
markdown += `Merge only after every executable gate above passes, the Netlify deploy preview is reviewed on a real mobile device, and the external Auth0/Resend/Supabase/Web Push smoke tests are completed with non-production test accounts.\n`;

fs.writeFileSync(path.join(root, 'PRODUCTION_AUDIT.md'), markdown);
console.log(markdown);

if (hardGateFailure || missingEvidence) process.exitCode = 1;
