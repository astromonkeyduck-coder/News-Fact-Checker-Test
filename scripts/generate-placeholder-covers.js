#!/usr/bin/env node

/**
 * Generate placeholder cover images for games
 * Creates simple SVG-based placeholder images
 */

const fs = require('fs');
const path = require('path');

const games = [
  { id: 'hexgl', title: 'HexGL', color: '#667eea' },
  { id: 'stunt-city', title: 'Stunt City', color: '#f5576c' },
  { id: 'parkour-blocks', title: 'Parkour Blocks', color: '#4facfe' },
  { id: 'urban-runner', title: 'Urban Runner', color: '#fee140' },
  { id: 'puzzle-master', title: 'Puzzle Master', color: '#fed6e3' },
  { id: 'sudoku-pro', title: 'Sudoku Pro', color: '#764ba2' },
  { id: 'word-search', title: 'Word Search', color: '#f5576c' },
  { id: 'basketball-shootout', title: 'Basketball Shootout', color: '#fecfef' },
  { id: 'soccer-striker', title: 'Soccer Striker', color: '#00f2fe' },
  { id: 'tennis-ace', title: 'Tennis Ace', color: '#fed6e3' },
  { id: 'extreme-parkour', title: 'Extreme Parkour', color: '#fee140' },
  { id: 'racing-championship', title: 'Racing Championship', color: '#667eea' },
];

function generateSVGCover(game) {
  // Create a 16:9 aspect ratio SVG (800x450)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${game.color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${game.color}dd;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#grad)"/>
  <text x="400" y="200" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
        fill="white" text-anchor="middle" dominant-baseline="middle">${game.title}</text>
  <text x="400" y="250" font-family="Arial, sans-serif" font-size="20" 
        fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">Placeholder Cover</text>
</svg>`;

  return svg;
}

games.forEach(game => {
  const gameDir = path.join(__dirname, '..', 'public', 'games', game.id);
  const coverPath = path.join(gameDir, 'cover.jpg');
  
  // Create SVG placeholder (browsers can display SVG)
  // For actual JPG, you'd need a library like sharp or canvas
  // For now, we'll create an SVG that can be converted later
  const svgPath = path.join(gameDir, 'cover.svg');
  
  if (!fs.existsSync(gameDir)) {
    console.warn(`Game directory not found: ${gameDir}`);
    return;
  }
  
  fs.writeFileSync(svgPath, generateSVGCover(game));
  console.log(`✅ Created ${svgPath}`);
  
  // Also create a simple HTML file that can be used as a placeholder
  // Note: For production, convert SVG to JPG using ImageMagick or similar
  console.log(`   To convert to JPG: convert ${svgPath} ${coverPath}`);
});

console.log('\n📝 Note: Created SVG placeholders. For production, convert to JPG:');
console.log('   Option 1: Use ImageMagick: convert cover.svg cover.jpg');
console.log('   Option 2: Use online converter or design tool');
console.log('   Option 3: Replace with actual game screenshots');

