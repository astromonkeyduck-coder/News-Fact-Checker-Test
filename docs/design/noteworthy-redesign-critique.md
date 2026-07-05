# Noteworthy News homepage: internal design critique

Written before the 3.0 creative reset (July 2026). Reference: current homepage
screenshot (negative), iOS app section screenshot (positive).

## What is wrong with the current homepage

1. The hero console is fake. "Live Desk", radar sweep, stat boxes and status
   rows imply an operations product that does not exist. Viewers who look
   closely see placeholder dashes and generic status language, which reads as
   theater and damages trust, the one thing a news brand cannot lose.
2. Badge density is noise. Chips like "Monitoring" and "Queue" carry no
   information a reader can act on. Every meaningless badge cheapens the real
   ones (Breaking, Developing) that come from actual story data.
3. The metrics strip is filler. "500+ verified stories" and "0 clickbait
   headlines" are marketing numbers, not evidence. They sound like a template.
4. Typography is timid. The headline sits at card scale, not front-page scale.
   Nothing in the first viewport feels confident enough to stop a scroll.
5. Sections share one visual system (label, title, grid of bordered cards), so
   the page has no rhythm. Stories, games, values and product features all
   look like the same widget.

## What the iOS section gets right (keep this standard)

- Every element depicts a real product capability: a Live Activity, a push
  notification, a progress state. Nothing is decorative.
- One strong visual object (the phone) instead of many small ones.
- Copy is specific and honest ("In development. TestFlight coming soon.").
- Generous spacing, clear hierarchy, restrained color.

## Rules for the reset

- Real data or nothing: story cards, live stories, alert feeds, and app
  capabilities may be shown; invented telemetry may not.
- One idea per section, one hero object per section.
- Editorial hierarchy first: lead story, secondary stories, compact updates.
- Type does the talking: bigger, tighter headlines; serif body for calm.
- Blue is an accent, red means breaking, gold appears only around trust and
  editorial authority. Navy carries the room.
- No em dashes anywhere in code or copy (house style).
- Banned vocabulary: radar, command center, live desk, verification queue,
  active alerts, source attribution, monitoring feeds, and any stat not backed
  by config or data.
