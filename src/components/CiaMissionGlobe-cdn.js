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
    
    // Load coverage points
    try {
      const response = await fetch('/src/data/coveragePoints.js');
      const text = await response.text();
      // Extract the array from the module export
      const match = text.match(/const coveragePoints = (\[[\s\S]*?\]);/);
      if (match) {
        this.coveragePoints = eval(match[1]);
      } else {
        // Fallback to default points
        this.coveragePoints = [
          { id: "nyc-incident", lat: 40.7128, lng: -74.0060, location: "New York, USA", headline: "High-rise fire near Midtown", timestamp: "2025-11-21T18:32:00Z" },
          { id: "kyiv-strike", lat: 50.4501, lng: 30.5234, location: "Kyiv, Ukraine", headline: "Explosions reported in central Kyiv", timestamp: "2025-11-23T03:10:00Z" },
          { id: "buenos-aires-blast", lat: -34.6037, lng: -58.3816, location: "Buenos Aires, Argentina", headline: "Industrial-area explosion in Ezeiza", timestamp: "2025-11-20T14:05:00Z" },
          { id: "la-fire", lat: 34.0522, lng: -118.2437, location: "Los Angeles, USA", headline: "Large structure fire downtown", timestamp: "2025-11-19T09:47:00Z" }
        ];
      }
    } catch (err) {
      console.warn('Could not load coverage points, using defaults');
      this.coveragePoints = [
        { id: "nyc-incident", lat: 40.7128, lng: -74.0060, location: "New York, USA", headline: "High-rise fire near Midtown", timestamp: "2025-11-21T18:32:00Z" },
        { id: "kyiv-strike", lat: 50.4501, lng: 30.5234, location: "Kyiv, Ukraine", headline: "Explosions reported in central Kyiv", timestamp: "2025-11-23T03:10:00Z" },
        { id: "buenos-aires-blast", lat: -34.6037, lng: -58.3816, location: "Buenos Aires, Argentina", headline: "Industrial-area explosion in Ezeiza", timestamp: "2025-11-20T14:05:00Z" },
        { id: "la-fire", lat: 34.0522, lng: -118.2437, location: "Los Angeles, USA", headline: "Large structure fire downtown", timestamp: "2025-11-19T09:47:00Z" }
      ];
    }
    
    this.activeOp = this.coveragePoints[0] || null;
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

    // Create root structure
    container.innerHTML = `
      <div class="cia-globe-root">
        <div class="cia-globe-canvas" id="cia-globe-canvas"></div>
        <div class="cia-hud-overlay" id="cia-hud-overlay"></div>
      </div>
    `;

    const canvasEl = document.getElementById('cia-globe-canvas');
    const hudEl = document.getElementById('cia-hud-overlay');
    
    if (!canvasEl || !hudEl) return;

    // Render HUD
    this.renderHUD(hudEl);

    // Initialize globe
    this.globeInstance = Globe()(canvasEl)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('#020617')
      .showAtmosphere(true)
      .atmosphereColor('#22d3ee')
      .atmosphereAltitude(0.28);

    // Configure points
    this.globeInstance
      .pointsData(this.coveragePoints)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointLabel(d => `${d.location}\n${d.headline}`)
      .pointColor(() => '#ff3333')
      .pointRadius(0.35)
      .pointAltitude(0.02);

    // Configure controls
    const controls = this.globeInstance.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.enableZoom = true;
    controls.enablePan = true;

    // Handle point clicks
    this.globeInstance.onPointClick((point) => {
      if (point) {
        this.setActiveOp(point);
      }
    });

    // Handle resize
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Start animation
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

    this.t += 0.03;
    const baseAltitude = 0.02;
    const pulseAmplitude = 0.015;

    this.globeInstance.pointAltitude(d => {
      const phase = (d.lat + d.lng) * 0.1;
      const scale = (Math.sin(this.t + phase) + 1) / 2;
      return baseAltitude + scale * pulseAmplitude;
    });

    this.globeInstance.pointRadius(d => {
      const phase = (d.lat + d.lng) * 0.1;
      const scale = (Math.sin(this.t + phase) + 1) / 2;
      return 0.35 + scale * 0.1;
    });

    this.animationFrameId = requestAnimationFrame(() => this.animate());
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

    container.innerHTML = `
      <!-- Top-left: Mission title -->
      <div class="cia-hud-panel cia-hud-top-left">
        <div class="hud-label">GLOBAL COVERAGE // NOTEWORTHY OPS</div>
        <div class="hud-sub">LIVE FEED • RED CHANNEL</div>
      </div>

      <!-- Top-right: Status panel -->
      <div class="cia-hud-panel cia-hud-top-right">
        <div class="hud-status-line">
          <strong>SYSTEM STATUS:</strong> ONLINE
          <span class="cia-live-dot"></span>
        </div>
        <div class="hud-status-line">
          <strong>ACTIVE TARGETS:</strong> ${this.coveragePoints.length}
        </div>
        <div class="hud-status-line">
          <strong>LATENCY:</strong> ${Math.floor(Math.random() * 20 + 30)} ms
        </div>
        <div class="hud-status-line">
          <strong>LAST UPDATE:</strong> ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <!-- Active operation details -->
      ${this.activeOp ? `
        <div class="cia-hud-panel cia-active-op-panel">
          <div class="hud-label">ACTIVE OPERATION</div>
          <div class="cia-active-op-details">
            <div><strong>LOCATION:</strong> ${this.activeOp.location}</div>
            <div><strong>COORDINATES:</strong> ${this.activeOp.lat.toFixed(4)}°, ${this.activeOp.lng.toFixed(4)}°</div>
            <div><strong>EVENT:</strong> ${this.activeOp.headline}</div>
            <div><strong>TIMESTAMP:</strong> ${this.formatTimestamp(this.activeOp.timestamp)}</div>
          </div>
        </div>
      ` : ''}

      <!-- Bottom strip: Recent operations -->
      <div class="cia-hud-bottom-strip">
        ${this.coveragePoints.slice(0, 8).map((point) => `
          <div
            class="cia-op-item ${this.activeOp?.id === point.id ? 'active' : ''}"
            data-op-id="${point.id}"
          >
            <div class="cia-op-location">${point.location}</div>
            <div class="cia-op-headline">${point.headline}</div>
            <div class="cia-op-coords">
              ${point.lat.toFixed(2)}°, ${point.lng.toFixed(2)}°
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add click handlers for operation items
    container.querySelectorAll('.cia-op-item').forEach(item => {
      item.addEventListener('click', () => {
        const opId = item.getAttribute('data-op-id');
        const point = this.coveragePoints.find(p => p.id === opId);
        if (point) {
          this.setActiveOp(point);
        }
      });
    });
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

