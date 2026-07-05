"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button, Checkbox, Input, Label, Panel, PanelTitle, Select, Textarea } from "@/components/ui/primitives";
import type { MediaAssetRow } from "@/lib/types";

interface BlurBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  media: MediaAssetRow[];
  defaultTopLabel: string;
  defaultCaption: string;
  defaultCredit: string;
  gateAllowed: boolean;
  gateReason?: string;
  requiresOverride: boolean;
  canEdit: boolean;
}

export function ExportWorkspace({
  media,
  defaultTopLabel,
  defaultCaption,
  defaultCredit,
  gateAllowed,
  gateReason,
  requiresOverride,
  canEdit,
}: Props) {
  const router = useRouter();
  const [mediaId, setMediaId] = useState(media[0]?.id ?? "");
  const [topLabel, setTopLabel] = useState(defaultTopLabel);
  const [caption, setCaption] = useState(defaultCaption);
  const [credit, setCredit] = useState(defaultCredit);
  const [override, setOverride] = useState(false);
  const [boxes, setBoxes] = useState<BlurBox[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; signedUrl: string | null; note?: string } | null>(null);

  const canSubmit = canEdit && mediaId && (gateAllowed || (requiresOverride && override));

  function addBox() {
    setBoxes((b) => [...b, { x: 0.3, y: 0.3, w: 0.2, h: 0.15 }]);
  }
  function updateBox(i: number, key: keyof BlurBox, value: number) {
    setBoxes((b) => b.map((box, idx) => (idx === i ? { ...box, [key]: value } : box)));
  }
  function removeBox(i: number) {
    setBoxes((b) => b.filter((_, idx) => idx !== i));
  }

  async function run() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await api.post<{ export: { status: string }; signedUrl: string | null; note?: string }>(
        "/api/exports",
        {
          media_asset_id: mediaId,
          top_label: topLabel,
          caption_text: caption,
          credit_line: credit,
          override_high_risk: override,
          blur_boxes: boxes,
        },
      );
      setResult({ status: res.export.status, signedUrl: res.signedUrl, note: res.note });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel>
          <PanelTitle>Export settings</PanelTitle>
          <div className="mt-3 space-y-4">
            <div>
              <Label>Source media</Label>
              {media.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  No media uploaded. Upload a rights-cleared file on the lead page first.
                </p>
              ) : (
                <Select value={mediaId} onChange={(e) => setMediaId(e.target.value)}>
                  {media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.file_name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label>Top label</Label>
              <Input value={topLabel} onChange={(e) => setTopLabel(e.target.value)} />
            </div>
            <div>
              <Label>Lower caption</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <div>
              <Label>Credit line</Label>
              <Input value={credit} onChange={(e) => setCredit(e.target.value)} />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <PanelTitle>Blur boxes (optional)</PanelTitle>
            <Button size="sm" variant="secondary" onClick={addBox} type="button">
              Add box
            </Button>
          </div>
          <p className="mb-3 mt-1 text-2xs text-ink-faint">
            Cover faces or license plates. Values are fractions of width/height (0–1). Manual only -
            no automatic face detection.
          </p>
          {boxes.length === 0 ? (
            <p className="text-xs text-ink-faint">No blur boxes.</p>
          ) : (
            <ul className="space-y-2">
              {boxes.map((box, i) => (
                <li key={i} className="flex flex-wrap items-end gap-2 rounded border border-border bg-surface p-2">
                  {(["x", "y", "w", "h"] as const).map((k) => (
                    <div key={k}>
                      <span className="label mb-0.5 block">{k}</span>
                      <input
                        type="number"
                        step="0.05"
                        min={0}
                        max={1}
                        value={box[k]}
                        onChange={(e) => updateBox(i, k, Number(e.target.value))}
                        className="field h-8 w-16 py-0 text-xs"
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" type="button" onClick={() => removeBox(i)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <PanelTitle>Permission gate</PanelTitle>
          {gateAllowed ? (
            <div className="mt-2 rounded border border-ok/40 bg-ok-soft p-2 text-xs text-ok">
              Export permitted by current permission status.
            </div>
          ) : (
            <div className="mt-2 rounded border border-urgent/40 bg-urgent-soft p-2 text-xs text-urgent">
              {gateReason ?? "Export is blocked."}
            </div>
          )}

          {requiresOverride && canEdit ? (
            <label className="mt-3 flex items-start gap-2 rounded border border-warn/40 bg-warn-soft p-2 text-2xs text-warn">
              <Checkbox checked={override} onChange={(e) => setOverride(e.target.checked)} />
              <span>Editor override (logged to audit). Use only with documented editorial justification.</span>
            </label>
          ) : null}

          {error ? <p className="mt-2 text-2xs text-urgent">{error}</p> : null}

          <Button
            className="mt-3 w-full"
            variant="primary"
            disabled={!canSubmit || busy}
            onClick={run}
          >
            {busy ? "Rendering…" : "Render vertical export"}
          </Button>
          {!canEdit ? (
            <p className="mt-2 text-2xs text-ink-faint">Viewer role cannot export.</p>
          ) : null}
        </Panel>

        {result ? (
          <Panel>
            <PanelTitle>Result</PanelTitle>
            <p className="mt-2 text-xs text-ink-muted">
              Status: <span className="text-ink">{result.status}</span>
            </p>
            {result.note ? <p className="mt-1 text-2xs text-ink-faint">{result.note}</p> : null}
            {result.signedUrl ? (
              <a
                href={result.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-info hover:underline"
              >
                Download / preview export
              </a>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
