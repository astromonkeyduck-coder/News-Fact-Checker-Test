/**
 * High-Quality SVG Snowfall Overlay Component
 * Creates elegant snowfall effect using premium SVG snowflakes
 */

// Use global getRandomSnowflake function
function getRandomSnowflake() {
    if (typeof window !== 'undefined' && window.getRandomSnowflake) {
        return window.getRandomSnowflake();
    }
    // Fallback to a simple snowflake if not loaded
    return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 100%; height: 100%;"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M12 2l-3 3M12 2l3 3M2 12h20M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></g></svg>';
}

/**
 * Create snowfall overlay with SVG snowflakes
 */
function createSnowfallOverlay(config = {}) {
    const {
        count = 50,
        minSize = 12,
        maxSize = 20,
        minOpacity = 0.6,
        maxOpacity = 0.95,
        minDuration = 8,
        maxDuration = 15,
        minDelay = 0,
        maxDelay = 5
    } = config;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        console.log('[Snowfall] Reduced motion detected, disabling snowfall');
        return null;
    }

    // Check if body exists
    if (!document.body) {
        console.warn('[Snowfall] Body not ready, retrying...');
        setTimeout(() => createSnowfallOverlay(config), 100);
        return null;
    }

    // Remove existing overlay if any
    const existing = document.getElementById('snowfall-overlay');
    if (existing) {
        existing.remove();
    }

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'snowfall-overlay';
    overlay.className = 'snowfall-overlay';
    document.body.appendChild(overlay);

    // Determine particle count based on screen size
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? Math.floor(count * 0.4) : count;

    console.log(`[Snowfall] Creating ${particleCount} snowflakes...`);

    // Create snowflakes
    for (let i = 0; i < particleCount; i++) {
        const snowflake = createSnowflakeElement({
            minSize,
            maxSize,
            minOpacity,
            maxOpacity,
            minDuration,
            maxDuration,
            minDelay,
            maxDelay
        });
        overlay.appendChild(snowflake);
    }

    console.log('[Snowfall] Snowfall overlay created successfully');
    return overlay;
}

/**
 * Create a single snowflake element
 */
function createSnowflakeElement(options) {
    const {
        minSize,
        maxSize,
        minOpacity,
        maxOpacity,
        minDuration,
        maxDuration,
        minDelay,
        maxDelay
    } = options;

    // Randomize properties
    const size = Math.random() * (maxSize - minSize) + minSize;
    const opacity = Math.random() * (maxOpacity - minOpacity) + minOpacity;
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    const left = Math.random() * 100; // 0-100%
    const drift = (Math.random() - 0.5) * 60; // -30px to 30px horizontal drift
    const scale = Math.random() * 0.3 + 0.85; // 0.85-1.15 scale variation

    // Create snowflake container
    const container = document.createElement('div');
    container.className = 'snowflake';
    
    // Set CSS custom properties for animation
    container.style.cssText = `
        position: absolute;
        left: ${left}%;
        top: -10vh;
        width: ${size}px;
        height: ${size}px;
        color: rgba(255, 255, 255, ${opacity});
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
        --snow-x: ${drift}px;
        --snow-scale: ${scale};
        --snow-opacity: ${opacity};
    `;

    // Add SVG snowflake
    container.innerHTML = getRandomSnowflake();

    return container;
}

/**
 * Remove snowfall overlay
 */
function removeSnowfallOverlay() {
    const overlay = document.getElementById('snowfall-overlay');
    if (overlay) {
        overlay.remove();
        console.log('[Snowfall] Snowfall overlay removed');
    }
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.createSnowfallOverlay = createSnowfallOverlay;
    window.removeSnowfallOverlay = removeSnowfallOverlay;
}

