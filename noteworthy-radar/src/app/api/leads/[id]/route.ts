import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { leadInputSchema } from "@/lib/validation/schemas";
import { analyzeRisk } from "@/lib/domain/risk";

const updateSchema = leadInputSchema.partial().extend({});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    await requireApiSession("editor");
    const body = await request.json();
    const input = updateSchema.parse(body);

    const supabase = createServerSupabase();
    const { data: existing } = await supabase
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (!existing) throw new HttpError(404, "Lead not found.");

    const merged = { ...existing, ...input };
    const { level } = analyzeRisk(merged);

    const patch: Record<string, unknown> = { risk_level: level };
    for (const key of Object.keys(input) as Array<keyof typeof input>) {
      const value = input[key];
      patch[key] = value === "" ? null : value;
    }

    const { data, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message);

    return ok({ lead: data });
  });
}
