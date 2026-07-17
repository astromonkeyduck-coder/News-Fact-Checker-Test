# Noteworthy Food Safety — Source Contracts

What we depend on from each official source, verified against live captures
on 2026-07-17 (see `tests/food-safety/fixtures/*.meta.json`). When a contract
breaks, the parser must throw a `*_parser_drift` error and route to review —
never guess.

## 1. RSS feeds (Tier 1 discovery)

URLs (config.js `FEEDS`):
- food-safety-recalls, fda-outbreaks (unfiltered)
- recalls, food-allergies (filtered safety nets; strict scope filter applies)

Contract: RSS 2.0, `item.title`, `item.link` (http:// links normalized to
https://www.fda.gov), `item.guid`, `item.pubDate`. Conditional requests via
ETag/Last-Modified when the server supplies them. The general feeds contain
drugs/devices/etc. and pass through `scopeFilter` before creating candidates.

## 2. Canonical recall announcement pages

Path prefix: `/safety/recalls-market-withdrawals-safety-alerts/<slug>`

Parsed in deterministic order (`providers/fda/canonicalPage.js`):
1. JSON-LD `Article` block → headline, datePublished, dateModified
2. `dl.lcds-description-list` summary grid → labeled fields
   (Company Announcement Date, FDA Publish Date, Product Type, Reason for
   Announcement/Recall Reason Description, Company Name, Brand Name(s),
   Product Description)
3. "Company Announcement" narrative → product detail rows (numbered
   `(1) …; UPC …; Date Codes …` entries), lot codes (must contain a digit),
   UPCs (12–14 digit), explicit-zero illness statements, consumer
   instructions
4. Product photo gallery: `/files/styles/recall_image_small/...` thumbnails
   with full-size originals derived by stripping the style segment
5. Distribution sentences → state extraction (list-like contexts only)

## 3. Outbreak advisory pages

Path prefix: `/food/outbreaks-foodborne-illness/<slug>`

Contract: callout action line ("Do not eat…"), labeled sections
(Product:, Status:, Recommendations:, Current Update), and a "Case Counts"
block with labeled rows (Total Illnesses / Hospitalizations / Deaths /
Last illness onset / States with Cases). Explicit `Deaths: 0` normalizes to
0; an absent metric stays null. Narrative totals are cross-checked against
the block; a conflict routes to review with both values in evidence.

## 4. Recalls index page (structured discovery)

URL: `/safety/recalls-market-withdrawals-safety-alerts`

Contract: server-rendered `<table id="datatable">` with columns Date,
Brand Name(s), Product Description, Product Type, Recall Reason Description,
Company Name, Terminated Recall(s), Excerpt; first cell links to the
canonical page. **Deliberate choice:** the XLSX export endpoint carries an
ephemeral `randparam` cache-buster and is not a stable contract, so the HTML
table is the reliable index. This table is an index only — the canonical page
is always fetched before publication.

## 5. CORE investigation table

URL: `/food/outbreaks-foodborne-illness/investigations-foodborne-illness-outbreaks`

Contract: first `<table>` with headers including Date Posted, Reference #,
Pathogen/Cause, Product(s) Linked to Illnesses, Case Count, Investigation
Status, Outbreak/Event Status, and initiated-action columns (Recall,
Traceback, Sampling, On-site inspection). The FDA reference number is the
primary outbreak identity (`fda:core:<ref>`). "Not yet identified" (and
variants matching `UNKNOWN_PRODUCT_RE`) is never treated as a product name;
such rows are monitored and only publish under the CORE-only review rules.

## 6. openFDA food enforcement (Tier 2)

URL: `https://api.fda.gov/food/enforcement.json`

Contract: JSON with `results[]` records: `recall_number`, `event_id`,
`status` (Ongoing/Completed/Terminated), `classification` (Class I/II/III),
`recalling_firm`, `product_description`, `reason_for_recall`,
`distribution_pattern`, `code_info`, `recall_initiation_date`,
`report_date` (YYYYMMDD). Weekly-refresh lag is expected. Used only for
backfill/correlation/reconciliation — a lone openFDA record never creates a
public alert (`validate.js` review rules + reconcile tooling enforce this).
`OPENFDA_API_KEY` optional; limits respected with bounded retries and
cursored pagination.

## 7. FDA/GovDelivery email (Tier 3)

Sender domains typically `fda.gov`, `govdelivery.com` family (configurable
allowlist). Contract: we extract only `https://www.fda.gov/...` URLs from the
body; anything else is ignored. The email is a wake-up signal — content is
never trusted, attachments are never used as product images.

## Known layout risks

- FDA periodically redesigns recall pages; JSON-LD and the lcds description
  list have been stable, but the narrative product-row format varies by
  company announcement. Rows that fail to parse leave `products` empty and
  the event routes to review (`product_not_identified` for recalls).
- The CORE table occasionally adds columns; header-name matching (not
  positional indexing) absorbs column reordering but not renames.
- Per-state case counts are *rarely* machine-readable — FDA usually
  publishes only a state list plus an image map. We never OCR map colors;
  the map shows binary highlighting and the article states that per-state
  counts were not provided.
