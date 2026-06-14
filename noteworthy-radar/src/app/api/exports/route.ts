import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireApiSession, withErrors, ok, HttpError } from "@/lib/api/route-helpers";
import { exportRequestSchema } from "@/lib/validation/schemas";
import { evaluateExportGate } from "@/lib/domain/permission";
import { hasFinalEditorApproval } from "@/lib/domain/verification";
import { renderVerticalExport } from "@/lib/video/export";
import { MEDIA_BUCKET, createSignedUrl } from "@/lib/storage";
import { writeAudit } from "@/lib/domain/audit";
import type { LeadRow, MediaAssetRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return withErrors(async () => {
    const session = await requireApiSession("editor");
    const body = await request.json();
    const input = exportRequestSchema.parse(body);

    const admin = createAdminSupabase();

    const { data: assetData } = await admin
      .from("media_assets")
      .select("*")
      .eq("id", input.media_asset_id)
      .maybeSingle();
    if (!assetData || (assetData as MediaAssetRow).team_id !== session.team.id) {
      throw new HttpError(404, "Media asset not found.");
    }
    const asset = assetData as MediaAssetRow;
    if (!asset.lead_id) throw new HttpError(400, "Media asset is not attached to a lead.");

    const { data: leadData } = await admin
      .from("leads")
      .select("*")
      .eq("id", asset.lead_id)
      .maybeSingle();
    if (!leadData) throw new HttpError(404, "Lead not found.");
    const lead = leadData as LeadRow;

    // --- COMPLIANCE GATE (server-authoritative) -----------------------
    const gate = evaluateExportGate({
      permissionStatus: lead.permission_status,
      riskLevel: lead.risk_level,
      finalEditorApproval: hasFinalEditorApproval(lead.verification_checklist),
      overrideHighRisk: input.override_high_risk,
    });
    if (!gate.allowed) {
      await writeAudit({
        teamId: session.team.id,
        actorId: session.user.id,
        action: "video_exported",
        entityType: "lead",
        entityId: lead.id,
        detail: { blocked: true, reason: gate.reason },
      });
      throw new HttpError(403, gate.reason ?? "Export blocked by permission gate.");
    }

    // Download the source media.
    const { data: file, error: dlErr } = await admin.storage
      .from(MEDIA_BUCKET)
      .download(asset.storage_path);
    if (dlErr || !file) throw new HttpError(400, "Could not read source media.");
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const render = await renderVerticalExport({
      inputBuffer,
      inputFileName: asset.file_name,
      topLabel: input.top_label,
      captionText: input.caption_text,
      creditLine: input.credit_line,
      blurBoxes: input.blur_boxes,
    });

    let outputPath: string | null = null;
    if (render.status === "rendered" && render.outputBuffer) {
      outputPath = `${session.team.id}/${lead.id}/exports/${Date.now()}-export.mp4`;
      const { error: upErr } = await admin.storage
        .from(MEDIA_BUCKET)
        .upload(outputPath, render.outputBuffer, { contentType: "video/mp4", upsert: false });
      if (upErr) throw new HttpError(400, upErr.message);
    }

    const { data: exportRow, error: exErr } = await admin
      .from("exports")
      .insert({
        team_id: session.team.id,
        lead_id: lead.id,
        media_asset_id: asset.id,
        status: render.status,
        output_path: outputPath,
        top_label: input.top_label,
        caption_text: input.caption_text || null,
        credit_line: input.credit_line || null,
        permission_status_at_export: lead.permission_status,
        override_used: Boolean(input.override_high_risk),
        error: render.note ?? null,
        created_by: session.user.id,
      })
      .select("*")
      .single();
    if (exErr) throw new HttpError(400, exErr.message);

    await writeAudit({
      teamId: session.team.id,
      actorId: session.user.id,
      action: "video_exported",
      entityType: "lead",
      entityId: lead.id,
      detail: {
        status: render.status,
        permission_status: lead.permission_status,
        override_used: Boolean(input.override_high_risk),
      },
    });

    const signedUrl = outputPath ? await createSignedUrl(outputPath) : null;
    return ok({ export: exportRow, signedUrl, note: render.note }, 201);
  });
}
