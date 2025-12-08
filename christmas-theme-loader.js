/**
 * Christmas Theme Loader
 * Conditionally loads Christmas theme based on config
 */

(function() {
    'use strict';
    
    // Load Christmas CSS
    function loadChristmasCSS() {
        // Check if already loaded
        if (document.getElementById('christmas-theme-stylesheet')) {
            console.log('[Christmas Theme] CSS already loaded');
            return;
        }
        
        // Determine correct path based on current page location
        const currentPath = window.location.pathname;
        const isRoot = currentPath === '/' || currentPath.endsWith('index.html');
        const cssPath = isRoot ? 'christmas-theme.css' : '/christmas-theme.css';
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        link.id = 'christmas-theme-stylesheet';
        link.onload = function() {
            console.log('[Christmas Theme] CSS loaded successfully from:', cssPath);
        };
        link.onerror = function() {
            console.error('[Christmas Theme] Failed to load CSS from:', cssPath);
            // Try alternative path
            const altPath = cssPath.startsWith('/') ? 'christmas-theme.css' : '/christmas-theme.css';
            link.href = altPath;
            console.log('[Christmas Theme] Trying alternative path:', altPath);
        };
        document.head.appendChild(link);
        
        // Load snowfall CSS
        loadSnowfallCSS();
    }
    
    // Load snowfall CSS
    function loadSnowfallCSS() {
        if (document.getElementById('snowfall-stylesheet')) {
            return;
        }
        
        const currentPath = window.location.pathname;
        const isRoot = currentPath === '/' || currentPath.endsWith('index.html');
        const cssPath = isRoot ? 'src/components/christmas/snowfall.css' : '/src/components/christmas/snowfall.css';
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        link.id = 'snowfall-stylesheet';
        link.onerror = function() {
            // Try alternative path
            const altPath = cssPath.startsWith('/') ? 'src/components/christmas/snowfall.css' : '/src/components/christmas/snowfall.css';
            link.href = altPath;
        };
        document.head.appendChild(link);
    }
    
    // Add Christmas class to html and body
    function addChristmasClasses() {
        if (document.documentElement) {
            document.documentElement.classList.add('christmas-theme');
        }
        if (document.body) {
            document.body.classList.add('christmas-theme');
            console.log('[Christmas Theme] Classes added to html and body');
        } else {
            console.warn('[Christmas Theme] Body not found yet');
        }
    }
    
    // Create snowflake animation
    function createSnowflakes(config) {
        if (!document.body) {
            console.warn('[Christmas Theme] Cannot create snowflakes - body not ready');
            return;
        }
        
        // Remove existing snowflakes if any
        const existing = document.querySelector('.christmas-snowflakes');
        if (existing) {
            existing.remove();
        }
        
        const snowContainer = document.createElement('div');
        snowContainer.className = 'christmas-snowflakes';
        snowContainer.id = 'christmas-snowflakes-container';
        // Force visibility
        snowContainer.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            pointer-events: none !important;
            z-index: 99999 !important;
            overflow: visible !important;
        `;
        document.body.appendChild(snowContainer);
        
        const symbols = config.SNOWFLAKE_SYMBOLS || ['❄', '❅', '❆'];
        const count = config.SNOWFLAKE_COUNT || 50;
        
        console.log('[Christmas Theme] Creating', count, 'snowflakes...');
        
        for (let i = 0; i < count; i++) {
            const snowflake = document.createElement('div');
            snowflake.className = 'snowflake';
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            snowflake.textContent = symbol;
            
            const left = Math.random() * 100;
            const duration = Math.random() * 3 + 2;
            const delay = Math.random() * 2;
            const fontSize = Math.random() * 0.8 + 1.2;
            
            snowflake.style.cssText = `
                position: absolute !important;
                left: ${left}% !important;
                top: -20px !important;
                color: white !important;
                font-size: ${fontSize}em !important;
                opacity: 1 !important;
                display: block !important;
                visibility: visible !important;
                pointer-events: none !important;
                z-index: 99999 !important;
                text-shadow: 0 0 10px rgba(255, 255, 255, 1) !important;
                animation: snowfall ${duration}s linear ${delay}s infinite !important;
            `;
            
            snowContainer.appendChild(snowflake);
        }
        
        console.log('[Christmas Theme] Snowflakes created:', count);
        console.log('[Christmas Theme] Snow container element:', snowContainer);
        console.log('[Christmas Theme] Snow container children:', snowContainer.children.length);
        
        // Test visibility after a moment
        setTimeout(function() {
            const testFlake = snowContainer.querySelector('.snowflake');
            if (testFlake) {
                const rect = testFlake.getBoundingClientRect();
                console.log('[Christmas Theme] Test snowflake position:', rect);
                console.log('[Christmas Theme] Test snowflake computed style:', window.getComputedStyle(testFlake).display);
            }
        }, 1000);
    }
    
    // Initialize Christmas theme
    function initChristmasTheme() {
        // Load config (will be loaded before this script)
        let config = window.CHRISTMAS_CONFIG;
        
        // If config isn't available yet, try to get it from global scope
        if (!config && typeof CHRISTMAS_CONFIG !== 'undefined') {
            config = CHRISTMAS_CONFIG;
            window.CHRISTMAS_CONFIG = config;
        }
        
        // Fallback config if still not available
        if (!config) {
            config = {
                ENABLE_CHRISTMAS_THEME: true,
                SNOWFLAKE_COUNT: 50,
                SNOWFLAKE_SYMBOLS: ['❄', '❅', '❆', '✻', '✼', '✽', '✾', '✿', '❀']
            };
            console.warn('[Christmas Theme] Config not found, using defaults');
        }
        
        console.log('[Christmas Theme] Config:', config);
        
        if (!config.ENABLE_CHRISTMAS_THEME) {
            console.log('[Christmas Theme] Disabled in config');
            return; // Exit early if Christmas theme is disabled
        }
        
        console.log('[Christmas Theme] Initializing...');
        loadChristmasCSS();
        addChristmasClasses();
        
        // Wait a moment for CSS to load, then create snowflakes
        setTimeout(function() {
            createSnowflakes(config);
        }, 200);
        
        // Create high-quality SVG snowfall if enabled
        if (config.ENABLE_SVG_SNOWFALL !== false) {
            setTimeout(function() {
                createSVGSnowfall(config);
            }, 300);
        }
        
        console.log('[Christmas Theme] Theme applied successfully!');
    }
    
    // Create high-quality SVG snowfall
    function createSVGSnowfall(config) {
        // Load snowflakes first, then snowfall overlay
        function loadSnowflakes(callback) {
            if (typeof window.getRandomSnowflake !== 'undefined') {
                callback();
                return;
            }
            
            const script1 = document.createElement('script');
            const currentPath = window.location.pathname;
            const isRoot = currentPath === '/' || currentPath.endsWith('index.html');
            script1.src = isRoot ? 'src/components/christmas/snowflakes.js' : '/src/components/christmas/snowflakes.js';
            script1.onload = callback;
            script1.onerror = function() {
                script1.src = '/src/components/christmas/snowflakes.js';
                script1.onload = callback;
            };
            document.head.appendChild(script1);
        }
        
        function loadSnowfallOverlay() {
            if (typeof window.createSnowfallOverlay !== 'undefined') {
                initializeSnowfall(config);
                return;
            }
            
            const script2 = document.createElement('script');
            const currentPath = window.location.pathname;
            const isRoot = currentPath === '/' || currentPath.endsWith('index.html');
            script2.src = isRoot ? 'src/components/christmas/snowfall-overlay.js' : '/src/components/christmas/snowfall-overlay.js';
            script2.onload = function() {
                initializeSnowfall(config);
            };
            script2.onerror = function() {
                script2.src = '/src/components/christmas/snowfall-overlay.js';
                script2.onload = function() {
                    initializeSnowfall(config);
                };
            };
            document.head.appendChild(script2);
        }
        
        loadSnowflakes(loadSnowfallOverlay);
    }
    
    function initializeSnowfall(config) {
        if (typeof window.createSnowfallOverlay === 'function') {
            const snowfallConfig = {
                count: config.SNOWFLAKE_COUNT || 50,
                minSize: config.SNOWFLAKE_MIN_SIZE || 12,
                maxSize: config.SNOWFLAKE_MAX_SIZE || 20,
                minOpacity: config.SNOWFLAKE_MIN_OPACITY || 0.6,
                maxOpacity: config.SNOWFLAKE_MAX_OPACITY || 0.95,
                minDuration: config.SNOWFLAKE_MIN_DURATION || 8,
                maxDuration: config.SNOWFLAKE_MAX_DURATION || 15
            };
            window.createSnowfallOverlay(snowfallConfig);
        } else {
            console.warn('[Christmas Theme] Snowfall overlay function not available');
        }
    }
    
    // Run when DOM is ready, with fallback for config loading
    function startInit() {
        // Wait for body to exist
        function waitForBody(callback, maxAttempts = 20) {
            let attempts = 0;
            const checkInterval = setInterval(function() {
                attempts++;
                if (document.body) {
                    clearInterval(checkInterval);
                    callback();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.warn('[Christmas Theme] Body not found after waiting');
                    callback(); // Try anyway
                }
            }, 50);
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                waitForBody(function() {
                    setTimeout(initChristmasTheme, 100);
                });
            });
        } else {
            waitForBody(function() {
                setTimeout(initChristmasTheme, 100);
            });
        }
    }
    
    // Start initialization
    startInit();
})();
