import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getEventLeadCounts } from "@/lib/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/primitives";
import { canEdit } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const session = await requireSession();
  const { events, leads } = await getEventLeadCounts(session.team.id);

  const countFor = (eventId: string) => leads.filter((l) => l.event_id === eventId).length;

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Create event cards, generate keywords, and track connected leads."
        actions={
          canEdit(session.role) ? (
            <Link href="/events/new">
              <Button variant="primary">New event</Button>
            </Link>
          ) : null
        }
      />

      {events.length === 0 ? (
        <EmptyState title="No events yet" hint="Create an event card to start tracking a story." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map((ev) => (
            <Link key={ev.id} href={`/events/${ev.id}`} className="panel block p-4 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{ev.event_name}</h2>
                <Badge tone={ev.status === "live" ? "urgent" : ev.status === "post_event" ? "warn" : "default"}>
                  {ev.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {ev.event_type.replace(/_/g, " ")}
                {ev.location ? ` · ${ev.location}` : ""}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-ink-faint">
                <span>{countFor(ev.id)} leads</span>
                <span>{ev.generated_keywords.length} keywords</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
