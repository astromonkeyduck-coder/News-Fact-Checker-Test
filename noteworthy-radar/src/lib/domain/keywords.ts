import type { EventRow } from "@/lib/types";

/**
 * Deterministic keyword generation from an event's seed fields. Produces a
 * de-duplicated bank of search terms. (The AI provider can optionally enrich
 * this, but this baseline always works offline.)
 */
export function generateKeywords(input: {
  event_name: string;
  teams_or_entities?: string | null;
  location?: string | null;
  event_type?: string | null;
  keyword_seed?: string | null;
}): string[] {
  const terms = new Set<string>();
  const push = (s?: string | null) => {
    if (!s) return;
    const t = s.trim();
    if (t.length > 1) terms.add(t);
  };

  push(input.event_name);

  const entities = (input.teams_or_entities || "")
    .split(/[,/]|\bvs\.?\b|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  entities.forEach(push);

  // Pairwise combinations of entities (e.g. "Knicks Spurs").
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      push(`${entities[i]} ${entities[j]}`);
    }
  }

  push(input.location);
  if (input.location && entities[0]) push(`${entities[0]} ${input.location}`);

  (input.keyword_seed || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(push);

  // Generic newsroom modifiers anchored on the primary subject.
  const subject = entities[0] || input.event_name;
  ["video", "fight", "scene", "footage", "now", "live", "breaking"].forEach((m) =>
    push(`${subject} ${m}`),
  );

  return Array.from(terms).slice(0, 40);
}

export interface PlatformSearchGroup {
  platform: string;
  note: string;
  /** Copyable manual-search strings. These are NOT executed automatically. */
  queries: string[];
}

/**
 * Builds copyable manual-search strings grouped by platform. These are
 * suggestions for a human editor to paste into each platform's own search
 * box. The app never runs these automatically and never scrapes results.
 */
export function buildSearchStrings(event: Pick<EventRow, "event_name" | "generated_keywords" | "location" | "keyword_seed">): PlatformSearchGroup[] {
  const kws = event.generated_keywords?.length
    ? event.generated_keywords
    : [event.event_name].filter(Boolean);
  const primary = kws[0] || event.event_name;
  const loc = event.location || "";

  return [
    {
      platform: "Facebook (manual search)",
      note: "Paste into Facebook search yourself. Do not use automated tools.",
      queries: kws.slice(0, 8).map((k) => k),
    },
    {
      platform: "Telegram (manual search)",
      note: "Search public channels you are permitted to view.",
      queries: kws.slice(0, 6),
    },
    {
      platform: "X / Twitter",
      note: "Use X search operators.",
      queries: [
        `${primary} filter:videos`,
        `${primary} ${loc}`.trim(),
        `"${primary}" -is:retweet`,
      ].filter((q) => q.trim().length > 0),
    },
    {
      platform: "Reddit",
      note: "Search relevant subreddits.",
      queries: [`${primary}`, loc ? `${primary} ${loc}` : ""].filter(Boolean),
    },
    {
      platform: "Google / News",
      note: "Cross-check with established reporting.",
      queries: [
        `${primary} ${loc}`.trim(),
        `${primary} news`,
        `${primary} site:apnews.com OR site:reuters.com`,
      ].filter((q) => q.trim().length > 0),
    },
    {
      platform: "Official sources (police / fire / EMS)",
      note: "Check official agency pages and verified accounts for confirmation.",
      queries: [
        loc ? `${loc} police department` : "local police department",
        loc ? `${loc} fire department incident` : "fire department incident",
        loc ? `${loc} emergency services` : "county emergency services",
      ],
    },
  ];
}
