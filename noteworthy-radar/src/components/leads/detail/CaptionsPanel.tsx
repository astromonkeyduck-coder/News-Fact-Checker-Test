"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/primitives";
import { CopyButton } from "@/components/CopyButton";
import type { CaptionRow } from "@/lib/types";

const FIELDS: Array<{ key: keyof CaptionRow; label: string }> = [
  { key: "neutral_under_240", label: "Neutral (<240)" },
  { key: "breaking_under_280", label: "Breaking (<280)" },
  { key: "facebook_post", label: "Facebook" },
  { key: "instagram_caption", label: "Instagram" },
];

export function CaptionsPanel({
  leadId,
  caption,
  canEdit,
}: {
  leadId: string;
  caption: CaptionRow | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/api/leads/${leadId}/captions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate captions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label">Noteworthy News style drafts</span>
        {canEdit ? (
          <Button size="sm" variant="secondary" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : caption ? "Regenerate" : "Generate captions"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-2xs text-urgent">{error}</p> : null}

      {!caption ? (
        <p className="text-xs text-ink-faint">No captions yet. Generate drafts for editor review.</p>
      ) : (
        <div className="space-y-2">
          {FIELDS.map((f) => {
            const text = String(caption[f.key] ?? "");
            return (
              <div key={f.key} className="rounded border border-border bg-surface p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                    {f.label}
                  </span>
                  <CopyButton text={text} />
                </div>
                <p className="whitespace-pre-wrap text-xs text-ink-muted">{text}</p>
              </div>
            );
          })}
          <div className="rounded border border-border bg-surface p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Credit line
              </span>
              <CopyButton text={caption.credit_line} />
            </div>
            <p className="text-xs text-ink-muted">{caption.credit_line || "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
