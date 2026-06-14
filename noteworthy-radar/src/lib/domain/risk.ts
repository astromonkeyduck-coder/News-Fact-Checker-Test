import type { RiskLevel } from "@/lib/constants";
import type { LeadInput } from "@/lib/validation/schemas";

export interface RiskSignal {
  key: string;
  label: string;
  severity: RiskLevel;
}

interface KeywordRule {
  key: string;
  label: string;
  severity: RiskLevel;
  patterns: RegExp[];
}

/**
 * Keyword heuristics for auto-flagging sensitive content from the free-text
 * lead fields. Deliberately conservative: it errs toward flagging so editors
 * review rather than miss something.
 */
const KEYWORD_RULES: KeywordRule[] = [
  {
    key: "weapon",
    label: "Weapons / gunfire",
    severity: "high",
    patterns: [/\bgun(s|fire|shot|man)?\b/i, /\bshoot(ing|out)?\b/i, /\bweapon/i, /\bknife\b/i, /\bstabb/i, /\barmed\b/i],
  },
  {
    key: "violence",
    label: "Fights / assault / violence",
    severity: "high",
    patterns: [/\bfight\b/i, /\bbrawl\b/i, /\bassault/i, /\bbeat(ing|en|s)?\b/i, /\battack/i, /\briot/i, /\bpunch/i],
  },
  {
    key: "death_injury",
    label: "Injury / death claims",
    severity: "critical",
    patterns: [/\bdead\b/i, /\bdeath\b/i, /\bkilled\b/i, /\bfatal/i, /\binjur/i, /\bwounded\b/i, /\bbody\b/i, /\bvictim/i],
  },
  {
    key: "alleged_crime",
    label: "Alleged crime",
    severity: "high",
    patterns: [/\balleg/i, /\bsuspect/i, /\barrest/i, /\bcrime\b/i, /\brobber/i, /\bshooter\b/i],
  },
  {
    key: "minors",
    label: "Minors",
    severity: "high",
    patterns: [/\bchild(ren)?\b/i, /\bkid(s)?\b/i, /\bminor(s)?\b/i, /\bteen(ager)?s?\b/i, /\bstudent(s)?\b/i],
  },
  {
    key: "law_enforcement",
    label: "Law enforcement activity",
    severity: "medium",
    patterns: [/\bpolice\b/i, /\bofficer/i, /\bsheriff/i, /\bswat\b/i, /\bcop(s)?\b/i, /\bfbi\b/i, /\bdetective/i],
  },
  {
    key: "politics",
    label: "Election / politics",
    severity: "medium",
    patterns: [/\belection/i, /\bvot(e|ing|er)/i, /\bballot/i, /\bcampaign/i, /\bprotest/i, /\bcandidate/i],
  },
  {
    key: "medical",
    label: "Medical claims",
    severity: "medium",
    patterns: [/\bvaccine/i, /\bvirus\b/i, /\boutbreak/i, /\boverdose/i, /\bcure\b/i, /\bhospital/i],
  },
  {
    key: "misinformation",
    label: "Possible misinformation",
    severity: "medium",
    patterns: [/\bfake\b/i, /\bhoax\b/i, /\bdeepfake/i, /\bstaged\b/i, /\bAI[- ]generated/i, /\bedited\b/i],
  },
];

const SEVERITY_ORDER: RiskLevel[] = ["low", "medium", "high", "critical"];

export function maxSeverity(a: RiskLevel, b: RiskLevel): RiskLevel {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/**
 * Computes risk signals + an overall level from explicit editor flags,
 * free-text content, and verification gaps. Pure + deterministic so it can
 * run on save and be unit-tested.
 */
export function analyzeRisk(
  lead: Partial<LeadInput> & { source_url?: string | null },
): { signals: RiskSignal[]; level: RiskLevel } {
  const signals: RiskSignal[] = [];

  const flagMap: Array<[keyof LeadInput, string, RiskLevel]> = [
    ["weapon_flag", "Weapon / gunfire (flagged)", "high"],
    ["violence_flag", "Violence (flagged)", "high"],
    ["graphic_flag", "Graphic content (flagged)", "critical"],
    ["minors_visible_flag", "Minors visible (flagged)", "high"],
    ["private_people_identifiable_flag", "Private people identifiable (flagged)", "high"],
    ["law_enforcement_involved_flag", "Law enforcement involved (flagged)", "medium"],
  ];

  for (const [flag, label, severity] of flagMap) {
    if (lead[flag]) signals.push({ key: String(flag), label, severity });
  }

  const haystack = [lead.post_text, lead.what_it_appears_to_show, lead.claimed_location]
    .filter(Boolean)
    .join(" \n ");

  if (haystack.trim().length > 0) {
    for (const rule of KEYWORD_RULES) {
      if (rule.patterns.some((p) => p.test(haystack))) {
        signals.push({ key: rule.key, label: rule.label, severity: rule.severity });
      }
    }
  }

  // Unverified location/time on a sensitive lead is itself a risk.
  const missingWhen = !lead.claimed_time;
  const missingWhere = !lead.claimed_location;
  if ((missingWhen || missingWhere) && signals.length > 0) {
    signals.push({
      key: "unverified_context",
      label: "Unverified location/time",
      severity: "medium",
    });
  }

  const level = signals.reduce<RiskLevel>(
    (acc, s) => maxSeverity(acc, s.severity),
    "low",
  );

  // De-duplicate by key, keeping highest severity per key.
  const byKey = new Map<string, RiskSignal>();
  for (const s of signals) {
    const existing = byKey.get(s.key);
    if (!existing || maxSeverity(existing.severity, s.severity) === s.severity) {
      byKey.set(s.key, s);
    }
  }

  return { signals: Array.from(byKey.values()), level };
}

export function isHighRisk(level: RiskLevel | null | undefined): boolean {
  return level === "high" || level === "critical";
}
