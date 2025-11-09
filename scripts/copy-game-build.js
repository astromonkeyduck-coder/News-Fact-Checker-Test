#!/usr/bin/env node

/**
 * Copy game build files to public/games/<slug>/
 * 
 * Usage: node scripts/copy-game-build.js <source-dir> <slug>
 * 
 * Example:
 *   node scripts/copy-game-build.js ~/Downloads/stunt-city-build stunt-city
 */

const fs = require('fs');
const path = require('path');

const sourceDir = process.argv[2];
const slug = process.argv[3];

if (!sourceDir || !slug) {
  console.error('Usage: node copy-game-build.js <source-dir> <slug>');
  console.error('');
  console.error('Example:');
  console.error('  node copy-game-build.js ~/Downloads/my-game-build my-game');
  process.exit(1);
}

const targetDir = path.join(__dirname, '..', 'public', 'games', slug);

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

try {
  // Check source exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Create target directory
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`✅ Created directory: ${targetDir}`);
  }

  // Copy files
  console.log(`📦 Copying from ${sourceDir} to ${targetDir}...`);
  copyRecursive(sourceDir, targetDir);
  console.log('✅ Copy complete!');

  // Check for index.html
  const indexHtml = path.join(targetDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.warn('⚠️  Warning: index.html not found in copied files');
    console.warn(`   Expected at: ${indexHtml}`);
  } else {
    console.log('✅ Found index.html');
  }

  // Check for cover.jpg
  const coverJpg = path.join(targetDir, 'cover.jpg');
  if (!fs.existsSync(coverJpg)) {
    console.warn('⚠️  Warning: cover.jpg not found');
    console.warn(`   Add a cover image at: ${coverJpg}`);
  } else {
    console.log('✅ Found cover.jpg');
  }

  console.log('');
  console.log('Next steps:');
  console.log(`1. Add entry to games.json with id: "${slug}"`);
  console.log(`2. Set src: "/games/${slug}/index.html"`);
  console.log(`3. Set thumb: "/games/${slug}/cover.jpg" (if exists)`);
  console.log(`4. Test locally: npm run dev`);

} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}

