/**
 * Admin review-queue API for food-safety events (Auth0 admin JWT required —
 * same requireAdminAuth middleware as other admin endpoints; no new auth
 * system, no public access, service-role key stays server-side).
 *
 * GET  ?action=queue                       → review + recent events w/ evidence
 * GET  ?action=event&id=<uuid>             → full event, products, versions, docs
 * POST { action: 'publish',   id }         → publish a reviewed event
 * POST { action: 'suppress',  id, reason } → suppress (never auto-publishes again)
 * POST { action: 'reprocess', id }         → re-queue the event's source docs
 * POST { action: 'unlink',    id, docId, confirm: true }
 *                                          → detach a source doc (audit kept)
 */

if (process.env.NETLIFY_DEV) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) { /* optional in dev */ }
}

const { requireAdminAuthOrSecret } = require('./middleware/requireAuth');

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

exports.handler = async (event) => {
  const auth = await requireAdminAuthOrSecret(event, 'FOOD_SAFETY_INTERNAL_TOKEN');
  if (auth.statusCode) return auth; // 401/403/500 from middleware

  const supabase = require('./lib/supabaseClient');
  const { getProducts, getVersions, updateEvent, getEventById, supabase: db } = require('./lib/food-safety/store');

  try {
    if (event.httpMethod === 'GET') {
      const action = event.queryStringParameters?.action || 'queue';

      if (action === 'queue') {
        const { data: reviewItems, error } = await supabase
          .from('food_safety_events')
          .select('id, display_title, title, event_kind, status, publish_state, review_reason, severity, extraction_method, extraction_confidence, source_url, fda_publish_date, source_updated_at, update_number, company, product_name, hazard_name, illnesses, hospitalizations, deaths, case_states, distribution_states, post_id, created_at, updated_at')
          .in('publish_state', ['review', 'draft'])
          .order('updated_at', { ascending: false })
          .limit(100);
        if (error) throw new Error(error.message);

        const { data: recent, error: recErr } = await supabase
          .from('food_safety_events')
          .select('id, display_title, publish_state, severity, update_number, post_id, updated_at')
          .eq('publish_state', 'published')
          .order('updated_at', { ascending: false })
          .limit(25);
        if (recErr) throw new Error(recErr.message);

        const { data: failures, error: failErr } = await supabase
          .from('food_safety_source_documents')
          .select('id, source_kind, external_id, canonical_url, processing_status, attempt_count, last_error, updated_at')
          .in('processing_status', ['failed'])
          .order('updated_at', { ascending: false })
          .limit(50);
        if (failErr) throw new Error(failErr.message);

        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ review: reviewItems, recent, failures }) };
      }

      if (action === 'event') {
        const id = (event.queryStringParameters?.id || '').trim();
        if (!UUID_RE.test(id)) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid id' }) };
        }
        const eventRow = await getEventById(id);
        if (!eventRow) {
          return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'not found' }) };
        }
        const [products, versions] = await Promise.all([getProducts(id), getVersions(id)]);
        const { data: docs, error: docErr } = await supabase
          .from('food_safety_source_documents')
          .select('id, source_kind, external_id, canonical_url, published_at, processing_status, attempt_count, last_error, body_hash, first_seen_at, last_seen_at, fetched_at')
          .eq('event_id', id)
          .order('first_seen_at', { ascending: true });
        if (docErr) throw new Error(docErr.message);

        // Full version snapshots include field-level evidence for review
        const { data: fullVersions, error: verErr } = await supabase
          .from('food_safety_event_versions')
          .select('*')
          .eq('event_id', id)
          .order('version_number', { ascending: true });
        if (verErr) throw new Error(verErr.message);

        return {
          statusCode: 200,
          headers: HEADERS,
          body: JSON.stringify({
            event: eventRow, products, versions: fullVersions || versions, source_documents: docs,
          }),
        };
      }

      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'unknown action' }) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (_) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid JSON' }) };
      }
      const { action, id } = body;
      if (!UUID_RE.test(String(id || ''))) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid id' }) };
      }
      const eventRow = await getEventById(id);
      if (!eventRow) {
        return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: 'not found' }) };
      }

      if (action === 'publish') {
        const { publishPost, upsertVerifiedEvent } = require('./lib/food-safety/publish');
        const products = await getProducts(id);
        const hasMapData = Boolean(
          (eventRow.case_states && eventRow.case_states.length)
          || (eventRow.distribution_states && eventRow.distribution_states.length)
          || eventRow.geographic_scope === 'nationwide',
        );
        const { postId } = await publishPost(eventRow, { products, hasMapData });
        const updated = await updateEvent(id, {
          publish_state: 'published',
          review_reason: null,
          post_id: postId,
        });
        await upsertVerifiedEvent({ ...updated, post_id: postId });
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, post_id: postId }) };
      }

      if (action === 'suppress') {
        const reason = String(body.reason || 'suppressed by admin').slice(0, 500);
        await updateEvent(id, { publish_state: 'suppressed', review_reason: reason });
        // Remove the public post if one exists (history stays in Supabase)
        if (eventRow.post_id) {
          try {
            const { getPostStore, deletePost } = require('./lib/postStore');
            await deletePost(getPostStore(), eventRow.post_id);
          } catch (e) {
            console.warn(`[admin-food-safety] post removal failed: ${e.message}`);
          }
        }
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
      }

      if (action === 'reprocess') {
        const { error } = await db
          .from('food_safety_source_documents')
          .update({
            processing_status: 'pending',
            next_attempt_at: new Date().toISOString(),
            attempt_count: 0,
            last_error: null,
            locked_at: null,
            locked_by: null,
          })
          .eq('event_id', id);
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
      }

      if (action === 'unlink') {
        if (body.confirm !== true) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'unlink requires confirm: true' }) };
        }
        const docId = String(body.docId || '');
        if (!UUID_RE.test(docId)) {
          return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'invalid docId' }) };
        }
        // Preserve audit history: mark the doc skipped and detach, never delete.
        const { error } = await db
          .from('food_safety_source_documents')
          .update({
            event_id: null,
            processing_status: 'skipped',
            last_error: `unlinked from event ${id} by admin`,
          })
          .eq('id', docId)
          .eq('event_id', id);
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
      }

      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'unknown action' }) };
    }

    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  } catch (e) {
    console.error('[admin-food-safety] error:', e.message);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'internal error' }) };
  }
};
