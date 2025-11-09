#!/usr/bin/env node

/**
 * Validate game embeds in games.json
 * 
 * Checks:
 * - All required fields are present
 * - URLs respond with 200 (for external URLs)
 * - External URLs are whitelisted (optional)
 * 
 * Usage: node scripts/validate-game-embeds.js [--whitelist domain1.com,domain2.com]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const gamesJsonPath = path.join(__dirname, '..', 'games.json');
const whitelistDomains = process.argv
  .find(arg => arg.startsWith('--whitelist'))
  ?.split('=')[1]
  ?.split(',') || [];

function validateGame(game, index) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!game.id) errors.push(`Game ${index}: missing 'id'`);
  if (!game.title) errors.push(`Game ${index}: missing 'title'`);
  if (!game.category) errors.push(`Game ${index}: missing 'category'`);
  if (!game.src) errors.push(`Game ${index}: missing 'src'`);
  if (game.approved === undefined) errors.push(`Game ${index}: missing 'approved' field`);

  // Validate src
  if (game.src) {
    if (game.src.startsWith('http://') || game.src.startsWith('https://')) {
      // External URL
      if (!game.approved) {
        warnings.push(`Game ${index} (${game.id}): External URL not approved`);
      }

      // Check whitelist if provided
      if (whitelistDomains.length > 0) {
        const url = new URL(game.src);
        const domain = url.hostname;
        const isWhitelisted = whitelistDomains.some(w => domain.includes(w));
        if (!isWhitelisted) {
          warnings.push(`Game ${index} (${game.id}): Domain ${domain} not in whitelist`);
        }
      }
    } else if (game.src.startsWith('/')) {
      // Local path - check if file exists (optional)
      const localPath = path.join(__dirname, '..', 'public', game.src);
      if (!fs.existsSync(localPath)) {
        warnings.push(`Game ${index} (${game.id}): Local file not found: ${game.src}`);
      }
    }
  }

  return { errors, warnings };
}

async function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 5000 }, (res) => {
      resolve({ status: res.statusCode, ok: res.statusCode === 200 });
    });

    req.on('error', () => {
      resolve({ status: null, ok: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: null, ok: false });
    });
  });
}

async function validateAll() {
  console.log('Validating games.json...\n');

  if (!fs.existsSync(gamesJsonPath)) {
    console.error('❌ games.json not found at:', gamesJsonPath);
    process.exit(1);
  }

  let games;
  try {
    const content = fs.readFileSync(gamesJsonPath, 'utf8');
    games = JSON.parse(content);
  } catch (err) {
    console.error('❌ Failed to parse games.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(games)) {
    console.error('❌ games.json must be an array');
    process.exit(1);
  }

  const allErrors = [];
  const allWarnings = [];

  // Validate structure
  games.forEach((game, index) => {
    const { errors, warnings } = validateGame(game, index);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  });

  // Check external URLs (optional, can be slow)
  if (process.argv.includes('--check-urls')) {
    console.log('Checking external URLs...\n');
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      if (game.src && (game.src.startsWith('http://') || game.src.startsWith('https://'))) {
        console.log(`Checking ${game.id}...`);
        const result = await checkUrl(game.src);
        if (!result.ok) {
          allWarnings.push(`Game ${i} (${game.id}): URL ${game.src} returned status ${result.status || 'timeout/error'}`);
        }
      }
    }
  }

  // Report results
  console.log('\n=== Validation Results ===\n');

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log('✅ All games are valid!\n');
    process.exit(0);
  }

  if (allErrors.length > 0) {
    console.log('❌ Errors (must fix):');
    allErrors.forEach(err => console.log(`  - ${err}`));
    console.log('');
  }

  if (allWarnings.length > 0) {
    console.log('⚠️  Warnings:');
    allWarnings.forEach(warn => console.log(`  - ${warn}`));
    console.log('');
  }

  process.exit(allErrors.length > 0 ? 1 : 0);
}

validateAll().catch(err => {
  console.error('❌ Validation failed:', err);
  process.exit(1);
});

