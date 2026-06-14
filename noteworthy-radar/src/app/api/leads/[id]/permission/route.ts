import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { permissionInputSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/domain/audit";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = permissionInputSchema.parse(body);

    const supabase = createServerSupabase();

    const { data: permission, error: permErr } = await supabase
      .from("permissions")
      .upsert(
        {
          team_id: session.team.id,
          lead_id: params.id,
          permission_status: input.permission_status,
          original_uploader: input.original_uploader || null,
          contact_method: input.contact_method || null,
          date_requested: input.date_requested || null,
          date_granted: input.date_granted || null,
          license_notes: input.license_notes || null,
          allowed_platforms: input.allowed_platforms,
          expiration: input.expiration || null,
          evidence_url: input.evidence_url || null,
          updated_by: session.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lead_id" },
      )
      .select("*")
      .single();
    if (permErr) throw new HttpError(400, permErr.message);

    // Keep the lead's denormalized permission_status in sync.
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .update({ permission_status: input.permission_status })
      .eq("id", params.id)
      .select("*")
      .single();
    if (leadErr) throw new HttpError(400, leadErr.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "permission_changed",
      entityType: "lead",
      entityId: params.id,
      detail: { permission_status: input.permission_status },
    });

    return ok({ permission, lead });
  });
}
