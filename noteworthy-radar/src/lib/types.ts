import type {
  EventStatus,
  EventType,
  LeadStatus,
  MediaType,
  PermissionStatus,
  Platform,
  RecommendedAction,
  RiskLevel,
  Role,
} from "@/lib/constants";
import type { TriageResult } from "@/lib/validation/schemas";

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  team_id: string;
  event_name: string;
  event_type: EventType;
  teams_or_entities: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  status: EventStatus;
  keyword_seed: string | null;
  generated_keywords: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadRow {
  id: string;
  team_id: string;
  event_id: string | null;
  platform: Platform;
  source_url: string | null;
  source_handle: string | null;
  post_text: string | null;
  claimed_location: string | null;
  claimed_time: string | null;
  what_it_appears_to_show: string | null;
  media_type: MediaType;
  violence_flag: boolean;
  weapon_flag: boolean;
  graphic_flag: boolean;
  minors_visible_flag: boolean;
  private_people_identifiable_flag: boolean;
  law_enforcement_involved_flag: boolean;
  permission_status: PermissionStatus;
  status: LeadStatus;
  newsworthiness_score: number | null;
  verification_score: number | null;
  risk_level: RiskLevel | null;
  recommended_action: RecommendedAction | null;
  headline: string | null;
  verification_checklist: Record<string, boolean>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadAiTriageRow {
  id: string;
  lead_id: string;
  team_id: string;
  provider: string;
  model: string | null;
  result: TriageResult;
  created_by: string | null;
  created_at: string;
}

export interface LeadStatusHistoryRow {
  id: string;
  lead_id: string;
  team_id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface MediaAssetRow {
  id: string;
  team_id: string;
  lead_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  rights_status: PermissionStatus;
  created_by: string | null;
  created_at: string;
}

export interface PermissionRow {
  id: string;
  team_id: string;
  lead_id: string;
  permission_status: PermissionStatus;
  original_uploader: string | null;
  contact_method: string | null;
  date_requested: string | null;
  date_granted: string | null;
  license_notes: string | null;
  allowed_platforms: string[];
  expiration: string | null;
  evidence_url: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface CaptionRow {
  id: string;
  team_id: string;
  lead_id: string;
  neutral_under_240: string;
  breaking_under_280: string;
  facebook_post: string;
  instagram_caption: string;
  credit_line: string;
  created_by: string | null;
  created_at: string;
}

export interface ExportRow {
  id: string;
  team_id: string;
  lead_id: string;
  media_asset_id: string | null;
  status: "rendered" | "stubbed" | "failed";
  output_path: string | null;
  top_label: string;
  caption_text: string | null;
  credit_line: string | null;
  permission_status_at_export: PermissionStatus;
  override_used: boolean;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SourceWatchlistRow {
  id: string;
  team_id: string;
  label: string;
  platform: Platform;
  url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  team_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface SessionContext {
  user: AppUser;
  team: Team;
  role: Role;
}
