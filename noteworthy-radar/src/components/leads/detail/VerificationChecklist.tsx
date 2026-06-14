"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Checkbox } from "@/components/ui/primitives";
import { VERIFICATION_ITEMS } from "@/lib/constants";

export function VerificationChecklist({
  leadId,
  initial,
  canEdit,
}: {
  leadId: string;
  initial: Record<string, boolean>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initial ?? {});
  const [saving, setSaving] = useState(false);

  async function toggle(key: string, value: boolean) {
    const updated = { ...checklist, [key]: value };
    setChecklist(updated);
    setSaving(true);
    try {
      await api.put(`/api/leads/${leadId}/verification`, { checklist: updated });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const done = VERIFICATION_ITEMS.filter((i) => checklist[i.key]).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label">
          {done}/{VERIFICATION_ITEMS.length} complete
        </span>
        {saving ? <span className="text-2xs text-ink-faint">Saving…</span> : null}
      </div>
      <ul className="space-y-1.5">
        {VERIFICATION_ITEMS.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <Checkbox
                checked={Boolean(checklist[item.key])}
                disabled={!canEdit}
                onChange={(e) => toggle(item.key, e.target.checked)}
              />
              <span className={item.key === "final_editor_approval" ? "font-semibold text-ink" : ""}>
                {item.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
