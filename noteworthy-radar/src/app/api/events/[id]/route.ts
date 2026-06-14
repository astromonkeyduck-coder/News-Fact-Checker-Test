import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { eventInputSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    await requireApiSession("editor");
    const body = await request.json();
    const input = eventInputSchema.partial().parse(body);

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("events")
      .update({
        ...(input.event_name !== undefined ? { event_name: input.event_name } : {}),
        ...(input.event_type !== undefined ? { event_type: input.event_type } : {}),
        ...(input.teams_or_entities !== undefined
          ? { teams_or_entities: input.teams_or_entities || null }
          : {}),
        ...(input.location !== undefined ? { location: input.location || null } : {}),
        ...(input.start_time !== undefined ? { start_time: input.start_time || null } : {}),
        ...(input.end_time !== undefined ? { end_time: input.end_time || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.keyword_seed !== undefined ? { keyword_seed: input.keyword_seed || null } : {}),
        ...(input.generated_keywords !== undefined
          ? { generated_keywords: input.generated_keywords }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw new HttpError(400, error.message);
    return ok({ event: data });
  });
}
