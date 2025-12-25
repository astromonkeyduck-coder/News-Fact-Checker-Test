-- Create verified_events table for normalized event data from all engines
-- This is the primary table for the Verified Events Engine system

CREATE TABLE IF NOT EXISTS verified_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id TEXT UNIQUE NOT NULL,
    engine TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
    title TEXT NOT NULL,
    summary TEXT,
    location_display TEXT,
    country_code TEXT,
    lat FLOAT,
    lon FLOAT,
    geobox JSONB,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    updated_at_source TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'update', 'resolved')),
    tags TEXT[],
    assets JSONB,
    image_url TEXT,
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMPTZ,
    raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create engine_runs table for tracking ingestion runs
CREATE TABLE IF NOT EXISTS engine_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engine TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    ok BOOLEAN DEFAULT false,
    count_new INTEGER DEFAULT 0,
    count_updated INTEGER DEFAULT 0,
    count_total_seen INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for verified_events
CREATE INDEX IF NOT EXISTS idx_verified_events_engine_fetched_at ON verified_events(engine, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_events_event_type_published_at ON verified_events(event_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_events_country_code ON verified_events(country_code);
CREATE INDEX IF NOT EXISTS idx_verified_events_severity ON verified_events(severity);
CREATE INDEX IF NOT EXISTS idx_verified_events_canonical_id ON verified_events(canonical_id);
CREATE INDEX IF NOT EXISTS idx_verified_events_status ON verified_events(status);
CREATE INDEX IF NOT EXISTS idx_verified_events_tags ON verified_events USING GIN(tags);

-- Indexes for engine_runs
CREATE INDEX IF NOT EXISTS idx_engine_runs_engine_started_at ON engine_runs(engine, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_engine_runs_ok ON engine_runs(ok);

-- Function to update updated_at timestamp
-- Set search_path to prevent search path injection attacks
CREATE OR REPLACE FUNCTION update_verified_events_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger to auto-update updated_at
-- Drop trigger if it exists to allow re-running migration
DROP TRIGGER IF EXISTS update_verified_events_updated_at ON verified_events;
CREATE TRIGGER update_verified_events_updated_at
    BEFORE UPDATE ON verified_events
    FOR EACH ROW
    EXECUTE FUNCTION update_verified_events_updated_at();

-- Comments
COMMENT ON TABLE verified_events IS 'Stores normalized verified events from all official sources (USGS, NWS, FAA, USCG, Volcano, Embassy)';
COMMENT ON COLUMN verified_events.canonical_id IS 'Stable deduplication key per event: engine:event_id format';
COMMENT ON COLUMN verified_events.engine IS 'Source engine: usgs, nws, faa, uscg, volcano, embassy';
COMMENT ON COLUMN verified_events.event_type IS 'Type: earthquake, weather_alert, airspace, maritime, volcano, advisory';
COMMENT ON COLUMN verified_events.severity IS 'Normalized severity 1-5 (5 = highest)';
COMMENT ON COLUMN verified_events.status IS 'Event status: active, update, resolved';

COMMENT ON TABLE engine_runs IS 'Tracks ingestion runs for each engine with success/failure metrics';
COMMENT ON COLUMN engine_runs.ok IS 'Whether the run completed successfully';
COMMENT ON COLUMN engine_runs.count_new IS 'Number of new events inserted';
COMMENT ON COLUMN engine_runs.count_updated IS 'Number of existing events updated';

-- Enable Row Level Security (RLS) for security best practices
ALTER TABLE verified_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- These tables are backend-only (accessed via service role key)
-- Service role bypasses RLS automatically, so it will still have full access
-- These policies block anonymous/public access for security

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "No anonymous access to verified_events" ON verified_events;
DROP POLICY IF EXISTS "No anonymous access to engine_runs" ON engine_runs;

-- Policy: Block all anonymous/public access
-- Service role will still work because it bypasses RLS entirely
CREATE POLICY "No anonymous access to verified_events"
    ON verified_events
    FOR ALL
    USING (false)
    WITH CHECK (false);

CREATE POLICY "No anonymous access to engine_runs"
    ON engine_runs
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Verification queries (optional - uncomment to run after migration)
-- These verify that RLS is enabled and policies are created correctly

/*
-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('verified_events', 'engine_runs');

-- Verify policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('verified_events', 'engine_runs');

-- Verify trigger exists
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name = 'update_verified_events_updated_at';
*/

