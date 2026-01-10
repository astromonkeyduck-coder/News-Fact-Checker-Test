/**
 * Intel Loader - Cinematic Intelligence Terminal Loading Screen
 * 
 * A high-tech, CIA/NSA-style loading screen for Situation Monitor.
 * Full-screen overlay with orbital core, terminal text, and progress HUD.
 * 
 * DESIGN PRINCIPLES:
 * - Created entirely in JS (no hardcoded HTML)
 * - Blocks pointer events while active
 * - Removed from DOM after exit (no memory leaks)
 * - All functions are idempotent
 * - Initialized only once (singleton pattern)
 * - GPU-accelerated animations only
 * - Proper cleanup of all timers
 * - Full reduced-motion support
 * - WCAG-compliant contrast
 */

// Loader state (singleton pattern)
let loaderElement = null;
let isVisible = false;
let isInitialized = false;
let currentPhase = 'AUTH';
let currentProgress = 0;
let progressAnimation = null;
let terminalLines = [];
let signalAnimationInterval = null;
let utcTimeInterval = null;
let uptimeInterval = null;
let noiseCanvas = null;
let noiseCtx = null;
let noiseFrame = null;
let reducedMotion = false;
let pointerEventsRestored = true;

// Phase messages (centralized, easy to modify)
const PHASE_MESSAGES = {
  AUTH: {
    title: 'AUTHENTICATING SESSION',
    lines: [
      'AUTHENTICATING SESSION…',
      'HANDSHAKE OK',
      'VERIFYING CREDENTIALS…',
      'ACCESS GRANTED'
    ]
  },
  DECRYPT: {
    title: 'DECRYPTING SIGNALS',
    lines: [
      'PULLING RSS SIGNALS…',
      'DECRYPTING FEED STREAMS…',
      'NORMALIZING FEED ITEMS…',
      'PARSING HEADLINES…'
    ]
  },
  SYNC: {
    title: 'SYNCING DATA',
    lines: [
      'GEOCODING EVENTS…',
      'CLASSIFYING SEVERITY…',
      'BUILDING EVENT PIPELINE…',
      'DEDUPLICATING ITEMS…'
    ]
  },
  RENDER: {
    title: 'RENDERING MAP',
    lines: [
      'LOADING TOPOLOGY DATA…',
      'INITIALIZING MAP VIEW…',
      'RENDERING EVENT MARKERS…',
      'APPLYING CLUSTERS…'
    ]
  },
  READY: {
    title: 'SYSTEM READY',
    lines: [
      'ALL SYSTEMS OPERATIONAL',
      'INTEL MONITOR ONLINE',
      'READY FOR ANALYSIS'
    ]
  }
};

// Scramble constants removed - no longer using scramble effect

/**
 * Clean up all timers and animations
 */
function cleanupAllTimers() {
  // Clear progress simulation
  if (progressAnimation) {
    clearInterval(progressAnimation);
    progressAnimation = null;
  }
  
  // Clear animation intervals
  if (signalAnimationInterval) {
    clearInterval(signalAnimationInterval);
    signalAnimationInterval = null;
  }
  
  if (utcTimeInterval) {
    clearInterval(utcTimeInterval);
    utcTimeInterval = null;
  }
  
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
    uptimeInterval = null;
  }
  
  // Stop noise animation
  if (noiseFrame) {
    cancelAnimationFrame(noiseFrame);
    noiseFrame = null;
  }
}

/**
 * Initialize the loader (idempotent, singleton)
 */
export function initIntelLoader() {
  if (isInitialized) return; // Only initialize once
  
  // Check for reduced motion preference
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Create loader DOM
  createLoaderDOM();
  
  // Initialize noise canvas if not reduced motion
  if (!reducedMotion) {
    initNoiseCanvas();
  }
  
  // Note: Event listeners for 'nn:loader:phase' and 'nn:loader:progress' are for EXTERNAL consumers only
  // (e.g., audio hooks). We do NOT listen to our own events to avoid infinite recursion.
  // External code can listen to these events, but we dispatch them without listening.
  
  isInitialized = true;
}

/**
 * Create loader DOM structure (entirely in JS, no hardcoded HTML)
 */
function createLoaderDOM() {
  if (loaderElement) return; // Already created
  
  loaderElement = document.createElement('div');
  loaderElement.id = 'nn-intel-loader';
  loaderElement.setAttribute('aria-live', 'polite');
  loaderElement.setAttribute('role', 'status');
  loaderElement.setAttribute('aria-label', 'Loading Situation Monitor');
  loaderElement.className = 'nn-il-hidden';
  loaderElement.style.pointerEvents = 'all'; // Block all interactions
  
  loaderElement.innerHTML = `
    <div class="nn-il-backdrop"></div>
    <canvas class="nn-il-noise" id="nn-il-noise-canvas"></canvas>
    <div class="nn-il-scanline"></div>
    
    <!-- Top HUD Bar -->
    <div class="nn-il-top-bar">
      <div class="nn-il-top-left">NOTEWORTHY NEWS // INTEL MONITOR</div>
      <div class="nn-il-top-right">
        <span id="nn-il-utc-time">02:13 UTC</span>
        <span class="nn-il-secure-indicator">SECURE</span>
      </div>
    </div>
    
    <!-- Left Column: Subsystems + Text -->
    <div class="nn-il-left-column">
      <!-- Subsystem Progress Indicators -->
      <div class="nn-il-subsystems">
        <div class="nn-il-subsystem" data-subsystem="map">
          <div class="nn-il-subsystem-label">MAP ENGINE</div>
          <div class="nn-il-subsystem-bar">
            <div class="nn-il-subsystem-fill" data-subsystem="map"></div>
          </div>
          <div class="nn-il-subsystem-percent" data-subsystem="map">0%</div>
          <div class="nn-il-subsystem-status" data-subsystem="map"></div>
        </div>
        <div class="nn-il-subsystem" data-subsystem="feed">
          <div class="nn-il-subsystem-label">FEED INGEST</div>
          <div class="nn-il-subsystem-bar">
            <div class="nn-il-subsystem-fill" data-subsystem="feed"></div>
          </div>
          <div class="nn-il-subsystem-percent" data-subsystem="feed">0%</div>
          <div class="nn-il-subsystem-status" data-subsystem="feed"></div>
        </div>
        <div class="nn-il-subsystem" data-subsystem="geo">
          <div class="nn-il-subsystem-label">GEO INDEX</div>
          <div class="nn-il-subsystem-bar">
            <div class="nn-il-subsystem-fill" data-subsystem="geo"></div>
          </div>
          <div class="nn-il-subsystem-percent" data-subsystem="geo">0%</div>
          <div class="nn-il-subsystem-status" data-subsystem="geo"></div>
        </div>
        <div class="nn-il-subsystem" data-subsystem="render">
          <div class="nn-il-subsystem-label">RENDER PIPELINE</div>
          <div class="nn-il-subsystem-bar">
            <div class="nn-il-subsystem-fill" data-subsystem="render"></div>
          </div>
          <div class="nn-il-subsystem-percent" data-subsystem="render">0%</div>
          <div class="nn-il-subsystem-status" data-subsystem="render"></div>
        </div>
      </div>
      
      <!-- Integrated Text System (no box) -->
      <div class="nn-il-text-stream" id="nn-il-text-stream" aria-live="polite" role="log"></div>
    </div>
    
    <!-- Central Orb (Off-Center, 4+ Layers) -->
    <div class="nn-il-core">
      <!-- Layer 1: Outer Segmented Ring (12 segments, slowest) -->
      <div class="nn-il-ring nn-il-ring-outer">
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
        <div class="nn-il-segment"></div>
      </div>
      
      <!-- Layer 2: Middle Scan Ring (continuous with scanning sweep) -->
      <div class="nn-il-ring nn-il-ring-middle">
        <div class="nn-il-scan-sweep"></div>
      </div>
      
      <!-- Layer 3: Inner Data Ring (8 orbiting data points) -->
      <div class="nn-il-ring nn-il-ring-inner">
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
        <div class="nn-il-data-point"></div>
      </div>
      
      <!-- Layer 4: Core Center (pulsing dot) -->
      <div class="nn-il-core-center">
        <div class="nn-il-core-dot"></div>
        <div class="nn-il-core-glow"></div>
      </div>
      
      <!-- Layer 5: Radial Scan Sweeps (2-3 independent sweeps) -->
      <div class="nn-il-sweep nn-il-sweep-1"></div>
      <div class="nn-il-sweep nn-il-sweep-2"></div>
      <div class="nn-il-sweep nn-il-sweep-3"></div>
    </div>
    
    <!-- Bottom HUD Bar -->
    <div class="nn-il-bottom-bar">
      <div class="nn-il-bottom-item">
        <span class="nn-il-hud-label">LAT:</span>
        <span id="nn-il-lat" class="nn-il-hud-value">40.7128</span>
      </div>
      <div class="nn-il-bottom-item">
        <span class="nn-il-hud-label">LON:</span>
        <span id="nn-il-lon" class="nn-il-hud-value">-74.0060</span>
      </div>
      <div class="nn-il-bottom-item">
        <span class="nn-il-hud-label">SIG:</span>
        <span id="nn-il-signal" class="nn-il-hud-value">127</span>
      </div>
      <div class="nn-il-bottom-item">
        <span class="nn-il-hud-label">UPTIME:</span>
        <span id="nn-il-uptime" class="nn-il-hud-value">00:00:00</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(loaderElement);
  
  // Generate subsystem progress bar segments
  generateSubsystemSegments();
  
  // Start animations (only if not reduced motion)
  if (!reducedMotion) {
    startCoordinateAnimation();
    startUTCTime();
    startUptime();
    startSignalAnimation();
  }
}

/**
 * Generate subsystem progress bar segments (10 segments per bar)
 */
function generateSubsystemSegments() {
  const subsystems = loaderElement.querySelectorAll('.nn-il-subsystem-bar');
  subsystems.forEach(bar => {
    for (let i = 0; i < 10; i++) {
      const segment = document.createElement('div');
      segment.className = 'nn-il-subsystem-segment';
      segment.style.left = `${i * 10}%`;
      bar.appendChild(segment);
    }
  });
}

/**
 * Start coordinate animation (throttled, low impact)
 */
function startCoordinateAnimation() {
  const latEl = loaderElement.querySelector('#nn-il-lat');
  const lonEl = loaderElement.querySelector('#nn-il-lon');
  if ((!latEl || !lonEl) || reducedMotion) return;
  
  let lat = 40.7128; // Start at NYC
  let lon = -74.0060;
  let lastUpdate = 0;
  const throttle = 500; // Update every 500ms max
  
  const updateCoords = (timestamp) => {
    if (timestamp - lastUpdate < throttle) {
      if (isVisible) {
        requestAnimationFrame(updateCoords);
      }
      return;
    }
    
    lastUpdate = timestamp;
    
    // Animate to random coordinates (simulated)
    lat += (Math.random() * 0.1 - 0.05);
    lon += (Math.random() * 0.1 - 0.05);
    lat = Math.max(-90, Math.min(90, lat));
    lon = Math.max(-180, Math.min(180, lon));
    
    if (latEl && isVisible) {
      latEl.textContent = lat.toFixed(4);
    }
    if (lonEl && isVisible) {
      lonEl.textContent = lon.toFixed(4);
    }
    
    if (isVisible) {
      requestAnimationFrame(updateCoords);
    }
  };
  
  if (isVisible) {
    requestAnimationFrame(updateCoords);
  }
}

/**
 * Start UTC time display
 */
function startUTCTime() {
  const timeEl = loaderElement.querySelector('#nn-il-utc-time');
  if (!timeEl || reducedMotion) return;
  
  const updateTime = () => {
    if (!isVisible) return;
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes} UTC`;
  };
  
  updateTime();
  utcTimeInterval = setInterval(updateTime, 1000);
}

/**
 * Start uptime counter
 */
function startUptime() {
  const uptimeEl = loaderElement.querySelector('#nn-il-uptime');
  if (!uptimeEl || reducedMotion) return;
  
  const startTime = Date.now();
  
  const updateUptime = () => {
    if (!isVisible) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    uptimeEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  
  updateUptime();
  uptimeInterval = setInterval(updateUptime, 1000);
}

/**
 * Start signal strength animation
 */
function startSignalAnimation() {
  const signalEl = loaderElement.querySelector('#nn-il-signal');
  if (!signalEl || reducedMotion) return;
  
  let signal = 127;
  
  const updateSignal = () => {
    if (!isVisible) return;
    // Oscillate between 120-135
    signal += (Math.random() * 2 - 1);
    signal = Math.max(120, Math.min(135, signal));
    signalEl.textContent = Math.round(signal);
  };
  
  updateSignal();
  signalAnimationInterval = setInterval(updateSignal, 800);
}

/**
 * Initialize noise canvas (low resolution, throttled, paused when hidden)
 */
function initNoiseCanvas() {
  const canvas = loaderElement.querySelector('#nn-il-noise-canvas');
  if (!canvas || reducedMotion) return;
  
  noiseCanvas = canvas;
  noiseCtx = canvas.getContext('2d');
  
  // Low resolution for performance (scale up with CSS)
  const scale = 0.5; // 50% resolution
  const resizeCanvas = () => {
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

/**
 * Draw subtle noise/grain (throttled to ~20fps, only when visible)
 */
function drawNoise() {
  if (!noiseCtx || !noiseCanvas || !isVisible || reducedMotion) return;
  
  const imageData = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height);
  const data = imageData.data;
  
  // Very subtle noise (low opacity)
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.random() * 20; // Very subtle
    data[i] = value;     // R
    data[i + 1] = value; // G
    data[i + 2] = value; // B
    data[i + 3] = 3;     // A (very low opacity)
  }
  
  noiseCtx.putImageData(imageData, 0, 0);
}

/**
 * Show the loader (idempotent)
 */
export function showLoader(options = {}) {
  // Initialize if needed
  if (!isInitialized) {
    initIntelLoader();
  }
  
  if (!loaderElement) {
    console.error('[IntelLoader] Loader element not created');
    return;
  }
  
  // Idempotent: if already visible, just update phase if provided
  if (isVisible) {
    if (options.phase) {
      setLoaderPhase(options.phase);
    }
    return;
  }
  
  isVisible = true;
  currentProgress = 0;
  currentPhase = options.phase || 'AUTH';
  terminalLines = [];
  pointerEventsRestored = false;
  
  // Block pointer events
  loaderElement.style.pointerEvents = 'all';
  document.body.style.overflow = 'hidden'; // Prevent scrolling
  
  // Update phase
  setLoaderPhase(currentPhase);
  
  // Show loader (GPU-accelerated opacity transition)
  loaderElement.classList.remove('nn-il-hidden');
  loaderElement.classList.add('nn-il-visible');
  
  // Start progress simulation if no real progress provided
  startProgressSimulation();
  
  // Text is now handled by setLoaderPhase() - no separate terminal printing needed
  
  // Start noise animation (throttled, low resolution, paused when hidden)
  if (noiseCanvas && !reducedMotion) {
    let lastFrame = 0;
    const fps = 20; // Throttle to 20fps
    const interval = 1000 / fps;
    
    function animateNoise(timestamp) {
      if (!isVisible) return; // Pause when hidden
      
      if (timestamp - lastFrame >= interval) {
        drawNoise();
        lastFrame = timestamp;
      }
      
      if (isVisible) {
        noiseFrame = requestAnimationFrame(animateNoise);
      }
    }
    
    noiseFrame = requestAnimationFrame(animateNoise);
  }
  
  // Dispatch event for audio hooks
  window.dispatchEvent(new CustomEvent('nn:loader:show'));
}

/**
 * Set loader progress (0.0 to 1.0) - idempotent, never goes backwards
 * Also updates subsystem progress bars with slight variations
 */
export function setLoaderProgress(progress) {
  if (!loaderElement || !isVisible) return;
  
  // Clamp and ensure progress never goes backwards
  progress = Math.max(currentProgress, Math.min(1.0, progress));
  currentProgress = progress;
  
  // Update all subsystems with slight variations to feel real
  const subsystems = ['map', 'feed', 'geo', 'render'];
  subsystems.forEach((subsystem, index) => {
    // Each subsystem progresses at slightly different rates
    const variation = (Math.random() * 0.1 - 0.05); // ±5% variation
    const subsystemProgress = Math.max(0, Math.min(1, progress + variation));
    
    const fillEl = loaderElement.querySelector(`.nn-il-subsystem-fill[data-subsystem="${subsystem}"]`);
    const percentEl = loaderElement.querySelector(`.nn-il-subsystem-percent[data-subsystem="${subsystem}"]`);
    const statusEl = loaderElement.querySelector(`.nn-il-subsystem-status[data-subsystem="${subsystem}"]`);
    
    if (fillEl) {
      fillEl.style.width = `${subsystemProgress * 100}%`;
    }
    
    if (percentEl) {
      percentEl.textContent = `${Math.round(subsystemProgress * 100)}%`;
    }
    
    if (statusEl) {
      // Update status indicator: green=active, yellow=waiting, red=error
      if (subsystemProgress >= 0.9) {
        statusEl.className = 'nn-il-subsystem-status nn-il-status-complete';
      } else if (subsystemProgress > 0) {
        statusEl.className = 'nn-il-subsystem-status nn-il-status-active';
      } else {
        statusEl.className = 'nn-il-subsystem-status nn-il-status-waiting';
      }
    }
  });
  
  // Dispatch event for audio hooks
  window.dispatchEvent(new CustomEvent('nn:loader:progress', {
    detail: { progress }
  }));
}

/**
 * Set loader phase (idempotent)
 */
export function setLoaderPhase(phase) {
  if (!loaderElement) return;
  
  // Validate phase
  if (!PHASE_MESSAGES[phase]) {
    console.warn(`[IntelLoader] Unknown phase: ${phase}`);
    phase = 'AUTH';
  }
  
  currentPhase = phase;
  
  const phaseData = PHASE_MESSAGES[phase] || PHASE_MESSAGES.AUTH;
  
  // Update terminal lines for this phase
  terminalLines = [...phaseData.lines];
  
  // Add phase message to text stream
  const textStream = loaderElement.querySelector('#nn-il-text-stream');
  if (textStream && phaseData.lines.length > 0) {
    // Add phase header
    const phaseLine = document.createElement('div');
    phaseLine.className = 'nn-il-text-line nn-il-text-phase';
    phaseLine.textContent = phaseData.title + '...';
    textStream.appendChild(phaseLine);
    
    // Add phase sub-lines with staggered timing (feels more real)
    phaseData.lines.forEach((line, index) => {
      // Use requestAnimationFrame for smoother timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!isVisible || !textStream) return;
          const lineEl = document.createElement('div');
          lineEl.className = 'nn-il-text-line nn-il-text-sub';
          lineEl.textContent = `> ${line}`;
          textStream.appendChild(lineEl);
          
          // Keep only last 15 lines (scroll)
          const lines = textStream.querySelectorAll('.nn-il-text-line');
          if (lines.length > 15) {
            lines[0].remove();
          }
          
          // Auto-scroll to bottom
          textStream.scrollTop = textStream.scrollHeight;
        }, index * 150); // 150ms between lines
      });
    });
  }
  
  // Dispatch event for audio hooks
  window.dispatchEvent(new CustomEvent('nn:loader:phase', {
    detail: { phase }
  }));
}

/**
 * Start progress simulation (capped at 85% until real progress)
 */
function startProgressSimulation() {
  // Clear any existing simulation
  if (progressAnimation) {
    clearInterval(progressAnimation);
    progressAnimation = null;
  }
  
  // Simulate progress: 0 → 0.85 over 6-10 seconds
  const duration = 6000 + Math.random() * 4000; // 6-10 seconds
  const startTime = Date.now();
  const targetProgress = 0.85; // Cap at 85% until real progress
  
  progressAnimation = setInterval(() => {
    if (!isVisible) {
      clearInterval(progressAnimation);
      progressAnimation = null;
      return;
    }
    
    const elapsed = Date.now() - startTime;
    const simulatedProgress = Math.min(targetProgress, (elapsed / duration) * targetProgress);
    
    // Only update if simulated progress is higher than current (never go backwards)
    if (simulatedProgress > currentProgress) {
      setLoaderProgress(simulatedProgress);
    }
    
    if (simulatedProgress >= targetProgress) {
      clearInterval(progressAnimation);
      progressAnimation = null;
    }
  }, 50);
}

// Terminal printing and scramble effects removed - now using integrated text stream in setLoaderPhase()

/**
 * Hide the loader with exit animation (idempotent, full cleanup)
 */
export function hideLoader() {
  if (!loaderElement || !isVisible) return; // Idempotent
  
  // Clean up all timers and animations
  cleanupAllTimers();
  
  // Set progress to 100% smoothly
  setLoaderProgress(1.0);
  
  // Accelerate orbital rings briefly (only if not reduced motion)
  if (!reducedMotion) {
    loaderElement.classList.add('nn-il-exiting');
  }
  
  // Exit animation: scanline wipe + fade (total < 600ms)
  setTimeout(() => {
    if (!loaderElement) return;
    
    loaderElement.classList.add('nn-il-scanline-exit');
    
    setTimeout(() => {
      if (!loaderElement) return;
      
      isVisible = false;
      
      // Restore pointer events
      loaderElement.style.pointerEvents = 'none';
      document.body.style.overflow = ''; // Restore scrolling
      pointerEventsRestored = true;
      
      // Add fade-out class for final fade
      loaderElement.classList.add('nn-il-fade-out');
      
      // Remove from DOM after fade completes (prevent memory leaks)
      setTimeout(() => {
        if (loaderElement && loaderElement.parentNode) {
          loaderElement.parentNode.removeChild(loaderElement);
          loaderElement = null;
          // Reset state for potential reuse
          isVisible = false;
          currentProgress = 0;
          currentPhase = 'AUTH';
        }
        
        // Dispatch event for audio hooks
        window.dispatchEvent(new CustomEvent('nn:loader:hide'));
      }, 400); // Wait for fade-out animation
    }, 400); // Scanline animation
  }, 100); // Initial delay
}

// Note: Auto-initialization removed - loader is explicitly initialized in situation-monitor.html
// This prevents race conditions and ensures proper initialization order
