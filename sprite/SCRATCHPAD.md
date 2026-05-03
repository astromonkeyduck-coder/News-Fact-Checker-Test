# Geo-SPRITE Master System — Session Scratchpad

## Status
- [x] Phase 1: Routing + sprite/ folder created
- [x] Phase 1: geo_sprite_data.json (93 entries, all 9 units, full 7-lens scoring)
- [x] Phase 1: index.html interactive dashboard (10 modes, progressive disclosure)
- [x] Phase 1: geo_sprite_matrix.csv (spreadsheet export)
- [x] Phase 2: geo_sprite_master.md (9 unit cards + 40 mega-patterns + 20 mistakes)
- [x] Phase 2: contextualization_engine.md (100+ starters across 14 periods)
- [x] Phase 2: dbq_geo_sprite_toolkit.md (10 grouping templates + 14 doc types)
- [x] Phase 2: leq_geo_sprite_toolkit.md (50+ thesis templates)
- [x] Phase 2: geo_sprite_evidence_bank.md (~315 evidence items, 3 tiers x 7 lenses)
- [x] Phase 3: geo_sprite_visual_maps.md (20 Mermaid diagrams)
- [x] Phase 3: geo_sprite_practice_prompts.md (~30 practice prompts)
- [x] Phase 3: geo_sprite_flashcards.csv (200 flashcards)
- [x] Phase 3: one_page_geo_sprite_cram.md (compressed review)
- [x] Phase 4: coverage_audit.md (full audit)
- [x] Phase 4: SCRATCHPAD.md (this file)

## Sources Used
- **Viault**: Birdsall S. Viault, *Modern European History* (McGraw-Hill, 1990). Primary source.
- **CED**: College Board AP European History Course and Exam Description. Framework knowledge.
- **Existing timeline**: euro/timeline_data.json (112 entries) — transformed into Geo-SPRITE format.
- **AP convention**: Standard AP-Euro teaching consensus.

## Unavailable Textbooks
Same list as euro/SCRATCHPAD.md — 11 textbooks referenced in the original prompt are NOT accessed.

## Key Design Decisions
- 7-color lens system: G=emerald, S=amber, P=blue, R=purple, I=teal, T=steel, E=gold
- Scoring: 0 (not central) to 3 (essential) — never force all lenses to be important
- Funny hooks: every entry has one; encodes historical fact in humor; appropriate for students
- Progressive disclosure: landing page shows mode picker only, not data dump
- Night-Before-Exam mode: rapid-fire funny hooks with tap-to-reveal
- CB defensibility: all 93 entries rated CB-safe

## Data Quality
- 93 entries across all 9 AP units
- 100% field completeness for all exam-use fields
- 100% funny hook coverage
- 100% CB-safe ratings
- All 7 lenses scored for every entry

## Known Gaps (documented in coverage_audit.md)
1. Unit 6 (Industrialization) light — 4 entries
2. Tier distribution skewed to Tier 1 (77%)
3. Balkans/Scandinavia/Ottoman borderlands underrepresented
4. Artistic/cultural entries light in later units
5. Dashboard comparison split-screen and SVG arrows not yet implemented

## Next Session Priorities
1. Add ~30 entries for gaps (Unit 6, Balkans, arts/culture)
2. Implement comparison split-screen view in dashboard
3. Add animated causation arrows between cards
4. Add CCOT horizontal timeline bands visualization
5. Test all dashboard modes end-to-end
