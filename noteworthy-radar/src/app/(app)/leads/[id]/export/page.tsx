import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getLeadBundle } from "@/lib/data/queries";
import { canEdit } from "@/lib/auth/rbac";
import { evaluateExportGate } from "@/lib/domain/permission";
import { hasFinalEditorApproval } from "@/lib/domain/verification";
import { PageHeader } from "@/components/PageHeader";
import { Button, Panel, PanelTitle } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badges";
import { ExportWorkspace } from "@/components/leads/detail/ExportWorkspace";
import { BRAND_HANDLE } from "@/lib/constants";
import { EXPORT_DEFAULT_TOP_LABEL_FALLBACK } from "@/lib/export-config";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const bundle = await getLeadBundle(params.id);
  if (!bundle) notFound();

  const { lead, captions, exports, media } = bundle;
  const editable = canEdit(session.role);

  const gate = evaluateExportGate({
    permissionStatus: lead.permission_status,
    riskLevel: lead.risk_level,
    finalEditorApproval: hasFinalEditorApproval(lead.verification_checklist),
  });

  const defaultTopLabel =
    process.env.EXPORT_DEFAULT_TOP_LABEL || EXPORT_DEFAULT_TOP_LABEL_FALLBACK;
  const defaultCaption = captions?.neutral_under_240 ?? lead.what_it_appears_to_show ?? "";
  const defaultCredit =
    captions?.credit_line ||
    (lead.source_handle ? `Credit: ${lead.source_handle}` : `Credit: ${BRAND_HANDLE}`);

  return (
    <div>
      <PageHeader
        title="Video export"
        subtitle="Branded vertical 9:16 export. Gated by permission status."
        actions={
          <Link href={`/leads/${lead.id}`}>
            <Button variant="ghost">Back to lead</Button>
          </Link>
        }
      />

      <ExportWorkspace
        media={media}
        defaultTopLabel={defaultTopLabel}
        defaultCaption={defaultCaption}
        defaultCredit={defaultCredit}
        gateAllowed={gate.allowed}
        gateReason={gate.reason}
        requiresOverride={!gate.allowed && gate.requiresOverride}
        canEdit={editable}
      />

      {exports.length > 0 ? (
        <Panel className="mt-4">
          <PanelTitle>Export history</PanelTitle>
          <ul className="mt-3 space-y-2">
            {exports.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5 text-xs"
              >
                <span className="text-ink-muted">{new Date(e.created_at).toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  {e.override_used ? <Badge tone="warn">override</Badge> : null}
                  <Badge tone={e.status === "rendered" ? "ok" : e.status === "failed" ? "urgent" : "default"}>
                    {e.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
