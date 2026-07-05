# Recommended Content-Security-Policy (staged rollout)

Do **not** deploy this verbatim without testing in Report-Only mode first.

Noteworthy News loads scripts and assets from many origins:

- Self (static, `/v2/`, functions)
- Google Fonts, AdSense
- Auth0 (`*.auth0.com`)
- Twitter/video proxy paths (`/media/video/`)
- Supabase (server-side only today; no browser service role)
- Chat widget inline + function calls to `/.netlify/functions/noteworthy-chat`
- Optional map tiles (article embeds)

## Suggested phase 1 (Report-Only)

Add to Netlify `_headers` or `netlify.toml` as:

`Content-Security-Policy-Report-Only = "..."`

Start with:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://cdn.auth0.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:;
media-src 'self' blob: https:;
connect-src 'self' https://*.auth0.com https://noteworthynews.co wss:;
frame-src 'self' https://googleads.g.doubleclick.net;
frame-ancestors 'self';
base-uri 'self';
form-action 'self';
```

Tune after watching browser console violations on:

- `/` (homepage + chat + ads)
- `/article.html?id=...` (embeds, video)
- `/story/...` (live story)
- Auth0 login callback
- Contact form POST

## Already deployed (safe)

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(self), camera=()`
- `X-Frame-Options: SAMEORIGIN` (DENY on `/game.html`)
- `X-DNS-Prefetch-Control: off` (added July 2026 pass)
- HSTS intentionally **not** set site-wide yet. Subdomains may change; `includeSubDomains` + preload is difficult to reverse. Netlify already serves HTTPS; add HSTS only after subdomain inventory is stable (consider `max-age` without `includeSubDomains` first).

## Phase 2

- Remove `'unsafe-inline'` from script-src by nonce or hash for inline boot scripts
- Split ad iframes to separate path with tighter policy
- Add `upgrade-insecure-requests` if all third parties are HTTPS-clean
