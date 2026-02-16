# API Keys & Environment Variables

## Breaking news cards (posts feed)

**No keys needed.** The `posts-read` function uses **Netlify Blob Storage**. When you deploy to Netlify or run `netlify dev`, Netlify sets these for you:

- `NETLIFY_SITE_ID` – set automatically by Netlify  
- `NETLIFY_BLOB_READ_WRITE_TOKEN` – set automatically by Netlify  

You don’t add these yourself unless you’re doing something custom.

---

## Optional keys (by feature)

| Variable | Used for | Where to get it |
|----------|----------|------------------|
| **RESEND_API_KEY** | Sending email (newsletter, tips, alerts, notifications) | [resend.com](https://resend.com) → API Keys |
| **RESEND_FROM_EMAIL** | Sender address (optional; has defaults) | e.g. `Noteworthy News <hello@yourdomain.com>` |
| **OPENAI_API_KEY** | AI image generation, voice summary | [platform.openai.com](https://platform.openai.com/api-keys) |
| **ELEVENLABS_API_KEY** | Earthquake / voice video generation | [elevenlabs.io](https://elevenlabs.io) |
| **SUPABASE_URL** | Live events ingest, some scripts | Supabase project → Settings → API |
| **SUPABASE_SERVICE_ROLE_KEY** | Same as above (server-only) | Supabase project → Settings → API |
| **ADMIN_ANALYTICS_TOKEN** | Protect admin/analytics endpoints (you choose the value) | Any secret string you create |
| **NEWSLETTER_KEY** | Protect newsletter admin (you choose the value) | Any secret string you create |
| **CAMS_TOKEN** | Optional: protect Live Cams API from abuse (you choose the value) | Any secret string; if unset, cams endpoints still work in dev |
| **WINDY_API_KEY** | Optional: more global webcams in Live Cams (Windy API) | [windy.com](https://www.windy.com) API |
| **NY511_API_KEY** | Optional: New York state traffic cams in Live Cams | NY511 developer program |

---

## Live Cams (Situation Monitor)

**You do not need any API keys** for the main camera list. These work without keys:

- **FL511** (Florida), **Caltrans** (California), **TxDOT** (Texas), **WYDOT** (Wyoming), plus a small curated set (EarthCam, etc.).

**Why only ~21 cameras sometimes?**

- If the app thinks the Netlify cams API is unavailable, it uses “fallback” mode and fetches **directly from your browser** (FL511, Caltrans, TxDOT, WYDOT). Some of those APIs (e.g. FL511, Caltrans) can be blocked by CORS when called from the browser, so you may only get **TxDOT + WYDOT + curated** (~21 cameras).
- **To get the full list again (hundreds of cams):** run or deploy the app on **Netlify** (e.g. `netlify dev` or deploy to Netlify). Then the cams search runs on the server (no CORS), and you get FL511 + Caltrans + TxDOT + WYDOT + optional Windy/NY511.
- The app now **merges Netlify results** when fallback returns few cameras, so if the site is on Netlify you should see the full list again even when the initial health check failed.

**Optional keys (more cameras):**

- **WINDY_API_KEY** – adds global Windy webcams (many more international cams).
- **NY511_API_KEY** – adds New York state traffic cams.
- **CAMS_TOKEN** – optional secret to protect `/api/cams/*` from abuse; if unset, endpoints still work (dev mode).

---

## Local development

1. **Breaking news feed:** Run `netlify dev` so `/.netlify/functions/posts-read` works. No env keys required for the feed.
2. **Email / AI / etc.:** Copy the variables you need into `.env` or `.env.local` (do not commit these files). Netlify CLI will load them when you run `netlify dev`.

---

## Netlify (production)

In **Site settings → Environment variables** add only what you use, e.g.:

- `RESEND_API_KEY` if you use newsletter/tips/emails  
- `OPENAI_API_KEY` if you use image/voice AI  
- `ADMIN_ANALYTICS_TOKEN` and `NEWSLETTER_KEY` as your own secrets for protected routes  

`NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN` are set by Netlify; you don’t add them manually.
