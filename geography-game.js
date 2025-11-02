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
        this.gameActive = false;
        this.countryMap = {}; // Maps country codes to SVG paths
        this.attempts = new Map(); // Track attempts per country: countryCode -> attemptCount
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.svgNaturalWidth = 0;
        this.svgNaturalHeight = 0;
        this.minZoomLevel = 1; // Minimum zoom - will be calculated based on SVG fit
        
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
    }
    
    loadWorldMap() {
        // Load SVG world map
        // Try to load from a CDN or local file
        // For now, we'll create an interactive structure
        this.createInteractiveMap();
    }
    
    createInteractiveMap() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 2000 1000');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('class', 'world-map-svg');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        
        // Create clickable regions for countries
        // Note: This requires actual country SVG paths
        // We'll create a structure that can be enhanced with real map data
        
        this.mapContainer.innerHTML = '';
        this.mapContainer.appendChild(svg);
        
        // Load map data (you can use an external SVG file or library)
        this.loadMapData(svg);
    }
    
    loadMapData(svg) {
        // Try to load an SVG world map file
        // For production, include a proper SVG world map file
        // Here's a placeholder that creates clickable areas
        
        // Create a background
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', '2000');
        bg.setAttribute('height', '1000');
        bg.setAttribute('fill', '#1a4a6a');
        svg.appendChild(bg);
        
        // Add text instructions
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '1000');
        text.setAttribute('y', '500');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#fff');
        text.setAttribute('font-size', '24');
        text.textContent = 'Loading interactive map...';
        svg.appendChild(text);
        
        // For a complete solution, you would:
        // 1. Include a full SVG world map file (like from simplemaps.com or similar)
        // 2. Or use a library like jVectorMap, amMaps, or D3.js
        // 3. Map country codes to SVG path IDs or classes
        
        // Store SVG reference
        this.svg = svg;
        
        // Initialize country map structure
        this.initializeCountryPaths();
    }
    
    initializeCountryPaths() {
        // Set up event delegation to handle clicks on any country path
        if (this.svg) {
            this.svg.addEventListener('click', (e) => {
                // Find the clicked path element
                let path = e.target;
                if (path.tagName !== 'path') {
                    path = e.target.closest('path');
                }
                
                if (!path) {
                    console.log('Click detected but no path found');
                    return;
                }
                
                // Ignore non-populous countries
                if (path.classList.contains('non-populous')) {
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
                    return;
                }
                
                if (!this.gameActive) {
                    this.feedbackEl.textContent = 'Click "Start Game" to begin!';
                    this.feedbackEl.className = 'feedback-message incorrect';
                    setTimeout(() => {
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                    }, 2000);
                    return;
                }
                
                if (!this.currentCountry) {
                    console.log('No current country to find');
                    return;
                }
                
                if (this.answered.has(country.code)) {
                    // Country already answered
                    this.feedbackEl.textContent = `${country.name} has already been answered!`;
                    this.feedbackEl.className = 'feedback-message incorrect';
                    setTimeout(() => {
                        this.feedbackEl.textContent = '';
                        this.feedbackEl.className = 'feedback-message';
                    }, 1500);
                    return;
                }
                
                // Handle the click
                this.handleCountryClick(country.code, country.name);
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
        // Using a simple approach: load an SVG world map from a CDN or local file
        // For now, we'll create interactive paths based on country codes
        // In production, you'd include a full SVG world map file
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 1000 500');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('class', 'world-map-svg');
        
        // Create clickable regions for each country
        // This is a simplified version - you'd need the actual SVG paths for each country
        POPULOUS_COUNTRIES.forEach(country => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'country-path');
            path.setAttribute('data-country-code', country.code);
            path.setAttribute('data-country-name', country.name.toLowerCase());
            path.setAttribute('fill', '#2ECC71'); // Start green
            path.style.cursor = 'pointer';
            
            // Note: You need actual SVG path data for each country
            // This is a placeholder - you'd need to include the full SVG map
            // For now, we'll use a workaround with clickable areas
            
            path.addEventListener('click', (e) => {
                if (this.gameActive && !this.answered.has(country.code)) {
                    this.handleCountryClick(country.code, country.name);
                }
            });
            
            // Store reference
            this.countryMap[country.code.toLowerCase()] = path;
            
            svg.appendChild(path);
        });
        
        this.mapContainer.innerHTML = '';
        this.mapContainer.appendChild(svg);
        
        // If we can't load the real map, show instructions
        if (this.mapContainer.querySelector('path').getAttribute('d') === null) {
            this.showMapInstructions();
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
                    this.startX = e.clientX - this.panX;
                    this.startY = e.clientY - this.panY;
                    this.mapContainer.style.cursor = 'grabbing';
                }
            });
            
            this.mapContainer.addEventListener('mousemove', (e) => {
                if (this.isPanning) {
                    this.panX = e.clientX - this.startX;
                    this.panY = e.clientY - this.startY;
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
                    this.isPanning = true;
                    touchStartX = e.touches[0].clientX - this.panX;
                    touchStartY = e.touches[0].clientY - this.panY;
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
                    const deltaX = Math.abs(e.touches[0].clientX - (touchStartX + this.panX));
                    const deltaY = Math.abs(e.touches[0].clientY - (touchStartY + this.panY));
                    
                    // If moved more than 10px, consider it a pan
                    if (deltaX > 10 || deltaY > 10) {
                        touchMoved = true;
                    }
                    
                    if (touchMoved) {
                        this.panX = e.touches[0].clientX - touchStartX;
                        this.panY = e.touches[0].clientY - touchStartY;
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
                            // Trigger click event on the path
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            touchTarget.dispatchEvent(clickEvent);
                        }
                    }
                    
                    this.isPanning = false;
                    touchMoved = false;
                    touchTarget = null;
                    initialDistance = 0;
                }
            });
            
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
        if (centerX !== undefined && centerY !== undefined && this.mapContainer) {
            // centerX and centerY are already in local coordinates (from wheel event)
            const zoomChange = this.zoomLevel / oldZoom;
            this.panX = centerX - (centerX - this.panX) * zoomChange;
            this.panY = centerY - (centerY - this.panY) * zoomChange;
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
                
                // Calculate how the SVG is displayed (accounting for aspect ratio and container size)
                const svgAspect = this.svgNaturalWidth / this.svgNaturalHeight;
                const containerAspect = containerWidth / containerHeight;
                
                let displayedWidth, displayedHeight;
                if (svgAspect > containerAspect) {
                    // SVG is wider - fit to width
                    displayedWidth = containerWidth;
                    displayedHeight = containerWidth / svgAspect;
                } else {
                    // SVG is taller - fit to height
                    displayedHeight = containerHeight;
                    displayedWidth = containerHeight * svgAspect;
                }
                
                // Calculate minimum zoom level - if SVG fits at zoom 1.0, don't allow zooming out
                // If SVG doesn't fit at zoom 1.0, calculate the zoom needed to just fit
                const fitsWidth = displayedWidth <= containerWidth;
                const fitsHeight = displayedHeight <= containerHeight;
                
                if (fitsWidth && fitsHeight) {
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
                
                // Center the SVG initially if it hasn't been manually panned yet
                const isInitialLoad = this.panX === 0 && this.panY === 0 && 
                                     (this.zoomLevel === this.minZoomLevel || this.zoomLevel === 1);
                
                if (isInitialLoad) {
                    // If scaled map is smaller than container, center it
                    if (scaledWidth < containerWidth) {
                        this.panX = (containerWidth - scaledWidth) / 2;
                    }
                    if (scaledHeight < containerHeight) {
                        this.panY = (containerHeight - scaledHeight) / 2;
                    }
                    // If scaled map is larger than container, start from top-left (panX/panY = 0)
                    // which will show the left side. Instead, center it by panning left.
                    if (scaledWidth > containerWidth) {
                        // Start centered, showing middle of map
                        this.panX = -(scaledWidth - containerWidth) / 2;
                    }
                    if (scaledHeight > containerHeight) {
                        // Start centered vertically
                        this.panY = -(scaledHeight - containerHeight) / 2;
                    }
                }
                
                // Constrain panning to keep SVG within container bounds
                const maxPanX = Math.max(0, containerWidth - scaledWidth);
                const minPanX = Math.min(0, containerWidth - scaledWidth);
                const maxPanY = Math.max(0, containerHeight - scaledHeight);
                const minPanY = Math.min(0, containerHeight - scaledHeight);
                
                // Clamp pan values
                this.panX = Math.max(minPanX, Math.min(maxPanX, this.panX));
                this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY));
                
                svgElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
                svgElement.style.transformOrigin = 'top left';
            }
        }
    }
    
    startGame() {
        this.gameActive = true;
        this.score = 0;
        this.correct = 0;
        this.wrong = 0;
        this.answered.clear();
        this.attempts.clear();
        
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
        this.attempts.clear();
        
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
    }
    
    findAllPathsForCountry(countryCode) {
        const allPaths = new Set();
        
        if (!countryCode || !this.svg) return Array.from(allPaths);
        
        const codeUpper = countryCode.toUpperCase();
        const codeLower = countryCode.toLowerCase();
        
        // Get from countryMap
        if (this.countryMap[codeLower]) {
            allPaths.add(this.countryMap[codeLower]);
        }
        if (this.countryMap[codeUpper]) {
            allPaths.add(this.countryMap[codeUpper]);
        }
        
        // Find by data-country-code attribute (case insensitive)
        const pathsByCode = this.svg.querySelectorAll(`path[data-country-code="${codeUpper}"], path[data-country-code="${codeLower}"]`);
        pathsByCode.forEach(p => allPaths.add(p));
        
        // Find by ID
        const pathsById = this.svg.querySelectorAll(`path#${codeUpper}, path#${codeLower}`);
        pathsById.forEach(p => allPaths.add(p));
        
        // Also search by data-country-name if available
        const country = POPULOUS_COUNTRIES.find(c => c.code.toUpperCase() === codeUpper);
        if (country) {
            const pathsByName = this.svg.querySelectorAll(`path[data-country-name="${country.name}"], path[data-country-name="${country.name.toLowerCase()}"]`);
            pathsByName.forEach(p => allPaths.add(p));
            
            // Try alternative names
            country.alt.forEach(altName => {
                const pathsByAlt = this.svg.querySelectorAll(`path[data-country-name="${altName}"], path[data-country-name="${altName.toLowerCase()}"]`);
                pathsByAlt.forEach(p => allPaths.add(p));
            });
        }
        
        // Remove any null/undefined paths
        return Array.from(allPaths).filter(p => p && p.tagName === 'path');
    }
    
    handleCountryClick(clickedCode, clickedName) {
        if (!this.gameActive || !this.currentCountry) return;
        
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
        }
        
        if (clickedPath) {
            // Find ALL paths for the clicked country
            const allPathsForClickedCountry = this.findAllPathsForCountry(clickedCode);
            
            if (isCorrect) {
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
                this.score += 10 * scoreMultiplier;
                this.correct++;
                this.feedbackEl.textContent = '✓ Correct!';
                this.feedbackEl.className = 'feedback-message correct';
                
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
                    this.wrong++;
                    this.feedbackEl.textContent = `✗ Incorrect! No attempts remaining.`;
                    this.feedbackEl.className = 'feedback-message incorrect';
                    
                    // Play error sound
                    this.playErrorSound();
                    
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
        
        // Update directions count
        if (this.directionsCountEl) {
            this.directionsCountEl.textContent = `${this.correct} / 50`;
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
    
    endGame() {
        this.gameActive = false;
        this.promptEl.textContent = 'Game Complete!';
        this.feedbackEl.textContent = `Final Score: ${this.score} | Correct: ${this.correct} | Wrong: ${this.wrong}`;
        this.feedbackEl.className = 'feedback-message';
        
        this.startBtn.disabled = false;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.geoGame = new GeographyGame();
    
    // Try to load an SVG world map
    // Option 1: Load from CDN or local file
    loadSVGMap();
});

function loadSVGMap() {
    // Try to load an external SVG map file
    // You can download a free SVG world map from:
    // - https://simplemaps.com/resources/svg-world
    // - https://www.amcharts.com/svg-maps/
    // - Or use D3.js with topojson
    
    fetch('world-map.svg')
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Map file not found');
        })
        .then(svgText => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');
            
            if (svgElement) {
                const mapContainer = document.getElementById('worldMap');
                mapContainer.innerHTML = '';
                
                // Ensure SVG is properly sized and visible
                if (!svgElement.getAttribute('viewBox') && svgElement.getAttribute('width') && svgElement.getAttribute('height')) {
                    const width = svgElement.getAttribute('width');
                    const height = svgElement.getAttribute('height');
                    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
                }
                
                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                svgElement.style.minWidth = '800px';
                svgElement.style.minHeight = '400px';
                svgElement.style.display = 'block';
                svgElement.style.visibility = 'visible';
                svgElement.style.opacity = '1';
                
                mapContainer.appendChild(svgElement);
                
                // Log success
                console.log('✓ SVG map loaded successfully');
                console.log('SVG dimensions:', svgElement.getBoundingClientRect());
                
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
                        window.geoGame.updateTransform();
                    }, 100);
                }
                
                // Process all paths and add country codes
                processSVGMap(svgElement);
            }
        })
        .catch(error => {
            console.error('Error loading SVG map:', error);
            console.log('SVG map file not found or failed to load.');
            console.log('Error details:', error.message);
            
            // Create a helpful placeholder
            createMapPlaceholder();
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
        
        // Then try name matching from name attribute
        if (!country && nameAttr) {
            const normalizedNameAttr = normalizeName(nameAttr);
            country = POPULOUS_COUNTRIES.find(c => {
                const normalizedCountryName = normalizeName(c.name);
                const normalizedAltNames = c.alt.map(a => normalizeName(a));
                
                return normalizedCountryName === normalizedNameAttr ||
                       normalizedAltNames.some(alt => alt === normalizedNameAttr) ||
                       normalizedNameAttr.includes(normalizedCountryName) ||
                       normalizedCountryName.includes(normalizedNameAttr);
            });
        }
        
        // Then try class name matching
        if (!country && className) {
            const normalizedClassName = normalizeName(className);
            country = POPULOUS_COUNTRIES.find(c => {
                const normalizedCountryName = normalizeName(c.name);
                const normalizedAltNames = c.alt.map(a => normalizeName(a));
                
                return normalizedCountryName === normalizedClassName ||
                       normalizedAltNames.some(alt => alt === normalizedClassName) ||
                       normalizedClassName.includes(normalizedCountryName) ||
                       normalizedCountryName.includes(normalizedClassName);
            });
        }
        
        // Finally try fuzzy matching from all sources
        if (!country) {
            const searchText = `${id} ${nameAttr} ${className} ${title}`.toLowerCase();
            country = POPULOUS_COUNTRIES.find(c => {
                const normalizedCountryName = normalizeName(c.name);
                const normalizedAltNames = c.alt.map(a => normalizeName(a));
                
                return normalizedAltNames.some(alt => searchText.includes(alt)) ||
                       searchText.includes(normalizedCountryName) ||
                       normalizedCountryName.includes(searchText);
            });
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
                console.log(`⚠ Unmapped path (non-populous): id="${id}", name="${nameAttr}", class="${className}"`);
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

