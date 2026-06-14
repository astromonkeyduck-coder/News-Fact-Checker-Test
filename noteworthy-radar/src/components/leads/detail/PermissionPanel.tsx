"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button, Checkbox, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { CopyButton } from "@/components/CopyButton";
import { BRAND_NAME, PERMISSION_STATUSES, PLATFORMS } from "@/lib/constants";
import type { PermissionRow } from "@/lib/types";

function toDateInput(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function PermissionPanel({
  leadId,
  permission,
  defaultStatus,
  sourceHandle,
  eventName,
  canEdit,
}: {
  leadId: string;
  permission: PermissionRow | null;
  defaultStatus: string;
  sourceHandle: string | null;
  eventName: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    permission_status: permission?.permission_status ?? defaultStatus,
    original_uploader: permission?.original_uploader ?? sourceHandle ?? "",
    contact_method: permission?.contact_method ?? "",
    date_requested: toDateInput(permission?.date_requested ?? null),
    date_granted: toDateInput(permission?.date_granted ?? null),
    license_notes: permission?.license_notes ?? "",
    expiration: toDateInput(permission?.expiration ?? null),
    evidence_url: permission?.evidence_url ?? "",
  });
  const [allowed, setAllowed] = useState<string[]>(permission?.allowed_platforms ?? []);

  const handle = (form.original_uploader || sourceHandle || "@handle").replace(/^@?/, "@");
  const dmTemplate = `Hi, I'm with ${BRAND_NAME}. We saw your video from ${
    eventName || "[event]"
  }. Would you give us permission to repost it with credit to you as ${handle}/FB? Please reply "Yes, ${BRAND_NAME} can use my video with credit" if approved.`;

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function togglePlatform(p: string) {
    setAllowed((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api.put(`/api/leads/${leadId}/permission`, {
        ...form,
        date_requested: form.date_requested || "",
        date_granted: form.date_granted || "",
        expiration: form.expiration || "",
        allowed_platforms: allowed,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permission.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Permission status</Label>
          <Select
            value={form.permission_status}
            disabled={!canEdit}
            onChange={(e) => update("permission_status", e.target.value)}
          >
            {PERMISSION_STATUSES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Original uploader</Label>
          <Input
            value={form.original_uploader}
            disabled={!canEdit}
            onChange={(e) => update("original_uploader", e.target.value)}
          />
        </div>
        <div>
          <Label>Contact method</Label>
          <Input
            value={form.contact_method}
            disabled={!canEdit}
            placeholder="e.g. Instagram DM"
            onChange={(e) => update("contact_method", e.target.value)}
          />
        </div>
        <div>
          <Label>Evidence URL / screenshot</Label>
          <Input
            value={form.evidence_url}
            disabled={!canEdit}
            onChange={(e) => update("evidence_url", e.target.value)}
          />
        </div>
        <div>
          <Label>Date requested</Label>
          <Input
            type="date"
            value={form.date_requested}
            disabled={!canEdit}
            onChange={(e) => update("date_requested", e.target.value)}
          />
        </div>
        <div>
          <Label>Date granted</Label>
          <Input
            type="date"
            value={form.date_granted}
            disabled={!canEdit}
            onChange={(e) => update("date_granted", e.target.value)}
          />
        </div>
        <div>
          <Label>Expiration</Label>
          <Input
            type="date"
            value={form.expiration}
            disabled={!canEdit}
            onChange={(e) => update("expiration", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>License notes</Label>
        <Textarea
          value={form.license_notes}
          disabled={!canEdit}
          onChange={(e) => update("license_notes", e.target.value)}
        />
      </div>

      <div>
        <Label>Allowed platforms</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Checkbox
                checked={allowed.includes(p)}
                disabled={!canEdit}
                onChange={() => togglePlatform(p)}
              />
              {p}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="label">Permission DM template</span>
          <CopyButton text={dmTemplate} />
        </div>
        <p className="whitespace-pre-wrap text-xs text-ink-muted">{dmTemplate}</p>
      </div>

      {error ? <p className="text-2xs text-urgent">{error}</p> : null}
      {canEdit ? (
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save permission"}
        </Button>
      ) : null}
    </div>
  );
}
