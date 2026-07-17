# Noteworthy Food Safety — Editorial Rules

Deterministic rules the code enforces. Changing any of these means changing
`classify.js`, `severity.js`, `publish.js`, or `validate.js` *and* their
tests.

## Scope

Include: FDA human food/beverage recalls, safety alerts, and foodborne
outbreaks — named pathogens (Salmonella, Listeria, STEC/E. coli, Cyclospora,
Norovirus, botulism, Cronobacter, Hepatitis A, Vibrio, Campylobacter,
Shigella, Bacillus cereus…), undeclared major allergens, significant
chemical/foreign-material hazards, infant formula and baby-food incidents,
and anything where FDA gives a clear consumer action.

Exclude: drugs (Rx/OTC), medical devices, biologics, cosmetics, tobacco,
veterinary/pet food, dietary supplements, policy/meeting/educational items,
and duplicate translations of an already-covered event. Pet food and
supplements stay excluded until they receive their own explicit flags.

**The nine U.S. major allergens** (FASTER Act — never extend this list):
milk, egg, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans,
sesame. There is no federal "top 15."

## Titles

Patterns, in priority order (product → brand → hazard → company → status):

- `[Product] recalled over possible [hazard] contamination`
- `[Brand/Company] recalls [product] over undeclared [allergen]`
- `[Pathogen] outbreak linked to [product or venue]`
- `FDA investigates [pathogen] outbreak; food source not yet identified`
- `[Company] expands recall of [product]`

Never lead with "Company Announcement" or legal boilerplate. Never copy the
full bureaucratic FDA headline when the product would be unclear.

## Numeric truth

- Absent numbers are `null` and render as nothing or "Not reported" — never 0.
- "No illnesses have been reported" → 0, only because the source is explicit.
- "At least 12" keeps its qualifier in evidence; never presented as exact.
- Never combine totals from separate outbreaks, confuse complaints with
  confirmed cases, or let an older section overwrite a newer total.
- Conflicting official sections → review, with both values shown to admins.
- `0 deaths` appears on cards only when FDA explicitly reported zero.

## Geography truth

- Case states and distribution states are separate facts, labeled
  separately ("States with confirmed cases" vs "States where product was
  distributed"), and are never merged or cross-assigned.
- "Nationwide" appears only when the official text says nationwide (or an
  explicit equivalent).
- Per-state counts render only when officially supplied; a national total is
  never allocated across states; FDA map colors are never read as data.
- Distribution prose that cannot be safely normalized to states routes to
  review and renders as the original official text.

## Severity (Noteworthy editorial 1–5, never presented as FDA classification)

- **5** — explicit deaths; botulism-class acute hazard; life-threatening
  infant food hazard; major nationwide Class I with immediate action;
  exceptionally large outbreak with severe outcomes.
- **4** — confirmed multistate outbreak; reported hospitalizations; active
  recall expansion; major allergen with broad distribution and immediate
  action; serious pathogen with broad distribution.
- **3** — actionable consumer recall; undeclared major allergen; significant
  foreign-material/chemical/toxin hazard; limited-state contamination with
  no reported illnesses.
- **2** — lower-urgency withdrawal; localized; ended/terminated updates
  (capped at 2 regardless of prior severity).
- **1** — monitoring-only/administrative.

Reasons are stored (`severity_reasons`) so every score is auditable. FDA's
own recall classification is stored separately in
`fda_recall_classification`.

## Consumer action

`public_action` values ("Do not eat", "Check your freezer", "Return or
discard", "Check the UPC and lot"…) derive only from official FDA
instructions. A recall without a determinable action routes to review rather
than shipping with an invented instruction. Health-risk copy stays brief,
summarizes FDA language, and links to the official source — no symptom walls,
no personalized medical advice.

## Cards and hero

- Card kicker: FOOD RECALL / OUTBREAK / ALLERGEN ALERT / SAFETY ALERT, or
  `UPDATE n` when the event has a public update number.
- Card footer: metric summary (only reported numbers) or hazard label, plus
  geography label; red metric treatment only when illnesses > 0 are
  officially reported.
- Product packaging thumbnails use `object-fit: contain` — UPCs and labels
  stay readable.
- A food-safety post may take the homepage hero only when severity ≥ 4,
  real media exists, a consumer action exists, and `FDA_HERO_ELIGIBLE`
  is enabled (plus normal editorial ordering). Routine recalls never seize
  the hero.

## Updates

- The public update number increments only on material changes (new
  products/lots, new states, new totals, product identified, expansion,
  termination). Cosmetic HTML changes never increment it.
- "What changed" copy is generated from the structured version diff
  (`material_changes`), never from an AI summary.
- Termination/ended updates change status and cap severity; they never
  delete the article or its history.

## Images

Real FDA product photography only, ranked product-first; logos, seals, and
generic pathogen micrographs are last-resort. No AI-generated product
images, ever. Missing images never block an alert.

## AI usage

AI extraction is a fallback (off by default) with a strict evidence-bearing
schema; it cannot override deterministically validated values, cannot invent
missing fields, cannot convert absent to zero, and low-confidence output
routes to review. Consumer-facing copy is produced by deterministic templates
from validated fields.
