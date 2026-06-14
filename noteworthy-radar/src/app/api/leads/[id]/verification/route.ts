import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { verificationUpdateSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/domain/audit";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = verificationUpdateSchema.parse(body);

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("leads")
      .update({ verification_checklist: input.checklist })
      .eq("id", params.id)
      .select("*")
      .single();
    if (error) throw new HttpError(400, error.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "verification_updated",
      entityType: "lead",
      entityId: params.id,
      detail: { final_editor_approval: Boolean(input.checklist.final_editor_approval) },
    });

    return ok({ lead: data });
  });
}
