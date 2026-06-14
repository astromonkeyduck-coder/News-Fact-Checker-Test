import { z } from "zod";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  LEAD_STATUSES,
  MEDIA_TYPES,
  PERMISSION_STATUSES,
  PLATFORMS,
  RECOMMENDED_ACTIONS,
  RISK_LEVELS,
} from "@/lib/constants";

const optionalText = z.string().trim().max(20000).optional().or(z.literal(""));

/** ----------------------------------------------------------------
 * AI Triage output contract (exact shape required by the product).
 * ---------------------------------------------------------------- */
export const captionDraftsSchema = z.object({
  neutral_under_240: z.string(),
  breaking_under_280: z.string(),
  facebook_post: z.string(),
  instagram_caption: z.string(),
});

export const triageResultSchema = z.object({
  short_summary: z.string(),
  event_connection: z.string(),
  newsworthiness_score: z.number().int().min(0).max(5),
  verification_score: z.number().int().min(0).max(5),
  risk_level: z.enum(RISK_LEVELS),
  safety_risks: z.array(z.string()),
  privacy_risks: z.array(z.string()),
  copyright_permission_risks: z.array(z.string()),
  missing_facts: z.array(z.string()),
  recommended_action: z.enum(RECOMMENDED_ACTIONS),
  caption_drafts: captionDraftsSchema,
  credit_line: z.string(),
  editor_questions_before_publish: z.array(z.string()),
});

export type TriageResult = z.infer<typeof triageResultSchema>;
export type CaptionDrafts = z.infer<typeof captionDraftsSchema>;

/** ----------------------------------------------------------------
 * Event input
 * ---------------------------------------------------------------- */
export const eventInputSchema = z.object({
  event_name: z.string().trim().min(1, "Event name is required").max(200),
  event_type: z.enum(EVENT_TYPES),
  teams_or_entities: optionalText,
  location: optionalText,
  start_time: z.string().optional().or(z.literal("")),
  end_time: z.string().optional().or(z.literal("")),
  status: z.enum(EVENT_STATUSES).default("planned"),
  keyword_seed: optionalText,
  generated_keywords: z.array(z.string()).default([]),
  notes: optionalText,
});

export type EventInput = z.infer<typeof eventInputSchema>;

/** ----------------------------------------------------------------
 * Lead input
 * ---------------------------------------------------------------- */
export const leadInputSchema = z.object({
  event_id: z.string().uuid().optional().or(z.literal("")),
  platform: z.enum(PLATFORMS),
  source_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(2048)
    .optional()
    .or(z.literal("")),
  source_handle: optionalText,
  post_text: optionalText,
  claimed_location: optionalText,
  claimed_time: z.string().optional().or(z.literal("")),
  what_it_appears_to_show: optionalText,
  media_type: z.enum(MEDIA_TYPES).default("unknown"),
  violence_flag: z.boolean().default(false),
  weapon_flag: z.boolean().default(false),
  graphic_flag: z.boolean().default(false),
  minors_visible_flag: z.boolean().default(false),
  private_people_identifiable_flag: z.boolean().default(false),
  law_enforcement_involved_flag: z.boolean().default(false),
  permission_status: z.enum(PERMISSION_STATUSES).default("unknown"),
  notes: optionalText,
});

export type LeadInput = z.infer<typeof leadInputSchema>;

/** Public capture endpoint payload (bookmarklet). Intentionally minimal. */
export const captureInputSchema = z.object({
  source_url: z.string().trim().url().max(2048),
  source_handle: optionalText,
  post_text: optionalText,
  claimed_location: optionalText,
  what_it_appears_to_show: optionalText,
  platform: z.enum(PLATFORMS).optional(),
  event_id: z.string().uuid().optional().or(z.literal("")),
});

export type CaptureInput = z.infer<typeof captureInputSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  note: optionalText,
  override_high_risk: z.boolean().optional(),
});

export const permissionInputSchema = z.object({
  permission_status: z.enum(PERMISSION_STATUSES),
  original_uploader: optionalText,
  contact_method: optionalText,
  date_requested: z.string().optional().or(z.literal("")),
  date_granted: z.string().optional().or(z.literal("")),
  license_notes: optionalText,
  allowed_platforms: z.array(z.string()).default([]),
  expiration: z.string().optional().or(z.literal("")),
  evidence_url: optionalText,
});

export type PermissionInput = z.infer<typeof permissionInputSchema>;

export const verificationUpdateSchema = z.object({
  checklist: z.record(z.string(), z.boolean()),
});

export const exportRequestSchema = z.object({
  media_asset_id: z.string().uuid(),
  top_label: z.string().trim().max(80).default("NOT REALLY THE NEWS"),
  caption_text: z.string().trim().max(600).default(""),
  credit_line: z.string().trim().max(200).default(""),
  override_high_risk: z.boolean().optional(),
  blur_boxes: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
      }),
    )
    .default([]),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
