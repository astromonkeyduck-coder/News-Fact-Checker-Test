# Security Guide for Games Gallery

## 🔒 Security-First Approach

All games added to the gallery must pass security audits to protect users and your site.

## Security Features

### 1. **Automated Security Auditing**

Before any game is added, it's automatically scanned for:
- ❌ Dangerous code execution (`eval`, `Function`, `setTimeout` with strings)
- ❌ XSS vulnerabilities (`innerHTML`, `document.write`)
- ❌ External data exfiltration (unauthorized `fetch`, `XMLHttpRequest`)
- ❌ Crypto mining scripts
- ❌ Iframe manipulation attempts
- ❌ Unsafe external script sources
- ❌ Suspicious patterns and obfuscation

### 2. **Safe Game Addition Process**

Use the secure script to add games:

```bash
npm run add:game <source-path> <game-slug> <game-title> [category]
```

**Example:**
```bash
npm run add:game /tmp/nativelite/games/hexgl hexgl "HexGL" Driving
```

**What it does:**
1. ✅ Copies game to temporary directory
2. ✅ Runs comprehensive security audit
3. ✅ Only proceeds if audit passes
4. ✅ Copies to games directory
5. ✅ Updates games.json
6. ✅ Cleans up temporary files

### 3. **Manual Security Audit**

Audit a game directory before adding:

```bash
npm run audit:game public/games/my-game
```

**Output:**
- ✅ Safe games: No issues found
- ⚠️ Warnings: Review before approving
- ❌ Unsafe games: Blocked from addition

### 4. **Sandboxed Execution**

All games run in sandboxed iframes with:
- `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-presentation allow-fullscreen"`
- `referrerPolicy="no-referrer"`
- Restricted CSP headers
- No access to parent window

### 5. **Approval System**

Games require explicit approval:
- `approved: true` - Game passed security audit
- `approved: false` - Pending review or failed audit
- Unapproved games cannot be played

### 6. **Content Security Policy (CSP)**

Strict CSP headers prevent:
- Inline script execution (except where necessary)
- External resource loading (except whitelisted domains)
- Data exfiltration
- XSS attacks

## Security Checklist

Before adding any game:

- [ ] Run security audit: `npm run audit:game <path>`
- [ ] Review all warnings (even if audit passes)
- [ ] Check for external dependencies
- [ ] Verify no data collection
- [ ] Test in sandboxed iframe
- [ ] Check file sizes (large = potential obfuscation)
- [ ] Review network requests
- [ ] Test on mobile devices
- [ ] Set `approved: false` initially
- [ ] Test thoroughly before setting `approved: true`

## Adding Games Safely

### Option 1: Use Safe Add Script (Recommended)

```bash
# Automatically audits and adds game
npm run add:game /path/to/game hexgl "HexGL" Driving
```

### Option 2: Manual Process

1. **Copy game to temporary location**
   ```bash
   cp -r /path/to/game /tmp/game-audit
   ```

2. **Run security audit**
   ```bash
   npm run audit:game /tmp/game-audit
   ```

3. **If audit passes, copy to games directory**
   ```bash
   cp -r /tmp/game-audit public/games/my-game
   ```

4. **Update games.json** (set `approved: false` initially)
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

5. **Test thoroughly**
   - Load in gallery
   - Test functionality
   - Check browser console
   - Monitor network requests
   - Test on mobile

6. **Approve if safe**
   - Set `approved: true` in games.json
   - Commit changes

## Red Flags 🚩

**DO NOT ADD** games with:
- ❌ `eval()` or `Function()` calls
- ❌ External script sources (except trusted CDNs)
- ❌ Data exfiltration attempts
- ❌ Crypto mining code
- ❌ Obfuscated/minified code you can't review
- ❌ Large file sizes (>500KB per file)
- ❌ Suspicious network requests
- ❌ Parent window manipulation
- ❌ Cookie/localStorage abuse

## Trusted External Domains

Only these domains are allowed for external resources:
- `cdn.jsdelivr.net`
- `unpkg.com`
- `cdnjs.cloudflare.com`
- `fonts.googleapis.com`
- `fonts.gstatic.com`

To add more domains, update:
1. `scripts/security-audit-game.js`
2. CSP headers in `public/_headers`

## Monitoring

After adding games:
1. Monitor browser console for errors
2. Check network tab for suspicious requests
3. Review analytics for unusual activity
4. Test on multiple browsers
5. Test on mobile devices

## Reporting Issues

If you find a security issue:
1. Remove the game immediately
2. Set `approved: false` in games.json
3. Review security audit output
4. Fix or remove the issue
5. Re-audit before re-adding

## Best Practices

1. **Always audit before adding**
   ```bash
   npm run audit:game <path>
   ```

2. **Start with `approved: false`**
   - Test thoroughly first
   - Only approve after verification

3. **Review warnings**
   - Even if audit passes, review warnings
   - Some patterns are risky but may be necessary

4. **Keep games updated**
   - Re-audit when updating games
   - Remove games with vulnerabilities

5. **Use the safe add script**
   - Don't manually copy games
   - Always use `npm run add:game`

6. **Regular audits**
   - Periodically re-audit existing games
   - Remove games that fail new audits

## Security Scripts

- `scripts/security-audit-game.js` - Comprehensive security audit
- `scripts/safe-add-game.js` - Safe game addition with audit
- `scripts/validate-game-embeds.js` - Validate games.json structure

## CSP Configuration

Current CSP (in `public/_headers`):
```
Content-Security-Policy: default-src 'self'; 
  frame-src 'self' https://trusted-embed.com; 
  script-src 'self' 'unsafe-inline' https://trusted-embed.com; 
  img-src 'self' data: https:; 
  style-src 'self' 'unsafe-inline'; 
  font-src 'self' data:;
```

Games directory has relaxed CSP for game execution:
```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:; 
  connect-src 'self' https:; 
  frame-src 'self';
```

## Questions?

- Review security audit output carefully
- When in doubt, don't add the game
- Test thoroughly before approving
- Monitor after adding

**Remember: Security first, features second.**

