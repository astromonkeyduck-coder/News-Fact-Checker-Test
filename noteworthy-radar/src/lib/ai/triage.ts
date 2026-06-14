import { getProvider } from "@/lib/ai/index";
import { computeStubTriage, computeStubCaptions, type StubContext } from "@/lib/ai/stub";
import {
  TRIAGE_SYSTEM_PROMPT,
  CAPTION_SYSTEM_PROMPT,
  buildTriageUserPrompt,
} from "@/lib/ai/prompts";
import {
  captionDraftsSchema,
  triageResultSchema,
  type CaptionDrafts,
  type LeadInput,
  type TriageResult,
} from "@/lib/validation/schemas";

export interface TriageOutcome {
  result: TriageResult;
  provider: string;
  model: string | null;
  usedFallback: boolean;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Tolerate code fences / surrounding prose by grabbing the first object.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("No JSON object found in provider response");
  }
}

/**
 * Runs AI triage for a lead. With the stub provider (default) this is
 * deterministic. With a live provider it validates the JSON against the
 * required schema, retries once, and falls back to the safety-first stub if
 * validation keeps failing - so the contract is never violated downstream.
 */
export async function triageLead(
  lead: LeadInput,
  ctx?: StubContext,
): Promise<TriageOutcome> {
  const provider = getProvider();

  if (provider.isStub) {
    return {
      result: computeStubTriage(lead, ctx),
      provider: provider.name,
      model: provider.model,
      usedFallback: false,
    };
  }

  const user = buildTriageUserPrompt(lead, ctx ?? undefined);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await provider.chat({ system: TRIAGE_SYSTEM_PROMPT, user });
      const parsed = triageResultSchema.parse(extractJson(raw));
      return {
        result: parsed,
        provider: provider.name,
        model: provider.model,
        usedFallback: false,
      };
    } catch {
      // retry once, then fall through to deterministic fallback
    }
  }

  return {
    result: computeStubTriage(lead, ctx),
    provider: provider.name,
    model: provider.model,
    usedFallback: true,
  };
}

export interface CaptionOutcome {
  drafts: CaptionDrafts;
  credit_line: string;
  provider: string;
  usedFallback: boolean;
}

export async function generateCaptions(
  lead: LeadInput,
  ctx?: StubContext & { isOfficial?: boolean; riskLevel?: string },
): Promise<CaptionOutcome> {
  const provider = getProvider();
  const stub = () => computeStubCaptions(lead, ctx);

  if (provider.isStub) {
    const drafts = stub();
    return {
      drafts,
      credit_line: deriveCredit(drafts),
      provider: provider.name,
      usedFallback: false,
    };
  }

  const user = buildTriageUserPrompt(lead, ctx ?? undefined);
  try {
    const raw = await provider.chat({ system: CAPTION_SYSTEM_PROMPT, user });
    const json = extractJson(raw) as Record<string, unknown>;
    const drafts = captionDraftsSchema.parse(json);
    const credit = typeof json.credit_line === "string" ? json.credit_line : deriveCredit(drafts);
    return { drafts, credit_line: credit, provider: provider.name, usedFallback: false };
  } catch {
    const drafts = stub();
    return {
      drafts,
      credit_line: deriveCredit(drafts),
      provider: provider.name,
      usedFallback: true,
    };
  }
}

function deriveCredit(drafts: CaptionDrafts): string {
  const match = drafts.neutral_under_240.match(/Credit:.*/);
  return match ? match[0] : "";
}
