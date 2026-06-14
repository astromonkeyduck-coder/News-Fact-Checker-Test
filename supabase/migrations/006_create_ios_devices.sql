-- iOS Live Activity companion — device + APNs token schema
--
-- Phase 2 adds a thin native iOS app that links (via a pairing code) to the
-- same anonymous web follows (live_story_follows.subscriber_key) and runs
-- ActivityKit Live Activities. The backend stores APNs tokens here so it can
-- update / end / push-to-start Live Activities alongside the existing web push.

-- ───────────────────────────────────────────────────────────────────────────
-- live_story_devices — one row per installed iOS app instance
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_story_devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uuid         TEXT UNIQUE NOT NULL,          -- app-generated, stored in Keychain
    device_secret_hash  TEXT NOT NULL,                 -- sha256 of the bearer issued at first contact
    subscriber_key      TEXT,                          -- links to live_story_follows.subscriber_key once paired
    apns_environment    TEXT NOT NULL DEFAULT 'production'
                          CHECK (apns_environment IN ('sandbox','production')),
    push_to_start_token TEXT,                          -- iOS 17.2+ per-app push-to-start token (LiveStoryAttributes)
    platform            TEXT,
    app_version         TEXT,
    locale              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_story_devices_subscriber ON live_story_devices(subscriber_key);
CREATE INDEX IF NOT EXISTS idx_live_story_devices_pts ON live_story_devices(push_to_start_token)
    WHERE push_to_start_token IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- live_activity_tokens — one row per running Live Activity (device + story)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_activity_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID NOT NULL REFERENCES live_story_devices(id) ON DELETE CASCADE,
    story_id            UUID NOT NULL REFERENCES live_stories(id) ON DELETE CASCADE,
    activity_push_token TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','ended','stale')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_live_activity_tokens_story_active
    ON live_activity_tokens(story_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_live_activity_tokens_device ON live_activity_tokens(device_id);

-- ───────────────────────────────────────────────────────────────────────────
-- device_pairing_codes — short-lived, single-use codes that bind a device to a
-- web subscriber's follows
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_pairing_codes (
    code            TEXT PRIMARY KEY,                  -- short human-typable code
    subscriber_key  TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    redeemed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_pairing_codes_expires ON device_pairing_codes(expires_at);

-- ───────────────────────────────────────────────────────────────────────────
-- updated_at trigger for live_activity_tokens (reuse scoped-function pattern)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_live_activity_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_live_activity_tokens_updated_at ON live_activity_tokens;
CREATE TRIGGER update_live_activity_tokens_updated_at
    BEFORE UPDATE ON live_activity_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_live_activity_tokens_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Comments
-- ───────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE live_story_devices IS 'Installed iOS companion app instances; linked to a web subscriber via pairing code.';
COMMENT ON COLUMN live_story_devices.subscriber_key IS 'Matches live_story_follows.subscriber_key so the device shares the same follows.';
COMMENT ON COLUMN live_story_devices.push_to_start_token IS 'iOS 17.2+ push-to-start token for LiveStoryAttributes (remote-start Live Activities).';
COMMENT ON TABLE live_activity_tokens IS 'Per-running Live Activity APNs update tokens (device + story).';
COMMENT ON TABLE device_pairing_codes IS 'Short-lived single-use codes binding a device to a web subscriber''s follows.';

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security — backend-only (service role bypasses RLS).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE live_story_devices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_activity_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_pairing_codes  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No anonymous access to live_story_devices" ON live_story_devices;
DROP POLICY IF EXISTS "No anonymous access to live_activity_tokens" ON live_activity_tokens;
DROP POLICY IF EXISTS "No anonymous access to device_pairing_codes" ON device_pairing_codes;

CREATE POLICY "No anonymous access to live_story_devices"
    ON live_story_devices FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to live_activity_tokens"
    ON live_activity_tokens FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to device_pairing_codes"
    ON device_pairing_codes FOR ALL USING (false) WITH CHECK (false);
