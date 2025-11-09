#!/usr/bin/env node

/**
 * Safely add a game to the gallery with security checks
 * 
 * Usage:
 *   node scripts/safe-add-game.js <source-path> <game-slug> <game-title> [category]
 * 
 * Example:
 *   node scripts/safe-add-game.js /tmp/nativelite/games/hexgl hexgl "HexGL" Driving
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourcePath = process.argv[2];
const gameSlug = process.argv[3];
const gameTitle = process.argv[4];
const category = process.argv[5] || 'Puzzle';

if (!sourcePath || !gameSlug || !gameTitle) {
  console.error('Usage: node safe-add-game.js <source-path> <game-slug> <game-title> [category]');
  console.error('');
  console.error('Example:');
  console.error('  node safe-add-game.js /tmp/nativelite/games/hexgl hexgl "HexGL" Driving');
  process.exit(1);
}

const projectRoot = path.join(__dirname, '..');
const gamesDir = path.join(projectRoot, 'public', 'games');
const targetGameDir = path.join(gamesDir, gameSlug);
const gamesJsonPath = path.join(projectRoot, 'games.json');
const securityAuditScript = path.join(__dirname, 'security-audit-game.js');

console.log('🔒 Safe Game Addition Process\n');
console.log('=' .repeat(50));
console.log(`Source: ${sourcePath}`);
console.log(`Target: ${targetGameDir}`);
console.log(`Game: ${gameTitle} (${gameSlug})`);
console.log(`Category: ${category}`);
console.log('=' .repeat(50) + '\n');

// Step 1: Verify source exists
if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Source path not found: ${sourcePath}`);
  process.exit(1);
}

// Step 2: Create temporary directory for security audit
const tempDir = path.join(projectRoot, 'temp-game-audit', gameSlug);
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

console.log('📦 Step 1: Copying files to temporary directory...');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(sourcePath, tempDir);
console.log('✅ Files copied to temporary directory\n');

// Step 3: Run security audit
console.log('🔍 Step 2: Running security audit...');
console.log('');

try {
  execSync(`node "${securityAuditScript}" "${tempDir}"`, {
    stdio: 'inherit',
    cwd: projectRoot,
  });
  console.log('\n✅ Security audit passed!\n');
} catch (error) {
  console.error('\n❌ Security audit failed!');
  console.error('   The game contains security issues and cannot be added.');
  console.error('   Review the audit output above for details.\n');
  
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
}

// Step 4: Copy to final destination
console.log('📋 Step 3: Copying to games directory...');
if (fs.existsSync(targetGameDir)) {
  console.log(`⚠️  Target directory exists. Backing up...`);
  const backupDir = `${targetGameDir}.backup.${Date.now()}`;
  fs.renameSync(targetGameDir, backupDir);
  console.log(`   Backup created: ${backupDir}`);
}

fs.mkdirSync(targetGameDir, { recursive: true });
copyRecursive(tempDir, targetGameDir);
console.log('✅ Game files copied to games directory\n');

// Step 5: Verify index.html exists
const indexHtml = path.join(targetGameDir, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.warn('⚠️  index.html not found. Creating placeholder...');
  const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gameTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: white;
            text-align: center;
            padding: 2rem;
        }
        .placeholder h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        .placeholder p { font-size: 1.1rem; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="placeholder">
        <h1>🎮 ${gameTitle}</h1>
        <p>Game files have been added. Replace this placeholder with the actual game HTML.</p>
    </div>
</body>
</html>`;
  fs.writeFileSync(indexHtml, placeholderHtml);
  console.log('✅ Created placeholder index.html\n');
}

// Step 6: Update games.json
console.log('📝 Step 4: Updating games.json...');
let games = [];
if (fs.existsSync(gamesJsonPath)) {
  try {
    const content = fs.readFileSync(gamesJsonPath, 'utf8');
    games = JSON.parse(content);
  } catch (err) {
    console.error(`❌ Failed to parse games.json: ${err.message}`);
    process.exit(1);
  }
}

const gameEntry = {
  id: gameSlug,
  title: gameTitle,
  category: category,
  src: `/games/${gameSlug}/index.html`,
  thumb: `/games/${gameSlug}/cover.svg`,
  description: `Safely audited game: ${gameTitle}`,
  approved: true, // Safe because it passed security audit
};

const existingIndex = games.findIndex(g => g.id === gameSlug);
if (existingIndex >= 0) {
  console.log(`⚠️  Game with id "${gameSlug}" already exists. Updating entry...`);
  games[existingIndex] = gameEntry;
} else {
  games.push(gameEntry);
}

fs.writeFileSync(gamesJsonPath, JSON.stringify(games, null, 2));
console.log('✅ games.json updated\n');

// Step 7: Cleanup
console.log('🧹 Step 5: Cleaning up temporary files...');
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✅ Cleanup complete\n');

// Final summary
console.log('=' .repeat(50));
console.log('✅ Game added successfully!');
console.log('=' .repeat(50));
console.log('');
console.log('Summary:');
console.log(`  ✓ Security audit passed`);
console.log(`  ✓ Game files copied to: ${targetGameDir}`);
console.log(`  ✓ Entry added to games.json`);
console.log(`  ✓ Game ID: ${gameSlug}`);
console.log('');
console.log('Next steps:');
console.log(`  1. Test locally: npm run dev`);
console.log(`  2. Verify game loads in gallery`);
console.log(`  3. Add cover image: ${targetGameDir}/cover.jpg`);
console.log(`  4. Test game functionality`);
console.log('');

