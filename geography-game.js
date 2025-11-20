// 50 Most Populous Countries with their ISO codes, common names, and coordinates (center point)
const POPULOUS_COUNTRIES = [
    { name: 'China', code: 'CN', alt: ['china'], lat: 35.8617, lng: 104.1954 },
    { name: 'India', code: 'IN', alt: ['india'], lat: 20.5937, lng: 78.9629 },
    { name: 'United States', code: 'US', alt: ['usa', 'united states', 'america'], lat: 37.0902, lng: -95.7129 },
    { name: 'Indonesia', code: 'ID', alt: ['indonesia'], lat: -0.7893, lng: 113.9213 },
    { name: 'Pakistan', code: 'PK', alt: ['pakistan'], lat: 30.3753, lng: 69.3451 },
    { name: 'Brazil', code: 'BR', alt: ['brazil'], lat: -14.2350, lng: -51.9253 },
    { name: 'Bangladesh', code: 'BD', alt: ['bangladesh'], lat: 23.6850, lng: 90.3563 },
    { name: 'Russia', code: 'RU', alt: ['russia', 'russian federation'], lat: 61.5240, lng: 105.3188 },
    { name: 'Mexico', code: 'MX', alt: ['mexico'], lat: 23.6345, lng: -102.5528 },
    { name: 'Japan', code: 'JP', alt: ['japan'], lat: 36.2048, lng: 138.2529 },
    { name: 'Philippines', code: 'PH', alt: ['philippines'], lat: 12.8797, lng: 121.7740 },
    { name: 'Egypt', code: 'EG', alt: ['egypt'], lat: 26.8206, lng: 30.8025 },
    { name: 'Ethiopia', code: 'ET', alt: ['ethiopia'], lat: 9.1450, lng: 38.7667 },
    { name: 'Vietnam', code: 'VN', alt: ['vietnam'], lat: 14.0583, lng: 108.2772 },
    { name: 'Democratic Republic of the Congo', code: 'CD', alt: ['democratic republic of congo', 'drc', 'congo', 'dr congo'], lat: -4.0383, lng: 21.7587 },
    { name: 'Iran', code: 'IR', alt: ['iran'], lat: 32.4279, lng: 53.6880 },
    { name: 'Türkiye', code: 'TR', alt: ['turkey', 'türkiye'], lat: 38.9637, lng: 35.2433 },
    { name: 'Germany', code: 'DE', alt: ['germany'], lat: 51.1657, lng: 10.4515 },
    { name: 'Thailand', code: 'TH', alt: ['thailand'], lat: 15.8700, lng: 100.9925 },
    { name: 'United Kingdom', code: 'GB', alt: ['uk', 'united kingdom', 'britain', 'great britain'], lat: 55.3781, lng: -3.4360 },
    { name: 'France', code: 'FR', alt: ['france'], lat: 46.2276, lng: 2.2137 },
    { name: 'Italy', code: 'IT', alt: ['italy'], lat: 41.8719, lng: 12.5674 },
    { name: 'South Africa', code: 'ZA', alt: ['south africa'], lat: -30.5595, lng: 22.9375 },
    { name: 'Tanzania', code: 'TZ', alt: ['tanzania'], lat: -6.3690, lng: 34.8888 },
    { name: 'Myanmar', code: 'MM', alt: ['myanmar', 'burma'], lat: 21.9162, lng: 95.9560 },
    { name: 'Kenya', code: 'KE', alt: ['kenya'], lat: -0.0236, lng: 37.9062 },
    { name: 'South Korea', code: 'KR', alt: ['south korea', 'korea'], lat: 35.9078, lng: 127.7669 },
    { name: 'Colombia', code: 'CO', alt: ['colombia'], lat: 4.5709, lng: -74.2973 },
    { name: 'Spain', code: 'ES', alt: ['spain'], lat: 40.4637, lng: -3.7492 },
    { name: 'Uganda', code: 'UG', alt: ['uganda'], lat: 1.3733, lng: 32.2903 },
    { name: 'Argentina', code: 'AR', alt: ['argentina'], lat: -38.4161, lng: -63.6167 },
    { name: 'Algeria', code: 'DZ', alt: ['algeria'], lat: 28.0339, lng: 1.6596 },
    { name: 'Sudan', code: 'SD', alt: ['sudan'], lat: 12.8628, lng: 30.2176 },
    { name: 'Ukraine', code: 'UA', alt: ['ukraine'], lat: 48.3794, lng: 31.1656 },
    { name: 'Iraq', code: 'IQ', alt: ['iraq'], lat: 33.2232, lng: 43.6793 },
    { name: 'Afghanistan', code: 'AF', alt: ['afghanistan'], lat: 33.9391, lng: 67.7100 },
    { name: 'Poland', code: 'PL', alt: ['poland'], lat: 51.9194, lng: 19.1451 },
    { name: 'Canada', code: 'CA', alt: ['canada'], lat: 56.1304, lng: -106.3468 },
    { name: 'Morocco', code: 'MA', alt: ['morocco'], lat: 31.7917, lng: -7.0926 },
    { name: 'Saudi Arabia', code: 'SA', alt: ['saudi arabia', 'saudi'], lat: 23.8859, lng: 45.0792 },
    { name: 'Uzbekistan', code: 'UZ', alt: ['uzbekistan'], lat: 41.3775, lng: 64.5853 },
    { name: 'Peru', code: 'PE', alt: ['peru'], lat: -9.1900, lng: -75.0152 },
    { name: 'Angola', code: 'AO', alt: ['angola'], lat: -11.2027, lng: 17.8739 },
    { name: 'Malaysia', code: 'MY', alt: ['malaysia'], lat: 4.2105, lng: 101.9758 },
    { name: 'Mozambique', code: 'MZ', alt: ['mozambique'], lat: -18.6657, lng: 35.5296 },
    { name: 'Ghana', code: 'GH', alt: ['ghana'], lat: 7.9465, lng: -1.0232 },
    { name: 'Yemen', code: 'YE', alt: ['yemen'], lat: 15.5527, lng: 48.5164 },
    { name: 'Nepal', code: 'NP', alt: ['nepal'], lat: 28.3949, lng: 84.1240 },
    { name: 'Nigeria', code: 'NG', alt: ['nigeria'], lat: 9.0820, lng: 8.6753 },
    { name: 'Venezuela', code: 'VE', alt: ['venezuela'], lat: 6.4238, lng: -66.5897 }
];

// Game Modes
const GAME_MODES = {
    CLASSIC: 'classic',           // Click the country when prompted (original)
    HARD: 'hard',                 // No country outlines - harder to see borders
    TYPING: 'typing'              // Country flashes, then type the name
};

class GeographyGame {
    constructor() {
        this.countries = [...POPULOUS_COUNTRIES];
        this.shuffledCountries = [];
        this.currentCountry = null;
        this.score = 0;
        this.correct = 0;
        this.wrong = 0;
        this.answered = new Set();
        this.wrongCountries = new Set(); // Track which countries were answered wrong (to avoid double counting)
        this.clickedThisQuestion = new Set(); // Track countries clicked for current question (to disable them)
        this.gameActive = false;
        this.countryMap = {}; // Maps country codes to SVG paths
        this.attempts = new Map(); // Track attempts per country: countryCode -> attemptCount
        this.lastClickTime = 0; // Track last click time for debouncing
        this.isProcessingClick = false; // Prevent double-processing of clicks
        this.isSubmittingScore = false; // Prevent duplicate leaderboard submissions
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        // Will be calculated when SVG loads to ensure horizontal scrolling is possible
        this.isPanning = false;
        this.wasDragging = false; // Track if we just finished dragging (to prevent click after drag)
        this.startX = 0;
        this.startY = 0;
        this.svgNaturalWidth = 0;
        this.svgNaturalHeight = 0;
        this.minZoomLevel = 1; // Minimum zoom - will be calculated based on SVG fit
        
        // Game mode
        this.gameMode = GAME_MODES.CLASSIC;
        this.guessMarker = null; // Marker for map click guesses
        
        // Typing mode properties
        this.typingInput = null;
        this.flashedCountry = null;
        this.flashTimeout = null;
        this.flashInterval = null; // For continuous flashing
        this.typingRevealedLetters = 0; // Track how many letters are revealed in typing mode
        this.typingWrongAttempts = 0; // Track wrong attempts for current country in typing mode
        this.typingRevealedLetters = 0; // Track how many letters are revealed in typing mode
        this.typingWrongAttempts = 0; // Track wrong attempts for current country in typing mode
        
        // Enhancement features
        this.combo = 0; // Combo multiplier for consecutive correct answers
        this.maxCombo = 0; // Track highest combo
        this.achievements = new Set(); // Track unlocked achievements
        this.countryFacts = this.loadCountryFacts(); // Country information
        
        // Timer and competitive features
        this.startTime = null;
        this.timerInterval = null;
        this.elapsedTime = 0; // in milliseconds
        this.questionStartTime = null;
        this.questionTimerInterval = null; // Interval for per-question timer
        this.questionTimes = []; // Track time per question
        this.bestTime = this.loadBestTime(); // Best completion time
        this.speedBonus = 0; // Total speed bonuses earned
        
        // Initialize audio context for sound effects
        this.audioContext = null;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio context not available');
        }
        
        // NeonDreams music state
        this._bgMusicWasPlaying = false;
        this._bgMusicCurrentTime = 0;
        
        this.initializeElements();
        this.loadWorldMap();
        this.setupEventListeners();
        this.setupZoomControls();
        this.setupGameModeSelector();
        
        // Set up page leave handler to fade out NeonDreams
        window.addEventListener('beforeunload', () => {
            this.fadeOutNeonDreamsAndResume();
        });
        window.addEventListener('pagehide', () => {
            this.fadeOutNeonDreamsAndResume();
        });
    }
    
    initializeElements() {
        this.scoreEl = document.getElementById('geoScore');
        this.correctEl = document.getElementById('geoCorrect');
        this.wrongEl = document.getElementById('geoWrong');
        this.remainingEl = document.getElementById('geoRemaining');
        this.promptEl = document.getElementById('countryPrompt');
        this.mapContainer = document.getElementById('worldMap');
        this.feedbackEl = document.getElementById('feedbackMessage');
        this.flashLeft = document.getElementById('viewportFlashLeft');
        this.flashRight = document.getElementById('viewportFlashRight');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.directionsCountEl = document.getElementById('directionsCount');
        this.timerEl = document.getElementById('geoTimer');
        this.speedEl = document.getElementById('geoSpeed');
        this.questionTimerEl = document.getElementById('questionTimer');
        this.questionTimerValueEl = document.getElementById('questionTimerValue');
        this.comboEl = document.getElementById('geoCombo');
        this.comboStat = document.getElementById('comboStat');
        this.progressBarFill = document.getElementById('progressBarFill');
        this.progressText = document.getElementById('progressText');
    }
    
    loadWorldMap() {
        // Load SVG world map - create a placeholder first, then load the real map
        // The standalone loadSVGMap() function will replace the placeholder
        this.createSimpleMap();
    }
    
    createInteractiveMap() {
        // This method is kept for backwards compatibility
        // It now just calls createSimpleMap() which creates a placeholder
        // The real map is loaded by the standalone loadSVGMap() function
        this.createSimpleMap();
    }
    
    loadMapData(svg) {
        // This method is deprecated - the real map loading is handled by
        // the standalone loadSVGMap() function
        // Store SVG reference for now
        this.svg = svg;
        
        // Initialize country map structure
        this.initializeCountryPaths();
    }
    
    initializeCountryPaths() {
        // Set up event delegation to handle clicks on any country path
        // Remove any existing click handlers first to avoid duplicates
        if (this.svg) {
            // Clone the SVG to remove old event listeners (if any)
            // Actually, we'll just add the listener - if it's already there, it won't duplicate
            // But first, make sure we're using the correct SVG reference
            const svgToUse = this.svg;
            
            // Ensure SVG allows pointer events
            svgToUse.style.pointerEvents = 'auto';
            
            // Remove old listener if it exists (we can't easily do this, so we'll just add)
            // Multiple listeners on the same element won't cause issues, they'll all fire
            // Use capture phase to ensure we catch clicks even if something else is trying to block them
            // Also add to the map container as a fallback
            const clickHandler = (e) => {
                // If we just finished dragging, don't process this click
                if (this.wasDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // Debounce: prevent rapid double-clicks (especially on mobile)
                const now = Date.now();
                if (now - this.lastClickTime < 500) { // 500ms debounce
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                // Prevent double-processing
                if (this.isProcessingClick) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                this.lastClickTime = now;
                this.isProcessingClick = true;
                
                // Find the clicked path element
                let path = e.target;
                if (path.tagName !== 'path') {
                    path = e.target.closest('path');
                }
                
                if (!path) {
                    console.log('Click detected but no path found');
                    this.isProcessingClick = false;
                    return;
                }
                
                // Ignore non-populous countries
                if (path.classList.contains('non-populous')) {
                    this.isProcessingClick = false;
                    return;
                }
                
                // Get country code from data attribute
                const countryCode = path.getAttribute('data-country-code');
                const countryName = path.getAttribute('data-country-name');
                const pathId = path.id || '';
                
                console.log('Path clicked:', { countryCode, countryName, pathId, gameActive: this.gameActive });
                
                // Determine the country from the path
                let country = null;
                
                // First try to find from data attributes
                if (countryCode) {
                    country = POPULOUS_COUNTRIES.find(c => 
                        c.code.toLowerCase() === countryCode.toLowerCase()
                    );
                }
                
                if (!country && countryName) {
                    country = POPULOUS_COUNTRIES.find(c => 
                        c.name.toLowerCase() === countryName.toLowerCase()
                    );
                }
                
                // If no data attributes, try to get from ID
                if (!country && pathId) {
                    country = POPULOUS_COUNTRIES.find(c => 
                        c.code.toLowerCase() === pathId.toLowerCase() ||
                        pathId.toLowerCase().startsWith(c.code.toLowerCase())
                    );
                    if (country) {
                        path.setAttribute('data-country-code', country.code);
                        path.setAttribute('data-country-name', country.name);
                    }
                }
                
                if (!country) {
                    // Not a mapped country or not in our list
                    console.log('Country not found in populous list');
                    this.isProcessingClick = false;
                    return;
                }
                
                if (!this.gameActive) {
                    this.feedbackEl.textContent = 'Click "Start Game" to begin!';
                    this.feedbackEl.className = 'feedback-message incorrect';
                    
                    // Show message on map and highlight start button
                    this.showStartGamePrompt();
                    
                    setTimeout(() => {
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                        this.hideStartGamePrompt();
                    }, 3000);
                    this.isProcessingClick = false;
                    return;
                }
                
                if (!this.currentCountry) {
                    console.log('No current country to find');
                    this.isProcessingClick = false;
                    return;
                }
                
                // Only check if already answered if it's NOT the current country being asked for
                // This allows clicking the current country even if it was previously answered in a different game
                if (this.answered.has(country.code) && country.code !== this.currentCountry.code) {
                    // Country already answered (and it's not the one we're currently looking for)
                    this.feedbackEl.textContent = `${country.name} has already been answered!`;
                    this.feedbackEl.className = 'feedback-message incorrect';
                    setTimeout(() => {
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                    }, 1500);
                    this.isProcessingClick = false;
                    return;
                }
                
                // Handle the click
                this.handleCountryClick(country.code, country.name);
                
                // Reset processing flag after a short delay to allow the click to process
                setTimeout(() => {
                    this.isProcessingClick = false;
                }, 100);
            };
            
            // Add click handler to SVG
            // Use capture phase but check if we just dragged
            const wrappedClickHandler = (e) => {
                // If we just finished dragging, don't process this click
                if (this.wasDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                clickHandler(e);
            };
            svgToUse.addEventListener('click', wrappedClickHandler, true); // Use capture phase
            
            // Also add to map container as fallback (in case SVG click doesn't fire)
            // IMPORTANT: Use capture phase and make sure clicks on paths work
            if (this.mapContainer) {
                this.mapContainer.addEventListener('click', (e) => {
                    // If we just finished dragging, don't process this click
                    if (this.wasDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    
                    // Always check for path clicks first (for Classic and Streak modes)
                    const path = e.target.closest('path');
                    
                    if (path && (path.hasAttribute('data-country-code') || path.classList.contains('country-path'))) {
                        // Path click - use the path handler
                        clickHandler(e);
                        return;
                    }
                    
                    // Handle map click mode - click anywhere on map to guess
                    if (!this.gameActive) {
                        // Game not started - show prompt
                        this.showStartGamePrompt();
                        setTimeout(() => {
                            this.hideStartGamePrompt();
                        }, 3000);
                    }
                }, true); // Use capture phase to catch clicks early
            }
            
            console.log('[Geography Game] Click handlers attached to SVG and container');
            
            // Hover effects removed to prevent any movement or disappearing countries
        } else {
            console.warn('[Geography Game] SVG not found when trying to initialize click handlers');
        }
    }
    
    // Add direct click handlers to each path for maximum reliability
    addDirectClickHandlers() {
        if (!this.svg) return;
        
        const paths = this.svg.querySelectorAll('path[data-country-code]');
        console.log(`[Geography Game] Adding direct click handlers to ${paths.length} country paths`);
        
        paths.forEach((path, index) => {
            // Ensure path is clickable - CRITICAL
            path.style.pointerEvents = 'auto';
            path.style.cursor = 'pointer';
            path.style.position = 'relative';
            path.style.zIndex = '10';
            path.classList.add('country-path');
            
            // Remove ALL existing event listeners by cloning (but keep attributes)
            const newPath = path.cloneNode(true);
            if (path.parentNode) {
                path.parentNode.replaceChild(newPath, path);
            }
            
            // Add multiple event handlers for maximum compatibility
            const clickHandler = (e) => {
                console.log('[Geography Game] PATH CLICKED!', e);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Check if game is active
                if (!this.gameActive) {
                    console.log('[Geography Game] Game not active');
                    // Show start game prompt
                    this.showStartGamePrompt();
                    setTimeout(() => {
                        this.hideStartGamePrompt();
                    }, 3000);
                    return;
                }
                
                if (!this.currentCountry) {
                    console.log('[Geography Game] No current country');
                    return;
                }
                
                const countryCode = newPath.getAttribute('data-country-code');
                const countryName = newPath.getAttribute('data-country-name');
                
                console.log('[Geography Game] Clicked country:', countryCode, countryName);
                
                if (countryCode) {
                    const country = POPULOUS_COUNTRIES.find(c => 
                        c.code.toLowerCase() === countryCode.toLowerCase()
                    );
                    
                    if (country) {
                        console.log('[Geography Game] Handling click for:', country.name);
                        // Use setTimeout to ensure this runs after any other handlers
                        setTimeout(() => {
                            this.handleCountryClick(country.code, country.name);
                        }, 0);
                    } else {
                        console.log('[Geography Game] Country not found in list');
                    }
                } else {
                    console.log('[Geography Game] No country code on path');
                }
            };
            
            // Add click handler with capture phase
            newPath.addEventListener('click', clickHandler, true);
            // Also add without capture as backup
            newPath.addEventListener('click', clickHandler, false);
            // Add mousedown as backup
            newPath.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click only
                    console.log('[Geography Game] Mouse down on path');
                    clickHandler(e);
                }
            }, true);
            
            // Update country map reference
            const countryCode = newPath.getAttribute('data-country-code');
            if (countryCode) {
                this.countryMap[countryCode.toLowerCase()] = newPath;
                this.countryMap[countryCode.toUpperCase()] = newPath;
            }
            
            // Log first few paths for debugging
            if (index < 3) {
                console.log(`[Geography Game] Path ${index} setup:`, {
                    code: countryCode,
                    pointerEvents: newPath.style.pointerEvents,
                    cursor: newPath.style.cursor,
                    zIndex: newPath.style.zIndex
                });
            }
        });
        
        console.log('[Geography Game] Direct click handlers added successfully');
    }
    
    // Show start game prompt on map
    showStartGamePrompt() {
        if (!this.mapContainer) return;
        
        // Remove existing prompt if any
        this.hideStartGamePrompt();
        
        // Create overlay message
        const overlay = document.createElement('div');
        overlay.id = 'startGamePrompt';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            pointer-events: none;
            animation: fadeIn 0.3s ease;
        `;
        
        const message = document.createElement('div');
        message.style.cssText = `
            background: rgba(15, 15, 35, 0.95);
            border: 2px solid rgba(74, 144, 226, 0.5);
            border-radius: 12px;
            padding: 25px 35px;
            text-align: center;
            color: rgba(255, 255, 255, 0.9);
            font-size: 1.3rem;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: pulse 2s ease-in-out infinite;
            max-width: 400px;
        `;
        message.textContent = 'Click "Start Game" to begin!';
        
        // Create arrow pointing UP to start button
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            margin-bottom: 20px;
            font-size: 3rem;
            animation: bounce 1s ease-in-out infinite;
        `;
        arrow.textContent = '👆';
        
        overlay.appendChild(arrow);
        overlay.appendChild(message);
        this.mapContainer.appendChild(overlay);
        
        // Add aura effect to start button
        if (this.startBtn) {
            this.startBtn.classList.add('start-button-aura');
            this.startBtn.style.animation = 'buttonAura 1.5s ease-in-out infinite';
        }
    }
    
    // Hide start game prompt
    hideStartGamePrompt() {
        const existing = document.getElementById('startGamePrompt');
        if (existing) {
            existing.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (existing.parentNode) {
                    existing.parentNode.removeChild(existing);
                }
            }, 50); // Faster removal
        }
        
        // Also check if it's in the map container (direct removal)
        if (this.mapContainer) {
            const overlayInMap = this.mapContainer.querySelector('#startGamePrompt');
            if (overlayInMap) {
                overlayInMap.remove();
            }
        }
        
        // Remove aura from start button
        if (this.startBtn) {
            this.startBtn.classList.remove('start-button-aura');
            this.startBtn.style.animation = '';
        }
    }
    
    createSimpleMap() {
        // Simplified SVG map structure - using a basic world map SVG
        // For production, you'd want to use a proper SVG world map file
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 1000 500');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        // Create a simple rectangle placeholder that will be replaced
        const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        placeholder.setAttribute('x', '500');
        placeholder.setAttribute('y', '250');
        placeholder.setAttribute('text-anchor', 'middle');
        placeholder.setAttribute('fill', '#fff');
        placeholder.textContent = 'Loading world map...';
        svg.appendChild(placeholder);
        
        this.mapContainer.appendChild(svg);
        
        // Try to load a proper SVG map
        this.loadSVGMap();
    }
    
    loadSVGMap() {
        // This method is called by createSimpleMap() as a fallback
        // The actual SVG loading is handled by the standalone loadSVGMap() function
        // which is called from the DOMContentLoaded handler
        // This method is kept for backwards compatibility but shouldn't be used
        // The real loading happens in the standalone function below
        console.log('[Geography Game] Class loadSVGMap() called - using standalone function instead');
        
        // If the standalone function exists, use it
        if (typeof window.loadSVGMap === 'function') {
            window.loadSVGMap();
        } else {
            // Fallback: wait a bit for the function to be defined
            setTimeout(() => {
                if (typeof loadSVGMap === 'function') {
                    loadSVGMap();
                } else {
                    console.warn('[Geography Game] Standalone loadSVGMap() not available, using placeholder');
            this.showMapInstructions();
                }
            }, 100);
        }
    }
    
    showMapInstructions() {
        // Show message that a proper SVG map file is needed
        this.mapContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #fff;">
                <p style="font-size: 1.2rem; margin-bottom: 20px;">
                    World map loading... 
                </p>
                <p style="opacity: 0.8;">
                    The interactive world map requires an SVG map file with country paths.
                    Please ensure the map file is available.
                </p>
            </div>
        `;
    }
    
    createMapFromGeoJSON(geoData) {
        // This would convert GeoJSON to SVG paths
        // For now, we'll use a simpler approach
        console.log('GeoJSON loaded:', geoData);
        // Implementation would create SVG paths from GeoJSON features
    }
    
    setupEventListeners() {
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                try {
                    this.startGame();
                } catch (e) {
                    console.error('Error starting game:', e);
                }
            });
        }
        
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                try {
                    this.resetGame();
                } catch (e) {
                    console.error('Error resetting game:', e);
                    // Force reset even on error
                    this.gameActive = false;
                    if (this.startBtn) this.startBtn.disabled = false;
                    if (this.resetBtn) this.resetBtn.disabled = true;
                }
            });
        }
        
        if (this.hintBtn) {
            this.hintBtn.addEventListener('click', () => this.showHint());
        }
        
        // Setup drag handlers - can be called multiple times
        this.setupDragHandlers();
    }
    
    setupDragHandlers() {
        // Pan functionality with mouse - enable dragging
        if (!this.mapContainer) return;
        
        // Remove old handlers if they exist
        if (this._dragMouseMove) {
            document.removeEventListener('mousemove', this._dragMouseMove);
            document.removeEventListener('mouseup', this._dragMouseUp);
        }
        
        let dragStartX = 0;
        let dragStartY = 0;
        let dragStartPanX = 0;
        let dragStartPanY = 0;
        let isDragging = false;
        
        this._dragMouseMove = (e) => {
            // Only process if we've actually started dragging (mouse moved enough)
            if (!isDragging) return;
            
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            
            // Reduce sensitivity by applying a multiplier (0.7 = 70% sensitivity)
            const sensitivity = 0.7;
            
            this.panX = dragStartPanX + (deltaY * sensitivity); // Vertical movement
            this.panY = dragStartPanY + (deltaX * sensitivity); // Horizontal movement
            this.updateTransform();
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        this._dragMouseUp = (e) => {
            // Clean up the checkMove listener if it exists
            if (this._checkMove) {
                document.removeEventListener('mousemove', this._checkMove);
                this._checkMove = null;
            }
            
            if (isDragging) {
                this.wasDragging = true;
                setTimeout(() => {
                    this.wasDragging = false;
                }, 100);
                e.preventDefault();
                e.stopPropagation();
            }
            
            isDragging = false;
            document.removeEventListener('mousemove', this._dragMouseMove);
            document.removeEventListener('mouseup', this._dragMouseUp);
            
        if (this.mapContainer) {
                this.mapContainer.style.cursor = 'grab';
            }
        };
        
        const onMouseDown = (e) => {
            // Don't drag if clicking on a country path
                const path = e.target.closest('path');
            if (path && (path.hasAttribute('data-country-code') || path.classList.contains('country-path'))) {
                return; // Let click handler process it
            }
            
            // Don't drag if clicking on buttons or controls
            if (e.target.closest('button') || e.target.closest('.zoom-controls')) {
                    return;
                }
                
            // Start dragging - set initial values
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartPanX = this.panX;
            dragStartPanY = this.panY;
            isDragging = false; // Will be set to true on first mousemove
            
            // Track if mouse moves (to distinguish drag from click)
            let hasMoved = false;
            this._checkMove = (moveE) => {
                const moveDeltaX = Math.abs(moveE.clientX - dragStartX);
                const moveDeltaY = Math.abs(moveE.clientY - dragStartY);
                // Increased threshold from 5 to 10 pixels to reduce sensitivity
                if (moveDeltaX > 10 || moveDeltaY > 10) {
                    hasMoved = true;
                    isDragging = true;
                    if (this.mapContainer) {
                    this.mapContainer.style.cursor = 'grabbing';
                }
                    document.removeEventListener('mousemove', this._checkMove);
                    this._checkMove = null;
                }
            };
            
            document.addEventListener('mousemove', this._checkMove, { passive: false });
            document.addEventListener('mousemove', this._dragMouseMove, { passive: false });
            document.addEventListener('mouseup', this._dragMouseUp, { passive: false });
            
            // Prevent default to allow dragging
            e.preventDefault();
            e.stopPropagation();
        };
        
        // Remove old mousedown listener if exists
        if (this._dragMouseDown) {
            this.mapContainer.removeEventListener('mousedown', this._dragMouseDown, true);
        }
        this._dragMouseDown = onMouseDown;
        
        // Attach to both container and SVG if available
        this.mapContainer.addEventListener('mousedown', onMouseDown, true);
        if (this.svg) {
            this.svg.addEventListener('mousedown', onMouseDown, true);
        }
        
        // Set initial cursor
                this.mapContainer.style.cursor = 'grab';
            
            // Pan with touch - improved for mobile
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            let touchMoved = false;
            let touchTarget = null;
            
            // Pinch to zoom on mobile
            let initialDistance = 0;
            let initialZoom = 1;
            let pinchCenterX = 0;
            let pinchCenterY = 0;
            
            // Unified touch handler for pan, tap, and pinch zoom
            this.mapContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    // Two finger touch - prepare for pinch zoom
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    initialDistance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                    );
                    initialZoom = this.zoomLevel;
                    const rect = this.mapContainer.getBoundingClientRect();
                    pinchCenterX = ((touch1.clientX + touch2.clientX) / 2) - rect.left;
                    pinchCenterY = ((touch1.clientY + touch2.clientY) / 2) - rect.top;
                    this.isPanning = false; // Disable panning during pinch
                    e.preventDefault();
                } else if (e.touches.length === 1) {
                    // Single touch - prepare for pan or tap
                    touchTarget = e.target;
                    const path = touchTarget.closest('path');
                    
                    // If touching a country path, don't start panning - allow click
                    if (path && (path.hasAttribute('data-country-code') || path.classList.contains('country-path'))) {
                        // This is a country click, don't pan
                        this.isPanning = false;
                        touchMoved = false;
                        // Don't prevent default - let the click handler work
                        return;
                    }
                    
                    // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
                    this.isPanning = true;
                    touchStartX = e.touches[0].clientX - this.panY; // clientX -> panY (horizontal)
                    touchStartY = e.touches[0].clientY - this.panX; // clientY -> panX (vertical)
                    touchStartTime = Date.now();
                    touchMoved = false;
                    e.preventDefault();
                }
            }, { passive: false });
            
            this.mapContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    // Pinch zoom - reduced sensitivity
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const currentDistance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                    );
                    // Apply sensitivity reduction: scale the change by 0.7 to make it less sensitive
                    const rawScale = currentDistance / initialDistance;
                    const scale = 1 + (rawScale - 1) * 0.7; // Reduce sensitivity by 30%
                    const newZoom = initialZoom * scale;
                    this.zoomLevel = Math.min(3, Math.max(this.minZoomLevel || 1, newZoom));
                    this.zoom(1, pinchCenterX, pinchCenterY); // Update zoom and center
                    e.preventDefault();
                } else if (this.isPanning && e.touches.length === 1) {
                    // Single touch pan
                    // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
                    const deltaX = Math.abs(e.touches[0].clientX - (touchStartX + this.panY));
                    const deltaY = Math.abs(e.touches[0].clientY - (touchStartY + this.panX));
                    
                    // If moved more than 15px, consider it a pan (increased from 10 to reduce sensitivity)
                    if (deltaX > 15 || deltaY > 15) {
                        touchMoved = true;
                    }
                    
                    if (touchMoved) {
                        // Horizontal touch movement (clientX) moves map horizontally (panY)
                        // Reduce sensitivity by applying a multiplier (0.7 = 70% sensitivity)
                        const sensitivity = 0.7;
                        // Vertical touch movement (clientY) moves map vertically (panX)
                        this.panY = (e.touches[0].clientX - touchStartX) * sensitivity; // Horizontal
                        this.panX = (e.touches[0].clientY - touchStartY) * sensitivity; // Vertical
                        this.updateTransform();
                        e.preventDefault();
                    }
                }
            }, { passive: false });
            
            this.mapContainer.addEventListener('touchend', (e) => {
                if (e.touches.length === 0) {
                    // All fingers lifted
                    if (!touchMoved && touchStartTime) {
                        const touchDuration = Date.now() - touchStartTime;
                        const wasQuickTap = !touchMoved && touchDuration < 300;
                        
                        // If it was a quick tap on a country path, trigger click
                        if (wasQuickTap && touchTarget && touchTarget.tagName === 'path' && touchTarget.hasAttribute('data-country-code')) {
                            // Prevent default to avoid double-firing with native click
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Small delay to ensure touch events are fully processed
                            setTimeout(() => {
                            // Trigger click event on the path
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            touchTarget.dispatchEvent(clickEvent);
                            }, 50);
                        }
                    }
                    
                    this.isPanning = false;
                    touchMoved = false;
                    touchTarget = null;
                    initialDistance = 0;
                }
            }, { passive: false });
            
            // Zoom with mouse wheel - reduced sensitivity
            this.mapContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.mapContainer.getBoundingClientRect();
                const centerX = e.clientX - rect.left;
                const centerY = e.clientY - rect.top;
                // Reduced from 0.9/1.1 (10% change) to 0.96/1.04 (4% change) for less sensitivity
                const delta = e.deltaY > 0 ? 0.96 : 1.04;
                this.zoom(delta, centerX, centerY);
            });
    }
    
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const resetZoomBtn = document.getElementById('resetZoom');
        
        if (zoomInBtn) {
            // Reduced from 1.2 (20% change) to 1.1 (10% change) for less sensitivity
            zoomInBtn.addEventListener('click', () => this.zoom(1.1));
        }
        if (zoomOutBtn) {
            // Reduced from 0.8 (20% change) to 0.9 (10% change) for less sensitivity
            zoomOutBtn.addEventListener('click', () => this.zoom(0.9));
        }
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', () => this.resetZoomPan());
        }
    }
    
    zoom(factor, centerX, centerY) {
        const oldZoom = this.zoomLevel;
        // Calculate new zoom level (will be constrained in updateTransform)
        const newZoom = this.zoomLevel * factor;
        this.zoomLevel = Math.min(3, newZoom);
        
        // Zoom toward mouse position if provided
        // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
        if (centerX !== undefined && centerY !== undefined && this.mapContainer) {
            // centerX and centerY are already in local coordinates (from wheel event)
            const zoomChange = this.zoomLevel / oldZoom;
            // centerX (horizontal) -> panY, centerY (vertical) -> panX
            this.panY = centerX - (centerX - this.panY) * zoomChange; // Horizontal zoom center
            this.panX = centerY - (centerY - this.panX) * zoomChange; // Vertical zoom center
        }
        
        // updateTransform will enforce the minimum zoom based on SVG fit
        this.updateTransform();
    }
    
    resetZoomPan() {
        this.zoomLevel = this.minZoomLevel || 1;
        this.panX = 0;
        this.panY = 0;
        // Force recalculation of natural dimensions to recenter
        this.svgNaturalWidth = 0;
        this.svgNaturalHeight = 0;
        this.updateTransform();
    }
    
    updateTransform() {
        if (this.mapContainer && this.svg) {
            const svgElement = this.mapContainer.querySelector('svg');
            if (svgElement) {
                // Get container dimensions
                const containerRect = this.mapContainer.getBoundingClientRect();
                const containerWidth = containerRect.width;
                const containerHeight = containerRect.height;
                
                // Get SVG natural dimensions (from viewBox or natural size)
                if (this.svgNaturalWidth === 0 || this.svgNaturalHeight === 0) {
                    const viewBox = svgElement.getAttribute('viewBox');
                    if (viewBox) {
                        const [x, y, width, height] = viewBox.split(' ').map(Number);
                        this.svgNaturalWidth = width || svgElement.clientWidth || 800;
                        this.svgNaturalHeight = height || svgElement.clientHeight || 400;
                    } else {
                        this.svgNaturalWidth = svgElement.clientWidth || svgElement.getBoundingClientRect().width || 800;
                        this.svgNaturalHeight = svgElement.clientHeight || svgElement.getBoundingClientRect().height || 400;
                    }
                }
                
                // Calculate how the SVG is displayed
                // Since preserveAspectRatio is 'none', the SVG fills the container
                // But we need to calculate the actual displayed size based on the SVG's natural aspect ratio
                // and how it's stretched/fitted to the container
                const svgAspect = this.svgNaturalWidth / this.svgNaturalHeight;
                const containerAspect = containerWidth / containerHeight;
                
                let displayedWidth, displayedHeight;
                // Calculate displayed size to fit the container properly while allowing scrolling
                // For world maps, we want the map to be larger than the container to enable scrolling
                // but initially position it to fit well
                
                // Calculate the scale needed to fit both dimensions
                const scaleToFitWidth = containerWidth / this.svgNaturalWidth;
                const scaleToFitHeight = containerHeight / this.svgNaturalHeight;
                
                // Use the smaller scale to ensure it fits in both dimensions initially
                const fitScale = Math.min(scaleToFitWidth, scaleToFitHeight);
                
                // Base displayed size that fits the container
                displayedWidth = this.svgNaturalWidth * fitScale;
                displayedHeight = this.svgNaturalHeight * fitScale;
                
                // If the map fits perfectly, make it slightly larger to enable scrolling
                // Otherwise keep it at the fit size
                if (displayedWidth <= containerWidth && displayedHeight <= containerHeight) {
                    // Map fits - make it 10% larger in the dimension that needs it most
                    const widthRatio = containerWidth / displayedWidth;
                    const heightRatio = containerHeight / displayedHeight;
                    if (widthRatio < heightRatio) {
                        // Make wider to enable horizontal scrolling
                        displayedWidth = containerWidth * 1.1;
                        displayedHeight = displayedWidth / svgAspect;
                    } else {
                        // Make taller to enable vertical scrolling
                        displayedHeight = containerHeight * 1.1;
                        displayedWidth = displayedHeight * svgAspect;
                    }
                }
                
                // Calculate minimum zoom level - if SVG fits at zoom 1.0, don't allow zooming out
                // If SVG doesn't fit at zoom 1.0, calculate the zoom needed to just fit
                const fitsWidth = displayedWidth <= containerWidth;
                const fitsHeight = displayedHeight <= containerHeight;
                
                // For world maps, ensure both horizontal AND vertical scrolling is always possible
                // Since displayedWidth and displayedHeight are already set to be larger than container,
                // we can set a reasonable minimum zoom that keeps the map scrollable
                if (svgAspect > 1.5) {
                    // Wide map - ensure minimum zoom allows scrolling in both directions
                    // The displayedWidth/Height are already > container, so zoom 1.0 should work
                    // But we allow slight zoom out for better viewing
                    this.minZoomLevel = 0.85; // Allows slight zoom out while keeping scrollability
                } else if (fitsWidth && fitsHeight) {
                    // SVG fits completely at zoom 1.0 - don't allow zooming out below 1.0
                    this.minZoomLevel = 1.0;
                } else {
                    // SVG doesn't fit at zoom 1.0 - calculate minimum zoom to just fit
                    const scaleToFitWidth = containerWidth / displayedWidth;
                    const scaleToFitHeight = containerHeight / displayedHeight;
                    // Use the larger scale to ensure it fits in both dimensions
                    this.minZoomLevel = Math.max(scaleToFitWidth, scaleToFitHeight);
                    // But don't go below 0.5 as an absolute minimum
                    this.minZoomLevel = Math.max(0.5, this.minZoomLevel);
                }
                
                // Apply zoom
                let scaledWidth = displayedWidth * this.zoomLevel;
                let scaledHeight = displayedHeight * this.zoomLevel;
                
                // Enforce minimum zoom level
                if (this.zoomLevel < this.minZoomLevel) {
                    this.zoomLevel = this.minZoomLevel;
                    scaledWidth = displayedWidth * this.zoomLevel;
                    scaledHeight = displayedHeight * this.zoomLevel;
                }
                
                // Debug: Log dimensions to help diagnose scrolling issues
                if (this.zoomLevel === this.minZoomLevel && this.panX === 0 && this.panY === 0) {
                    console.log('Map dimensions:', {
                        container: { width: containerWidth, height: containerHeight },
                        svgNatural: { width: this.svgNaturalWidth, height: this.svgNaturalHeight },
                        aspect: svgAspect,
                        displayed: { width: displayedWidth, height: displayedHeight },
                        scaled: { width: scaledWidth, height: scaledHeight },
                        zoom: this.zoomLevel,
                        canScrollHorizontally: scaledWidth > containerWidth,
                        canScrollVertically: scaledHeight > containerHeight
                    });
                }
                
                // Center the SVG initially if it hasn't been manually panned yet
                const isInitialLoad = this.panX === 0 && this.panY === 0 && 
                                     (this.zoomLevel === this.minZoomLevel || this.zoomLevel === 1);
                
                if (isInitialLoad) {
                    // Note: panY controls horizontal (X) movement, panX controls vertical (Y) movement (due to swap in transform)
                    // Position map to fit perfectly in container - center it if it fits, or start at top-left if larger
                    
                    if (scaledWidth > containerWidth) {
                        // Map is wider than container - center it horizontally
                        this.panY = -(scaledWidth - containerWidth) / 2;
                    } else {
                        // Map fits or is smaller - center it horizontally
                        this.panY = (containerWidth - scaledWidth) / 2;
                    }
                    
                    if (scaledHeight > containerHeight) {
                        // Map is taller than container - center it vertically
                        this.panX = -(scaledHeight - containerHeight) / 2;
                    } else {
                        // Map fits or is smaller - center it vertically
                        this.panX = (containerHeight - scaledHeight) / 2;
                    }
                    
                    console.log('Initial map position set (centered):', {
                        panY: this.panY,
                        panX: this.panX,
                        scaledWidth,
                        scaledHeight,
                        containerWidth,
                        containerHeight,
                        isCentered: true
                    });
                }
                
                // Constrain panning to keep SVG within container bounds
                // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
                // Horizontal constraints (using panY) - allow negative values for left scrolling
                const maxPanY = Math.max(0, containerWidth - scaledWidth); // Right edge
                const minPanY = Math.min(0, containerWidth - scaledWidth); // Left edge (negative when scaledWidth > containerWidth)
                // Vertical constraints (using panX) - allow negative values for up scrolling
                const maxPanX = Math.max(0, containerHeight - scaledHeight); // Bottom edge
                const minPanX = Math.min(0, containerHeight - scaledHeight); // Top edge (negative when scaledHeight > containerHeight)
                
                // Clamp pan values - ensure we can scroll to see all parts of the map
                this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY)); // Horizontal constraint
                this.panX = Math.max(minPanX, Math.min(maxPanX, this.panX)); // Vertical constraint
                
                // Debug: Log scrolling constraints
                if (scaledWidth > containerWidth && (this.panY === maxPanY || this.panY === minPanY)) {
                    console.log('Horizontal scrolling constraint:', { 
                        minPanY, maxPanY, currentPanY: this.panY, 
                        scaledWidth, containerWidth,
                        canScrollLeft: this.panY > minPanY,
                        canScrollRight: this.panY < maxPanY
                    });
                }
                if (scaledHeight > containerHeight && (this.panX === maxPanX || this.panX === minPanX)) {
                    console.log('Vertical scrolling constraint:', { 
                        minPanX, maxPanX, currentPanX: this.panX, 
                        scaledHeight, containerHeight,
                        canScrollUp: this.panX > minPanX,
                        canScrollDown: this.panX < maxPanX
                    });
                }
                
                // Apply transform: translate(x, y) 
                // Swapped: panY controls horizontal movement, panX controls vertical movement
                // This fixes the issue where horizontal dragging was scrolling vertically
                svgElement.style.transform = `translate(${this.panY}px, ${this.panX}px) scale(${this.zoomLevel})`;
                svgElement.style.transformOrigin = 'top left';
            }
        }
    }
    
    resetLeaderboardForm() {
        const submitForm = document.getElementById('leaderboardSubmitForm');
        const nameInput = document.getElementById('playerNameInputGeo');
        const submitBtn = document.getElementById('submitScoreBtnGeo');
        const statusDiv = document.getElementById('submitStatusGeo');
        
        if (submitForm) {
            submitForm.style.display = 'none';
        }
        if (nameInput) {
            nameInput.value = '';
            nameInput.disabled = false;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
        }
        if (statusDiv) {
            statusDiv.textContent = '';
            statusDiv.className = 'submit-status';
        }
        this.pendingScoreData = null;
    }
    
    startGame() {
        // Hide any start game prompts
        this.hideStartGamePrompt();
        
        this.gameActive = true;
        this.score = 0;
        this.correct = 0;
        this.wrong = 0;
        this.answered.clear();
        this.wrongCountries.clear();
        this.clickedThisQuestion.clear(); // Clear clicked countries when starting new game
        this.attempts.clear();
        this.speedBonus = 0;
        this.questionTimes = [];
        
        // Reset leaderboard form
        this.resetLeaderboardForm();
        
        // Reset timer
        this.elapsedTime = 0;
        this.startTime = Date.now();
        this.startTimer();
        
        // Initialize countries for all modes
        this.shuffledCountries = [...this.countries].sort(() => Math.random() - 0.5);
        
        // Reset all country colors to green (when starting a NEW game, reset everything)
        // Note: This is only called when starting a fresh game, so we reset incorrect countries too
        const strokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : 'rgba(0, 0, 0, 0.8)';
        const strokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '1';
        
        Object.values(this.countryMap).forEach(path => {
            if (path) {
                // Reset all countries when starting a new game (fresh start)
                path.setAttribute('fill', '#2ECC71');
                path.style.removeProperty('fill'); // Remove any !important styles
                path.setAttribute('stroke', strokeColor);
                path.setAttribute('stroke-width', strokeWidth);
                path.classList.remove('correct', 'incorrect', 'disabled', 'wrong-answered');
                path.style.pointerEvents = 'auto';
            }
        });
        
        // Also reset any paths in the SVG that have data attributes
        if (this.svg) {
            const allPaths = this.svg.querySelectorAll('path[data-country-code]');
            allPaths.forEach(path => {
                // Reset all countries when starting a new game (fresh start)
                path.setAttribute('fill', '#2ECC71');
                path.style.removeProperty('fill'); // Remove any !important styles
                path.setAttribute('stroke', strokeColor);
                path.setAttribute('stroke-width', strokeWidth);
                path.classList.remove('correct', 'incorrect', 'disabled', 'wrong-answered');
                path.style.pointerEvents = 'auto';
            });
        }
        
        // Setup typing mode input if needed
        if (this.gameMode === GAME_MODES.TYPING) {
            this.setupTypingInput();
        } else {
            this.removeTypingInput();
        }
        
        // Remove any existing guess markers
        this.removeGuessMarker();
        
        // Get first country (this will update the prompt)
        this.getNextCountry();
        
        this.startBtn.disabled = true;
        this.resetBtn.disabled = false;
        if (this.hintBtn) {
            this.hintBtn.disabled = false;
            this.hintBtn.style.display = 'inline-flex';
        }
        this.feedbackEl.textContent = '';
        this.feedbackEl.className = 'feedback-message';
        
        this.updateStats();
        
        // Ensure prompt is visible and updated (don't call updatePromptForMode as it only works when game is inactive)
        if (this.promptEl && this.currentCountry) {
            // Prompt should already be set by getNextCountry(), but ensure it's visible
            this.promptEl.style.display = 'block';
        }
    }
    
    showHint() {
        if (!this.gameActive || !this.currentCountry) return;
        
        const fact = this.countryFacts[this.currentCountry.code];
        if (!fact) return;
        
        // Show continent hint
        const hintDisplay = document.createElement('div');
        hintDisplay.className = 'hint-display';
        hintDisplay.innerHTML = `
            <div class="hint-icon">💡</div>
            <div class="hint-content">
                <div class="hint-label">Hint:</div>
                <div class="hint-text">This country is in <strong>${fact.continent}</strong></div>
            </div>
        `;
        
        // Insert after prompt
        if (this.promptEl && this.promptEl.parentNode) {
            this.promptEl.parentNode.insertBefore(hintDisplay, this.promptEl.nextSibling);
        }
        
        setTimeout(() => {
            hintDisplay.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            hintDisplay.classList.remove('show');
            setTimeout(() => hintDisplay.remove(), 500);
        }, 4000);
        
        // Disable hint button after use
        if (this.hintBtn) {
            this.hintBtn.disabled = true;
        }
    }
    
    resetGame() {
        // Hide game complete screen
        const gameOver = document.getElementById('gameOverGeo');
        if (gameOver) {
            gameOver.style.display = 'none';
        }
        
        // Hide inline leaderboard
        const inlineLeaderboard = document.getElementById('inlineLeaderboardContainerGeo');
        if (inlineLeaderboard) {
            inlineLeaderboard.style.display = 'none';
        }
        
        // Reset leaderboard card title
        const cardTitle = document.getElementById('leaderboardCardTitleGeo');
        if (cardTitle) {
            cardTitle.textContent = 'Submit to Leaderboard';
        }
        
        // Fade out NeonDreams.wav and resume background music if playing
        try {
            this.fadeOutNeonDreamsAndResume();
        } catch (e) {
            console.log('Error fading out NeonDreams:', e);
        }
        // Fade out NeonDreams.wav and resume background music if playing
        try {
            this.fadeOutNeonDreamsAndResume();
        } catch (e) {
            console.log('Error fading out NeonDreams:', e);
        }
        
        // Stop any ongoing game activity
        this.gameActive = false;
        this.isProcessingClick = false;
        this.lastClickTime = 0;
        
        // Remove "Play Again" button if it exists
        const playAgainBtn = document.getElementById('playAgainBtnGeo');
        if (playAgainBtn) {
            playAgainBtn.remove();
        }
        
        // Clear flash timeout if exists (typing mode)
        if (this.flashTimeout) {
            clearTimeout(this.flashTimeout);
            this.flashTimeout = null;
        }
        
        // Clear flash interval if exists (typing mode)
        if (this.flashInterval) {
            clearInterval(this.flashInterval);
            this.flashInterval = null;
        }
        
        // Remove typing input if exists
        this.removeTypingInput();
        this.flashedCountry = null;
        
        // Reset game state
        this.answered.clear();
        this.wrongCountries.clear();
        this.attempts.clear();
        this.shuffledCountries = [];
        this.currentCountry = null;
        this.combo = 0;
        this.maxCombo = 0;
        this.achievements.clear();
        
        // Reset score and stats
        this.score = 0;
        this.correct = 0;
        this.wrong = 0;
        this.elapsedTime = 0;
        this.questionTimes = [];
        this.speedBonus = 0;
        this.startTime = null;
        
        // Stop all timers
        this.stopTimer();
        if (this.questionTimerInterval) {
            clearInterval(this.questionTimerInterval);
            this.questionTimerInterval = null;
        }
        
        // Hide question timer
        if (this.questionTimerEl) {
            this.questionTimerEl.style.display = 'none';
        }
        
        // Reset leaderboard form
        this.resetLeaderboardForm();
        
        // Remove any guess markers
        this.removeGuessMarker();
        
        // Reset map position and zoom
        this.resetZoomPan();
        
        // Reset all country colors to green (respecting HARD mode)
        const strokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : 'rgba(0, 0, 0, 0.8)';
        const strokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '1';
        
        Object.values(this.countryMap).forEach(path => {
            if (path) {
                path.setAttribute('fill', '#2ECC71');
                path.style.setProperty('fill', '#2ECC71', 'important');
                path.setAttribute('stroke', strokeColor);
                path.style.setProperty('stroke', strokeColor, 'important');
                path.setAttribute('stroke-width', strokeWidth);
                path.style.setProperty('stroke-width', strokeWidth, 'important');
                path.style.filter = '';
                path.classList.remove('correct', 'incorrect', 'disabled', 'wrong-answered');
                path.removeAttribute('data-attempt');
            }
        });
        
        // Also reset any paths in the SVG that have data attributes
        if (this.svg) {
            const allPaths = this.svg.querySelectorAll('path[data-country-code]');
            allPaths.forEach(path => {
                path.setAttribute('fill', '#2ECC71');
                path.style.setProperty('fill', '#2ECC71', 'important');
                path.setAttribute('stroke', strokeColor);
                path.style.setProperty('stroke', strokeColor, 'important');
                path.setAttribute('stroke-width', strokeWidth);
                path.style.setProperty('stroke-width', strokeWidth, 'important');
                path.style.filter = '';
                path.classList.remove('correct', 'incorrect', 'disabled', 'wrong-answered');
                path.removeAttribute('data-attempt');
            });
        }
        
        // Remove any existing country fact displays
        const existingFact = document.querySelector('.country-fact-display');
        if (existingFact) {
            existingFact.remove();
        }
        
        // Reset UI elements
        if (this.promptEl) {
        this.promptEl.textContent = 'Click "Start Game" to begin!';
            this.promptEl.style.display = 'block';
            this.promptEl.style.visibility = 'visible';
        }
        
        if (this.feedbackEl) {
        this.feedbackEl.textContent = '';
        this.feedbackEl.className = 'feedback-message';
        }
        
        // Reset buttons
        if (this.startBtn) {
        this.startBtn.disabled = false;
        }
        if (this.resetBtn) {
        this.resetBtn.disabled = true;
        }
        if (this.hintBtn) {
            this.hintBtn.disabled = true;
            this.hintBtn.style.display = 'none';
        }
        
        // Update stats display
        this.updateStats();
    }
    
    // Handle map click for GeoGuessr-style modes
    handleMapClick(e) {
        if (!this.gameActive || !this.currentCountry || !this.svg) return;
        
        const rect = this.mapContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Account for pan and zoom
        const svgRect = this.svg.getBoundingClientRect();
        const svgX = (x - this.panY) / this.zoomLevel;
        const svgY = (y - this.panX) / this.zoomLevel;
        
        // Convert to lat/lng
        const guessCoords = this.svgToLatLng(svgX, svgY, this.svg);
        if (!guessCoords) return;
        
        // Get correct country coordinates
        const correctCoords = {
            lat: this.currentCountry.lat,
            lng: this.currentCountry.lng
        };
        
        // Calculate distance
        const distance = this.calculateDistance(
            guessCoords.lat, guessCoords.lng,
            correctCoords.lat, correctCoords.lng
        );
        
        // Place marker on map
        this.placeGuessMarker(svgX, svgY);
        
        // Calculate score based on distance (like GeoGuessr)
        const score = this.calculateDistanceScore(distance);
        
        // Find which country was closest to the guess
        let closestCountry = null;
        let closestDistance = Infinity;
        this.countries.forEach(country => {
            const dist = this.calculateDistance(
                guessCoords.lat, guessCoords.lng,
                country.lat, country.lng
            );
            if (dist < closestDistance) {
                closestDistance = dist;
                closestCountry = country;
            }
        });
        
        // Show result
        this.showMapClickResult(distance, score, closestCountry);
        
        // Store round result
        if (this.gameMode === GAME_MODES.CHALLENGE) {
            this.rounds.push({
                country: this.currentCountry,
                guess: guessCoords,
                distance: distance,
                score: score,
                closestCountry: closestCountry
            });
        }
        
        // Update score
        this.score += score;
        this.updateStats();
        
        // Move to next round/country
        setTimeout(() => {
            if (this.gameMode === GAME_MODES.CHALLENGE) {
                this.currentRound++;
                if (this.currentRound > this.maxRounds) {
                    this.endChallenge();
                } else {
                    this.getNextCountry();
                }
            } else {
                this.getNextCountry();
            }
            this.removeGuessMarker();
        }, 3000);
    }
    
    calculateDistanceScore(distance) {
        // GeoGuessr-style scoring: closer = more points
        // Max score: 5000 points for perfect guess
        // Score decreases with distance
        if (distance < 1) return 5000; // Within 1km = perfect
        if (distance < 10) return 5000 - (distance * 50); // 1-10km
        if (distance < 50) return 4500 - ((distance - 10) * 30); // 10-50km
        if (distance < 100) return 3300 - ((distance - 50) * 20); // 50-100km
        if (distance < 500) return 2300 - ((distance - 100) * 3); // 100-500km
        if (distance < 1000) return 800 - ((distance - 500) * 1); // 500-1000km
        if (distance < 2500) return 300 - ((distance - 1000) * 0.1); // 1000-2500km
        return Math.max(0, 150 - ((distance - 2500) * 0.05)); // 2500km+
    }
    
    placeGuessMarker(x, y) {
        this.removeGuessMarker();
        
        if (!this.svg) return;
        
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        marker.setAttribute('cx', x);
        marker.setAttribute('cy', y);
        marker.setAttribute('r', '8');
        marker.setAttribute('fill', '#FFD700');
        marker.setAttribute('stroke', '#FF6B00');
        marker.setAttribute('stroke-width', '3');
        marker.style.pointerEvents = 'none';
        marker.id = 'guess-marker';
        this.svg.appendChild(marker);
        this.guessMarker = marker;
        
        // Add pulse animation
        marker.style.animation = 'pulse-marker 1s ease-in-out infinite';
    }
    
    removeGuessMarker() {
        if (this.guessMarker && this.guessMarker.parentNode) {
            this.guessMarker.parentNode.removeChild(this.guessMarker);
        }
        this.guessMarker = null;
    }
    
    showMapClickResult(distance, score, closestCountry) {
        // Flash viewport: green for close guesses (< 500km), red for far guesses
        const isClose = distance < 500;
        this.flashViewport(isClose);
        
        // Show correct location
        setTimeout(() => {
            this.highlightCorrectCountry();
        }, 1000);
    }
    
    highlightCorrectCountry() {
        if (!this.currentCountry) return;
        
        const allPaths = this.findAllPathsForCountry(this.currentCountry.code);
        allPaths.forEach(path => {
            path.style.transition = 'all 0.5s ease';
            path.setAttribute('fill', '#FFFFFF');
            path.setAttribute('stroke', '#E0E0E0');
            path.setAttribute('stroke-width', '3');
            path.classList.add('correct');
        });
    }
    
    endChallenge() {
        this.gameActive = false;
        this.stopTimer();
        
        const totalScore = this.rounds.reduce((sum, round) => sum + round.score, 0);
        const avgDistance = this.rounds.reduce((sum, round) => sum + round.distance, 0) / this.rounds.length;
        
        this.feedbackEl.innerHTML = `
            <div style="font-size: 1.5rem; margin-bottom: 10px;">🏆 Challenge Complete!</div>
            <div>Total Score: ${Math.round(totalScore)}</div>
            <div>Average Distance: ${avgDistance.toFixed(1)}km</div>
            <div style="margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">Click Reset to play again!</div>
        `;
        this.feedbackEl.className = 'feedback-message correct';
    }
    
    getNextCountry() {
        // Clear clicked countries for the new question - re-enable all countries
        this.clickedThisQuestion.clear();
        
        // Re-enable pointer events on all countries for the new question
        // BUT don't re-enable countries that are marked as incorrect (wrong 3 times)
        // AND don't re-enable countries that have been correctly answered (white/yellow/orange)
        if (this.svg) {
            const allPaths = this.svg.querySelectorAll('path');
            allPaths.forEach(path => {
                // Don't re-enable countries that are permanently marked as incorrect
                if (path.classList.contains('incorrect')) {
                    return; // Keep disabled
                }
                
                // Don't re-enable countries that have been correctly answered (white/yellow/orange)
                // These should stay disabled and colored for the entire game
                if (path.classList.contains('correct')) {
                    return; // Keep disabled and colored
                }
                
                // Re-enable all countries that aren't permanently incorrect or correctly answered
                // Wrong countries (red) are reset to green and re-enabled after the flash
                path.style.pointerEvents = 'auto';
                path.classList.remove('disabled', 'wrong-answered');
            });
        }
        if (this.shuffledCountries.length === 0) {
            // Game complete
            this.endGame();
            return;
        }
        
        this.currentCountry = this.shuffledCountries.shift();
        
        // Reset question timer
        this.questionStartTime = Date.now();
        this.updateQuestionTimer();
        if (this.questionTimerEl) {
            this.questionTimerEl.style.display = 'flex';
        }
        
        // Handle typing mode - flash country first
        if (this.gameMode === GAME_MODES.TYPING) {
            console.log('[Geography Game] TYPING MODE - Calling flashCountryForTyping');
            // Reset typing mode state for new country
            this.typingRevealedLetters = 0;
            this.typingWrongAttempts = 0;
            this.flashCountryForTyping();
            return;
        }
        
        // Update prompt based on mode
        if (!this.promptEl) {
            console.error('[Geography Game] Prompt element not found!');
            return;
        }
        
        this.promptEl.textContent = `Find: ${this.currentCountry.name}`;
        
        // Ensure prompt is visible
        this.promptEl.style.display = 'block';
        this.promptEl.style.visibility = 'visible';
        
        // Reset attempts for this country
        this.attempts.set(this.currentCountry.code, 0);
        
        // Re-enable hint button for new country
        if (this.hintBtn) {
            this.hintBtn.disabled = false;
        }
        
        // Remove any previous markers
        this.removeGuessMarker();
    }
    
    flashCountryForTyping() {
        console.log('[Geography Game] flashCountryForTyping CALLED');
        if (!this.currentCountry) {
            console.log('[Geography Game] No current country for flash');
            return;
        }
        
        console.log(`[Geography Game] Starting flash for ${this.currentCountry.name} (${this.currentCountry.code})`);
        
        // Find all paths for the country
        const countryPaths = this.findAllPathsForCountry(this.currentCountry.code);
        console.log(`[Geography Game] Flash: Found ${countryPaths.length} paths for ${this.currentCountry.name} (${this.currentCountry.code})`);
        
        if (countryPaths.length === 0) {
            console.warn(`[Geography Game] NO PATHS FOUND! Country: ${this.currentCountry.name} (${this.currentCountry.code})`);
            // Still show input even if paths not found
            setTimeout(() => {
                this.showTypingInput();
            }, 500);
            return;
        }
        
        console.log('[Geography Game] PATHS FOUND - Starting flash animation');
        
        // Log the paths we found for debugging
        console.log(`[Geography Game] Paths to flash:`, countryPaths.map(p => ({
            id: p.id,
            dataCode: p.getAttribute('data-country-code'),
            fill: p.getAttribute('fill'),
            styleFill: p.style.fill
        })));
        
        // Store reference for later
        this.flashedCountry = this.currentCountry;
        
        // Pan/zoom to show the country if it has coordinates
        if (this.currentCountry.lat && this.currentCountry.lng && this.mapContainer) {
            try {
                // Calculate approximate position on map (this is a rough estimate)
                // World map SVG typically has viewBox like "0 0 1000 500" or similar
                const svgElement = this.mapContainer.querySelector('svg');
                if (svgElement) {
                    const viewBox = svgElement.getAttribute('viewBox');
                    if (viewBox) {
                        const [x, y, width, height] = viewBox.split(' ').map(Number);
                        // Convert lat/lng to SVG coordinates (rough approximation)
                        // Longitude: -180 to 180 maps to 0 to width
                        // Latitude: 90 to -90 maps to 0 to height
                        const svgX = ((this.currentCountry.lng + 180) / 360) * width;
                        const svgY = ((90 - this.currentCountry.lat) / 180) * height;
                        
                        // Get container dimensions
                        const containerRect = this.mapContainer.getBoundingClientRect();
                        const containerWidth = containerRect.width;
                        const containerHeight = containerRect.height;
                        
                        // Calculate pan to center the country
                        // Account for current zoom level
                        const scaledWidth = width * this.zoomLevel;
                        const scaledHeight = height * this.zoomLevel;
                        
                        // Center the country in the viewport
                        this.panY = containerWidth / 2 - (svgX * this.zoomLevel);
                        this.panX = containerHeight / 2 - (svgY * this.zoomLevel);
                        this.updateTransform();
                    }
                }
            } catch (e) {
                console.log('[Geography Game] Error panning to country:', e);
            }
        }
        
        // Clear any existing flash interval
        if (this.flashInterval) {
            clearInterval(this.flashInterval);
            this.flashInterval = null;
        }
        
        // Flash the country with high visibility - CONTINUOUS PULSING
        // Store paths reference for the interval
        this.flashingPaths = countryPaths;
        let flashState = 0; // 0 = bright, 1 = medium, 2 = dim (cycle through 3 states)
        
        console.log('[Geography Game] Creating flash interval');
        
        const flashInterval = setInterval(() => {
            if (!this.flashingPaths || this.flashingPaths.length === 0) {
                console.log('[Geography Game] No flashing paths, clearing interval');
                clearInterval(flashInterval);
                this.flashInterval = null;
                return;
            }
            
            this.flashingPaths.forEach((path) => {
                // Don't reset countries that are permanently marked as incorrect
                if (path.classList.contains('incorrect')) {
                    return; // Skip this path - it should stay red
                }
                
                // Remove any classes that might interfere
                path.classList.remove('correct', 'disabled');
                
                // Clear existing styles
                path.style.removeProperty('transition');
                
                if (flashState === 0) {
                    // Bright white flash - MAXIMUM VISIBILITY
                    path.setAttribute('fill', '#FFFFFF');
                    path.setAttribute('stroke', '#FFD700');
                    path.setAttribute('stroke-width', '6');
                    path.style.setProperty('fill', '#FFFFFF', 'important');
                    path.style.setProperty('stroke', '#FFD700', 'important');
                    path.style.setProperty('stroke-width', '6px', 'important');
                    path.style.setProperty('opacity', '1', 'important');
                    path.style.setProperty('filter', 'drop-shadow(0 0 25px rgba(255, 255, 255, 1)) drop-shadow(0 0 40px rgba(255, 215, 0, 1))', 'important');
                } else if (flashState === 1) {
                    // Medium brightness - still very visible
                    path.setAttribute('fill', '#FFE5E5');
                    path.setAttribute('stroke', '#FFA500');
                    path.setAttribute('stroke-width', '5');
                    path.style.setProperty('fill', '#FFE5E5', 'important');
                    path.style.setProperty('stroke', '#FFA500', 'important');
                    path.style.setProperty('stroke-width', '5px', 'important');
                    path.style.setProperty('opacity', '1', 'important');
                    path.style.setProperty('filter', 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 35px rgba(255, 165, 0, 0.8))', 'important');
                } else {
                    // Dimmed but still visible
                    path.setAttribute('fill', '#FFCCCC');
                    path.setAttribute('stroke', '#FF6B6B');
                    path.setAttribute('stroke-width', '4');
                    path.style.setProperty('fill', '#FFCCCC', 'important');
                    path.style.setProperty('stroke', '#FF6B6B', 'important');
                    path.style.setProperty('stroke-width', '4px', 'important');
                    path.style.setProperty('opacity', '1', 'important');
                    path.style.setProperty('filter', 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 30px rgba(255, 107, 107, 0.6))', 'important');
                }
                
                // Ensure pointer events are enabled
                path.style.setProperty('pointer-events', 'auto', 'important');
            });
            
            flashState = (flashState + 1) % 3; // Cycle through 0, 1, 2
        }, 350); // Flash every 350ms for smooth pulsing
        
        this.flashInterval = flashInterval;
        console.log('[Geography Game] Flash interval created and stored');
        
        // Initial flash - start with maximum brightness
        countryPaths.forEach((path) => {
            // Remove any existing classes that might interfere
            path.classList.remove('correct', 'disabled');
            
            // Start with bright white and gold stroke for maximum visibility
            path.setAttribute('fill', '#FFFFFF');
            path.style.setProperty('fill', '#FFFFFF', 'important');
            path.setAttribute('stroke', '#FFD700');
            path.style.setProperty('stroke', '#FFD700', 'important');
            path.setAttribute('stroke-width', '6');
            path.style.setProperty('stroke-width', '6px', 'important');
            
            // Add strong glow effect
            path.style.setProperty('filter', 'drop-shadow(0 0 25px rgba(255, 255, 255, 1)) drop-shadow(0 0 40px rgba(255, 215, 0, 1))', 'important');
            
            // Ensure pointer events are enabled
            path.style.setProperty('pointer-events', 'auto', 'important');
            path.style.setProperty('opacity', '1', 'important');
            
            // Force a repaint
            path.offsetHeight;
        });
        
        // Force a repaint of the SVG to ensure changes are visible
        if (this.svg) {
            this.svg.style.display = 'none';
            this.svg.offsetHeight; // Trigger reflow
            this.svg.style.display = '';
        }
        
        console.log(`[Geography Game] Continuous flash started for ${countryPaths.length} paths`);
        
        // Update prompt during flash
        if (this.promptEl) {
            this.promptEl.textContent = '👀 Watch the country flash...';
            this.promptEl.style.display = 'block';
            this.promptEl.style.color = '#4A90E2';
            this.promptEl.style.fontSize = '1.3rem';
            this.promptEl.style.fontWeight = '600';
        }
        
        // After 2.5 seconds, show input but KEEP FLASHING CONTINUOUSLY
        this.flashTimeout = setTimeout(() => {
            console.log('[Geography Game] 2.5 seconds passed - showing input (flash continues)');
            // DON'T stop the continuous flashing - keep it going!
            // Just show the typing input
            this.showTypingInput();
            
            // Update prompt
            if (this.promptEl) {
                this.promptEl.textContent = '⌨️ Type the country name you saw:';
                this.promptEl.style.color = '#FFD700';
            }
        }, 2500);
        
        console.log('[Geography Game] Flash setup complete - interval running, timeout set');
    }
    
    setupTypingInput() {
        console.log('[Geography Game] setupTypingInput CALLED');
        if (this.typingInput) {
            console.log('[Geography Game] Typing input already exists, returning');
            return; // Already exists
        }
        
        console.log('[Geography Game] Creating typing input container');
        // Create input container with modern design
        const inputContainer = document.createElement('div');
        inputContainer.id = 'typingInputContainer';
        // Responsive width
        const isMobile = window.innerWidth < 768;
        const containerWidth = isMobile ? 'calc(100% - 40px)' : '400px';
        const containerPadding = isMobile ? '20px 25px' : '30px 35px';
        
        // Get viewport center for initial positioning
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;
        
        inputContainer.style.cssText = `
            position: fixed;
            top: ${viewportCenterY}px;
            left: ${viewportCenterX}px;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: linear-gradient(135deg, rgba(15, 25, 45, 0.98) 0%, rgba(20, 35, 60, 0.98) 100%);
            backdrop-filter: blur(20px);
            padding: ${containerPadding};
            border-radius: 20px;
            border: 2px solid rgba(74, 144, 226, 0.5);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(74, 144, 226, 0.3);
            display: none;
            flex-direction: column;
            cursor: move;
            user-select: none;
            width: ${containerWidth};
            max-width: 90vw;
            animation: typingInputFadeIn 0.3s ease-out;
        `;
        
        // Add fade-in animation style if not exists
        if (!document.getElementById('typingInputAnimationStyle')) {
            const style = document.createElement('style');
            style.id = 'typingInputAnimationStyle';
            style.textContent = `
                @keyframes typingInputFadeIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Create title/label
        const title = document.createElement('div');
        title.textContent = '⌨️ Type the Country Name';
        title.style.cssText = `
            font-size: 1.1rem;
            font-weight: 600;
            color: #4A90E2;
            margin-bottom: 15px;
            text-align: center;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        `;
        
        // Create drag handle indicator
        const dragHandle = document.createElement('div');
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            color: rgba(74, 144, 226, 0.5);
            font-size: 1.4rem;
            cursor: move;
            user-select: none;
            padding: 8px;
            line-height: 1;
            transition: color 0.2s;
        `;
        dragHandle.title = 'Drag to move';
        dragHandle.onmouseenter = () => dragHandle.style.color = 'rgba(74, 144, 226, 0.8)';
        dragHandle.onmouseleave = () => dragHandle.style.color = 'rgba(74, 144, 226, 0.5)';
        
        // Create input wrapper for better styling
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = `
            display: flex;
            gap: ${isMobile ? '8px' : '12px'};
            align-items: center;
            flex-direction: ${isMobile ? 'column' : 'row'};
            width: 100%;
        `;
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'typingInput';
        input.placeholder = 'Enter country name...';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.cssText = `
            flex: 1;
            width: 100%;
            padding: ${isMobile ? '12px 16px' : '14px 18px'};
            font-size: ${isMobile ? '1rem' : '1.15rem'};
            border: 2px solid rgba(74, 144, 226, 0.4);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.12);
            color: white;
            outline: none;
            cursor: text;
            transition: all 0.2s ease;
            font-family: 'Inter', sans-serif;
            box-sizing: border-box;
        `;
        input.onfocus = () => {
            input.style.borderColor = '#4A90E2';
            input.style.boxShadow = '0 0 0 3px rgba(74, 144, 226, 0.2)';
            input.style.background = 'rgba(255, 255, 255, 0.15)';
        };
        input.onblur = () => {
            input.style.borderColor = 'rgba(74, 144, 226, 0.4)';
            input.style.boxShadow = 'none';
            input.style.background = 'rgba(255, 255, 255, 0.12)';
        };
        input.oninput = () => {
            // Clear any error styling on input
            input.style.borderColor = input === document.activeElement ? '#4A90E2' : 'rgba(74, 144, 226, 0.4)';
        };
        
        // Create submit button
        const submitBtn = document.createElement('button');
        submitBtn.innerHTML = '✓ Submit';
        submitBtn.style.cssText = `
            padding: ${isMobile ? '12px 24px' : '14px 28px'};
            font-size: ${isMobile ? '1rem' : '1.1rem'};
            font-weight: 600;
            background: linear-gradient(135deg, #4A90E2 0%, #2A60B0 100%);
            border: none;
            border-radius: 10px;
            color: white;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
            white-space: nowrap;
            width: ${isMobile ? '100%' : 'auto'};
        `;
        submitBtn.onmouseenter = () => {
            submitBtn.style.transform = 'translateY(-2px)';
            submitBtn.style.boxShadow = '0 6px 16px rgba(74, 144, 226, 0.4)';
            submitBtn.style.filter = 'brightness(1.1)';
        };
        submitBtn.onmouseleave = () => {
            submitBtn.style.transform = 'translateY(0)';
            submitBtn.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.3)';
            submitBtn.style.filter = 'brightness(1)';
        };
        submitBtn.onmousedown = () => {
            submitBtn.style.transform = 'translateY(0) scale(0.98)';
        };
        submitBtn.onmouseup = () => {
            submitBtn.style.transform = 'translateY(-2px)';
        };
        
        // IMPROVED DRAG - Make container draggable with smooth movement (no jumping)
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        
        const makeDraggable = (e) => {
            // Only drag if clicking on container background or drag handle, NOT input/button
            const target = e.target;
            if (target === input || target === submitBtn || target.closest('input') || target.closest('button') || target === title) {
                return;
            }
            
            isDragging = true;
            
            // Get mouse/touch position
            const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
            
            // Get current container position (center point)
            const rect = inputContainer.getBoundingClientRect();
            const containerCenterX = rect.left + rect.width / 2;
            const containerCenterY = rect.top + rect.height / 2;
            
            // Calculate offset from click point to container center
            // This ensures smooth dragging without jumping
            dragOffsetX = clientX - containerCenterX;
            dragOffsetY = clientY - containerCenterY;
            
            // Remove transition during drag for smooth movement
            inputContainer.style.transition = 'none';
            inputContainer.style.cursor = 'grabbing';
            
            e.stopPropagation();
            e.preventDefault();
        };
        
        const onDragMove = (e) => {
            if (!isDragging) return;
            
            // Get current mouse/touch position
            const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
            const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
            
            // Calculate new center position based on current mouse position minus offset
            const newX = clientX - dragOffsetX;
            const newY = clientY - dragOffsetY;
            
            // Clamp to viewport bounds (with padding)
            const padding = 20;
            const minX = padding;
            const maxX = window.innerWidth - padding;
            const minY = padding;
            const maxY = window.innerHeight - padding;
            
            const clampedX = Math.max(minX, Math.min(maxX, newX));
            const clampedY = Math.max(minY, Math.min(maxY, newY));
            
            // Update position smoothly (use fixed positioning for consistent behavior)
            inputContainer.style.position = 'fixed';
            inputContainer.style.left = `${clampedX}px`;
            inputContainer.style.top = `${clampedY}px`;
            inputContainer.style.transform = 'translate(-50%, -50%)';
            
            e.stopPropagation();
            e.preventDefault();
        };
        
        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                inputContainer.style.cursor = 'move';
                // Restore transition after drag
                inputContainer.style.transition = '';
            }
        };
        
        // Attach event listeners
        console.log('[Geography Game] Attaching drag event listeners');
        inputContainer.addEventListener('mousedown', makeDraggable);
        dragHandle.addEventListener('mousedown', makeDraggable);
        inputContainer.addEventListener('touchstart', makeDraggable, { passive: false });
        dragHandle.addEventListener('touchstart', makeDraggable, { passive: false });
        
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
        console.log('[Geography Game] Drag event listeners attached');
        
        // Handle input
        const handleSubmit = () => {
            const guess = input.value.trim();
            if (guess) {
                this.handleTypingInput(guess);
            }
        };
        
        submitBtn.onclick = handleSubmit;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            } else if (e.key === 'Escape') {
                // Allow escape to cancel (optional)
                const container = document.getElementById('typingInputContainer');
                if (container) {
                    container.style.display = 'none';
                }
            }
        };
        
        // Assemble container
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(submitBtn);
        inputContainer.appendChild(title);
        inputContainer.appendChild(dragHandle);
        inputContainer.appendChild(inputWrapper);
        
        // Append to body for fixed positioning to work correctly
        document.body.appendChild(inputContainer);
        this.typingInput = input;
        console.log('[Geography Game] Typing input container added to body');
    }
    
    removeTypingInput() {
        const container = document.getElementById('typingInputContainer');
        if (container) {
            container.remove();
        }
        this.typingInput = null;
    }
    
    showTypingInput() {
        const container = document.getElementById('typingInputContainer');
        if (container && this.typingInput) {
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            
            // If we have revealed letters (from wrong attempts), show them
            if (this.currentCountry && this.typingRevealedLetters > 0) {
                const normalizedName = this.currentCountry.name.toLowerCase().trim();
                this.typingInput.value = this.getRevealedCountryName(normalizedName);
            } else {
                // Reset for new country
                this.typingInput.value = '';
            }
            
            // Small delay before focus to ensure container is visible
            setTimeout(() => {
                this.typingInput.focus();
                if (this.typingInput.value) {
                    this.typingInput.select();
                }
            }, 100);
            
            // Update prompt with animation
            if (this.promptEl) {
                if (this.typingRevealedLetters > 0 && this.currentCountry) {
                    const normalizedName = this.currentCountry.name.toLowerCase().trim();
                    this.promptEl.textContent = `⌨️ Type the country name (${this.typingRevealedLetters}/${normalizedName.length} letters revealed):`;
                    this.promptEl.style.color = '#FFD700';
                } else {
                    this.promptEl.textContent = '⌨️ Type the country name you saw:';
                    this.promptEl.style.color = '#FFD700';
                }
                this.promptEl.style.fontSize = '1.3rem';
                this.promptEl.style.fontWeight = '600';
            }
        }
    }
    
    handleTypingInput(guess) {
        if (!this.flashedCountry || !this.gameActive) return;
        
        // Normalize guess and country name for comparison
        const normalizedGuess = guess.toLowerCase().trim();
        const normalizedName = this.flashedCountry.name.toLowerCase().trim();
        const normalizedAlt = this.flashedCountry.alt.map(a => a.toLowerCase());
        
        // Check if correct
        const isCorrect = normalizedGuess === normalizedName || 
                         normalizedAlt.includes(normalizedGuess);
        
        // Visual feedback on input (only green for correct, no red box for wrong in typing mode)
        const input = document.getElementById('typingInput');
        if (input) {
            if (isCorrect) {
                input.style.borderColor = '#2ECC71';
                input.style.boxShadow = '0 0 0 3px rgba(46, 204, 113, 0.3)';
            } else {
                // No red border/box for wrong answers in typing mode
                input.style.borderColor = '';
                input.style.boxShadow = '';
            }
        }
        
        // Small delay for visual feedback, then process answer
        setTimeout(() => {
            if (isCorrect) {
                // Correct answer - NOW stop flashing and process
                this.stopCountryFlash();
                this.handleCorrectAnswer();
                
                // Hide input
                const container = document.getElementById('typingInputContainer');
                if (container) {
                    container.style.display = 'none';
                }
                
                // Reset input styling
                if (input) {
                    input.style.borderColor = '';
                    input.style.boxShadow = '';
                }
                
                // Reset typing mode state
                this.typingRevealedLetters = 0;
                this.typingWrongAttempts = 0;
                this.flashedCountry = null;
            } else {
                // Wrong answer - keep flashing, reveal another letter
                this.typingWrongAttempts++;
                this.typingRevealedLetters = Math.min(
                    this.typingRevealedLetters + 1, 
                    normalizedName.length
                );
                
                // Update input with revealed letters (no red border/box for typing mode)
                if (input) {
                    const revealed = this.getRevealedCountryName(normalizedName);
                    input.value = revealed;
                    // Remove red border styling - keep normal styling
                    input.style.borderColor = '';
                    input.style.boxShadow = '';
                    
                    // Keep focus and select the text for easy retyping
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 50);
                }
                
                // Update prompt to show hint
                if (this.promptEl) {
                    this.promptEl.textContent = `❌ Wrong! Try again... (${this.typingRevealedLetters}/${normalizedName.length} letters revealed)`;
                    this.promptEl.style.color = '#E74C3C';
                }
                
                // Handle wrong answer (but don't stop flashing or hide input)
                this.handleWrongAnswerTyping();
            }
        }, 300);
    }
    
    getRevealedCountryName(countryName) {
        // Reveal letters progressively - NO underscores, just show revealed letters
        // Count only non-space characters for revealed letters
        let revealed = '';
        let letterCount = 0;
        
        for (let i = 0; i < countryName.length; i++) {
            if (countryName[i] === ' ') {
                // Always include spaces in the revealed string
                revealed += ' ';
            } else {
                // Only add letter if it's within the revealed count
                if (letterCount < this.typingRevealedLetters) {
                    revealed += countryName[i];
                    letterCount++;
                } else {
                    // Stop once we've shown all revealed letters
                    break;
                }
            }
        }
        
        return revealed;
    }
    
    stopCountryFlash() {
        // Stop the continuous flashing
        if (this.flashInterval) {
            clearInterval(this.flashInterval);
            this.flashInterval = null;
        }
        
        // Reset flashing paths to green
        if (this.flashingPaths) {
            this.flashingPaths.forEach(path => {
                // Don't reset countries that are permanently marked as incorrect
                if (path.classList.contains('incorrect')) {
                    return;
                }
                path.setAttribute('fill', '#2ECC71');
                path.style.removeProperty('fill');
                path.setAttribute('stroke', this.gameMode === GAME_MODES.HARD ? 'none' : 'rgba(0, 0, 0, 0.8)');
                path.style.removeProperty('stroke');
                path.setAttribute('stroke-width', this.gameMode === GAME_MODES.HARD ? '0' : '1');
                path.style.removeProperty('stroke-width');
                path.style.filter = 'none';
            });
            this.flashingPaths = null;
        }
    }
    
    handleWrongAnswerTyping() {
        if (!this.currentCountry) return;
        
        const newAttempts = (this.attempts.get(this.currentCountry.code) || 0) + 1;
        this.attempts.set(this.currentCountry.code, newAttempts);
        
        // Flash viewport red
        this.flashViewport(false);
        
        // Update stats but don't move to next country
        this.updateStats();
        
        // Keep flashing and input visible - let them try again
    }
    
    handleCorrectAnswer() {
        if (!this.currentCountry) return;
        
        const countryPaths = this.findAllPathsForCountry(this.currentCountry.code);
        const currentAttempts = this.attempts.get(this.currentCountry.code) || 0;
        
        // Mark as correct
        countryPaths.forEach(path => {
            let fillColor, strokeColor;
            if (currentAttempts === 0) {
                fillColor = '#FFFFFF';
                strokeColor = '#E0E0E0';
            } else if (currentAttempts === 1) {
                fillColor = '#FFD700';
                strokeColor = '#FFA500';
            } else {
                fillColor = '#FFB6C1';
                strokeColor = '#FF6B6B';
            }
            
            path.setAttribute('fill', fillColor);
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '3');
            path.setAttribute('data-attempt', currentAttempts.toString());
            path.style.filter = 'none';
        });
        
        // Flash viewport green
        this.flashViewport(true);
        
        // Update score and stats
        const questionTime = (Date.now() - this.questionStartTime) / 1000;
        let speedBonus = 0;
        if (questionTime < 2) speedBonus = 50;
        else if (questionTime < 5) speedBonus = 30;
        else if (questionTime < 10) speedBonus = 15;
        
        this.score += 100 + speedBonus;
        this.correct++;
        this.combo++;
        this.answered.add(this.currentCountry.code);
        
        // Show country fact
        try {
            this.showCountryFact(this.currentCountry);
        } catch (e) {
            console.log('Error showing country fact:', e);
        }
        
        // Move to next country
        setTimeout(() => {
            this.getNextCountry();
            this.isProcessingClick = false;
        }, 1500);
    }
    
    handleWrongAnswer() {
        if (!this.currentCountry) return;
        
        const newAttempts = (this.attempts.get(this.currentCountry.code) || 0) + 1;
        this.attempts.set(this.currentCountry.code, newAttempts);
        
        // Flash viewport red
        this.flashViewport(false);
        
        if (newAttempts >= 3) {
            // Out of attempts
            this.wrong++;
            this.answered.add(this.currentCountry.code);
            this.updateStats();
            
            setTimeout(() => {
                this.getNextCountry();
                this.isProcessingClick = false;
            }, 2000);
        } else {
            // Still have attempts - show input again
            setTimeout(() => {
                this.showTypingInput();
            }, 1000);
        }
    }
    
    findAllPathsForCountry(countryCode) {
        const allPaths = new Set();
        
        if (!countryCode || !this.svg) return Array.from(allPaths);
        
        const codeUpper = countryCode.toUpperCase();
        const codeLower = countryCode.toLowerCase();
        
        // Get country info first (needed for filtering)
        const country = POPULOUS_COUNTRIES.find(c => c.code.toUpperCase() === codeUpper);
        
        // Get from countryMap (with filtering for South Korea)
        if (this.countryMap[codeLower]) {
            const path = this.countryMap[codeLower];
            // For South Korea, check if it's North Korea
            if (country && country.code === 'KR') {
                const pathId = path.id || '';
                const pathName = path.getAttribute('name') || '';
                const pathDataName = path.getAttribute('data-country-name') || '';
                const pathText = `${pathId} ${pathName} ${pathDataName}`.toLowerCase();
                if (!(/\bnorth\s+korea\b/i.test(pathText) || 
                      /\bkorea.*north\b/i.test(pathText) ||
                      /\bnorth.*korea\b/i.test(pathText) ||
                      /\bkp\b/i.test(pathId) ||
                      pathDataName.toLowerCase() === 'north korea')) {
                    allPaths.add(path);
                }
            } else {
                allPaths.add(path);
            }
        }
        if (this.countryMap[codeUpper]) {
            const path = this.countryMap[codeUpper];
            // For South Korea, check if it's North Korea
            if (country && country.code === 'KR') {
                const pathId = path.id || '';
                const pathName = path.getAttribute('name') || '';
                const pathDataName = path.getAttribute('data-country-name') || '';
                const pathText = `${pathId} ${pathName} ${pathDataName}`.toLowerCase();
                if (!(/\bnorth\s+korea\b/i.test(pathText) || 
                      /\bkorea.*north\b/i.test(pathText) ||
                      /\bnorth.*korea\b/i.test(pathText) ||
                      /\bkp\b/i.test(pathId) ||
                      pathDataName.toLowerCase() === 'north korea')) {
                    allPaths.add(path);
                }
            } else {
                allPaths.add(path);
            }
        }
        
        // Find by data-country-code attribute (case insensitive)
        const pathsByCode = this.svg.querySelectorAll(`path[data-country-code="${codeUpper}"], path[data-country-code="${codeLower}"]`);
        pathsByCode.forEach(p => {
            // For South Korea, exclude paths that are clearly North Korea
            if (country && country.code === 'KR') {
                const pathId = p.id || '';
                const pathName = p.getAttribute('name') || '';
                const pathDataName = p.getAttribute('data-country-name') || '';
                const pathText = `${pathId} ${pathName} ${pathDataName}`.toLowerCase();
                // Exclude if it mentions North Korea or has KP code
                if (/\bnorth\s+korea\b/i.test(pathText) || 
                    /\bkorea.*north\b/i.test(pathText) ||
                    /\bnorth.*korea\b/i.test(pathText) ||
                    /\bkp\b/i.test(pathId) ||
                    pathDataName.toLowerCase() === 'north korea') {
                    return; // Skip North Korea paths
                }
            }
            allPaths.add(p);
        });
        
        // Find by ID - exact match
        const pathsById = this.svg.querySelectorAll(`path#${codeUpper}, path#${codeLower}`);
        pathsById.forEach(p => {
            // For South Korea, exclude paths that are clearly North Korea
            if (country && country.code === 'KR') {
                const pathId = p.id || '';
                const pathName = p.getAttribute('name') || '';
                const pathDataName = p.getAttribute('data-country-name') || '';
                const pathText = `${pathId} ${pathName} ${pathDataName}`.toLowerCase();
                // Exclude if it mentions North Korea or has KP code
                if (/\bnorth\s+korea\b/i.test(pathText) || 
                    /\bkorea.*north\b/i.test(pathText) ||
                    /\bnorth.*korea\b/i.test(pathText) ||
                    /\bkp\b/i.test(pathId) ||
                    pathDataName.toLowerCase() === 'north korea') {
                    return; // Skip North Korea paths
                }
            }
            allPaths.add(p);
        });
        
        // For archipelagos, also find paths with numbered IDs (e.g., "PH-1", "PH-2")
        if (country && (country.code === 'PH' || country.code === 'ID' || country.code === 'JP')) {
            // Find all paths whose ID starts with the country code
            const allPathsInSVG = this.svg.querySelectorAll('path');
            allPathsInSVG.forEach(path => {
                const pathId = path.id || '';
                // Match IDs like "PH", "PH-1", "PH-2", "ph-1", etc.
                if (new RegExp(`^${codeUpper}[-_]?\\d*$|^${codeLower}[-_]?\\d*$`, 'i').test(pathId)) {
                    allPaths.add(path);
                }
                // Also match IDs containing country name with numbers (e.g., "philippines-1")
                const countryNameLower = country.name.toLowerCase();
                if (new RegExp(`^${countryNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-_]?\\d*$`, 'i').test(pathId)) {
                    allPaths.add(path);
                }
            });
        }
        
        // Also search by data-country-name if available
        if (country) {
            const pathsByName = this.svg.querySelectorAll(`path[data-country-name="${country.name}"], path[data-country-name="${country.name.toLowerCase()}"]`);
            pathsByName.forEach(p => allPaths.add(p));
            
            // Try alternative names, but be careful with countries that have similar names
            country.alt.forEach(altName => {
                // For South Korea, don't match generic "korea" - only match "south korea"
                if (country.code === 'KR' && altName.toLowerCase() === 'korea') {
                    // Skip generic "korea" to avoid matching North Korea
                    return;
                }
                const pathsByAlt = this.svg.querySelectorAll(`path[data-country-name="${altName}"], path[data-country-name="${altName.toLowerCase()}"]`);
                pathsByAlt.forEach(p => {
                    // Additional check for South Korea - exclude paths that mention "north"
                    if (country.code === 'KR') {
                        const pathId = p.id || '';
                        const pathName = p.getAttribute('name') || '';
                        const pathClass = p.className?.baseVal || p.getAttribute('class') || '';
                        const pathTitle = p.querySelector('title')?.textContent || '';
                        const pathText = `${pathId} ${pathName} ${pathClass} ${pathTitle}`.toLowerCase();
                        
                        // Exclude if it mentions "north korea"
                        if (/\bnorth\s+korea\b/i.test(pathText) || 
                            /\bkorea.*north\b/i.test(pathText) ||
                            /\bnorth.*korea\b/i.test(pathText)) {
                            return; // Skip this path - it's North Korea
                        }
                    }
                    allPaths.add(p);
                });
            });
        }
        
        // Additional filtering for South Korea - remove any paths that might be North Korea or combined
        if (country && country.code === 'KR') {
            const filteredPaths = new Set();
            allPaths.forEach(path => {
                const pathId = path.id || '';
                const pathName = path.getAttribute('name') || '';
                const pathClass = path.className?.baseVal || path.getAttribute('class') || '';
                const pathTitle = path.querySelector('title')?.textContent || '';
                const pathDataName = path.getAttribute('data-country-name') || '';
                const pathDataCode = path.getAttribute('data-country-code') || '';
                const pathText = `${pathId} ${pathName} ${pathClass} ${pathTitle} ${pathDataName} ${pathDataCode}`.toLowerCase();
                
                // Check for North Korea indicators
                const hasNorthKorea = /\bnorth\s+korea\b/i.test(pathText) || 
                                     /\bkorea.*north\b/i.test(pathText) ||
                                     /\bnorth.*korea\b/i.test(pathText) ||
                                     /\bkp\b/i.test(pathId) || // North Korea code is KP
                                     pathDataCode.toUpperCase() === 'KP' ||
                                     pathDataName.toLowerCase() === 'north korea';
                
                // Check for South Korea indicators
                const hasSouthKorea = /\bsouth\s+korea\b/i.test(pathText) || 
                                     /\bkorea.*south\b/i.test(pathText) ||
                                     pathDataName.toLowerCase() === 'south korea';
                
                // Check if it mentions both (combined path)
                const hasBothKoreas = (hasNorthKorea && hasSouthKorea) || 
                                     (/\bkorea\b/i.test(pathText) && !hasSouthKorea && !hasNorthKorea);
                
                // EXCLUDE if:
                // 1. It mentions North Korea
                // 2. It mentions both Koreas (combined path)
                // 3. It mentions "korea" without explicitly saying "south korea" (could be combined or North)
                if (hasNorthKorea || hasBothKoreas || (/\bkorea\b/i.test(pathText) && !hasSouthKorea)) {
                    return; // Skip this path
                }
                
                // INCLUDE only if:
                // 1. It explicitly mentions "south korea"
                // 2. It has data-country-code="KR" AND doesn't mention north or both
                // 3. It has ID "KR" AND explicitly mentions south or has KR code
                if (hasSouthKorea || 
                    (pathDataCode.toUpperCase() === 'KR' && !hasNorthKorea && !hasBothKoreas) ||
                    (pathId.toUpperCase() === 'KR' && (hasSouthKorea || pathDataCode.toUpperCase() === 'KR'))) {
                    filteredPaths.add(path);
                }
            });
            return Array.from(filteredPaths).filter(p => p && p.tagName === 'path');
        }
        
        // Additional filtering for Sudan - ensure we find paths even if they might be combined
        if (country && country.code === 'SD') {
            // Also search by name to find Sudan paths
            const allPathsInSVG = this.svg.querySelectorAll('path');
            allPathsInSVG.forEach(path => {
                const pathId = path.id || '';
                const pathName = path.getAttribute('name') || '';
                const pathDataName = path.getAttribute('data-country-name') || '';
                const pathTitle = path.querySelector('title')?.textContent || '';
                const pathText = `${pathId} ${pathName} ${pathDataName} ${pathTitle}`.toLowerCase();
                
                // Check if it's Sudan (but not South Sudan)
                const hasSudan = /\bsudan\b/i.test(pathText);
                const hasSouthSudan = /\bsouth\s+sudan\b/i.test(pathText) || 
                                     /\bsudan.*south\b/i.test(pathText) ||
                                     /\bsouth.*sudan\b/i.test(pathText);
                
                // Include if it mentions Sudan but NOT South Sudan
                if (hasSudan && !hasSouthSudan) {
                    // Also check if it has SD code or matches Sudan name
                    if (pathId.toUpperCase() === 'SD' || 
                        pathDataName.toLowerCase() === 'sudan' ||
                        path.getAttribute('data-country-code')?.toUpperCase() === 'SD') {
                        allPaths.add(path);
                    }
                }
            });
        }
        
        // Remove any null/undefined paths
        return Array.from(allPaths).filter(p => p && p.tagName === 'path');
    }
    
    handleCountryClick(clickedCode, clickedName) {
        if (!this.gameActive || !this.currentCountry) {
            this.isProcessingClick = false;
            return;
        }
        
        // Additional safety check: prevent processing if already processing
        if (this.isProcessingClick && Date.now() - this.lastClickTime < 100) {
            return;
        }
        
        const isCorrect = clickedCode.toLowerCase() === this.currentCountry.code.toLowerCase();
        
        // Check if this country has already been clicked for this question
        if (this.clickedThisQuestion.has(clickedCode.toLowerCase())) {
            this.isProcessingClick = false;
            return; // Already clicked, ignore
        }
        
        // Also check if this country is currently colored and disabled
        // Only block if it's currently showing white/yellow/orange (correct) or permanently red (incorrect)
        // Wrong countries (red) become clickable again after the flash
        const allPathsForClicked = this.findAllPathsForCountry(clickedCode);
        const isCurrentlyColored = allPathsForClicked.some(path => {
            // Check if it has the 'correct' class (white/yellow/orange) - these stay disabled
            if (path.classList.contains('correct')) {
                return true;
            }
            // Check if it has the 'incorrect' class (permanently red) - these stay disabled
            if (path.classList.contains('incorrect')) {
                return true;
            }
            // Check if it's currently disabled with pointer-events: none AND has a colored fill
            const fill = path.getAttribute('fill') || '';
            const isDisabled = path.style.pointerEvents === 'none';
            const isColored = fill && fill !== '#2ECC71' && fill !== '';
            return isDisabled && isColored;
        });
        
        if (isCurrentlyColored) {
            this.isProcessingClick = false;
            return; // Currently colored and disabled, ignore
        }
        
        // Mark this country as clicked for this question
        this.clickedThisQuestion.add(clickedCode.toLowerCase());
        
        // Get current attempt count
        const currentAttempts = this.attempts.get(this.currentCountry.code) || 0;
        
        // Get the clicked path first
        let clickedPath = this.countryMap[clickedCode.toLowerCase()];
        
        if (!clickedPath && this.svg) {
            clickedPath = this.svg.querySelector(`path[data-country-code="${clickedCode.toUpperCase()}"]`);
            if (!clickedPath) {
                clickedPath = this.svg.querySelector(`path[data-country-code="${clickedCode.toLowerCase()}"]`);
            }
            if (!clickedPath) {
                clickedPath = this.svg.querySelector(`path#${clickedCode.toUpperCase()}`);
            }
            if (!clickedPath) {
                clickedPath = this.svg.querySelector(`path#${clickedCode.toLowerCase()}`);
            }
            
            // For Sudan, also try searching by name if code search fails
            if (!clickedPath && clickedCode.toUpperCase() === 'SD') {
                const allPaths = this.svg.querySelectorAll('path');
                for (const path of allPaths) {
                    const pathName = (path.getAttribute('name') || path.getAttribute('data-country-name') || '').toLowerCase();
                    const pathId = (path.id || '').toLowerCase();
                    if ((pathName === 'sudan' || pathId === 'sd') && 
                        !pathName.includes('south sudan') && 
                        !pathName.includes('south-sudan')) {
                        clickedPath = path;
                        break;
                    }
                }
            }
        }
        
        if (clickedPath) {
            // Find ALL paths for the clicked country
            const allPathsForClickedCountry = this.findAllPathsForCountry(clickedCode);
            
            if (isCorrect) {
                // Calculate question time
                const questionTime = this.questionStartTime ? (Date.now() - this.questionStartTime) / 1000 : 0;
                this.questionTimes.push(questionTime);
                
                // Stop and hide question timer
                if (this.questionTimerInterval) {
                    clearInterval(this.questionTimerInterval);
                    this.questionTimerInterval = null;
                }
                if (this.questionTimerEl) {
                    this.questionTimerEl.style.display = 'none';
                }
                
                // Correct answer - color based on attempt number
                // First try (attempt 0): White
                // Second try (attempt 1): Yellow
                // Third try (attempt 2): Orange
                let fillColor, strokeColor;
                if (currentAttempts === 0) {
                    // First try - white
                    fillColor = '#FFFFFF';
                    strokeColor = '#E0E0E0';
                } else if (currentAttempts === 1) {
                    // Second try - yellow
                    fillColor = '#FFD700';
                    strokeColor = '#FFA500';
                } else {
                    // Third try - orange/amber (warning color)
                    fillColor = '#FFA500';
                    strokeColor = '#FF8C00';
                }
                
                // Correct answer - mark all paths with attempt-based color
                // In HARD mode, don't add strokes
                const finalStrokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : strokeColor;
                const finalStrokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '3';
                
                allPathsForClickedCountry.forEach(path => {
                    // Remove any transitions to prevent color flashing
                    path.style.transition = 'none';
                    path.style.transform = 'none';
                    path.style.position = 'static';
                    
                    // Immediately set correct color - no delay, no flash
                    path.setAttribute('fill', fillColor);
                    path.style.setProperty('fill', fillColor, 'important');
                    path.setAttribute('stroke', finalStrokeColor);
                    path.style.setProperty('stroke', finalStrokeColor, 'important');
                    path.setAttribute('stroke-width', finalStrokeWidth);
                    path.style.setProperty('stroke-width', finalStrokeWidth, 'important');
                    path.style.setProperty('opacity', '1', 'important'); // Ensure it's visible
                    
                    // Add data attribute for CSS targeting
                    path.setAttribute('data-attempt', currentAttempts.toString());
                    path.classList.add('correct');
                    path.classList.remove('incorrect');
                    
                    // Disable pointer events immediately - country has been answered
                    path.style.setProperty('pointer-events', 'none', 'important');
                    path.classList.add('disabled');
                    
                    // Log for debugging
                    console.log(`[Geography Game] Applied color to path: attempts=${currentAttempts}, fill=${fillColor}, stroke=${strokeColor}`);
                });
                
                // Add glow effect to all paths
                allPathsForClickedCountry.forEach(path => {
                    path.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.4))';
                });
                setTimeout(() => {
                    allPathsForClickedCountry.forEach(path => {
                        path.style.filter = '';
                    });
                }, 500);
                
                // Score based on attempts (fewer attempts = higher score)
                const scoreMultiplier = 3 - currentAttempts;
                let baseScore = 10 * scoreMultiplier;
                
                // Speed bonus: faster answers get more points (increased to reward quick playing)
                // < 1 second = 100 bonus, < 2 seconds = 75 bonus, < 4 seconds = 50 bonus, < 7 seconds = 30 bonus, < 12 seconds = 15 bonus
                let speedBonus = 0;
                let speedMessage = '';
                if (questionTime < 1) {
                    speedBonus = 100;
                    speedMessage = '⚡⚡⚡ INSTANT! +100';
                } else if (questionTime < 2) {
                    speedBonus = 75;
                    speedMessage = '⚡⚡ Lightning Fast! +75';
                } else if (questionTime < 4) {
                    speedBonus = 50;
                    speedMessage = '⚡⚡ Very Fast! +50';
                } else if (questionTime < 7) {
                    speedBonus = 30;
                    speedMessage = '⚡ Fast! +30';
                } else if (questionTime < 12) {
                    speedBonus = 15;
                    speedMessage = '⚡ Quick! +15';
                }
                
                this.speedBonus += speedBonus;
                const totalScore = baseScore + speedBonus;
                this.score += totalScore;
                this.correct++;
                
                // Flash viewport green for correct answer
                try {
                    this.flashViewport(true);
                } catch (e) {
                    console.log('Error flashing viewport:', e);
                }
                
                // Create particle effects
                try {
                    this.createParticleEffect(clickedCountryPaths[0]);
                } catch (e) {
                    console.log('Error creating particle effect:', e);
                }
                
                // Update combo
                this.combo++;
                if (this.combo > this.maxCombo) {
                    this.maxCombo = this.combo;
                }
                
                // Apply combo multiplier to score
                const comboMultiplier = Math.min(1 + (this.combo - 1) * 0.1, 2.0); // Max 2x multiplier
                const comboBonus = Math.floor(totalScore * (comboMultiplier - 1));
                if (comboBonus > 0) {
                    this.score += comboBonus;
                    try {
                        this.showComboNotification(this.combo, comboBonus);
                    } catch (e) {
                        console.log('Error showing combo notification:', e);
                    }
                }
                
                // Flash speed indicator if applicable
                if (speedBonus > 0 && this.speedEl) {
                    try {
                        this.speedEl.classList.add('speed-bonus');
                        setTimeout(() => {
                            this.speedEl.classList.remove('speed-bonus');
                        }, 500);
                    } catch (e) {
                        console.log('Error flashing speed indicator:', e);
                    }
                }
                
                // Show country fact
                try {
                    this.showCountryFact(this.currentCountry);
                } catch (e) {
                    console.log('Error showing country fact:', e);
                }
                
                // Check for achievements
                try {
                    this.checkAchievements();
                } catch (e) {
                    console.log('Error checking achievements:', e);
                }
                
                // Play success sound
                try {
                this.playSuccessSound();
                } catch (e) {
                    console.log('Error playing success sound:', e);
                }
                
                // Mark as answered and move to next country
                this.answered.add(this.currentCountry.code);
                this.updateStats();
                
                // Always move to next country after delay, even if other functions fail
                setTimeout(() => {
                    try {
                    this.getNextCountry();
                        // Re-enable hint button for next country
                        if (this.hintBtn) {
                            this.hintBtn.disabled = false;
                    }
                    this.isProcessingClick = false;
                    } catch (e) {
                        console.error('Error moving to next country:', e);
                        // Force reset even on error
                        this.isProcessingClick = false;
                        // Try to get next country again
                        try {
                            this.getNextCountry();
                        } catch (e2) {
                            console.error('Critical error in getNextCountry:', e2);
                        }
                    }
                }, 1500);
            } else {
                // Wrong answer - reset combo
                this.combo = 0;
                
                // Wrong answer - increment attempts
                const newAttempts = currentAttempts + 1;
                this.attempts.set(this.currentCountry.code, newAttempts);
                
                // Store reference to clicked country for resetting later
                const clickedCountryPaths = allPathsForClickedCountry;
                
                // Temporarily mark clicked country as incorrect (visual feedback - solid red flash)
                // In HARD mode, don't add strokes
                const wrongStrokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : '#C0392B';
                const wrongStrokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '3';
                
                clickedCountryPaths.forEach(path => {
                    // Remove any transitions to prevent color flashing
                    path.style.transition = 'none';
                    path.style.transform = 'none';
                    path.style.position = 'static';
                    
                    // Immediately set red color - no delay, no flash
                    path.setAttribute('fill', '#E74C3C');
                    path.style.setProperty('fill', '#E74C3C', 'important');
                    path.setAttribute('stroke', wrongStrokeColor);
                    path.style.setProperty('stroke', wrongStrokeColor, 'important');
                    path.setAttribute('stroke-width', wrongStrokeWidth);
                    path.style.setProperty('stroke-width', wrongStrokeWidth, 'important');
                    path.style.setProperty('filter', 'none', 'important'); // No glow, just solid red
                    path.style.setProperty('opacity', '1', 'important'); // Ensure it's visible
                    
                    // Disable pointer events immediately - country has been clicked (wrong answer)
                    // This country stays disabled for the ENTIRE GAME (not just the round)
                    path.style.setProperty('pointer-events', 'none', 'important');
                    path.classList.add('disabled');
                    path.classList.add('wrong-answered'); // Mark as wrong for the game
                    
                    // Remove any classes that might cause color conflicts
                    path.classList.remove('correct');
                });
                
                if (newAttempts >= 3) {
                    // Out of attempts - mark the CORRECT country as wrong
                    // Only increment wrong if this country hasn't been counted as wrong yet
                    if (!this.wrongCountries.has(this.currentCountry.code)) {
                        this.wrong++;
                        this.wrongCountries.add(this.currentCountry.code);
                    }
                    
                    // Flash viewport red for wrong answer
                    this.flashViewport(false);
                    
                    // Play sad failure sound for third attempt
                    this.playFailureSound();
                    
                    // Find all paths for the CORRECT country (the one that should have been clicked)
                    const allPathsForCorrectCountry = this.findAllPathsForCountry(this.currentCountry.code);
                    
                    // Mark the CORRECT country as incorrect (red)
                    // In HARD mode, don't add strokes
                    const correctWrongStrokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : '#C0392B';
                    const correctWrongStrokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '3';
                    
                    allPathsForCorrectCountry.forEach(path => {
                        path.style.transition = 'none';
                        path.style.transform = 'none';
                        path.style.position = 'static';
                        // Use both setAttribute and style.setProperty with important to ensure red stays
                        path.setAttribute('fill', '#E74C3C');
                        path.style.setProperty('fill', '#E74C3C', 'important');
                        path.setAttribute('stroke', correctWrongStrokeColor);
                        path.style.setProperty('stroke', correctWrongStrokeColor, 'important');
                        path.setAttribute('stroke-width', correctWrongStrokeWidth);
                        path.style.setProperty('stroke-width', correctWrongStrokeWidth, 'important');
                        path.classList.add('incorrect');
                        path.classList.remove('correct');
                        // Disable pointer events - country is wrong and should stay red
                        path.style.setProperty('pointer-events', 'none', 'important');
                        path.classList.add('disabled');
                    });
                    
                    // Mark as answered
                    this.answered.add(this.currentCountry.code);
                    this.updateStats();
                    
                    setTimeout(() => {
                        // Reset the incorrectly clicked country back to green (so it can be clicked later)
                        // BUT don't reset if it's marked as permanently incorrect
                        const resetStrokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : 'rgba(0, 0, 0, 0.8)';
                        const resetStrokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '1';
                        
                        clickedCountryPaths.forEach(path => {
                            // Don't reset countries that are permanently marked as incorrect
                            if (path.classList.contains('incorrect')) {
                                return; // Skip this path - it should stay red
                            }
                            // Reset wrong country back to green
                            path.setAttribute('fill', '#2ECC71');
                            path.style.removeProperty('fill');
                            path.setAttribute('stroke', resetStrokeColor);
                            path.style.removeProperty('stroke');
                            path.setAttribute('stroke-width', resetStrokeWidth);
                            path.style.removeProperty('stroke-width');
                            path.style.filter = 'none';
                            
                            // Re-enable pointer events - country can be clicked again
                            path.style.removeProperty('pointer-events');
                            path.classList.remove('incorrect', 'disabled', 'wrong-answered');
                        });
                        
                        this.getNextCountry();
                        this.isProcessingClick = false;
                    }, 2000);
                } else {
                    // Still have attempts remaining
                    // Flash viewport red for wrong answer
                    this.flashViewport(false);
                    
                    // Play error sound
                    this.playErrorSound();
                    
                    // After the red flash, reset the wrong country back to green and make it clickable again
                    setTimeout(() => {
                        const resetStrokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : 'rgba(0, 0, 0, 0.8)';
                        const resetStrokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '1';
                        
                        clickedCountryPaths.forEach(path => {
                            // Reset wrong country back to green
                            path.setAttribute('fill', '#2ECC71');
                            path.style.removeProperty('fill');
                            path.setAttribute('stroke', resetStrokeColor);
                            path.style.removeProperty('stroke');
                            path.setAttribute('stroke-width', resetStrokeWidth);
                            path.style.removeProperty('stroke-width');
                            path.style.filter = 'none';
                            
                            // Re-enable pointer events - country can be clicked again
                            path.style.removeProperty('pointer-events');
                            path.classList.remove('disabled', 'wrong-answered');
                        });
                        
                        // Remove from clicked set so it can be clicked again
                        this.clickedThisQuestion.delete(clickedCode.toLowerCase());
                        
                        this.updateStats();
                    }, 2000);
                }
            }
        }
    }
    
    flashViewport(isCorrect) {
        if (!this.flashLeft || !this.flashRight) return;
        
        // Remove any existing classes
        this.flashLeft.classList.remove('correct', 'active');
        this.flashRight.classList.remove('correct', 'active');
        
        // Add correct class if it's a correct answer
        if (isCorrect) {
            this.flashLeft.classList.add('correct');
            this.flashRight.classList.add('correct');
        }
        
        // Trigger the flash animation
        this.flashLeft.classList.add('active');
        this.flashRight.classList.add('active');
        
        // Remove active class after animation completes
        setTimeout(() => {
            this.flashLeft.classList.remove('active');
            this.flashRight.classList.remove('active');
        }, 400);
    }
    
    updateStats() {
        this.scoreEl.textContent = this.score;
        
        // Update combo display
        if (this.comboEl && this.comboStat) {
            if (this.combo > 0) {
                this.comboEl.textContent = `${this.combo}x`;
                this.comboStat.style.display = 'flex';
            } else {
                this.comboStat.style.display = 'none';
            }
        }
        
        // Update progress bar
        if (this.progressBarFill && this.progressText) {
            const progress = (this.correct / 50) * 100;
            this.progressBarFill.style.width = `${progress}%`;
            this.progressText.textContent = `${Math.round(progress)}%`;
        }
        
        // Update stats for all modes
        this.correctEl.textContent = `${this.correct} / 50`;
        this.remainingEl.textContent = this.countries.length - this.answered.size;
        
        this.wrongEl.textContent = this.wrong;
        
        // Update timer display
        if (this.timerEl) {
            const minutes = Math.floor(this.elapsedTime / 60000);
            const seconds = Math.floor((this.elapsedTime % 60000) / 1000);
            this.timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        // Update speed indicator (average time per question)
        if (this.speedEl && this.questionTimes.length > 0) {
            const avgTime = this.questionTimes.reduce((a, b) => a + b, 0) / this.questionTimes.length;
            this.speedEl.textContent = `${avgTime.toFixed(1)}s avg`;
        } else if (this.speedEl) {
            this.speedEl.textContent = '--';
        }
        
        // Update directions count
        if (this.directionsCountEl) {
            this.directionsCountEl.textContent = `${this.correct} / 50`;
        }
    }
    
    // Calculate distance between two coordinates (Haversine formula)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in kilometers
    }
    
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    // Convert SVG coordinates to lat/lng (approximate)
    svgToLatLng(x, y, svg) {
        if (!svg) return null;
        const viewBox = svg.getAttribute('viewBox') || svg.getAttribute('viewbox');
        if (!viewBox) return null;
        
        const [minX, minY, width, height] = viewBox.split(' ').map(Number);
        // Approximate world map: -180 to 180 longitude, -90 to 90 latitude
        const lng = ((x - minX) / width) * 360 - 180;
        const lat = 90 - ((y - minY) / height) * 180;
        return { lat, lng };
    }
    
    // Convert lat/lng to SVG coordinates
    latLngToSvg(lat, lng, svg) {
        if (!svg) return null;
        const viewBox = svg.getAttribute('viewBox') || svg.getAttribute('viewbox');
        if (!viewBox) return null;
        
        const [minX, minY, width, height] = viewBox.split(' ').map(Number);
        const x = ((lng + 180) / 360) * width + minX;
        const y = ((90 - lat) / 180) * height + minY;
        return { x, y };
    }
    
    // Setup game mode selector
    setupGameModeSelector() {
        // Create the game mode selector UI
        if (!document.getElementById('gameModeSelector')) {
            // Wait a bit for DOM to be ready
            setTimeout(() => {
                this.createGameModeSelector();
                this.updatePromptForMode();
            }, 100);
        }
    }
    
    createGameModeSelector() {
        const gameHeader = document.querySelector('.game-header');
        if (!gameHeader || document.getElementById('gameModeSelector')) return;
        
        const modeSelector = document.createElement('div');
        modeSelector.id = 'gameModeSelector';
        modeSelector.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap;';
        
        Object.entries(GAME_MODES).forEach(([key, value]) => {
            const btn = document.createElement('button');
            btn.className = 'btn-mode';
            btn.dataset.mode = value;
            
            // All modes are enabled now
            btn.textContent = this.getModeName(value);
            btn.style.cssText = `
                padding: 10px 20px;
                font-size: 0.9rem;
                font-weight: 600;
                background: ${this.gameMode === value ? 'rgba(74, 144, 226, 0.8)' : 'rgba(74, 144, 226, 0.2)'};
                border: 2px solid ${this.gameMode === value ? '#4A90E2' : 'rgba(74, 144, 226, 0.4)'};
                border-radius: 8px;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                pointer-events: auto;
                z-index: 10;
            `;
            
            // Add hover effects
            btn.addEventListener('mouseenter', () => {
                if (this.gameMode !== value) {
                    btn.style.background = 'rgba(74, 144, 226, 0.4)';
                    btn.style.transform = 'translateY(-2px)';
                }
            });
            btn.addEventListener('mouseleave', () => {
                if (this.gameMode !== value) {
                    btn.style.background = 'rgba(74, 144, 226, 0.2)';
                    btn.style.transform = 'translateY(0)';
                }
            });
            
            // Add click handler with logging
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Geography Game] Mode button clicked:', value);
                this.setGameMode(value);
            });
            
            modeSelector.appendChild(btn);
            console.log('[Geography Game] Created mode button:', value, this.getModeName(value));
        });
        
        gameHeader.appendChild(modeSelector);
        console.log('[Geography Game] Mode selector created and appended. Buttons:', modeSelector.children.length);
        
        // Verify typing mode button exists
        const typingBtn = modeSelector.querySelector('[data-mode="typing"]');
        if (typingBtn) {
            console.log('[Geography Game] ✓ Typing mode button found and ready!');
            console.log('[Geography Game] Button text:', typingBtn.textContent);
            console.log('[Geography Game] Button disabled?', typingBtn.disabled);
        } else {
            console.error('[Geography Game] ✗ Typing mode button NOT found!');
        }
    }
    
    getModeName(mode) {
        const names = {
            [GAME_MODES.CLASSIC]: 'Classic',
            [GAME_MODES.HARD]: '💀 Hard',
            [GAME_MODES.TYPING]: '⌨️ Typing'
        };
        return names[mode] || mode;
    }
    
    showComingSoonMessage() {
        // Remove existing message if any
        const existing = document.getElementById('typingModeComingSoon');
        if (existing) {
            existing.remove();
        }
        
        // Create construction tape message
        const message = document.createElement('div');
        message.id = 'typingModeComingSoon';
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                background: linear-gradient(45deg, #FFD700 25%, #FFA500 25%, #FFA500 50%, #FFD700 50%, #FFD700 75%, #FFA500 75%, #FFA500);
                background-size: 40px 40px;
                padding: 30px 50px;
                border: 4px solid #FF0000;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
                text-align: center;
                font-family: 'Arial Black', sans-serif;
                animation: shake 0.5s infinite;
            ">
                <div style="
                    background: rgba(0, 0, 0, 0.8);
                    padding: 20px;
                    border-radius: 5px;
                    color: white;
                ">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🚧</div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: #FFD700; margin-bottom: 10px;">
                        TYPING MODE
                    </div>
                    <div style="font-size: 1.2rem; color: #FFD700;">
                        COMING SOON
                    </div>
                    <div style="font-size: 0.9rem; color: #ccc; margin-top: 10px;">
                        This feature is under construction
                    </div>
                </div>
            </div>
        `;
        
        // Add shake animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
                25% { transform: translate(-50%, -50%) rotate(-2deg); }
                75% { transform: translate(-50%, -50%) rotate(2deg); }
            }
        `;
        if (!document.getElementById('typingModeAnimationStyle')) {
            style.id = 'typingModeAnimationStyle';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(message);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (message && message.parentNode) {
                message.remove();
            }
        }, 3000);
    }
    
    setGameMode(mode) {
        console.log('[Geography Game] setGameMode called with:', mode);
        
        // Always reset game when switching modes (even if not active)
        this.resetGame();
        
        this.gameMode = mode;
        console.log('[Geography Game] Game mode set to:', this.gameMode);
        
        this.updateModeSelector();
        this.updatePromptForMode();
        
        // Log confirmation
        console.log('[Geography Game] Typing mode is now:', this.gameMode === GAME_MODES.TYPING ? 'ENABLED' : 'disabled');
        
        // Update country colors for HARD mode
        if (this.svg) {
            const strokeColor = this.gameMode === GAME_MODES.HARD ? 'none' : 'rgba(0, 0, 0, 0.8)';
            const strokeWidth = this.gameMode === GAME_MODES.HARD ? '0' : '1';
            
            // Update all paths to reflect new mode
            Object.values(this.countryMap).forEach(path => {
                if (path) {
                    path.setAttribute('stroke', strokeColor);
                    path.style.setProperty('stroke', strokeColor, 'important');
                    path.setAttribute('stroke-width', strokeWidth);
                    path.style.setProperty('stroke-width', strokeWidth, 'important');
                }
            });
            
            if (this.svg) {
                const allPaths = this.svg.querySelectorAll('path[data-country-code]');
                allPaths.forEach(path => {
                    path.setAttribute('stroke', strokeColor);
                    path.style.setProperty('stroke', strokeColor, 'important');
                    path.setAttribute('stroke-width', strokeWidth);
                    path.style.setProperty('stroke-width', strokeWidth, 'important');
                });
            }
        }
    }
    
    updateModeSelector() {
        const selector = document.getElementById('gameModeSelector');
        if (!selector) return;
        
        selector.querySelectorAll('.btn-mode').forEach(btn => {
            const mode = btn.dataset.mode;
            btn.style.background = this.gameMode === mode ? 'rgba(74, 144, 226, 0.8)' : 'rgba(74, 144, 226, 0.2)';
            btn.style.borderColor = this.gameMode === mode ? '#4A90E2' : 'rgba(74, 144, 226, 0.4)';
        });
    }
    
    updatePromptForMode() {
        if (!this.promptEl) return;
        
        const prompts = {
            [GAME_MODES.CLASSIC]: 'Click on the country that\'s prompted. Green = not answered, White = correct, Red = incorrect',
            [GAME_MODES.HARD]: 'Click on the country that\'s prompted.',
            [GAME_MODES.TYPING]: 'Watch the country flash, then type its name when prompted!'
        };
        
        if (!this.gameActive) {
            this.promptEl.innerHTML = prompts[this.gameMode] || 'Click "Start Game" to begin!';
        }
    }
    
    startTimer() {
        this.stopTimer(); // Clear any existing timer
        this.timerInterval = setInterval(() => {
            if (this.startTime) {
                this.elapsedTime = Date.now() - this.startTime;
                this.updateStats();
            }
        }, 100); // Update every 100ms for smooth display
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateQuestionTimer() {
        // Clear any existing question timer interval
        if (this.questionTimerInterval) {
            clearInterval(this.questionTimerInterval);
            this.questionTimerInterval = null;
        }
        
        if (!this.questionStartTime || !this.questionTimerValueEl) return;
        
        this.questionTimerInterval = setInterval(() => {
            if (!this.gameActive || !this.questionStartTime) {
                if (this.questionTimerInterval) {
                    clearInterval(this.questionTimerInterval);
                    this.questionTimerInterval = null;
                }
                return;
            }
            
            const questionTime = (Date.now() - this.questionStartTime) / 1000;
            if (this.questionTimerValueEl) {
                this.questionTimerValueEl.textContent = `${questionTime.toFixed(1)}s`;
            }
        }, 100);
    }
    
    loadBestTime() {
        try {
            const stored = localStorage.getItem('geography_best_time');
            return stored ? parseInt(stored, 10) : null;
        } catch (e) {
            return null;
        }
    }
    
    saveBestTime(time) {
        try {
            const currentBest = this.loadBestTime();
            if (!currentBest || time < currentBest) {
                localStorage.setItem('geography_best_time', time.toString());
                this.bestTime = time;
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }
    
    playSuccessSound() {
        if (!this.audioContext) return;
        
        try {
            // Resume audio context if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Pleasant ascending tone for success
            oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
            
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Could not play success sound:', e);
        }
    }
    
    playErrorSound() {
        if (!this.audioContext) return;
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Low descending tone for error
            oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime); // A3
            oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.15);
            
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.2);
        } catch (e) {
            console.log('Could not play error sound:', e);
        }
    }
    
    loadCountryFacts() {
        // Country facts database with population, fun fact, and source
        const facts = {
            'CN': { 
                population: 'about one billion four hundred million people',
                fact: 'China operates the world\'s largest high-speed rail system.',
                source: 'https://www.britannica.com/place/China',
                continent: 'Asia'
            },
            'IN': { 
                population: 'about one billion five hundred million people',
                fact: 'India produces more films yearly than any other country.',
                source: 'https://www.britannica.com/place/India',
                continent: 'Asia'
            },
            'US': { 
                population: 'about three hundred fifty million people',
                fact: 'The U.S. National Park Service records hundreds of millions of visits each year.',
                source: 'https://www.nps.gov',
                continent: 'North America'
            },
            'ID': { 
                population: 'about two hundred eighty million people',
                fact: 'Indonesia has more than seventeen thousand islands.',
                source: 'https://www.britannica.com/place/Indonesia',
                continent: 'Asia'
            },
            'PK': { 
                population: 'about two hundred sixty million people',
                fact: 'The Karakoram Highway is the highest paved international road on Earth.',
                source: 'https://www.britannica.com/place/Pakistan',
                continent: 'Asia'
            },
            'BR': { 
                population: 'about two hundred fifteen million people',
                fact: 'Brazil contains about sixty percent of the Amazon rainforest.',
                source: 'https://www.britannica.com/place/Brazil',
                continent: 'South America'
            },
            'BD': { 
                population: 'about one hundred eighty million people',
                fact: 'The Sundarbans is the world\'s largest mangrove forest.',
                source: 'https://www.britannica.com/place/Bangladesh',
                continent: 'Asia'
            },
            'RU': { 
                population: 'about one hundred forty million people',
                fact: 'Russia spans eleven time zones.',
                source: 'https://www.britannica.com/place/Russia',
                continent: 'Europe/Asia'
            },
            'MX': { 
                population: 'about one hundred thirty million people',
                fact: 'Chocolate drinks were first made by ancient cultures in what is now Mexico.',
                source: 'https://www.britannica.com/place/Mexico',
                continent: 'North America'
            },
            'JP': { 
                population: 'about one hundred twenty million people',
                fact: 'Japan has millions of vending machines selling almost everything.',
                source: 'https://www.britannica.com/place/Japan',
                continent: 'Asia'
            },
            'PH': { 
                population: 'about one hundred twenty million people',
                fact: 'The Philippines consists of more than seven thousand islands.',
                source: 'https://www.britannica.com/place/Philippines',
                continent: 'Asia'
            },
            'EG': { 
                population: 'about one hundred fifteen million people',
                fact: 'The Great Pyramid of Giza is the last surviving Wonder of the Ancient World.',
                source: 'https://www.britannica.com/topic/Pyramids-of-Giza',
                continent: 'Africa'
            },
            'ET': { 
                population: 'about one hundred thirty million people',
                fact: 'Ethiopia uses its own calendar that is seven to eight years behind the Gregorian one.',
                source: 'https://www.britannica.com/place/Ethiopia',
                continent: 'Africa'
            },
            'VN': { 
                population: 'about one hundred million people',
                fact: 'Vietnam is the world\'s largest exporter of black pepper.',
                source: 'https://www.britannica.com/place/Vietnam',
                continent: 'Asia'
            },
            'CD': { 
                population: 'about one hundred ten million people',
                fact: 'The Congo Basin holds the world\'s second-largest tropical rainforest.',
                source: 'https://www.britannica.com/place/Democratic-Republic-of-the-Congo',
                continent: 'Africa'
            },
            'IR': { 
                population: 'about ninety million people',
                fact: 'Nashtifan in Iran has some of the oldest functioning windmills in the world.',
                source: 'https://www.britannica.com/place/Iran',
                continent: 'Asia'
            },
            'TR': { 
                population: 'about eighty five million people',
                fact: 'Istanbul is the only major city that lies on two continents.',
                source: 'https://www.britannica.com/place/Istanbul',
                continent: 'Europe/Asia'
            },
            'DE': { 
                population: 'about eighty five million people',
                fact: 'Some parts of the German Autobahn have no posted speed limit.',
                source: 'https://www.britannica.com/place/Germany',
                continent: 'Europe'
            },
            'TH': { 
                population: 'about seventy million people',
                fact: 'Bangkok\'s ceremonial name is one of the longest city names on Earth.',
                source: 'https://www.britannica.com/place/Thailand',
                continent: 'Asia'
            },
            'GB': { 
                population: 'about seventy million people',
                fact: 'The National Health Service is one of the largest publicly funded health systems in the world.',
                source: 'https://www.britannica.com/place/United-Kingdom',
                continent: 'Europe'
            },
            'FR': { 
                population: 'about sixty seven million people',
                fact: 'France consistently ranks as the world\'s most visited country.',
                source: 'https://www.britannica.com/place/France',
                continent: 'Europe'
            },
            'IT': { 
                population: 'about sixty million people',
                fact: 'Italy has more UNESCO World Heritage Sites than any other country.',
                source: 'https://www.britannica.com/place/Italy',
                continent: 'Europe'
            },
            'ZA': { 
                population: 'about sixty two million people',
                fact: 'South Africa has three capital cities.',
                source: 'https://www.britannica.com/place/South-Africa',
                continent: 'Africa'
            },
            'TZ': { 
                population: 'about sixty eight million people',
                fact: 'Mount Kilimanjaro is the tallest free-standing mountain in the world.',
                source: 'https://www.britannica.com/place/Tanzania',
                continent: 'Africa'
            },
            'MM': { 
                population: 'about fifty five million people',
                fact: 'Bagan in Myanmar contains thousands of ancient temples and pagodas.',
                source: 'https://www.britannica.com/place/Myanmar',
                continent: 'Asia'
            },
            'KE': { 
                population: 'about fifty six million people',
                fact: 'The Great Rift Valley cuts through Kenya and is visible from space.',
                source: 'https://www.britannica.com/place/Kenya',
                continent: 'Africa'
            },
            'KR': { 
                population: 'about fifty two million people',
                fact: 'South Korea is known for having some of the fastest average internet speeds in the world.',
                source: 'https://www.britannica.com/place/South-Korea',
                continent: 'Asia'
            },
            'CO': { 
                population: 'about fifty two million people',
                fact: 'Colombia is the only South American country with coasts on both the Pacific and Atlantic Oceans.',
                source: 'https://www.britannica.com/place/Colombia',
                continent: 'South America'
            },
            'ES': { 
                population: 'about forty eight million people',
                fact: 'Madrid\'s Sobrino de Botín is recognized as the world\'s oldest continuously operating restaurant.',
                source: 'https://www.britannica.com/place/Spain',
                continent: 'Europe'
            },
            'UG': { 
                population: 'about fifty million people',
                fact: 'A large share of the world\'s remaining mountain gorillas live in Uganda.',
                source: 'https://www.britannica.com/place/Uganda',
                continent: 'Africa'
            },
            'AR': { 
                population: 'about forty six million people',
                fact: 'Ushuaia in Argentina is widely known as the world\'s southernmost city.',
                source: 'https://www.britannica.com/place/Argentina',
                continent: 'South America'
            },
            'DZ': { 
                population: 'about forty six million people',
                fact: 'Algeria is the largest country in Africa by land area.',
                source: 'https://www.britannica.com/place/Algeria',
                continent: 'Africa'
            },
            'SD': { 
                population: 'about fifty million people',
                fact: 'Sudan has more recorded ancient pyramids than Egypt.',
                source: 'https://www.britannica.com/place/Sudan',
                continent: 'Africa'
            },
            'UA': { 
                population: 'about thirty five million people',
                fact: 'Arsenalna station in Kyiv is the deepest metro station in the world.',
                source: 'https://www.britannica.com/place/Ukraine',
                continent: 'Europe'
            },
            'IQ': { 
                population: 'about forty five million people',
                fact: 'Ancient Mesopotamia, largely in present-day Iraq, created the earliest known writing system, cuneiform.',
                source: 'https://www.britannica.com/place/Iraq',
                continent: 'Asia'
            },
            'AF': { 
                population: 'about forty two million people',
                fact: 'Afghanistan was home to the giant Bamiyan Buddhas carved into cliffs.',
                source: 'https://www.britannica.com/place/Afghanistan',
                continent: 'Asia'
            },
            'PL': { 
                population: 'about thirty eight million people',
                fact: 'Malbork Castle in Poland is the largest brick castle in the world.',
                source: 'https://www.britannica.com/place/Poland',
                continent: 'Europe'
            },
            'CA': { 
                population: 'about forty million people',
                fact: 'Canada has more lakes than any other country.',
                source: 'https://www.britannica.com/place/Canada',
                continent: 'North America'
            },
            'MA': { 
                population: 'about thirty eight million people',
                fact: 'The University of al-Qarawiyyin in Fez is considered the oldest continually operating university.',
                source: 'https://www.britannica.com/place/Morocco',
                continent: 'Africa'
            },
            'SA': { 
                population: 'about thirty seven million people',
                fact: 'Saudi Arabia contains most of the Rub\' al Khali, the world\'s largest continuous sand desert.',
                source: 'https://www.britannica.com/place/Saudi-Arabia',
                continent: 'Asia'
            },
            'UZ': { 
                population: 'about thirty six million people',
                fact: 'Uzbekistan is one of only two double-landlocked countries in the world.',
                source: 'https://www.britannica.com/place/Uzbekistan',
                continent: 'Asia'
            },
            'PE': { 
                population: 'about thirty five million people',
                fact: 'The potato was first domesticated in the Andean regions of Peru.',
                source: 'https://www.britannica.com/place/Peru',
                continent: 'South America'
            },
            'AO': { 
                population: 'about thirty seven million people',
                fact: 'Angola has one of the youngest populations in the world by median age.',
                source: 'https://www.britannica.com/place/Angola',
                continent: 'Africa'
            },
            'MY': { 
                population: 'about thirty four million people',
                fact: 'Kuala Lumpur\'s Petronas Towers are the tallest twin towers on Earth.',
                source: 'https://www.britannica.com/place/Malaysia',
                continent: 'Asia'
            },
            'MZ': { 
                population: 'about thirty four million people',
                fact: 'Mozambique\'s Quirimbas region hosts some of the richest coral reef ecosystems.',
                source: 'https://www.britannica.com/place/Mozambique',
                continent: 'Africa'
            },
            'GH': { 
                population: 'about thirty four million people',
                fact: 'Ghana was the first sub-Saharan African country to gain independence in the twentieth century.',
                source: 'https://www.britannica.com/place/Ghana',
                continent: 'Africa'
            },
            'YE': { 
                population: 'about thirty four million people',
                fact: 'Socotra Island in Yemen is famous for its unique dragon blood trees.',
                source: 'https://www.britannica.com/place/Yemen',
                continent: 'Asia'
            },
            'NP': { 
                population: 'about thirty one million people',
                fact: 'Nepal contains eight of the world\'s fourteen tallest mountains, including Everest.',
                source: 'https://www.britannica.com/place/Nepal',
                continent: 'Asia'
            },
            'NG': { 
                population: 'about two hundred thirty million people',
                fact: 'Nigeria\'s Nollywood is one of the largest film industries in the world by number of movies produced.',
                source: 'https://www.britannica.com/place/Nigeria',
                continent: 'Africa'
            },
            'VE': { 
                population: 'about thirty million people',
                fact: 'Angel Falls in Venezuela is the tallest uninterrupted waterfall on Earth.',
                source: 'https://www.britannica.com/place/Venezuela',
                continent: 'South America'
            }
        };
        return facts;
    }
    
    createParticleEffect(pathElement) {
        if (!pathElement || !this.mapContainer) return;
        
        try {
            const bbox = pathElement.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            // Get SVG coordinates
            const svg = pathElement.ownerSVGElement;
            if (!svg) return;
            
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = centerX;
            svgPoint.y = centerY;
            const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
            
            // Create particle container
            const particleContainer = document.createElement('div');
            particleContainer.style.cssText = `
                position: fixed;
                left: ${screenPoint.x}px;
                top: ${screenPoint.y}px;
                pointer-events: none;
                z-index: 10001;
            `;
            document.body.appendChild(particleContainer);
            
            // Create particles
            const particleCount = 20;
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                const angle = (Math.PI * 2 * i) / particleCount;
                const velocity = 50 + Math.random() * 50;
                const size = 4 + Math.random() * 4;
                const endX = Math.cos(angle) * velocity;
                const endY = Math.sin(angle) * velocity;
                
                particle.style.cssText = `
                    position: absolute;
                    width: ${size}px;
                    height: ${size}px;
                    background: ${i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#4CAF50' : '#2196F3'};
                    border-radius: 50%;
                    box-shadow: 0 0 ${size * 2}px currentColor;
                    animation: particleFloat 1s ease-out forwards;
                    --end-x: ${endX}px;
                    --end-y: ${endY}px;
                `;
                
                particleContainer.appendChild(particle);
            }
            
            // Remove after animation
            setTimeout(() => {
                particleContainer.remove();
            }, 1000);
        } catch (e) {
            console.log('Could not create particle effect:', e);
        }
    }
    
    showComboNotification(combo, bonus) {
        if (combo < 3) return; // Only show for combos of 3+
        
        const notification = document.createElement('div');
        notification.className = 'combo-notification';
        notification.innerHTML = `
            <div class="combo-text">🔥 ${combo}x COMBO!</div>
            <div class="combo-bonus">+${bonus} bonus</div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
    
    // Helper function to get country flag emoji from ISO code
    getCountryFlag(code) {
        // Convert ISO country code to flag emoji
        // Each flag is represented by two regional indicator symbols
        const codePoints = code
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    }
    
    // Helper function to get flag colors for country
    getFlagColors(code) {
        // Flag color mappings - using dominant colors from each country's flag
        const flagColors = {
            'CN': { primary: '#DE2910', secondary: '#FFDE00', textColor: '#fff' }, // China - Red and Yellow
            'IN': { primary: '#FF9933', secondary: '#FFFFFF', textColor: '#000' }, // India - Saffron, White, Green
            'US': { primary: '#B22234', secondary: '#3C3B6E', textColor: '#fff' }, // USA - Red and Blue
            'ID': { primary: '#CE1126', secondary: '#FFFFFF', textColor: '#000' }, // Indonesia - Red and White
            'PK': { primary: '#01411C', secondary: '#FFFFFF', textColor: '#fff' }, // Pakistan - Green and White
            'BR': { primary: '#009739', secondary: '#FEDD00', textColor: '#000' }, // Brazil - Green and Yellow
            'BD': { primary: '#006A4E', secondary: '#F42A41', textColor: '#fff' }, // Bangladesh - Green and Red
            'RU': { primary: '#FFFFFF', secondary: '#0039A6', textColor: '#000' }, // Russia - White, Blue, Red
            'MX': { primary: '#006847', secondary: '#CE1126', textColor: '#fff' }, // Mexico - Green, White, Red
            'JP': { primary: '#FFFFFF', secondary: '#BC002D', textColor: '#000' }, // Japan - White and Red
            'PH': { primary: '#0038A8', secondary: '#CE1126', textColor: '#fff' }, // Philippines - Blue and Red
            'EG': { primary: '#CE1126', secondary: '#FFFFFF', textColor: '#000' }, // Egypt - Red, White, Black
            'ET': { primary: '#078930', secondary: '#FCDD09', textColor: '#000' }, // Ethiopia - Green, Yellow, Red
            'VN': { primary: '#DA020E', secondary: '#FFFF00', textColor: '#000' }, // Vietnam - Red and Yellow
            'CD': { primary: '#007FFF', secondary: '#FCD116', textColor: '#000' }, // DRC - Blue and Yellow
            'IR': { primary: '#239F40', secondary: '#FFFFFF', textColor: '#000' }, // Iran - Green, White, Red
            'TR': { primary: '#E30A17', secondary: '#FFFFFF', textColor: '#000' }, // Turkey - Red and White
            'DE': { primary: '#000000', secondary: '#DD0000', textColor: '#fff' }, // Germany - Black, Red, Gold
            'TH': { primary: '#ED1C24', secondary: '#241D4F', textColor: '#fff' }, // Thailand - Red, White, Blue
            'GB': { primary: '#012169', secondary: '#C8102E', textColor: '#fff' }, // UK - Blue and Red
            'FR': { primary: '#002654', secondary: '#ED2939', textColor: '#fff' }, // France - Blue, White, Red
            'IT': { primary: '#009246', secondary: '#CE2B37', textColor: '#fff' }, // Italy - Green, White, Red
            'ZA': { primary: '#007A4D', secondary: '#FFB612', textColor: '#000' }, // South Africa - Green, Yellow, Red
            'TZ': { primary: '#1EB53A', secondary: '#00A3DD', textColor: '#fff' }, // Tanzania - Green, Yellow, Blue
            'MM': { primary: '#FECB00', secondary: '#EA2839', textColor: '#000' }, // Myanmar - Yellow, Green, Red
            'KE': { primary: '#000000', secondary: '#006600', textColor: '#fff' }, // Kenya - Black, Red, Green
            'KR': { primary: '#FFFFFF', secondary: '#CE1126', textColor: '#000' }, // South Korea - White, Red, Blue
            'CO': { primary: '#FCD116', secondary: '#003893', textColor: '#000' }, // Colombia - Yellow, Blue, Red
            'ES': { primary: '#AA151B', secondary: '#F1BF00', textColor: '#fff' }, // Spain - Red and Yellow
            'UG': { primary: '#FCDD09', secondary: '#000000', textColor: '#000' }, // Uganda - Black, Yellow, Red
            'AR': { primary: '#75AADB', secondary: '#FFFFFF', textColor: '#000' }, // Argentina - Light Blue and White
            'DZ': { primary: '#FFFFFF', secondary: '#006233', textColor: '#000' }, // Algeria - White, Green, Red
            'SD': { primary: '#000000', secondary: '#D21034', textColor: '#fff' }, // Sudan - Red, White, Black
            'UA': { primary: '#0057B7', secondary: '#FFD700', textColor: '#000' }, // Ukraine - Blue and Yellow
            'IQ': { primary: '#CE1126', secondary: '#000000', textColor: '#fff' }, // Iraq - Red, White, Black
            'AF': { primary: '#000000', secondary: '#D32011', textColor: '#fff' }, // Afghanistan - Black, Red, Green
            'PL': { primary: '#FFFFFF', secondary: '#DC143C', textColor: '#000' }, // Poland - White and Red
            'CA': { primary: '#FF0000', secondary: '#FFFFFF', textColor: '#000' }, // Canada - Red and White
            'MA': { primary: '#C1272D', secondary: '#006233', textColor: '#fff' }, // Morocco - Red and Green
            'SA': { primary: '#006C35', secondary: '#FFFFFF', textColor: '#000' }, // Saudi Arabia - Green and White
            'UZ': { primary: '#1EB53A', secondary: '#0099B5', textColor: '#fff' }, // Uzbekistan - Blue, White, Green
            'PE': { primary: '#D91023', secondary: '#FFFFFF', textColor: '#000' }, // Peru - Red and White
            'AO': { primary: '#CC092F', secondary: '#000000', textColor: '#fff' }, // Angola - Red, Black, Yellow
            'MY': { primary: '#C8102E', secondary: '#0066B3', textColor: '#fff' }, // Malaysia - Red, White, Blue
            'MZ': { primary: '#007168', secondary: '#FCD116', textColor: '#000' }, // Mozambique - Green, Yellow, Red
            'GH': { primary: '#CE1126', secondary: '#FCD116', textColor: '#000' }, // Ghana - Red, Yellow, Green
            'YE': { primary: '#CE1126', secondary: '#FFFFFF', textColor: '#000' }, // Yemen - Red, White, Black
            'NP': { primary: '#DC143C', secondary: '#003893', textColor: '#fff' }, // Nepal - Red and Blue
            'NG': { primary: '#008751', secondary: '#FFFFFF', textColor: '#000' }, // Nigeria - Green and White
            'VE': { primary: '#FFCC02', secondary: '#CF142B', textColor: '#000' }  // Venezuela - Yellow, Blue, Red
        };
        
        // Return flag colors or default
        return flagColors[code] || { primary: '#4A90E2', secondary: '#FFFFFF', textColor: '#000' };
    }
    
    // Helper function to format population from words to numbers
    formatPopulation(populationText) {
        // Convert word-based population to formatted number
        const wordToNumber = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
            'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
            'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000, 'million': 1000000,
            'billion': 1000000000
        };
        
        // Clean text: remove punctuation, convert to lowercase, ignore words like "about", "people"
        const text = populationText.toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .replace(/\b(about|approximately|around|over|people|persons|inhabitants)\b/g, '')
            .trim();
        
        const words = text.split(/\s+/).filter(w => w.length > 0);
        
        let total = 0;
        let current = 0;
        let lastMultiplier = 1;
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const num = wordToNumber[word];
            
            if (num === undefined) continue;
            
            if (num === 100) {
                current = (current || 1) * 100;
            } else if (num === 1000) {
                if (current === 0) current = 1;
                total += current * 1000;
                current = 0;
                lastMultiplier = 1000;
            } else if (num === 1000000) {
                if (current === 0) current = 1;
                total += current * 1000000;
                current = 0;
                lastMultiplier = 1000000;
            } else if (num === 1000000000) {
                if (current === 0) current = 1;
                total += current * 1000000000;
                current = 0;
                lastMultiplier = 1000000000;
            } else {
                // Regular number (1-99)
                current += num;
            }
        }
        
        // Add any remaining current value
        if (current > 0) {
            // If we had a multiplier, apply it; otherwise just add
            if (lastMultiplier > 1) {
                total += current * lastMultiplier;
            } else {
                total += current;
            }
        }
        
        // Format with commas and add tilde
        if (total > 0) {
            return `~${total.toLocaleString()}`;
        }
        
        // Fallback: return original text with ~ prefix if conversion fails
        return `~${populationText}`;
    }
    
    // Helper function to extract domain from URL
    extractDomain(url) {
        if (!url || typeof url !== 'string') {
            return 'Source not available';
        }
        
        try {
            // Ensure URL has a protocol
            let urlToParse = url.trim();
            if (!urlToParse.match(/^https?:\/\//)) {
                urlToParse = 'https://' + urlToParse;
            }
            
            const urlObj = new URL(urlToParse);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            return hostname || 'Source not available';
        } catch (e) {
            // If URL parsing fails, try to extract domain manually
            const match = url.match(/https?:\/\/(?:www\.)?([^\/\s]+)/);
            if (match && match[1]) {
                return match[1].replace(/^www\./, '');
            }
            // Last resort: return a cleaned version of the input
            return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'Source not available';
        }
    }
    
    showCountryFact(country) {
        if (!country || !this.countryFacts[country.code]) return;
        
        const fact = this.countryFacts[country.code];
        
        // Remove any existing fact display first
        const existingFact = document.querySelector('.country-fact-display');
        if (existingFact) {
            existingFact.remove();
        }
        
        // Get country flag emoji
        const flag = this.getCountryFlag(country.code);
        
        // Get flag colors
        const flagColors = this.getFlagColors(country.code);
        
        // Format population
        const formattedPopulation = this.formatPopulation(fact.population);
        
        // Extract domain from source URL - handle missing or invalid sources
        let sourceDomain = 'Source not available';
        let sourceUrl = '#';
        if (fact.source && typeof fact.source === 'string' && fact.source.trim()) {
            try {
                sourceDomain = this.extractDomain(fact.source);
                sourceUrl = fact.source;
            } catch (e) {
                console.warn('Failed to extract domain from source:', fact.source, e);
                sourceDomain = 'Source not available';
                sourceUrl = '#';
            }
        } else {
            console.warn('Missing or invalid source for country:', country.code, fact);
        }
        
        // Determine if we should use light or dark text based on background brightness
        const getBrightness = (hex) => {
            const rgb = hex.match(/[A-Za-z0-9]{2}/g).map(v => parseInt(v, 16));
            return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
        };
        const primaryBrightness = getBrightness(flagColors.primary);
        const secondaryBrightness = getBrightness(flagColors.secondary);
        const avgBrightness = (primaryBrightness + secondaryBrightness) / 2;
        const useLightText = avgBrightness < 140;
        
        // Set text colors based on background
        const textColor = useLightText ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 26, 26, 0.95)';
        const labelColor = useLightText ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)';
        const linkColor = useLightText ? 'rgba(255, 255, 255, 0.9)' : 'rgba(74, 144, 226, 1)';
        
        const factDisplay = document.createElement('div');
        factDisplay.className = 'country-fact-display';
        
        // Convert hex to rgba with transparency
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        
        // Apply flag-based background gradient with slight transparency for better readability
        factDisplay.style.background = `linear-gradient(135deg, ${hexToRgba(flagColors.primary, 0.9)} 0%, ${hexToRgba(flagColors.secondary, 0.9)} 100%)`;
        factDisplay.style.color = textColor;
        
        factDisplay.innerHTML = `
            <div class="country-fact-header" style="color: ${textColor};">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="country-flag">${flag}</span>
                    <span>${country.name}</span>
                </div>
                <div class="country-fact-continent" style="color: ${labelColor};">
                    <span class="region-icon">📍</span>
                    ${fact.continent}
                </div>
            </div>
            <div class="country-fact-population">
                <span class="population-label" style="color: ${labelColor};">Population</span>
                <div class="population-value" style="color: ${textColor};">${formattedPopulation}</div>
            </div>
            <div class="country-fact-fun-fact">
                <span class="fun-fact-label" style="color: ${labelColor};">
                    <span class="fun-fact-icon">💡</span>
                    Fun Fact
                </span>
                <div class="fun-fact-value" style="color: ${textColor};">${fact.fact}</div>
            </div>
            <div class="country-fact-source">
                <span class="source-label" style="color: ${labelColor};">Source</span>
                ${sourceUrl !== '#' ? 
                    `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link" style="color: ${linkColor};">${sourceDomain}</a>` :
                    `<span class="source-link" style="color: ${labelColor}; opacity: 0.7;">${sourceDomain}</span>`
                }
            </div>
        `;
        
        // Append to world-map-container - always position at bottom-left
        // The horizontal layout prevents blocking countries
        const mapContainer = document.querySelector('.world-map-container');
        if (mapContainer) {
            // Make sure container has relative positioning
            if (getComputedStyle(mapContainer).position === 'static') {
                mapContainer.style.position = 'relative';
            }
            
            // Always position at bottom-left for all countries
            factDisplay.style.bottom = '20px';
            factDisplay.style.top = 'auto';
            factDisplay.style.left = '20px';
            factDisplay.style.right = 'auto';
            
            mapContainer.appendChild(factDisplay);
        } else {
            // Fallback to body if container not found
            document.body.appendChild(factDisplay);
        }
        
        setTimeout(() => {
            factDisplay.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            factDisplay.classList.remove('show');
            setTimeout(() => {
                if (factDisplay.parentNode) {
                    factDisplay.remove();
                }
            }, 500);
        }, 8000); // Display for 8 seconds (increased from 3)
    }
    
    checkAchievements() {
        const newAchievements = [];
        
        // First correct answer
        if (this.correct === 1 && !this.achievements.has('first_correct')) {
            this.achievements.add('first_correct');
            newAchievements.push({ id: 'first_correct', name: 'First Steps', desc: 'Got your first correct answer!' });
        }
        
        // 10 correct answers
        if (this.correct === 10 && !this.achievements.has('ten_correct')) {
            this.achievements.add('ten_correct');
            newAchievements.push({ id: 'ten_correct', name: 'Getting Started', desc: 'Answered 10 countries correctly!' });
        }
        
        // 25 correct answers
        if (this.correct === 25 && !this.achievements.has('twenty_five_correct')) {
            this.achievements.add('twenty_five_correct');
            newAchievements.push({ id: 'twenty_five_correct', name: 'Halfway There', desc: 'Answered 25 countries correctly!' });
        }
        
        // Perfect game (50/50) - only trigger if ALL countries are white (all correct, none wrong)
        // Check that: all 50 countries answered, 50 correct, 0 wrong, and no countries in wrongCountries set
        const allCountriesAnswered = this.answered.size === 50;
        const allCorrect = this.correct === 50;
        const noWrong = this.wrong === 0;
        const noWrongCountries = this.wrongCountries.size === 0;
        
        if (allCountriesAnswered && allCorrect && noWrong && noWrongCountries && !this.achievements.has('perfect_game')) {
            this.achievements.add('perfect_game');
            newAchievements.push({ id: 'perfect_game', name: 'Perfect Game!', desc: 'Completed all 50 countries with no mistakes!' });
        }
        
        // Combo achievements
        if (this.combo === 5 && !this.achievements.has('combo_5')) {
            this.achievements.add('combo_5');
            newAchievements.push({ id: 'combo_5', name: 'On Fire!', desc: '5 correct answers in a row!' });
        }
        
        if (this.combo === 10 && !this.achievements.has('combo_10')) {
            this.achievements.add('combo_10');
            newAchievements.push({ id: 'combo_10', name: 'Unstoppable!', desc: '10 correct answers in a row!' });
        }
        
        // Show achievement notifications
        newAchievements.forEach((achievement, index) => {
            setTimeout(() => {
                this.showAchievement(achievement);
            }, index * 500);
        });
    }
    
    showAchievement(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">🏆</div>
            <div class="achievement-content">
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
    
    playFailureSound() {
        if (!this.audioContext) return;
        
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Create a sad, despairing chord progression for third attempt failure
            const now = this.audioContext.currentTime;
            const duration = 0.8; // Longer, more dramatic
            
            // Create multiple oscillators for a sad chord
            const osc1 = this.audioContext.createOscillator(); // Root note
            const osc2 = this.audioContext.createOscillator(); // Minor third
            const osc3 = this.audioContext.createOscillator(); // Fifth
            const gain1 = this.audioContext.createGain();
            const gain2 = this.audioContext.createGain();
            const gain3 = this.audioContext.createGain();
            
            // Minor chord (sad) - A minor: A (220Hz), C (261.63Hz), E (329.63Hz)
            osc1.frequency.setValueAtTime(220, now); // A3
            osc1.frequency.exponentialRampToValueAtTime(180, now + duration * 0.5);
            osc1.frequency.exponentialRampToValueAtTime(150, now + duration);
            
            osc2.frequency.setValueAtTime(261.63, now); // C4
            osc2.frequency.exponentialRampToValueAtTime(220, now + duration * 0.5);
            osc2.frequency.exponentialRampToValueAtTime(190, now + duration);
            
            osc3.frequency.setValueAtTime(329.63, now); // E4
            osc3.frequency.exponentialRampToValueAtTime(280, now + duration * 0.5);
            osc3.frequency.exponentialRampToValueAtTime(240, now + duration);
            
            // Use sine waves for a softer, more melancholic sound
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc3.type = 'sine';
            
            // Create a slow fade-out for dramatic effect
            gain1.gain.setValueAtTime(0.15, now);
            gain1.gain.exponentialRampToValueAtTime(0.08, now + duration * 0.6);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            gain2.gain.setValueAtTime(0.12, now);
            gain2.gain.exponentialRampToValueAtTime(0.06, now + duration * 0.6);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            gain3.gain.setValueAtTime(0.1, now);
            gain3.gain.exponentialRampToValueAtTime(0.05, now + duration * 0.6);
            gain3.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            // Connect oscillators
            osc1.connect(gain1);
            osc2.connect(gain2);
            osc3.connect(gain3);
            gain1.connect(this.audioContext.destination);
            gain2.connect(this.audioContext.destination);
            gain3.connect(this.audioContext.destination);
            
            // Start all oscillators together
            osc1.start(now);
            osc2.start(now);
            osc3.start(now);
            
            // Stop all at the same time
            osc1.stop(now + duration);
            osc2.stop(now + duration);
            osc3.stop(now + duration);
        } catch (e) {
            console.log('Could not play failure sound:', e);
        }
    }
    
    createConfetti() {
        // Create confetti container if it doesn't exist
        let confettiContainer = document.getElementById('geoConfetti');
        if (!confettiContainer) {
            confettiContainer = document.createElement('div');
            confettiContainer.id = 'geoConfetti';
            confettiContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
                z-index: 9999;
                overflow: hidden;
            `;
            document.body.appendChild(confettiContainer);
        }
        
        // Confetti colors
        const colors = ['#ffe66d', '#4ecdc4', '#ff6b6b', '#95e1d3', '#aa96da', '#fcbad3', '#f38181', '#a8e6cf', '#2ecc71', '#3498db', '#FFD700', '#FFC107'];
        
        // Function to create confetti pieces
        const createConfettiPiece = () => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 8 + 6}px;
                height: ${Math.random() * 8 + 6}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                opacity: 1;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0%'};
                box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
            `;
            
            // Random animation duration and delay
            const duration = Math.random() * 2 + 2;
            const delay = Math.random() * 0.5;
            const horizontalDrift = (Math.random() - 0.5) * 200;
            
            confetti.style.animation = `geoConfettiFall ${duration}s linear ${delay}s forwards`;
            confetti.style.setProperty('--drift', horizontalDrift + 'px');
            
            confettiContainer.appendChild(confetti);
            
            // Remove after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, (duration + delay) * 1000);
        };
        
        // Add CSS animation if not already added
        if (!document.getElementById('geoConfettiStyle')) {
            const style = document.createElement('style');
            style.id = 'geoConfettiStyle';
            style.textContent = `
                @keyframes geoConfettiFall {
                    0% {
                        transform: translateY(0) translateX(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) translateX(var(--drift, 0px)) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Start creating confetti continuously
        console.log('[Geography Game] Starting confetti celebration...');
        let confettiInterval = setInterval(() => {
            // Create 15-25 pieces every 200ms for continuous celebration
            const pieces = Math.floor(Math.random() * 11) + 15;
            for (let i = 0; i < pieces; i++) {
                createConfettiPiece();
            }
        }, 200);
        
        // Stop confetti after 10 seconds
        setTimeout(() => {
            console.log('[Geography Game] Stopping confetti after 10 seconds');
            clearInterval(confettiInterval);
            // Clean up confetti container after a delay to let remaining pieces fall
            setTimeout(() => {
                if (confettiContainer && confettiContainer.parentNode) {
                    confettiContainer.innerHTML = '';
                }
            }, 3000);
        }, 10000);
    }
    
    playNeonDreams() {
        // Get background music (GEO.wav)
        const bgMusic = document.getElementById('geoBackgroundMusic');
        const neonDreams = document.getElementById('neonDreamsMusic');
        
        if (!neonDreams) {
            console.warn('NeonDreams.wav audio element not found');
            return;
        }
        
        // Save background music state
        if (bgMusic && !bgMusic.paused) {
            this._bgMusicWasPlaying = true;
            this._bgMusicCurrentTime = bgMusic.currentTime;
            bgMusic.pause();
            console.log('🎵 Paused GEO.wav, saved time:', this._bgMusicCurrentTime);
        } else {
            this._bgMusicWasPlaying = false;
        }
        
        // Play NeonDreams.wav
        neonDreams.volume = 0.5;
        neonDreams.currentTime = 0;
        const playPromise = neonDreams.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('🎵 NeonDreams.wav started playing');
            }).catch(err => {
                console.log('⚠️ NeonDreams.wav autoplay blocked:', err.message);
                // Try to play after user interaction
                const tryPlayOnInteraction = () => {
                    neonDreams.play().then(() => {
                        console.log('🎵 NeonDreams.wav started playing after interaction');
                    }).catch(e => {
                        console.log('⚠️ Still blocked:', e.message);
                    });
                    document.removeEventListener('click', tryPlayOnInteraction);
                    document.removeEventListener('touchstart', tryPlayOnInteraction);
                };
                document.addEventListener('click', tryPlayOnInteraction, { once: true });
                document.addEventListener('touchstart', tryPlayOnInteraction, { once: true });
            });
        }
    }
    
    fadeOutNeonDreamsAndResume() {
        const neonDreams = document.getElementById('neonDreamsMusic');
        const bgMusic = document.getElementById('geoBackgroundMusic');
        
        if (!neonDreams) return;
        
        // Fade out NeonDreams.wav
        if (!neonDreams.paused) {
            const fadeOutInterval = setInterval(() => {
                if (neonDreams.volume > 0.05) {
                    neonDreams.volume -= 0.05;
                } else {
                    neonDreams.volume = 0;
                    neonDreams.pause();
                    neonDreams.currentTime = 0;
                    clearInterval(fadeOutInterval);
                    
                    // Resume background music if it was playing
                    if (this._bgMusicWasPlaying && bgMusic) {
                        if (this._bgMusicCurrentTime !== undefined) {
                            bgMusic.currentTime = this._bgMusicCurrentTime;
                        }
                        // Fade in background music
                        bgMusic.volume = 0;
                        bgMusic.play().catch(err => {
                            console.log('⚠️ Failed to resume background music:', err.message);
                        });
                        
                        // Fade in over ~1 second
                        const fadeInInterval = setInterval(() => {
                            if (bgMusic.volume < 0.5) {
                                bgMusic.volume = Math.min(bgMusic.volume + 0.05, 0.5);
                            } else {
                                clearInterval(fadeInInterval);
                            }
                        }, 50);
                        
                        this._bgMusicWasPlaying = false;
                    }
                }
            }, 50); // Fade out over ~500ms
        } else {
            // If already paused, just resume background music with fade in
            if (this._bgMusicWasPlaying && bgMusic) {
                if (this._bgMusicCurrentTime !== undefined) {
                    bgMusic.currentTime = this._bgMusicCurrentTime;
                }
                bgMusic.volume = 0;
                bgMusic.play().catch(err => {
                    console.log('⚠️ Failed to resume background music:', err.message);
                });
                
                // Fade in over ~1 second
                const fadeInInterval = setInterval(() => {
                    if (bgMusic.volume < 0.5) {
                        bgMusic.volume = Math.min(bgMusic.volume + 0.05, 0.5);
                    } else {
                        clearInterval(fadeInInterval);
                    }
                }, 50);
                
                this._bgMusicWasPlaying = false;
            }
        }
    }
    
    async endGame() {
        this.gameActive = false;
        this.stopTimer();
        
        // Play NeonDreams.wav at game end
        try {
            this.playNeonDreams();
        } catch (e) {
            console.log('Error playing NeonDreams.wav:', e);
        }
        
        // Always trigger confetti at game end
        try {
            this.createConfetti();
        } catch (e) {
            console.log('Error creating confetti:', e);
        }
        
        // Stop question timer
        if (this.questionTimerInterval) {
            clearInterval(this.questionTimerInterval);
            this.questionTimerInterval = null;
        }
        
        // Hide question timer
        if (this.questionTimerEl) {
            this.questionTimerEl.style.display = 'none';
        }
        
        // Calculate final time
        const finalTime = this.elapsedTime;
        const minutes = Math.floor(finalTime / 60000);
        const seconds = Math.floor((finalTime % 60000) / 1000);
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Check for best time
        const isNewBest = this.saveBestTime(finalTime);
        const bestTimeString = this.bestTime ? 
            `${Math.floor(this.bestTime / 60000)}:${String(Math.floor((this.bestTime % 60000) / 1000)).padStart(2, '0')}` : 
            'N/A';
        
        // Calculate average time per question
        const avgTime = this.questionTimes.length > 0 ? 
            (this.questionTimes.reduce((a, b) => a + b, 0) / this.questionTimes.length).toFixed(1) : 
            '0.0';
        
        // Calculate accuracy
        const totalAnswers = this.correct + this.wrong;
        const accuracy = totalAnswers > 0 ? Math.round((this.correct / totalAnswers) * 100) : 0;
        
        // Check if perfect game
        const allCountriesAnswered = this.answered.size === 50;
        const allCorrect = this.correct === 50;
        const noWrong = this.wrong === 0;
        const noWrongCountries = this.wrongCountries.size === 0;
        const isPerfectGame = allCountriesAnswered && allCorrect && noWrong && noWrongCountries;
        
        this.promptEl.textContent = 'Game Complete!';
        
        // Save game progress per user if logged in
        let userId = null;
        if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
            try {
                const isAuth = await window.auth0.isAuthenticated();
                if (isAuth) {
                    const user = await window.auth0.getUser();
                    if (user && user.sub) {
                        userId = user.sub;
                        // Save geography game progress
                        const progressKey = `geography_progress_${user.sub}`;
                        const progress = {
                            correct: this.correct,
                            wrong: this.wrong,
                            score: this.score,
                            time: finalTime,
                            speedBonus: this.speedBonus,
                            avgTime: parseFloat(avgTime),
                            answered: Array.from(this.answered),
                            timestamp: Date.now()
                        };
                        localStorage.setItem(progressKey, JSON.stringify(progress));
                        console.log(`[Geography Game] Saved progress for user ${user.sub}:`, progress);
                    }
                }
            } catch (err) {
                console.log('[Geography Game] Could not save progress:', err);
            }
        }
        
        // Fallback: save general progress if not logged in
        if (!userId) {
            const generalProgress = {
                correct: this.correct,
                wrong: this.wrong,
                score: this.score,
                time: finalTime,
                speedBonus: this.speedBonus,
                avgTime: parseFloat(avgTime),
                timestamp: Date.now()
            };
            localStorage.setItem('geography_progress', JSON.stringify(generalProgress));
        }
        
        // Store score data for leaderboard submission
        this.pendingScoreData = {
            gameType: 'geography',
            score: this.score,
            userId: userId || null,
            userName: null,
            correct: this.correct,
            wrong: this.wrong,
            time: finalTime,
            timeString: timeString,
            speedBonus: this.speedBonus,
            avgTime: parseFloat(avgTime),
            accuracy: accuracy,
            isPerfectGame: isPerfectGame,
        };
        
        // Show game complete screen
        const gameOver = document.getElementById('gameOverGeo');
        if (gameOver) {
            gameOver.style.display = 'block';
            
            // Populate stats
            const finalScoreEl = document.getElementById('finalScoreGeo');
            if (finalScoreEl) finalScoreEl.textContent = this.score.toLocaleString();
            
            const finalBestTimeEl = document.getElementById('finalBestTimeGeo');
            if (finalBestTimeEl) finalBestTimeEl.textContent = isNewBest ? `🏆 ${bestTimeString} (NEW!)` : bestTimeString;
            
            const finalTimeEl = document.getElementById('finalTimeGeo');
            if (finalTimeEl) finalTimeEl.textContent = timeString;
            
            const finalCorrectEl = document.getElementById('finalCorrectGeo');
            if (finalCorrectEl) finalCorrectEl.textContent = `${this.correct} / 50`;
            
            const finalWrongEl = document.getElementById('finalWrongGeo');
            if (finalWrongEl) finalWrongEl.textContent = this.wrong;
            
            const finalAccuracyEl = document.getElementById('finalAccuracyGeo');
            if (finalAccuracyEl) finalAccuracyEl.textContent = `${accuracy}%`;
            
            const finalSpeedBonusEl = document.getElementById('finalSpeedBonusGeo');
            if (finalSpeedBonusEl) finalSpeedBonusEl.textContent = `+${this.speedBonus}`;
            
            const finalAvgTimeEl = document.getElementById('finalAvgTimeGeo');
            if (finalAvgTimeEl) finalAvgTimeEl.textContent = `${avgTime}s`;
            
            console.log('[Geography Game] Game complete screen displayed');
        } else {
            console.error('[Geography Game] Game over element not found!');
        }
        
        // Set up submit button handler
        this.setupLeaderboardSubmit();
        
        // Set up view leaderboard button
        this.setupViewLeaderboard();
        
        // Set up play again button
        const restartBtn = document.getElementById('restartBtnGeo');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.resetGame();
            });
        }
        
        // Load and prepare leaderboard immediately when game ends
        this.prepareLeaderboard();
        
        this.startBtn.disabled = false;
    }
    
    setupViewLeaderboard() {
        // Check if view leaderboard button exists, if not create it
        let viewLeaderboardBtn = document.getElementById('viewLeaderboardBtnGeo');
        const submitForm = document.getElementById('leaderboardSubmitForm');
        
        if (!viewLeaderboardBtn && submitForm) {
            // Create button and insert it BEFORE the submit form so it's visible immediately
            viewLeaderboardBtn = document.createElement('button');
            viewLeaderboardBtn.id = 'viewLeaderboardBtnGeo';
            viewLeaderboardBtn.className = 'btn btn-view-leaderboard';
            viewLeaderboardBtn.textContent = '🏆 View Leaderboard';
            viewLeaderboardBtn.style.cssText = `
                margin: 20px auto;
                width: 100%;
                max-width: 400px;
                padding: 15px 30px;
                background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3));
                border: 2px solid rgba(255, 215, 0, 0.6);
                color: white;
                border-radius: 8px;
                font-weight: 700;
                font-size: 1.1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                display: block;
            `;
            
            // Insert before the submit form
            submitForm.parentNode.insertBefore(viewLeaderboardBtn, submitForm);
            
            // Add hover effect
            viewLeaderboardBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 193, 7, 0.4))';
            });
            viewLeaderboardBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3))';
            });
        }
        
        if (viewLeaderboardBtn) {
            // Remove existing listeners
            const newBtn = viewLeaderboardBtn.cloneNode(true);
            viewLeaderboardBtn.parentNode.replaceChild(newBtn, viewLeaderboardBtn);
            
            // Re-add hover effects
            newBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 193, 7, 0.4))';
            });
            newBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
                this.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 193, 7, 0.3))';
            });
            
            newBtn.addEventListener('click', async () => {
                console.log('[Geography Game] View leaderboard button clicked');
                // Ensure leaderboard exists
                if (!window.leaderboardGeo) {
                    console.log('[Geography Game] Creating leaderboard instance...');
                    window.leaderboardGeo = new Leaderboard('geography');
                    await window.leaderboardGeo.init();
                }
                
                try {
                    await window.leaderboardGeo.loadScores(50);
                    window.leaderboardGeo.render();
                    window.leaderboardGeo.show();
                } catch (error) {
                    console.error('[Geography Game] Error showing leaderboard:', error);
                    // Still try to show it
                    window.leaderboardGeo.render();
                    window.leaderboardGeo.show();
                }
            });
        }
    }
    
    async prepareLeaderboard() {
        // Ensure leaderboard exists
        if (!window.leaderboardGeo) {
            console.log('[Geography Game] Creating leaderboard instance on game end...');
            window.leaderboardGeo = new Leaderboard('geography');
            await window.leaderboardGeo.init();
        }
        
        // Load current scores so leaderboard is ready to show
        try {
            await window.leaderboardGeo.loadScores(50);
            window.leaderboardGeo.render();
            console.log('[Geography Game] Leaderboard prepared and ready to show');
        } catch (error) {
            console.error('[Geography Game] Error preparing leaderboard:', error);
        }
    }
    
    setupLeaderboardSubmit() {
        const submitBtn = document.getElementById('submitScoreBtnGeo');
        const nameInput = document.getElementById('playerNameInputGeo');
        const statusDiv = document.getElementById('submitStatusGeo');
        
        if (!submitBtn || !nameInput) return;
        
        // Remove existing listeners
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Add new listener
        newSubmitBtn.addEventListener('click', async () => {
            // Prevent duplicate submissions
            if (newSubmitBtn.disabled || this.isSubmittingScore) {
                return;
            }
            
            const userName = nameInput.value.trim() || 'Anonymous';
            
            if (!this.pendingScoreData) {
                this.showSubmitStatus('No score data available', 'error');
                return;
            }
            
            // Set flag to prevent duplicate submissions
            this.isSubmittingScore = true;
            
            // Disable button during submission
            newSubmitBtn.disabled = true;
            this.showSubmitStatus('Submitting...', '');
            
            try {
                const scoreData = {
                    ...this.pendingScoreData,
                    userName: userName,
                };
                
                const success = await this.submitToLeaderboard(scoreData);
                
                if (success) {
                    nameInput.disabled = true;
                    newSubmitBtn.disabled = true;
                    
                    // Ensure leaderboard exists and is initialized
                    if (!window.leaderboardGeo) {
                        console.log('[Geography Game] Creating leaderboard instance...');
                        window.leaderboardGeo = new Leaderboard('geography');
                        await window.leaderboardGeo.init();
                    }
                    
                        // Load leaderboard to show user their rank
                    try {
                        await window.leaderboardGeo.loadScores(50); // Load more to find user's rank
                        
                        // Find user's rank
                        const userScore = scoreData.score;
                        const userRank = window.leaderboardGeo.scores.findIndex(s => 
                            s.userName === userName && Math.abs(s.score - userScore) < 0.01
                        ) + 1;
                        
                        if (userRank > 0 && userRank <= 50) {
                            this.showSubmitStatus(`✓ Score submitted! You're ranked #${userRank}!`, 'success');
                        } else {
                            this.showSubmitStatus('✓ Score submitted successfully!', 'success');
                        }
                        
                        // Render inline leaderboard with animation
                        this.renderInlineLeaderboard(userName, userScore, userRank);
                    } catch (error) {
                        console.error('[Geography Game] Error loading/showing leaderboard:', error);
                        this.showSubmitStatus('✓ Score submitted successfully!', 'success');
                    }
                    
                    // Show "Play Again" button after successful submission
                    this.showPlayAgainButton();
                    
                    // Reset flag after successful submission
                    this.isSubmittingScore = false;
                } else {
                    // Error message is already shown by submitToLeaderboard if it's a userName validation error
                    // For other errors, show a generic message
                    const statusDiv = document.getElementById('submitStatusGeo');
                    if (statusDiv && !statusDiv.textContent.includes('inappropriate') && !statusDiv.textContent.includes('Please choose')) {
                        this.showSubmitStatus('Failed to submit score. Please try again.', 'error');
                    }
                    newSubmitBtn.disabled = false;
                    this.isSubmittingScore = false; // Reset flag on error
                }
            } catch (error) {
                console.error('[Geography Game] Leaderboard submission error:', error);
                this.showSubmitStatus('Error submitting score. Please try again.', 'error');
                newSubmitBtn.disabled = false;
                this.isSubmittingScore = false; // Reset flag on error
            }
        });
        
        // Allow Enter key to submit
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !newSubmitBtn.disabled) {
                newSubmitBtn.click();
            }
        });
    }
    
    showSubmitStatus(message, type) {
        const statusDiv = document.getElementById('submitStatusGeo');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `submit-status ${type}`;
        }
    }
    
    renderInlineLeaderboard(userName, userScore, userRank) {
        const container = document.getElementById('inlineLeaderboardContainerGeo');
        const list = document.getElementById('inlineLeaderboardListGeo');
        const cardTitle = document.getElementById('leaderboardCardTitleGeo');
        
        if (!container || !list) {
            console.warn('[Geography Game] Inline leaderboard elements not found');
            return;
        }
        
        // Update card title
        if (cardTitle) {
            cardTitle.textContent = '🏆 Leaderboard';
        }
        
        // Get top 10 scores
        const topScores = window.leaderboardGeo.scores.slice(0, 10);
        
        if (topScores.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.7);">No scores yet. Be the first!</div>';
            container.style.display = 'block';
            return;
        }
        
        // Render scores
        list.innerHTML = topScores.map((score, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            const isUserRank = rank === userRank && score.userName === userName && Math.abs(score.score - userScore) < 0.01;
            const isTopThree = rank <= 3;
            
            // Format metadata for geography game
            const metaParts = [];
            if (score.timeString) metaParts.push(`⏱️ ${score.timeString}`);
            if (score.accuracy !== undefined) metaParts.push(`🎯 ${score.accuracy}%`);
            const metaText = metaParts.join(' | ');
            
            const perfectBadge = score.isPerfectGame ? ' ✨ Perfect' : '';
            
            return `
                <div class="inline-leaderboard-item ${isTopThree ? 'top-three' : ''} ${isUserRank ? 'user-rank' : ''}" data-rank="${rank}">
                    <div class="inline-leaderboard-rank">${medal}</div>
                    <div class="inline-leaderboard-user">
                        <div class="inline-leaderboard-name">${this.escapeHtml(score.userName)}${perfectBadge}</div>
                        <div class="inline-leaderboard-meta">${metaText || '—'}</div>
                    </div>
                    <div class="inline-leaderboard-score">${score.score.toLocaleString()}</div>
                </div>
            `;
        }).join('');
        
        // Show container with animation
        container.style.display = 'block';
        
        // Scroll to user's rank if it's in the top 10
        if (userRank > 0 && userRank <= 10) {
            setTimeout(() => {
                const userItem = list.querySelector(`[data-rank="${userRank}"]`);
                if (userItem) {
                    userItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 600);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showPlayAgainButton() {
        // Remove existing button if it exists
        const existingBtn = document.getElementById('playAgainBtnGeo');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // Create "Play Again" button
        const playAgainBtn = document.createElement('button');
        playAgainBtn.id = 'playAgainBtnGeo';
        playAgainBtn.className = 'btn-geo';
        playAgainBtn.textContent = '🔄 Play Again';
        playAgainBtn.style.cssText = `
            margin: 20px auto;
            display: block;
            padding: 18px 40px;
            font-size: 1.4rem;
            font-weight: 700;
            background: linear-gradient(135deg, #2ECC71, #27AE60);
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 
                0 8px 25px rgba(46, 204, 113, 0.5),
                0 0 20px rgba(46, 204, 113, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.3);
            color: white;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        `;
        
        // Add hover effect
        playAgainBtn.addEventListener('mouseenter', () => {
            playAgainBtn.style.transform = 'translateY(-3px) scale(1.05)';
            playAgainBtn.style.boxShadow = 
                '0 12px 35px rgba(46, 204, 113, 0.6), 0 0 30px rgba(46, 204, 113, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
            playAgainBtn.style.background = 'linear-gradient(135deg, #3DDC81, #2ECC71)';
        });
        
        playAgainBtn.addEventListener('mouseleave', () => {
            playAgainBtn.style.transform = 'translateY(0) scale(1)';
            playAgainBtn.style.boxShadow = 
                '0 8px 25px rgba(46, 204, 113, 0.5), 0 0 20px rgba(46, 204, 113, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
            playAgainBtn.style.background = 'linear-gradient(135deg, #2ECC71, #27AE60)';
        });
        
        // Add click handler to restart game in current mode
        playAgainBtn.addEventListener('click', () => {
            // Fade out NeonDreams.wav and resume background music if playing
            try {
                this.fadeOutNeonDreamsAndResume();
            } catch (e) {
                console.log('Error fading out NeonDreams:', e);
            }
            
            // Store current game mode
            const currentMode = this.gameMode;
            
            // Reset the game
            this.resetGame();
            
            // Reset leaderboard form
            this.resetLeaderboardForm();
            
            // Hide the play again button
            playAgainBtn.style.display = 'none';
            
            // Ensure game mode is set to current mode (in case it was changed)
            this.gameMode = currentMode;
            
            // Start the game in the current mode
            this.startGame();
        });
        
        // Insert button after the submit form
        const submitForm = document.getElementById('leaderboardSubmitForm');
        if (submitForm && submitForm.parentNode) {
            submitForm.parentNode.insertBefore(playAgainBtn, submitForm.nextSibling);
        } else {
            // Fallback: append to game controls or container
            const gameControls = document.querySelector('.game-controls');
            if (gameControls) {
                gameControls.appendChild(playAgainBtn);
            } else {
                const container = document.querySelector('.geography-game-container');
                if (container) {
                    container.appendChild(playAgainBtn);
                }
            }
        }
    }
    
    async submitToLeaderboard(scoreData) {
        try {
            const response = await fetch('/.netlify/functions/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scoreData),
            });
            
            if (response.ok) {
                console.log('[Geography Game] Score submitted to leaderboard');
                return true;
            } else {
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    const errorText = await response.text();
                    errorData = { error: errorText };
                }
                const errorMessage = errorData.error || 'Failed to submit score. Please try again.';
                console.error('[Geography Game] Failed to submit score:', errorMessage);
                
                // If it's a userName validation error, show it to the user
                if (errorData.field === 'userName') {
                    this.showSubmitStatus(errorMessage, 'error');
                    // Re-enable the input so user can change it
                    const nameInput = document.getElementById('playerNameInputGeo');
                    if (nameInput) {
                        nameInput.disabled = false;
                        nameInput.focus();
                        nameInput.select();
                    }
                }
                
                return false;
            }
        } catch (error) {
            console.error('[Geography Game] Leaderboard submission error:', error);
            return false;
        }
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.geoGame = new GeographyGame();
    
    // Call the standalone loadSVGMap() function to load the actual SVG file
    // This will replace any placeholder created by the class
    // Use a delay to ensure the game instance and placeholder are fully initialized
    setTimeout(() => {
        if (typeof loadSVGMap === 'function') {
            console.log('[Geography Game] Loading SVG map...');
    loadSVGMap();
        } else {
            console.error('[Geography Game] loadSVGMap function not found!');
        }
    }, 100);
});

function loadSVGMap() {
    // Try to load an external SVG map file
    // You can download a free SVG world map from:
    // - https://simplemaps.com/resources/svg-world
    // - https://www.amcharts.com/svg-maps/
    // - Or use D3.js with topojson
    
    console.log('[Geography Game] Attempting to fetch world-map.svg...');
    
    fetch('world-map.svg')
        .then(response => {
            console.log('[Geography Game] Fetch response status:', response.status, response.statusText);
            if (response.ok) {
                return response.text();
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        })
        .then(svgText => {
            console.log('[Geography Game] SVG file loaded, length:', svgText.length);
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            
            // Check for parsing errors
            const parserError = svgDoc.querySelector('parsererror');
            if (parserError) {
                console.error('[Geography Game] SVG parsing error:', parserError.textContent);
                throw new Error('SVG parsing error: ' + parserError.textContent);
            }
            
            const svgElement = svgDoc.querySelector('svg');
            console.log('[Geography Game] SVG element found:', !!svgElement);
            
            if (svgElement) {
                const mapContainer = document.getElementById('worldMap');
                if (!mapContainer) {
                    console.error('worldMap container not found');
                    throw new Error('Map container element not found');
                }
                
                mapContainer.innerHTML = '';
                
                // Ensure SVG is properly sized and visible
                if (!svgElement.getAttribute('viewBox') && svgElement.getAttribute('width') && svgElement.getAttribute('height')) {
                    const width = svgElement.getAttribute('width');
                    const height = svgElement.getAttribute('height');
                    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
                }
                
                // If no viewBox, set a default one
                if (!svgElement.getAttribute('viewBox')) {
                    svgElement.setAttribute('viewBox', '0 0 1000 500');
                }
                
                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                svgElement.style.display = 'block';
                svgElement.style.visibility = 'visible';
                svgElement.style.opacity = '1';
                
                mapContainer.appendChild(svgElement);
                
                // Log success
                console.log('✓ SVG map loaded successfully');
                console.log('SVG dimensions:', svgElement.getBoundingClientRect());
                console.log('SVG viewBox:', svgElement.getAttribute('viewBox'));
                
                // Store SVG reference in game instance if available
                if (window.geoGame) {
                    window.geoGame.svg = svgElement;
                    window.geoGame.mapContainer = mapContainer;
                    // Reset natural dimensions so they're recalculated
                    window.geoGame.svgNaturalWidth = 0;
                    window.geoGame.svgNaturalHeight = 0;
                    // Reset pan to allow auto-centering
                    window.geoGame.panX = 0;
                    window.geoGame.panY = 0;
                    // Re-setup drag handlers after SVG loads
                    if (window.geoGame.setupDragHandlers) {
                        window.geoGame.setupDragHandlers();
                    }
                    // Force update to recalculate constraints and center
                    setTimeout(() => {
                        if (window.geoGame && window.geoGame.updateTransform) {
                        window.geoGame.updateTransform();
                        }
                    }, 100);
                }
                
                // IMPORTANT: Set up click handlers on the newly loaded SVG
                // The click handlers were set up on the placeholder SVG, but now we have the real one
                if (window.geoGame) {
                    console.log('[Geography Game] Setting up click handlers on loaded SVG');
                    window.geoGame.svg = svgElement;
                    // Ensure SVG itself allows pointer events
                    svgElement.style.pointerEvents = 'auto';
                    svgElement.style.cursor = 'default';
                    
                    // Process the SVG first to add country attributes
                    processSVGMap(svgElement);
                    
                    // THEN set up click handlers after processing
                    setTimeout(() => {
                    window.geoGame.initializeCountryPaths();
                        // Also add direct click handlers to each path for reliability
                        window.geoGame.addDirectClickHandlers();
                        console.log('[Geography Game] Click handlers set up, SVG ready for clicks');
                    }, 200);
                }
            } else {
                throw new Error('SVG element not found in loaded file');
            }
        })
        .catch(error => {
            console.error('[Geography Game] Error loading SVG map:', error);
            console.error('[Geography Game] Error stack:', error.stack);
            console.log('[Geography Game] SVG map file not found or failed to load.');
            console.log('[Geography Game] Error details:', error.message);
            
            // Create a helpful placeholder
            const mapContainer = document.getElementById('worldMap');
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #fff; background: rgba(26, 74, 106, 0.3); border-radius: 8px;">
                        <h3 style="color: #FFD700; margin-bottom: 15px;">⚠️ Map Loading Error</h3>
                        <p style="margin-bottom: 10px;">Unable to load world-map.svg file.</p>
                        <p style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.7);">
                            Please ensure world-map.svg exists in the root directory.
                        </p>
                        <p style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); margin-top: 10px;">
                            Error: ${error.message}
                        </p>
                    </div>
                `;
            } else {
                console.error('[Geography Game] Map container not found for error display!');
            }
        });
}

function processSVGMap(svg) {
    // Process SVG paths and add data attributes for country matching
    const paths = svg.querySelectorAll('path');
    
    console.log('Processing SVG map with', paths.length, 'paths');
    
    paths.forEach(path => {
        // Try to identify country from path ID, name attribute, or class
        const id = path.id || '';
        const nameAttr = path.getAttribute('name') || '';
        const className = path.className?.baseVal || path.getAttribute('class') || '';
        const title = path.querySelector('title')?.textContent || '';
        
        // Normalize names for matching (remove extra spaces, handle variations)
        const normalizeName = (str) => {
            return str.toLowerCase()
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^the\s+/, '') // Remove "the" prefix
                .replace(/\s+republic$/, '') // Remove "republic" suffix
                .replace(/\s+democratic\s+republic$/, '') // Handle DRC
                .replace(/^dr\s+/, ''); // Handle DR prefix
        };
        
        // Match to our country list
        let country = null;
        
        // FIRST: Check if this is North Korea (KP) - explicitly exclude it BEFORE any other matching
        const isNorthKorea = id && (id.toUpperCase() === 'KP' || id.toUpperCase() === 'PRK') ||
                             /\bnorth\s+korea\b/i.test(nameAttr) ||
                             /\bnorth\s+korea\b/i.test(className) ||
                             /\bnorth\s+korea\b/i.test(title) ||
                             /\bkp\b/i.test(id) ||
                             /\bprk\b/i.test(id);
        
        // If it's North Korea, mark it as non-populous and skip
        if (isNorthKorea) {
            path.setAttribute('fill', '#0d5a2a'); // Dark green
            path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
            path.setAttribute('stroke-width', '1');
            path.style.cursor = 'default';
            path.style.pointerEvents = 'auto';
            path.style.opacity = '0.7';
            path.classList.add('non-populous');
            console.log(`⚠ Marked North Korea path as non-populous: id="${id}", name="${nameAttr}"`);
            return; // Skip processing this path
        }
        
        // First try exact code match from ID (most reliable)
        if (id && id.length === 2) {
            country = POPULOUS_COUNTRIES.find(c => 
                c.code.toLowerCase() === id.toLowerCase()
            );
        }
        
        // Also check if ID contains country code (for paths like "PH-1", "PH-2" for archipelagos)
        // BUT exclude KP (North Korea) codes
        if (!country && id) {
            for (const c of POPULOUS_COUNTRIES) {
                // Skip if this would match KP (North Korea)
                if (id.toUpperCase().includes('KP') || id.toUpperCase().includes('PRK')) {
                    continue;
                }
                const codeRegex = new RegExp(`^${c.code}\\b|\\b${c.code}\\b`, 'i');
                if (codeRegex.test(id)) {
                    country = c;
                    break;
                }
            }
        }
        
        // Helper function for precise name matching
        const matchCountryName = (searchText, countryList) => {
            const normalizedSearch = normalizeName(searchText);
            
            // First, try exact matches (most specific)
            let match = countryList.find(c => {
                const normalizedCountryName = normalizeName(c.name);
                const normalizedAltNames = c.alt.map(a => normalizeName(a));
                return normalizedCountryName === normalizedSearch ||
                       normalizedAltNames.some(alt => alt === normalizedSearch);
            });
            
            // If no exact match, try word boundary matching (prevents "sudan" matching "south sudan")
            if (!match) {
                // Sort countries by name length (longer names first) to match more specific ones first
                const sortedCountries = [...countryList].sort((a, b) => 
                    normalizeName(b.name).length - normalizeName(a.name).length
                );
                
                for (const c of sortedCountries) {
                    const normalizedCountryName = normalizeName(c.name);
                    const normalizedAltNames = c.alt.map(a => normalizeName(a));
                    
                    // Special handling for archipelagos/island nations that might have numbered paths
                    // (e.g., "Philippines-1", "Philippines-2" for different islands)
                    if (c.code === 'PH' || c.code === 'ID' || c.code === 'JP') {
                        // For archipelagos, be more lenient - match if the country name appears
                        const archipelagoRegex = new RegExp(normalizedCountryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                        const archipelagoAltRegexes = normalizedAltNames.map(alt => 
                            new RegExp(alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                        );
                        
                        if (archipelagoRegex.test(normalizedSearch) || 
                            archipelagoAltRegexes.some(regex => regex.test(normalizedSearch))) {
                            match = c;
                            break;
                        }
                    }
                    
                    // Use word boundary matching to avoid partial matches
                    // Check if the search text contains the full country name as a word
                    const countryNameRegex = new RegExp(`\\b${normalizedCountryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    const altNameRegexes = normalizedAltNames.map(alt => 
                        new RegExp(`\\b${alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
                    );
                    
                    if (countryNameRegex.test(normalizedSearch) || 
                        altNameRegexes.some(regex => regex.test(normalizedSearch))) {
                        match = c;
                        break;
                    }
                }
            }
            
            return match;
        };
        
        // Then try name matching from name attribute (with precise matching)
        if (!country && nameAttr) {
            country = matchCountryName(nameAttr, POPULOUS_COUNTRIES);
        }
        
        // Then try class name matching (with precise matching)
        if (!country && className) {
            country = matchCountryName(className, POPULOUS_COUNTRIES);
        }
        
        // Finally try fuzzy matching from all sources (but still prioritize specific matches)
        if (!country) {
            const searchText = `${id} ${nameAttr} ${className} ${title}`.toLowerCase();
            
            // Special handling for archipelagos - check if ID contains country code with numbers
            // (e.g., "PH-1", "PH-2", "philippines-1", etc.)
            for (const c of POPULOUS_COUNTRIES) {
                // Check if ID starts with country code (for numbered paths like "PH-1")
                if (id && new RegExp(`^${c.code}[-_]?\\d*`, 'i').test(id)) {
                    country = c;
                    break;
                }
                // Check if ID contains country name with numbers (for paths like "philippines-1")
                const countryNameLower = normalizeName(c.name);
                if (id && new RegExp(`${countryNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-_]?\\d*`, 'i').test(id)) {
                    country = c;
                    break;
                }
            }
            
            // Check for combined paths (e.g., "Sudan and South Sudan" or "North and South Korea")
            // If a path mentions both parts, it's likely a combined path
            
            // Check for combined Sudan/South Sudan
            const hasSudan = /\bsudan\b/i.test(searchText);
            const hasSouthSudan = /\bsouth\s+sudan\b/i.test(searchText) || /\bsudan.*south\b/i.test(searchText);
            
            // Check for combined North/South Korea
            const hasKorea = /\bkorea\b/i.test(searchText);
            const hasNorthKorea = /\bnorth\s+korea\b/i.test(searchText) || 
                                 /\bkorea.*north\b/i.test(searchText) ||
                                 /\bnorth.*korea\b/i.test(searchText) ||
                                 /\bkp\b/i.test(searchText) ||
                                 /\bprk\b/i.test(searchText);
            const hasSouthKorea = /\bsouth\s+korea\b/i.test(searchText) || /\bkorea.*south\b/i.test(searchText);
            const hasBothKoreas = hasNorthKorea && hasSouthKorea;
            
            // If it's ONLY North Korea (not combined), mark as non-populous
            if (hasNorthKorea && !hasSouthKorea && !hasBothKoreas) {
                path.setAttribute('fill', '#0d5a2a'); // Dark green
                path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                path.setAttribute('stroke-width', '1');
                path.style.cursor = 'default';
                path.style.pointerEvents = 'auto';
                path.style.opacity = '0.7';
                path.classList.add('non-populous');
                console.log(`⚠ Marked North Korea path as non-populous: id="${id}", name="${nameAttr}"`);
                return; // Skip processing this path
            }
            
            // Check for combined Congo paths (DRC and Republic of the Congo)
            const hasCongo = /\bcongo\b/i.test(searchText);
            const hasDRC = /\bdemocratic\s+republic\s+of\s+the\s+congo\b/i.test(searchText) || 
                          /\bdrc\b/i.test(searchText) || 
                          /\bdr\s+congo\b/i.test(searchText);
            // Only match "Republic of Congo" if it doesn't have "democratic" before it
            const hasRepublicCongo = (/\brepublic\s+of\s+the\s+congo\b/i.test(searchText) && !/\bdemocratic\b/i.test(searchText)) || 
                                    (/\brepublic\s+congo\b/i.test(searchText) && !/\bdemocratic\b/i.test(searchText)) ||
                                    (/\bcongo\b/i.test(searchText) && /\brepublic\b/i.test(searchText) && !/\bdemocratic\b/i.test(searchText));
            const hasBothCongos = hasDRC && hasRepublicCongo;
            
            // If it's a combined Sudan/South Sudan path, don't match it to just "Sudan"
            // since South Sudan is not in our list, this should be marked as non-populous
            if (hasSudan && hasSouthSudan) {
                // This is a combined path - don't match it to Sudan alone
                country = null;
            } 
            // If it's a combined North/South Korea path, don't match it to just "South Korea"
            else if (hasBothKoreas || (hasKorea && (hasNorthKorea || hasSouthKorea))) {
                // This is a combined path - don't match it to South Korea alone
                country = null;
            }
            // If it's a combined Congo path, don't match it to just "Democratic Republic of the Congo"
            else if (hasBothCongos || (hasCongo && hasRepublicCongo)) {
                // This is a combined path - don't match it to DRC alone
                country = null;
            } else {
                // Sort countries by name length (longer = more specific) to match "South Sudan" before "Sudan"
                const sortedCountries = [...POPULOUS_COUNTRIES].sort((a, b) => 
                    normalizeName(b.name).length - normalizeName(a.name).length
                );
                
                for (const c of sortedCountries) {
                    const normalizedCountryName = normalizeName(c.name);
                    const normalizedAltNames = c.alt.map(a => normalizeName(a));
                    
                    // Special handling for South Korea - explicitly exclude North Korea
                    if (c.code === 'KR') {
                        // For South Korea, explicitly exclude North Korea paths
                        if (/\bnorth\s+korea\b/i.test(searchText) || 
                            /\bkorea.*north\b/i.test(searchText) ||
                            /\bnorth.*korea\b/i.test(searchText) ||
                            /\bkp\b/i.test(searchText) ||
                            /\bprk\b/i.test(searchText) ||
                            id.toUpperCase() === 'KP' ||
                            id.toUpperCase() === 'PRK') {
                            // This is North Korea, skip it
                            continue;
                        }
                    }
                    
                    // Special handling for archipelagos - be more lenient with matching
                    if (c.code === 'PH' || c.code === 'ID' || c.code === 'JP') {
                        // For archipelagos, match if country name appears anywhere (even with numbers/suffixes)
                        const archipelagoRegex = new RegExp(normalizedCountryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                        const archipelagoAltRegexes = normalizedAltNames.map(alt => 
                            new RegExp(alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                        );
                        
                        if (archipelagoRegex.test(searchText) || 
                            archipelagoAltRegexes.some(regex => regex.test(searchText))) {
                            country = c;
                            break;
                        }
                    }
                    
                    // Use word boundary matching to avoid "sudan" matching "south sudan"
                    const countryNameRegex = new RegExp(`\\b${normalizedCountryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    const altNameRegexes = normalizedAltNames.map(alt => 
                        new RegExp(`\\b${alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
                    );
                    
                    if (countryNameRegex.test(searchText) || 
                        altNameRegexes.some(regex => regex.test(searchText))) {
                        country = c;
                        break;
                    }
                }
            }
        }
        
        // Additional safety checks: if we matched to a country but the path might be combined,
        // be more cautious - only match if we're confident it's just that country
        
        // Check for Sudan combined with South Sudan
        if (country && country.code === 'SD') {
            const searchText = `${id} ${nameAttr} ${className} ${title}`.toLowerCase();
            // If the path name suggests it might include South Sudan, don't match it
            if (/\bsouth\s+sudan\b/i.test(searchText) || 
                /\bsudan.*south\b/i.test(searchText) ||
                /\bsouth.*sudan\b/i.test(searchText)) {
                // This might be a combined path - mark as non-populous instead
                country = null;
            }
        }
        
        // Check for South Korea combined with North Korea
        if (country && country.code === 'KR') {
            const searchText = `${id} ${nameAttr} ${className} ${title}`.toLowerCase();
            // If the path name suggests it might include North Korea, don't match it
            if (/\bnorth\s+korea\b/i.test(searchText) || 
                /\bkorea.*north\b/i.test(searchText) ||
                /\bnorth.*korea\b/i.test(searchText)) {
                // Check if it's clearly just South Korea (mentions "south" but not "north")
                const hasSouth = /\bsouth\s+korea\b/i.test(searchText) || /\bkorea.*south\b/i.test(searchText);
                const hasNorth = /\bnorth\s+korea\b/i.test(searchText) || /\bkorea.*north\b/i.test(searchText);
                // If it mentions both or just "korea" without specifying, it might be combined
                if (hasNorth || (!hasSouth && /\bkorea\b/i.test(searchText))) {
                    // This might be a combined path - mark as non-populous instead
                    country = null;
                }
            }
        }
        
        // Check for Democratic Republic of the Congo combined with Republic of the Congo
        if (country && country.code === 'CD') {
            const searchText = `${id} ${nameAttr} ${className} ${title}`.toLowerCase();
            // Check for clear DRC indicators
            const hasDRC = /\bdemocratic\s+republic\s+of\s+the\s+congo\b/i.test(searchText) || 
                          /\bdrc\b/i.test(searchText) || 
                          /\bdr\s+congo\b/i.test(searchText);
            // Check for Republic of the Congo indicators (without "democratic")
            // Only exclude if it's clearly "Republic of Congo" without "Democratic"
            const hasRepublicCongo = (/\brepublic\s+of\s+the\s+congo\b/i.test(searchText) && !/\bdemocratic\b/i.test(searchText)) || 
                                    (/\brepublic\s+congo\b/i.test(searchText) && !/\bdemocratic\b/i.test(searchText));
            // Only exclude if it's clearly the other Congo (Republic of Congo) or combined
            // Don't exclude if it's clearly DRC
            if (hasRepublicCongo && !hasDRC) {
                // This is the other Congo (Republic of Congo) - mark as non-populous instead
                country = null;
            }
            // If it has both, it's combined - exclude it
            else if (hasDRC && hasRepublicCongo) {
                country = null;
            }
        }
        
        if (country) {
            path.setAttribute('data-country-code', country.code);
            path.setAttribute('data-country-name', country.name);
            path.setAttribute('fill', '#2ECC71'); // Start green
            path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)'); // Dark border
            path.setAttribute('stroke-width', '1'); // Border width
            path.style.cursor = 'pointer';
            path.style.pointerEvents = 'auto';
            path.style.userSelect = 'none';
            // Ensure path is clickable
            path.classList.add('country-path');
            
            // Ensure path ID matches country code for easy lookup
            if (!path.id || path.id !== country.code) {
                path.id = country.code; // Use ISO code as ID
            }
            
            // Store in country map for quick lookup
            if (window.geoGame) {
                window.geoGame.countryMap[country.code.toLowerCase()] = path;
                // Also store by uppercase for consistency
                window.geoGame.countryMap[country.code.toUpperCase()] = path;
                console.log(`✓ Mapped ${country.name} (${country.code}) - ID: ${path.id}, name: ${nameAttr}`);
            }
        } else {
            // Country not in the 50 most populous - make it dark green and non-clickable
            path.setAttribute('fill', '#0d5a2a'); // Dark green
            path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)'); // Dark border
            path.setAttribute('stroke-width', '1'); // Border width
            path.style.cursor = 'default';
            path.style.pointerEvents = 'auto';
            path.style.opacity = '0.7';
            path.classList.add('non-populous');
            
            // Log unmapped paths for debugging (only if they have identifiers)
            if (id || nameAttr || className) {
                const searchText = `${id} ${nameAttr} ${className} ${title}`.toLowerCase();
                // Special logging for combined path issues
                if (/\bsudan\b/i.test(searchText)) {
                    console.log(`⚠ Unmapped Sudan-related path (may be combined with South Sudan): id="${id}", name="${nameAttr}", class="${className}", title="${title}"`);
                } else if (/\bkorea\b/i.test(searchText)) {
                    console.log(`⚠ Unmapped Korea-related path (may be combined North/South Korea): id="${id}", name="${nameAttr}", class="${className}", title="${title}"`);
                } else if (/\bcongo\b/i.test(searchText)) {
                    console.log(`⚠ Unmapped Congo-related path (may be combined DRC/Republic of Congo): id="${id}", name="${nameAttr}", class="${className}", title="${title}"`);
                } else {
                    console.log(`⚠ Unmapped path (non-populous): id="${id}", name="${nameAttr}", class="${className}"`);
                }
            }
        }
    });
    
    console.log(`Mapped ${Object.keys(window.geoGame?.countryMap || {}).length} countries`);
    
    // Initialize game with the map
    if (window.geoGame) {
        window.geoGame.svg = svg;
        window.geoGame.initializeCountryPaths();
        
        // Update remaining count
        window.geoGame.updateStats();
    }
}

function createMapPlaceholder() {
    const mapContainer = document.getElementById('worldMap');
    mapContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #fff;">
            <div style="font-size: 4rem; margin-bottom: 20px;">🌍</div>
            <h2 style="font-size: 1.5rem; margin-bottom: 15px;">Interactive World Map</h2>
            <p style="opacity: 0.9; margin-bottom: 20px; max-width: 600px; margin-left: auto; margin-right: auto;">
                To enable the full interactive map experience, please add an SVG world map file.
            </p>
            <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto; text-align: left;">
                <p style="margin-bottom: 15px; font-weight: 600;">Quick Setup:</p>
                <ol style="opacity: 0.9; line-height: 1.8;">
                    <li>Download a free SVG world map from <a href="https://simplemaps.com/resources/svg-world" target="_blank" style="color: #4A90E2;">simplemaps.com</a> or similar</li>
                    <li>Save it as <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">world-map.svg</code> in this directory</li>
                    <li>Refresh the page - the game will automatically load it!</li>
                </ol>
                <p style="margin-top: 15px; opacity: 0.8; font-size: 0.9rem;">
                    The game logic is fully functional - it just needs the map SVG file with country paths.
                </p>
            </div>
        </div>
    `;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeographyGame;
}

