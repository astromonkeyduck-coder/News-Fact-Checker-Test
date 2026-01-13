/**
 * Camera Deduplication - Removes duplicate cameras from merged results
 */

/**
 * Deduplicate cameras by provider+id and by location similarity
 * @param {Camera[]} cameras - Array of cameras
 * @returns {Camera[]} Deduplicated array
 */
function dedupeCameras(cameras) {
  if (!Array.isArray(cameras) || cameras.length === 0) return [];
  
  // First pass: dedupe by exact id
  const byId = new Map();
  for (const cam of cameras) {
    if (!cam || !cam.id) continue;
    const existing = byId.get(cam.id);
    if (!existing) {
      byId.set(cam.id, cam);
    } else {
      // Prefer camera with more complete data
      if (getCompletenessScore(cam) > getCompletenessScore(existing)) {
        byId.set(cam.id, cam);
      }
    }
  }
  
  const uniqueById = Array.from(byId.values());
  
  // Second pass: dedupe by location similarity (within 50m)
  const DEDUPE_DISTANCE_M = 50;
  const deduped = [];
  const processed = new Set();
  
  for (let i = 0; i < uniqueById.length; i++) {
    if (processed.has(i)) continue;
    
    const cam = uniqueById[i];
    const group = [cam];
    processed.add(i);
    
    // Find nearby cameras (same provider or different)
    for (let j = i + 1; j < uniqueById.length; j++) {
      if (processed.has(j)) continue;
      
      const other = uniqueById[j];
      const distance = haversineDistance(
        cam.lat, cam.lon,
        other.lat, other.lon
      );
      
      // If within 50m and similar title, consider duplicate
      if (distance < DEDUPE_DISTANCE_M && areTitlesSimilar(cam.title, other.title)) {
        group.push(other);
        processed.add(j);
      }
    }
    
    // Pick best camera from group
    if (group.length === 1) {
      deduped.push(group[0]);
    } else {
      // Sort by completeness, prefer cameras with streams
      group.sort((a, b) => {
        const scoreA = getCompletenessScore(a) + (a.media.streamUrl ? 10 : 0);
        const scoreB = getCompletenessScore(b) + (b.media.streamUrl ? 10 : 0);
        return scoreB - scoreA;
      });
      deduped.push(group[0]);
    }
  }
  
  return deduped;
}

/**
 * Calculate completeness score for a camera
 * @param {Camera} cam
 * @returns {number}
 */
function getCompletenessScore(cam) {
  let score = 0;
  if (cam.title) score += 1;
  if (cam.description) score += 1;
  if (cam.city) score += 1;
  if (cam.road) score += 1;
  if (cam.media.snapshotUrl) score += 2;
  if (cam.media.streamUrl) score += 3;
  if (cam.media.providerPageUrl) score += 1;
  if (cam.status === 'online') score += 1;
  return score;
}

/**
 * Check if two titles are similar (fuzzy match)
 * @param {string} title1
 * @param {string} title2
 * @returns {boolean}
 */
function areTitlesSimilar(title1, title2) {
  if (!title1 || !title2) return false;
  
  const t1 = title1.toLowerCase().trim();
  const t2 = title2.toLowerCase().trim();
  
  // Exact match
  if (t1 === t2) return true;
  
  // One contains the other
  if (t1.includes(t2) || t2.includes(t1)) return true;
  
  // Word overlap (at least 2 words match)
  const words1 = new Set(t1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(t2.split(/\s+/).filter(w => w.length > 2));
  const overlap = [...words1].filter(w => words2.has(w));
  
  return overlap.length >= 2;
}

/**
 * Calculate distance between two lat/lon points (Haversine formula)
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  dedupeCameras
};
