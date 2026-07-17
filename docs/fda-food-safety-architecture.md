# Noteworthy Food Safety — Architecture

FDA food-recall and foodborne-illness-outbreak coverage: discovery, canonical
parsing, normalization, correlation, versioning, publication, homepage cards,
a dedicated article experience, and an admin review queue.

**Coverage disclosure:** this release covers **FDA-regulated human food and
beverages only**. USDA FSIS (meat/poultry/egg products) and CDC are *not*
integrated; the provider interface (`netlify/functions/lib/food-safety/providers/`)
is designed so they can be added without changing the domain model. No UI
implies FSIS/CDC coverage.

## Baseline audit (recorded before implementation)

- Repo: static-first site, Netlify Functions (Node 20, CommonJS), Supabase
  Postgres (service-role, RLS blocks anon), Netlify Blobs post store
  (`x-posts`), media store (`post-media`), Auth0 admin, engines pattern under
  `netlify/functions/engines/` with `engine_runs` logging.
- `npm run build` (webpack minify + auth0 inject): **passing** before and
  after this work.
- Pre-existing Jest suite fails on `jest-environment-jsdom` missing — a
  pre-existing failure, not caused by this work. New tests use Node's
  built-in test runner (`node --test`) and do not depend on Jest.

## Official source matrix and trust hierarchy

| Tier | Source | Role | Cadence |
|------|--------|------|---------|
| 1 | [Food Safety Recalls RSS](https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food-safety-recalls/rss.xml) | Low-latency discovery | 5 min |
| 1 | [FDA Outbreaks RSS](https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/fda-outbreaks/rss.xml) | Low-latency discovery | 5 min |
| 1 | [Recalls RSS](https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml) (filtered) | Safety net; strict scope filter | 5 min |
| 1 | [Food Allergies RSS](https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/food-allergies/rss.xml) (filtered) | Safety net; strict scope filter | 5 min |
| 1 | Canonical FDA advisory/announcement page | **Authoritative facts** — nothing publishes without it | on discovery |
| 1 | [Recalls index page](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts) | Structured discovery + reconciliation index | 30 min |
| 1 | [CORE investigation table](https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks) | Outbreak monitoring; FDA reference number = identity | 60 min |
| 2 | [openFDA food enforcement](https://api.fda.gov/food/enforcement.json) | Backfill, recall-number correlation, classification, status reconciliation. Never the trigger; never publishes alone | manual/bounded |
| 3 | FDA/GovDelivery email (`fda-email-trigger`) | Wake-up signal only. Extracts official FDA URLs; never publishes from the email body | webhook |

The recalls index is fetched as the server-rendered HTML table (`#datatable`)
— the XLSX export uses an ephemeral `randparam` cache-buster that is not a
stable contract, so the HTML table is the deliberate choice (see
`docs/fda-food-safety-source-contracts.md`).

Canonical fetches are restricted to an explicit HTTPS host allowlist
(`www.fda.gov`, `fda.gov`, `api.fda.gov`); redirects are re-validated against
the same allowlist.

## Pipeline flow

```
ingest-food-safety (scheduled */5, engine name "fda")
  ├─ poll 4 RSS feeds (ETag/Last-Modified conditional requests)
  ├─ poll recall index table    (every 30 min)
  ├─ poll CORE table, diff rows (every 60 min)
  ├─ scope-filter, hash, upsert food_safety_source_documents (idempotent)
  ├─ record engine_runs entry
  └─ trigger process-food-safety-background when new/changed docs exist

process-food-safety-background (background function; also */15 retry sweep)
  ├─ atomically claim pending docs (optimistic lock + stale-lock recovery)
  ├─ fetch canonical FDA page (allowlist, size cap, timeout, retries)
  ├─ deterministic parse → normalize → classify → build event candidate
  ├─ AI fallback only when FDA_AI_EXTRACTION_ENABLED and prose is ambiguous
  ├─ correlate (reference number → canonical URL → recall number)
  ├─ staleness guard (never overwrite newer official data)
  ├─ diff vs stored event → version record on material change
  ├─ image extraction/ranking/optimization (sharp → post-media blobs;
  │   failure never blocks publication)
  ├─ validate → decide publish state (draft/review/published/suppressed)
  └─ on publish: stable post in the x-posts store + verified_events row

fda-email-trigger (webhook, Svix-verified, fail-closed)
  └─ valid FDA URL → enqueue canonical fetch; otherwise refresh feeds

admin-food-safety (Auth0 admin JWT)
  └─ review queue: evidence, diffs, publish/suppress/reprocess/unlink
```

## Domain model (migration `supabase/migrations/009_create_food_safety.sql`)

- `food_safety_source_documents` — one row per upstream item (RSS entry,
  table row, CORE row, canonical page, openFDA record, email trigger), with
  identity uniqueness `(provider, source_kind, external_id)`, body hash,
  processing status/attempts/backoff, and a link to the canonical event.
- `food_safety_events` — one canonical Noteworthy event per official
  identity (`canonical_key`: CORE reference number, else canonical page
  hash). Consumer presentation fields, hazard, lifecycle, quantitative
  metrics (nullable — absent ≠ 0), geography (case vs distribution kept
  separate), editorial severity + reasons, publish state.
- `food_safety_products` — normalized product/variant rows (brand, name,
  package, UPC, lot, dates, retailers, per-row distribution, evidence).
- `food_safety_event_versions` — immutable version records with structured
  `changed_fields` + `material_changes` + full snapshot. Material hash
  excludes cosmetic markup so HTML noise never increments the update number.
- `verified_events` — compact generic summary row (engine `fda`,
  `food_recall`/`food_outbreak`) for cross-engine monitoring; no product rows
  or raw documents.

All four tables have server-only RLS (same pattern as existing verified-event
tables), `updated_at` triggers, and indexes on canonical keys, source
identity, statuses, queue scheduling, and post IDs.

## Deduplication and update strategy

Identity resolution order (deterministic, no AI merging):
1. FDA CORE reference number → `fda:core:<ref>`
2. Canonical FDA page URL (tracking params stripped) → `fda:page:<hash16>`
3. Recall number (openFDA / page text)
4. Feed GUID / email Message-ID / webhook ID dedupe at the source-document layer

A changed RSS item pointing at the same canonical page **updates** the
existing event; expansions update the same event and add a version;
termination updates status without deleting history; a CORE row that later
gains a product keeps its identity and history. One stable post ID and
article URL per canonical event (`postIdForEvent`). Low-confidence
correlation → review, never auto-merge.

## Auto-publication gate

`ENABLE_FDA`, `FDA_AUTO_PUBLISH`, `FDA_AI_EXTRACTION_ENABLED`,
`FDA_PUSH_NOTIFICATIONS_ENABLED`, `FDA_EMAIL_TRIGGER_ENABLED`,
`FDA_HERO_ELIGIBLE` — all default **false**.

A candidate auto-publishes only when every applicable check passes: allowed
official source; canonical page fetched and parsed; stable canonical
identity; scope filter passed; event kind + subject + hazard + source date
identified; consumer action extracted or safely determinable (recalls); no
unresolved contradictions; confidence ≥ `FDA_CONFIDENCE_THRESHOLD`; material
hash differs from the prior public version; public payload passes the
allowlist; no duplicate event; no review rule triggered. A missing image
never blocks publication. Review triggers include CORE-only unknown product
without consumer value, conflicting totals, unparseable distribution states,
unrecognized allergens, parser drift, disallowed redirects, and possible
drug/supplement/pet-food categories.

## Review queue

`admin-food-safety` (Auth0 admin JWT, same auth as existing admin APIs):
list review/draft/published events, inspect field-level evidence and version
diffs, publish, suppress, reprocess a source document, unlink a document from
an event. Suppression and unlink preserve audit history; nothing is deleted.

## Mapping rules

`src/components/food-safety/FoodSafetyMap.js` + vendored Census-derived
geometry (`assets/food-safety/us-states.json`, built by
`npm run fda:build-geometry` from us-atlas; no runtime CDN).

- Two explicit modes: **cases** and **distribution** — never merged.
- Choropleth only when official per-state counts exist; otherwise binary
  highlighting.
- Explicit nationwide gets an honest all-states treatment with the label
  "State-level records were not individually supplied."
- Unknown geography renders a plain-language notice, never a guess.
- Text/table alternative always renders below the SVG; keyboard focus,
  ARIA labels, `prefers-reduced-motion`, DC included, territories listed as
  text (outside the AlbersUsa projection).
- Never derives numbers from FDA map colors; never infers states from
  headquarters addresses.

## Image rules

Ranking: product/package photo → product group → label → retail display →
official distribution graphic → pathogen image (outbreaks without product) →
neutral placeholder. FDA seals, logos, and generic graphics are excluded as
heroes when a product photo exists. Every image: hostname+protocol
validation, Content-Type check, size cap, sharp re-encode, hash dedupe,
stored in the existing `post-media` blob store, original source URL + credit
retained, alt text generated from validated context. Packaging renders with
`object-fit: contain` so UPCs stay readable. No AI-generated product photos.

## Security model

- HTTPS-only fetching against an FDA host allowlist, redirect re-validation,
  timeouts, response-size caps, content-type checks (SSRF-hardened client in
  `lib/food-safety/httpClient.js`).
- Service-role Supabase access server-side only; RLS on all new tables.
- Public endpoints (`food-safety-event`, `posts-read`) apply strict field
  allowlists — no processing state, confidence, evidence, hashes, prompts, or
  raw source bodies ever leave the server (tested in
  `tests/food-safety/public-api.test.js`).
- Background trigger requires `FOOD_SAFETY_INTERNAL_TOKEN`
  (constant-time comparison).
- Email webhook: Svix signature verification fails closed in production,
  replay/duplicate rejection, recipient + sender/domain allowlists,
  quarantine for unexpected senders, no auto-replies, no publication from
  email bodies.
- Admin API requires an Auth0 admin JWT (existing middleware pattern).

## Failure modes

| Failure | Behavior |
|---------|----------|
| RSS unreachable | engine run records degraded status; other feeds proceed; stale-source alert past threshold |
| Canonical page unparseable | source doc → review with parser warning; admin alert; never silently dropped |
| Recall table/CORE layout drift | parser throws `*_parser_drift`, run records failure, alert |
| Image failure | publish proceeds without image |
| AI unavailable/disabled | deterministic parsing continues |
| openFDA missing/no key | RSS/canonical processing unaffected |
| Conflicting official counts | review + evidence shown in admin |
| Stale data arriving late | staleness guard refuses overwrite of newer official data |
| Duplicate signals (RSS/table/email/openFDA) | one canonical key → one event → one post |
| Concurrent invocations | atomic claim + lock TTL prevents double-publication |

## Environment variables

See `ENV_KEYS.md` (FDA Food Safety section) for the full annotated list:
flags (`ENABLE_FDA`, `FDA_AUTO_PUBLISH`, `FDA_AI_EXTRACTION_ENABLED`,
`FDA_PUSH_NOTIFICATIONS_ENABLED`, `FDA_EMAIL_TRIGGER_ENABLED`,
`FDA_HERO_ELIGIBLE`), secrets (`FOOD_SAFETY_INTERNAL_TOKEN`,
`FDA_EMAIL_WEBHOOK_SECRET`, `OPENFDA_API_KEY`), email allowlists, and tuning
knobs. All default to safe values; the site functions identically with every
flag false.

## Deployment and rollback

Deployment:
1. Apply `supabase/migrations/009_create_food_safety.sql` (idempotent).
2. Deploy functions (netlify.toml already schedules `ingest-food-safety`
   every 5 min and the background retry sweep every 15 min).
3. Set `FOOD_SAFETY_INTERNAL_TOKEN`; leave all `FDA_*` flags false.
4. Enable `ENABLE_FDA=true` → discovery + review-queue population only.
5. After reviewing candidates, optionally `FDA_AUTO_PUBLISH=true`.

Rollback: set `ENABLE_FDA=false` (and/or `FDA_AUTO_PUBLISH=false`). Data and
history remain intact; nothing else on the site depends on the flags. See
`docs/fda-food-safety-runbook.md` for detailed procedures.

## Source documentation relied upon

- https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds (feed directory)
- https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts (index + table)
- https://www.fda.gov/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks (CORE)
- https://open.fda.gov/apis/food/enforcement/ (openFDA food enforcement API)
- https://open.fda.gov/apis/authentication/ (API keys and limits)
- https://www.fda.gov/food/food-labeling-nutrition/food-allergies (nine major allergens, FASTER Act)
- https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests (Svix verification)
- https://github.com/topojson/us-atlas (Census-derived state geometry, vendored)
