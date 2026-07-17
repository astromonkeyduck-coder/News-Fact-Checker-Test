/**
 * Product image extraction, ranking, safe download, optimization, and
 * storage for food-safety events.
 *
 * Ranking (highest first):
 *   1. Exact product/package photograph (recall photo gallery)
 *   2. Group photograph of variants
 *   3. Label images
 *   4. Retail display
 *   5. Official distribution graphic
 *   6. Official pathogen image (outbreaks without product)
 *   7. none → caller falls back to neutral placeholder
 *
 * Never uses: FDA seal, agency/company logos, generic theme assets, maps as
 * hero when a product image exists, third-party app screenshots, AI images.
 */

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { safeFetchWithRetry, FetchError } = require('./httpClient');

const MEDIA_STORE = 'post-media'; // existing store used for post media blobs
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 120; // reject tracking pixels / tiny icons
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const LOGO_OR_CHROME_RE = /(logo|fda_logo|seal|icon-|us_flag|favicon|sprite|badge|social|twitter|facebook)/i;
const MAP_RE = /(map|case.?count.?map)/i;
const PATHOGEN_RE = /(cyclospora|salmonella|listeria|e.?coli|bacteria|micrograph|organism|pathogen)/i;

/**
 * Rank image candidates parsed from a canonical FDA page.
 * Returns candidates sorted best-first with a `role` annotation. Excluded
 * images are dropped.
 */
function rankImageCandidates(images, { eventKind = 'recall' } = {}) {
  const ranked = [];
  for (const img of images || []) {
    if (!img || !img.src) continue;
    const url = img.fullSizeUrl || img.src;
    const hay = `${url} ${img.alt || ''}`;

    if (img.isThemeAsset) continue;
    if (LOGO_OR_CHROME_RE.test(hay)) continue;
    if (/\.svg(\?|$)/i.test(url)) continue;

    let score = 0;
    let role = 'other';
    if (img.isRecallPhoto) {
      score = 100;
      role = 'product_photo';
    } else if (MAP_RE.test(hay)) {
      score = eventKind === 'outbreak' ? 20 : 10;
      role = 'official_map';
    } else if (PATHOGEN_RE.test(hay)) {
      score = eventKind === 'outbreak' ? 40 : 15;
      role = 'pathogen_image';
    } else if (img.isFile) {
      // Editorial /files/ image on the page; may be a product or a graphic
      score = 60;
      role = 'page_image';
    } else {
      continue;
    }

    ranked.push({
      sourceUrl: url,
      sourcePage: img.sourcePage || null,
      alt: img.alt || null,
      role,
      score,
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  // The hero must never be a map when any product image exists
  const hasProduct = ranked.some((r) => r.role === 'product_photo' || r.role === 'page_image');
  if (hasProduct) {
    return ranked.filter((r) => r.role !== 'official_map').concat(ranked.filter((r) => r.role === 'official_map'));
  }
  return ranked;
}

/**
 * Download, validate, optimize, and store one image.
 * Returns { url, blobKey, contentType, width, height, bytes, hash } or null
 * on any failure (image failures must never block an alert).
 */
async function processAndStoreImage(candidate, { eventId, index = 0, logger = console } = {}) {
  try {
    const res = await safeFetchWithRetry(candidate.sourceUrl, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 20000,
      accept: 'image/*',
    });
    const contentType = (res.contentType || '').split(';')[0].trim();
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw new FetchError(`Disallowed image content-type: ${contentType}`, { permanent: true });
    }

    const buffer = res.body;
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 20);

    // Decode + optimize with sharp (existing repo media infrastructure)
    let sharp;
    try {
      sharp = require('sharp'); // eslint-disable-line global-require
    } catch (_) {
      sharp = null;
    }

    let width = null;
    let height = null;
    let outBuffer = buffer;
    let outType = contentType;

    if (sharp) {
      const image = sharp(buffer, { failOn: 'error' });
      const meta = await image.metadata();
      width = meta.width || null;
      height = meta.height || null;
      if (width && height && (width < MIN_DIMENSION || height < MIN_DIMENSION)) {
        logger.info && logger.info(`[food-safety media] rejecting tiny image ${width}x${height}`);
        return null;
      }
      // Preserve aspect ratio; constrain to sane web size; webp output
      outBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      outType = 'image/webp';
      const outMeta = await sharp(outBuffer).metadata();
      width = outMeta.width || width;
      height = outMeta.height || height;
    }

    const blobKey = `food-safety/${eventId}/${hash}-${index}.${outType === 'image/webp' ? 'webp' : 'img'}`;
    const store = getMediaStore();
    if (!store) {
      // No blob storage available: fall back to referencing the FDA URL
      // directly (safe hotlink of official material with attribution).
      return {
        url: candidate.sourceUrl,
        blobKey: null,
        contentType,
        width,
        height,
        bytes: buffer.length,
        hash,
        stored: false,
      };
    }
    await store.set(blobKey, outBuffer, { metadata: { contentType: outType } });

    return {
      // Served by the existing get-uploaded-image function (post-media store)
      url: `/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(blobKey)}`,
      blobKey,
      contentType: outType,
      width,
      height,
      bytes: outBuffer.length,
      hash,
      stored: true,
    };
  } catch (e) {
    logger.warn && logger.warn(`[food-safety media] image failed: ${candidate.sourceUrl}: ${e.message}`);
    return null;
  }
}

function getMediaStore() {
  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    if (siteID && token) return getStore({ name: MEDIA_STORE, siteID, token });
    return getStore({ name: MEDIA_STORE });
  } catch (_) {
    return null;
  }
}

/**
 * Build accurate alt text from validated event context.
 */
function buildAltText(candidate, event) {
  if (candidate.alt && candidate.alt.length > 8 && !LOGO_OR_CHROME_RE.test(candidate.alt)) {
    return candidate.alt.slice(0, 240);
  }
  const parts = [];
  if (event.brands && event.brands.length) parts.push(event.brands[0]);
  if (event.product_name || event.product_description) {
    parts.push(event.product_name || event.product_description);
  }
  if (candidate.role === 'product_photo') {
    return `Package of recalled ${parts.join(' ') || 'product'} (photo: FDA)`.slice(0, 240);
  }
  if (candidate.role === 'pathogen_image') {
    return `${event.organism || 'Pathogen'} image provided by FDA`.slice(0, 240);
  }
  if (candidate.role === 'official_map') {
    return 'Official case-count map provided by FDA/CDC';
  }
  return `${parts.join(' ') || 'FDA food safety alert'} (source: FDA)`.slice(0, 240);
}

/**
 * Process the ranked candidates for an event: hero first, then up to
 * `maxImages` gallery images. Returns image records (public-safe shape).
 */
async function buildEventImages(rankedCandidates, event, { maxImages = 5, logger = console } = {}) {
  const results = [];
  const seenHashes = new Set();
  for (let i = 0; i < rankedCandidates.length && results.length < maxImages; i += 1) {
    const candidate = rankedCandidates[i];
    const processed = await processAndStoreImage(candidate, {
      eventId: event.id || 'pending',
      index: i,
      logger,
    });
    if (!processed) continue;
    if (seenHashes.has(processed.hash)) continue;
    seenHashes.add(processed.hash);
    results.push({
      url: processed.url,
      sourceUrl: candidate.sourceUrl,
      sourcePage: candidate.sourcePage,
      alt: buildAltText(candidate, event),
      caption: candidate.alt || null,
      credit: 'FDA',
      role: candidate.role,
      width: processed.width,
      height: processed.height,
      hash: processed.hash,
      stored: processed.stored,
    });
  }
  return results;
}

module.exports = {
  rankImageCandidates,
  processAndStoreImage,
  buildEventImages,
  buildAltText,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
};
