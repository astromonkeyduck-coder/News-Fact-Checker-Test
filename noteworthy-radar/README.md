# Noteworthy Radar

A compliance-first newsroom command center. It helps a small social-news team
rapidly monitor big events, save viral / public-safety leads that an editor
finds **manually**, triage them with AI, draft neutral captions, track
verification and permission status, and export branded vertical video **only
after editorial approval**.

This app is intentionally isolated from the rest of the repository: it is a
standalone Next.js App Router app under `noteworthy-radar/` with its own
dependencies and its own dedicated Supabase project. It does not touch the
existing static site, webpack, or Netlify build.

---

## Compliance boundaries (built into the product)

Noteworthy Radar does **not**:

- scrape Facebook (or any platform feed),
- automate logins or bypass platform restrictions,
- auto-download third-party videos,
- evade rate limits, or
- collect data through unauthorized automated means.

Instead it is a **semi-automated capture system**: a human editor finds public
posts manually and saves the URL + metadata into a review queue. Video
processing is allowed only for files the editor uploads after marking the
rights status, and **export is server-gated** by permission status. Future
official integrations (e.g. Telegram Bot API) live in clearly separated,
disabled-by-default adapter modules with explicit permission checks.

---

## Tech stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS (custom dark "tactical newsroom" theme)
- Supabase (auth, Postgres, storage) + SQL migrations + RLS
- Zod (validation) + React Hook Form (forms) + TanStack Table (lead inbox)
- AI provider abstraction (OpenAI / Anthropic) with a deterministic **stub**
  default so it runs with zero AI configuration
- FFmpeg (`fluent-ffmpeg` + `ffmpeg-static`) for server-side vertical export,
  with a safe stub fallback
- Jest unit tests (triage JSON contract, status rules, export gating, risk
  heuristics)

---

## Setup

```bash
cd noteworthy-radar
npm install
cp .env.example .env.local   # fill in your Supabase project values
```

### 1. Create a Supabase project

Create a **dedicated** Supabase project for Noteworthy Radar (do not reuse the
main repo's project). From Project Settings -> API, copy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### 2. Apply the database schema

The migrations live in `supabase/migrations/` and are plain Postgres. Apply
them in order with the Supabase CLI (`supabase db reset` / `supabase db push`)
or by pasting them into the SQL editor:

1. `0001_schema.sql` – tables + triggers
2. `0002_rls.sql` – Row Level Security + role helpers
3. `0003_seed.sql` – intentionally a no-op (see seeding below)
4. `0004_storage.sql` – private media bucket

Or paste the single combined file `supabase/setup_all.sql` (all of the above
in order) into the SQL editor.

### 3. Seed demo data

Demo data is seeded via the Admin API (NOT raw SQL). Inserting users directly
into `auth.users` from SQL leaves NULL token columns that break GoTrue login
("Database error querying schema") and the Admin API ("Database error finding
users"), so seeding goes through the official Admin API instead:

```bash
node supabase/seed.mjs
```

This creates the team, an event, sample leads, and three demo accounts
(password `radar-demo-123`):

| Email              | Role   |
| ------------------ | ------ |
| owner@radar.test   | owner  |
| editor@radar.test  | editor |
| viewer@radar.test  | viewer |

The script is safe to re-run; it recreates the demo users cleanly each time.

### 4. Run

```bash
npm run dev      # http://localhost:3100
```

---

## Environment variables

| Variable                        | Required | Notes                                                       |
| ------------------------------- | -------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Supabase project URL                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Supabase anon key                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes      | Server-only; used for audit logging, storage, exports       |
| `AI_PROVIDER`                   | no       | `stub` (default), `openai`, or `anthropic`                  |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | no     | Needed only when `AI_PROVIDER=openai`                       |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | no | Needed only when `AI_PROVIDER=anthropic`                  |
| `NEXT_PUBLIC_BRAND_NAME`        | no       | Defaults to "Noteworthy News"                               |
| `NEXT_PUBLIC_BRAND_HANDLE`      | no       | Defaults to "@NoteworthyNews"                               |
| `EXPORT_DEFAULT_TOP_LABEL`      | no       | Default burned-in label (defaults to "NOT REALLY THE NEWS") |
| `NEXT_PUBLIC_APP_URL`           | no       | Used by the capture bookmarklet                             |

With `AI_PROVIDER=stub` (the default), AI triage and captions are produced by a
deterministic, safety-first local engine - no API key needed.

---

## Commands

```bash
npm run dev         # dev server on :3100
npm run build       # production build
npm run start       # serve production build on :3100
npm run lint        # eslint (next lint)
npm run typecheck   # tsc --noEmit
npm run test        # jest unit tests
```

---

## How to use it after a live event

A worked example, e.g. after a **Knicks vs Spurs** game:

1. **Create the event** (`Events -> New event`). Enter teams/entities, location,
   and a keyword seed. Save - keywords are generated automatically. Open the
   event to get **copyable manual-search strings** grouped by platform
   (Facebook / Telegram / X / Reddit / Google-news / official sources).
2. **Find posts manually** on each platform using those search strings. When you
   see a relevant public post, either paste its URL into **Add Lead**, or use the
   **Capture Helper** bookmarklet to open Add Lead pre-filled.
3. **Describe the lead neutrally** (what it *appears* to show), set the platform,
   handle, claimed location/time, risk flags, and permission status. Save +
   run **AI triage**.
4. **Review AI triage** on the lead page: summary, newsworthiness/verification
   scores, risk level, safety/privacy/copyright risks, missing facts, and a
   recommended action. Captions are drafted in house style with a credit line.
5. **Work the checklists.** Complete the **verification checklist** and, when
   rights are unclear, the **permission workflow** (copy the DM template, record
   request/grant dates, attach evidence). High-risk leads require **final editor
   approval** before they can advance.
6. **Move the lead through the workflow**: triage -> verify_more / ask_permission
   -> approved_for_caption -> approved_for_video -> published. The status graph
   and high-risk gate are enforced server-side.
7. **Export** (only when permitted): upload a rights-cleared file on the lead,
   open **Video export**, set the top label / caption / credit, optionally add
   manual blur boxes for faces or plates, and render a 9:16 MP4. Export is
   refused unless permission is `permission_granted`, `official_source`,
   `licensed`, or `editorial_review_needed` with an explicit, logged override.

Every important action (lead created, triage run, status/permission change,
export, publish, reject/archive) is written to `audit_logs`.

---

## Roles

- **owner** – full control, including team management.
- **editor** – create/edit events & leads, triage, change status, manage
  permissions, export.
- **viewer** – read-only.

Permissions are enforced both server-side (route handlers) and at the database
(RLS policies).

---

## Known limitations

- **Single team per user** in the MVP (the first membership is used). Multi-team
  switching is not built yet.
- **FFmpeg export** depends on a usable system font and the static binary. If
  either is unavailable in your environment, exports are recorded as `stubbed`
  (intent + gate still enforced) rather than failing.
- **Blur boxes are manual** (fractional coordinates). There is no automatic face
  / license-plate detection by design.
- The **SQL seed** uses the common direct `auth.users` insert pattern; some
  Supabase versions require the Admin-API seed script instead.
- The **capture bookmarklet** opens a pre-filled Add Lead form (human in the
  loop). It deliberately does not POST cross-origin or run in the background.
- AI triage with a **live provider** validates JSON against the required schema
  and falls back to the deterministic stub if the model returns malformed output.

---

## Next upgrades

- Multi-team membership + team switcher and an owner admin surface.
- In-browser blur-box drawing over a video preview (replacing numeric inputs).
- Reverse image/video search helpers and official-source confirmation links.
- Official, permissioned Telegram Bot API adapter (currently a disabled
  placeholder in `src/lib/adapters/telegram.ts`).
- Direct social publishing integrations (with per-platform rights checks).
- Server-side rate limiting on mutation endpoints and richer audit views.

---

## Project structure

```
noteworthy-radar/
  src/
    app/
      (app)/            # authenticated pages (dashboard, events, leads, capture)
      api/              # route handlers (events, leads, triage, captions, exports…)
      auth/signout/     # sign-out route
      login/            # login page
    components/         # UI primitives + feature components
    lib/
      ai/               # provider abstraction, stub engine, triage, captions
      auth/             # session + RBAC
      data/             # query helpers
      domain/           # status rules, risk heuristics, permission gate, keywords, audit
      supabase/         # server/admin/browser clients
      validation/       # Zod schemas (incl. AI triage contract)
      video/            # FFmpeg vertical export
    __tests__/          # Jest unit tests
  supabase/
    migrations/         # SQL schema + RLS + seed + storage
    seed.mjs            # Admin-API seed alternative
```
