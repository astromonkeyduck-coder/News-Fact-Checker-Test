/**
 * Supabase data access for the food-safety pipeline.
 *
 * All access is server-side with the service-role client (RLS blocks anon).
 * Claiming uses optimistic status transitions so concurrent invocations
 * cannot process the same source document twice.
 */

const { config } = require('./config');

// Lazy client so parser/domain modules can be imported without Supabase
// credentials (tests, fixtures, dry-run tooling).
let _client = null;
function getClient() {
  if (!_client) _client = require('../supabaseClient'); // eslint-disable-line global-require
  return _client;
}
const supabase = new Proxy({}, {
  get(_, prop) {
    return getClient()[prop];
  },
});

// ---------------------------------------------------------------------------
// Source documents
// ---------------------------------------------------------------------------

/**
 * Idempotently insert a discovered source document. If the identity
 * (provider, source_kind, external_id) already exists, updates last_seen_at
 * and — when the content hash changed — re-queues it for processing.
 * Returns { doc, isNew, changed }.
 */
async function upsertSourceDocument(doc) {
  const identity = {
    provider: doc.provider || 'fda',
    source_kind: doc.source_kind,
    external_id: doc.external_id,
  };

  const { data: existing, error: selErr } = await supabase
    .from('food_safety_source_documents')
    .select('*')
    .eq('provider', identity.provider)
    .eq('source_kind', identity.source_kind)
    .eq('external_id', identity.external_id)
    .maybeSingle();
  if (selErr) throw new Error(`source doc select failed: ${selErr.message}`);

  const now = new Date().toISOString();

  if (!existing) {
    const { data, error } = await supabase
      .from('food_safety_source_documents')
      .insert({
        ...identity,
        canonical_url: doc.canonical_url || null,
        feed_guid: doc.feed_guid || null,
        email_message_id: doc.email_message_id || null,
        official_reference_number: doc.official_reference_number || null,
        openfda_event_id: doc.openfda_event_id || null,
        recall_numbers: doc.recall_numbers || null,
        published_at: doc.published_at || null,
        source_updated_at: doc.source_updated_at || null,
        first_seen_at: now,
        last_seen_at: now,
        etag: doc.etag || null,
        last_modified: doc.last_modified || null,
        http_status: doc.http_status || null,
        content_type: doc.content_type || null,
        body_hash: doc.body_hash || null,
        raw_blob_key: doc.raw_blob_key || null,
        parsed_payload: doc.parsed_payload || null,
        processing_status: doc.processing_status || 'pending',
        next_attempt_at: now,
      })
      .select()
      .single();
    if (error) {
      // Unique violation from a concurrent invocation: treat as existing.
      if (error.code === '23505') {
        return { doc: existing, isNew: false, changed: false, raced: true };
      }
      throw new Error(`source doc insert failed: ${error.message}`);
    }
    return { doc: data, isNew: true, changed: true };
  }

  const changed = Boolean(doc.body_hash && existing.body_hash && doc.body_hash !== existing.body_hash);
  const updates = { last_seen_at: now };
  if (changed) {
    updates.body_hash = doc.body_hash;
    updates.parsed_payload = doc.parsed_payload || existing.parsed_payload;
    updates.source_updated_at = doc.source_updated_at || existing.source_updated_at;
    updates.processing_status = 'pending';
    updates.next_attempt_at = now;
    updates.attempt_count = 0;
    updates.last_error = null;
  }
  const { data, error } = await supabase
    .from('food_safety_source_documents')
    .update(updates)
    .eq('id', existing.id)
    .select()
    .single();
  if (error) throw new Error(`source doc update failed: ${error.message}`);
  return { doc: data, isNew: false, changed };
}

/**
 * Atomically claim up to `limit` pending source documents. Uses a
 * status-guarded UPDATE per candidate so two concurrent processors cannot
 * claim the same row.
 */
async function claimPendingDocuments({ limit = config.maxDocsPerRun, workerId = 'processor' } = {}) {
  const now = new Date().toISOString();
  const staleLockCutoff = new Date(Date.now() - config.lockTtlMs).toISOString();

  // Recover stale locks first (crashed processors)
  await supabase
    .from('food_safety_source_documents')
    .update({ processing_status: 'pending', locked_at: null, locked_by: null })
    .eq('processing_status', 'processing')
    .lt('locked_at', staleLockCutoff);

  const { data: candidates, error } = await supabase
    .from('food_safety_source_documents')
    .select('id')
    .eq('processing_status', 'pending')
    .lte('next_attempt_at', now)
    .lt('attempt_count', config.maxAttempts)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit * 2);
  if (error) throw new Error(`claim select failed: ${error.message}`);

  const claimed = [];
  for (const c of candidates || []) {
    if (claimed.length >= limit) break;
    const { data: row, error: updErr } = await supabase
      .from('food_safety_source_documents')
      .update({ processing_status: 'processing', locked_at: now, locked_by: workerId })
      .eq('id', c.id)
      .eq('processing_status', 'pending') // guard: only claim if still pending
      .select()
      .maybeSingle();
    if (!updErr && row) claimed.push(row);
  }
  return claimed;
}

async function updateSourceDocument(id, updates) {
  const { data, error } = await supabase
    .from('food_safety_source_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`source doc update failed: ${error.message}`);
  return data;
}

/** Mark a document failed with retry/backoff scheduling. */
async function markDocumentFailed(docRow, errMessage, { permanent = false } = {}) {
  const attempts = (docRow.attempt_count || 0) + 1;
  const exhausted = permanent || attempts >= config.maxAttempts;
  const backoffMin = Math.min(120, 2 ** attempts * 5);
  return updateSourceDocument(docRow.id, {
    processing_status: exhausted ? 'failed' : 'pending',
    attempt_count: attempts,
    next_attempt_at: exhausted ? null : new Date(Date.now() + backoffMin * 60 * 1000).toISOString(),
    last_error: String(errMessage || 'unknown').slice(0, 2000),
    locked_at: null,
    locked_by: null,
  });
}

async function getSourceDocumentByIdentity(sourceKind, externalId, provider = 'fda') {
  const { data, error } = await supabase
    .from('food_safety_source_documents')
    .select('*')
    .eq('provider', provider)
    .eq('source_kind', sourceKind)
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw new Error(`source doc lookup failed: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Feed cursor state (ETag / Last-Modified per feed) stored as source docs of
// kind matching the feed with external_id = feed URL.
// ---------------------------------------------------------------------------

async function getFeedState(sourceKind, feedUrl) {
  const doc = await getSourceDocumentByIdentity(sourceKind, `feed-state:${feedUrl}`);
  return doc;
}

async function saveFeedState(sourceKind, feedUrl, { etag, lastModified, bodyHash, httpStatus }) {
  const existing = await getFeedState(sourceKind, feedUrl);
  const now = new Date().toISOString();
  if (existing) {
    return updateSourceDocument(existing.id, {
      etag: etag || null,
      last_modified: lastModified || null,
      body_hash: bodyHash || existing.body_hash,
      http_status: httpStatus || null,
      fetched_at: now,
      last_seen_at: now,
      processing_status: 'skipped', // feed-state rows are never processed
    });
  }
  const { data, error } = await supabase
    .from('food_safety_source_documents')
    .insert({
      provider: 'fda',
      source_kind: sourceKind,
      external_id: `feed-state:${feedUrl}`,
      canonical_url: feedUrl,
      etag: etag || null,
      last_modified: lastModified || null,
      body_hash: bodyHash || null,
      http_status: httpStatus || null,
      fetched_at: now,
      processing_status: 'skipped',
    })
    .select()
    .single();
  if (error && error.code !== '23505') throw new Error(`feed state insert failed: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

async function getEventByCanonicalKey(canonicalKey) {
  const { data, error } = await supabase
    .from('food_safety_events')
    .select('*')
    .eq('canonical_key', canonicalKey)
    .maybeSingle();
  if (error) throw new Error(`event lookup failed: ${error.message}`);
  return data;
}

async function getEventBySourceUrl(sourceUrl) {
  const { data, error } = await supabase
    .from('food_safety_events')
    .select('*')
    .eq('source_url', sourceUrl)
    .maybeSingle();
  if (error) throw new Error(`event lookup by url failed: ${error.message}`);
  return data;
}

async function getEventByReferenceNumber(refNumber) {
  const { data, error } = await supabase
    .from('food_safety_events')
    .select('*')
    .eq('official_reference_number', refNumber)
    .eq('provider', 'fda')
    .maybeSingle();
  if (error) throw new Error(`event lookup by ref failed: ${error.message}`);
  return data;
}

async function getEventById(id) {
  const { data, error } = await supabase
    .from('food_safety_events')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`event lookup by id failed: ${error.message}`);
  return data;
}

async function insertEvent(eventRow) {
  const { data, error } = await supabase
    .from('food_safety_events')
    .insert(eventRow)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') {
      // Concurrent insert of the same canonical event
      return getEventByCanonicalKey(eventRow.canonical_key);
    }
    throw new Error(`event insert failed: ${error.message}`);
  }
  return data;
}

async function updateEvent(id, updates) {
  const { data, error } = await supabase
    .from('food_safety_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`event update failed: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function productDedupeKey(p) {
  return [
    (p.upc || '').replace(/\D/g, ''),
    (p.lot_code || '').toLowerCase().replace(/\s+/g, ''),
    (p.product_name || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    (p.package_size || '').toLowerCase().replace(/\s+/g, ''),
    (p.best_by_date || p.use_by_date || p.expiration_date || '').toLowerCase(),
  ].join('|');
}

async function upsertProducts(eventId, products) {
  let added = 0;
  for (const p of products || []) {
    const dedupeKey = productDedupeKey(p);
    const { error } = await supabase
      .from('food_safety_products')
      .upsert({
        event_id: eventId,
        brand: p.brand || null,
        product_name: p.product_name || null,
        variety: p.variety || null,
        package_size: p.package_size || null,
        package_description: p.package_description || null,
        upc: p.upc || null,
        lot_code: p.lot_code || null,
        additional_codes: p.additional_codes || null,
        best_by_date: p.best_by_date || null,
        use_by_date: p.use_by_date || null,
        expiration_date: p.expiration_date || null,
        retailers: p.retailers || null,
        distribution_states: p.distribution_states || null,
        image_urls: p.image_urls || null,
        source_evidence: p.source_evidence || null,
        dedupe_key: dedupeKey,
      }, { onConflict: 'event_id,dedupe_key' });
    if (error) throw new Error(`product upsert failed: ${error.message}`);
    added += 1;
  }
  return added;
}

async function getProducts(eventId) {
  const { data, error } = await supabase
    .from('food_safety_products')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`products read failed: ${error.message}`);
  return data || [];
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

async function insertVersion(versionRow) {
  const { data, error } = await supabase
    .from('food_safety_event_versions')
    .insert(versionRow)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return null; // concurrent duplicate version
    throw new Error(`version insert failed: ${error.message}`);
  }
  return data;
}

async function getVersions(eventId) {
  const { data, error } = await supabase
    .from('food_safety_event_versions')
    .select('id, version_number, observed_at, source_updated_at, changed_fields, material_changes, source_hash, created_at')
    .eq('event_id', eventId)
    .order('version_number', { ascending: true });
  if (error) throw new Error(`versions read failed: ${error.message}`);
  return data || [];
}

module.exports = {
  supabase,
  upsertSourceDocument,
  claimPendingDocuments,
  updateSourceDocument,
  markDocumentFailed,
  getSourceDocumentByIdentity,
  getFeedState,
  saveFeedState,
  getEventByCanonicalKey,
  getEventBySourceUrl,
  getEventByReferenceNumber,
  getEventById,
  insertEvent,
  updateEvent,
  productDedupeKey,
  upsertProducts,
  getProducts,
  insertVersion,
  getVersions,
};
