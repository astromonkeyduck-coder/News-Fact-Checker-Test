-- iOS device identity linking — carry the web Auth0 profile through pairing
--
-- Milestone 1G: when a signed-in web user generates a pairing code, the backend
-- verifies their Auth0 ID token server-side and stores safe, verified profile
-- fields on the pairing code. On redeem, those fields are copied onto the
-- device row so the iOS Profile screen can show the real linked account.
--
-- All columns are nullable and additive. Anonymous pairing (no Auth0 session)
-- leaves them null and the app shows a "Linked to this browser" state.
-- RLS already denies anonymous access to both tables (migration 006); these
-- columns are only ever read/written by the service role.

-- ───────────────────────────────────────────────────────────────────────────
-- device_pairing_codes — verified profile captured at code-creation time
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE device_pairing_codes ADD COLUMN IF NOT EXISTS auth0_sub   TEXT;
ALTER TABLE device_pairing_codes ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE device_pairing_codes ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE device_pairing_codes ADD COLUMN IF NOT EXISTS picture_url TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- live_story_devices — profile copied from the pairing code at redeem time
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS auth0_sub   TEXT;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS picture_url TEXT;
ALTER TABLE live_story_devices ADD COLUMN IF NOT EXISTS linked_at   TIMESTAMPTZ;

COMMENT ON COLUMN live_story_devices.auth0_sub IS 'Auth0 sub of the linked web account (null when paired anonymously / browser-only).';
COMMENT ON COLUMN live_story_devices.email IS 'Verified email from the Auth0 ID token captured at pairing (null if anonymous).';
COMMENT ON COLUMN live_story_devices.picture_url IS 'Verified avatar URL from the Auth0 ID token captured at pairing (null if anonymous).';
COMMENT ON COLUMN device_pairing_codes.auth0_sub IS 'Auth0 sub captured from the verified ID token when a signed-in user created this code.';
