# AP Euro Timeline — Visual Redesign Notes

## V2 Upgrade (May 2, 2026)

### What Changed

Complete rebuild from a 10-tab dashboard into a scrollable all-in-one study system with massive content expansion.

### Problems Fixed

1. **Timeline positioning bug**: Events with date ranges (like "Columbian Exchange, 1500-1650") previously displayed at a fixed width based on title length, not their actual time span. The overview timeline has been replaced with a chronological scrollable layout that eliminates this class of bug entirely.

2. **Too much clicking**: The previous 10-tab system (Overview, By Unit, By Theme, By Geo-SPRITE, Causation, Comparison, CCOT, DBQ/LEQ, Night Before, Dense Table) required clicking between isolated views to see the full picture. Replaced with 4 simple modes:
   - **Study Guide**: One long scrollable page organized by era with ALL content inline
   - **Exam Prep**: Consolidated causation chains, comparison pairs, CCOT patterns, and DBQ/LEQ evidence in one scrollable page
   - **Reference Tables**: Dense sortable tables for events, works, paintings, wars, treaties, innovations
   - **Night Before**: Cram sheet with essentials only

3. **Content gaps**: The previous version had only 113 timeline events. V2 adds ~300 additional items:
   - 36 key intellectual works (Machiavelli through Fukuyama)
   - 33 key paintings (Renaissance through Modern)
   - 12 wars with antagonists, battles, outcomes
   - 12 treaties with terms and importance
   - 12 innovations with impact
   - 10 key popes
   - 17 influential women
   - 6 intellectual eras with ~45 thinkers total
   - ~65 political leaders across 5 countries (England, France, HRE/Austria, Prussia/Germany, Russia)
   - 12 causation chains
   - 18 comparison pairs
   - 8 CCOT patterns
   - 6 DBQ/LEQ period guides

### Architecture

- **Study Guide page**: Loops through 8 eras (Medieval, Renaissance, Reformation, Absolutism, Enlightenment, Industrial, World Wars, Cold War). Each era section includes all content types: events, works, paintings, wars, treaties, innovations, thinkers, popes, women, leaders.
- **Era sections are collapsible**: Click header to expand/collapse. Supporting events use `<details>` for progressive disclosure.
- **Search filters across all content types** in real time.
- **Quick-jump chips** for 17 major topics.
- **Detail panel** opens for any timeline event with full metadata.

### Data Integrity

- `timeline_data.json` unchanged (113 events)
- All new content embedded as JS constants derived from the user's study guide
- No events invented; all content historically accurate
- College Board-safe descriptions

### Files

- `index.html` — complete V2 rebuild
- `index_old.html` — backup of V1
- `timeline_data.json` — unchanged
