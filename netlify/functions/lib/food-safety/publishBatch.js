/**
 * Publish one or more food_safety_events that are ready for publication.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function publishEventIds(ids) {
  const { getEventById, getProducts, updateEvent } = require('./store');
  const { publishPost, upsertVerifiedEvent } = require('./publish');

  const normalized = (Array.isArray(ids) ? ids : []).map(String).filter((id) => UUID_RE.test(id));
  if (!normalized.length) return [];

  const results = [];
  for (const id of normalized) {
    try {
      const eventRow = await getEventById(id);
      if (!eventRow) {
        results.push({ id, status: 'not_found' });
        continue;
      }
      if (eventRow.publish_state === 'suppressed') {
        results.push({ id, status: 'suppressed', reason: eventRow.review_reason });
        continue;
      }
      if (eventRow.publish_state === 'published' && eventRow.post_id) {
        results.push({ id, status: 'already_published', post_id: eventRow.post_id });
        continue;
      }
      const products = await getProducts(id);
      const hasMapData = Boolean(
        (eventRow.case_states && eventRow.case_states.length)
        || (eventRow.distribution_states && eventRow.distribution_states.length)
        || eventRow.geographic_scope === 'nationwide',
      );
      const { postId } = await publishPost(eventRow, { products, hasMapData });
      await updateEvent(id, { publish_state: 'published', review_reason: null, post_id: postId });
      await upsertVerifiedEvent({ ...eventRow, post_id: postId });
      results.push({ id, status: 'published', post_id: postId, title: eventRow.display_title });
    } catch (e) {
      results.push({ id, status: 'error', error: e.message });
    }
  }
  return results;
}

async function publishReadyEvents() {
  const supabase = require('../supabaseClient');
  const { data, error } = await supabase
    .from('food_safety_events')
    .select('id')
    .eq('publish_state', 'review')
    .eq('review_reason', 'auto_publish_disabled');
  if (error) throw new Error(error.message);
  return publishEventIds((data || []).map((row) => row.id));
}

module.exports = { publishEventIds, publishReadyEvents, UUID_RE };
