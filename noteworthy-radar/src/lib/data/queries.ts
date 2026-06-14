import { createServerSupabase } from "@/lib/supabase/server";
import type {
  CaptionRow,
  EventRow,
  ExportRow,
  LeadAiTriageRow,
  LeadRow,
  LeadStatusHistoryRow,
  MediaAssetRow,
  PermissionRow,
  SourceWatchlistRow,
} from "@/lib/types";
import type { LeadStatus, Platform, PermissionStatus, RiskLevel } from "@/lib/constants";

export async function getEvents(teamId: string): Promise<EventRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  return (data ?? []) as EventRow[];
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  return (data as EventRow) ?? null;
}

export interface LeadFilters {
  platform?: Platform;
  status?: LeadStatus;
  eventId?: string;
  riskLevel?: RiskLevel;
  permissionStatus?: PermissionStatus;
  minVerification?: number;
}

export async function getLeads(teamId: string, filters: LeadFilters = {}): Promise<LeadRow[]> {
  const supabase = createServerSupabase();
  let query = supabase.from("leads").select("*").eq("team_id", teamId);

  if (filters.platform) query = query.eq("platform", filters.platform);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.eventId) query = query.eq("event_id", filters.eventId);
  if (filters.riskLevel) query = query.eq("risk_level", filters.riskLevel);
  if (filters.permissionStatus) query = query.eq("permission_status", filters.permissionStatus);
  if (typeof filters.minVerification === "number")
    query = query.gte("verification_score", filters.minVerification);

  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []) as LeadRow[];
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  return (data as LeadRow) ?? null;
}

export interface LeadBundle {
  lead: LeadRow;
  event: EventRow | null;
  triage: LeadAiTriageRow | null;
  captions: CaptionRow | null;
  permission: PermissionRow | null;
  history: LeadStatusHistoryRow[];
  media: MediaAssetRow[];
  exports: ExportRow[];
}

export async function getLeadBundle(id: string): Promise<LeadBundle | null> {
  const supabase = createServerSupabase();
  const lead = await getLead(id);
  if (!lead) return null;

  const [triageRes, captionsRes, permissionRes, historyRes, mediaRes, exportsRes, eventRes] =
    await Promise.all([
      supabase
        .from("lead_ai_triage")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("captions")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("permissions").select("*").eq("lead_id", id).maybeSingle(),
      supabase
        .from("lead_status_history")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("media_assets").select("*").eq("lead_id", id).order("created_at"),
      supabase
        .from("exports")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      lead.event_id
        ? supabase.from("events").select("*").eq("id", lead.event_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return {
    lead,
    event: (eventRes.data as EventRow) ?? null,
    triage: (triageRes.data as LeadAiTriageRow) ?? null,
    captions: (captionsRes.data as CaptionRow) ?? null,
    permission: (permissionRes.data as PermissionRow) ?? null,
    history: (historyRes.data ?? []) as LeadStatusHistoryRow[],
    media: (mediaRes.data ?? []) as MediaAssetRow[],
    exports: (exportsRes.data ?? []) as ExportRow[],
  };
}

export async function getWatchlists(teamId: string): Promise<SourceWatchlistRow[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("source_watchlists")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at");
  return (data ?? []) as SourceWatchlistRow[];
}

export async function getEventLeadCounts(
  teamId: string,
): Promise<{ leads: LeadRow[]; events: EventRow[] }> {
  const [leads, events] = await Promise.all([getLeads(teamId), getEvents(teamId)]);
  return { leads, events };
}
