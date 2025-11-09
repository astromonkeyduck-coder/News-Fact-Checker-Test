#!/usr/bin/env node

/**
 * Helper script to add a game from nativelite template structure
 * 
 * Usage:
 *   node scripts/add-nativelite-game.js <nativelite-path> <game-slug> <game-title> [category]
 * 
 * Example:
 *   node scripts/add-nativelite-game.js /tmp/nativelite my-game "My Game" Puzzle
 */

const fs = require('fs');
const path = require('path');

const nativelitePath = process.argv[2];
const gameSlug = process.argv[3];
const gameTitle = process.argv[4];
const category = process.argv[5] || 'Puzzle';

if (!nativelitePath || !gameSlug || !gameTitle) {
  console.error('Usage: node add-nativelite-game.js <nativelite-path> <game-slug> <game-title> [category]');
  console.error('');
  console.error('Example:');
  console.error('  node add-nativelite-game.js /tmp/nativelite hexgl "HexGL" Driving');
  process.exit(1);
}

const projectRoot = path.join(__dirname, '..');
const gamesDir = path.join(projectRoot, 'public', 'games');
const targetGameDir = path.join(gamesDir, gameSlug);
const gamesJsonPath = path.join(projectRoot, 'games.json');

// Check nativelite path exists
if (!fs.existsSync(nativelitePath)) {
  console.error(`❌ Nativelite path not found: ${nativelitePath}`);
  process.exit(1);
}

// Try to find game in nativelite structure
// Common structures:
// - nativelite/games/<slug>/
// - nativelite/<slug>/
// - nativelite/public/games/<slug>/

const possiblePaths = [
  path.join(nativelitePath, 'games', gameSlug),
  path.join(nativelitePath, gameSlug),
  path.join(nativelitePath, 'public', 'games', gameSlug),
  path.join(nativelitePath, 'src', 'games', gameSlug),
];

let sourceGamePath = null;
for (const possiblePath of possiblePaths) {
  if (fs.existsSync(possiblePath)) && fs.statSync(possiblePath).isDirectory()) {
    sourceGamePath = possiblePath;
    break;
  }
}

if (!sourceGamePath) {
  console.warn('⚠️  Game directory not found in nativelite structure.');
  console.warn('   Searched in:');
  possiblePaths.forEach(p => console.warn(`     - ${p}`));
  console.warn('');
  console.warn('   Creating empty game directory. You can add game files manually.');
  
  // Create empty directory
  if (!fs.existsSync(targetGameDir)) {
    fs.mkdirSync(targetGameDir, { recursive: true });
    console.log(`✅ Created directory: ${targetGameDir}`);
  }
} else {
  console.log(`📦 Found game at: ${sourceGamePath}`);
  
  // Copy game files
  if (!fs.existsSync(targetGameDir)) {
    fs.mkdirSync(targetGameDir, { recursive: true });
  }
  
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
  
  console.log(`📋 Copying game files...`);
  copyRecursive(sourceGamePath, targetGameDir);
  console.log(`✅ Copied game files to: ${targetGameDir}`);
}

// Check for index.html
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
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: white;
        }
        .placeholder {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
        }
        .placeholder h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }
        .placeholder p {
            font-size: 1.1rem;
            line-height: 1.6;
            opacity: 0.9;
        }
        .note {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="placeholder">
        <h1>🎮 ${gameTitle}</h1>
        <p>Game from Nativelite template</p>
        <div class="note">
            <strong>Placeholder</strong><br>
            Replace this file with the actual game HTML from nativelite.
        </div>
    </div>
</body>
</html>`;
  
  fs.writeFileSync(indexHtml, placeholderHtml);
  console.log(`✅ Created placeholder index.html`);
}

// Update games.json
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

// Check if game already exists
const existingIndex = games.findIndex(g => g.id === gameSlug);
const gameEntry = {
  id: gameSlug,
  title: gameTitle,
  category: category,
  src: `/games/${gameSlug}/index.html`,
  thumb: `/games/${gameSlug}/cover.svg`,
  description: `Game from Nativelite template`,
  approved: true,
};

if (existingIndex >= 0) {
  console.log(`⚠️  Game with id "${gameSlug}" already exists. Updating entry...`);
  games[existingIndex] = gameEntry;
} else {
  games.push(gameEntry);
  console.log(`✅ Added game entry to games.json`);
}

// Write games.json
fs.writeFileSync(gamesJsonPath, JSON.stringify(games, null, 2));
console.log(`✅ Updated games.json`);

// Check for cover image
const coverSvg = path.join(targetGameDir, 'cover.svg');
const coverJpg = path.join(targetGameDir, 'cover.jpg');
if (!fs.existsSync(coverSvg) && !fs.existsSync(coverJpg)) {
  console.warn('⚠️  Cover image not found. Run generate-placeholder-covers.js to create one.');
}

console.log('');
console.log('✅ Game added successfully!');
console.log('');
console.log('Next steps:');
console.log(`1. Verify game files in: ${targetGameDir}`);
console.log(`2. Add/update cover image: ${targetGameDir}/cover.jpg`);
console.log(`3. Test locally: npm run dev`);
console.log(`4. Check games.json entry for "${gameSlug}"`);

