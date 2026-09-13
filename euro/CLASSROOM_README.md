# AP European History classroom workspace

The `/euro/` page is a static classroom study resource. It has no build step of its own and does not require an account or an AI service.

## Classroom tools

- Nine unit introductions with essential questions, learning targets, events, and supporting notes.
- 27 original practice questions (three per unit), explanations, session review, and missed-question retry. An all-unit session samples one question per unit. Practice is formative, not an AP score prediction.
- Nine original writing prompts, self-review checklists, per-unit browser drafts, plain-text downloads, and print layouts. Writing is not submitted or automatically graded.
- Search across events, people, works, art, terminology, and study notes. Event bookmarks are available in Saved for review.
- Keyboard operation, skip navigation, accessible event dialogs, reduced-motion support, dark theme, responsive layouts, and projector mode.
- Course-unit links such as `/euro/#study?unit=5` can be shared with students. “All periods” is a broader topic-based library including pre-1450 context; these eight groupings are not the nine AP units.

A possible 20-minute lesson: five minutes of unit exploration, eight minutes of practice and discussion, seven minutes of writing. Print the active view or download an individual writing response.

Drafts and bookmarks belong to this browser, including on shared devices. Drafts fall back to session memory if storage is unavailable, and the editor tells students to download a copy. Practice session state lasts until reload. There are no public leaderboards, automatic audio, third-party music embeds, or automatic essay submissions on this page.

## Content and sources

The exam guide reflects College Board's announced **May 2027** changes: all three source-based SAQs required, one broad required LEQ, and the expanded DBQ chronological range. Exam rubrics and dates should be checked against the official sources each school year:

- https://apcentral.collegeboard.org/courses/ap-history-exam-updates
- https://apcentral.collegeboard.org/courses/ap-european-history/exam
- https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf

Practice sources are linked when relevant; constructed instructional summaries and paraphrases are labeled. Targeted historical corrections include the Holocaust account (USHMM), several publication dates, and reversed event connections. Original reference content remains a study supplement, not a verified replacement for the complete course description or teacher-selected primary sources. Core/Supporting/Extension are editorial priorities, not College Board classifications. Existing record-level `apTopic` values are not displayed as authoritative mappings.

## Development and verification

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node --test tests/euro/data.test.js
# After editing timeline data:
node scripts/export-euro-timeline.js
```

Open `http://127.0.0.1:8765/euro/`.

The regression suite covers script syntax, 153 timeline records, IDs, event relationships and chronology, unique period placement, unit selection, malformed/blocked/full browser storage, nine unit introductions, 27 practice items, and nine writing prompts. These checks validate structure and specified behavior, not every historical statement.

Browser checks cover navigation, event details/bookmarks, a full three-question practice session, correct/incorrect feedback, score/retry behavior, per-unit writing and reload recovery, search/empty states, reference jump links, theme/projector controls, 390px responsive layout, and active-view print styling (screen simulation of the print rules; physical pagination was not tested).

Files: `index.html` contains the legacy reference collections/renderers and the classroom shell; `classroom-app.js` controls the workspace; `classroom-content.js` contains unit/practice/writing content; `classroom.css` supplies the classroom layout; `timeline_data.json` supplies timeline events. The legacy chat and sound files are retained for other consumers but are not loaded by this page.
