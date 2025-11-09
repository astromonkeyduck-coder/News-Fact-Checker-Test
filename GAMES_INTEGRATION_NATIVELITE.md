# Integrating Games from Nativelite Template

The [nativelite template](https://github.com/parcoil/nativelite) is an unblocked games site template that can be used as a source for games to integrate into your Games Gallery.

## Understanding the Nativelite Structure

The nativelite template uses:
- `index.html` - Main page with game listings
- `play.html` - Game player/embed page
- `config/main.js` - Configuration for site name and settings
- `config/main.css` - Styling configuration
- Games embedded via iframe or direct HTML

## How to Use Nativelite Games with Your Gallery

### Option 1: Extract Individual Games

If nativelite hosts individual game files, you can:

1. **Fork or clone the nativelite repository:**
   ```bash
   git clone https://github.com/parcoil/nativelite.git
   cd nativelite
   ```

2. **Identify game files:**
   - Look for game directories or HTML files
   - Check if games are embedded via external URLs or self-hosted

3. **Extract game builds:**
   - Copy game HTML files and assets
   - Place them in your `public/games/<slug>/` directory

4. **Add to games.json:**
   ```json
   {
     "id": "nativelite-game",
     "title": "Game Name",
     "category": "Puzzle",
     "src": "/games/nativelite-game/index.html",
     "thumb": "/games/nativelite-game/cover.jpg",
     "description": "Game description",
     "approved": true
   }
   ```

### Option 2: Use Nativelite as External Embed

If nativelite provides embed URLs:

1. **Add as external embed in games.json:**
   ```json
   {
     "id": "nativelite-embed",
     "title": "Nativelite Game",
     "category": "Puzzle",
     "src": "https://lite.nativegames.net/play.html?game=game-slug",
     "thumb": "/games/nativelite-embed/cover.jpg",
     "description": "Game from Nativelite",
     "approved": true
   }
   ```

2. **Update CSP headers** to allow the nativelite domain:
   ```toml
   # In public/_headers or netlify.toml
   Content-Security-Policy: frame-src 'self' https://lite.nativegames.net;
   ```

### Option 3: Use Nativelite's Game Structure

If you want to adopt nativelite's game hosting approach:

1. **Study their structure:**
   - Check how they organize games
   - See how `play.html` embeds games
   - Understand their configuration system

2. **Adapt for your gallery:**
   - Your Games Gallery already uses iframe embedding (similar to nativelite's approach)
   - Your `games.json` serves a similar purpose to their config system
   - Your modal player is equivalent to their `play.html`

## Key Differences

| Feature | Your Games Gallery | Nativelite Template |
|---------|-------------------|-------------------|
| **Framework** | React component | Vanilla HTML/JS |
| **Game List** | `games.json` | Config files |
| **Player** | React modal with iframe | `play.html` page |
| **Styling** | Tailwind-like CSS | Custom CSS variables |
| **Search/Filter** | Built-in React state | Would need custom JS |
| **Deployment** | Netlify/Vercel | GitHub Pages |

## Recommended Approach

Since you already have a **production-ready Games Gallery**, the best approach is:

1. **Use nativelite as a game source:**
   - Extract individual game files from nativelite
   - Add them to your `public/games/` directory
   - Add entries to your `games.json`

2. **Keep your gallery structure:**
   - Your React-based gallery is more feature-rich
   - Better search, filtering, and UX
   - More secure with approval system

3. **Leverage nativelite's game collection:**
   - If they have a game library, use those games
   - Follow their game structure if it's well-organized
   - Respect their licensing/terms of service

## Example: Adding a Nativelite Game

```bash
# 1. Clone nativelite (if you want to extract games)
git clone https://github.com/parcoil/nativelite.git /tmp/nativelite

# 2. Copy a game to your gallery
# (Assuming nativelite has games in a specific structure)
cp -r /tmp/nativelite/games/my-game public/games/my-game

# 3. Add to games.json
# Edit games.json and add the entry

# 4. Test
npm run dev
```

## Important Notes

⚠️ **Copyright & Licensing:**
- Respect nativelite's MIT License
- Don't remove attribution if required
- Check their Terms of Service
- Only use games you have rights to host

⚠️ **Security:**
- Always set `approved: false` initially for external embeds
- Review game code before approving
- Test games in sandboxed iframe (your gallery already does this)

⚠️ **Performance:**
- Optimize game assets before adding
- Use lazy loading (already implemented in your gallery)
- Consider CDN for large game files

## Next Steps

1. **Explore nativelite repository:**
   - Check their game structure
   - See what games they offer
   - Understand their embedding method

2. **Extract games you want:**
   - Use the copy script: `node scripts/copy-game-build.js <source> <slug>`
   - Or manually copy game files

3. **Add to your gallery:**
   - Update `games.json`
   - Add cover images
   - Test locally

4. **Deploy:**
   - Your gallery is ready to use
   - Games will appear automatically once added to `games.json`

## Resources

- [Nativelite Repository](https://github.com/parcoil/nativelite)
- [Nativelite Live Site](https://lite.nativegames.net)
- Your Games Gallery README: `GAMES_GALLERY_README.md`
- Integration Guide: `GAMES_GALLERY_INTEGRATION.md`

---

**Remember:** Your Games Gallery is already a complete, production-ready solution. Use nativelite as a source for games, not as a replacement for your gallery infrastructure.

