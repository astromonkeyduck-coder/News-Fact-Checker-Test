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
    
    this.loadDependencies().then(() => this.init());
  }

  async loadDependencies() {
    // Load Three.js first (required by globe.gl)
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
    
    // Load globe.gl
    await loadScript('https://cdn.jsdelivr.net/npm/globe.gl@2.32.0/dist/globe.gl.min.js');
    
    // Load CSS
    loadCSS('/src/styles/ciaGlobe.css');
    
    // Extract locations from posts
    this.coveragePoints = await this.extractLocationsFromPosts();
    
    if (this.coveragePoints.length === 0) {
      // Fallback to default points if no posts found
      this.coveragePoints = [
        { id: "nyc-incident", lat: 40.7128, lng: -74.0060, location: "New York, USA", headline: "High-rise fire near Midtown", timestamp: "2025-11-21T18:32:00Z" },
        { id: "kyiv-strike", lat: 50.4501, lng: 30.5234, location: "Kyiv, Ukraine", headline: "Explosions reported in central Kyiv", timestamp: "2025-11-23T03:10:00Z" },
        { id: "buenos-aires-blast", lat: -34.6037, lng: -58.3816, location: "Buenos Aires, Argentina", headline: "Industrial-area explosion in Ezeiza", timestamp: "2025-11-20T14:05:00Z" },
        { id: "la-fire", lat: 34.0522, lng: -118.2437, location: "Los Angeles, USA", headline: "Large structure fire downtown", timestamp: "2025-11-19T09:47:00Z" }
      ];
    }
    
    this.activeOp = this.coveragePoints[0] || null;
  }

  // Country name to coordinates mapping (from geography game)
  getCountryCoordinates(countryName) {
    const countryMap = {
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

  // Extract country names from post text
  extractCountryFromPost(post) {
    const text = (post.text || post.story || post.title || '').toLowerCase();
    
    // Extended country list with common names and variations
    const countryMap = {
      'china': 'China',
      'india': 'India',
      'united states': 'United States',
      'usa': 'United States',
      'us': 'United States',
      'america': 'United States',
      'indonesia': 'Indonesia',
      'pakistan': 'Pakistan',
      'brazil': 'Brazil',
      'bangladesh': 'Bangladesh',
      'russia': 'Russia',
      'russian': 'Russia',
      'mexico': 'Mexico',
      'japan': 'Japan',
      'philippines': 'Philippines',
      'egypt': 'Egypt',
      'ethiopia': 'Ethiopia',
      'vietnam': 'Vietnam',
      'congo': 'Democratic Republic of the Congo',
      'drc': 'Democratic Republic of the Congo',
      'iran': 'Iran',
      'türkiye': 'Turkey',
      'turkey': 'Turkey',
      'germany': 'Germany',
      'thailand': 'Thailand',
      'united kingdom': 'United Kingdom',
      'uk': 'United Kingdom',
      'britain': 'United Kingdom',
      'france': 'France',
      'italy': 'Italy',
      'spain': 'Spain',
      'canada': 'Canada',
      'australia': 'Australia',
      'south korea': 'South Korea',
      'korea': 'South Korea',
      'argentina': 'Argentina',
      'south africa': 'South Africa',
      'ukraine': 'Ukraine',
      'poland': 'Poland',
      'iraq': 'Iraq',
      'afghanistan': 'Afghanistan',
      'saudi arabia': 'Saudi Arabia',
      'saudi': 'Saudi Arabia',
      'uzbekistan': 'Uzbekistan',
      'peru': 'Peru',
      'malaysia': 'Malaysia',
      'angola': 'Angola',
      'mozambique': 'Mozambique',
      'ghana': 'Ghana',
      'yemen': 'Yemen',
      'nepal': 'Nepal',
      'nigeria': 'Nigeria',
      'venezuela': 'Venezuela'
    };

    // Check for country names in text (with word boundaries)
    for (const [key, country] of Object.entries(countryMap)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(text)) {
        return country;
      }
    }

    return null;
  }

  // Extract locations from posts and convert to coordinates
  async extractLocationsFromPosts() {
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

      // Track how many posts per country to add slight randomization
      const countryCounts = new Map();

      // Extract ALL posts with locations - show every country mentioned
      for (const post of posts) {
        const country = this.extractCountryFromPost(post);
        if (country) {
          const coords = this.getCountryCoordinates(country);
          if (coords) {
            // Count posts per country for randomization
            const count = (countryCounts.get(country) || 0) + 1;
            countryCounts.set(country, count);
            
            // Add slight randomization to prevent exact overlap
            // Spread posts from same country in a small radius
            const spreadRadius = 2; // degrees
            const angle = (count * 137.5) % 360; // Golden angle for even distribution
            const distance = Math.min(count * 0.3, spreadRadius); // Gradually spread out
            
            const latOffset = (Math.cos(angle * Math.PI / 180) * distance);
            const lngOffset = (Math.sin(angle * Math.PI / 180) * distance / Math.cos(coords.lat * Math.PI / 180));
            
            const postText = post.text || post.story || post.title || '';
            const headline = postText.length > 60 ? postText.substring(0, 57) + '...' : postText;
            
            coveragePoints.push({
              id: `post-${post.id || Date.now()}-${country}-${count}`,
              lat: coords.lat + latOffset,
              lng: coords.lng + lngOffset,
              location: country,
              headline: headline || `Coverage from ${country}`,
              timestamp: post.createdAt || post.datePosted || new Date().toISOString(),
              postId: post.id
            });
          }
        }
      }

      console.log(`[Globe] Extracted ${coveragePoints.length} locations from ${posts.length} posts`);
      return coveragePoints;
    } catch (err) {
      console.error('[Globe] Error extracting locations from posts:', err);
      return [];
    }
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

    // Create root structure with mobile class
    container.innerHTML = `
      <div class="cia-globe-root ${isMobile ? 'mobile' : ''}">
        <div class="cia-globe-canvas" id="cia-globe-canvas"></div>
        <div class="cia-hud-overlay ${isMobile ? 'mobile-simple' : ''}" id="cia-hud-overlay"></div>
      </div>
    `;

    const canvasEl = document.getElementById('cia-globe-canvas');
    const hudEl = document.getElementById('cia-hud-overlay');
    
    if (!canvasEl || !hudEl) return;

    // Render HUD (simplified on mobile)
    this.renderHUD(hudEl);

    // Initialize globe with blue theme that blends with website
    this.globeInstance = Globe()(canvasEl)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg') // Blue earth image
      .bumpImageUrl(isMobile ? null : '//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('#07152a') // Match website background
      .showAtmosphere(true)
      .atmosphereColor('#4A9EFF') // Blue atmosphere to match site
      .atmosphereAltitude(0.15);

    // Configure points - show all countries
    this.globeInstance
      .pointsData(this.coveragePoints)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointLabel(isMobile ? d => d.location : d => `${d.location}\n${d.headline}`)
      .pointColor(() => '#4A9EFF') // Blue dots to match site theme
      .pointRadius(isMobile ? 0.4 : 0.5)
      .pointAltitude(isMobile ? 0.02 : 0.03)
      .pointResolution(isMobile ? 4 : 8)
      .pointsTransitionDuration(isMobile ? 500 : 1000);

    // Configure controls - ensure full globe is visible
    const controls = this.globeInstance.controls();
    controls.autoRotate = !isMobile;
    controls.autoRotateSpeed = 0.5; // Slower rotation
    controls.enableZoom = true;
    controls.enablePan = !isMobile;
    controls.enableDamping = !isMobile;
    
    // Set camera distance to show entire globe
    controls.minDistance = 200;
    controls.maxDistance = 800;
    
    // Set initial camera position to show entire globe clearly
    setTimeout(() => {
      // Higher altitude shows more of the globe
      this.globeInstance.pointOfView({ lat: 0, lng: 0, altitude: 3.0 }, 0);
    }, 100);

    // Handle point clicks
    this.globeInstance.onPointClick((point) => {
      if (point) {
        this.setActiveOp(point);
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
    
    const baseAltitude = isMobile ? 0.02 : 0.03;
    const pulseAmplitude = isMobile ? 0.01 : 0.02; // Smaller pulse on mobile

    this.globeInstance.pointAltitude(d => {
      const phase = (d.lat + d.lng) * 0.1;
      const scale = (Math.sin(this.t + phase) + 1) / 2;
      return baseAltitude + scale * pulseAmplitude;
    });

    this.globeInstance.pointRadius(d => {
      const phase = (d.lat + d.lng) * 0.1;
      const scale = (Math.sin(this.t + phase) + 1) / 2;
      const baseRadius = isMobile ? 0.5 : 0.6;
      const pulseSize = isMobile ? 0.15 : 0.3; // Smaller pulse on mobile
      return baseRadius + scale * pulseSize;
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

  renderHUD(container) {
    if (!container) return;

    // Simple, clean HUD - no CIA styling
    const isMobile = this.isMobile();
    const uniqueCountries = new Set(this.coveragePoints.map(p => p.location));
    
    container.innerHTML = `
      <!-- Simple top bar -->
      <div class="globe-hud-simple">
        <div class="globe-hud-title">Global Coverage</div>
        <div class="globe-hud-count">${uniqueCountries.size} Countries • ${this.coveragePoints.length} Stories</div>
      </div>

      <!-- Active location (if selected) -->
      ${this.activeOp ? `
        <div class="globe-hud-active">
          <div class="globe-hud-location">${this.activeOp.location}</div>
          <div class="globe-hud-story">${this.activeOp.headline}</div>
        </div>
      ` : ''}
    `;
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

