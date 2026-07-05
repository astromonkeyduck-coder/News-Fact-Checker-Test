import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getEvent, getLeads } from "@/lib/data/queries";
import { buildSearchStrings } from "@/lib/domain/keywords";
import { VERIFICATION_ITEMS } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Panel, PanelTitle, Button, EmptyState } from "@/components/ui/primitives";
import { Badge, RiskBadge, StatusBadge, PermissionBadge } from "@/components/ui/badges";
import { KeywordBank } from "@/components/events/KeywordBank";
import { CopyButton } from "@/components/CopyButton";
import { canEdit } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const event = await getEvent(params.id);
  if (!event) notFound();

  const leads = await getLeads(session.team.id, { eventId: event.id });
  const editable = canEdit(session.role);
  const searchGroups = buildSearchStrings(event);

  const riskCounts = {
    critical: leads.filter((l) => l.risk_level === "critical").length,
    high: leads.filter((l) => l.risk_level === "high").length,
    medium: leads.filter((l) => l.risk_level === "medium").length,
    low: leads.filter((l) => l.risk_level === "low").length,
  };

  return (
    <div>
      <PageHeader
        title={event.event_name}
        subtitle={`${event.event_type.replace(/_/g, " ")}${event.location ? ` · ${event.location}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={event.status === "live" ? "urgent" : "default"}>
              {event.status.replace(/_/g, " ")}
            </Badge>
            {editable ? (
              <>
                <Link href={`/events/${event.id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <Link href={`/leads/new?event_id=${event.id}`}>
                  <Button variant="primary">Create lead from event</Button>
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <KeywordBank
              eventId={event.id}
              initialKeywords={event.generated_keywords}
              canEdit={editable}
            />
          </Panel>

          <Panel>
            <PanelTitle>Suggested searches by platform</PanelTitle>
            <p className="mb-3 mt-1 text-2xs text-ink-faint">
              Copy these into each platform&apos;s own search box manually. Noteworthy Radar never
              runs searches automatically or scrapes results.
            </p>
            <div className="space-y-4">
              {searchGroups.map((group) => (
                <div key={group.platform}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">{group.platform}</span>
                  </div>
                  <p className="mb-2 text-2xs text-ink-faint">{group.note}</p>
                  <ul className="space-y-1">
                    {group.queries.map((q) => (
                      <li
                        key={q}
                        className="flex items-center justify-between gap-2 rounded-sm border border-border bg-surface px-2 py-1"
                      >
                        <code className="truncate text-xs text-ink-muted">{q}</code>
                        <CopyButton text={q} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Connected leads ({leads.length})</PanelTitle>
            {leads.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No leads linked yet" hint="Create a lead from this event." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table>
                  <thead>
                    <tr className="border-b border-border text-left text-2xs uppercase tracking-wider text-ink-faint">
                      <th className="py-2 pr-3">Headline</th>
                      <th className="py-2 pr-3">Platform</th>
                      <th className="py-2 pr-3">Risk</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Permission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id} className="border-b border-border/60 hover:bg-panel-raised">
                        <td className="py-2 pr-3">
                          <Link href={`/leads/${l.id}`} className="text-ink hover:underline">
                            {l.headline || l.what_it_appears_to_show || "(untitled lead)"}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-ink-muted">{l.platform}</td>
                        <td className="py-2 pr-3"><RiskBadge level={l.risk_level} /></td>
                        <td className="py-2 pr-3"><StatusBadge status={l.status} /></td>
                        <td className="py-2 pr-3"><PermissionBadge status={l.permission_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelTitle>Risk summary</PanelTitle>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <RiskStat label="Critical" value={riskCounts.critical} tone="urgent" />
              <RiskStat label="High" value={riskCounts.high} tone="urgent" />
              <RiskStat label="Medium" value={riskCounts.medium} tone="warn" />
              <RiskStat label="Low" value={riskCounts.low} tone="ok" />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>Timeline</PanelTitle>
            <ul className="mt-3 space-y-2 text-xs text-ink-muted">
              {event.start_time ? (
                <li>Starts: {new Date(event.start_time).toLocaleString()}</li>
              ) : null}
              {event.end_time ? <li>Ends: {new Date(event.end_time).toLocaleString()}</li> : null}
              <li>Created: {new Date(event.created_at).toLocaleString()}</li>
              {leads.slice(0, 5).map((l) => (
                <li key={l.id} className="border-l border-border pl-2">
                  {new Date(l.created_at).toLocaleString()} - lead added ({l.platform})
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>Verification checklist</PanelTitle>
            <p className="mb-2 mt-1 text-2xs text-ink-faint">
              Standard steps applied to every lead before publish.
            </p>
            <ul className="space-y-1 text-xs text-ink-muted">
              {VERIFICATION_ITEMS.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-border-strong" aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </Panel>

          {event.notes ? (
            <Panel>
              <PanelTitle>Notes</PanelTitle>
              <p className="mt-2 whitespace-pre-wrap text-xs text-ink-muted">{event.notes}</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RiskStat({ label, value, tone }: { label: string; value: number; tone: "urgent" | "warn" | "ok" }) {
  const color = tone === "urgent" ? "text-urgent" : tone === "warn" ? "text-warn" : "text-ok";
  return (
    <div className="rounded border border-border bg-surface p-2">
      <div className="label">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
