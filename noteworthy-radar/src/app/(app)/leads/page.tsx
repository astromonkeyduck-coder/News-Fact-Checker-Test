import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getEventLeadCounts } from "@/lib/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/primitives";
import { LeadTable } from "@/components/leads/LeadTable";
import { canEdit } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await requireSession();
  const { leads, events } = await getEventLeadCounts(session.team.id);

  return (
    <div>
      <PageHeader
        title="Lead inbox"
        subtitle="Triage manually-captured leads. Filter, sort, and open for full workflow."
        actions={
          canEdit(session.role) ? (
            <Link href="/leads/new">
              <Button variant="primary">Add lead</Button>
            </Link>
          ) : null
        }
      />
      <LeadTable leads={leads} events={events.map((e) => ({ id: e.id, event_name: e.event_name }))} />
    </div>
  );
}
