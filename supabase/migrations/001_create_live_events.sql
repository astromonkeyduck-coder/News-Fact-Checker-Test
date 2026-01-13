-- Create live_events table for storing fresh news/events
-- This is the primary source of truth for up-to-date information

CREATE TABLE IF NOT EXISTS live_events (
    canonical_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    source_name TEXT NOT NULL,
    source_url TEXT,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tags TEXT[],
    reliability TEXT NOT NULL DEFAULT 'unknown',
    raw_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for fast queries by fetched_at (most recent first)
CREATE INDEX IF NOT EXISTS idx_live_events_fetched_at ON live_events(fetched_at DESC);

-- Create index for tags (array search)
CREATE INDEX IF NOT EXISTS idx_live_events_tags ON live_events USING GIN(tags);

-- Create index for full-text search on title and summary
CREATE INDEX IF NOT EXISTS idx_live_events_search ON live_events USING GIN(to_tsvector('english', title || ' ' || COALESCE(summary, '')));

-- Create index for reliability filtering
CREATE INDEX IF NOT EXISTS idx_live_events_reliability ON live_events(reliability);

-- Function to update updated_at timestamp
-- Set search_path to prevent search path injection attacks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_live_events_updated_at
    BEFORE UPDATE ON live_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE live_events IS 'Stores fresh news/events from authoritative sources. Primary source of truth for AI answers.';
COMMENT ON COLUMN live_events.canonical_id IS 'Unique identifier: hash of source_name + source_url or source_name + event_id';
COMMENT ON COLUMN live_events.reliability IS 'Source reliability: official, major_media, or unknown';

-- Enable Row Level Security (RLS) for security best practices
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy
-- This table is backend-only (accessed via service role key)
-- Service role bypasses RLS automatically, so it will still have full access
-- This policy blocks anonymous/public access for security

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "No anonymous access to live_events" ON live_events;

-- Policy: Block all anonymous/public access
-- Service role will still work because it bypasses RLS entirely
CREATE POLICY "No anonymous access to live_events"
    ON live_events
    FOR ALL
    USING (false)
    WITH CHECK (false);





