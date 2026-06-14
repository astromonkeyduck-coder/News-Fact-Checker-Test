"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/primitives";

export function TriageButton({ leadId, hasTriage }: { leadId: string; hasTriage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/leads/${leadId}/triage`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Triage failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
        {busy ? "Running…" : hasTriage ? "Re-run AI triage" : "Run AI triage"}
      </Button>
      {error ? <span className="text-2xs text-urgent">{error}</span> : null}
    </div>
  );
}
