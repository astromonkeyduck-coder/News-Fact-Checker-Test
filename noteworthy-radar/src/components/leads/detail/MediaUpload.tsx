"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

export function MediaUpload({ leadId }: { leadId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    const file = ref.current?.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/leads/${leadId}/media`, { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Upload failed.");
      }
      if (ref.current) ref.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="video/*,image/*"
        className="field file:mr-3 file:rounded file:border-0 file:bg-panel-raised file:px-3 file:py-1 file:text-ink"
      />
      <p className="text-2xs text-ink-faint">
        Upload only rights-cleared files (your own, permission-granted, official, or licensed).
      </p>
      {error ? <p className="text-2xs text-urgent">{error}</p> : null}
      <Button size="sm" variant="secondary" onClick={upload} disabled={busy}>
        {busy ? "Uploading…" : "Upload media"}
      </Button>
    </div>
  );
}
