// 50 Most Populous Countries with their ISO codes and common names
const POPULOUS_COUNTRIES = [
    { name: 'China', code: 'CN', alt: ['china'] },
    { name: 'India', code: 'IN', alt: ['india'] },
    { name: 'United States', code: 'US', alt: ['usa', 'united states', 'america'] },
    { name: 'Indonesia', code: 'ID', alt: ['indonesia'] },
    { name: 'Pakistan', code: 'PK', alt: ['pakistan'] },
    { name: 'Brazil', code: 'BR', alt: ['brazil'] },
    { name: 'Bangladesh', code: 'BD', alt: ['bangladesh'] },
    { name: 'Russia', code: 'RU', alt: ['russia', 'russian federation'] },
    { name: 'Mexico', code: 'MX', alt: ['mexico'] },
    { name: 'Japan', code: 'JP', alt: ['japan'] },
    { name: 'Philippines', code: 'PH', alt: ['philippines'] },
    { name: 'Egypt', code: 'EG', alt: ['egypt'] },
    { name: 'Ethiopia', code: 'ET', alt: ['ethiopia'] },
    { name: 'Vietnam', code: 'VN', alt: ['vietnam'] },
    { name: 'Democratic Republic of the Congo', code: 'CD', alt: ['democratic republic of congo', 'drc', 'congo', 'dr congo'] },
    { name: 'Iran', code: 'IR', alt: ['iran'] },
    { name: 'Türkiye', code: 'TR', alt: ['turkey', 'türkiye'] },
    { name: 'Germany', code: 'DE', alt: ['germany'] },
    { name: 'Thailand', code: 'TH', alt: ['thailand'] },
    { name: 'United Kingdom', code: 'GB', alt: ['uk', 'united kingdom', 'britain', 'great britain'] },
    { name: 'France', code: 'FR', alt: ['france'] },
    { name: 'Italy', code: 'IT', alt: ['italy'] },
    { name: 'South Africa', code: 'ZA', alt: ['south africa'] },
    { name: 'Tanzania', code: 'TZ', alt: ['tanzania'] },
    { name: 'Myanmar', code: 'MM', alt: ['myanmar', 'burma'] },
    { name: 'Kenya', code: 'KE', alt: ['kenya'] },
    { name: 'South Korea', code: 'KR', alt: ['south korea', 'korea'] },
    { name: 'Colombia', code: 'CO', alt: ['colombia'] },
    { name: 'Spain', code: 'ES', alt: ['spain'] },
    { name: 'Uganda', code: 'UG', alt: ['uganda'] },
    { name: 'Argentina', code: 'AR', alt: ['argentina'] },
    { name: 'Algeria', code: 'DZ', alt: ['algeria'] },
    { name: 'Sudan', code: 'SD', alt: ['sudan'] },
    { name: 'Ukraine', code: 'UA', alt: ['ukraine'] },
    { name: 'Iraq', code: 'IQ', alt: ['iraq'] },
    { name: 'Afghanistan', code: 'AF', alt: ['afghanistan'] },
    { name: 'Poland', code: 'PL', alt: ['poland'] },
    { name: 'Canada', code: 'CA', alt: ['canada'] },
    { name: 'Morocco', code: 'MA', alt: ['morocco'] },
    { name: 'Saudi Arabia', code: 'SA', alt: ['saudi arabia', 'saudi'] },
    { name: 'Uzbekistan', code: 'UZ', alt: ['uzbekistan'] },
    { name: 'Peru', code: 'PE', alt: ['peru'] },
    { name: 'Angola', code: 'AO', alt: ['angola'] },
    { name: 'Malaysia', code: 'MY', alt: ['malaysia'] },
    { name: 'Mozambique', code: 'MZ', alt: ['mozambique'] },
    { name: 'Ghana', code: 'GH', alt: ['ghana'] },
    { name: 'Yemen', code: 'YE', alt: ['yemen'] },
    { name: 'Nepal', code: 'NP', alt: ['nepal'] },
    { name: 'Nigeria', code: 'NG', alt: ['nigeria'] },
    { name: 'Venezuela', code: 'VE', alt: ['venezuela'] }
];

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
        this.gameActive = false;
        this.countryMap = {}; // Maps country codes to SVG paths
        this.attempts = new Map(); // Track attempts per country: countryCode -> attemptCount
        this.lastClickTime = 0; // Track last click time for debouncing
        this.isProcessingClick = false; // Prevent double-processing of clicks
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        // Will be calculated when SVG loads to ensure horizontal scrolling is possible
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.svgNaturalWidth = 0;
        this.svgNaturalHeight = 0;
        this.minZoomLevel = 1; // Minimum zoom - will be calculated based on SVG fit
        
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
        
        this.initializeElements();
        this.loadWorldMap();
        this.setupEventListeners();
        this.setupZoomControls();
    }
    
    initializeElements() {
        this.scoreEl = document.getElementById('geoScore');
        this.correctEl = document.getElementById('geoCorrect');
        this.wrongEl = document.getElementById('geoWrong');
        this.remainingEl = document.getElementById('geoRemaining');
        this.promptEl = document.getElementById('countryPrompt');
        this.mapContainer = document.getElementById('worldMap');
        this.feedbackEl = document.getElementById('feedbackMessage');
        this.startBtn = document.getElementById('startBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.directionsCountEl = document.getElementById('directionsCount');
        this.timerEl = document.getElementById('geoTimer');
        this.speedEl = document.getElementById('geoSpeed');
        this.questionTimerEl = document.getElementById('questionTimer');
        this.questionTimerValueEl = document.getElementById('questionTimerValue');
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
        if (this.svg) {
            this.svg.addEventListener('click', (e) => {
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
                    setTimeout(() => {
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                    }, 2000);
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
            });
            
            // Hover effects removed to prevent any movement or disappearing countries
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
        this.startBtn.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        
        // Pan functionality with mouse
        if (this.mapContainer) {
            this.mapContainer.addEventListener('mousedown', (e) => {
                // Only pan if not clicking on a path element
                const path = e.target.closest('path');
                if (path) {
                    // Let the path click handler deal with it
                    return;
                }
                
                if (e.button === 0) { // Left mouse button
                    this.isPanning = true;
                    // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
                    this.startX = e.clientX - this.panY; // clientX -> panY (horizontal)
                    this.startY = e.clientY - this.panX; // clientY -> panX (vertical)
                    this.mapContainer.style.cursor = 'grabbing';
                }
            });
            
            this.mapContainer.addEventListener('mousemove', (e) => {
                if (this.isPanning) {
                    // Horizontal mouse movement (clientX) controls horizontal scrolling (panY)
                    // Vertical mouse movement (clientY) controls vertical scrolling (panX)
                    this.panY = e.clientX - this.startX; // Horizontal
                    this.panX = e.clientY - this.startY; // Vertical
                    this.updateTransform();
                }
            });
            
            this.mapContainer.addEventListener('mouseup', () => {
                this.isPanning = false;
                this.mapContainer.style.cursor = 'grab';
            });
            
            this.mapContainer.addEventListener('mouseleave', () => {
                this.isPanning = false;
                this.mapContainer.style.cursor = 'grab';
            });
            
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
                    // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
                    this.isPanning = true;
                    touchStartX = e.touches[0].clientX - this.panY; // clientX -> panY (horizontal)
                    touchStartY = e.touches[0].clientY - this.panX; // clientY -> panX (vertical)
                    touchStartTime = Date.now();
                    touchMoved = false;
                    touchTarget = e.target;
                    // Don't prevent default here - let click through if it's a country path
                    if (touchTarget.tagName === 'path' && touchTarget.hasAttribute('data-country-code')) {
                        // This is a country click, allow it
                        return;
                    }
                    e.preventDefault();
                }
            }, { passive: false });
            
            this.mapContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    // Pinch zoom
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const currentDistance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                    );
                    const scale = currentDistance / initialDistance;
                    const newZoom = initialZoom * scale;
                    this.zoomLevel = Math.min(3, Math.max(this.minZoomLevel || 1, newZoom));
                    this.zoom(1, pinchCenterX, pinchCenterY); // Update zoom and center
                    e.preventDefault();
                } else if (this.isPanning && e.touches.length === 1) {
                    // Single touch pan
                    // Note: panY controls horizontal (X), panX controls vertical (Y) due to transform swap
                    const deltaX = Math.abs(e.touches[0].clientX - (touchStartX + this.panY));
                    const deltaY = Math.abs(e.touches[0].clientY - (touchStartY + this.panX));
                    
                    // If moved more than 10px, consider it a pan
                    if (deltaX > 10 || deltaY > 10) {
                        touchMoved = true;
                    }
                    
                    if (touchMoved) {
                        // Horizontal touch movement (clientX) moves map horizontally (panY)
                        // Vertical touch movement (clientY) moves map vertically (panX)
                        this.panY = e.touches[0].clientX - touchStartX; // Horizontal
                        this.panX = e.touches[0].clientY - touchStartY; // Vertical
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
            
            // Zoom with mouse wheel
            this.mapContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.mapContainer.getBoundingClientRect();
                const centerX = e.clientX - rect.left;
                const centerY = e.clientY - rect.top;
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                this.zoom(delta, centerX, centerY);
            });
        }
    }
    
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const resetZoomBtn = document.getElementById('resetZoom');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoom(1.2));
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoom(0.8));
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
        this.gameActive = true;
        this.score = 0;
        this.correct = 0;
        this.wrong = 0;
        this.answered.clear();
        this.wrongCountries.clear();
        this.attempts.clear();
        this.speedBonus = 0;
        this.questionTimes = [];
        
        // Reset leaderboard form
        this.resetLeaderboardForm();
        
        // Reset timer
        this.elapsedTime = 0;
        this.startTime = Date.now();
        this.startTimer();
        
        // Shuffle countries
        this.shuffledCountries = [...this.countries].sort(() => Math.random() - 0.5);
        
        // Reset all country colors to green
        Object.values(this.countryMap).forEach(path => {
            if (path) {
                path.setAttribute('fill', '#2ECC71');
                path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                path.setAttribute('stroke-width', '1');
                path.classList.remove('correct', 'incorrect', 'disabled');
            }
        });
        
        // Also reset any paths in the SVG that have data attributes
        if (this.svg) {
            const allPaths = this.svg.querySelectorAll('path[data-country-code]');
            allPaths.forEach(path => {
                path.setAttribute('fill', '#2ECC71');
                path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                path.setAttribute('stroke-width', '1');
                path.classList.remove('correct', 'incorrect', 'disabled');
            });
        }
        
        // Get first country
        this.getNextCountry();
        
        this.startBtn.disabled = true;
        this.resetBtn.disabled = false;
        this.feedbackEl.textContent = '';
        this.feedbackEl.className = 'feedback-message';
        
        this.updateStats();
    }
    
    resetGame() {
        this.gameActive = false;
        this.answered.clear();
        this.wrongCountries.clear();
        this.attempts.clear();
        this.stopTimer();
        this.elapsedTime = 0;
        this.questionTimes = [];
        this.speedBonus = 0;
        this.lastClickTime = 0;
        this.isProcessingClick = false;
        
        // Reset leaderboard form
        this.resetLeaderboardForm();
        
        // Stop question timer
        if (this.questionTimerInterval) {
            clearInterval(this.questionTimerInterval);
            this.questionTimerInterval = null;
        }
        
        // Hide question timer
        if (this.questionTimerEl) {
            this.questionTimerEl.style.display = 'none';
        }
        
        // Reset all country colors to green
        Object.values(this.countryMap).forEach(path => {
            if (path) {
                path.setAttribute('fill', '#2ECC71');
                path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                path.setAttribute('stroke-width', '1');
                path.classList.remove('correct', 'incorrect', 'disabled');
            }
        });
        
        // Also reset any paths in the SVG that have data attributes
        if (this.svg) {
            const allPaths = this.svg.querySelectorAll('path[data-country-code]');
            allPaths.forEach(path => {
                path.setAttribute('fill', '#2ECC71');
                path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                path.setAttribute('stroke-width', '1');
                path.classList.remove('correct', 'incorrect', 'disabled');
            });
        }
        
        this.promptEl.textContent = 'Click "Start Game" to begin!';
        this.feedbackEl.textContent = '';
        this.feedbackEl.className = 'feedback-message';
        
        this.startBtn.disabled = false;
        this.resetBtn.disabled = true;
        
        this.updateStats();
    }
    
    getNextCountry() {
        // Get next unasked country
        const remaining = this.shuffledCountries.filter(
            c => !this.answered.has(c.code)
        );
        
        if (remaining.length === 0) {
            this.endGame();
            return;
        }
        
        this.currentCountry = remaining[0];
        // Reset attempts for new country
        this.attempts.set(this.currentCountry.code, 0);
        this.promptEl.textContent = `Find: ${this.currentCountry.name}`;
        
        // Start question timer
        this.questionStartTime = Date.now();
        if (this.questionTimerEl) {
            this.questionTimerEl.style.display = 'flex';
        }
        this.updateQuestionTimer();
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
                
                // Correct answer - mark all paths as correct
                allPathsForClickedCountry.forEach(path => {
                    path.style.transition = 'none';
                    path.style.transform = 'none';
                    path.style.position = 'static';
                    path.setAttribute('fill', '#FFFFFF');
                    path.setAttribute('stroke', '#E0E0E0');
                    path.setAttribute('stroke-width', '3');
                    path.classList.add('correct');
                    path.classList.remove('incorrect');
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
                
                // Speed bonus: faster answers get more points
                // < 2 seconds = 50 bonus, < 5 seconds = 30 bonus, < 10 seconds = 15 bonus
                let speedBonus = 0;
                let speedMessage = '';
                if (questionTime < 2) {
                    speedBonus = 50;
                    speedMessage = '⚡ Lightning Fast! +50';
                } else if (questionTime < 5) {
                    speedBonus = 30;
                    speedMessage = '⚡ Very Fast! +30';
                } else if (questionTime < 10) {
                    speedBonus = 15;
                    speedMessage = '⚡ Fast! +15';
                }
                
                this.speedBonus += speedBonus;
                const totalScore = baseScore + speedBonus;
                this.score += totalScore;
                this.correct++;
                
                // Show feedback with speed bonus if applicable
                if (speedBonus > 0) {
                    this.feedbackEl.textContent = `✓ Correct! ${speedMessage}`;
                    this.feedbackEl.className = 'feedback-message correct';
                    // Flash speed indicator
                    if (this.speedEl) {
                        this.speedEl.classList.add('speed-bonus');
                        setTimeout(() => {
                            this.speedEl.classList.remove('speed-bonus');
                        }, 500);
                    }
                } else {
                    this.feedbackEl.textContent = '✓ Correct!';
                    this.feedbackEl.className = 'feedback-message correct';
                }
                
                // Play success sound
                this.playSuccessSound();
                
                // Mark as answered and move to next country
                this.answered.add(this.currentCountry.code);
                this.updateStats();
                
                setTimeout(() => {
                    this.getNextCountry();
                    if (this.gameActive) {
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                    }
                    this.isProcessingClick = false;
                }, 2000);
            } else {
                // Wrong answer - increment attempts
                const newAttempts = currentAttempts + 1;
                this.attempts.set(this.currentCountry.code, newAttempts);
                
                // Store reference to clicked country for resetting later
                const clickedCountryPaths = allPathsForClickedCountry;
                
                // Temporarily mark clicked country as incorrect (visual feedback)
                clickedCountryPaths.forEach(path => {
                    path.style.transition = 'none';
                    path.style.transform = 'none';
                    path.style.position = 'static';
                    path.setAttribute('fill', '#E74C3C');
                    path.setAttribute('stroke', '#C0392B');
                    path.setAttribute('stroke-width', '3');
                    // Don't add 'incorrect' class to wrong countries - only add it temporarily
                });
                
                // Add glow effect
                clickedCountryPaths.forEach(path => {
                    path.style.filter = 'drop-shadow(0 0 12px rgba(231, 76, 60, 1)) drop-shadow(0 0 6px rgba(231, 76, 60, 0.8))';
                });
                
                if (newAttempts >= 3) {
                    // Out of attempts - mark the CORRECT country as wrong
                    // Only increment wrong if this country hasn't been counted as wrong yet
                    if (!this.wrongCountries.has(this.currentCountry.code)) {
                        this.wrong++;
                        this.wrongCountries.add(this.currentCountry.code);
                    }
                    this.feedbackEl.textContent = `✗ Incorrect! No attempts remaining.`;
                    this.feedbackEl.className = 'feedback-message incorrect';
                    
                    // Play sad failure sound for third attempt
                    this.playFailureSound();
                    
                    // Find all paths for the CORRECT country (the one that should have been clicked)
                    const allPathsForCorrectCountry = this.findAllPathsForCountry(this.currentCountry.code);
                    
                    // Mark the CORRECT country as incorrect (red)
                    allPathsForCorrectCountry.forEach(path => {
                        path.style.transition = 'none';
                        path.style.transform = 'none';
                        path.style.position = 'static';
                        path.setAttribute('fill', '#E74C3C');
                        path.setAttribute('stroke', '#C0392B');
                        path.setAttribute('stroke-width', '3');
                        path.classList.add('incorrect');
                        path.classList.remove('correct');
                    });
                    
                    // Mark as answered
                    this.answered.add(this.currentCountry.code);
                    this.updateStats();
                    
                    setTimeout(() => {
                        // Reset the incorrectly clicked country back to green (so it can be clicked later)
                        clickedCountryPaths.forEach(path => {
                            path.setAttribute('fill', '#2ECC71');
                            path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                            path.setAttribute('stroke-width', '1');
                            path.classList.remove('incorrect');
                            path.style.filter = '';
                        });
                        
                        this.getNextCountry();
                        if (this.gameActive) {
                            this.feedbackEl.textContent = '';
                            this.feedbackEl.className = 'feedback-message';
                        }
                        this.isProcessingClick = false;
                    }, 2000);
                } else {
                    // Still have attempts remaining
                    const remainingAttempts = 3 - newAttempts;
                    this.feedbackEl.textContent = `✗ Incorrect! ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`;
                    this.feedbackEl.className = 'feedback-message incorrect';
                    
                    // Play error sound
                    this.playErrorSound();
                    
                    // Reset the clicked country back to green after showing error (so it can be clicked if it becomes correct)
                    setTimeout(() => {
                        clickedCountryPaths.forEach(path => {
                            path.setAttribute('fill', '#2ECC71');
                            path.setAttribute('stroke', 'rgba(0, 0, 0, 0.8)');
                            path.setAttribute('stroke-width', '1');
                            path.classList.remove('incorrect');
                            path.style.filter = '';
                            // Ensure the country can be clicked again even if it becomes the correct answer
                            path.style.pointerEvents = 'auto';
                        });
                        
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                        this.updateStats();
                    }, 2000);
                }
            }
        }
    }
    
    updateStats() {
        this.scoreEl.textContent = this.score;
        this.correctEl.textContent = `${this.correct} / 50`;
        this.wrongEl.textContent = this.wrong;
        this.remainingEl.textContent = this.countries.length - this.answered.size;
        
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
    
    async endGame() {
        this.gameActive = false;
        this.stopTimer();
        
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
        
        // Show completion message with time stats
        let completionMessage = `Final Score: ${this.score} | Time: ${timeString} | Correct: ${this.correct} | Wrong: ${this.wrong}`;
        if (this.speedBonus > 0) {
            completionMessage += ` | Speed Bonus: +${this.speedBonus}`;
        }
        if (isNewBest) {
            completionMessage += ` | 🏆 NEW BEST TIME!`;
        } else if (this.bestTime) {
            completionMessage += ` | Best: ${bestTimeString}`;
        }
        completionMessage += ` | Avg: ${avgTime}s/q`;
        
        this.feedbackEl.textContent = completionMessage;
        this.feedbackEl.className = 'feedback-message';
        
        // Store score data for leaderboard submission
        this.pendingScoreData = {
                    gameType: 'geography',
                    score: this.score,
            userId: userId || null, // Will be generated on backend if null
            userName: null, // Will be set by user input
                    correct: this.correct,
                    wrong: this.wrong,
                    time: finalTime,
                    speedBonus: this.speedBonus,
                    avgTime: parseFloat(avgTime),
        };
        
        // Show leaderboard submit form
        const submitForm = document.getElementById('leaderboardSubmitForm');
        if (submitForm) {
            submitForm.style.display = 'block';
            submitForm.style.visibility = 'visible';
            submitForm.style.opacity = '1';
            // Scroll form into view
            submitForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log('[Geography Game] Leaderboard form should now be visible');
        } else {
            console.error('[Geography Game] Leaderboard submit form not found!');
        }
        
        // Set up submit button handler
        this.setupLeaderboardSubmit();
        
        // Set up view leaderboard button
        this.setupViewLeaderboard();
        
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
            const userName = nameInput.value.trim() || 'Anonymous';
            
            if (!this.pendingScoreData) {
                this.showSubmitStatus('No score data available', 'error');
                return;
            }
            
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
                        window.leaderboardGeo.render();
                        
                        // Find user's rank
                        const userScore = scoreData.score;
                        const userRank = window.leaderboardGeo.scores.findIndex(s => 
                            s.userName === userName && Math.abs(s.score - userScore) < 0.01
                        ) + 1;
                        
                        if (userRank > 0 && userRank <= 50) {
                            this.showSubmitStatus(`✓ Score submitted! You're ranked #${userRank} on the leaderboard!`, 'success');
                        } else {
                            this.showSubmitStatus('✓ Score submitted successfully!', 'success');
                        }
                        
                        // Show leaderboard after a short delay
                        setTimeout(() => {
                            console.log('[Geography Game] Showing leaderboard...');
                            window.leaderboardGeo.show();
                        }, 1500);
                    } catch (error) {
                        console.error('[Geography Game] Error loading/showing leaderboard:', error);
                        this.showSubmitStatus('✓ Score submitted successfully!', 'success');
                    }
                } else {
                    this.showSubmitStatus('Failed to submit score. Please try again.', 'error');
                    newSubmitBtn.disabled = false;
                }
            } catch (error) {
                console.error('[Geography Game] Leaderboard submission error:', error);
                this.showSubmitStatus('Error submitting score. Please try again.', 'error');
                newSubmitBtn.disabled = false;
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
                const errorText = await response.text();
                console.error('[Geography Game] Failed to submit score:', errorText);
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
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            
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
                    // Force update to recalculate constraints and center
                    setTimeout(() => {
                        if (window.geoGame && window.geoGame.updateTransform) {
                            window.geoGame.updateTransform();
                        }
                    }, 100);
                }
                
                // Process all paths and add country codes
                processSVGMap(svgElement);
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
        
        // First try exact code match from ID (most reliable)
        if (id && id.length === 2) {
            country = POPULOUS_COUNTRIES.find(c => 
                c.code.toLowerCase() === id.toLowerCase()
            );
        }
        
        // Also check if ID contains country code (for paths like "PH-1", "PH-2" for archipelagos)
        if (!country && id) {
            for (const c of POPULOUS_COUNTRIES) {
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
            const hasNorthKorea = /\bnorth\s+korea\b/i.test(searchText) || /\bkorea.*north\b/i.test(searchText);
            const hasSouthKorea = /\bsouth\s+korea\b/i.test(searchText) || /\bkorea.*south\b/i.test(searchText);
            const hasBothKoreas = hasNorthKorea && hasSouthKorea;
            
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

