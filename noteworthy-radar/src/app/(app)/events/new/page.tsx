import { requireSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/PageHeader";
import { EventForm } from "@/components/events/EventForm";

export default async function NewEventPage() {
  const session = await requireSession();
  assertRole(session.role, "editor");

  return (
    <div>
      <PageHeader title="New event" subtitle="Keywords are generated automatically on save." />
      <EventForm />
    </div>
  );
}
