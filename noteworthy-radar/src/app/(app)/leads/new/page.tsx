import { requireSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { getEvents } from "@/lib/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { LeadForm } from "@/components/leads/LeadForm";

export const dynamic = "force-dynamic";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireSession();
  assertRole(session.role, "editor");
  const events = await getEvents(session.team.id);

  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const defaultEventId = str(searchParams.event_id);

  return (
    <div>
      <PageHeader
        title="Add lead"
        subtitle="Capture a manually-found public post. Describe it neutrally."
      />
      <LeadForm
        events={events.map((e) => ({ id: e.id, event_name: e.event_name }))}
        defaultEventId={defaultEventId}
        prefill={{
          source_url: str(searchParams.source_url),
          source_handle: str(searchParams.source_handle),
          post_text: str(searchParams.post_text),
          claimed_location: str(searchParams.claimed_location),
          what_it_appears_to_show: str(searchParams.what_it_appears_to_show),
          platform: str(searchParams.platform),
        }}
      />
    </div>
  );
}
