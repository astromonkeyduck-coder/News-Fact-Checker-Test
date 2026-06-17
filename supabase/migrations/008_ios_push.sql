-- iOS standard push notifications — APNs device token + notification preferences
--
-- Milestone 2C: the native app graduates from Live Activities only to full
-- standard APNs alert notifications (breaking, live updates, final), with
-- server-side preference sync and quiet hours. This migration is additive only:
-- existing Live Activity behavior (migrations 005/006) is untouched, and old
-- devices simply receive no standard push until they register a token.
--
-- The standard-push device token differs from the Live Activity tokens:
--   live_story_devices.push_to_start_token  → ActivityKit push-to-start (2A/2B)
--   live_activity_tokens.activity_push_token → per-running-activity (2A/2B)
--   live_story_devices.apns_token            → standard alert push (2C, here)
--
-- RLS already denies anonymous access to live_story_devices (migration 006); no
-- policy change is needed. No keys or secrets are stored here — only the opaque
-- APNs device token and boolean/clock preferences.

-- ───────────────────────────────────────────────────────────────────────────
-- live_story_devices — standard APNs alert token + notification preferences
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS apns_token            TEXT;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS apns_token_updated_at TIMESTAMPTZ;

-- Notification preferences (synced from the app; safe permissive defaults so a
-- freshly registered device behaves sensibly before the first preference sync).
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS push_master_enabled         BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS push_breaking_enabled       BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS push_live_updates_enabled   BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS push_final_enabled          BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS push_time_sensitive_enabled BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS quiet_hours_enabled         BOOLEAN     NOT NULL DEFAULT false;
-- Quiet-hours window in the device's local 24h clock (start inclusive, end
-- exclusive; a start > end window wraps past midnight, e.g. 22 → 7).
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS quiet_hours_start           SMALLINT    NOT NULL DEFAULT 22
                                                          CHECK (quiet_hours_start >= 0 AND quiet_hours_start <= 23);
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS quiet_hours_end             SMALLINT    NOT NULL DEFAULT 7
                                                          CHECK (quiet_hours_end >= 0 AND quiet_hours_end <= 23);
-- Device's current UTC offset in minutes (e.g. -240 for EDT). Lets the backend
-- evaluate the device-local quiet-hours window without a tz database; falls back
-- to server UTC when unknown (null).
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS utc_offset_minutes          SMALLINT;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS prefs_updated_at            TIMESTAMPTZ;

-- Dispatch reads only rows that have a usable standard-push token.
CREATE INDEX IF NOT EXISTS idx_live_story_devices_apns_token
    ON live_story_devices(apns_token)
    WHERE apns_token IS NOT NULL;

COMMENT ON COLUMN live_story_devices.apns_token IS 'Standard APNs alert device token (UserNotifications). Distinct from push_to_start_token (Live Activities). Null = not push-ready.';
COMMENT ON COLUMN live_story_devices.push_master_enabled IS 'Master switch for all standard push from this device (synced from the app).';
COMMENT ON COLUMN live_story_devices.push_breaking_enabled IS 'Allow urgent/breaking standard pushes.';
COMMENT ON COLUMN live_story_devices.push_live_updates_enabled IS 'Allow normal live-story update standard pushes.';
COMMENT ON COLUMN live_story_devices.push_final_enabled IS 'Allow final/resolution standard pushes.';
COMMENT ON COLUMN live_story_devices.push_time_sensitive_enabled IS 'Allow Time Sensitive interruption level for urgent/final alerts (else delivered as active).';
COMMENT ON COLUMN live_story_devices.quiet_hours_enabled IS 'Suppress non-urgent standard push during the device-local quiet-hours window.';
COMMENT ON COLUMN live_story_devices.quiet_hours_start IS 'Quiet-hours start hour (0-23, device local). Window wraps if start > end.';
COMMENT ON COLUMN live_story_devices.quiet_hours_end IS 'Quiet-hours end hour (0-23, device local, exclusive).';
COMMENT ON COLUMN live_story_devices.utc_offset_minutes IS 'Device UTC offset in minutes for evaluating quiet hours (null = fall back to server UTC).';
