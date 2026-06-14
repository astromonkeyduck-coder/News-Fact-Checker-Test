import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { triageLead } from "@/lib/ai/triage";
import { leadRowToInput } from "@/lib/data/lead-input";
import { writeAudit } from "@/lib/domain/audit";
import type { EventRow, LeadRow } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const supabase = createServerSupabase();

    const { data: leadData } = await supabase
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (!leadData) throw new HttpError(404, "Lead not found.");
    const lead = leadData as LeadRow;

    let eventCtx: { event_name?: string; teams_or_entities?: string | null; location?: string | null } | undefined;
    if (lead.event_id) {
      const { data: ev } = await supabase
        .from("events")
        .select("*")
        .eq("id", lead.event_id)
        .maybeSingle();
      if (ev) {
        const e = ev as EventRow;
        eventCtx = {
          event_name: e.event_name,
          teams_or_entities: e.teams_or_entities,
          location: e.location,
        };
      }
    }

    const outcome = await triageLead(leadRowToInput(lead), eventCtx);
    const r = outcome.result;

    const { data: triageRow, error: triageErr } = await supabase
      .from("lead_ai_triage")
      .insert({
        lead_id: lead.id,
        team_id: session.team.id,
        provider: outcome.provider,
        model: outcome.model,
        result: r,
        created_by: session.user.id,
      })
      .select("*")
      .single();
    if (triageErr) throw new HttpError(400, triageErr.message);

    // Fold AI scores back into the lead for fast dashboard/inbox reads.
    const { data: updated, error: updErr } = await supabase
      .from("leads")
      .update({
        newsworthiness_score: r.newsworthiness_score,
        verification_score: r.verification_score,
        risk_level: r.risk_level,
        recommended_action: r.recommended_action,
        headline: lead.headline || r.short_summary.slice(0, 140),
        status: lead.status === "new" ? "triage" : lead.status,
      })
      .eq("id", lead.id)
      .select("*")
      .single();
    if (updErr) throw new HttpError(400, updErr.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "triage_run",
      entityType: "lead",
      entityId: lead.id,
      detail: {
        provider: outcome.provider,
        used_fallback: outcome.usedFallback,
        risk_level: r.risk_level,
        recommended_action: r.recommended_action,
      },
    });

    return ok({ triage: triageRow, lead: updated, usedFallback: outcome.usedFallback });
  });
}
