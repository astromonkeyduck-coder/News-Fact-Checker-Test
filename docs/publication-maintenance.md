# Publishing and maintaining Noteworthy News

This release adds a small local editorial workflow to the existing static site. It uses JSON files and Node's standard library. It never calls the production API, sends a subscriber message, updates an existing Netlify Blob, or deploys a site. `publish` below means **approve a record for the local public export**. Deployment remains a separate reviewable action.

## Keep drafts private

Keep working records, responsible-person files, source notes and previews **outside the deployed directory**, for example in a private `noteworthy-editorial` folder next to your project. This guide uses `/private/tmp/noteworthy-editorial` only for a disposable trial. Use a durable private directory and backups for actual work. Do not put confidential source material into public JSON, a Git repository, or an AI upload. The checked-in `publication/editorial/records/` is empty; only `publication/editorial/published.json` is intended for reader access.

Use the existing article ID when updating imported or previously published coverage. Never change `2096717577204502980`, `fda-page-1b6014ef53e61d57`, `usgs-us7000tgrk`, or another inbound ID to create a new URL for the same article.

## Prepare a draft

Create a private `editor.json` containing the **actual responsible person**, for example this schema with your verified details substituted. The placeholder is documentation, not a staff identity:

```json
{
  "name": "YOUR VERIFIED FULL NAME",
  "role": "YOUR ACTUAL RESPONSIBILITY",
  "verified": true
}
```

`verified` is the editor's explicit attestation, not an automated identity check. No full staff names were verified during this development pass. Do not infer a surname from an email, machine username or repository path. The CLI records actors privately; the public export contains responsibility name and role, without the actor email or internal approval notes. Have a second editor review when one is available; the system also supports a single editor and records that honestly.

Prepare `source.json` with supported content. A short update may have a single paragraph. Fields:

| Field | Purpose |
| --- | --- |
| `id`, `title`, `summary` | Existing stable ID, complete headline, optional supported deck. Never store headline truncation. |
| `format` | `reporting`, `analysis`, `opinion`, `wire-update`, or `automated-agency-summary`. |
| `body` | Array of `{ "text": "…", "sourceIds": ["source-1"] }` paragraphs. Plain text, with nearby linked sources in the preview. |
| `sources` | Array of `{ "id": "source-1", "name": "Actual document or publisher", "url": "https://…", "kind": "primary" }`. Other kinds: `upstream-reporting`, `distribution`. |
| `byline` | Optional known attribution. A person needs `type: "person"`, `name`, and `biographyUrl`. Do not assign a person to an automated summary. |
| `claimStatus` | `confirmed`, `attributed`, `disputed`, `not-independently-verified`. |
| `lifecycle` | `updating`, `paused`, `closed`; independent of claim status. |
| `media` | Optional array of media with `url`, `caption`, `credit`. Only use actual available assets. |
| `publishedAt`, `updatedAt` | Preserve documented existing article timestamps when adopting a legacy record. Omit for new unpublished coverage. Include timezone, e.g. `2026-09-12T10:00:00-04:00`. |
| `sourcePublishedAt` | The original source or event timestamp, if known; distinct from the site's publication timestamp. |
| `sourcingLimitation` | Explicitly state any limitation if only a distribution post or limited source trail survives. |
| `import` | For agency updates: actual `agency`, validated `pageType`, `language`, `ambiguous`, and review `reasons` where relevant. Preserve unknown counts as `null`. |

Own X posts are `distribution` sources. They do not become primary evidence because Noteworthy posted them. A missing evidence trail can be described honestly with `sourcingLimitation` and appropriate claim status. Do not write extra paragraphs to disguise a short update.

## Review, preview and publish locally

Run these commands from the repository root after substituting your private directory and existing article ID:

```sh
node scripts/publication-editorial.js create /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --input /private/tmp/noteworthy-editorial/source.json --actor /private/tmp/noteworthy-editorial/editor.json
node scripts/publication-editorial.js submit /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --actor /private/tmp/noteworthy-editorial/editor.json
node scripts/publication-editorial.js validate /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json
node scripts/publication-editorial.js preview /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --actor /private/tmp/noteworthy-editorial/editor.json --out /private/tmp/noteworthy-editorial/preview.html
```

Open the generated HTML locally. Check the full headline, every claim, source links, actual attribution, chronology, unknown fields and corrections. The preview is marked as a local draft and `noindex`; that marking is not access control.

```sh
node scripts/publication-editorial.js approve /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --actor /private/tmp/noteworthy-editorial/editor.json --note "Describe which source documents and claims you checked."
node scripts/publication-editorial.js publish /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --actor /private/tmp/noteworthy-editorial/editor.json
node scripts/publication-editorial.js export /private/tmp/noteworthy-editorial/records --out publication/editorial/published.json
```

Publication requires both a current preview and approval matching the actual content. Editing content after either step invalidates that step. Each command records its actor and time. Export includes only `published` and `corrected` records. It retains the last published version while a revision is drafted or reviewed, so beginning an edit does not remove the existing article. Export rejects duplicate IDs.

The release builder consumes the public JSON alongside the existing source snapshot. Rebuild the release using the project's publication build command, review the resulting homepage/article/corrections pages, then review deployment separately. Running this CLI alone does not change a live page or update the ingestion pipeline.

## Agency imports

Accept a structured agency summary only when the originating document type is established: `earthquake-event`, `food-recall`, `drug-recall`, `outbreak-notice`, or `weather-alert`. A research page, general information page, translated fragment, or unknown document is not a confirmed recall or outbreak. Keep medication recalls separate from food recalls. Unknown illnesses are `null`, not zero.

Set `import.ambiguous: true` and explain `import.reasons` when extraction is uncertain. It can enter review but cannot publish without an explicit source decision. After inspecting the original page, correct the fields and run:

```sh
node scripts/publication-editorial.js approve /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --actor /private/tmp/noteworthy-editorial/editor.json --note "Record the original document, classification decision, and why each flagged claim is supported." --resolve-import
node scripts/publication-editorial.js preview /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --actor /private/tmp/noteworthy-editorial/editor.json --out /private/tmp/noteworthy-editorial/preview.html
```

Inspect that new preview before publication. The source decision changes the record, so it requires a fresh preview. This tool does not assert that an automated summary was reviewed by a human unless a person actually records review. Existing live ingestion remains a separate system; review its queued records before adopting them into this export.

## Updates and substantive corrections

Use an ordinary update when adding supported information without correcting an error. Prepare a `patch.json` with only the changed public fields, then run:

```sh
node scripts/publication-editorial.js revise /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --patch /private/tmp/noteworthy-editorial/patch.json --actor /private/tmp/noteworthy-editorial/editor.json --note "Explain the new information."
```

Use a correction for a wrong fact, misleading classification, attribution error or other substantive error. The correction must say what was wrong and what is correct:

```sh
node scripts/publication-editorial.js correct /private/tmp/noteworthy-editorial/records/ARTICLE_ID.json --patch /private/tmp/noteworthy-editorial/patch.json --actor /private/tmp/noteworthy-editorial/editor.json --note "Explain the substantive error and its effect." --before "The original inaccurate information." --after "The supported corrected information."
```

Both commands produce a draft revision. Repeat submit → validate → preview → approve → publish → export. Original publication time remains unchanged. A meaningful published revision gets an update timestamp. Corrections and ordinary updates occupy different arrays. The correction export includes its article URL, timestamp, responsible editor, original error and replacement. Changes to the correction text after review invalidate the approval. A no-op revision is rejected to prevent date refreshing.

For a live legacy article absent from the local workflow, adopt its **actual existing content and timestamps** into a draft, review it and export it first; then start the correction. Do not use a placeholder article as the original version. Never edit the public correction arrays by hand to remove an error history.

## Maintenance and checks

```sh
node --test tests/publication/editorial.test.js
node scripts/publication-editorial.js --help
```

Seventeen local tests cover workflow gates, changed-content rejection, ambiguous imports, source classification, unknown counts, timestamps, corrections vs updates, preserved inbound IDs, safe preview escaping, a complete credential-free CLI trial, preference error handling, and article correction form context. They do not establish factual accuracy; actual source review is still required.

Inspect each updated article at phone and desktop widths, keyboard controls, media credits, claim/source proximity and the public corrections page. Review source freshness using the source/event timestamp. Never update a publication date solely because an import or build ran again.

The newsletter preferences and contact tests use local mocked responses and **send no emails**. Delivery, real unsubscribe behavior, authenticated profile, audience enrollment and preference persistence still need an owner-provided test account and an isolated service environment. Preserve existing subscribers and legacy/signed links. See `docs/publication-integrations.md` for the exact limits and remaining owner decisions.

### Release integration

Run `npm run publication:build` after exporting the public JSON, then restart `npm run publication:preview` to pick up server-side record changes. Public articles render paragraph source links, actual supplied responsibility and source/event time, and substantive correction records; `/corrections.html` reads the same public correction export. The release also contains one documented source-import correction in `lib/publicationSourceQuality.js`, preserved alongside the immutable snapshot. Deploying the prepared release remains separate from local publication/export commands.

The deployed homepage/archive read the current public posts service. The preview and static RSS/sitemap use `publication/data/posts.json`, a dated public snapshot with provenance. Refresh that snapshot through a read-only public fetch, retain its provenance, rebuild and review the generated RSS/sitemap before deployment. The archive describes its available-record window rather than claiming unlimited historical coverage.

### Story so far revisions and optional reading memory

Each curated guide in `publication/data/story-guides.json` has a stable slug, a date-only `updatedAt`, and an explicit positive integer `version` starting at 1. **Increment `version` only after reviewing a substantive factual addition or correction.** A build, scrape, cosmetic edit or changed date alone must not increment it. Keep a clear explanation of the meaningful change with the guide's editorial record. Never reuse an older version number for different content. Several substantive revisions on one day receive successive versions even though their displayed date is identical.

The rendered guide and index card expose `data-guide-version`, alongside slug, title and date. Optional reading memory stores only `{slug, revision, version}` under `noteworthy-story-briefs-v1`. “Updated since you read” compares the actual briefing version number, not the date. A later date with the same version does not trigger it; an older tab cannot overwrite acknowledgement of a newer version. Opening or revisiting a page never acknowledges a version. The reader must choose Remember or Mark this version as read. Forget and index Clear affect this feature only, not account bookmarks or subscriptions.

This undeployed initial schema requires a stored version as well as a date. Malformed or earlier trial records are not silently replaced; the interface explains the problem and allows explicit Clear from the index. Validate with `node --test tests/publication/reading-state.test.js`: 16 local tests cover same-day revisions, date-only nonchanges, older-tab protection, explicit opt-in, blocked/corrupt storage and the rendered control behavior. Actual source review and browser accessibility checks remain separate.
