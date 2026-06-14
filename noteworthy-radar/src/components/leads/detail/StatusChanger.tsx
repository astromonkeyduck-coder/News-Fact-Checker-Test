"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button, Checkbox, Input, Select } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/badges";
import { allowedNextStatuses } from "@/lib/domain/status";
import { isHighRisk } from "@/lib/domain/risk";
import type { LeadStatus, RiskLevel } from "@/lib/constants";

export function StatusChanger({
  leadId,
  current,
  riskLevel,
  finalApproval,
  canEdit,
}: {
  leadId: string;
  current: LeadStatus;
  riskLevel: RiskLevel | null;
  finalApproval: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const next = allowedNextStatuses(current);
  const [target, setTarget] = useState<LeadStatus | "">("");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const gated = ["approved_for_caption", "approved_for_video", "published"] as LeadStatus[];
  const needsOverride =
    isHighRisk(riskLevel) && !finalApproval && target !== "" && gated.includes(target);

  async function submit() {
    if (!target) return;
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/leads/${leadId}/status`, {
        status: target,
        note,
        override_high_risk: override,
      });
      setTarget("");
      setNote("");
      setOverride(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="label">Current</span>
        <StatusBadge status={current} />
      </div>

      {!canEdit ? (
        <p className="text-2xs text-ink-faint">Viewer role cannot change status.</p>
      ) : next.length === 0 ? (
        <p className="text-2xs text-ink-faint">No further transitions available.</p>
      ) : (
        <>
          <Select value={target} onChange={(e) => setTarget(e.target.value as LeadStatus)}>
            <option value="">Move to…</option>
            {next.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {needsOverride ? (
            <label className="flex items-start gap-2 rounded border border-urgent/40 bg-urgent-soft p-2 text-2xs text-urgent">
              <Checkbox checked={override} onChange={(e) => setOverride(e.target.checked)} />
              <span>
                High-risk lead without final editor approval. Check to override and log this action.
              </span>
            </label>
          ) : null}
          {error ? <p className="text-2xs text-urgent">{error}</p> : null}
          <Button variant="primary" size="sm" disabled={!target || busy} onClick={submit}>
            {busy ? "Updating…" : "Apply status"}
          </Button>
        </>
      )}
    </div>
  );
}
