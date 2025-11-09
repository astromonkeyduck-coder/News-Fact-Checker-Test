# Quick Start: Safely Adding Games

## 🚀 Fastest Way (Recommended)

Use the safe add script - it automatically audits and adds games:

```bash
npm run add:game <source-path> <game-slug> <game-title> [category]
```

**Example:**
```bash
npm run add:game /tmp/nativelite/games/hexgl hexgl "HexGL" Driving
```

This will:
1. ✅ Copy game to temp directory
2. ✅ Run security audit
3. ✅ Only add if safe
4. ✅ Update games.json
5. ✅ Clean up

## 🔍 Audit Before Adding

Want to check a game first?

```bash
npm run audit:game <game-directory>
```

**Example:**
```bash
npm run audit:game /tmp/nativelite/games/hexgl
```

## 📋 Manual Process

If you prefer manual control:

1. **Copy game to temp location**
   ```bash
   cp -r /path/to/game /tmp/game-audit
   ```

2. **Run security audit**
   ```bash
   npm run audit:game /tmp/game-audit
   ```

3. **If safe, copy to games directory**
   ```bash
   cp -r /tmp/game-audit public/games/my-game
   ```

4. **Add to games.json** (set `approved: false` initially)
   ```json
   {
     "id": "my-game",
     "title": "My Game",
     "category": "Puzzle",
     "src": "/games/my-game/index.html",
     "thumb": "/games/my-game/cover.svg",
     "description": "Description",
     "approved": false
   }
   ```

5. **Test thoroughly**, then set `approved: true`

## ⚠️ Security Rules

**NEVER add games with:**
- ❌ `eval()` or `Function()` calls
- ❌ External scripts (except trusted CDNs)
- ❌ Data exfiltration
- ❌ Crypto mining
- ❌ Obfuscated code

**ALWAYS:**
- ✅ Run security audit first
- ✅ Start with `approved: false`
- ✅ Test thoroughly
- ✅ Review warnings

## 📚 Full Documentation

- **Security Guide**: `SECURITY_GUIDE.md`
- **Integration Guide**: `GAMES_INTEGRATION_NATIVELITE.md`
- **Games Gallery README**: `GAMES_GALLERY_README.md`

## 🆘 Need Help?

1. Check security audit output
2. Review `SECURITY_GUIDE.md`
3. Test in isolated environment first
4. When in doubt, don't add the game

**Remember: Security first! 🔒**

