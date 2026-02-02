/**
 * ==========================================================================
 * COMMAND CENTER - The Beast Mode Experience
 * Noteworthy News - Cinematic News Interface
 * ==========================================================================
 * 
 * A full-screen immersive news experience combining:
 * - 3D Globe visualization with live news markers
 * - Real-time news feed with smooth animations
 * - AI-powered voice commands and briefings
 * - Gamified engagement (streaks, achievements)
 * - Live activity dashboard
 * 
 * ==========================================================================
 */

class CommandCenter {
  constructor() {
    this.isActive = false;
    this.isVoiceActive = false;
    this.recognition = null;
    this.globeInstance = null;
    this.newsData = [];
    this.userStats = {
      streak: 0,
      rank: 0,
      articlesRead: 0
    };
    this.achievements = [];
    this.liveReaders = 0;
    
    // Bind methods
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.toggleVoice = this.toggleVoice.bind(this);
    this.handleVoiceCommand = this.handleVoiceCommand.bind(this);
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }
  
  init() {
    this.createTriggerButton();
    this.createCommandCenterShell();
    this.setupKeyboardShortcuts();
    this.loadUserStats();
    console.log('[Command Center] Initialized');
  }
  
  /**
   * Create the floating trigger button
   */
  createTriggerButton() {
    const trigger = document.createElement('button');
    trigger.className = 'command-center-trigger';
    trigger.setAttribute('aria-label', 'Open Command Center');
    trigger.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      <span class="trigger-label">Command Center</span>
    `;
    trigger.addEventListener('click', this.open);
    document.body.appendChild(trigger);
    this.triggerBtn = trigger;
  }
  
  /**
   * Create the Command Center shell HTML
   */
  createCommandCenterShell() {
    const shell = document.createElement('div');
    shell.className = 'command-center';
    shell.id = 'commandCenter';
    shell.innerHTML = `
      <!-- Header -->
      <header class="cc-header">
        <div class="cc-logo">
          <div class="cc-logo-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span class="cc-logo-text">Command Center</span>
        </div>
        
        <div class="cc-header-actions">
          <button class="cc-btn cc-btn-voice" id="ccVoiceBtn" aria-label="Voice Commands">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93V7h2v1c0 2.76 2.24 5 5 5s5-2.24 5-5V7h2v1c0 4.08-3.06 7.44-7 7.93V19h4v2H7v-2h4v-3.07z"/>
            </svg>
            <span>Voice</span>
          </button>
          <button class="cc-btn cc-btn-exit" id="ccExitBtn" aria-label="Exit Command Center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            <span>Exit</span>
          </button>
        </div>
      </header>
      
      <!-- Main Content Grid -->
      <main class="cc-main">
        <!-- Globe Panel -->
        <section class="cc-panel cc-globe-panel">
          <div class="cc-panel-header">
            <h2 class="cc-panel-title">Global News Map</h2>
            <span class="cc-panel-badge live">Live</span>
          </div>
          <div class="cc-globe-container" id="ccGlobeContainer">
            <!-- Globe.gl will render here -->
          </div>
          <div class="cc-globe-hud">
            <div class="cc-globe-stat">
              <span class="cc-globe-stat-label">Stories</span>
              <span class="cc-globe-stat-value" id="ccStoryCount">0</span>
            </div>
            <div class="cc-globe-stat">
              <span class="cc-globe-stat-label">Regions</span>
              <span class="cc-globe-stat-value" id="ccRegionCount">0</span>
            </div>
            <div class="cc-globe-stat">
              <span class="cc-globe-stat-label">Updated</span>
              <span class="cc-globe-stat-value" id="ccLastUpdate">--:--</span>
            </div>
          </div>
        </section>
        
        <!-- News Feed Panel -->
        <section class="cc-panel cc-feed-panel">
          <div class="cc-panel-header">
            <h2 class="cc-panel-title">Live News Feed</h2>
            <span class="cc-panel-badge" id="ccNewCount">0 new</span>
          </div>
          <div class="cc-feed-list" id="ccFeedList">
            <!-- News cards will be populated here -->
            <div class="cc-feed-loading">
              <div class="cc-loading-spinner"></div>
              <span>Loading intelligence...</span>
            </div>
          </div>
        </section>
        
        <!-- Bottom Stats Row -->
        <div class="cc-bottom-row">
          <!-- AI Briefing Panel -->
          <section class="cc-panel cc-stats-panel cc-briefing-panel">
            <div class="cc-briefing-avatar">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
            </div>
            <div class="cc-briefing-content">
              <p class="cc-briefing-greeting" id="ccGreeting">Good evening</p>
              <p class="cc-briefing-status" id="ccBriefingStatus">Your daily briefing is ready</p>
            </div>
            <button class="cc-briefing-btn" id="ccPlayBriefing">
              Play Briefing
            </button>
          </section>
          
          <!-- User Stats Panel -->
          <section class="cc-panel cc-stats-panel">
            <div class="cc-panel-header">
              <h2 class="cc-panel-title">Your Stats</h2>
            </div>
            <div class="cc-user-stats">
              <div class="cc-stat-item">
                <div class="cc-stat-value" id="ccStreak">0</div>
                <div class="cc-stat-label">Day Streak</div>
              </div>
              <div class="cc-stat-item">
                <div class="cc-stat-value" id="ccRank">#--</div>
                <div class="cc-stat-label">Global Rank</div>
              </div>
              <div class="cc-stat-item">
                <div class="cc-stat-value" id="ccArticles">0</div>
                <div class="cc-stat-label">Articles Read</div>
              </div>
            </div>
          </section>
          
          <!-- Live Activity Panel -->
          <section class="cc-panel cc-stats-panel">
            <div class="cc-panel-header">
              <h2 class="cc-panel-title">Live Activity</h2>
            </div>
            <div class="cc-activity-list">
              <div class="cc-activity-item">
                <span class="cc-activity-dot"></span>
                <span class="cc-activity-text">Readers online:</span>
                <span class="cc-activity-value" id="ccLiveReaders">--</span>
              </div>
              <div class="cc-activity-item">
                <span class="cc-activity-dot"></span>
                <span class="cc-activity-text">New stories today:</span>
                <span class="cc-activity-value" id="ccNewStories">--</span>
              </div>
            </div>
          </section>
        </div>
      </main>
      
      <!-- Voice Assistant Overlay -->
      <div class="cc-voice-overlay" id="ccVoiceOverlay">
        <div class="cc-voice-visualizer">
          <svg class="cc-voice-icon" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93V7h2v1c0 2.76 2.24 5 5 5s5-2.24 5-5V7h2v1c0 4.08-3.06 7.44-7 7.93V19h4v2H7v-2h4v-3.07z"/>
          </svg>
        </div>
        <p class="cc-voice-status" id="ccVoiceStatus">Listening...</p>
        <p class="cc-voice-hint">Say "read headlines", "what's breaking", or "exit"</p>
      </div>
      
      <!-- Breaking News Ticker -->
      <div class="cc-ticker" id="ccTicker">
        <div class="cc-ticker-label">BREAKING</div>
        <div class="cc-ticker-content">
          <span class="cc-ticker-text" id="ccTickerText"></span>
        </div>
      </div>
    `;
    
    document.body.appendChild(shell);
    this.shell = shell;
    
    // Attach event listeners
    document.getElementById('ccExitBtn').addEventListener('click', this.close);
    document.getElementById('ccVoiceBtn').addEventListener('click', this.toggleVoice);
    document.getElementById('ccPlayBriefing').addEventListener('click', () => this.playDailyBriefing());
  }
  
  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape to close
      if (e.key === 'Escape' && this.isActive) {
        this.close();
      }
      // Ctrl/Cmd + K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (this.isActive) {
          this.close();
        } else {
          this.open();
        }
      }
    });
  }
  
  /**
   * Open Command Center with View Transitions
   */
  async open() {
    if (this.isActive) return;
    
    // Use View Transitions API if available
    if (document.startViewTransition) {
      await document.startViewTransition(() => {
        this.shell.classList.add('active');
        this.triggerBtn.style.display = 'none';
        document.body.style.overflow = 'hidden';
      }).finished;
    } else {
      this.shell.classList.add('active');
      this.triggerBtn.style.display = 'none';
      document.body.style.overflow = 'hidden';
    }
    
    this.isActive = true;
    
    // Initialize components
    await this.initializeGlobe();
    await this.loadNewsFeed();
    this.updateGreeting();
    this.startLiveUpdates();
    
    // Track achievement
    if (window.Achievements) {
      window.Achievements.trackCommandCenterOpened();
    }
    
    console.log('[Command Center] Opened');
  }
  
  /**
   * Close Command Center
   */
  async close() {
    if (!this.isActive) return;
    
    // Stop live updates
    this.stopLiveUpdates();
    
    // Use View Transitions API if available
    if (document.startViewTransition) {
      await document.startViewTransition(() => {
        this.shell.classList.remove('active');
        this.triggerBtn.style.display = 'flex';
        document.body.style.overflow = '';
      }).finished;
    } else {
      this.shell.classList.remove('active');
      this.triggerBtn.style.display = 'flex';
      document.body.style.overflow = '';
    }
    
    this.isActive = false;
    console.log('[Command Center] Closed');
  }
  
  /**
   * Initialize the 3D Globe using pure Three.js (avoids conflicts with globe.gl)
   */
  async initializeGlobe() {
    const container = document.getElementById('ccGlobeContainer');
    if (!container || this.globeInstance) return;
    
    try {
      // Use existing THREE.js from the page
      if (typeof THREE === 'undefined') {
        throw new Error('THREE.js not available');
      }
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      // Create scene, camera, renderer
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#030712');
      
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 300;
      
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      
      // Add ambient light
      const ambientLight = new THREE.AmbientLight(0x333344, 2);
      scene.add(ambientLight);
      
      // Add directional light
      const directionalLight = new THREE.DirectionalLight(0x06b6d4, 1.5);
      directionalLight.position.set(5, 3, 5);
      scene.add(directionalLight);
      
      // Create Earth globe
      const geometry = new THREE.SphereGeometry(100, 64, 64);
      const textureLoader = new THREE.TextureLoader();
      
      const earthTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-dark.jpg');
      const bumpTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');
      
      const material = new THREE.MeshPhongMaterial({
        map: earthTexture,
        bumpMap: bumpTexture,
        bumpScale: 1.5,
        specular: new THREE.Color('#06b6d4'),
        shininess: 5
      });
      
      const globe = new THREE.Mesh(geometry, material);
      scene.add(globe);
      
      // Create atmosphere glow
      const atmosphereGeometry = new THREE.SphereGeometry(105, 64, 64);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(0.024, 0.714, 0.831, 1.0) * intensity;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
      });
      
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      scene.add(atmosphere);
      
      // Add markers group for news locations
      const markersGroup = new THREE.Group();
      scene.add(markersGroup);
      
      // Animation loop
      let animationId;
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        globe.rotation.y += 0.002;
        atmosphere.rotation.y += 0.002;
        markersGroup.rotation.y += 0.002;
        renderer.render(scene, camera);
      };
      animate();
      
      // Store references for cleanup and updates
      this.globeInstance = {
        scene,
        camera,
        renderer,
        globe,
        markersGroup,
        destroy: () => {
          cancelAnimationFrame(animationId);
          renderer.dispose();
          container.innerHTML = '';
        },
        addMarker: (lat, lng, color = '#06b6d4', size = 2) => {
          // Convert lat/lng to 3D position
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lng + 180) * (Math.PI / 180);
          const radius = 102;
          
          const x = -(radius * Math.sin(phi) * Math.cos(theta));
          const y = radius * Math.cos(phi);
          const z = radius * Math.sin(phi) * Math.sin(theta);
          
          const markerGeometry = new THREE.SphereGeometry(size, 16, 16);
          const markerMaterial = new THREE.MeshBasicMaterial({ color });
          const marker = new THREE.Mesh(markerGeometry, markerMaterial);
          marker.position.set(x, y, z);
          markersGroup.add(marker);
          return marker;
        },
        clearMarkers: () => {
          while (markersGroup.children.length > 0) {
            const marker = markersGroup.children[0];
            marker.geometry.dispose();
            marker.material.dispose();
            markersGroup.remove(marker);
          }
        }
      };
      
      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      });
      resizeObserver.observe(container);
      
      console.log('[Command Center] Globe initialized (pure Three.js)');
    } catch (err) {
      console.error('[Command Center] Failed to load Globe:', err);
      // Fallback: animated gradient background
      container.innerHTML = `
        <div class="cc-globe-fallback">
          <div class="cc-globe-circle"></div>
          <div class="cc-globe-label">Global Coverage</div>
        </div>
      `;
    }
  }
  
  /**
   * Update globe with news markers
   */
  updateGlobeMarkers(posts) {
    if (!this.globeInstance || !this.globeInstance.addMarker) return;
    
    // Clear existing markers
    this.globeInstance.clearMarkers();
    
    const markers = posts
      .filter(post => post.location && post.location.lat && post.location.lng)
      .map(post => ({
        lat: post.location.lat,
        lng: post.location.lng,
        label: post.text?.substring(0, 100) || 'News Update',
        size: post.isBreaking ? 3 : 2,
        color: post.isBreaking ? '#ef4444' : '#06b6d4'
      }));
    
    // Add new markers
    markers.forEach(m => {
      this.globeInstance.addMarker(m.lat, m.lng, m.color, m.size);
    });
    
    // Update stats
    document.getElementById('ccStoryCount').textContent = posts.length;
    document.getElementById('ccRegionCount').textContent = new Set(markers.map(m => `${Math.round(m.lat)},${Math.round(m.lng)}`)).size;
    document.getElementById('ccLastUpdate').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Load news feed from API
   */
  async loadNewsFeed() {
    const feedList = document.getElementById('ccFeedList');
    
    try {
      const response = await fetch('/.netlify/functions/posts-read?limit=20');
      const posts = await response.json();
      
      this.newsData = posts;
      this.renderNewsFeed(posts);
      this.updateGlobeMarkers(posts);
      
      document.getElementById('ccNewStories').textContent = posts.length;
      
    } catch (err) {
      console.error('[Command Center] Failed to load news:', err);
      feedList.innerHTML = '<div class="cc-feed-error">Failed to load news feed</div>';
    }
  }
  
  /**
   * Render news cards with staggered animation
   */
  renderNewsFeed(posts) {
    const feedList = document.getElementById('ccFeedList');
    feedList.innerHTML = '';
    
    posts.forEach((post, index) => {
      const card = document.createElement('article');
      card.className = `cc-news-card${post.isBreaking ? ' breaking' : ''}`;
      card.style.animationDelay = `${index * 50}ms`;
      card.style.opacity = '0';
      card.style.transform = 'translateX(-20px)';
      
      const timeAgo = this.getTimeAgo(post.timestamp || post.createdAt);
      const category = post.category || 'News';
      
      card.innerHTML = `
        <div class="cc-news-meta">
          <span class="cc-news-category">${category}</span>
          <span class="cc-news-time">${timeAgo}</span>
        </div>
        <h3 class="cc-news-headline">${this.escapeHtml(post.text?.substring(0, 150) || 'News Update')}</h3>
        ${post.location?.name ? `
          <div class="cc-news-location">
            <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span>${post.location.name}</span>
          </div>
        ` : ''}
      `;
      
      // Click to open article
      card.addEventListener('click', () => {
        if (post.url) {
          window.open(post.url, '_blank');
        } else {
          window.location.href = `#news-section`;
          this.close();
        }
      });
      
      feedList.appendChild(card);
      
      // Animate in
      requestAnimationFrame(() => {
        setTimeout(() => {
          card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        }, index * 50);
      });
    });
  }
  
  /**
   * Update greeting based on time of day
   */
  updateGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    
    document.getElementById('ccGreeting').textContent = greeting;
  }
  
  /**
   * Load user stats from API
   */
  async loadUserStats() {
    try {
      const response = await fetch('/.netlify/functions/track-visit-streak');
      const data = await response.json();
      
      if (data.streak) {
        this.userStats.streak = data.streak;
        document.getElementById('ccStreak').textContent = data.streak;
      }
    } catch (err) {
      console.log('[Command Center] Could not load user stats');
    }
  }
  
  /**
   * Start live update polling
   */
  startLiveUpdates() {
    // Poll for new stories every 30 seconds
    this.updateInterval = setInterval(() => {
      this.loadNewsFeed();
    }, 30000);
    
    // Simulate live readers (replace with real WebSocket later)
    this.updateLiveReaders();
    this.readersInterval = setInterval(() => {
      this.updateLiveReaders();
    }, 5000);
  }
  
  /**
   * Stop live updates
   */
  stopLiveUpdates() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    if (this.readersInterval) clearInterval(this.readersInterval);
  }
  
  /**
   * Update live readers count
   */
  updateLiveReaders() {
    // Simulate fluctuating reader count
    const base = 15;
    const variance = Math.floor(Math.random() * 20);
    this.liveReaders = base + variance;
    document.getElementById('ccLiveReaders').textContent = this.liveReaders;
  }
  
  /**
   * Toggle voice commands
   */
  toggleVoice() {
    const overlay = document.getElementById('ccVoiceOverlay');
    const btn = document.getElementById('ccVoiceBtn');
    
    if (this.isVoiceActive) {
      // Stop listening
      if (this.recognition) {
        this.recognition.stop();
      }
      overlay.classList.remove('active');
      btn.classList.remove('listening');
      this.isVoiceActive = false;
    } else {
      // Start listening
      this.startVoiceRecognition();
      overlay.classList.add('active');
      btn.classList.add('listening');
      this.isVoiceActive = true;
    }
  }
  
  /**
   * Start voice recognition
   */
  startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice commands are not supported in this browser.');
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log('[Voice] Heard:', transcript);
      this.handleVoiceCommand(transcript);
    };
    
    this.recognition.onerror = (event) => {
      console.error('[Voice] Error:', event.error);
      document.getElementById('ccVoiceStatus').textContent = 'Error: ' + event.error;
    };
    
    this.recognition.onend = () => {
      if (this.isVoiceActive) {
        // Restart if still active
        setTimeout(() => {
          if (this.isVoiceActive) {
            this.recognition.start();
          }
        }, 100);
      }
    };
    
    this.recognition.start();
  }
  
  /**
   * Handle voice commands
   */
  handleVoiceCommand(transcript) {
    const statusEl = document.getElementById('ccVoiceStatus');
    
    // Track voice achievement
    if (window.Achievements) {
      window.Achievements.trackVoiceUsed();
    }
    
    if (transcript.includes('read headline') || transcript.includes('what\'s breaking')) {
      statusEl.textContent = 'Reading headlines...';
      this.readHeadlines();
    } else if (transcript.includes('exit') || transcript.includes('close')) {
      statusEl.textContent = 'Closing...';
      this.toggleVoice();
      this.close();
    } else if (transcript.includes('briefing') || transcript.includes('summary')) {
      statusEl.textContent = 'Playing briefing...';
      this.toggleVoice();
      this.playDailyBriefing();
    } else {
      statusEl.textContent = `Heard: "${transcript}"`;
    }
  }
  
  /**
   * Read headlines using TTS
   */
  async readHeadlines() {
    if (this.newsData.length === 0) {
      this.speak('No headlines available right now.');
      return;
    }
    
    const headlines = this.newsData.slice(0, 3).map(post => 
      post.text?.substring(0, 100) || 'News update'
    );
    
    const intro = `Here are the top ${headlines.length} headlines:`;
    const text = intro + headlines.map((h, i) => ` ${i + 1}. ${h}`).join('.');
    
    this.speak(text);
  }
  
  /**
   * Play daily AI briefing
   */
  async playDailyBriefing() {
    const btn = document.getElementById('ccPlayBriefing');
    const status = document.getElementById('ccBriefingStatus');
    
    btn.disabled = true;
    btn.textContent = 'Generating...';
    status.textContent = 'AI is preparing your briefing...';
    
    try {
      // Call AI endpoint to generate briefing
      const response = await fetch('/.netlify/functions/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a brief 30-second news briefing summary of the most important current events. Be concise and professional, like a news anchor. Start with a greeting based on the time of day.`
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.message) {
        this.speak(data.message);
        status.textContent = 'Playing briefing...';
        
        // Track achievement
        if (window.Achievements) {
          window.Achievements.trackBriefingPlayed();
        }
      } else {
        throw new Error('Failed to generate briefing');
      }
    } catch (err) {
      console.error('[Briefing] Error:', err);
      status.textContent = 'Could not generate briefing';
      this.speak('I apologize, but I could not generate your briefing at this time.');
    }
    
    btn.disabled = false;
    btn.textContent = 'Play Briefing';
  }
  
  /**
   * Text-to-speech
   */
  speak(text) {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Try to use a professional-sounding voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Samantha')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }
  
  /**
   * Show breaking news ticker
   */
  showBreakingTicker(text) {
    const ticker = document.getElementById('ccTicker');
    const tickerText = document.getElementById('ccTickerText');
    
    tickerText.textContent = text;
    ticker.classList.add('active');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      ticker.classList.remove('active');
    }, 10000);
  }
  
  /**
   * Utility: Get time ago string
   */
  getTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  /**
   * Utility: Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize Command Center
window.CommandCenter = new CommandCenter();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommandCenter;
}
