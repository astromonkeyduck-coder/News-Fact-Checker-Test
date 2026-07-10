'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const write = (relativePath, value) => fs.writeFileSync(path.join(root, relativePath), value);

const functions = [
  'netlify/functions/send-email.js',
  'netlify/functions/push-subscribe.js',
  'netlify/functions/follow-live-story.js',
  'netlify/functions/notification-preferences.js',
];

const alreadyApplied = functions.every((file) => read(file).includes('getPublicCorsHeaders'))
  && !/queryStringParameters[\s\S]{0,120}token/.test(read('netlify/functions/middleware/requireAuth.js'));

if (alreadyApplied) {
  console.log('Phase-two hardening is already applied; recovery is a no-op.');
  process.exit(0);
}

let phase2 = read('scripts/production-audit/apply-phase2-hardening.js');
phase2 = phase2.replace(
  "  if (!wildcard.test(source)) {\n    throw new Error(`${relativePath}: wildcard CORS header not found`);\n  }\n  source = source.replace(wildcard, '...getPublicCorsHeaders(event),');",
  "  if (!wildcard.test(source)) {\n    console.log(`[Phase2] ${relativePath}: no wildcard CORS header remained; retaining existing explicit policy.`);\n    return;\n  }\n  source = source.replace(wildcard, '...getPublicCorsHeaders(event),');",
);
write('scripts/production-audit/apply-phase2-hardening.js', phase2);
require(path.join(__dirname, 'apply-phase2-hardening.js'));
