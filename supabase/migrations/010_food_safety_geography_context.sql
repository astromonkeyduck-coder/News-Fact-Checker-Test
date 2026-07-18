-- Explicit outbreak geography context (optional first-class columns).
-- Runtime also persists these under food_safety_events.other_outcomes so
-- reprocessing works before this migration is applied.

ALTER TABLE food_safety_events
  ADD COLUMN IF NOT EXISTS national_surveillance_context JSONB,
  ADD COLUMN IF NOT EXISTS possible_additional_distribution BOOLEAN;

COMMENT ON COLUMN food_safety_events.national_surveillance_context IS
  'Source-backed national pathogen surveillance context (subset-of-nationwide statements). Never invent national totals.';
COMMENT ON COLUMN food_safety_events.possible_additional_distribution IS
  'True when FDA says confirmed distribution states may understate actual product reach.';
