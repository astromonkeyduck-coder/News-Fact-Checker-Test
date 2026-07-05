import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getLeadBundle } from "@/lib/data/queries";
import { createSignedUrl } from "@/lib/storage";
import { canEdit } from "@/lib/auth/rbac";
import { hasFinalEditorApproval } from "@/lib/domain/verification";
import { isHighRisk } from "@/lib/domain/risk";
import { RISK_FLAG_KEYS, RISK_FLAG_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Panel, PanelTitle, Button, EmptyState } from "@/components/ui/primitives";
import { Badge, PermissionBadge, RiskBadge, ScorePill, StatusBadge } from "@/components/ui/badges";
import { TriageButton } from "@/components/leads/detail/TriageButton";
import { StatusChanger } from "@/components/leads/detail/StatusChanger";
import { VerificationChecklist } from "@/components/leads/detail/VerificationChecklist";
import { PermissionPanel } from "@/components/leads/detail/PermissionPanel";
import { CaptionsPanel } from "@/components/leads/detail/CaptionsPanel";
import { NotesEditor } from "@/components/leads/detail/NotesEditor";
import { MediaUpload } from "@/components/leads/detail/MediaUpload";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const bundle = await getLeadBundle(params.id);
  if (!bundle) notFound();

  const { lead, event, triage, captions, permission, history, media } = bundle;
  const editable = canEdit(session.role);
  const t = triage?.result ?? null;
  const finalApproval = hasFinalEditorApproval(lead.verification_checklist);

  const activeFlags = RISK_FLAG_KEYS.filter((k) => lead[k]);
  const mediaWithUrls = await Promise.all(
    media.map(async (m) => ({ ...m, url: await createSignedUrl(m.storage_path) })),
  );

  return (
    <div>
      <PageHeader
        title={lead.headline || lead.what_it_appears_to_show || "Lead"}
        subtitle={
          event ? `${lead.platform} · ${event.event_name}` : lead.platform
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={lead.risk_level} />
            <StatusBadge status={lead.status} />
            <PermissionBadge status={lead.permission_status} />
          </div>
        }
      />

      {isHighRisk(lead.risk_level) && !finalApproval ? (
        <div className="panel mb-4 border-urgent/40 bg-urgent-soft p-3 text-xs text-urgent">
          High-risk lead. Final editor approval (verification checklist) is required before it can
          advance to caption, video, or publish.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left / main column */}
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <div className="flex items-center justify-between">
              <PanelTitle>AI triage</PanelTitle>
              {editable ? <TriageButton leadId={lead.id} hasTriage={Boolean(triage)} /> : null}
            </div>
            {!t ? (
              <p className="mt-3 text-xs text-ink-faint">
                No triage yet. Run AI triage to generate a summary, scores, and risk analysis.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ScorePill value={t.newsworthiness_score} label="Newsworthiness" />
                  <ScorePill value={t.verification_score} label="Verification" />
                  <RiskBadge level={t.risk_level} />
                  <Badge>{t.recommended_action.replace(/_/g, " ")}</Badge>
                  {triage?.provider ? (
                    <span className="text-2xs text-ink-faint">via {triage.provider}</span>
                  ) : null}
                </div>
                <div>
                  <span className="label">Summary</span>
                  <p className="mt-1 text-sm text-ink-muted">{t.short_summary}</p>
                </div>
                <div>
                  <span className="label">Event connection</span>
                  <p className="mt-1 text-sm text-ink-muted">{t.event_connection}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <RiskList title="Safety risks" items={t.safety_risks} />
                  <RiskList title="Privacy risks" items={t.privacy_risks} />
                  <RiskList title="Copyright / permission" items={t.copyright_permission_risks} />
                  <RiskList title="Missing facts" items={t.missing_facts} />
                </div>
                {t.editor_questions_before_publish.length > 0 ? (
                  <div>
                    <span className="label">Editor questions before publish</span>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
                      {t.editor_questions_before_publish.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle>Caption drafts</PanelTitle>
            <div className="mt-3">
              <CaptionsPanel leadId={lead.id} caption={captions} canEdit={editable} />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Permission workflow</PanelTitle>
            <div className="mt-3">
              <PermissionPanel
                leadId={lead.id}
                permission={permission}
                defaultStatus={lead.permission_status}
                sourceHandle={lead.source_handle}
                eventName={event?.event_name ?? null}
                canEdit={editable}
              />
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between">
              <PanelTitle>Media & export</PanelTitle>
              <Link href={`/leads/${lead.id}/export`}>
                <Button size="sm" variant="primary">
                  Open export
                </Button>
              </Link>
            </div>
            <div className="mt-3 space-y-3">
              {mediaWithUrls.length === 0 ? (
                <EmptyState title="No media uploaded" hint="Upload a rights-cleared file to export." />
              ) : (
                <ul className="space-y-2">
                  {mediaWithUrls.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-2 py-1.5"
                    >
                      <span className="truncate text-xs text-ink-muted">{m.file_name}</span>
                      <div className="flex items-center gap-2">
                        <PermissionBadge status={m.rights_status} />
                        {m.url ? (
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-2xs text-info hover:underline">
                            preview
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {editable ? <MediaUpload leadId={lead.id} /> : null}
            </div>
          </Panel>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Panel>
            <PanelTitle>Workflow status</PanelTitle>
            <div className="mt-3">
              <StatusChanger
                leadId={lead.id}
                current={lead.status}
                riskLevel={lead.risk_level}
                finalApproval={finalApproval}
                canEdit={editable}
              />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Verification checklist</PanelTitle>
            <div className="mt-3">
              <VerificationChecklist
                leadId={lead.id}
                initial={lead.verification_checklist}
                canEdit={editable}
              />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Lead facts</PanelTitle>
            <dl className="mt-3 space-y-2 text-xs">
              <Fact label="Source URL">
                {lead.source_url ? (
                  <a href={lead.source_url} target="_blank" rel="noreferrer" className="break-all text-info hover:underline">
                    {lead.source_url}
                  </a>
                ) : (
                  "-"
                )}
              </Fact>
              <Fact label="Handle">{lead.source_handle || "-"}</Fact>
              <Fact label="Claimed location">{lead.claimed_location || "-"}</Fact>
              <Fact label="Claimed time">
                {lead.claimed_time ? new Date(lead.claimed_time).toLocaleString() : "-"}
              </Fact>
              <Fact label="Media type">{lead.media_type}</Fact>
            </dl>
            {activeFlags.length > 0 ? (
              <div className="mt-3">
                <span className="label">Risk flags</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {activeFlags.map((f) => (
                    <Badge key={f} tone="urgent">
                      {RISK_FLAG_LABELS[f]}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelTitle>Editor notes</PanelTitle>
            <div className="mt-3">
              <NotesEditor leadId={lead.id} initial={lead.notes ?? ""} canEdit={editable} />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Status history</PanelTitle>
            {history.length === 0 ? (
              <p className="mt-2 text-xs text-ink-faint">No status changes yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs text-ink-muted">
                {history.map((h) => (
                  <li key={h.id} className="border-l border-border pl-2">
                    <div>
                      {h.from_status ? `${h.from_status} → ` : ""}
                      <span className="text-ink">{h.to_status}</span>
                    </div>
                    <div className="text-2xs text-ink-faint">
                      {new Date(h.created_at).toLocaleString()}
                      {h.note ? ` · ${h.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function RiskList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-border bg-surface p-2">
      <span className="label">{title}</span>
      {items.length === 0 ? (
        <p className="mt-1 text-2xs text-ink-faint">None noted</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
          {items.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label">{label}</dt>
      <dd className="text-ink-muted">{children}</dd>
    </div>
  );
}
