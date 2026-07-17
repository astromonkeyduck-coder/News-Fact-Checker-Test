-- Food Safety (FDA) subsystem tables
-- Normalized domain model for FDA food recalls, safety alerts, and
-- foodborne-illness outbreak investigations.
--
-- Tables:
--   food_safety_source_documents : immutable-ish record of each official upstream item
--   food_safety_events           : one canonical Noteworthy event
--   food_safety_products         : product variants attached to an event
--   food_safety_event_versions   : version history with material diffs
--
-- All tables are backend-only (service-role access). RLS blocks anon access,
-- consistent with verified_events (002).

-- ---------------------------------------------------------------------------
-- food_safety_source_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_safety_source_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'fda',
    source_kind TEXT NOT NULL CHECK (source_kind IN (
        'fda_rss_recall',
        'fda_rss_outbreak',
        'fda_rss_general',
        'fda_rss_allergy',
        'fda_recall_table',
        'fda_core',
        'fda_canonical_page',
        'openfda_enforcement',
        'fda_email_trigger'
    )),
    external_id TEXT NOT NULL,
    canonical_url TEXT,
    feed_guid TEXT,
    email_message_id TEXT,
    official_reference_number TEXT,
    openfda_event_id TEXT,
    recall_numbers TEXT[],
    published_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetched_at TIMESTAMPTZ,
    etag TEXT,
    last_modified TEXT,
    http_status INTEGER,
    content_type TEXT,
    body_hash TEXT,
    raw_blob_key TEXT,
    parsed_payload JSONB,
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN (
        'pending', 'processing', 'parsed', 'correlated',
        'published', 'review', 'skipped', 'failed'
    )),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    last_error TEXT,
    event_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- The same feed item / email / page / openFDA record must not be
    -- ingested twice.
    CONSTRAINT food_safety_source_documents_identity UNIQUE (provider, source_kind, external_id)
);

CREATE INDEX IF NOT EXISTS idx_fss_docs_status_next_attempt
    ON food_safety_source_documents(processing_status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_fss_docs_canonical_url
    ON food_safety_source_documents(canonical_url);
CREATE INDEX IF NOT EXISTS idx_fss_docs_event_id
    ON food_safety_source_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_fss_docs_body_hash
    ON food_safety_source_documents(body_hash);
CREATE INDEX IF NOT EXISTS idx_fss_docs_reference_number
    ON food_safety_source_documents(official_reference_number);

-- ---------------------------------------------------------------------------
-- food_safety_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_safety_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_key TEXT UNIQUE NOT NULL,
    event_kind TEXT NOT NULL CHECK (event_kind IN (
        'recall', 'outbreak', 'safety_alert', 'allergen_alert'
    )),
    provider TEXT NOT NULL DEFAULT 'fda',
    source_url TEXT,
    official_reference_number TEXT,
    openfda_event_id TEXT,
    recall_numbers TEXT[],

    -- consumer presentation
    title TEXT,
    display_title TEXT,
    short_dek TEXT,
    public_action TEXT,
    company TEXT,
    brands TEXT[],
    product_name TEXT,
    product_description TEXT,

    -- hazard
    hazard_category TEXT CHECK (hazard_category IN (
        'pathogen', 'allergen', 'chemical', 'foreign_material',
        'toxin', 'labeling', 'other'
    )),
    hazard_name TEXT,
    organism TEXT,
    serotype TEXT,
    allergens TEXT[],

    -- lifecycle
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'active', 'ongoing', 'updated', 'expanded',
        'ended', 'terminated', 'unknown'
    )),
    fda_recall_classification TEXT,
    voluntary_or_mandated TEXT,
    update_number INTEGER NOT NULL DEFAULT 0,
    current_version INTEGER NOT NULL DEFAULT 1,
    company_announcement_date DATE,
    fda_publish_date TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    last_illness_onset DATE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- quantitative data (NULL = not reported; never coerce absent to zero)
    illnesses INTEGER,
    hospitalizations INTEGER,
    deaths INTEGER,
    hus_cases INTEGER,
    other_outcomes JSONB,

    -- geography
    geographic_scope TEXT CHECK (geographic_scope IN (
        'nationwide', 'multistate', 'single_state', 'local',
        'international', 'unknown'
    )),
    case_states TEXT[],
    distribution_states TEXT[],
    case_counts_by_state JSONB,
    distribution_text TEXT,
    retailers TEXT[],

    -- content
    recommendations JSONB,
    source_links JSONB,
    images JSONB,
    related_event_ids UUID[],
    compact_summary JSONB,

    -- editorial / processing
    severity INTEGER CHECK (severity >= 1 AND severity <= 5),
    severity_reasons JSONB,
    publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN (
        'draft', 'review', 'published', 'suppressed'
    )),
    review_reason TEXT,
    extraction_method TEXT,
    extraction_confidence NUMERIC,
    source_hash TEXT,
    material_hash TEXT,
    post_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fss_events_publish_state
    ON food_safety_events(publish_state);
CREATE INDEX IF NOT EXISTS idx_fss_events_reference_number
    ON food_safety_events(official_reference_number);
CREATE INDEX IF NOT EXISTS idx_fss_events_post_id
    ON food_safety_events(post_id);
CREATE INDEX IF NOT EXISTS idx_fss_events_fda_publish_date
    ON food_safety_events(fda_publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_fss_events_source_url
    ON food_safety_events(source_url);
CREATE INDEX IF NOT EXISTS idx_fss_events_recall_numbers
    ON food_safety_events USING GIN(recall_numbers);

-- ---------------------------------------------------------------------------
-- food_safety_products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_safety_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES food_safety_events(id) ON DELETE CASCADE,
    brand TEXT,
    product_name TEXT,
    variety TEXT,
    package_size TEXT,
    package_description TEXT,
    upc TEXT,
    lot_code TEXT,
    additional_codes TEXT[],
    best_by_date TEXT,
    use_by_date TEXT,
    expiration_date TEXT,
    retailers TEXT[],
    distribution_states TEXT[],
    image_urls JSONB,
    source_evidence JSONB,
    dedupe_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT food_safety_products_dedupe UNIQUE (event_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_fss_products_event_id
    ON food_safety_products(event_id);
CREATE INDEX IF NOT EXISTS idx_fss_products_upc
    ON food_safety_products(upc);

-- ---------------------------------------------------------------------------
-- food_safety_event_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_safety_event_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES food_safety_events(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_updated_at TIMESTAMPTZ,
    changed_fields JSONB,
    material_changes JSONB,
    snapshot JSONB,
    source_document_ids UUID[],
    source_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT food_safety_event_versions_unique UNIQUE (event_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_fss_versions_event_id
    ON food_safety_event_versions(event_id, version_number DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers (same pattern as 002_create_verified_events.sql)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_food_safety_updated_at()
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

DROP TRIGGER IF EXISTS update_fss_source_documents_updated_at ON food_safety_source_documents;
CREATE TRIGGER update_fss_source_documents_updated_at
    BEFORE UPDATE ON food_safety_source_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_food_safety_updated_at();

DROP TRIGGER IF EXISTS update_fss_events_updated_at ON food_safety_events;
CREATE TRIGGER update_fss_events_updated_at
    BEFORE UPDATE ON food_safety_events
    FOR EACH ROW
    EXECUTE FUNCTION update_food_safety_updated_at();

DROP TRIGGER IF EXISTS update_fss_products_updated_at ON food_safety_products;
CREATE TRIGGER update_fss_products_updated_at
    BEFORE UPDATE ON food_safety_products
    FOR EACH ROW
    EXECUTE FUNCTION update_food_safety_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: backend-only tables (service role bypasses RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE food_safety_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_safety_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_safety_event_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No anonymous access to food_safety_source_documents" ON food_safety_source_documents;
DROP POLICY IF EXISTS "No anonymous access to food_safety_events" ON food_safety_events;
DROP POLICY IF EXISTS "No anonymous access to food_safety_products" ON food_safety_products;
DROP POLICY IF EXISTS "No anonymous access to food_safety_event_versions" ON food_safety_event_versions;

CREATE POLICY "No anonymous access to food_safety_source_documents"
    ON food_safety_source_documents FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to food_safety_events"
    ON food_safety_events FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to food_safety_products"
    ON food_safety_products FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No anonymous access to food_safety_event_versions"
    ON food_safety_event_versions FOR ALL USING (false) WITH CHECK (false);

-- Comments
COMMENT ON TABLE food_safety_source_documents IS 'Official upstream FDA source items (RSS entries, recall-table rows, CORE rows, canonical pages, openFDA records, email triggers)';
COMMENT ON TABLE food_safety_events IS 'Canonical Noteworthy food-safety events (one per official recall/outbreak/alert)';
COMMENT ON TABLE food_safety_products IS 'Affected product variants attached to a food-safety event';
COMMENT ON TABLE food_safety_event_versions IS 'Material version history for food-safety events; every material official update creates a version';
COMMENT ON COLUMN food_safety_events.illnesses IS 'NULL means not reported by FDA; only explicit official zero becomes 0';
COMMENT ON COLUMN food_safety_events.case_states IS 'States with confirmed cases (never merged with distribution_states)';
COMMENT ON COLUMN food_safety_events.distribution_states IS 'States where product was distributed (never merged with case_states)';
