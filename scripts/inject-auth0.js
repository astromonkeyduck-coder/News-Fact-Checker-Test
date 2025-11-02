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
  console.error('❌ index.html not found at:', indexPath);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// Get environment variables
const auth0Domain = process.env.AUTH0_DOMAIN || '';
const auth0ClientId = process.env.AUTH0_CLIENT_ID || '';

// Create script tag with injected values
const scriptTag = `
    <script>
      // Auth0 credentials injected at build time
      window.AUTH0_DOMAIN = ${auth0Domain ? `'${auth0Domain}'` : 'null'};
      window.AUTH0_CLIENT_ID = ${auth0ClientId ? `'${auth0ClientId}'` : 'null'};
      ${auth0Domain && auth0ClientId ? 'console.log("[Auth0] Production credentials loaded");' : ''}
    </script>`;

// Find and replace the placeholder script
const placeholderPattern = /<!-- Auth0 Configuration - Inject environment variables for production -->[\s\S]*?<script>[\s\S]*?window\.AUTH0_DOMAIN = window\.AUTH0_DOMAIN \|\| null;[\s\S]*?<\/script>/;

if (placeholderPattern.test(html)) {
  html = html.replace(
    placeholderPattern,
    `<!-- Auth0 Configuration - Inject environment variables for production -->${scriptTag}`
  );
} else {
  // Fallback: insert before Auth0 SPA SDK comment
  const insertPoint = html.indexOf('<!-- Auth0 SPA SDK -->');
  if (insertPoint !== -1) {
    html = html.slice(0, insertPoint) + 
           `<!-- Auth0 Configuration - Inject environment variables for production -->${scriptTag}\n    ` +
           html.slice(insertPoint);
  } else {
    console.warn('⚠️  Could not find injection point, adding to head');
    html = html.replace('</head>', `  ${scriptTag}\n</head>`);
  }
}

fs.writeFileSync(indexPath, html);

if (auth0Domain && auth0ClientId) {
  console.log('✅ Auth0 production credentials injected successfully');
  console.log(`   Domain: ${auth0Domain.substring(0, 20)}...`);
  console.log(`   Client ID: ${auth0ClientId.substring(0, 10)}...`);
} else {
  console.warn('⚠️  No Auth0 environment variables found');
  console.warn('   Using development credentials (will show warning in Auth0 dashboard)');
  console.warn('   Set AUTH0_DOMAIN and AUTH0_CLIENT_ID environment variables for production');
}

