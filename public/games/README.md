# Games Directory

This directory contains all self-hosted HTML5 games for the Games Gallery.

## Structure

Each game should be in its own subdirectory:

```
public/games/
├── <game-slug>/
│   ├── index.html      # Main game file (required)
│   ├── cover.jpg       # Thumbnail image (recommended, 16:9 ratio)
│   └── [other assets]  # JS, CSS, images, etc.
```

## Current Games

The following placeholder games have been set up:

1. **hexgl** - Futuristic racing game
2. **stunt-city** - Open-map stunt driving
3. **parkour-blocks** - Parkour course navigation
4. **urban-runner** - Urban parkour running
5. **puzzle-master** - Puzzle challenges
6. **sudoku-pro** - Classic Sudoku
7. **word-search** - Word search puzzles
8. **basketball-shootout** - Basketball shooting
9. **soccer-striker** - Soccer goal scoring
10. **tennis-ace** - Tennis gameplay
11. **extreme-parkour** - Extreme parkour challenges
12. **racing-championship** - Racing tournaments

## Adding Real Games

### Option 1: Replace Placeholder Files

1. Navigate to the game directory: `public/games/<slug>/`
2. Replace `index.html` with your actual game HTML
3. Replace `cover.svg` with a real screenshot (convert to JPG)
4. Add any additional assets (JS, CSS, images, etc.)

### Option 2: Use the Copy Script

```bash
node scripts/copy-game-build.js /path/to/game-build <slug>
```

This will copy all files from your game build directory to `public/games/<slug>/`.

### Option 3: Manual Upload

1. Create directory: `public/games/<your-game-slug>/`
2. Upload all game files to that directory
3. Ensure `index.html` is the entry point
4. Add a `cover.jpg` thumbnail (800x450px recommended)
5. Update `games.json` with the new game entry

## Cover Images

Cover images should be:
- **Format**: JPG or PNG
- **Aspect Ratio**: 16:9 (e.g., 800x450px, 1280x720px)
- **File Name**: `cover.jpg` or `cover.png`
- **Location**: Same directory as `index.html`

Currently, placeholder SVG files are used (`cover.svg`). Replace these with actual game screenshots for production.

To convert SVG to JPG:
```bash
# Using ImageMagick
convert public/games/<slug>/cover.svg public/games/<slug>/cover.jpg

# Or use an online converter or design tool
```

## Game Requirements

- **Entry Point**: Must have `index.html` in the game directory
- **Self-Contained**: All assets should be relative paths or in the same directory
- **No External Dependencies**: Games should work offline (unless using approved external APIs)
- **Responsive**: Games should work on desktop and mobile
- **Performance**: Optimize assets for fast loading

## Security Notes

- Games run in sandboxed iframes
- External resources must be approved in `games.json` (`approved: true`)
- CSP headers restrict what games can access
- See main README for security configuration

## Testing

After adding a game:

1. Test locally: `npm run dev`
2. Navigate to the Games Gallery page
3. Verify the game appears in the grid
4. Click "Play" and test the game loads
5. Check browser console for errors
6. Test on mobile devices

## Troubleshooting

**Game not showing?**
- Check `games.json` has correct `src` path
- Verify `index.html` exists in the game directory
- Check browser console for 404 errors

**Game not loading in iframe?**
- Verify CSP headers allow the game
- Check for mixed content (HTTP/HTTPS) issues
- Ensure game doesn't require external resources without approval

**Cover image not showing?**
- Verify image file exists
- Check file path in `games.json`
- Ensure image format is supported (JPG, PNG, SVG)

