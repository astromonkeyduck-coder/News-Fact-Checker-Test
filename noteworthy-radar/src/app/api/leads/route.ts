import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { leadInputSchema } from "@/lib/validation/schemas";
import { analyzeRisk } from "@/lib/domain/risk";
import { writeAudit } from "@/lib/domain/audit";

export async function POST(request: Request) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = leadInputSchema.parse(body);

    // Auto-compute an initial risk level from flags + content heuristics.
    const { level } = analyzeRisk(input);

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        team_id: session.team.id,
        event_id: input.event_id || null,
        platform: input.platform,
        source_url: input.source_url || null,
        source_handle: input.source_handle || null,
        post_text: input.post_text || null,
        claimed_location: input.claimed_location || null,
        claimed_time: input.claimed_time || null,
        what_it_appears_to_show: input.what_it_appears_to_show || null,
        media_type: input.media_type,
        violence_flag: input.violence_flag,
        weapon_flag: input.weapon_flag,
        graphic_flag: input.graphic_flag,
        minors_visible_flag: input.minors_visible_flag,
        private_people_identifiable_flag: input.private_people_identifiable_flag,
        law_enforcement_involved_flag: input.law_enforcement_involved_flag,
        permission_status: input.permission_status,
        status: "new",
        risk_level: level,
        verification_checklist: input.source_url ? { source_url_saved: true } : {},
        notes: input.notes || null,
        created_by: session.user.id,
      })
      .select("*")
      .single();

    if (error) throw new HttpError(400, error.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "lead_created",
      entityType: "lead",
      entityId: data.id,
      detail: { platform: data.platform, risk_level: level },
    });

    return ok({ lead: data }, 201);
  });
}
