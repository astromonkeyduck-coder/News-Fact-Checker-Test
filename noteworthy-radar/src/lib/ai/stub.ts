import type { RecommendedAction } from "@/lib/constants";
import { analyzeRisk, isHighRisk } from "@/lib/domain/risk";
import type { CaptionDrafts, LeadInput, TriageResult } from "@/lib/validation/schemas";
import { buildCreditLine } from "@/lib/ai/credit";

export interface StubContext {
  event_name?: string | null;
  teams_or_entities?: string | null;
  location?: string | null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function subjectOf(lead: LeadInput, ctx?: StubContext): string {
  return (
    lead.what_it_appears_to_show?.trim() ||
    ctx?.event_name?.trim() ||
    "an incident circulating online"
  );
}

/**
 * Deterministic, safety-first triage used when no AI key is configured and as
 * the validated fallback when a live provider returns malformed JSON.
 */
export function computeStubTriage(lead: LeadInput, ctx?: StubContext): TriageResult {
  const { signals, level } = analyzeRisk(lead);

  const hasWhen = Boolean(lead.claimed_time);
  const hasWhere = Boolean(lead.claimed_location);
  const isOfficial =
    lead.platform === "Official Source" ||
    lead.permission_status === "official_source";

  const missing_facts: string[] = [];
  if (!hasWhere) missing_facts.push("Confirmed location");
  if (!hasWhen) missing_facts.push("Confirmed time/date");
  if (!isOfficial) missing_facts.push("Official confirmation of what happened");
  if (!lead.source_url) missing_facts.push("Original source URL");

  const safety_risks = signals
    .filter((s) => ["weapon", "violence", "death_injury", "alleged_crime", "graphic_flag"].includes(s.key))
    .map((s) => s.label);
  const privacy_risks = signals
    .filter((s) => ["minors", "private_people_identifiable_flag", "minors_visible_flag"].includes(s.key))
    .map((s) => s.label);
  if (lead.private_people_identifiable_flag && !privacy_risks.length) {
    privacy_risks.push("Identifiable private individuals may be visible");
  }

  const copyright_permission_risks: string[] = [];
  if (!["official_source", "licensed", "permission_granted"].includes(lead.permission_status)) {
    copyright_permission_risks.push(
      "Reposting rights are unclear; treat as link-only until permission is granted.",
    );
  }

  // Scores: official + complete context scores higher; sensitive/incomplete scores lower.
  let verification_score = 1;
  if (hasWhere) verification_score += 1;
  if (hasWhen) verification_score += 1;
  if (isOfficial) verification_score += 2;
  if (lead.source_url) verification_score += 1;
  verification_score = Math.max(0, Math.min(5, verification_score));

  let newsworthiness_score = 2;
  if (signals.length > 0) newsworthiness_score += 1;
  if (isHighRisk(level)) newsworthiness_score += 1;
  if (ctx?.event_name) newsworthiness_score += 1;
  newsworthiness_score = Math.max(0, Math.min(5, newsworthiness_score));

  let recommended_action: RecommendedAction;
  if (level === "critical" && verification_score <= 2) {
    recommended_action = "do_not_use";
  } else if (isHighRisk(level) && verification_score < 4) {
    recommended_action = "editorial_review";
  } else if (missing_facts.length >= 2) {
    recommended_action = "verify_more";
  } else if (copyright_permission_risks.length > 0) {
    recommended_action = isOfficial ? "publish_link_only" : "ask_permission";
  } else {
    recommended_action = "monitor";
  }

  const editor_questions_before_publish: string[] = [];
  if (!hasWhere) editor_questions_before_publish.push("Where exactly did this happen?");
  if (!hasWhen) editor_questions_before_publish.push("When did this happen?");
  if (!isOfficial)
    editor_questions_before_publish.push("Has any official source or established outlet confirmed this?");
  if (privacy_risks.length)
    editor_questions_before_publish.push("Are any identifiable private people or minors visible?");

  const caption_drafts = computeStubCaptions(lead, {
    ...ctx,
    riskLevel: level,
    isOfficial,
  });

  const subject = subjectOf(lead, ctx);
  const short_summary = truncate(
    `${lead.media_type === "video" ? "Video" : "Post"} ${
      isOfficial ? "from an official source" : "circulating online"
    } that appears to show ${subject}${lead.claimed_location ? ` in ${lead.claimed_location}` : ""}. ${
      isOfficial ? "" : "Details are not independently confirmed."
    }`.trim(),
    400,
  );

  const event_connection = ctx?.event_name
    ? `Possibly related to ${ctx.event_name}${
        ctx.teams_or_entities ? ` (${ctx.teams_or_entities})` : ""
      }; connection not confirmed.`
    : "No event linked yet.";

  return {
    short_summary,
    event_connection,
    newsworthiness_score,
    verification_score,
    risk_level: level,
    safety_risks,
    privacy_risks,
    copyright_permission_risks,
    missing_facts,
    recommended_action,
    caption_drafts,
    credit_line: caption_drafts ? buildCreditLine({ platform: lead.platform, handle: lead.source_handle }) : "",
    editor_questions_before_publish,
  };
}

interface CaptionCtx extends StubContext {
  riskLevel?: string;
  isOfficial?: boolean;
}

/**
 * Deterministic captions in Noteworthy News house style. Tone shifts with
 * verification + risk: hedged when unconfirmed, factual when official.
 */
export function computeStubCaptions(lead: LeadInput, ctx?: CaptionCtx): CaptionDrafts {
  const credit = buildCreditLine({ platform: lead.platform, handle: lead.source_handle });
  const where = lead.claimed_location?.trim();
  const subject = subjectOf(lead, ctx);
  const eventName = ctx?.event_name?.trim();
  const isOfficial = ctx?.isOfficial;
  const highRisk = ctx?.riskLevel === "high" || ctx?.riskLevel === "critical";

  const locPhrase = where ? ` in ${where}` : "";
  const eventPhrase = eventName ? ` after ${eventName}` : "";

  let neutral: string;
  let breaking: string;

  if (isOfficial) {
    neutral = `NEW: ${capitalize(subject)}${locPhrase}. ${credit}`;
    breaking = `NEW: ${capitalize(subject)}${locPhrase}, according to ${
      lead.source_handle || "officials"
    }. ${credit}`;
  } else if (highRisk) {
    neutral = `DEVELOPING: Video circulating online appears to show ${subject}${eventPhrase}. The circumstances have not been independently confirmed.\n\n${credit}`;
    breaking = `DEVELOPING: Video circulating online appears to show ${subject}${eventPhrase}. Authorities have not yet confirmed the circumstances.\n\n${credit}`;
  } else {
    neutral = `VIDEO: Footage circulating online appears to show ${subject}${eventPhrase}. The location and timing have not been independently confirmed.\n\n${credit}`;
    breaking = `VIDEO: Footage appears to show ${subject}${eventPhrase}. Details have not been independently confirmed.\n\n${credit}`;
  }

  const facebook = `${neutral}`;
  const instagram = `${neutral}\n\n#breakingnews #news`;

  return {
    neutral_under_240: truncate(neutral, 240),
    breaking_under_280: truncate(breaking, 280),
    facebook_post: facebook,
    instagram_caption: instagram,
  };
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
