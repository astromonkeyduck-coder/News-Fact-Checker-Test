# Security Backlog — Noteworthy News

Tracks deferred/low-severity security items from the pre-launch audit. Critical/
High/simple-Medium fixes were applied in code; everything below is intentionally
deferred with rationale. Re-evaluate before scaling traffic or onboarding
external admins.

Status legend: `DEFERRED` (not done, tracked) · `PARTIAL` (mitigated, follow-up
remains) · `DONE` (kept for context).

---

## 1. Wildcard CORS on public APIs — DEFERRED (Low)

**Where:** `netlify/functions/lib/corsHeaders.js` and per-function headers set
`Access-Control-Allow-Origin: *`.

**Why it's acceptable now:** These endpoints are anonymous read/public-mutation
APIs that do not rely on cookies or `Authorization` for ambient browser auth, so
wildcard CORS does not enable a CSRF-style cross-origin privilege escalation.
Device/admin auth uses explicit bearer secrets, not cookies.

**Follow-up:**
- Inventory which functions are admin/authenticated vs. truly public.
- For admin/authenticated functions (`admin-live-stories`, `get-user-profile`,
  `send-custom-email`, etc.), replace `*` with an allowlist of first-party
  origins (`https://noteworthynews.co`, app/admin origins) and stop reflecting
  arbitrary `Origin`.
- Keep `*` only on genuinely public read endpoints (`posts-read`, `mobile-feed`,
  `live-stories`, proxies).
- Never combine `Access-Control-Allow-Origin: *` with
  `Access-Control-Allow-Credentials: true`.

---

## 2. Enforced Content-Security-Policy — DEFERRED (Medium, F7)

**Decision:** Did **not** ship a `Content-Security-Policy-Report-Only` header
yet. It is non-breaking by definition, but with no `report-to`/`report-uri`
collection endpoint it produces only per-visitor console noise and collects
nothing actionable, and the site relies heavily on inline `<script>`, inline
event handlers (`onclick`/`onerror`), inline styles, and many third-party
origins (Auth0, Google Fonts/gstatic, analytics, X/Twitter widgets, map/tile
providers, media CDNs). A naive policy would generate a flood of violations and
needs a full origin inventory before it's useful. Documenting per the audit's
"if risky/low-value, document instead" guidance.

**Current state:** `frame-ancestors 'self'` is enforced on `/game.html`;
global headers set `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` (see `netlify.toml`). These already
cover clickjacking and MIME-sniffing.

**Rollout plan (when ready):**
1. Stand up a violation-collection endpoint (Netlify Function writing to Blobs,
   or a third-party report collector). Without this, report-only is noise.
2. Inventory every external origin the site loads (scripts, styles, fonts,
   images, frames, connect/XHR/fetch, media).
3. Ship `Content-Security-Policy-Report-Only` first and watch reports for 1–2
   weeks. Starter policy to refine:
   ```
   Content-Security-Policy-Report-Only:
     default-src 'self';
     script-src 'self' 'unsafe-inline' https://cdn.auth0.com https://*.auth0.com;
     style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
     font-src 'self' https://fonts.gstatic.com data:;
     img-src 'self' https: data: blob:;
     media-src 'self' https: blob:;
     connect-src 'self' https:;
     frame-ancestors 'self';
     object-src 'none';
     base-uri 'self';
     report-uri /.netlify/functions/csp-report;
   ```
4. Migrate inline handlers/scripts to external files + nonces so
   `'unsafe-inline'` can eventually be dropped from `script-src`.
5. Promote to enforcing `Content-Security-Policy` only after reports are clean.

---

## 3. notification-preferences endpoint hardening — DEFERRED (Low)

**Where:** `netlify/functions/notification-preferences.js`.

**Observations:**
- Identity is a `subscriberKey` derived from the push-subscription endpoint
  (`lib/subscriberKey.js`). Anyone who learns/guesses a `subscriberKey` can
  read/write that subscriber's notification preferences. The key is a truncated
  hash of an opaque push endpoint (high entropy, not enumerable in practice),
  so risk is low, but it is a bearer-style identifier with no rate limit.

**Follow-up:**
- Add IP rate limiting (reuse `rate-limit.js`) to blunt scraping/enumeration.
- Validate/whitelist the incoming preferences payload (reject unknown keys,
  bound array/string sizes) to prevent storing arbitrary blobs.
- Consider binding writes to proof of subscription ownership (e.g. require the
  full subscription object, not just the derived key).
- Ensure responses never echo back another subscriber's data.

---

## 4. Auth0 ID-token-as-bearer — DEFERRED / DOCUMENT (Low, F9)

**Where:** `device-link.js` → `verifiedProfile()` → `middleware/requireAuth.verifyToken`.

**Behavior:** Pairing accepts the Auth0 **ID token** as a `Bearer` token to
capture verified profile claims (`sub`/`email`/`name`/`picture`). This is
intentional: pairing only needs identity, not API authorization, and the token
is fully verified (signature, issuer, audience = client_id, expiry) server-side.
Client-provided profile fields are never trusted.

**Documentation/caveats:**
- ID tokens are audience-scoped to the SPA `client_id`, **not** to an API
  audience. Do not reuse this pattern for endpoints that perform privileged
  mutations — those should require an Auth0 **access token** with the correct
  API `audience` and scopes.
- Keep ID-token acceptance limited to identity-capture flows (`device-link`).
- Confirm `verifyToken` enforces `aud === AUTH0_CLIENT_ID` and `iss` matches the
  tenant for the ID-token path.

---

## 5. Pairing-code retention policy — PARTIAL (Low, F12)

**Done:** Added opportunistic cleanup in `device-link.js`
(`cleanupPairingCodes()`): on ~15% of pairing requests it deletes expired and
already-redeemed `device_pairing_codes` rows (these carry short-lived PII —
verified email/name/picture captured at code creation). It only removes dead
rows, never an in-flight unredeemed code.

**Follow-up (deferred):**
- Add a dedicated scheduled cleanup function (e.g. every 15 min) so retention
  does not depend on pairing traffic, and to guarantee deletion during quiet
  periods.
- Define and document a formal retention SLA for `device_pairing_codes` and the
  linked profile fields on `live_story_devices` (e.g. purge linked-profile PII
  on unlink / device inactivity).
- Consider a DB-side TTL job or partial index on `expires_at` if the table grows.

---

## 6. Remaining low / info items — DEFERRED

- **import-x-posts platform reliance (F1):** Public unauthenticated triggering
  is blocked primarily by Netlify (scheduled functions reject HTTP with 500).
  Code now also fails closed: any non-scheduled invocation requires a
  timing-safe `CRON_SECRET`. A forged `{ next_run }` body cannot reach the
  function via public HTTP in production. There is no pure-code way to
  cryptographically distinguish a real scheduler invocation from a forged
  `next_run`; the platform guarantee is the control. If the schedule is ever
  removed (function exposed as a normal HTTP endpoint), `CRON_SECRET` becomes
  mandatory for all calls — keep it set.
- **send-custom-email admin secret in body:** Admin token is passed in the JSON
  body (`admin_password`) rather than an `Authorization` header. Now compared
  with `crypto.timingSafeEqual` (F8). Follow-up: migrate to a bearer header and
  add IP rate limiting; ensure the token is never logged.
- **posts-read field allowlist maintenance (F10):** `posts-read.js` now projects
  blobs through a public-field allowlist (`PUBLIC_POST_FIELDS`). When adding new
  *renderable* post fields, add them to the allowlist or they will not reach the
  web/app clients. Internal/processing fields should deliberately be left out.
- **In-memory rate limiter:** `rate-limit.js` stores counters per warm function
  instance (not distributed). It blunts bursts but is bypassable across cold
  starts / multiple instances. Follow-up: back it with a shared store (Supabase
  table or Netlify Blobs) if abuse is observed.
- **Admin legacy shared-secret path:** `middleware/requireAuth.js` supports a
  legacy admin shared secret in addition to Auth0. Plan to retire the shared
  secret once all admin tooling uses Auth0.
