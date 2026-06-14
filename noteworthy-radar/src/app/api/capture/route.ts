import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { captureInputSchema } from "@/lib/validation/schemas";
import { analyzeRisk } from "@/lib/domain/risk";
import { writeAudit } from "@/lib/domain/audit";

/**
 * Capture endpoint for the safe bookmarklet / future extension.
 * COMPLIANCE: this only accepts a URL + manual fields submitted by a
 * signed-in editor. It performs NO scraping, NO background collection, and
 * requires an authenticated same-origin session.
 */
export async function POST(request: Request) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = captureInputSchema.parse(body);

    const draft = {
      platform: input.platform ?? ("Other" as const),
      source_url: input.source_url,
      source_handle: input.source_handle ?? "",
      post_text: input.post_text ?? "",
      claimed_location: input.claimed_location ?? "",
      what_it_appears_to_show: input.what_it_appears_to_show ?? "",
    };
    const { level } = analyzeRisk(draft);

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        team_id: session.team.id,
        event_id: input.event_id || null,
        platform: draft.platform,
        source_url: draft.source_url,
        source_handle: draft.source_handle || null,
        post_text: draft.post_text || null,
        claimed_location: draft.claimed_location || null,
        what_it_appears_to_show: draft.what_it_appears_to_show || null,
        media_type: "unknown",
        permission_status: "unknown",
        status: "new",
        risk_level: level,
        verification_checklist: { source_url_saved: true },
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) throw new HttpError(400, error.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "lead_created",
      entityType: "lead",
      entityId: data.id,
      detail: { via: "capture_helper" },
    });

    return ok({ id: data.id }, 201);
  });
}
