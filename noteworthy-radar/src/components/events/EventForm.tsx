"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/constants";
import type { EventRow } from "@/lib/types";

interface FormValues {
  event_name: string;
  event_type: string;
  teams_or_entities: string;
  location: string;
  start_time: string;
  end_time: string;
  status: string;
  keyword_seed: string;
  notes: string;
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function EventForm({ event }: { event?: EventRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      event_name: event?.event_name ?? "",
      event_type: event?.event_type ?? "other",
      teams_or_entities: event?.teams_or_entities ?? "",
      location: event?.location ?? "",
      start_time: toLocalInput(event?.start_time ?? null),
      end_time: toLocalInput(event?.end_time ?? null),
      status: event?.status ?? "planned",
      keyword_seed: event?.keyword_seed ?? "",
      notes: event?.notes ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        start_time: values.start_time ? new Date(values.start_time).toISOString() : "",
        end_time: values.end_time ? new Date(values.end_time).toISOString() : "",
        generated_keywords: event?.generated_keywords ?? [],
      };
      if (event) {
        await api.patch(`/api/events/${event.id}`, payload);
        router.push(`/events/${event.id}`);
      } else {
        const res = await api.post<{ event: EventRow }>("/api/events", payload);
        router.push(`/events/${res.event.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel max-w-2xl space-y-4 p-5">
      <div>
        <Label htmlFor="event_name">Event name</Label>
        <Input id="event_name" {...register("event_name", { required: true })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="event_type">Type</Label>
          <Select id="event_type" {...register("event_type")}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" {...register("status")}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="teams_or_entities">Teams or entities</Label>
        <Input
          id="teams_or_entities"
          placeholder="e.g. Knicks, Spurs"
          {...register("teams_or_entities")}
        />
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="e.g. Madison Square Garden, NYC" {...register("location")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="start_time">Start time</Label>
          <Input id="start_time" type="datetime-local" {...register("start_time")} />
        </div>
        <div>
          <Label htmlFor="end_time">End time</Label>
          <Input id="end_time" type="datetime-local" {...register("end_time")} />
        </div>
      </div>
      <div>
        <Label htmlFor="keyword_seed">Keyword seed</Label>
        <Input id="keyword_seed" placeholder="words to seed keyword generation" {...register("keyword_seed")} />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register("notes")} />
      </div>

      {error ? <p className="text-xs text-urgent">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving…" : event ? "Save changes" : "Create event"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
