import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { eventInputSchema } from "@/lib/validation/schemas";
import { generateKeywords } from "@/lib/domain/keywords";
import { writeAudit } from "@/lib/domain/audit";

export async function POST(request: Request) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = eventInputSchema.parse(body);

    const keywords =
      input.generated_keywords.length > 0
        ? input.generated_keywords
        : generateKeywords({
            event_name: input.event_name,
            teams_or_entities: input.teams_or_entities || null,
            location: input.location || null,
            event_type: input.event_type,
            keyword_seed: input.keyword_seed || null,
          });

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("events")
      .insert({
        team_id: session.team.id,
        event_name: input.event_name,
        event_type: input.event_type,
        teams_or_entities: input.teams_or_entities || null,
        location: input.location || null,
        start_time: input.start_time || null,
        end_time: input.end_time || null,
        status: input.status,
        keyword_seed: input.keyword_seed || null,
        generated_keywords: keywords,
        notes: input.notes || null,
        created_by: session.user.id,
      })
      .select("*")
      .single();

    if (error) throw new HttpError(400, error.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "event_created",
      entityType: "event",
      entityId: data.id,
      detail: { event_name: data.event_name },
    });

    return ok({ event: data }, 201);
  });
}
