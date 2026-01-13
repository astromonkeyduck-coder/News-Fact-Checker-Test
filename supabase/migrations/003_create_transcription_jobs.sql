-- Create transcription_jobs table for Clemens Converter large file processing
-- Stores job state for files >25MB that require chunking and multi-call transcription

CREATE TABLE IF NOT EXISTS transcription_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'transcribing', 'finalizing', 'done', 'error')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    chunks_total INTEGER DEFAULT NULL,
    chunks_done INTEGER NOT NULL DEFAULT 0,
    r2_key TEXT NOT NULL, -- R2 object key for original audio file
    filename TEXT NOT NULL, -- Original filename
    transcript_key TEXT DEFAULT NULL, -- R2 key for final transcript .txt file
    transcript_json_key TEXT DEFAULT NULL, -- R2 key for final transcript .json file (if timestamps enabled)
    language TEXT DEFAULT NULL, -- Language code (null = auto-detect)
    include_timestamps BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster status queries
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_status ON transcription_jobs(status);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_created_at ON transcription_jobs(created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcription_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER trigger_update_transcription_jobs_updated_at
    BEFORE UPDATE ON transcription_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_transcription_jobs_updated_at();

-- Add comment
COMMENT ON TABLE transcription_jobs IS 'Stores job state for large audio file transcription (>25MB) requiring chunking and multi-call OpenAI Whisper processing';

-- Enable Row Level Security (RLS) for security best practices
ALTER TABLE transcription_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
-- This table is backend-only (accessed via service role key)
-- Service role bypasses RLS automatically, so it will still have full access
-- This policy blocks anonymous/public access for security

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "No anonymous access to transcription_jobs" ON transcription_jobs;

-- Policy: Block all anonymous/public access
-- Service role will still work because it bypasses RLS entirely
CREATE POLICY "No anonymous access to transcription_jobs"
    ON transcription_jobs
    FOR ALL
    USING (false)
    WITH CHECK (false);
