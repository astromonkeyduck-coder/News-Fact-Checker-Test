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

require('./generate-final-report');

const functions = [
  'netlify/functions/send-email.js',
  'netlify/functions/push-subscribe.js',
  'netlify/functions/follow-live-story.js',
  'netlify/functions/notification-preferences.js',
];
const phaseTwoEvidence = [
  ['Anonymous mutation functions use an owned-origin CORS policy', functions.every((file) => read(file).includes('getPublicCorsHeaders'))],
  ['Anonymous mutation functions no longer return wildcard CORS', functions.every((file) => !/Access-Control-Allow-Origin["']?\s*:\s*["']\*/.test(read(file)))],
  ['Bearer tokens are not accepted from query strings', !/queryStringParameters[\s\S]{0,120}token/.test(read('netlify/functions/middleware/requireAuth.js'))],
  ['Netlify secret-scan omissions exclude secret-like credentials', (() => {
    const config = read('netlify.toml');
    const match = config.match(/SECRETS_SCAN_OMIT_KEYS\s*=\s*["']([^"']*)["']/);
    if (!match) return true;
    return !/(?:SECRET|SERVICE_ROLE|PRIVATE|API_KEY|READ_WRITE_TOKEN|PASSWORD|PUSH_API_KEY|APNS)/i.test(match[1].replace(/PUBLIC|CLIENT_ID|ANON_KEY|DOMAIN|SITE_ID|URL|DSN/gi, ''));
  })()],
  ['Public CORS responses include no-store and nosniff protections', read('netlify/functions/lib/publicCors.js').includes("'Cache-Control': 'no-store'") && read('netlify/functions/lib/publicCors.js').includes("'X-Content-Type-Options': 'nosniff'")],
];

const reportPath = path.join(root, 'PRODUCTION_AUDIT.md');
let report = read('PRODUCTION_AUDIT.md');
const insertion = `\n## Phase-two trust-boundary evidence\n\n${phaseTwoEvidence.map(([label, passed]) => `- ${passed ? '✅' : '❌'} ${label}`).join('\n')}\n`;
const marker = '\n## Remaining blockers and uncertainties\n';
if (report.includes(marker)) report = report.replace(marker, `${insertion}${marker}`);
else report += insertion;
fs.writeFileSync(reportPath, report);

if (phaseTwoEvidence.some(([, passed]) => !passed)) process.exitCode = 1;
console.log(insertion);
