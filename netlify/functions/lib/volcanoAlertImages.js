/**
 * Static hero images for volcano alerts when a curated photo is preferred
 * over the generated Mapbox template.
 */

const VOLCANO_ALERT_IMAGES = [
  { match: 'kilauea', path: '/assets/alerts/kilauea-volcano.jpg' },
  { match: 'great sitkin', path: '/assets/alerts/great-sitkin-volcano.jpg' },
];

function matchVolcanoImage(text) {
  const haystack = String(text || '').toLowerCase();
  for (const { match, path } of VOLCANO_ALERT_IMAGES) {
    if (haystack.includes(match)) return path;
  }
  return null;
}

function getVolcanoAlertImageUrl(volcanoName) {
  return matchVolcanoImage(volcanoName);
}

function getVolcanoAlertFallbackFromPost(post) {
  if (!post) return null;
  const cat = String(post.category || '').toLowerCase();
  const title = String(post.title || post.text || post.story || '').toLowerCase();
  if (!cat.includes('volcano') && !title.includes('volcano')) return null;
  return matchVolcanoImage(title);
}

module.exports = {
  VOLCANO_ALERT_IMAGES,
  getVolcanoAlertImageUrl,
  getVolcanoAlertFallbackFromPost,
  matchVolcanoImage,
};
