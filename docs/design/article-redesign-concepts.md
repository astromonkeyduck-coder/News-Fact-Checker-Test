# Article and story experience: three concepts

Written before the article system rebuild (July 2026). The homepage moved to the
dark V4 editorial system months ago; the article page is still a white AP-style
template from an earlier era, the live story page is a bare timeline, and the
archive is an unstyled list. This document proposes three directions, picks one,
and records why.

State of the current setup, honestly:

- `/article?id=` opens a white page that shares nothing with the homepage. It
  reads as a different, cheaper site.
- The reader arrives from a near-black newsroom front page and gets flashed
  with a white screen. The transition alone breaks the product.
- Media handling is inconsistent: hero image logic exists, but galleries are
  bare grids, videos get a poster and a prayer, and nothing pauses offscreen.
- `/story/<slug>` is a headline, a follow button, and a comment-like list.
  "Loading live story..." is the entire loading experience.
- The archive is a text list with three hardcoded category options that do not
  match any real category in the data.

All three concepts share non-negotiables: real data only, the V2 token system
(navy base, white type, blue accent, red reserved for breaking), serif body
text, no invented stats, no badge spam, no em dashes.

---

## Concept A: Front Page Bulletin

Print-broadsheet discipline applied to a dark screen.

1. First impression: a quiet masthead, a hairline rule, then an enormous
   centered serif headline on near-black. It looks like the front page of a
   paper that takes itself seriously. No media above the fold unless the story
   has it; typography carries the page.
2. Article header layout: centered column. Small uppercase kicker (category or
   story type from real data), display headline, italic serif dek, then a
   single meta line: byline, published time, updated time, read time,
   separated by middots. A thin double rule under the header, print style.
3. Media treatment: media sits below the header rule at content width, framed
   with a hairline border. Captions set in small caps under the frame like a
   plate caption. Galleries are a filmstrip row with a counter.
4. Story body rhythm: single centered column, 65ch, drop cap on the lead
   paragraph, generous leading. Pull quotes break out with oversized quotation
   marks. Section rules between long segments.
5. Live update treatment: updates render as a "wire column": monospace
   timestamp left, text right, newest at top, thin rules between entries. It
   reads like agency copy, which is credible but static.
6. Source and verification treatment: footnote model. Sources render as
   numbered footnotes at the end plus superscript markers where data allows.
   A "How we verify" note sits in the footer area.
7. Mobile reading experience: excellent by default, it is one column already.
   Meta line wraps to two lines, media goes edge to edge, footnotes become
   tappable chips.
8. Why it is better than the current setup: it replaces the template look with
   real editorial confidence, fixes the white-flash problem, and puts
   typography first. Weaknesses: footnote sourcing hides the source trail that
   the brand is built on, the wire column treats live updates as an afterthought,
   and a centered print layout does little for media-heavy social posts, which
   are most of the feed.

---

## Concept B: The Dispatch Spine

The story as a vertical timeline. One structural idea carries articles, live
stories, and updates: a spine down the left edge of the reading column with
nodes for every meaningful moment: published, updated, each live update, each
correction. Reading the page is following the story through time.

1. First impression: dark navy room, a strong left-aligned headline block, and
   a visible spine running down the page with lit nodes. You can see at a
   glance that this story has history: where it started, where it changed, what
   is newest. It looks like a product for following stories, not a blog post.
2. Article header layout: left-aligned block at the top of the spine. Kicker
   row first (story type chip if real, category text, live pulse only when a
   story is actually live), then the headline in heavy Sora, then the serif
   dek, then a precise meta grid: byline, published, updated, read time. The
   header is the first node on the spine. A reading progress hairline pins to
   the top of the viewport.
3. Media treatment: cinematic block right under the header, full column width,
   16:9 crop with a soft border and a very subtle scale-settle on load. Videos
   are native players with poster, controls, playsinline, metadata preload,
   muted viewport preview, auto-pause offscreen. Two or more items become a
   swipeable gallery with count, arrows, dots, and keyboard support. No media:
   the spine and typography carry the page, plus a small source attribution
   card when the story originates on X. Never an empty grey box.
4. Story body rhythm: serif body at 1.15rem or larger, 68ch measure, left
   aligned against the spine with breathing room. Multi-paragraph social posts
   render as clean paragraphs, not "update blocks". "What we know" renders as
   a bordered panel docked to a node when takeaway data exists. Pull weight
   comes from spacing and panels, not decoration.
5. Live update treatment: this is where the concept earns its keep. On live
   stories the updates are spine nodes, newest first: timestamp, kind label
   (major, correction, final get distinct node colors: red, amber, green),
   body in serif, source note under it. Corrections stay visible with a
   struck-nothing, labeled-clearly policy. A "jump to latest" pill appears when
   the reader scrolls away from the newest node, and every update has a
   copy-link anchor. New updates arriving during a poll slide in at the top
   with a brief highlight.
6. Source and verification treatment: a right rail on desktop, inline sections
   on mobile. "Source trail" lists every real source link with its domain and,
   for live stories, which update cited it. "How we know" states the story's
   real confidence and status vocabulary and links to the standards page. If a
   story has no source data, the rail says exactly that in one honest sentence
   and links to the standards, no pretending. Related stories and latest
   coverage fill the rest of the rail from real feed data.
7. Mobile reading experience: the spine thins to a 2px guide with smaller
   nodes, the rail content reflows inline after the body (source trail first,
   then read next), text stays large, galleries swipe natively, the progress
   bar stays pinned, and a bottom-of-header action row keeps share and copy
   one thumb away. No horizontal overflow, no squeezed sidebar.
8. Why it is better than the current setup: it gives article pages and live
   story pages one shared, ownable visual system rooted in what the product
   actually does: follow stories through time with sources attached. It makes
   timestamps and updates structural instead of decorative, it upgrades the
   live story page from comment-list to product, and it survives every real
   data shape: text-only alerts, photo posts, multi-video posts, earthquake
   events with generated maps.

---

## Concept C: Broadcast Lead

Cinema-first. The story opens like a premium documentary title card.

1. First impression: full-bleed hero media with a dark gradient scrim, headline
   set over the lower third, category and time chips floating above it. Feels
   like a serious streaming product covering the news.
2. Article header layout: headline, dek, and meta overlay the hero media
   bottom-left. On stories without media, a full-width typographic panel with
   an animated grain texture takes the hero slot.
3. Media treatment: the hero is the star: edge-to-edge, tall crop, parallax
   drift on scroll. Additional media renders as a horizontal reel below the
   fold. Videos autoplay muted in the hero when visible, with controls.
4. Story body rhythm: after the cinematic open, the body drops into a centered
   66ch column with large serif text and roomy spacing. Panels (what we know,
   source trail) render as dark glass cards between body segments.
5. Live update treatment: a horizontal "latest updates" reel pinned under the
   hero, plus a vertical list further down. Newest update is always visible in
   the reel.
6. Source and verification treatment: glass cards inline with the body, one
   for sources, one for standards. No side rail; everything is in the flow.
7. Mobile reading experience: the hero crops to 4:5 and stays striking, the
   reel swipes, the body is one column. Very natural on phones.
8. Why it is better than the current setup: maximal visual impact, best-in-feed
   share screenshots, and the strongest possible treatment for photo and video
   stories. Weaknesses: it degrades hard on the many stories with no media or
   with a small generated map as the only image, text-over-image hurts
   legibility and accessibility, horizontal reels hide updates and sources,
   and parallax hero video is a performance tax on mid-range phones.

---

## Decision: Concept B, The Dispatch Spine

Chosen because it is the only concept where the signature element comes from
the product's actual promise instead of from styling. Noteworthy News sells
"what happened, what changed, what is confirmed, how we know". A spine of
timestamped, source-annotated nodes is that promise drawn as structure, and it
is the same structure a live story timeline already needs, so articles and live
stories finally share one system.

Concept A was the safest and the most generic: it would still read as "nice
blog". Concept C photographs beautifully and dies on the real data: most engine
alerts have one generated image or none, and text-over-media plus reels would
fail the accessibility and mobile bars this task sets.

Implementation carries over the best of the others: A's typographic discipline
(serif body, restrained meta line, real captions) and C's media ambition
(cinematic crops, native players everywhere, swipeable galleries), mounted on
B's spine.
