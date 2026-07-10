'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
};

const report = read('PRODUCTION_AUDIT.md');
const overallMatch = report.match(/Overall:\s*\*\*([^*]+)\*\*/);
const overall = overallMatch ? overallMatch[1].trim() : 'AUDIT REPORT NOT YET AVAILABLE';
const gateSection = report.match(/## Executable gates\n\n([\s\S]*?)(?=\n## )/);
const blockerSection = report.match(/## Remaining blockers and uncertainties\n\n([\s\S]*?)(?=\n## )/);

const sourceChecks = [
  ['Admin verification fails closed', read('admin/js/admin-auth.js').includes('return res.ok;')],
  ['Newsletter abuse guard and strict validation', read('netlify/functions/send-email.js').includes("scope: 'newsletter-signup'") && read('netlify/functions/send-email.js').includes('normalizeEmail')],
  ['Push subscription schema validation', read('netlify/functions/push-subscribe.js').includes('sanitizePushSubscription')],
  ['Owned-origin CORS on public mutations', ['send-email.js', 'push-subscribe.js', 'follow-live-story.js', 'notification-preferences.js'].every((name) => read(`netlify/functions/${name}`).includes('getPublicCorsHeaders'))],
  ['Bearer query-string fallback removed', !/queryStringParameters[\s\S]{0,120}token/.test(read('netlify/functions/middleware/requireAuth.js'))],
  ['Service-worker cache and navigation hardening', read('sw.js').includes('Promise.allSettled') && read('sw.js').includes('sanitizeNotificationUrl')],
  ['Staged HSTS header', read('netlify.toml').includes('Strict-Transport-Security')],
  ['Secret-scanner exemptions narrowed', (() => {
    const config = read('netlify.toml');
    const match = config.match(/SECRETS_SCAN_OMIT_KEYS\s*=\s*["']([^"']*)["']/);
    return !match || !/(?:SECRET|SERVICE_ROLE|PRIVATE|API_KEY|READ_WRITE_TOKEN|PASSWORD|APNS)/i.test(match[1].replace(/PUBLIC|CLIENT_ID|ANON_KEY|DOMAIN|SITE_ID|URL|DSN/gi, ''));
  })()],
];

let body = `# Noteworthy News production hardening\n\n`;
body += `**Automated status:** ${overall}\n\n`;
body += `This draft PR contains the production-readiness harness, targeted fixes, regression coverage, and a generated evidence report. It intentionally preserves the existing visual design.\n\n`;
body += `## Verified source controls\n\n`;
for (const [label, passed] of sourceChecks) body += `- ${passed ? '✅' : '❌'} ${label}\n`;
body += `\n## Executable gates\n\n${gateSection ? gateSection[1].trim() : '- Report unavailable; inspect the latest workflow run.'}\n`;
body += `\n## Remaining blockers\n\n${blockerSection ? blockerSection[1].trim() : '- Report unavailable; do not merge.'}\n`;
body += `\n## Review rule\n\nKeep this PR in draft until every executable gate passes and the Auth0, Resend, Supabase, APNs/Web Push, and Netlify environment smoke tests are completed with test credentials. The full evidence is in \`PRODUCTION_AUDIT.md\` and the workflow artifact.\n`;

const output = process.argv[2] || '/tmp/noteworthy-pr-body.md';
fs.writeFileSync(output, body);
console.log(body);
