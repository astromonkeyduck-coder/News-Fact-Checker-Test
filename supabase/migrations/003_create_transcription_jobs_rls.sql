-- Add RLS security to transcription_jobs table
-- Run this if you already created the table without RLS

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
