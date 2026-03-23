#!/usr/bin/env node
/**
 * Build script to inject Auth0 environment variables into index.html
 * Run this before deploying to production
 * 
 * Usage:
 *   AUTH0_DOMAIN=your-domain.auth0.com AUTH0_CLIENT_ID=your-client-id node scripts/inject-auth0.js
 * 
 * Or set environment variables in Netlify and add this to build command
 */

const fs = require('fs');
const path = require('path');

const auth0Domain = process.env.AUTH0_DOMAIN || '';
const auth0ClientId = process.env.AUTH0_CLIENT_ID || '';

const markerStart = '<!-- Auth0 Configuration - Inject environment variables for production -->';
const markerEnd = '<!-- /Auth0 Configuration -->';
const scriptTag = `
  ${markerStart}
    <script>
      window.AUTH0_DOMAIN = ${auth0Domain ? `'${auth0Domain}'` : 'null'};
      window.AUTH0_CLIENT_ID = ${auth0ClientId ? `'${auth0ClientId}'` : 'null'};
    </script>
  ${markerEnd}`;

const targets = [
  path.join(__dirname, '..', 'index.html'),
  path.join(__dirname, '..', 'admin', 'index.html'),
  path.join(__dirname, '..', 'v2', 'index.html'),
  path.join(__dirname, '..', 'profile.html'),
];

let injected = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) continue;

  try {
    let html = fs.readFileSync(filePath, 'utf8');

    const markerBlockPattern = new RegExp(
      `${markerStart.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}[\\s\\S]*?${markerEnd.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}`,
      'g'
    );
    const legacyBlockPattern = /<script>\s*\/\/ Auth0 credentials injected at build time[\s\S]*?window\.AUTH0_CLIENT_ID[\s\S]*?<\/script>/g;

    html = html.replace(markerBlockPattern, '');
    html = html.replace(legacyBlockPattern, '');

    if (html.includes('</head>')) {
      html = html.replace('</head>', `  ${scriptTag}\n</head>`);
    }

    fs.writeFileSync(filePath, html);
    injected++;
    console.log(`✅ Auth0 config injected: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  } catch (error) {
    console.warn(`⚠️  Failed to inject into ${filePath}: ${error.message}`);
  }
}

if (injected === 0) {
  console.warn('⚠️  No HTML files found for Auth0 injection');
}
if (!auth0Domain || !auth0ClientId) {
  console.warn('⚠️  AUTH0_DOMAIN or AUTH0_CLIENT_ID not set — null values injected');
}

