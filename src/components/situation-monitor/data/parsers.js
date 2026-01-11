/**
 * RSS/XML Parsers
 */

/**
 * Parse RSS XML string
 */
export function parseRSS(xmlString) {
  const items = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('RSS parsing error: ' + parserError.textContent);
  }

  const itemElements = doc.querySelectorAll('item');
  
  itemElements.forEach(item => {
    const title = item.querySelector('title')?.textContent?.trim() || '';
    const link = item.querySelector('link')?.textContent?.trim() || 
                 item.querySelector('guid')?.textContent?.trim() || '';
    const description = item.querySelector('description')?.textContent?.trim() || '';
    const pubDate = item.querySelector('pubDate')?.textContent?.trim() || 
                    item.querySelector('dc\\:date')?.textContent?.trim() || '';
    const guid = item.querySelector('guid')?.textContent?.trim() || link;

    // Strip HTML from description
    const cleanDescription = stripHTML(description);

    if (title || link) {
      items.push({
        title: escapeHtml(title),
        link: escapeHtml(link),
        description: escapeHtml(cleanDescription),
        pubDate,
        guid,
        timestamp: parseDate(pubDate)
      });
    }
  });

  return items;
}

/**
 * Strip HTML tags
 */
function stripHTML(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Parse date string to timestamp
 */
function parseDate(dateString) {
  if (!dateString) return Date.now();
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
}

/**
 * Parse GeoJSON (for earthquakes)
 */
export function parseGeoJSON(geoJson) {
  if (!geoJson || !geoJson.features) {
    return [];
  }

  return geoJson.features.map(feature => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [];
    
    return {
      id: feature.id || `${props.time || Date.now()}_${coords[0]}_${coords[1]}`,
      canonical_id: props.canonical_id || null,
      magnitude: props.mag || 0,
      place: props.place || 'Unknown',
      time: props.time || Date.now(),
      updated: props.updated || Date.now(),
      url: props.url || '',
      lon: coords[0],
      lat: coords[1],
      depth: coords[2] || 0,
      // Include additional verified event data
      severity: props.severity || 1,
      image_url: props.image_url || null,
      video_url: props.video_url || null,
      assets: props.assets || {},
      impact_assessment: props.impact_assessment || null,
      tsunami_risk: props.tsunami_risk || null,
      aftershock_forecast: props.aftershock_forecast || null,
      anomaly_detection: props.anomaly_detection || null,
      title: props.title || null,
      summary: props.summary || null
    };
  });
}

/**
 * Parse weather alerts GeoJSON
 */
export function parseWeatherAlerts(geoJson) {
  if (!geoJson || !geoJson.features) {
    return [];
  }

  return geoJson.features.map(feature => {
    const props = feature.properties || {};
    
    return {
      id: feature.id || props.id || `alert_${Date.now()}_${Math.random()}`,
      event: props.event || 'Unknown',
      headline: props.headline || '',
      description: props.description || '',
      severity: props.severity || 'unknown',
      urgency: props.urgency || 'unknown',
      areas: props.areaDesc || '',
      effective: props.effective || '',
      expires: props.expires || '',
      geometry: feature.geometry
    };
  });
}
