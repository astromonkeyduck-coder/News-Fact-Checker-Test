# Noteworthy Food Safety — Operations Runbook

Practical procedures. Architecture background lives in
`docs/fda-food-safety-architecture.md`.

## Enable in dry-run (discovery + review queue only)

1. Apply the migration: `supabase/migrations/009_create_food_safety.sql`
   (Supabase SQL editor or CLI; idempotent).
2. In Netlify env vars set:
   - `FOOD_SAFETY_INTERNAL_TOKEN=<long random string>`
   - `ENABLE_FDA=true`
   - leave `FDA_AUTO_PUBLISH` unset/false.
3. Deploy. `ingest-food-safety` runs every 5 minutes; candidates accumulate
   as `food_safety_source_documents` and validated events land in
   `publish_state='review'`. Nothing appears publicly.

## Inspect candidates

- Admin API: `GET /.netlify/functions/admin-food-safety?state=review`
  (Auth0 admin JWT required) — lists events with review reasons.
- `GET /.netlify/functions/admin-food-safety?id=<event-id>` — full detail:
  extracted fields, evidence excerpts, product rows, image candidates,
  correlation result, version diffs, validation errors.
- Direct SQL: `select display_title, publish_state, review_reason from
  food_safety_events order by created_at desc;`
- Engine health: `select * from engine_runs where engine='fda' order by
  ran_at desc limit 20;`

## Enable auto-publication

Set `FDA_AUTO_PUBLISH=true` after you are satisfied with review-queue
quality. Only candidates passing the full validation gate publish; anything
with a review reason still waits. Publish a queued item manually with
`POST /.netlify/functions/admin-food-safety` body
`{"action":"publish","id":"<event-id>"}`.

## Configure the FDA email trigger (optional latency backstop)

1. Create the inbound alias (default `fda-alerts@noteworthynews.co`) in
   Resend and subscribe it to FDA recall/outbreak emails at
   https://www.fda.gov/about-fda/contact-fda/stay-informed/get-email-updates.
2. Point the Resend inbound webhook at
   `/.netlify/functions/fda-email-trigger` and copy the signing secret into
   `FDA_EMAIL_WEBHOOK_SECRET`.
3. Set `FDA_EMAIL_TRIGGER_ENABLED=true`. Optionally tighten
   `FDA_EMAIL_ALLOWED_SENDERS` / `FDA_EMAIL_ALLOWED_DOMAINS`.
4. Production behavior is fail-closed: missing/invalid signature → rejected;
   replayed webhook → acknowledged without reprocessing; unknown sender →
   quarantined log entry. Emails only ever *enqueue official FDA URLs* — no
   content is published from an email body.

## Backfills and replays

- Replay a saved fixture through the full deterministic pipeline (no writes):
  `npm run fda:replay -- --fixture=recall-allergen-peanut`
- Reprocess one live FDA URL read-only:
  `npm run fda:replay -- --url=https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/...`
- Re-enqueue a stuck source document:
  `POST admin-food-safety {"action":"reprocess","document_id":"<doc-id>"}`
- openFDA historical backfill (bounded, resumable; consumer-facing retail alerts only by default):
  ```bash
  npm run fda:backfill -- \
    --since=2026-05-01 \
    --limit=250 \
    --max-enqueue=10 \
    --class=I,II \
    --consumer-only \
    --dry-run
  ```
  Review the summary (`food_safety_scope`, `consumer_facing`, `excluded_industrial`,
  `excluded_supplement`). Add `--print-skips` to see each exclusion reason.
  Remove `--dry-run` only after the filtered set looks right. Use `--cursor=N`
  from `next_cursor=` to resume scanning. Use `--include-industrial` to override
  the consumer-facing gate (not recommended for initial import).
- Status reconciliation (terminations, classifications):
  `npm run fda:reconcile -- --dry-run`

## Suppress a false match

`POST admin-food-safety {"action":"suppress","id":"<event-id>","reason":"..."}`.
Suppression unpublishes the post pointer, keeps all source history, and the
event can never silently re-publish (suppressed is sticky in
`decidePublishState`).

## Correct a published event

1. Prefer reprocessing: fix the parser (add a fixture + test), then
   `{"action":"reprocess","document_id":...}` — the event rebuilds from the
   official source and a new version records the change.
2. For an urgent manual fix, update the row in `food_safety_events` and add a
   note; the next official update will rewrite from source, so parser fixes
   are the durable path.
3. Never edit `food_safety_event_versions` — versions are the audit trail.

## Roll back without deleting source history

Set `ENABLE_FDA=false`. Ingestion and processing stop; published articles
remain readable (they are static posts + a read-only detail endpoint). To
also hide articles, suppress the specific events. Do not drop tables; the
flag path is the supported rollback.

## Inspect stale feeds / parser drift

- `select source_kind, max(last_seen_at) from food_safety_source_documents
  group by 1;` — a Tier-1 feed silent for hours during a weekday is suspect.
- Parser drift throws `recall_table_parser_drift` / `core_table_parser_drift`
  and records a failed engine run; admin alerts go to
  `FDA_ADMIN_ALERT_EMAIL` (fallback `ALERT_TO_EMAIL`).
- Procedure: capture the new page into `tests/food-safety/fixtures/`
  (update `.meta.json` capture date), adjust the parser, run
  `npm run fda:test`, deploy.

## Rotate secrets

- `FOOD_SAFETY_INTERNAL_TOKEN`: set the new value in Netlify env, redeploy.
  Only inter-function calls use it; no client impact.
- `FDA_EMAIL_WEBHOOK_SECRET`: rotate in the Resend dashboard first, then
  update the env var; the webhook fails closed during any mismatch window.

## Disable pushes independently

`FDA_PUSH_NOTIFICATIONS_ENABLED=false` (the default). The publication path
never sends pushes while false; no push is ever sent before the stable
article URL exists.

## What happens when AI is disabled

`FDA_AI_EXTRACTION_ENABLED=false` (default): the deterministic parsers handle
FDA's structured layouts (JSON-LD, summary description lists, labeled
sections, case-count blocks). Pages that deterministic parsing cannot
confidently interpret route to review instead of using AI. Nothing else
degrades.

## What the system does not cover

- USDA FSIS (meat, poultry, egg products) — not integrated.
- CDC outbreak pages — not integrated.
- Pet food and dietary supplements — excluded by scope filter by design
  (future explicit feature flags; disabled in this release).
- State-level recalls not published by FDA.
- The label on the site must continue to say FDA food-safety coverage.
