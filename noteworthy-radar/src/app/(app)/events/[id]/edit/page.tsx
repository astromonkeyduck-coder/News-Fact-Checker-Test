import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { getEvent } from "@/lib/data/queries";
import { PageHeader } from "@/components/PageHeader";
import { EventForm } from "@/components/events/EventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  assertRole(session.role, "editor");
  const event = await getEvent(params.id);
  if (!event) notFound();

  return (
    <div>
      <PageHeader title={`Edit: ${event.event_name}`} />
      <EventForm event={event} />
    </div>
  );
}
