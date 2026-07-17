/**
 * Publication adapter: canonical food-safety event → website post (Netlify
 * Blobs post store) + generic verified_events summary row.
 *
 * One stable post per canonical event. Updates rewrite the same post ID so
 * the article URL never changes across official updates.
 */

const {
  getPostStore, readPost, writePost, addToIndex,
} = require('../postStore');
const { formatAllergenList } = require('./classify');

// Lazy Supabase client (same reasoning as store.js)
let _client = null;
function getSupabase() {
  if (!_client) _client = require('../supabaseClient'); // eslint-disable-line global-require
  return _client;
}

function postIdForEvent(event) {
  return event.canonical_key.replace(/[^a-zA-Z0-9]+/g, '-');
}

function truncate(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function eventTypeForEvent(event) {
  return event.event_kind === 'outbreak' ? 'food_outbreak' : 'food_recall';
}

/**
 * Compact, card-safe summary embedded in the post (NOT the full detail).
 * Full details are served by /.netlify/functions/food-safety-event.
 */
function buildCompactSummary(event, { productCount = 0, hasMapData = false } = {}) {
  return {
    event_kind: event.event_kind,
    update_number: event.update_number || 0,
    status: event.status,
    product: truncate(event.product_name || event.product_description, 120),
    brand: event.brands && event.brands.length ? event.brands[0] : null,
    company: truncate(event.company, 80),
    hazard_category: event.hazard_category,
    hazard_label: truncate(event.hazard_name, 80),
    public_action: event.public_action,
    geographic_scope: event.geographic_scope,
    geography_label: buildGeographyLabel(event),
    metric_summary: buildMetricSummary(event),
    case_state_count: event.case_states ? event.case_states.length : null,
    distribution_state_count: event.distribution_states ? event.distribution_states.length : null,
    illnesses: numOrNull(event.illnesses),
    hospitalizations: numOrNull(event.hospitalizations),
    deaths: numOrNull(event.deaths),
    last_official_update: event.source_updated_at || event.fda_publish_date || null,
    has_map_data: hasMapData,
    product_count: productCount,
  };
}

/**
 * Geography label shown on cards. Only source-backed values:
 * "Nationwide" only when FDA said nationwide; "N states" from actual lists.
 */
function buildGeographyLabel(event) {
  if (event.geographic_scope === 'nationwide') return 'Nationwide';
  const caseCount = event.case_states ? event.case_states.length : 0;
  const distCount = event.distribution_states ? event.distribution_states.length : 0;
  if (caseCount > 1) return `${caseCount} states`;
  if (caseCount === 1) return event.case_states[0];
  if (distCount > 1) return `${distCount} states`;
  if (distCount === 1) return event.distribution_states[0];
  if (event.geographic_scope === 'international') return 'International';
  return null; // unknown geography stays unlabeled, never guessed
}

/**
 * Compact metric line. Metrics appear ONLY when explicitly reported.
 * "0 deaths" appears only for explicit official zero.
 */
function buildMetricSummary(event) {
  const parts = [];
  if (typeof event.illnesses === 'number') {
    parts.push(`${event.illnesses.toLocaleString('en-US')} sick`);
  }
  if (typeof event.hospitalizations === 'number' && event.hospitalizations > 0) {
    parts.push(`${event.hospitalizations.toLocaleString('en-US')} hospitalized`);
  } else if (event.hospitalizations === 0 && typeof event.illnesses === 'number' && event.illnesses > 0) {
    parts.push('0 hospitalized');
  }
  if (typeof event.deaths === 'number' && event.deaths > 0) {
    parts.push(`${event.deaths.toLocaleString('en-US')} deaths`);
  } else if (event.deaths === 0 && typeof event.illnesses === 'number' && event.illnesses > 0) {
    parts.push('0 deaths');
  }
  if (parts.length === 0) {
    if (event.hazard_category === 'allergen' && event.allergens && event.allergens.length) {
      return `Undeclared ${formatAllergenList(event.allergens)}`;
    }
    return null;
  }
  return parts.join(' · ');
}

/** Build the article body copy from validated fields (deterministic template). */
function buildStoryText(event, products = []) {
  const paragraphs = [];

  const what = [];
  const subject = event.product_name || event.product_description || 'A food product';
  if (event.event_kind === 'outbreak') {
    what.push(`The FDA is investigating a ${event.organism ? `${event.organism} ` : ''}outbreak${event.product_name ? ` linked to ${event.product_name}` : ''}.`);
  } else {
    const company = event.company ? `${event.company} ` : '';
    const reason = event.hazard_name
      ? (event.hazard_category === 'allergen' ? `because it may contain ${lcFirst(event.hazard_name.replace(/^Undeclared /i, 'undeclared '))}` : `due to possible ${event.hazard_name} contamination`)
      : (event.recall_reason_text ? `— ${event.recall_reason_text}` : 'over a safety concern');
    what.push(`${company}${company ? 'is recalling' : `${subject} is being recalled`}${company ? ` ${lcFirst(subject)}` : ''} ${reason}.`);
  }
  paragraphs.push(what.join(' '));

  if (typeof event.illnesses === 'number') {
    const metricBits = [`${event.illnesses.toLocaleString('en-US')} illnesses`];
    if (typeof event.hospitalizations === 'number') metricBits.push(`${event.hospitalizations.toLocaleString('en-US')} hospitalizations`);
    if (typeof event.deaths === 'number') metricBits.push(`${event.deaths.toLocaleString('en-US')} deaths`);
    paragraphs.push(`FDA reports ${metricBits.join(', ')}${event.case_states && event.case_states.length ? ` across ${event.case_states.length} state${event.case_states.length > 1 ? 's' : ''}` : ''}.`);
  }

  if (event.distribution_text) {
    paragraphs.push(`Distribution: ${event.distribution_text}`);
  } else if (event.geographic_scope === 'nationwide') {
    paragraphs.push('The product was distributed nationwide, according to FDA.');
  }

  if (event.public_action) {
    paragraphs.push(`What to do: ${event.public_action}.${event.recommendations && event.recommendations.length ? ` ${event.recommendations[0]}` : ''}`);
  } else if (event.recommendations && event.recommendations.length) {
    paragraphs.push(`What to do: ${event.recommendations[0]}`);
  }

  if (products.length > 1) {
    paragraphs.push(`${products.length} product variants are affected. See the affected-products table for UPCs, lots, and dates.`);
  }

  paragraphs.push('Details are drawn from the official FDA announcement linked below.');
  return paragraphs.join('\n\n');
}

function lcFirst(s) {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function numOrNull(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Create or update the stable website post for a published event.
 * Returns { postId, created }.
 */
async function publishPost(event, { products = [], hasMapData = false, logger = console } = {}) {
  const store = getPostStore();
  const postId = postIdForEvent(event);
  const compact = buildCompactSummary(event, { productCount: products.length, hasMapData });

  const images = Array.isArray(event.images) ? event.images : [];
  const hero = images.find((i) => i.role === 'product_photo')
    || images.find((i) => i.role === 'page_image')
    || images.find((i) => i.role === 'pathogen_image')
    || images[0]
    || null;
  const heroUrl = hero ? absolutize(hero.url) : null;
  const secondary = images
    .filter((i) => i !== hero)
    .map((i) => absolutize(i.url))
    .filter(Boolean);

  const story = buildStoryText(event, products);
  const existing = await readPost(store, postId);

  const post = {
    ...(existing || {}),
    id: postId,
    title: event.display_title || event.title,
    story,
    text: story,
    summary: event.short_dek || null,
    dek: event.short_dek || null,
    primary_image_url: heroUrl,
    image: heroUrl,
    image_url: heroUrl,
    images: secondary,
    secondary_images: secondary,
    image_caption: hero ? hero.caption : null,
    image_credit: hero ? (hero.credit || 'FDA') : null,
    link: event.source_url,
    url: event.source_url,
    source_url: event.source_url,
    source_urls: (event.source_links || []).map((l) => l.url).filter(Boolean),
    datePosted: existing ? existing.datePosted : (event.fda_publish_date || new Date().toISOString()),
    createdAt: existing ? existing.createdAt : (event.fda_publish_date || new Date().toISOString()),
    created_at: existing ? existing.created_at : (event.fda_publish_date || new Date().toISOString()),
    updated_at: event.source_updated_at || new Date().toISOString(),
    category: 'Food Safety',
    source: 'FDA',
    event_type: eventTypeForEvent(event),
    eventId: event.canonical_key,
    severity: event.severity,
    tags: buildTags(event),
    food_safety_summary: compact,
    food_safety_event_id: event.id,
    assets: {
      ...((existing && existing.assets) || {}),
      food_safety: {
        event_id: event.id,
        update_number: event.update_number || 0,
      },
    },
  };

  await writePost(store, postId, post);
  if (!existing) await addToIndex(store, postId);
  logger.info && logger.info(`[food-safety publish] ${existing ? 'updated' : 'created'} post ${postId}`);
  return { postId, created: !existing };
}

function absolutize(url) {
  if (!url) return null;
  if (url.startsWith('/')) {
    const base = process.env.URL || 'https://noteworthynews.co';
    return `${base}${url}`;
  }
  return url;
}

function buildTags(event) {
  const tags = ['food-safety', event.event_kind];
  if (event.organism) tags.push(event.organism.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (event.allergens) tags.push(...event.allergens.map((a) => `allergen-${a.replace(/\s+/g, '-')}`));
  if (event.geographic_scope && event.geographic_scope !== 'unknown') tags.push(event.geographic_scope);
  if ((event.severity || 0) >= 4) tags.push('breaking');
  return tags.slice(0, 12);
}

/**
 * Write the concise generic verified_events summary row (engine monitoring +
 * cross-event features). Compact only — no product rows or raw documents.
 */
async function upsertVerifiedEvent(event, { logger = console } = {}) {
  const canonicalId = event.canonical_key;
  const statusMap = {
    new: 'active', active: 'active', ongoing: 'active', updated: 'update',
    expanded: 'update', ended: 'resolved', terminated: 'resolved', unknown: 'active',
  };
  const row = {
    canonical_id: canonicalId,
    engine: 'fda',
    event_type: eventTypeForEvent(event),
    severity: event.severity || 1,
    title: (event.display_title || event.title || 'FDA food safety event').slice(0, 300),
    summary: (event.short_dek || '').slice(0, 500) || null,
    location_display: buildGeographyLabel(event),
    country_code: 'US',
    source_name: 'FDA',
    source_url: event.source_url || 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
    published_at: event.fda_publish_date || null,
    updated_at_source: event.source_updated_at || null,
    fetched_at: new Date().toISOString(),
    status: statusMap[event.status] || 'active',
    tags: buildTags(event),
    image_url: firstImageUrl(event),
    assets: {
      food_safety_event_id: event.id,
      event_kind: event.event_kind,
      hazard: event.hazard_name || null,
      public_action: event.public_action || null,
      update_number: event.update_number || 0,
    },
  };

  const supabase = getSupabase();
  const { data: existing, error: selErr } = await supabase
    .from('verified_events')
    .select('id')
    .eq('canonical_id', canonicalId)
    .maybeSingle();
  if (selErr) {
    logger.warn && logger.warn(`[food-safety publish] verified_events select failed: ${selErr.message}`);
    return null;
  }
  if (existing) {
    const { error } = await supabase.from('verified_events').update(row).eq('canonical_id', canonicalId);
    if (error) logger.warn && logger.warn(`[food-safety publish] verified_events update failed: ${error.message}`);
    return existing.id;
  }
  const { data, error } = await supabase.from('verified_events').insert(row).select('id').single();
  if (error) {
    logger.warn && logger.warn(`[food-safety publish] verified_events insert failed: ${error.message}`);
    return null;
  }
  return data ? data.id : null;
}

function firstImageUrl(event) {
  const images = Array.isArray(event.images) ? event.images : [];
  const hero = images.find((i) => i.role === 'product_photo') || images[0];
  return hero ? absolutize(hero.url) : null;
}

module.exports = {
  postIdForEvent,
  eventTypeForEvent,
  buildCompactSummary,
  buildGeographyLabel,
  buildMetricSummary,
  buildStoryText,
  publishPost,
  upsertVerifiedEvent,
  buildTags,
};
