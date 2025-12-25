/**
 * CIA Mission Globe - CDN Version (No build step required)
 * Uses CDN links for globe.gl and three.js
 */

// Load dependencies from CDN
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load CSS
function loadCSS(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

class CiaMissionGlobe {
  constructor(containerId = 'cia-globe-container') {
    this.containerId = containerId;
    this.globeInstance = null;
    this.animationFrameId = null;
    this.activeOp = null;
    this.t = 0;
    this.coveragePoints = [];
    this.locationCacheKey = 'globe-location-cache-v1';
    this.locationCache = {};
    this.geocodePromises = {};
    this.cityMapCache = null;
    this.countryMapCache = null;
    this.extraLocationData = null;
    this.totalPosts = 0;
    this.rootEl = null;
    this.loadingEl = null;
    this.allPosts = []; // Store all posts for searching
    this.searchQuery = '';
    this.filteredPoints = null; // null = show all, array = filtered results
    
    // Filter state
    this.timeRange = '24h'; // '24h', '7d', '30d', 'all'
    this.selectedCategory = 'all'; // 'all', 'conflict', 'disaster', 'aviation', 'crime', 'politics'
    this.breakingOnly = false;
    this.countryData = new Map(); // Map of country -> { count, posts, coordinates }
    this.activeCountry = null; // Currently selected country
    
    this.loadLocationCache();
    
    this.loadDependencies().then(() => this.init());
  }

  loadLocationCache() {
    try {
      const cached = localStorage.getItem(this.locationCacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data && typeof data === 'object') {
          this.locationCache = data;
        }
      }
    } catch (err) {
      console.warn('[Globe] Failed to load location cache:', err);
    }
  }

  saveLocationCache() {
    try {
      localStorage.setItem(this.locationCacheKey, JSON.stringify(this.locationCache));
    } catch (err) {
      // Ignore quota exceeded errors
    }
  }

  async loadDependencies() {
    // Suppress Three.js deprecation warnings during loading
    const originalWarn = console.warn;
    let warnSuppressed = false;
    
    const suppressWarnings = function(...args) {
      const message = args[0] ? String(args[0]) : '';
      // Suppress deprecation warnings about build/three.js
      if (message.includes('build/three.js') || message.includes('build/three.min.js') || 
          message.includes('deprecated with r150') || message.includes('will be removed with r160')) {
        return; // Suppress this warning
      }
      // Suppress "Multiple instances of Three.js" warning
      if (message.includes('Multiple instances of Three.js')) {
        return; // Suppress this warning
      }
      // Pass through all other warnings
      originalWarn.apply(console, args);
    };
    
    // Temporarily override console.warn during script loading
    console.warn = suppressWarnings;
    warnSuppressed = true;
    
    try {
      // Load Three.js first (required by globe.gl)
      // Check if Three.js is already loaded to avoid multiple instances
      if (typeof THREE === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
      } else {
        console.log('[Globe] Three.js already loaded, skipping');
      }
      
      // Load globe.gl
      await loadScript('https://cdn.jsdelivr.net/npm/globe.gl@2.32.0/dist/globe.gl.min.js');
    } finally {
      // Always restore console.warn after loading completes
      if (warnSuppressed) {
        // Wait a bit for any delayed warnings from the scripts
        setTimeout(() => {
          console.warn = originalWarn;
          warnSuppressed = false;
        }, 1000);
      }
    }
    
    // Load CSS
    loadCSS('/src/styles/ciaGlobe.css');
    
    // Extract locations from posts
    const rawCoveragePoints = await this.extractLocationsFromPosts();
    this.totalPosts = rawCoveragePoints.length;
    this.coveragePoints = rawCoveragePoints.length > 0
      ? this.aggregateCoveragePoints(rawCoveragePoints)
      : [];
    this.statsLoaded = this.coveragePoints.length > 0;
    
    if (!this.statsLoaded) {
      // Fallback to default points if no posts found
      const fallbackPoints = [
        { id: "nyc-incident", lat: 40.7128, lng: -74.0060, location: "New York, USA", headline: "High-rise fire near Midtown", timestamp: "2025-11-21T18:32:00Z" },
        { id: "kyiv-strike", lat: 50.4501, lng: 30.5234, location: "Kyiv, Ukraine", headline: "Explosions reported in central Kyiv", timestamp: "2025-11-23T03:10:00Z" },
        { id: "buenos-aires-blast", lat: -34.6037, lng: -58.3816, location: "Buenos Aires, Argentina", headline: "Industrial-area explosion in Ezeiza", timestamp: "2025-11-20T14:05:00Z" },
        { id: "la-fire", lat: 34.0522, lng: -118.2437, location: "Los Angeles, USA", headline: "Large structure fire downtown", timestamp: "2025-11-19T09:47:00Z" }
      ];
      this.totalPosts = fallbackPoints.length;
      this.coveragePoints = this.aggregateCoveragePoints(fallbackPoints);
    }
    
    this.activeOp = this.coveragePoints[0] || null;
  }

  // Get coordinates for city, state, or country
  async getLocationCoordinates(locationName) {
    if (!locationName) return null;
    const normalized = (locationName || '').trim();
    if (!normalized) return null;
    const normalizedKey = normalized.toLowerCase();
    
    // Check cache first
    if (this.locationCache[normalizedKey]) {
      return this.locationCache[normalizedKey];
    }
    
    // First try city/state mapping
    const cityCoords = this.getCityCoordinates(normalized);
    if (cityCoords) {
      this.locationCache[normalizedKey] = cityCoords;
      this.saveLocationCache();
      return cityCoords;
    }
    
    // Then try country mapping
    const countryCoords = this.getCountryCoordinates(normalized);
    if (countryCoords) {
      this.locationCache[normalizedKey] = countryCoords;
      this.saveLocationCache();
      return countryCoords;
    }
    
    // Fallback to geocoding for previously unseen locations
    return await this.lookupGeocodedLocation(normalized);
  }

  getInitialPointOfView(isMobile = false) {
    // Focus on North America with a close starting zoom
    return {
      lat: 25,
      lng: -95,
      altitude: isMobile ? 1.35 : 1.1
    };
  }

  getLocationKey(point) {
    if (!point) return '';
    if (point.location) {
      return point.location.toLowerCase();
    }
    const lat = typeof point.lat === 'number' ? point.lat.toFixed(2) : '0';
    const lng = typeof point.lng === 'number' ? point.lng.toFixed(2) : '0';
    return `${lat}|${lng}`;
  }

  createPostSummary(point) {
    return {
      id: point.postId || point.id,
      headline: point.headline || `Coverage from ${point.location || 'Unknown'}`,
      timestamp: point.timestamp,
      postLink: this.resolvePostLink(point)
    };
  }

  aggregateCoveragePoints(points = []) {
    const grouped = new Map();
    
    points.forEach((point) => {
      const key = this.getLocationKey(point);
      if (!grouped.has(key)) {
        grouped.set(key, {
          ...point,
          lat: point.lat,
          lng: point.lng,
          posts: [this.createPostSummary(point)],
          intensity: 1
        });
      } else {
        const existing = grouped.get(key);
        existing.posts.push(this.createPostSummary(point));
        existing.intensity = existing.posts.length;
        // Average lat/lng to keep cluster centered
        const weight = existing.posts.length;
        existing.lat = ((existing.lat * (weight - 1)) + point.lat) / weight;
        existing.lng = ((existing.lng * (weight - 1)) + point.lng) / weight;
      }
    });
    
    return Array.from(grouped.values()).map((group, index) => {
      group.posts.sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });
      const latest = group.posts[0];
      return {
        ...group,
        id: group.id || `coverage-${index}`,
        headline: latest?.headline || group.headline,
        timestamp: latest?.timestamp || group.timestamp,
        latestTimestamp: latest?.timestamp,
        posts: group.posts
      };
    });
  }

  resolvePostLink(post) {
    if (!post) return null;
    const directLink = post.postLink || post.link || '';
    if (directLink && directLink.trim().length > 0) {
      return directLink.startsWith('http') ? directLink : `https://x.com/newsnoteworthy/status/${directLink}`;
    }
    const id = post.postId || post.id;
    return id ? `https://x.com/newsnoteworthy/status/${id}` : null;
  }

  getPointWeight(point) {
    if (!point) return 1;
    if (point.intensity) return Math.max(1, point.intensity);
    if (Array.isArray(point.posts)) return Math.max(1, point.posts.length);
    return 1;
  }

  getPointBaseRadius(point, isMobile = false) {
    const weight = this.getPointWeight(point);
    const scale = Math.min(1.5, Math.log2(weight + 1));
    const base = isMobile ? 0.25 : 0.35;
    const multiplier = isMobile ? 0.08 : 0.12;
    return base + scale * multiplier;
  }

  getPointBaseAltitude(point, isMobile = false) {
    const weight = this.getPointWeight(point);
    const scale = Math.min(1.5, Math.log2(weight + 1));
    const base = isMobile ? 0.015 : 0.02;
    return base + scale * 0.012;
  }

  getPointPhase(point) {
    const lat = typeof point.lat === 'number' ? point.lat : 0;
    const lng = typeof point.lng === 'number' ? point.lng : 0;
    return (lat + lng) * 0.05;
  }

  getPointGlowColor(point, pulse = 0.5) {
    const weight = this.getPointWeight(point);
    const red = 60 + Math.min(50, weight * 6);
    const green = 150 + Math.min(90, weight * 10) + pulse * 40;
    const blue = 255;
    const alpha = Math.min(1, 0.45 + Math.min(0.4, weight * 0.08) + pulse * 0.25);
    return `rgba(${Math.round(red)}, ${Math.round(Math.min(255, green))}, ${blue}, ${alpha})`;
  }

  getPointLabel(point, isMobile = false) {
    const count = this.getPointWeight(point);
    const label = `${point.location || 'Unknown'} • ${count} post${count === 1 ? '' : 's'}`;
    if (isMobile) {
      return label;
    }
    const latest = point.headline || point.posts?.[0]?.headline;
    return latest ? `${label}\n${latest}` : label;
  }

  updateLoadingMessage(message) {
    if (!this.loadingEl || !message) return;
    const msgEl = this.loadingEl.querySelector('.cia-globe-loading-message');
    if (msgEl) {
      msgEl.textContent = message;
    }
  }

  setLoadingState(isLoading, message = null) {
    if (!this.rootEl || !this.loadingEl) return;
    if (message) {
      this.updateLoadingMessage(message);
    }
    this.rootEl.classList.toggle('is-loading', !!isLoading);
  }

  async lookupGeocodedLocation(locationName) {
    const normalizedKey = locationName.toLowerCase();
    
    // Avoid duplicate geocode requests
    if (this.geocodePromises[normalizedKey]) {
      return this.geocodePromises[normalizedKey];
    }
    
    const geocodePromise = this.geocodeLocation(locationName)
      .then(coords => {
        if (coords) {
          this.locationCache[normalizedKey] = coords;
          this.saveLocationCache();
        }
        return coords;
      })
      .catch(err => {
        console.warn('[Globe] Geocoding failed for', locationName, err);
        return null;
      })
      .finally(() => {
        delete this.geocodePromises[normalizedKey];
      });
    
    this.geocodePromises[normalizedKey] = geocodePromise;
    return geocodePromise;
  }

  async geocodeLocation(locationName) {
    try {
      const url = `/.netlify/functions/geocode-proxy?q=${encodeURIComponent(locationName)}`;
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.warn('[Globe] Geocoding error:', response.status, response.statusText, locationName);
        return null;
      }
      
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const { lat, lon } = data[0];
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lon);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          console.log(`[Globe] Geocoded ${locationName} -> ${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`);
          return { lat: parsedLat, lng: parsedLng };
        }
      }
    } catch (err) {
      console.warn('[Globe] Geocoding fetch failed for', locationName, err);
    }
    
    return null;
  }

  // Get all city map keys for searching
  getAllCityKeys() {
    return Object.keys(this.getCityMap());
  }

  // City and state name to coordinates mapping
  getCityMap() {
    if (this.cityMapCache) return this.cityMapCache;
    this.cityMapCache = {
      // US Cities
      'Albuquerque': { lat: 35.0844, lng: -106.6504 },
      'Albuquerque, N.M': { lat: 35.0844, lng: -106.6504 },
      'Albuquerque, New Mexico': { lat: 35.0844, lng: -106.6504 },
      'Anchorage': { lat: 61.2181, lng: -149.9003 },
      'Anchorage, Alaska': { lat: 61.2181, lng: -149.9003 },
      'Annapolis': { lat: 38.9784, lng: -76.4922 },
      'Annapolis, Maryland': { lat: 38.9784, lng: -76.4922 },
      'Atlanta': { lat: 33.7490, lng: -84.3880 },
      'Atlanta, Georgia': { lat: 33.7490, lng: -84.3880 },
      'Austin': { lat: 30.2672, lng: -97.7431 },
      'Austin, Texas': { lat: 30.2672, lng: -97.7431 },
      'Baltimore': { lat: 39.2904, lng: -76.6122 },
      'Baltimore, Maryland': { lat: 39.2904, lng: -76.6122 },
      'Baton Rouge': { lat: 30.4515, lng: -91.1871 },
      'Baton Rouge, Louisiana': { lat: 30.4515, lng: -91.1871 },
      'Boulder': { lat: 40.0150, lng: -105.2705 },
      'Boulder, Colorado': { lat: 40.0150, lng: -105.2705 },
      'Chicago': { lat: 41.8781, lng: -87.6298 },
      'Chicago, Illinois': { lat: 41.8781, lng: -87.6298 },
      'Cincinnati': { lat: 39.1031, lng: -84.5120 },
      'Cincinnati, Ohio': { lat: 39.1031, lng: -84.5120 },
      'Cleveland': { lat: 41.4993, lng: -81.6944 },
      'Cleveland, Ohio': { lat: 41.4993, lng: -81.6944 },
      'Dallas': { lat: 32.7767, lng: -96.7970 },
      'Dallas, Texas': { lat: 32.7767, lng: -96.7970 },
      'Dallas, TX': { lat: 32.7767, lng: -96.7970 },
      'Denver': { lat: 39.7392, lng: -104.9903 },
      'Denver, Colorado': { lat: 39.7392, lng: -104.9903 },
      'Des Moines': { lat: 41.5868, lng: -93.6250 },
      'Des Moines, Iowa': { lat: 41.5868, lng: -93.6250 },
      'El Paso': { lat: 31.7619, lng: -106.4850 },
      'El Paso, Texas': { lat: 31.7619, lng: -106.4850 },
      'Fort Worth': { lat: 32.7555, lng: -97.3308 },
      'Fort Worth, Texas': { lat: 32.7555, lng: -97.3308 },
      'Houston': { lat: 29.7604, lng: -95.3698 },
      'Houston, Texas': { lat: 29.7604, lng: -95.3698 },
      'Las Vegas': { lat: 36.1699, lng: -115.1398 },
      'Las Vegas, Nevada': { lat: 36.1699, lng: -115.1398 },
      'Los Angeles': { lat: 34.0522, lng: -118.2437 },
      'Los Angeles, California': { lat: 34.0522, lng: -118.2437 },
      'Miami': { lat: 25.7617, lng: -80.1918 },
      'Miami, Florida': { lat: 25.7617, lng: -80.1918 },
      'Miami, FL': { lat: 25.7617, lng: -80.1918 },
      'New York': { lat: 40.7128, lng: -74.0060 },
      'New York City': { lat: 40.7128, lng: -74.0060 },
      'New York, NY': { lat: 40.7128, lng: -74.0060 },
      'New York City, New York': { lat: 40.7128, lng: -74.0060 },
      'Philadelphia': { lat: 39.9526, lng: -75.1652 },
      'Philadelphia, Pennsylvania': { lat: 39.9526, lng: -75.1652 },
      'Phoenix': { lat: 33.4484, lng: -112.0740 },
      'Phoenix, Arizona': { lat: 33.4484, lng: -112.0740 },
      'San Antonio': { lat: 29.4241, lng: -98.4936 },
      'San Antonio, Texas': { lat: 29.4241, lng: -98.4936 },
      'San Diego': { lat: 32.7157, lng: -117.1611 },
      'San Diego, California': { lat: 32.7157, lng: -117.1611 },
      'San Francisco': { lat: 37.7749, lng: -122.4194 },
      'San Francisco, California': { lat: 37.7749, lng: -122.4194 },
      'Seattle': { lat: 47.6062, lng: -122.3321 },
      'Seattle, Washington': { lat: 47.6062, lng: -122.3321 },
      // International Cities
      'Bangkok': { lat: 13.7563, lng: 100.5018 },
      'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
      'Bogotá': { lat: 4.7110, lng: -74.0721 },
      'Bogotá, Colombia': { lat: 4.7110, lng: -74.0721 },
      'Buenos Aires': { lat: -34.6037, lng: -58.3816 },
      'Buenos Aires, Argentina': { lat: -34.6037, lng: -58.3816 },
      'Dublin': { lat: 53.3498, lng: -6.2603 },
      'Dublin, Ireland': { lat: 53.3498, lng: -6.2603 },
      'Gaza': { lat: 31.3547, lng: 34.3088 },
      'Gaza, Palestine': { lat: 31.3547, lng: 34.3088 },
      'Istanbul': { lat: 41.0082, lng: 28.9784 },
      'Istanbul, Turkey': { lat: 41.0082, lng: 28.9784 },
      'Jakarta': { lat: -6.2088, lng: 106.8456 },
      'Jakarta, Indonesia': { lat: -6.2088, lng: 106.8456 },
      'Jerusalem': { lat: 31.7683, lng: 35.2137 },
      'Jerusalem, Israel': { lat: 31.7683, lng: 35.2137 },
      'Kyiv': { lat: 50.4501, lng: 30.5234 },
      'Kyiv, Ukraine': { lat: 50.4501, lng: 30.5234 },
      'London': { lat: 51.5074, lng: -0.1278 },
      'London, England': { lat: 51.5074, lng: -0.1278 },
      'Madrid': { lat: 40.4168, lng: -3.7038 },
      'Madrid, Spain': { lat: 40.4168, lng: -3.7038 },
      'Manila': { lat: 14.5995, lng: 120.9842 },
      'Manila, Philippines': { lat: 14.5995, lng: 120.9842 },
      'Mexico City': { lat: 19.4326, lng: -99.1332 },
      'Mexico City, Mexico': { lat: 19.4326, lng: -99.1332 },
      'Moscow': { lat: 55.7558, lng: 37.6173 },
      'Moscow, Russia': { lat: 55.7558, lng: 37.6173 },
      'Paris': { lat: 48.8566, lng: 2.3522 },
      'Paris, France': { lat: 48.8566, lng: 2.3522 },
      'Rome': { lat: 41.9028, lng: 12.4964 },
      'Rome, Italy': { lat: 41.9028, lng: 12.4964 },
      'Sydney': { lat: -33.8688, lng: 151.2093 },
      'Sydney, Australia': { lat: -33.8688, lng: 151.2093 },
      'Tehran': { lat: 35.6892, lng: 51.3890 },
      'Tehran, Iran': { lat: 35.6892, lng: 51.3890 },
      'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
      'Tel Aviv, Israel': { lat: 32.0853, lng: 34.7818 },
      // Additional US Cities
      'Alene, Idaho': { lat: 47.6730, lng: -116.7804 },
      'Anaconda, Montana': { lat: 46.1286, lng: -112.9428 },
      'Andersen County, South Carolina': { lat: 34.5200, lng: -82.6500 },
      'Athens, Georgia': { lat: 33.9519, lng: -83.3576 },
      'Athens, Ohio': { lat: 39.3292, lng: -82.1013 },
      'Auburn, Alabama': { lat: 32.6099, lng: -85.4808 },
      'Ballymena, Northern Ireland': { lat: 54.8636, lng: -6.2765 },
      'Balıkesir, Turkey': { lat: 39.6484, lng: 27.8826 },
      'Belgorod, Russia': { lat: 50.6107, lng: 36.5802 },
      'Bethesda, Maryland': { lat: 38.9847, lng: -77.0947 },
      'Black River, St. Elizabeth': { lat: 18.0167, lng: -77.8500 },
      'Bladensburg, Maryland': { lat: 38.9393, lng: -76.9339 },
      'Bosasso, Puntland': { lat: 11.2842, lng: 49.1816 },
      'Box Elder County, Utah': { lat: 41.5167, lng: -112.0500 },
      'Brevard County, Florida': { lat: 28.2644, lng: -80.6014 },
      'Broadview, IL': { lat: 41.8639, lng: -87.8534 },
      'Brooklyn Park, Minnesota': { lat: 45.0941, lng: -93.3563 },
      'Bucksnort, Tennessee': { lat: 35.8000, lng: -87.5000 },
      'Cadereyta Jiménez, Mexico': { lat: 25.5833, lng: -100.0000 },
      'Cambridgeshire, England': { lat: 52.2053, lng: 0.1218 },
      'Carbondale, Kansas': { lat: 37.2953, lng: -95.6900 },
      'Carlow, Ireland': { lat: 52.8361, lng: -6.9264 },
      'Catalonia, Spain': { lat: 41.5912, lng: 1.5209 },
      'Chapel Hill, North Carolina': { lat: 35.9132, lng: -79.0558 },
      'Charlottesville, Virginia': { lat: 38.0293, lng: -78.4767 },
      'Chattanooga, Tennessee': { lat: 35.0456, lng: -85.3097 },
      'Chino Hills, Southern California': { lat: 33.9898, lng: -117.7326 },
      'Chuluota, Florida': { lat: 28.6419, lng: -81.1234 },
      'Clayton, Missouri': { lat: 38.6420, lng: -90.3237 },
      'Clearwater, FL': { lat: 27.9659, lng: -82.8001 },
      'Clearwater, Florida': { lat: 27.9659, lng: -82.8001 },
      'Concord, North Carolina': { lat: 35.4088, lng: -80.5795 },
      'Copake, New York': { lat: 42.1037, lng: -73.5501 },
      'Cornella, Spain': { lat: 41.3572, lng: 2.0700 },
      'Cypress, Texas': { lat: 29.9691, lng: -95.6972 },
      'Danville, Virginia': { lat: 36.5860, lng: -79.3950 },
      'Davao, Philippines': { lat: 7.1907, lng: 125.4553 },
      'Daytona Beach, Florida': { lat: 29.2108, lng: -81.0228 },
      'East Palestine, Ohio': { lat: 40.8339, lng: -80.5403 },
      'Edinburgh, Scotland': { lat: 55.9533, lng: -3.1883 },
      'El Segundo, California': { lat: 33.9192, lng: -118.4165 },
      'Enterprise, Alabama': { lat: 31.3152, lng: -85.8552 },
      'Erie, Pennsylvania': { lat: 42.1292, lng: -80.0851 },
      'Escondido, California': { lat: 33.1192, lng: -117.0864 },
      'Falmouth, Massachusetts': { lat: 41.5515, lng: -70.6081 },
      'Fayetteville, North Carolina': { lat: 35.0527, lng: -78.8784 },
      'Florence, Italy': { lat: 43.7696, lng: 11.2558 },
      'Fort Lauderdale, Florida': { lat: 26.1224, lng: -80.1373 },
      'Fort Myers, Florida': { lat: 26.6406, lng: -81.8723 },
      'Fort Pierce, Florida': { lat: 27.4467, lng: -80.3256 },
      'Fort Wayne, Indiana': { lat: 41.0793, lng: -85.1394 },
      'Fredericton, Canada': { lat: 45.9636, lng: -66.6431 },
      'Freiburg, Breisgau': { lat: 47.9990, lng: 7.8421 },
      'Fresno, California': { lat: 36.7378, lng: -119.7871 },
      'Gainesville, Florida': { lat: 29.6516, lng: -82.3248 },
      'Galveston, Texas': { lat: 29.3013, lng: -94.7977 },
      'Geelong, Victoria': { lat: -38.1499, lng: 144.3617 },
      'Genoa, Italy': { lat: 44.4056, lng: 8.9463 },
      'Glenwood, Iowa': { lat: 41.0467, lng: -95.7428 },
      'Golden, Colorado': { lat: 39.7555, lng: -105.2211 },
      'Grand Blanc, Michigan': { lat: 42.9275, lng: -83.6245 },
      'Grand Prairie, Texas': { lat: 32.7459, lng: -97.0033 },
      'Grand Rapids, Michigan': { lat: 42.9634, lng: -85.6681 },
      'Green Bay, Wisconsin': { lat: 44.5192, lng: -88.0198 },
      'Greensboro, North Carolina': { lat: 36.0726, lng: -79.7920 },
      'Greenville, Texas': { lat: 33.1384, lng: -96.1108 },
      'Guatemala City, Guatemala': { lat: 14.6349, lng: -90.5069 },
      'Halifax, Nova Scotia': { lat: 44.6488, lng: -63.5752 },
      'Hamburg, Germany': { lat: 53.5511, lng: 9.9937 },
      'Hamilton County, Iowa': { lat: 40.7500, lng: -93.7500 },
      'Harnett County, North Carolina': { lat: 35.3681, lng: -78.8694 },
      'Harris County, Texas': { lat: 29.7604, lng: -95.3698 },
      'Hartford, Connecticut': { lat: 41.7658, lng: -72.6734 },
      'Havana, Cuba': { lat: 23.1136, lng: -82.3666 },
      'Helensburgh, Scotland': { lat: 56.0026, lng: -4.7337 },
      'Hermiston, Oregon': { lat: 45.8404, lng: -119.2895 },
      'Hillsboro, Oregon': { lat: 45.5229, lng: -122.9898 },
      'Hiroshima, Japan': { lat: 34.3853, lng: 132.4553 },
      'Hobart, Tasmania': { lat: -42.8821, lng: 147.3272 },
      'Hollywood, Florida': { lat: 26.0112, lng: -80.1495 },
      'Honolulu, Hawaii': { lat: 21.3099, lng: -157.8581 },
      'Hounslow, England': { lat: 51.4684, lng: -0.3600 },
      'Huntington Beach, California': { lat: 33.6595, lng: -117.9988 },
      'Indianapolis, Indiana': { lat: 39.7684, lng: -86.1581 },
      'Invercargill, New Zealand': { lat: -46.4132, lng: 168.3538 },
      'Irbil, Iraq': { lat: 36.1911, lng: 44.0092 },
      'Islamabad, Pakistan': { lat: 33.6844, lng: 73.0479 },
      'Jalalabad, Afghanistan': { lat: 34.4265, lng: 70.4515 },
      'Jeddah, Saudi Arabia': { lat: 21.4858, lng: 39.1925 },
      'Johannesburg, South Africa': { lat: -26.2041, lng: 28.0473 },
      'Juneau, Alaska': { lat: 58.3019, lng: -134.4197 },
      'Kabul, Afghanistan': { lat: 34.5553, lng: 69.2075 },
      'Kamchatka, Russia': { lat: 53.0194, lng: 158.6506 },
      'Kamchatsky, Russia': { lat: 53.0194, lng: 158.6506 },
      'Kansas City, Kansas': { lat: 39.1142, lng: -94.6275 },
      'Kansas City, Missouri': { lat: 39.0997, lng: -94.5786 },
      'Kennesaw, Georgia': { lat: 34.0234, lng: -84.6155 },
      'Kharkiv, Ukraine': { lat: 49.9935, lng: 36.2304 },
      'Lagos, Nigeria': { lat: 6.5244, lng: 3.3792 },
      'Lake Ariel, Pennsylvania': { lat: 41.4545, lng: -75.3838 },
      'Lake Wales, Florida': { lat: 27.9014, lng: -81.5859 },
      'Larnaca, Cyprus': { lat: 34.9167, lng: 33.6333 },
      'Las Cruces, New Mexico': { lat: 32.3199, lng: -106.7637 },
      'Lavaur, France': { lat: 43.6981, lng: 1.8186 },
      'Lebanon, Oregon': { lat: 44.5365, lng: -122.9070 },
      'Leicester, England': { lat: 52.6369, lng: -1.1398 },
      'Lexington, Kentucky': { lat: 38.0406, lng: -84.5037 },
      'Lima, Peru': { lat: -12.0464, lng: -77.0428 },
      'Little River, South Carolina': { lat: 33.8732, lng: -78.6142 },
      'Liverpool, England': { lat: 53.4084, lng: -2.9916 },
      'Long Beach, California': { lat: 33.7701, lng: -118.1937 },
      'Louisville, Kentucky': { lat: 38.2527, lng: -85.7585 },
      'Lubbock, Texas': { lat: 33.5779, lng: -101.8552 },
      'Makhachkala, Dagestan': { lat: 42.9833, lng: 47.4833 },
      'Makkah, Saudi Arabia': { lat: 21.3891, lng: 39.8579 },
      'Mandeville, Jamaica': { lat: 18.0417, lng: -77.5075 },
      'Manhattan, New York': { lat: 40.7831, lng: -73.9712 },
      'Maple Grove, Minnesota': { lat: 45.0725, lng: -93.4558 },
      'Marbella, Spain': { lat: 36.5102, lng: -4.8860 },
      'Mariupol, Ukraine': { lat: 47.0966, lng: 37.5434 },
      'Marseille, France': { lat: 43.2965, lng: 5.3698 },
      'McAllen, Texas': { lat: 26.2034, lng: -98.2300 },
      'Melbourne, Australia': { lat: -37.8136, lng: 144.9631 },
      'Memphis, Tennessee': { lat: 35.1495, lng: -90.0490 },
      'Merseyside, England': { lat: 53.4084, lng: -2.9916 },
      'Miami Beach, Florida': { lat: 25.7907, lng: -80.1300 },
      'Milan, Italy': { lat: 45.4642, lng: 9.1900 },
      'Milwaukee, Wisconsin': { lat: 43.0389, lng: -87.9065 },
      'Minneapolis, Minnesota': { lat: 44.9778, lng: -93.2650 },
      'Mobile, Alabama': { lat: 30.6954, lng: -88.0399 },
      'Mogadishu, Somalia': { lat: 2.0469, lng: 45.3182 },
      'Moncton, New Brunswick': { lat: 46.0878, lng: -64.7782 },
      'Monroe County, New York': { lat: 43.1548, lng: -77.6156 },
      'Montreal, Canada': { lat: 45.5017, lng: -73.5673 },
      'Mount Juliet, Tennessee': { lat: 36.2001, lng: -86.5186 },
      'Muncie, Indiana': { lat: 40.1934, lng: -85.3864 },
      'Munich, Germany': { lat: 48.1351, lng: 11.5820 },
      'Murfreesboro, Tennessee': { lat: 35.8456, lng: -86.3903 },
      'Nantes, France': { lat: 47.2184, lng: -1.5536 },
      'Naples, Florida': { lat: 26.1420, lng: -81.7948 },
      'Nashville, Tennessee': { lat: 36.1627, lng: -86.7816 },
      'Nashua, New Hampshire': { lat: 42.7654, lng: -71.4676 },
      'Nassau County, New York': { lat: 40.7262, lng: -73.5800 },
      'New Brunswick, Canada': { lat: 46.5653, lng: -66.4619 },
      'New Delhi, India': { lat: 28.6139, lng: 77.2090 },
      'New Haven, Connecticut': { lat: 41.3083, lng: -72.9279 },
      'New Orleans, Louisiana': { lat: 29.9511, lng: -90.0715 },
      'Newark, New Jersey': { lat: 40.7357, lng: -74.1724 },
      'Newcastle, England': { lat: 54.9783, lng: -1.6178 },
      'Norfolk, Virginia': { lat: 36.8468, lng: -76.2852 },
      'North Las Vegas, Nevada': { lat: 36.1989, lng: -115.1175 },
      'North Platte, Nebraska': { lat: 41.1239, lng: -100.7654 },
      'Odessa, Ukraine': { lat: 46.4825, lng: 30.7233 },
      'Oklahoma City, Oklahoma': { lat: 35.4676, lng: -97.5164 },
      'Olympia, Washington': { lat: 47.0379, lng: -122.9007 },
      'Orlando, Florida': { lat: 28.5383, lng: -81.3792 },
      'Oslo, Norway': { lat: 59.9139, lng: 10.7522 },
      'Ottawa, Canada': { lat: 45.4215, lng: -75.6972 },
      'Oxford, England': { lat: 51.7520, lng: -1.2577 },
      'Paducah, Kentucky': { lat: 37.0834, lng: -88.6001 },
      'Palmdale, California': { lat: 34.5794, lng: -118.1165 },
      'Panama City, Florida': { lat: 30.1588, lng: -85.6602 },
      'Paterson, New Jersey': { lat: 40.9168, lng: -74.1718 },
      'Pensacola, Florida': { lat: 30.4213, lng: -87.2169 },
      'Pittsburgh, Pennsylvania': { lat: 40.4406, lng: -79.9959 },
      'Portland, Oregon': { lat: 45.5152, lng: -122.6784 },
      'Prague, Czech Republic': { lat: 50.0755, lng: 14.4378 },
      'Pretoria, South Africa': { lat: -25.7479, lng: 28.2293 },
      'Prince George, British Columbia': { lat: 53.9166, lng: -122.7494 },
      'Providence, Rhode Island': { lat: 41.8240, lng: -71.4128 },
      'Pueblo, Colorado': { lat: 38.2544, lng: -104.6091 },
      'Pune, India': { lat: 18.5204, lng: 73.8567 },
      'Quebec City, Canada': { lat: 46.8139, lng: -71.2080 },
      'Queens, New York': { lat: 40.7282, lng: -73.7949 },
      'Quito, Ecuador': { lat: -0.1807, lng: -78.4678 },
      'Raleigh, North Carolina': { lat: 35.7796, lng: -78.6382 },
      'Rapid City, South Dakota': { lat: 43.0750, lng: -103.2020 },
      'Reading, Pennsylvania': { lat: 40.3356, lng: -75.9269 },
      'Recife, Brazil': { lat: -8.0476, lng: -34.8770 },
      'Reno, Nevada': { lat: 39.5296, lng: -119.8138 },
      'Richmond, Virginia': { lat: 37.5407, lng: -77.4360 },
      'Rio de Janeiro, Brazil': { lat: -22.9068, lng: -43.1729 },
      'Riyadh, Saudi Arabia': { lat: 24.7136, lng: 46.6753 },
      'Rochester, New York': { lat: 43.1566, lng: -77.6088 },
      'Rockford, Illinois': { lat: 42.2711, lng: -89.0940 },
      'Sacramento, California': { lat: 38.5816, lng: -121.4944 },
      'Salem, Massachusetts': { lat: 42.5195, lng: -70.8967 },
      'Salt Lake City, Utah': { lat: 40.7608, lng: -111.8910 },
      'San Jose, California': { lat: 37.3382, lng: -121.8863 },
      'San Juan, Puerto Rico': { lat: 18.4655, lng: -66.1057 },
      'San Luis Potosí, Mexico': { lat: 22.1565, lng: -100.9855 },
      'Sanford, Florida': { lat: 28.8028, lng: -81.2690 },
      'Santa Fe, New Mexico': { lat: 35.6870, lng: -105.9378 },
      'Santiago, Chile': { lat: -33.4489, lng: -70.6693 },
      'Santo Domingo, Dominican Republic': { lat: 18.4861, lng: -69.9312 },
      'São Paulo, Brazil': { lat: -23.5505, lng: -46.6333 },
      'Savannah, Georgia': { lat: 32.0809, lng: -81.0912 },
      'Scottsdale, Arizona': { lat: 33.4942, lng: -111.9261 },
      'Sheffield, England': { lat: 53.3811, lng: -1.4701 },
      'Shenzhen, China': { lat: 22.5431, lng: 114.0579 },
      'Shreveport, Louisiana': { lat: 32.5252, lng: -93.7502 },
      'Simferopol, Crimea': { lat: 44.9521, lng: 34.1024 },
      'Sioux City, Iowa': { lat: 42.4969, lng: -96.4044 },
      'Sofia, Bulgaria': { lat: 42.6977, lng: 23.3219 },
      'Spokane, Washington': { lat: 47.6588, lng: -117.4260 },
      'Springfield, Missouri': { lat: 37.2089, lng: -93.2923 },
      'St. Augustine, Florida': { lat: 29.9012, lng: -81.3124 },
      'St. Elizabeth, Jamaica': { lat: 18.0167, lng: -77.8500 },
      'Susquehanna County, Pennsylvania': { lat: 41.8214, lng: -75.8008 },
      'Swidnik, Poland': { lat: 51.2194, lng: 22.6961 },
      'Tacoma, Washington': { lat: 47.2529, lng: -122.4443 },
      'Taif, Saudi Arabia': { lat: 21.2703, lng: 40.4158 },
      'Tampa, Florida': { lat: 27.9506, lng: -82.4572 },
      'Tampere, Finland': { lat: 61.4978, lng: 23.7610 },
      'Tateyama City Coast, Chiba': { lat: 35.0167, lng: 139.8667 },
      'Taylortown, North Carolina': { lat: 35.2135, lng: -79.4920 },
      'The Bronx, New York': { lat: 40.8448, lng: -73.8648 },
      'Traverse City, Michigan': { lat: 44.7631, lng: -85.6206 },
      'Tucson, Arizona': { lat: 32.2226, lng: -110.9747 },
      'Tulsa, Oklahoma': { lat: 36.1540, lng: -95.9928 },
      'Uppsala, Sweden': { lat: 59.8586, lng: 17.6389 },
      'Valdosta, Georgia': { lat: 30.8327, lng: -83.2785 },
      'Vancouver, British Columbia': { lat: 49.2827, lng: -123.1207 },
      'Vero Beach, Florida': { lat: 27.6386, lng: -80.3973 },
      'Villahermosa, Mexico': { lat: 17.9892, lng: -92.9477 },
      'Virginia Beach, VA': { lat: 36.8529, lng: -75.9780 },
      'Visayas, Philippines': { lat: 11.0000, lng: 123.0000 },
      'Walton, Kentucky': { lat: 38.8667, lng: -84.6100 },
      'Waterbury, Connecticut': { lat: 41.5582, lng: -73.0515 },
      'Wayne, Michigan': { lat: 42.2814, lng: -83.3863 },
      'West Valley City, Utah': { lat: 40.6916, lng: -112.0011 },
      'Wichita Falls, Texas': { lat: 33.9137, lng: -98.4934 },
      'Williamstown, New Jersey': { lat: 39.6862, lng: -74.9952 },
      'Wilmington, NC': { lat: 34.2257, lng: -77.9447 },
      'Wilson County, Tennessee': { lat: 36.2089, lng: -86.2911 },
      'Wolf Point, Montana': { lat: 48.0906, lng: -105.6406 },
      'York County, Pennsylvania': { lat: 39.9626, lng: -76.7277 },
      // Additional International
      'Al Hudaydah, Yemen': { lat: 14.7978, lng: 42.9545 },
      'Amman, Jordan': { lat: 31.9539, lng: 35.9106 },
      'Bavaria, Germany': { lat: 48.7904, lng: 11.4979 },
      'Devenish, Fermanagh': { lat: 54.3500, lng: -7.8000 },
      'Dodge City, Kansas': { lat: 37.7528, lng: -100.0171 },
      'Doha, Qatar': { lat: 25.2854, lng: 51.5310 },
      'Hawaii, Island': { lat: 19.8968, lng: -155.5828 },
      'Makhachkala, Dagestan': { lat: 42.9833, lng: 47.4833 },
    };
    return this.cityMapCache;
  }

  // City and state name to coordinates mapping (wrapper function)
  getCityCoordinates(locationName) {
    const cityMap = this.getCityMap();
    
    // Try exact match first
    if (cityMap[locationName]) {
      return cityMap[locationName];
    }
    
    // Try case-insensitive match
    const locationNameLower = locationName.toLowerCase();
    for (const [key, coords] of Object.entries(cityMap)) {
      if (key.toLowerCase() === locationNameLower) {
        return coords;
      }
    }
    
    return null;
  }

  getCountryMap() {
    if (this.countryMapCache) return this.countryMapCache;
    this.countryMapCache = {
      'China': { lat: 35.8617, lng: 104.1954 },
      'India': { lat: 20.5937, lng: 78.9629 },
      'United States': { lat: 37.0902, lng: -95.7129 },
      'USA': { lat: 37.0902, lng: -95.7129 },
      'US': { lat: 37.0902, lng: -95.7129 },
      'America': { lat: 37.0902, lng: -95.7129 },
      'Indonesia': { lat: -0.7893, lng: 113.9213 },
      'Pakistan': { lat: 30.3753, lng: 69.3451 },
      'Brazil': { lat: -14.2350, lng: -51.9253 },
      'Bangladesh': { lat: 23.6850, lng: 90.3563 },
      'Russia': { lat: 61.5240, lng: 105.3188 },
      'Mexico': { lat: 23.6345, lng: -102.5528 },
      'Japan': { lat: 36.2048, lng: 138.2529 },
      'Philippines': { lat: 12.8797, lng: 121.7740 },
      'Egypt': { lat: 26.8206, lng: 30.8025 },
      'Ethiopia': { lat: 9.1450, lng: 38.7667 },
      'Vietnam': { lat: 14.0583, lng: 108.2772 },
      'Democratic Republic of the Congo': { lat: -4.0383, lng: 21.7587 },
      'Iran': { lat: 32.4279, lng: 53.6880 },
      'Türkiye': { lat: 38.9637, lng: 35.2433 },
      'Turkey': { lat: 38.9637, lng: 35.2433 },
      'Germany': { lat: 51.1657, lng: 10.4515 },
      'Thailand': { lat: 15.8700, lng: 100.9925 },
      'United Kingdom': { lat: 55.3781, lng: -3.4360 },
      'UK': { lat: 55.3781, lng: -3.4360 },
      'France': { lat: 46.2276, lng: 2.2137 },
      'Italy': { lat: 41.8719, lng: 12.5674 },
      'Spain': { lat: 40.4637, lng: -3.7492 },
      'Canada': { lat: 56.1304, lng: -106.3468 },
      'Australia': { lat: -25.2744, lng: 133.7751 },
      'South Korea': { lat: 35.9078, lng: 127.7669 },
      'Argentina': { lat: -38.4161, lng: -63.6167 },
      'South Africa': { lat: -30.5595, lng: 22.9375 },
      'Ukraine': { lat: 48.3794, lng: 31.1656 },
      'Poland': { lat: 51.9194, lng: 19.1451 },
      'Iraq': { lat: 33.2232, lng: 43.6793 },
      'Afghanistan': { lat: 33.9391, lng: 67.7100 },
      'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
      'Uzbekistan': { lat: 41.3775, lng: 64.5853 },
      'Peru': { lat: -9.1900, lng: -75.0152 },
      'Malaysia': { lat: 4.2105, lng: 101.9758 },
      'Angola': { lat: -11.2027, lng: 17.8739 },
      'Mozambique': { lat: -18.6657, lng: 35.5296 },
      'Ghana': { lat: 7.9465, lng: -1.0232 },
      'Yemen': { lat: 15.5527, lng: 48.5164 },
      'Nepal': { lat: 28.3949, lng: 84.1240 },
      'Nigeria': { lat: 9.0820, lng: 8.6753 },
      'Venezuela': { lat: 6.4238, lng: -66.5897 }
    };
    return this.countryMapCache;
  }

  // Country name to coordinates mapping (from geography game)
  getCountryCoordinates(countryName) {
    const countryMap = this.getCountryMap();

    // Try exact match first
    if (countryMap[countryName]) {
      return countryMap[countryName];
    }

    // Try case-insensitive match
    const countryNameLower = countryName.toLowerCase();
    for (const [key, coords] of Object.entries(countryMap)) {
      if (key.toLowerCase() === countryNameLower) {
        return coords;
      }
    }

    return null;
  }

  // Extract country names from post text (legacy support)
  extractCountryFromPost(post) {
    const locations = this.extractLocationsFromText(post.text || post.story || post.title || '');
    return locations.length ? locations[0] : null;
  }

  extractLocationFromPost(post) {
    const locations = this.extractLocationsFromText(post.text || post.story || post.title || '');
    return locations.length ? locations[0] : null;
  }

  extractLocationsFromText(text) {
    if (!text) return [];
    const normalized = text.toLowerCase();
    const found = new Set();
    
    const cityMap = this.getCityMap();
    for (const cityName of Object.keys(cityMap)) {
      const cityLower = cityName.toLowerCase();
      if (this.locationMatches(normalized, cityLower)) {
        found.add(cityName);
      }
    }
    
    const countryMap = this.getCountryMap();
    for (const countryName of Object.keys(countryMap)) {
      const countryLower = countryName.toLowerCase();
      if (this.locationMatches(normalized, countryLower)) {
        found.add(countryName);
      }
    }
    
    // Additional aliases and shorthand references
    const aliasMap = {
      'nyc': 'New York City, New York',
      'new york, ny': 'New York City, New York',
      'new york city': 'New York City, New York',
      'manhattan': 'Manhattan, New York',
      'bronx': 'The Bronx, New York',
      'washington dc': 'Washington, D.C.',
      'washington, d.c': 'Washington, D.C.',
      'd.c.': 'Washington, D.C.',
      'dc': 'Washington, D.C.',
      'la ': 'Los Angeles, California',
      'la,': 'Los Angeles, California',
      'los angeles': 'Los Angeles, California',
      'sf': 'San Francisco, California',
      'fort worth': 'Fort Worth, Texas',
      'são paulo': 'São Paulo, Brazil',
      'saint louis': 'St. Louis, Missouri'
    };
    
    for (const [alias, canonical] of Object.entries(aliasMap)) {
      if (normalized.includes(alias)) {
        found.add(canonical);
      }
    }
    
    return Array.from(found);
  }

  locationMatches(textLower, locationLower) {
    if (!locationLower) return false;
    const cleanLocation = locationLower.trim();
    if (!cleanLocation) return false;
    
    if (textLower.includes(cleanLocation)) {
      return true;
    }
    
    const escaped = cleanLocation.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\\\$&');
    try {
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(textLower);
    } catch {
      return textLower.includes(cleanLocation);
    }
  }

  // Extract locations from posts and convert to coordinates
  async extractLocationsFromPosts() {
    // Check for cached location data first (much faster)
    const locationCacheKey = 'globe-locations-cache-v2';
    try {
      const cached = localStorage.getItem(locationCacheKey);
      if (cached) {
        const cacheData = JSON.parse(cached);
        // Cache valid for 1 hour
        if (cacheData.coveragePoints && Array.isArray(cacheData.coveragePoints) && 
            cacheData.timestamp && (Date.now() - cacheData.timestamp < 3600000)) {
          console.log('[Globe] Using cached location data:', cacheData.coveragePoints.length, 'points');
          this.totalPosts = cacheData.totalPosts || cacheData.coveragePoints.length;
          
          // Also try to restore posts from cache if available
          if (cacheData.posts && Array.isArray(cacheData.posts)) {
            this.allPosts = cacheData.posts;
            console.log('[Globe] Restored', this.allPosts.length, 'posts from cache');
          } else {
            // Load posts asynchronously if not in cache
            this.loadPostsForFiltering();
          }
          
          return cacheData.coveragePoints;
        }
      }
    } catch (e) {
      console.warn('[Globe] Failed to load cached locations:', e);
    }

    const coveragePoints = [];
    const seenLocations = new Set();

    try {
      // Get posts from localStorage or API
      let posts = [];
      
      // Try to get from enhanced feed cache
      const cacheKey = 'noteworthy-posts-cache-enhanced';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          if (cacheData.posts && Array.isArray(cacheData.posts)) {
            posts = cacheData.posts;
          }
        } catch (e) {
          console.warn('Failed to parse cached posts:', e);
        }
      }

      // If no cached posts, try to fetch from API - fetch more posts to show all locations
      if (posts.length === 0) {
        try {
          const response = await fetch('/.netlify/functions/posts-read?limit=500');
          if (response.ok) {
            const data = await response.json();
            posts = Array.isArray(data) ? data : (data.posts || data.data || []);
          }
        } catch (e) {
          console.warn('Failed to fetch posts for globe:', e);
        }
      }
      
      // Store all posts for searching and filtering
      this.allPosts = posts;

      // Track how many posts per country to add slight randomization
      const countryCounts = new Map();

      // Extract ALL posts with locations - show every location mentioned
      for (const post of posts) {
        const location = this.extractLocationFromPost(post);
        if (location) {
          const coords = await this.getLocationCoordinates(location);
          if (coords) {
            // Count posts per location for randomization
            const count = (countryCounts.get(location) || 0) + 1;
            countryCounts.set(location, count);
            
            // Add slight randomization to prevent exact overlap (only for country-level, not cities)
            // Cities should be more precise, countries can spread
            const isCity = this.getCityCoordinates(location) !== null;
            const spreadRadius = isCity ? 0.5 : 2; // Smaller spread for cities
            const angle = (count * 137.5) % 360; // Golden angle for even distribution
            const distance = isCity ? Math.min(count * 0.1, spreadRadius) : Math.min(count * 0.3, spreadRadius);
            
            const latOffset = (Math.cos(angle * Math.PI / 180) * distance);
            const lngOffset = (Math.sin(angle * Math.PI / 180) * distance / Math.cos(coords.lat * Math.PI / 180));
            
            const postText = post.text || post.story || post.title || '';
            const headline = postText.length > 60 ? postText.substring(0, 57) + '...' : postText;
            
            coveragePoints.push({
              id: `post-${post.id || Date.now()}-${location}-${count}`,
              lat: coords.lat + latOffset,
              lng: coords.lng + lngOffset,
              location: location,
              headline: headline || `Coverage from ${location}`,
              timestamp: post.createdAt || post.datePosted || new Date().toISOString(),
              postId: post.id,
              postLink: post.link || post.url || post.postLink || ''
            });
          }
        }
      }

      // Add extra locations from CSV analytics (posts-with-locations.json)
      await this.addExtraLocationsFromCSV(coveragePoints);
      
      // Cache the results for faster future loads (include posts for filtering)
      try {
        localStorage.setItem(locationCacheKey, JSON.stringify({
          coveragePoints: coveragePoints,
          totalPosts: posts.length,
          posts: posts, // Store posts for filtering
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('[Globe] Failed to cache locations:', e);
        // If cache is too large, try without posts
        try {
          localStorage.setItem(locationCacheKey, JSON.stringify({
            coveragePoints: coveragePoints,
            totalPosts: posts.length,
            timestamp: Date.now()
          }));
        } catch (e2) {
          console.warn('[Globe] Failed to cache even without posts:', e2);
        }
      }
      
      this.totalPosts = posts.length;
      console.log(`[Globe] Extracted ${coveragePoints.length} locations from ${posts.length} posts + CSV data`);
      
      // Initialize with all posts (filters will be applied after)
      this.coveragePoints = this.aggregateCoveragePoints(coveragePoints);
      
      return coveragePoints;
    } catch (err) {
      console.error('[Globe] Error extracting locations from posts:', err);
      return [];
    }
  }

  async loadExtraLocationData() {
    if (this.extraLocationData !== null) {
      return this.extraLocationData;
    }
    // Try JSON cache first (generated via script)
    try {
      const response = await fetch('/posts-with-locations.json', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.posts)) {
          this.extraLocationData = data;
          return data;
        }
      }
    } catch (err) {
      console.warn('[Globe] Failed to load JSON extra location data:', err);
    }
    
    // Fall back to raw CSV analytics file
    try {
      const csvResponse = await fetch('/data/account_analytics_content_2025-03-02_2025-11-26.csv', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (csvResponse.ok) {
        const csvText = await csvResponse.text();
        const posts = this.parseAnalyticsCSV(csvText);
        this.extraLocationData = { posts };
        return this.extraLocationData;
      }
    } catch (err) {
      console.warn('[Globe] Failed to load CSV analytics data:', err);
    }
    
    this.extraLocationData = null;
    return null;
  }

  async addExtraLocationsFromCSV(coveragePoints) {
    const extraData = await this.loadExtraLocationData();
    if (!extraData || !Array.isArray(extraData.posts)) {
      return;
    }
    
    const countryCounts = new Map();
    for (const post of extraData.posts) {
      const timestamp = post.date ? new Date(post.date).toISOString() : new Date().toISOString();
      const headline = post.postText || 'Coverage update';
      const postLocations = Array.isArray(post.locations) && post.locations.length > 0
        ? post.locations
        : this.extractLocationsFromText(post.postText || '');
      if (!postLocations.length) continue;
      
      for (const locationName of postLocations) {
        if (!locationName) continue;
        try {
          const coords = await this.getLocationCoordinates(locationName);
          if (!coords) continue;
          
          const count = (countryCounts.get(locationName) || 0) + 1;
          countryCounts.set(locationName, count);
          
          const isCity = !!this.getCityCoordinates(locationName);
          const spreadRadius = isCity ? 0.4 : 1.5;
          const angle = (count * 111.25) % 360;
          const distance = Math.min(count * 0.1, spreadRadius);
          
          const latOffset = (Math.cos(angle * Math.PI / 180) * distance);
          const lngOffset = (Math.sin(angle * Math.PI / 180) * distance / Math.cos(coords.lat * Math.PI / 180));
          
          coveragePoints.push({
            id: `csv-${post.postId || Date.now()}-${locationName}-${count}`,
            lat: coords.lat + latOffset,
            lng: coords.lng + lngOffset,
            location: locationName,
            headline: headline.substring(0, 140),
            timestamp,
            postId: post.postId,
            postLink: post.postLink || '',
            source: 'csv'
          });
        } catch (err) {
          console.warn('[Globe] Failed to add CSV location', locationName, err);
        }
      }
    }
  }

  parseAnalyticsCSV(csvText) {
    const rows = this.splitCSVRows(csvText);
    if (!rows.length) return [];
    
    const headers = this.parseCSVRow(rows[0]).map(header => header.trim().toLowerCase());
    const posts = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.trim()) continue;
      const values = this.parseCSVRow(row);
      if (!values.length) continue;
      
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = (values[idx] || '').trim();
      });
      
      const postText = record['post text'] || '';
      const locations = this.extractLocationsFromText(postText);
      
      posts.push({
        postId: record['post id'] || record['postid'] || record['id'] || `csv-${i}`,
        date: record['date'] || '',
        postText,
        postLink: record['post link'] || record['link'] || '',
        locations
      });
    }
    
    return posts;
  }

  splitCSVRows(csvText) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      if (char === '"') {
        current += char;
        if (inQuotes && csvText[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && csvText[i + 1] === '\n') {
          i++;
        }
        rows.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      rows.push(current);
    }
    
    return rows.filter(row => row && row.trim().length > 0);
  }

  parseCSVRow(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  isMobile() {
    return window.innerWidth <= 768;
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    // Wait for Globe to be available
    if (typeof Globe === 'undefined') {
      console.error('Globe.gl not loaded');
      return;
    }

    const isMobile = this.isMobile();
    const initialView = this.getInitialPointOfView(isMobile);

    // Create root structure with mobile class
    container.innerHTML = `
      <div class="cia-globe-root ${isMobile ? 'mobile' : ''} is-loading">
        <div class="cia-globe-loading" id="cia-globe-loading" role="status" aria-live="polite">
          <div class="cia-globe-loading-spinner"></div>
          <p class="cia-globe-loading-message">Preparing global coverage...</p>
        </div>
        <div class="cia-globe-canvas" id="cia-globe-canvas"></div>
        <div class="cia-hud-overlay ${isMobile ? 'mobile-simple' : ''}" id="cia-hud-overlay"></div>
      </div>
    `;

    this.rootEl = container.querySelector('.cia-globe-root');
    this.loadingEl = document.getElementById('cia-globe-loading');
    this.setLoadingState(true, 'Charging orbital sensors...');
    const canvasEl = document.getElementById('cia-globe-canvas');
    const hudEl = document.getElementById('cia-hud-overlay');
    
    if (!canvasEl || !hudEl) return;

    // Render HUD (simplified on mobile)
    this.renderHUD(hudEl);
    
    // Setup controls and UI - delay to ensure DOM is ready
    setTimeout(() => {
      this.setupControls();
      // Update regions list after ensuring data is ready
      setTimeout(() => {
        if (this.coveragePoints.length > 0 && this.countryData.size === 0) {
          this.updateCountryAggregation();
        }
        this.updateActiveRegionsList();
      }, 1000);
    }, 500);

    // Initialize globe with highly detailed, realistic earth texture
    // Using high-resolution NASA Blue Marble Next Generation texture for maximum detail
    // This texture shows detailed land features, coastlines, mountains, and terrain
    // The bump map adds 3D relief and depth to show mountains, valleys, and topography
    this.globeInstance = Globe()(canvasEl)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl(isMobile ? null : '//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('#020617')
      .showAtmosphere(true)
      .atmosphereColor('#3ec9ff')
      .atmosphereAltitude(0.22);
    
    // Fix THREE.js r155+ deprecation: Configure renderer for modern lighting
    // Enhance texture quality for maximum detail after globe loads
    setTimeout(() => {
      try {
        // Access Three.js (loaded from CDN) to enhance texture rendering
        if (typeof THREE !== 'undefined') {
          // Fix r155+ deprecation: Configure renderer for modern lighting system
          const renderer = this.globeInstance.renderer();
          if (renderer) {
            // Remove deprecated useLegacyLights (r155+ uses modern lighting by default)
            // Configure output color space for proper sRGB rendering
            if (renderer.outputColorSpace !== undefined) {
              renderer.outputColorSpace = THREE.SRGBColorSpace;
            }
            // Set tone mapping for better visual quality (optional but recommended)
            if (renderer.toneMapping !== undefined) {
              renderer.toneMapping = THREE.ACESFilmicToneMapping;
              renderer.toneMappingExposure = 1.0;
            }
            console.log('[Globe] ✅ Renderer configured for THREE.js r155+ (modern lighting)');
          }
          
          const scene = this.globeInstance.scene();
          if (scene) {
            // Ensure scene uses modern color management
            if (scene.background && scene.background.isColor) {
              // Background color is already in sRGB, renderer handles conversion
            }
            
            scene.traverse((obj) => {
              if (obj.material) {
                // Maximum texture filtering quality for crisp, detailed rendering
                if (obj.material.map) {
                  obj.material.map.anisotropy = 16; // 16x anisotropic filtering for maximum detail
                  obj.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                  obj.material.map.magFilter = THREE.LinearFilter;
                  obj.material.map.generateMipmaps = true;
                  obj.material.map.needsUpdate = true;
                  // Ensure texture uses sRGB color space (r155+ requirement)
                  if (obj.material.map.colorSpace !== undefined) {
                    obj.material.map.colorSpace = THREE.SRGBColorSpace;
                  }
                }
                // Enhance bump map for better 3D relief detail
                if (obj.material.bumpMap) {
                  obj.material.bumpMap.anisotropy = 16;
                  obj.material.bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
                  obj.material.bumpMap.magFilter = THREE.LinearFilter;
                  obj.material.bumpMap.generateMipmaps = true;
                  obj.material.bumpMap.needsUpdate = true;
                  obj.material.bumpScale = 0.5; // Adjust bump intensity for visible detail
                }
                obj.material.needsUpdate = true;
              }
            });
            console.log('[Globe] ✅ High-quality detailed earth texture rendering enabled');
          }
        }
      } catch (e) {
        console.warn('[Globe] Texture/renderer enhancement error:', e.message);
      }
    }, 1500);

    // Configure points - show all countries (will be updated by updateGlobePoints)
    this.updateGlobePoints();
    this.globeInstance
      .pointResolution(isMobile ? 4 : 8)
      .pointsTransitionDuration(isMobile ? 500 : 1000);
    const plottedStories = this.totalPosts || this.coveragePoints.reduce((sum, point) => {
      return sum + (Array.isArray(point.posts) ? point.posts.length : 1);
    }, 0);
    this.updateLoadingMessage(`Mapping ${plottedStories.toLocaleString()} story signals...`);

    // Configure controls - cinematic camera motion
    const controls = this.globeInstance.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = isMobile ? 0.35 : 0.25;
    controls.enableZoom = true;
    controls.enablePan = !isMobile;
    controls.enableDamping = !isMobile;
    controls.zoomSpeed = 0.4;
    controls.dampingFactor = 0.08;
    controls.minDistance = isMobile ? 140 : 180;
    controls.maxDistance = isMobile ? 420 : 520;
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Set initial camera position to start over the Americas, zoomed in
    setTimeout(() => {
      this.globeInstance.pointOfView(initialView, 0);
      this.setLoadingState(false);
      
      // Apply initial filters after globe is ready
      if (this.allPosts.length > 0) {
        this.applyFilters();
      } else if (this.coveragePoints.length > 0) {
        // If we have coverage points but no posts loaded yet, still update regions
        this.updateCountryAggregation();
        setTimeout(() => this.updateActiveRegionsList(), 500);
        // Try to load posts in background for filtering
        this.loadPostsForFiltering();
      }
    }, 250);

    // Handle point clicks - open country panel
    this.globeInstance.onPointClick((point) => {
      if (point) {
        const country = this.extractCountryName(point.location);
        if (country) {
          this.openCountryPanel(country);
        }
      }
    });

    // Handle resize
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Start animation (throttled on mobile)
    this.animate();
  }

  handleResize() {
    if (this.globeInstance) {
      const canvas = document.getElementById('cia-globe-canvas');
      if (canvas) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        this.globeInstance.width(width);
        this.globeInstance.height(height);
      }
    }
  }

  animate() {
    if (!this.globeInstance) return;

    const isMobile = this.isMobile();
    
    // Throttle animation on mobile (slower updates)
    if (isMobile) {
      this.t += 0.015; // Half speed on mobile
    } else {
      this.t += 0.03;
    }

    this.globeInstance.pointAltitude(d => {
      const phase = this.getPointPhase(d);
      const pulse = (Math.sin(this.t + phase) + 1) / 2;
      const base = this.getPointBaseAltitude(d, isMobile);
      const weight = this.getPointWeight(d);
      const lift = pulse * 0.02 * (0.6 + Math.min(1.2, weight * 0.2));
      return base + lift;
    });

    this.globeInstance.pointRadius(d => {
      const phase = this.getPointPhase(d);
      const pulse = (Math.sin(this.t + phase) + 1) / 2;
      const base = this.getPointBaseRadius(d, isMobile);
      const weight = this.getPointWeight(d);
      const pulseSize = pulse * 0.08 * (0.5 + Math.min(1.5, weight * 0.15));
      return base + pulseSize;
    });

    // Update point color with pulsating glow effect
    this.globeInstance.pointColor(d => {
      // Highlight filtered points
      if (this.filteredPoints && this.filteredPoints.includes(d)) {
        const phase = this.getPointPhase(d);
        const pulse = (Math.sin(this.t + phase) + 1) / 2;
        return this.getPointGlowColor(d, pulse);
      }
      // Dim non-matching points when filtering
      if (this.filteredPoints) {
        return 'rgba(100, 100, 100, 0.2)';
      }
      // Normal color when not filtering
      const phase = this.getPointPhase(d);
      const pulse = (Math.sin(this.t + phase) + 1) / 2;
      return this.getPointGlowColor(d, pulse);
    });

    // Throttle on mobile - skip every other frame
    if (isMobile) {
      this.animationFrameId = requestAnimationFrame(() => {
        requestAnimationFrame(() => this.animate());
      });
    } else {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }

  setActiveOp(point) {
    if (!point) {
      this.activeOp = null;
      this.renderHUD(document.getElementById('cia-hud-overlay'));
      return;
    }
    if (!Array.isArray(point.posts) || point.posts.length === 0) {
      point.posts = [this.createPostSummary(point)];
    }
    this.activeOp = point;
    this.renderHUD(document.getElementById('cia-hud-overlay'));
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return timestamp;
    }
  }

  searchPosts(query) {
    if (!query || query.trim().length === 0) {
      this.searchQuery = '';
      this.filteredPoints = null;
      this.updateGlobePoints();
      this.renderHUD(document.getElementById('cia-hud-overlay'));
      return;
    }
    
    this.searchQuery = query.trim().toLowerCase();
    const searchTerms = this.searchQuery.split(/\s+/).filter(t => t.length > 0);
    
    // Search through all posts
    const matchingPostIds = new Set();
    const matchingLocations = new Set();
    
    this.allPosts.forEach(post => {
      const text = (post.text || post.story || post.title || '').toLowerCase();
      const headline = (post.headline || '').toLowerCase();
      const location = (post.location || '').toLowerCase();
      const allText = `${text} ${headline} ${location}`;
      
      // Check if all search terms match
      const allTermsMatch = searchTerms.every(term => allText.includes(term));
      
      if (allTermsMatch) {
        matchingPostIds.add(post.id || post.postId);
        
        // Extract location from post
        const locations = this.extractLocationsFromText(post.text || post.story || post.title || '');
        locations.forEach(loc => matchingLocations.add(loc.toLowerCase()));
      }
    });
    
    // Filter points that have matching posts or locations
    this.filteredPoints = this.coveragePoints.filter(point => {
      // Check if point location matches
      const pointLocation = (point.location || '').toLowerCase();
      if (searchTerms.some(term => pointLocation.includes(term))) {
        return true;
      }
      
      // Check if any post in this point matches
      if (Array.isArray(point.posts)) {
        return point.posts.some(post => {
          const postId = post.id || post.postId;
          return matchingPostIds.has(postId);
        });
      }
      
      return false;
    });
    
    this.updateGlobePoints();
    this.renderHUD(document.getElementById('cia-hud-overlay'));
  }
  
  updateGlobePoints() {
    if (!this.globeInstance) return;
    
    const pointsToShow = this.filteredPoints || this.coveragePoints;
    const isMobile = this.isMobile();
    
    this.globeInstance
      .pointsData(pointsToShow)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointLabel(d => this.getPointLabel(d, isMobile))
      .pointColor(d => {
        // Highlight filtered points
        if (this.filteredPoints && this.filteredPoints.includes(d)) {
          const phase = this.getPointPhase(d);
          const pulse = (Math.sin(this.t + phase) + 1) / 2;
          return this.getPointGlowColor(d, pulse);
        }
        // Dim non-matching points when filtering
        if (this.filteredPoints) {
          return 'rgba(100, 100, 100, 0.2)';
        }
        // Normal color when not filtering
        const phase = this.getPointPhase(d);
        const pulse = (Math.sin(this.t + phase) + 1) / 2;
        return this.getPointGlowColor(d, pulse);
      })
      .pointRadius(d => this.getPointBaseRadius(d, isMobile))
      .pointAltitude(d => this.getPointBaseAltitude(d, isMobile));
  }

  renderHUD(container) {
    if (!container) return;

    // Remove the blocking HUD overlay - stats are now in the control bar
    // Keep container empty or minimal to avoid blocking the globe
    container.innerHTML = '';
    
    // Connect to posts area search bar if it exists
    const postsSearchInput = document.getElementById('globeSearchInputPosts');
    const postsSearchContainer = document.getElementById('globeSearchContainerPosts');
    const postsClearBtn = document.getElementById('globeSearchClearPosts');
    
    if (postsSearchInput && postsSearchContainer) {
      // Show the posts search container
      postsSearchContainer.style.display = 'flex';
      
      // Sync value with posts input
      postsSearchInput.value = this.searchQuery || '';
      
      // Show/hide clear button
      if (postsClearBtn) {
        postsClearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      }
      
      // Sync search functionality
      let searchTimeout;
      postsSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchPosts(e.target.value);
          if (postsClearBtn) {
            postsClearBtn.style.display = e.target.value ? 'flex' : 'none';
          }
        }, 300);
      });
      
      postsSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchTimeout);
          this.searchPosts(e.target.value);
        }
      });
      
      if (postsClearBtn) {
        postsClearBtn.addEventListener('click', () => {
          postsSearchInput.value = '';
          this.searchPosts('');
          postsClearBtn.style.display = 'none';
        });
      }
    }

    const closeBtn = container.querySelector('.globe-hud-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.setActiveOp(null);
      });
    }
    
    const searchInput = container.querySelector('.globe-search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchPosts(e.target.value);
        }, 300); // Debounce search
      });
      
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchTimeout);
          this.searchPosts(e.target.value);
        }
      });
    }
    
    const clearBtn = container.querySelector('.globe-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.searchPosts('');
      });
    }
  }

  renderActiveLocationDetails(point) {
    const posts = Array.isArray(point.posts) && point.posts.length
      ? point.posts
      : [this.createPostSummary(point)];
    const postItems = posts.map(post => `
      <div class="globe-hud-post">
        <div class="post-headline">${post.headline || 'Coverage update'}</div>
        <div class="post-meta">
          <span>${this.formatTimestamp(post.timestamp)}</span>
          ${post.postLink ? `<a href="${post.postLink}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
        </div>
      </div>
    `).join('');
    
    return `
        <div class="globe-hud-active">
        <button class="globe-hud-close" title="Close details">&times;</button>
        <div class="globe-hud-location">${point.location || 'Unknown'} • ${posts.length} post${posts.length === 1 ? '' : 's'}</div>
        <div class="globe-hud-posts">
          ${postItems}
        </div>
      </div>
    `;
  }

  // Setup control bar interactions
  setupControls() {
    // Wait for DOM to be ready
    const setupControlsDelayed = () => {
      // Time range buttons
      const timeButtons = document.querySelectorAll('.globe-time-btn');
      if (timeButtons.length === 0) {
        console.warn('[Globe] Time buttons not found, retrying...');
        setTimeout(setupControlsDelayed, 100);
        return;
      }
      
      timeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const timeRange = btn.dataset.time || '24h';
          
          // Update all buttons
          timeButtons.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'rgba(74, 158, 255, 0.1)';
            b.style.borderColor = 'rgba(74, 158, 255, 0.3)';
            b.style.color = 'rgba(255, 255, 255, 0.8)';
          });
          
          // Activate clicked button
          btn.classList.add('active');
          btn.style.background = 'rgba(74, 158, 255, 0.2)';
          btn.style.borderColor = 'rgba(74, 158, 255, 0.4)';
          btn.style.color = '#fff';
          
          this.timeRange = timeRange;
          console.log('[Globe] Time range changed to:', this.timeRange);
          // Load posts if needed, then apply filters
          if (this.allPosts.length === 0) {
            this.loadPostsForFiltering().then(() => this.applyFilters());
          } else {
            this.applyFilters();
          }
        }, { once: false });
      });

      // Category chips
      const categoryChips = document.querySelectorAll('.globe-category-chip');
      if (categoryChips.length === 0) {
        console.warn('[Globe] Category chips not found, retrying...');
        setTimeout(setupControlsDelayed, 100);
        return;
      }
      
      categoryChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const category = chip.dataset.category || 'all';
          
          // Update all chips
          categoryChips.forEach(c => {
            c.classList.remove('active');
            c.style.background = 'rgba(74, 158, 255, 0.1)';
            c.style.borderColor = 'rgba(74, 158, 255, 0.3)';
            c.style.color = 'rgba(255, 255, 255, 0.8)';
          });
          
          // Activate clicked chip
          chip.classList.add('active');
          chip.style.background = 'rgba(74, 158, 255, 0.2)';
          chip.style.borderColor = 'rgba(74, 158, 255, 0.4)';
          chip.style.color = '#fff';
          
          this.selectedCategory = category;
          console.log('[Globe] Category changed to:', this.selectedCategory);
          // Load posts if needed, then apply filters
          if (this.allPosts.length === 0) {
            this.loadPostsForFiltering().then(() => this.applyFilters());
          } else {
            this.applyFilters();
          }
        }, { once: false });
      });

      // Breaking only toggle
      const breakingToggle = document.getElementById('globe-breaking-only');
      if (breakingToggle) {
        breakingToggle.addEventListener('change', (e) => {
          this.breakingOnly = e.target.checked;
          console.log('[Globe] Breaking only:', this.breakingOnly);
          // Load posts if needed, then apply filters
          if (this.allPosts.length === 0) {
            this.loadPostsForFiltering().then(() => this.applyFilters());
          } else {
            this.applyFilters();
          }
        });
      } else {
        console.warn('[Globe] Breaking toggle not found');
      }

      // Panel close button
      const panelClose = document.getElementById('globe-panel-close');
      const panelOverlay = document.getElementById('globe-panel-overlay');
      if (panelClose) {
        panelClose.addEventListener('click', () => this.closeCountryPanel());
      }
      if (panelOverlay) {
        panelOverlay.addEventListener('click', () => this.closeCountryPanel());
      }
      
      console.log('[Globe] Controls setup complete');
    };
    
    // Try immediately, then retry if needed
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupControlsDelayed);
    } else {
      // DOM already ready, but wait a bit for dynamic content
      setTimeout(setupControlsDelayed, 100);
    }
  }

  // Get time range in milliseconds
  getTimeRangeMs() {
    const now = Date.now();
    switch (this.timeRange) {
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return Infinity;
    }
  }

  // Check if post matches category
  postMatchesCategory(post) {
    if (this.selectedCategory === 'all') return true;
    
    const text = (post.text || post.story || post.title || '').toLowerCase();
    const tags = (post.tags || []).map(t => t.toLowerCase());
    const category = (post.category || '').toLowerCase();
    
    const searchTerms = {
      conflict: ['war', 'conflict', 'military', 'attack', 'strike', 'bomb', 'missile', 'combat', 'battle', 'invasion'],
      disaster: ['earthquake', 'flood', 'fire', 'hurricane', 'tornado', 'tsunami', 'disaster', 'emergency', 'evacuation'],
      aviation: ['plane', 'aircraft', 'airport', 'flight', 'aviation', 'airline', 'crash', 'pilot'],
      crime: ['crime', 'murder', 'arrest', 'shooting', 'robbery', 'theft', 'police', 'suspect'],
      politics: ['election', 'president', 'congress', 'senate', 'vote', 'political', 'policy', 'government']
    };
    
    const terms = searchTerms[this.selectedCategory] || [];
    return terms.some(term => 
      text.includes(term) || 
      tags.some(tag => tag.includes(term)) ||
      category.includes(term)
    );
  }

  // Check if post is breaking
  isBreakingPost(post) {
    if (!this.breakingOnly) return true;
    const category = (post.category || '').toLowerCase();
    const text = (post.text || post.story || post.title || '').toLowerCase();
    return category === 'breaking' || text.includes('breaking') || text.includes('🚨');
  }

  // Apply filters and update display
  applyFilters() {
    // Don't log warning if we're still loading - just return silently
    if (!this.allPosts || this.allPosts.length === 0) {
      // Try to load posts if we don't have them
      if (this.allPosts.length === 0) {
        this.loadPostsForFiltering();
      }
      return;
    }
    
    const timeRangeMs = this.getTimeRangeMs();
    const now = Date.now();
    
    console.log('[Globe] Applying filters:', {
      timeRange: this.timeRange,
      category: this.selectedCategory,
      breakingOnly: this.breakingOnly,
      totalPosts: this.allPosts.length
    });
    
    // Filter posts
    const filteredPosts = this.allPosts.filter(post => {
      // Time filter
      const postTime = new Date(post.createdAt || post.datePosted || post.created_at || 0).getTime();
      if (timeRangeMs !== Infinity && (now - postTime) > timeRangeMs) {
        return false;
      }
      
      // Category filter
      if (!this.postMatchesCategory(post)) {
        return false;
      }
      
      // Breaking only filter
      if (!this.isBreakingPost(post)) {
        return false;
      }
      
      return true;
    });
    
    console.log('[Globe] Filtered posts:', filteredPosts.length, 'out of', this.allPosts.length);
    
    // Re-aggregate coverage points from filtered posts
    this.updateCoveragePointsFromPosts(filteredPosts);
    this.updateCountryAggregation();
    this.updateActiveRegionsList();
    this.updateGlobeDisplay();
  }

  // Update coverage points from filtered posts
  updateCoveragePointsFromPosts(posts) {
    const coveragePoints = [];
    const seenLocations = new Set();
    const countryCounts = new Map();

    for (const post of posts) {
      const location = this.extractLocationFromPost(post);
      if (location) {
        const coords = this.getLocationCoordinatesSync(location);
        if (coords) {
          const count = (countryCounts.get(location) || 0) + 1;
          countryCounts.set(location, count);
          
          const isCity = this.getCityCoordinates(location) !== null;
          const spreadRadius = isCity ? 0.5 : 2;
          const angle = (count * 137.5) % 360;
          const distance = isCity ? Math.min(count * 0.1, spreadRadius) : Math.min(count * 0.3, spreadRadius);
          
          const latOffset = (Math.cos(angle * Math.PI / 180) * distance);
          const lngOffset = (Math.sin(angle * Math.PI / 180) * distance / Math.cos(coords.lat * Math.PI / 180));
          
          const postText = post.text || post.story || post.title || '';
          const headline = postText.length > 60 ? postText.substring(0, 57) + '...' : postText;
          
          coveragePoints.push({
            id: `post-${post.id || Date.now()}-${location}-${count}`,
            lat: coords.lat + latOffset,
            lng: coords.lng + lngOffset,
            location: location,
            headline: headline || `Coverage from ${location}`,
            timestamp: post.createdAt || post.datePosted || new Date().toISOString(),
            postId: post.id,
            postLink: post.link || post.url || post.postLink || '',
            category: post.category,
            tags: post.tags
          });
        }
      }
    }
    
    this.coveragePoints = this.aggregateCoveragePoints(coveragePoints);
  }

  // Load posts for filtering (async, doesn't block)
  async loadPostsForFiltering() {
    if (this.allPosts && this.allPosts.length > 0) {
      return Promise.resolve(); // Already loaded
    }
    
    try {
      // Try to get from enhanced feed cache
      const cacheKey = 'noteworthy-posts-cache-enhanced';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          if (cacheData.posts && Array.isArray(cacheData.posts)) {
            this.allPosts = cacheData.posts;
            console.log('[Globe] Loaded', this.allPosts.length, 'posts from cache for filtering');
            return Promise.resolve();
          }
        } catch (e) {
          console.warn('[Globe] Failed to parse cached posts:', e);
        }
      }

      // If no cached posts, try to fetch from API
      const response = await fetch('/.netlify/functions/posts-read?limit=500');
      if (response.ok) {
        const data = await response.json();
        const posts = Array.isArray(data) ? data : (data.posts || data.data || []);
        if (posts.length > 0) {
          this.allPosts = posts;
          console.log('[Globe] Loaded', this.allPosts.length, 'posts from API for filtering');
          return Promise.resolve();
        }
      }
      return Promise.resolve(); // Return even if no posts found
    } catch (e) {
      console.warn('[Globe] Failed to load posts for filtering:', e);
      return Promise.resolve(); // Return promise even on error
    }
  }

  // Synchronous version of getLocationCoordinates (uses cache)
  getLocationCoordinatesSync(locationName) {
    if (!locationName) return null;
    const normalized = (locationName || '').trim().toLowerCase();
    if (!normalized) return null;
    
    // Check cache first
    if (this.locationCache[normalized]) {
      return this.locationCache[normalized];
    }
    
    // Try city/state mapping
    const cityCoords = this.getCityCoordinates(locationName);
    if (cityCoords) {
      this.locationCache[normalized] = cityCoords;
      return cityCoords;
    }
    
    // Try country mapping
    const countryCoords = this.getCountryCoordinates(locationName);
    if (countryCoords) {
      this.locationCache[normalized] = countryCoords;
      return countryCoords;
    }
    
    return null;
  }

  // Extract country name from location string
  extractCountryName(location) {
    if (!location) return null;
    
    // Check if it's a known country
    const countryMap = this.getCountryMap();
    const locationLower = location.toLowerCase().trim();
    
    // First try exact match
    for (const [country, coords] of Object.entries(countryMap)) {
      const countryLower = country.toLowerCase();
      if (locationLower === countryLower) {
        return country;
      }
    }
    
    // Try if location contains country name
    for (const [country, coords] of Object.entries(countryMap)) {
      const countryLower = country.toLowerCase();
      if (locationLower.includes(countryLower) || countryLower.includes(locationLower)) {
        return country;
      }
    }
    
    // Try to extract country from "City, Country" format
    const parts = location.split(',').map(p => p.trim());
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].toLowerCase();
      for (const [country, coords] of Object.entries(countryMap)) {
        const countryLower = country.toLowerCase();
        if (lastPart === countryLower || lastPart.includes(countryLower) || countryLower.includes(lastPart)) {
          return country;
        }
      }
    }
    
    // Check for US states and map to USA
    const usStates = ['texas', 'california', 'florida', 'new york', 'georgia', 'ohio', 'pennsylvania', 
                      'michigan', 'massachusetts', 'arizona', 'idaho', 'hawaii', 'nevada', 'utah',
                      'colorado', 'north carolina', 'south carolina', 'tennessee', 'kentucky', 'louisiana',
                      'alabama', 'mississippi', 'missouri', 'oklahoma', 'kansas', 'nebraska', 'iowa',
                      'minnesota', 'wisconsin', 'illinois', 'indiana', 'connecticut', 'new jersey',
                      'maryland', 'virginia', 'west virginia', 'vermont', 'new hampshire', 'maine',
                      'rhode island', 'delaware', 'washington', 'oregon', 'montana', 'wyoming',
                      'north dakota', 'south dakota', 'alaska'];
    
    if (usStates.some(state => locationLower.includes(state))) {
      return 'United States';
    }
    
    // Fallback: use location as-is (might be a country we don't have in our map)
    return location;
  }

  // Aggregate posts by country
  updateCountryAggregation() {
    this.countryData.clear();
    
    if (!this.coveragePoints || this.coveragePoints.length === 0) {
      console.warn('[Globe] No coverage points to aggregate');
      return;
    }
    
    console.log('[Globe] Aggregating countries from', this.coveragePoints.length, 'coverage points');
    
    for (const point of this.coveragePoints) {
      if (!point || !point.location) continue;
      
      const country = this.extractCountryName(point.location);
      if (!country) {
        console.debug('[Globe] Could not extract country from location:', point.location);
        continue;
      }
      
      // Try to get coordinates for the country
      let coords = this.getLocationCoordinatesSync(country);
      // If country not found, try using the point's coordinates
      if (!coords && point.lat && point.lng) {
        coords = { lat: point.lat, lng: point.lng };
      }
      
      if (!coords) {
        console.debug('[Globe] No coordinates for country:', country);
        continue;
      }
      
      if (!this.countryData.has(country)) {
        this.countryData.set(country, {
          name: country,
          count: 0,
          posts: [],
          coordinates: coords
        });
      }
      
      const countryInfo = this.countryData.get(country);
      const postCount = Array.isArray(point.posts) ? point.posts.length : 1;
      countryInfo.count += postCount;
      
      if (Array.isArray(point.posts)) {
        countryInfo.posts.push(...point.posts);
      } else {
        countryInfo.posts.push(this.createPostSummary(point));
      }
    }
    
    // Sort posts by timestamp
    for (const countryInfo of this.countryData.values()) {
      countryInfo.posts.sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });
    }
    
    console.log('[Globe] Aggregated', this.countryData.size, 'countries');
  }

  // Update most active regions list
  updateActiveRegionsList() {
    const regionsList = document.getElementById('globe-regions-list');
    if (!regionsList) {
      console.warn('[Globe] Regions list element not found');
      // Retry after a delay
      setTimeout(() => this.updateActiveRegionsList(), 500);
      return;
    }
    
    console.log('[Globe] Updating active regions list, countryData size:', this.countryData.size);
    console.log('[Globe] Coverage points:', this.coveragePoints.length);
    
    // If countryData is empty but we have coverage points, try to aggregate again
    if (this.countryData.size === 0 && this.coveragePoints.length > 0) {
      console.log('[Globe] Country data empty, re-aggregating...');
      this.updateCountryAggregation();
    }
    
    const sortedCountries = Array.from(this.countryData.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    console.log('[Globe] Sorted countries:', sortedCountries.length);
    
    if (sortedCountries.length === 0) {
      regionsList.innerHTML = '<div style="color: rgba(255, 255, 255, 0.5); font-size: 0.85rem; padding: 1rem; text-align: center;">Loading regions...</div>';
      // If we have coverage points but no countries, there might be an issue with country extraction
      if (this.coveragePoints.length > 0) {
        console.warn('[Globe] Have coverage points but no countries extracted. Sample locations:', 
          this.coveragePoints.slice(0, 5).map(p => p.location));
      }
      return;
    }
    
    regionsList.innerHTML = sortedCountries.map((country, index) => `
      <div class="globe-region-item ${this.activeCountry === country.name ? 'active' : ''}" 
           data-country="${country.name}"
           style="padding: 0.75rem; background: rgba(12, 20, 45, 0.6); border-radius: 8px; border: 1px solid rgba(74, 158, 255, 0.2); cursor: pointer; transition: all 0.2s; ${this.activeCountry === country.name ? 'border-color: rgba(74, 158, 255, 0.6); background: rgba(12, 20, 45, 0.9);' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <span style="font-weight: 600; color: #5bc9ff; font-size: 0.9rem;">${country.name}</span>
          <span style="color: rgba(255, 255, 255, 0.7); font-size: 0.85rem;">${country.count}</span>
        </div>
        <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.6);">${this.timeRange} • ${this.selectedCategory}</div>
      </div>
    `).join('');
    
    // Add click handlers
    regionsList.querySelectorAll('.globe-region-item').forEach(item => {
      // Remove existing listeners by cloning
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);
      
      newItem.addEventListener('click', () => {
        const countryName = newItem.dataset.country;
        this.openCountryPanel(countryName);
      });
    });
  }

  // Open country detail panel
  openCountryPanel(countryName) {
    const countryInfo = this.countryData.get(countryName);
    if (!countryInfo) return;
    
    this.activeCountry = countryName;
    this.updateActiveRegionsList();
    
    const panel = document.getElementById('globe-detail-panel');
    const panelContent = document.getElementById('globe-panel-content');
    const overlay = document.getElementById('globe-panel-overlay');
    
    if (!panel || !panelContent) return;
    
    const isMobile = this.isMobile();
    
    // Generate panel content
    const topPosts = countryInfo.posts.slice(0, 10);
    const postItems = topPosts.map(post => `
      <div class="globe-panel-post" style="padding: 0.75rem; margin-bottom: 0.75rem; background: rgba(12, 20, 45, 0.6); border-radius: 8px; border: 1px solid rgba(74, 158, 255, 0.2);">
        <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.95); margin-bottom: 0.5rem; line-height: 1.4;">${post.headline || 'Coverage update'}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: rgba(255, 255, 255, 0.7);">
          <span>${this.formatTimestamp(post.timestamp)}</span>
          ${post.postLink ? `<a href="${post.postLink}" target="_blank" rel="noopener noreferrer" style="color: #5bc9ff; text-decoration: none; font-weight: 600;">Open</a>` : ''}
        </div>
      </div>
    `).join('');
    
    panelContent.innerHTML = `
      <h2 style="font-size: 1.25rem; font-weight: 700; color: #5bc9ff; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">${countryInfo.name}</h2>
      <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 1.5rem;">
        ${countryInfo.count} post${countryInfo.count === 1 ? '' : 's'} • ${this.timeRange}
      </div>
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.9); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Top Posts</h3>
        <div style="max-height: ${isMobile ? '40vh' : '60vh'}; overflow-y: auto;">
          ${postItems || '<div style="color: rgba(255, 255, 255, 0.5);">No posts found</div>'}
        </div>
      </div>
      <a href="/category/?country=${encodeURIComponent(countryInfo.name)}" 
         style="display: block; padding: 0.75rem 1rem; background: rgba(74, 158, 255, 0.2); border: 1px solid rgba(74, 158, 255, 0.4); border-radius: 8px; color: #fff; text-align: center; text-decoration: none; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.85rem; transition: all 0.2s;">
        View all for ${countryInfo.name}
      </a>
    `;
    
    // Show panel (different behavior for mobile vs desktop)
    if (isMobile) {
      panel.style.bottom = '0';
      panel.classList.add('open');
    } else {
      panel.style.right = '0';
    }
    if (overlay) {
      overlay.style.display = 'block';
    }
    
    // Focus globe on country
    if (this.globeInstance && countryInfo.coordinates) {
      this.globeInstance.pointOfView({
        lat: countryInfo.coordinates.lat,
        lng: countryInfo.coordinates.lng,
        altitude: 1.5
      }, 1000);
    }
  }

  // Close country detail panel
  closeCountryPanel() {
    const panel = document.getElementById('globe-detail-panel');
    const overlay = document.getElementById('globe-panel-overlay');
    const isMobile = this.isMobile();
    
    if (panel) {
      if (isMobile) {
        panel.style.bottom = '-100vh';
        panel.classList.remove('open');
      } else {
        panel.style.right = '-400px';
      }
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    this.activeCountry = null;
    this.updateActiveRegionsList();
  }

  // Update globe display with filtered data and country polygons
  updateGlobeDisplay() {
    if (!this.globeInstance) return;
    
    const pointsToShow = this.coveragePoints;
    const isMobile = this.isMobile();
    
    // Update points
    this.globeInstance
      .pointsData(pointsToShow)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointLabel(d => this.getPointLabel(d, isMobile))
      .pointColor(d => {
        const phase = this.getPointPhase(d);
        const pulse = (Math.sin(this.t + phase) + 1) / 2;
        return this.getPointGlowColor(d, pulse);
      })
      .pointRadius(d => this.getPointBaseRadius(d, isMobile))
      .pointAltitude(d => this.getPointBaseAltitude(d, isMobile));
    
    // Update HUD stats
    this.renderHUD(document.getElementById('cia-hud-overlay'));
  }

  // Update point intensities based on country activity
  updatePointIntensities() {
    // Points already have intensity based on post count
    // This is handled in aggregateCoveragePoints
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.globeInstance) {
      this.globeInstance._destructor?.();
    }
    window.removeEventListener('resize', () => this.handleResize());
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.CiaMissionGlobe = CiaMissionGlobe;
}

