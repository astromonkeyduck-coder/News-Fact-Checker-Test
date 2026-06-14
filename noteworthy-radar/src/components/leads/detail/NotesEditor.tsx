"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button, Textarea } from "@/components/ui/primitives";

export function NotesEditor({
  leadId,
  initial,
  canEdit,
}: {
  leadId: string;
  initial: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await api.patch(`/api/leads/${leadId}`, { notes });
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return <p className="whitespace-pre-wrap text-xs text-ink-muted">{initial || "—"}</p>;
  }

  return (
    <div className="space-y-2">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save notes"}
        </Button>
        {saved ? <span className="text-2xs text-ok">Saved</span> : null}
      </div>
    </div>
  );
}
