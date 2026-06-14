import type { LeadStatus, RiskLevel } from "@/lib/constants";

/**
 * Allowed lead status transitions. The workflow is mostly linear but
 * supports kicking back to verification and terminal reject/archive from
 * most states.
 */
const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["triage", "verify_more", "rejected", "archived"],
  triage: ["verify_more", "ask_permission", "approved_for_caption", "rejected", "archived"],
  verify_more: ["triage", "ask_permission", "approved_for_caption", "rejected", "archived"],
  ask_permission: ["verify_more", "approved_for_caption", "rejected", "archived"],
  approved_for_caption: [
    "approved_for_video",
    "published",
    "verify_more",
    "rejected",
    "archived",
  ],
  approved_for_video: ["published", "approved_for_caption", "rejected", "archived"],
  published: ["archived"],
  rejected: ["archived", "triage"],
  archived: ["triage"],
};

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function allowedNextStatuses(from: LeadStatus): LeadStatus[] {
  return TRANSITIONS[from];
}

/** Statuses that move a lead toward publishing/exporting and therefore
 * require final editor approval when the lead is high/critical risk. */
const APPROVAL_GATED_STATUSES: LeadStatus[] = [
  "approved_for_caption",
  "approved_for_video",
  "published",
];

const HIGH_RISK_LEVELS: RiskLevel[] = ["high", "critical"];

export interface TransitionContext {
  riskLevel: RiskLevel | null;
  finalEditorApproval: boolean;
  overrideHighRisk?: boolean;
}

export interface TransitionDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates a requested transition against the workflow graph AND the
 * high-risk approval gate: high/critical leads cannot advance to a
 * publish/export-bound status without final editor approval (or an
 * explicit, logged override).
 */
export function evaluateTransition(
  from: LeadStatus,
  to: LeadStatus,
  ctx: TransitionContext,
): TransitionDecision {
  if (!canTransition(from, to)) {
    return { allowed: false, reason: `Cannot move from "${from}" to "${to}".` };
  }

  const isHighRisk = ctx.riskLevel != null && HIGH_RISK_LEVELS.includes(ctx.riskLevel);
  const isGated = APPROVAL_GATED_STATUSES.includes(to);

  if (isHighRisk && isGated && !ctx.finalEditorApproval && !ctx.overrideHighRisk) {
    return {
      allowed: false,
      reason:
        "High-risk leads require final editor approval (verification checklist) before advancing to caption/video/publish.",
    };
  }

  return { allowed: true };
}
