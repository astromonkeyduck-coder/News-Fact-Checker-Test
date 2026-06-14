"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/primitives";
import { CopyButton } from "@/components/CopyButton";

export function KeywordBank({
  eventId,
  initialKeywords,
  canEdit,
}: {
  eventId: string;
  initialKeywords: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [keywords, setKeywords] = useState(initialKeywords);
  const [loading, setLoading] = useState(false);

  async function regenerate() {
    setLoading(true);
    try {
      const res = await api.post<{ keywords: string[] }>(`/api/events/${eventId}/keywords`);
      setKeywords(res.keywords);
      router.refresh();
    } catch {
      /* surfaced via console; non-blocking */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Keyword bank</span>
        <div className="flex items-center gap-1">
          {keywords.length > 0 ? <CopyButton text={keywords.join("\n")} label="Copy all" /> : null}
          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={regenerate} disabled={loading}>
              {loading ? "Generating…" : "Generate keywords"}
            </Button>
          ) : null}
        </div>
      </div>
      {keywords.length === 0 ? (
        <p className="text-xs text-ink-faint">No keywords yet. Generate them from the event seed.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((k) => (
            <span
              key={k}
              className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-ink-muted"
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
