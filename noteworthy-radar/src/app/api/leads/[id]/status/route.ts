import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { statusChangeSchema } from "@/lib/validation/schemas";
import { evaluateTransition } from "@/lib/domain/status";
import { hasFinalEditorApproval } from "@/lib/domain/verification";
import { writeAudit } from "@/lib/domain/audit";
import type { LeadRow } from "@/lib/types";
import type { AuditAction } from "@/lib/constants";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = statusChangeSchema.parse(body);

    const supabase = createServerSupabase();
    const { data: leadData } = await supabase
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (!leadData) throw new HttpError(404, "Lead not found.");
    const lead = leadData as LeadRow;

    const decision = evaluateTransition(lead.status, input.status, {
      riskLevel: lead.risk_level,
      finalEditorApproval: hasFinalEditorApproval(lead.verification_checklist),
      overrideHighRisk: input.override_high_risk,
    });
    if (!decision.allowed) throw new HttpError(409, decision.reason ?? "Transition not allowed.");

    const { data: updated, error } = await supabase
      .from("leads")
      .update({ status: input.status })
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message);

    await supabase.from("lead_status_history").insert({
      lead_id: lead.id,
      team_id: session.team.id,
      from_status: lead.status,
      to_status: input.status,
      note: input.note || null,
      changed_by: session.user.id,
    });

    const action: AuditAction =
      input.status === "published"
        ? "published"
        : input.status === "rejected"
          ? "rejected"
          : input.status === "archived"
            ? "archived"
            : "status_changed";

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action,
      entityType: "lead",
      entityId: lead.id,
      detail: {
        from: lead.status,
        to: input.status,
        override_high_risk: Boolean(input.override_high_risk),
      },
    });

    return ok({ lead: updated });
  });
}
