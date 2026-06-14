import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { generateKeywords } from "@/lib/domain/keywords";
import type { EventRow } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    await requireApiSession("editor");
    const supabase = createServerSupabase();

    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (!event) throw new HttpError(404, "Event not found.");

    const e = event as EventRow;
    const keywords = generateKeywords({
      event_name: e.event_name,
      teams_or_entities: e.teams_or_entities,
      location: e.location,
      event_type: e.event_type,
      keyword_seed: e.keyword_seed,
    });

    const { data, error } = await supabase
      .from("events")
      .update({ generated_keywords: keywords })
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message);

    return ok({ event: data, keywords });
  });
}
