"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button, Checkbox, Input, Label, Panel, PanelTitle, Select, Textarea } from "@/components/ui/primitives";
import {
  MEDIA_TYPES,
  PERMISSION_STATUSES,
  PLATFORMS,
  RISK_FLAG_KEYS,
  RISK_FLAG_LABELS,
} from "@/lib/constants";
import type { EventRow, LeadRow } from "@/lib/types";

interface Props {
  events: Pick<EventRow, "id" | "event_name">[];
  defaultEventId?: string;
  prefill?: Partial<Record<string, string>>;
}

export function LeadForm({ events, defaultEventId, prefill }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, getValues } = useForm({
    defaultValues: {
      event_id: defaultEventId ?? "",
      platform: (prefill?.platform as string) ?? "Facebook",
      source_url: prefill?.source_url ?? "",
      source_handle: prefill?.source_handle ?? "",
      post_text: prefill?.post_text ?? "",
      claimed_location: prefill?.claimed_location ?? "",
      claimed_time: "",
      what_it_appears_to_show: prefill?.what_it_appears_to_show ?? "",
      media_type: "unknown",
      violence_flag: false,
      weapon_flag: false,
      graphic_flag: false,
      minors_visible_flag: false,
      private_people_identifiable_flag: false,
      law_enforcement_involved_flag: false,
      permission_status: "unknown",
      notes: "",
    },
  });

  async function save(runTriage: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const values = getValues();
      const payload = {
        ...values,
        claimed_time: values.claimed_time ? new Date(values.claimed_time).toISOString() : "",
      };
      const res = await api.post<{ lead: LeadRow }>("/api/leads", payload);
      const leadId = res.lead.id;

      const file = fileRef.current?.files?.[0];
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/leads/${leadId}/media`, { method: "POST", body: fd });
      }

      if (runTriage) {
        await api.post(`/api/leads/${leadId}/triage`);
      }

      router.push(`/leads/${leadId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(() => save(false))} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel>
          <PanelTitle>Source</PanelTitle>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="event_id">Event</Label>
              <Select id="event_id" {...register("event_id")}>
                <option value="">— No event —</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.event_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select id="platform" {...register("platform")}>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="source_url">Source URL</Label>
            <Input id="source_url" type="url" placeholder="https://…" {...register("source_url")} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="source_handle">Source handle</Label>
              <Input id="source_handle" placeholder="@username" {...register("source_handle")} />
            </div>
            <div>
              <Label htmlFor="media_type">Media type</Label>
              <Select id="media_type" {...register("media_type")}>
                {MEDIA_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="post_text">Post text</Label>
            <Textarea id="post_text" {...register("post_text")} />
          </div>
        </Panel>

        <Panel>
          <PanelTitle>What it appears to show</PanelTitle>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="claimed_location">Claimed location</Label>
              <Input id="claimed_location" {...register("claimed_location")} />
            </div>
            <div>
              <Label htmlFor="claimed_time">Claimed time</Label>
              <Input id="claimed_time" type="datetime-local" {...register("claimed_time")} />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="what_it_appears_to_show">What it appears to show</Label>
            <Textarea
              id="what_it_appears_to_show"
              placeholder="Neutral description, e.g. 'a confrontation between apparent fans'"
              {...register("what_it_appears_to_show")}
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="media_upload">Media upload (optional)</Label>
            <input
              id="media_upload"
              ref={fileRef}
              type="file"
              accept="video/*,image/*"
              className="field file:mr-3 file:rounded file:border-0 file:bg-panel-raised file:px-3 file:py-1 file:text-ink"
            />
            <p className="mt-1 text-2xs text-ink-faint">
              Only upload files you have the right to use (your own, permission-granted, official,
              or licensed). Do not auto-download third-party media.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Notes</PanelTitle>
          <Textarea className="mt-3" {...register("notes")} />
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <PanelTitle>Risk flags</PanelTitle>
          <p className="mb-3 mt-1 text-2xs text-ink-faint">
            Flag sensitive content. High-risk leads need final editor approval before publish/export.
          </p>
          <div className="space-y-2">
            {RISK_FLAG_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                <Checkbox {...register(key)} />
                {RISK_FLAG_LABELS[key]}
              </label>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelTitle>Permission status</PanelTitle>
          <Select className="mt-3" {...register("permission_status")}>
            {PERMISSION_STATUSES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Panel>

        {error ? <p className="text-xs text-urgent">{error}</p> : null}

        <div className="flex flex-col gap-2">
          <Button type="submit" variant="secondary" disabled={submitting}>
            {submitting ? "Saving…" : "Save draft"}
          </Button>
          <Button type="button" variant="primary" disabled={submitting} onClick={() => save(true)}>
            {submitting ? "Working…" : "Save + AI triage"}
          </Button>
        </div>
      </div>
    </form>
  );
}
