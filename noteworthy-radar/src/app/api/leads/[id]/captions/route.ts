import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { generateCaptions } from "@/lib/ai/triage";
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

    let eventName: string | undefined;
    if (lead.event_id) {
      const { data: ev } = await supabase
        .from("events")
        .select("event_name")
        .eq("id", lead.event_id)
        .maybeSingle();
      eventName = (ev as Pick<EventRow, "event_name"> | null)?.event_name;
    }

    const outcome = await generateCaptions(leadRowToInput(lead), {
      event_name: eventName,
      isOfficial:
        lead.platform === "Official Source" || lead.permission_status === "official_source",
      riskLevel: lead.risk_level ?? undefined,
    });

    const { data: caption, error } = await supabase
      .from("captions")
      .insert({
        team_id: session.team.id,
        lead_id: lead.id,
        neutral_under_240: outcome.drafts.neutral_under_240,
        breaking_under_280: outcome.drafts.breaking_under_280,
        facebook_post: outcome.drafts.facebook_post,
        instagram_caption: outcome.drafts.instagram_caption,
        credit_line: outcome.credit_line,
        created_by: session.user.id,
      })
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "caption_generated",
      entityType: "lead",
      entityId: lead.id,
      detail: { provider: outcome.provider },
    });

    return ok({ caption });
  });
}
