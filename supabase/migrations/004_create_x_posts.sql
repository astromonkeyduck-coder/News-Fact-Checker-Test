-- X Posts: imported posts from the Noteworthy News X account
-- Source of truth for X-originated content; projected to Netlify Blobs for public reads.

CREATE TABLE IF NOT EXISTS x_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    x_post_id TEXT UNIQUE NOT NULL,
    x_conversation_id TEXT,
    x_author_id TEXT,
    text TEXT,
    clean_title TEXT,
    summary TEXT,
    slug TEXT UNIQUE NOT NULL,
    x_url TEXT,
    quoted_post_id TEXT,
    replied_to_post_id TEXT,
    is_thread_reply BOOLEAN NOT NULL DEFAULT FALSE,
    thread_parent_id UUID REFERENCES x_posts(id),
    source_urls JSONB DEFAULT '[]'::jsonb,
    category TEXT,
    urgency TEXT,
    location TEXT,
    public_metrics JSONB DEFAULT '{}'::jsonb,
    created_at_x TIMESTAMPTZ,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_x_json JSONB,
    status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'imported', 'needs_review', 'hidden'))
);

CREATE INDEX IF NOT EXISTS idx_x_posts_x_post_id ON x_posts(x_post_id);
CREATE INDEX IF NOT EXISTS idx_x_posts_created_at_x ON x_posts(created_at_x DESC);
CREATE INDEX IF NOT EXISTS idx_x_posts_slug ON x_posts(slug);
CREATE INDEX IF NOT EXISTS idx_x_posts_status ON x_posts(status);
CREATE INDEX IF NOT EXISTS idx_x_posts_conversation ON x_posts(x_conversation_id);

CREATE TRIGGER update_x_posts_updated_at
    BEFORE UPDATE ON x_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE x_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No anonymous access to x_posts" ON x_posts;
CREATE POLICY "No anonymous access to x_posts"
    ON x_posts FOR ALL
    USING (false) WITH CHECK (false);

COMMENT ON TABLE x_posts IS 'Imported posts from the Noteworthy News X account. Authoritative store; projected to Netlify Blobs for public reads.';

-- X Post Media: media attachments for imported X posts

CREATE TABLE IF NOT EXISTS x_post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES x_posts(id) ON DELETE CASCADE,
    media_key TEXT,
    type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'animated_gif')),
    original_url TEXT,
    preview_image_url TEXT,
    stored_url TEXT,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    duration_ms INTEGER,
    variants JSONB,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_x_post_media_post_id ON x_post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_x_post_media_media_key ON x_post_media(media_key);

ALTER TABLE x_post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No anonymous access to x_post_media" ON x_post_media;
CREATE POLICY "No anonymous access to x_post_media"
    ON x_post_media FOR ALL
    USING (false) WITH CHECK (false);

COMMENT ON TABLE x_post_media IS 'Media attachments for imported X posts (photos, videos, GIFs).';
