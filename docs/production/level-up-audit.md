# Noteworthy News production level-up audit

Date: July 5, 2026. Scope: high-leverage polish pass, not a redesign.

## Current stack

- Static site in repo root; homepage served from `v2/index.html` via Netlify rewrite (`/` -> `/v2/index.html`)
- Netlify Functions (Node 20, CommonJS), Supabase server-side, Netlify Blobs for posts
- Auth0 SPA (lazy-loaded), Resend email, web push, APNs for iOS
- CSS: `v2/styles/tokens.css`, `base.css`, `v4.css` (homepage), `page.css` (static pages), `article-v4.css` (articles/archive)
- JS: ES modules on homepage (`v2/js/main.js`, `feed.js`, `post-media.js`); classic scripts on article/archive
- Build: `npm run build` (timestamp inject, Auth0 inject, webpack minify for legacy bundles)

## Main routes

| Route | Source | Notes |
|-------|--------|-------|
| `/` | `v2/index.html` | V4 homepage |
| `/index.html` | Legacy V1 maintenance shell | Fallback only; do not link |
| `/archive.html` | Archive grid | Uses `posts-read` |
| `/article.html?id=` | Article v4 | Dynamic loader |
| `/story/*` | `story.html` | Live stories |
| `/contact.html` | Static page | Form -> `send-contact-form` |
| `/how-we-verify.html`, `/editorial-policy.html`, `/privacy.html`, `/terms.html` | Static pages | `page.css` shell |
| `/situation-monitor.html`, `/v2/situation-monitor.html` | 302 -> `/` | Temporarily disabled |
| `/game.html`, `/geography-game.html` | Games | Stricter frame headers |
| `/.netlify/functions/*` | Functions | APIs |

## Biggest risks

1. **No site-wide CSP yet** - X-Frame-Options and nosniff exist; full CSP needs staged rollout (Auth0, AdSense, fonts, chat widget, video proxy)
2. **Legacy `/index.html`** - Easy to open wrong homepage locally or via old links
3. **Large innerHTML surfaces** - Feed/archive/card renderers escape user fields but remain review targets
4. **Stale sitemap** - Missing archive/contact/trust pages; old lastmod dates
5. **404 page** - Theatrical V1 styling; works but off-brand and ticker uses noisy `aria-live`
6. **Contact form** - No honeypot before this pass
7. **Secrets** - `.env` / `.env.local` hold service keys (not committed); Auth0 client ID is public by design

## Quick wins (this pass)

- [x] Audit doc + recommended CSP doc (no risky forced CSP)
- [x] DNS prefetch control header on Netlify
- [ ] HSTS deferred (subdomain strategy still evolving; `includeSubDomains` is hard to unwind)
- [x] Homepage skip link + main landmark id
- [x] External link `rel` hardening (homepage footer, live story share)
- [x] Contact honeypot (client + server silent drop)
- [x] Archive search clear control + `aria-busy` while loading
- [x] Sitemap + robots updates
- [x] 404 `noindex`, archive escape link, quieter decorative ticker
- [x] Remove noisy service worker `console.log` on homepage
- [x] Twitter site meta on homepage

## What we will not touch

- Homepage or article visual redesign (other pass)
- Situation Monitor re-enable
- Full CSP enforcement
- iOS app / TestFlight
- Backend ingest pipeline timing
- Chat widget rebuild
- 404 full restyle to v4
- Dynamic news sitemap generation (needs function or build step)

## Too large for this pass

- Automated article URLs in sitemap (requires posts-read at build time)
- Global console.log purge across legacy `script.js` / games
- Replacing all innerHTML card renderers with DOM APIs
- COOP/COEP headers (Auth0 popup flows need testing)
- Lighthouse budget CI

See also: `docs/production/recommended-csp.md`
