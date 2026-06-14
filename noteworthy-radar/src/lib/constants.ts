/**
 * Canonical enums shared across the app. These are the single source of
 * truth for DB check constraints, Zod schemas, and UI option lists.
 */

export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_TYPES = [
  "sports",
  "weather",
  "politics",
  "entertainment",
  "public_safety",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["planned", "live", "post_event", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const PLATFORMS = [
  "Facebook",
  "Telegram",
  "X",
  "Reddit",
  "Instagram",
  "TikTok",
  "YouTube",
  "Official Source",
  "Local News",
  "Other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MEDIA_TYPES = ["text", "image", "video", "livestream", "unknown"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const PERMISSION_STATUSES = [
  "unknown",
  "link_only",
  "ask_permission",
  "permission_requested",
  "permission_granted",
  "official_source",
  "licensed",
  "editorial_review_needed",
  "do_not_use",
] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

/** Permission states that allow a video export (editorial_review_needed requires override). */
export const EXPORT_ALLOWED_PERMISSIONS = [
  "permission_granted",
  "official_source",
  "licensed",
] as const;
export const EXPORT_OVERRIDE_PERMISSION = "editorial_review_needed" as const;

export const LEAD_STATUSES = [
  "new",
  "triage",
  "verify_more",
  "ask_permission",
  "approved_for_caption",
  "approved_for_video",
  "published",
  "rejected",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RECOMMENDED_ACTIONS = [
  "ignore",
  "monitor",
  "verify_more",
  "ask_permission",
  "publish_link_only",
  "editorial_review",
  "do_not_use",
] as const;
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

/** Lead-level risk flags toggled by editors and inferred by triage. */
export const RISK_FLAG_KEYS = [
  "violence_flag",
  "weapon_flag",
  "graphic_flag",
  "minors_visible_flag",
  "private_people_identifiable_flag",
  "law_enforcement_involved_flag",
] as const;
export type RiskFlagKey = (typeof RISK_FLAG_KEYS)[number];

export const RISK_FLAG_LABELS: Record<RiskFlagKey, string> = {
  violence_flag: "Violence",
  weapon_flag: "Weapon / gunfire",
  graphic_flag: "Graphic content",
  minors_visible_flag: "Minors visible",
  private_people_identifiable_flag: "Private people identifiable",
  law_enforcement_involved_flag: "Law enforcement involved",
};

/** Ordered verification checklist persisted per lead as a boolean map. */
export const VERIFICATION_ITEMS = [
  { key: "original_source_located", label: "Original source located" },
  { key: "source_url_saved", label: "Source URL saved" },
  { key: "claimed_location_confirmed", label: "Claimed location confirmed" },
  { key: "claimed_time_confirmed", label: "Claimed time confirmed" },
  { key: "official_source_checked", label: "Official source checked" },
  { key: "local_news_checked", label: "Local news checked" },
  { key: "reverse_search_done", label: "Reverse image/video search needed/completed" },
  { key: "faces_minors_plates_reviewed", label: "Faces/minors/license plates reviewed" },
  { key: "permission_reviewed", label: "Permission reviewed" },
  { key: "caption_reviewed", label: "Caption reviewed" },
  { key: "final_editor_approval", label: "Final editor approval" },
] as const;
export type VerificationKey = (typeof VERIFICATION_ITEMS)[number]["key"];

export const AUDIT_ACTIONS = [
  "lead_created",
  "triage_run",
  "status_changed",
  "permission_changed",
  "caption_generated",
  "video_exported",
  "published",
  "rejected",
  "archived",
  "event_created",
  "verification_updated",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "Noteworthy News";
export const BRAND_HANDLE = process.env.NEXT_PUBLIC_BRAND_HANDLE || "@NoteworthyNews";
