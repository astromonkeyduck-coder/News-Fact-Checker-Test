import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { MEDIA_BUCKET } from "@/lib/storage";
import type { LeadRow } from "@/lib/types";

export const runtime = "nodejs";
const MAX_BYTES = 200 * 1024 * 1024; // 200MB

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file provided.");
    if (file.size > MAX_BYTES) throw new HttpError(413, "File too large (max 200MB).");

    const admin = createAdminSupabase();

    // Confirm the lead belongs to the caller's team before writing.
    const { data: lead } = await admin
      .from("leads")
      .select("id, team_id, permission_status")
      .eq("id", params.id)
      .maybeSingle();
    if (!lead || (lead as LeadRow).team_id !== session.team.id) {
      throw new HttpError(404, "Lead not found.");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.team.id}/${params.id}/${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadErr) throw new HttpError(400, uploadErr.message);

    const { data: asset, error: assetErr } = await admin
      .from("media_assets")
      .insert({
        team_id: session.team.id,
        lead_id: params.id,
        storage_path: path,
        file_name: safeName,
        mime_type: file.type || null,
        size_bytes: file.size,
        rights_status: (lead as LeadRow).permission_status,
        created_by: session.user.id,
      })
      .select("*")
      .single();
    if (assetErr) throw new HttpError(400, assetErr.message);

    return ok({ media: asset }, 201);
  });
}
