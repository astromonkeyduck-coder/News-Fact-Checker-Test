-- Follow Live Story MVP — schema
-- Editors create followable "live stories" and push timeline updates with
-- tiered alert levels. Readers follow a story to receive targeted web push.
--
-- Push delivery itself stays on Netlify Blobs + web-push. The bridge between
-- the two systems is live_story_follows.subscriber_key, which mirrors the
-- hashed-endpoint key used by netlify/functions/lib/subscriberKey.js.

-- ───────────────────────────────────────────────────────────────────────────
-- live_stories — the followable story
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_stories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    summary         TEXT,
    status          TEXT NOT NULL DEFAULT 'developing'
                      CHECK (status IN ('breaking','developing','verified','disputed','resolved','false_report')),
    category        TEXT,
    severity        INTEGER NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
    confidence      TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
    pinned          BOOLEAN NOT NULL DEFAULT false,
    archived        BOOLEAN NOT NULL DEFAULT false,
    follower_count  INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT,
    last_update_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_stories_active
    ON live_stories(archived, pinned DESC, last_update_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_stories_status ON live_stories(status);
CREATE INDEX IF NOT EXISTS idx_live_stories_slug ON live_stories(slug);

-- ───────────────────────────────────────────────────────────────────────────
-- live_story_updates — the timeline
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_story_updates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id        UUID NOT NULL REFERENCES live_stories(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    kind            TEXT NOT NULL DEFAULT 'minor'
                      CHECK (kind IN ('major','minor','correction','final')),
    status_at_time  TEXT,
    alert_level     TEXT NOT NULL DEFAULT 'normal'
                      CHECK (alert_level IN ('silent','badge','normal','urgent','final')),
    source_url      TEXT,
    source_label    TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_story_updates_story
    ON live_story_updates(story_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- live_story_follows — who follows what (bridge to push subscriptions)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_story_follows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id        UUID NOT NULL REFERENCES live_stories(id) ON DELETE CASCADE,
    subscriber_key  TEXT NOT NULL,
    user_email      TEXT,
    muted           BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (story_id, subscriber_key)
);

CREATE INDEX IF NOT EXISTS idx_live_story_follows_story ON live_story_follows(story_id);
CREATE INDEX IF NOT EXISTS idx_live_story_follows_subscriber ON live_story_follows(subscriber_key);

-- ───────────────────────────────────────────────────────────────────────────
-- live_story_send_log — audit trail of every dispatch
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_story_send_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id        UUID REFERENCES live_stories(id) ON DELETE SET NULL,
    update_id       UUID REFERENCES live_story_updates(id) ON DELETE SET NULL,
    alert_level     TEXT NOT NULL,
    recipients      INTEGER NOT NULL DEFAULT 0,
    sent            INTEGER NOT NULL DEFAULT 0,
    failed          INTEGER NOT NULL DEFAULT 0,
    skipped         INTEGER NOT NULL DEFAULT 0,
    actor           TEXT,
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_story_send_log_story
    ON live_story_send_log(story_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- updated_at trigger (reuse shared function pattern, scoped to this table)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_live_stories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_live_stories_updated_at ON live_stories;
CREATE TRIGGER update_live_stories_updated_at
    BEFORE UPDATE ON live_stories
    FOR EACH ROW
    EXECUTE FUNCTION update_live_stories_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Comments
-- ───────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE live_stories IS 'Followable live stories for the Follow Live Story feature.';
COMMENT ON COLUMN live_stories.status IS 'breaking | developing | verified | disputed | resolved | false_report';
COMMENT ON COLUMN live_stories.confidence IS 'Editorial confidence: low | medium | high';
COMMENT ON TABLE live_story_updates IS 'Timeline updates for a live story; alert_level drives push behavior.';
COMMENT ON COLUMN live_story_updates.alert_level IS 'silent | badge | normal | urgent | final';
COMMENT ON TABLE live_story_follows IS 'Maps a push subscriber_key (hashed endpoint) to a followed story.';
COMMENT ON COLUMN live_story_follows.subscriber_key IS 'Matches netlify/functions/lib/subscriberKey.js getSubscriberKey(endpoint).';
COMMENT ON TABLE live_story_send_log IS 'Audit trail of push dispatches per update (who sent what, how many).';

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security — backend-only (service role bypasses RLS).
-- All public access flows through Netlify Functions using the service role key.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE live_stories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_story_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_story_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_story_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No anonymous access to live_stories" ON live_stories;
DROP POLICY IF EXISTS "No anonymous access to live_story_updates" ON live_story_updates;
DROP POLICY IF EXISTS "No anonymous access to live_story_follows" ON live_story_follows;
DROP POLICY IF EXISTS "No anonymous access to live_story_send_log" ON live_story_send_log;

CREATE POLICY "No anonymous access to live_stories"
    ON live_stories FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to live_story_updates"
    ON live_story_updates FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to live_story_follows"
    ON live_story_follows FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to live_story_send_log"
    ON live_story_send_log FOR ALL USING (false) WITH CHECK (false);
