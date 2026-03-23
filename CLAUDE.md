# CLAUDE.md

## Project purpose
Noteworthy News is a public news/media-literacy product with interactive experiences, admin tooling, feed ingestion, analytics, newsletters, and specialty dashboards.
Primary goal: make the public site feel premium, fast, trustworthy, and maintainable without breaking live workflows.

## Stack reality
- Static-first HTML/CSS/JS public site
- Netlify Functions for APIs/background operations
- Netlify Blobs for some post/content storage
- Supabase migrations for event/transcription-related data
- Auth0 present in the repo
- Cloudflare Worker for feed/X sync
- Separate websocket server with Redis for multiplayer/realtime
- Some React/JSX islands exist, but this is not a clean SPA

## Architecture constraints
- Do not treat this repo like a greenfield app.
- Preserve working public routes unless the plan explicitly changes them.
- Prefer simplifying boundaries over adding abstractions.
- Treat admin surfaces and destructive endpoints as privileged systems, not normal UI pages.
- One subsystem at a time: public site, admin, ingest, realtime, specialty dashboards.

## Non-negotiable rules
- Plan first. Do not edit before writing findings and a phased plan.
- Keep changes scoped. Do not rewrite the entire repo.
- No new frameworks unless clearly justified.
- No browser-only “security” for privileged behavior.
- No query-string auth, no localStorage/sessionStorage used as a trust boundary.
- Do not duplicate ingestion or storage logic; consolidate toward one canonical path per domain.
- Prefer thin handlers + shared utilities over giant serverless files.

## Coding standards
- Prefer small, explicit modules with clear ownership.
- Use shared contracts/types for request/response shapes where possible.
- Reduce inline JS/CSS when touching a file.
- If splitting a large file, do it by responsibility, not by arbitrary helper extraction.
- Preserve existing behavior unless the plan explicitly improves/replaces it.

## Performance rules
- Avoid blocking startup work on the homepage.
- No Babel-in-browser or runtime JSX compilation on production-critical paths.
- Lazy-load specialty experiences (Situation Monitor, globe, heavy game logic) where possible.
- Keep audio/animation opt-in or lightweight by default.
- Remove fallback hacks when a cleaner lifecycle fix is possible.

## Security rules
- All admin/destructive operations must be server-authenticated and authorized.
- Public admin HTML pages are not acceptable as the security boundary.
- Validate and rate-limit mutation endpoints on the server.
- Log sensitive admin mutations.

## UI/UX bar
- Public site should feel coherent, premium, and calm.
- One public design language, one internal/admin design language.
- Favor clarity, hierarchy, and trust over visual noise.
- Accessibility is required: focus states, reduced motion, contrast, keyboard/touch support.

## Editing workflow
1. Inspect relevant files.
2. Update `audit-findings.md` with findings.
3. Update `plan.md` with the scoped plan.
4. Explain the planned change before editing.
5. Implement only the approved scope.
6. Validate and summarize tradeoffs, risks, and follow-ups.

## Commands
- **install (root):** `npm install`
- **install (subpackages, when needed):** `npm install` in `cloudflare-worker/` and/or `websocket-server/`
- **dev (site + Netlify Functions):** `npm run dev` or `npm run serve` (both run `npx netlify dev`)
- **dev (Cloudflare worker):** `cd cloudflare-worker && npm run dev`
- **dev (websocket server):** `cd websocket-server && npm run dev`
- **build (production prep):** `npm run build` (runs timestamp/auth0 inject + webpack minify)
- **test:** `npm run test:games` (Jest, `GamesGallery`); other scripts include `npm run validate:games`, `npm run test:webhook`, and several `test:earthquake*` / `test:video` Node scripts—see root `package.json`
- **lint/typecheck:** Root TypeScript: `npx tsc --noEmit` (uses `tsconfig.json`; `cloudflare-worker` excluded). Worker package: `cd cloudflare-worker && npm run type-check`. There is no repo-wide ESLint configuration today.

## Why these rules exist
This repo already has too many overlapping systems. The biggest risk is not under-building. The biggest risk is making sprawl worse.
