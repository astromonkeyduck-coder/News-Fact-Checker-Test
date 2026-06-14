import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getEventLeadCounts } from "@/lib/data/queries";
import { hasFinalEditorApproval } from "@/lib/domain/verification";
import { LEAD_STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Panel, PanelTitle, StatTile, EmptyState } from "@/components/ui/primitives";
import { Badge, PermissionBadge, RiskBadge, StatusBadge } from "@/components/ui/badges";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const { leads, events } = await getEventLeadCounts(session.team.id);

  const activeEvents = events.filter((e) => e.status === "live" || e.status === "post_event");
  const highRisk = leads.filter((l) => l.risk_level === "high" || l.risk_level === "critical");
  const needsVerification = leads.filter(
    (l) => l.status === "verify_more" || (l.verification_score ?? 5) <= 2,
  );
  const readyToPublish = leads.filter(
    (l) =>
      (l.status === "approved_for_caption" || l.status === "approved_for_video") &&
      hasFinalEditorApproval(l.verification_checklist),
  );
  const recent = [...leads]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 8);

  const statusCounts = LEAD_STATUSES.map((s) => ({
    status: s,
    count: leads.filter((l) => l.status === s).length,
  }));

  return (
    <div>
      <PageHeader
        title="Command center"
        subtitle={`${session.team.name} · ${leads.length} leads tracked`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active events" value={activeEvents.length} />
        <StatTile label="High-risk leads" value={highRisk.length} accent={highRisk.length ? "urgent" : "default"} />
        <StatTile
          label="Needs verification"
          value={needsVerification.length}
          accent={needsVerification.length ? "warn" : "default"}
        />
        <StatTile label="Ready to publish" value={readyToPublish.length} accent="ok" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelTitle>High-risk leads needing review</PanelTitle>
            {highRisk.length === 0 ? (
              <p className="mt-2 text-xs text-ink-faint">No high-risk leads right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {highRisk.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/leads/${l.id}`} className="min-w-0 flex-1 truncate text-sm text-ink hover:underline">
                      {l.headline || l.what_it_appears_to_show || "(untitled lead)"}
                    </Link>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={l.risk_level} />
                      <StatusBadge status={l.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelTitle>Recent saved items</PanelTitle>
            {recent.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No leads yet" hint="Add a manually-captured lead to begin." />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {recent.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${l.id}`} className="block truncate text-sm text-ink hover:underline">
                        {l.headline || l.what_it_appears_to_show || "(untitled lead)"}
                      </Link>
                      <span className="text-2xs text-ink-faint">
                        {l.platform} · {new Date(l.created_at).toLocaleString()}
                      </span>
                    </div>
                    <PermissionBadge status={l.permission_status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelTitle>Leads by status</PanelTitle>
            <ul className="mt-3 space-y-1.5">
              {statusCounts.map(({ status, count }) => (
                <li key={status} className="flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="tabular-nums text-sm text-ink-muted">{count}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>Active events</PanelTitle>
            {activeEvents.length === 0 ? (
              <p className="mt-2 text-xs text-ink-faint">No live or post-event cards.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activeEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <Link href={`/events/${e.id}`} className="truncate text-sm text-ink hover:underline">
                      {e.event_name}
                    </Link>
                    <Badge tone={e.status === "live" ? "urgent" : "warn"}>
                      {e.status.replace(/_/g, " ")}
                    </Badge>
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
