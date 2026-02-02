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

const indexPath = path.join(__dirname, '..', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.warn('⚠️  index.html not found at:', indexPath);
  console.warn('   Skipping Auth0 injection (this is OK for GitHub Pages)');
  process.exit(0); // Exit gracefully instead of failing
}

// Get environment variables (declare outside try for logging)
const auth0Domain = process.env.AUTH0_DOMAIN || '';
const auth0ClientId = process.env.AUTH0_CLIENT_ID || '';

try {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Create script tag with injected values (wrapped in stable markers)
  const markerStart = '<!-- Auth0 Configuration - Inject environment variables for production -->';
  const markerEnd = '<!-- /Auth0 Configuration -->';
  const scriptTag = `
  ${markerStart}
    <script>
      // Auth0 credentials injected at build time
      window.AUTH0_DOMAIN = ${auth0Domain ? `'${auth0Domain}'` : 'null'};
      window.AUTH0_CLIENT_ID = ${auth0ClientId ? `'${auth0ClientId}'` : 'null'};
      ${auth0Domain && auth0ClientId ? 'console.log("[Auth0] Production credentials loaded");' : ''}
    </script>
  ${markerEnd}`;

  // Remove any existing Auth0 injection blocks (including legacy duplicates)
  const markerBlockPattern = new RegExp(
    `${markerStart}[\\s\\S]*?${markerEnd}`,
    'g'
  );
  const legacyBlockPattern = /<script>\s*\/\/ Auth0 credentials injected at build time[\s\S]*?window\.AUTH0_CLIENT_ID[\s\S]*?<\/script>/g;

  html = html.replace(markerBlockPattern, '');
  html = html.replace(legacyBlockPattern, '');

  // Insert single block before closing head
  if (html.includes('</head>')) {
    html = html.replace('</head>', `  ${scriptTag}\n</head>`);
  } else {
    console.warn('⚠️  Could not find </head> tag, appending Auth0 config to end of file');
    html = `${html}\n${scriptTag}\n`;
  }

  fs.writeFileSync(indexPath, html);
  
  // Log success/failure
  if (auth0Domain && auth0ClientId) {
    console.log('✅ Auth0 production credentials injected successfully');
    console.log(`   Domain: ${auth0Domain.substring(0, 20)}...`);
    console.log(`   Client ID: ${auth0ClientId.substring(0, 10)}...`);
  } else {
    console.warn('⚠️  No Auth0 environment variables found');
    console.warn('   Using development credentials (will show warning in Auth0 dashboard)');
    console.warn('   Set AUTH0_DOMAIN and AUTH0_CLIENT_ID environment variables for production');
  }
} catch (error) {
  console.warn('⚠️  Error during Auth0 injection:', error.message);
  console.warn('   Continuing build without injection (this is OK for GitHub Pages)');
  // Still log whether env vars were present
  if (auth0Domain && auth0ClientId) {
    console.warn('   Note: Environment variables were set but injection failed');
  }
  process.exit(0); // Exit gracefully, don't fail the build
}

