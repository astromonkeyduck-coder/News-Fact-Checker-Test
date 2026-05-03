# AP Euro Timeline — UI Audit / Acceptance Criteria (V2)

## Core Issues Addressed

| Issue | Status | How |
|-------|--------|-----|
| Timeline positioning bug (events ending at wrong year) | FIXED | Replaced positioned timeline with chronological scroll layout |
| Too much clicking between 10 tabs | FIXED | 4 modes; default Study Guide is one scrollable page with everything inline |
| Missing content (only 113 events) | FIXED | Added ~300 items: works, paintings, wars, treaties, innovations, thinkers, popes, women, leaders |

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Tier 1 events identifiable without hover | PASS — event cards show date, title, tier badge |
| 2 | Labels not cut off | PASS — normal text flow, no overflow:hidden on titles |
| 3 | Overlaps visible | PASS — events appear in chronological era sections showing simultaneous developments |
| 4 | Processes show context | PASS — each era has summary, thinkers, leaders, and works providing context |
| 5 | Whole course viewable by scrolling | PASS — Study Guide page scrolls through all 8 eras |
| 6 | Can study one period deeply | PASS — each era section is self-contained with all content types |
| 7 | Causation chains visible | PASS — dedicated Exam Prep section with 12 visual chains |
| 8 | DBQ/LEQ mode exists | PASS — Exam Prep page has 6 period guides with evidence, chains, comparisons, complexity |
| 9 | Design is polished and readable | PASS — light academic theme, generous spacing, high contrast |
| 10 | Content historically accurate | PASS — timeline_data.json unchanged; new content from user's verified study guide |
| 11 | Laptop usable | PASS — responsive design with breakpoints at 768px |
| 12 | Print poster | PASS — print CSS outputs landscape without controls |
| 13 | Night-before cram view | PASS — dedicated mode with T1 events, chains, comparisons, CCOT |
| 14 | No mystery dots | PASS — all items are labeled cards or text entries |
| 15 | Teaches development | PASS — era summaries, thinker progressions, causation chains, CCOT patterns |

## Content Inventory

| Category | Count |
|----------|-------|
| Timeline events (from JSON) | 113 |
| Key intellectual works | 36 |
| Key paintings | 33 |
| Wars & conflicts | 12 |
| Treaties & agreements | 12 |
| Innovations | 12 |
| Key popes | 10 |
| Influential women | 17 |
| Intellectual eras / schools | 6 (with ~45 thinkers) |
| Political leaders | ~65 across 5 countries |
| Causation chains | 12 |
| Comparison pairs | 18 |
| CCOT patterns | 8 |
| DBQ/LEQ period guides | 6 |
| **Total items** | **~400+** |

## Features

- [x] Scrollable single-page study guide organized by 8 eras
- [x] Consolidated exam prep (causation, comparison, CCOT, DBQ/LEQ)
- [x] Reference tables for events, works, paintings, wars, treaties, innovations
- [x] Night-before cram view
- [x] Search across all content types
- [x] Quick-jump chips for 17 topics
- [x] Collapsible era sections
- [x] Progressive disclosure (supporting events hidden by default)
- [x] Detail panel for timeline events
- [x] Dark mode toggle
- [x] Print CSS
- [x] Keyboard shortcuts (/, Esc)
- [x] Responsive design
