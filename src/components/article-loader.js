/**
 * Article Loader - Premium Article Page
 * Loads and displays articles with exact post text (no rewriting)
 */

(function() {
    'use strict';

    // SEO Configuration
    const SITE_URL = 'https://noteworthynews.co';
    const DEFAULT_OG_IMAGE = `${SITE_URL}/PREVIEWIMAGEBRUH.jpg`;
    const DEFAULT_DESCRIPTION = 'Noteworthy News: globally curious, teen-led reporting.';

    /**
     * Escape HTML to prevent XSS attacks
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format text preserving line breaks as paragraphs
     */
    function formatPostText(text) {
        if (!text) return '';
        
        // Split by line breaks and create paragraphs
        const lines = text.split(/\n+/).filter(line => line.trim().length > 0);
        
        // If multiple paragraphs, style as update blocks
        if (lines.length > 1) {
            return lines.map(line => {
                const escaped = escapeHtml(line.trim());
                return `<p class="update-block">${escaped}</p>`;
            }).join('\n');
        }
        
        // Single paragraph
        return `<p>${escapeHtml(text.trim())}</p>`;
    }

    /**
     * Format relative time
     */
    function formatRelativeTime(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        } catch {
            return dateString || 'Recently';
        }
    }

    /**
     * Format absolute date
     */
    function formatDate(dateString) {
        if (!dateString) return 'Recently';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Recently';
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Recently';
        }
    }

    /**
     * Calculate read time
     */
    function calculateReadTime(content) {
        const words = content.split(/\s+/).length;
        const minutes = Math.ceil(words / 200);
        return Math.max(1, minutes);
    }

    /**
     * Ensure absolute image URL
     */
    function ensureAbsoluteImageUrl(imageUrl) {
        if (!imageUrl) return DEFAULT_OG_IMAGE;
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }
        if (imageUrl.startsWith('/')) {
            return `${SITE_URL}${imageUrl}`;
        }
        return `${SITE_URL}/${imageUrl}`;
    }

    /**
     * Truncate description
     */
    function truncateDescription(text, maxLength = 155) {
        if (!text) return DEFAULT_DESCRIPTION;
        if (text.length <= maxLength) return text;
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.8) {
            return truncated.substring(0, lastSpace) + '...';
        }
        return truncated + '...';
    }

    /**
     * Get or create meta element
     */
    function getOrCreateMeta(property, attribute = 'property') {
        let element = document.querySelector(`meta[${attribute}="${property}"]`);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attribute, property);
            document.head.appendChild(element);
        }
        return element;
    }

    /**
     * Get or create link element
     */
    function getOrCreateLink(rel) {
        let element = document.querySelector(`link[rel="${rel}"]`);
        if (!element) {
            element = document.createElement('link');
            element.setAttribute('rel', rel);
            document.head.appendChild(element);
        }
        return element;
    }

    /**
     * Update SEO meta tags
     */
    function updatePostMetaTags(post, postId) {
        const title = escapeHtml(post.title || post.story || post.text || 'Breaking News Story');
        const story = post.story || post.text || post.title || '';
        const description = truncateDescription(story);
        const image = ensureAbsoluteImageUrl(post.image || post.images?.[0] || null);
        const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
        const url = `${SITE_URL}/article.html?id=${encodeURIComponent(postId)}`;

        // Update page title
        document.title = `${title} | Noteworthy News`;
        const titleElement = document.getElementById('article-title');
        if (titleElement) {
            titleElement.textContent = `${title} - Noteworthy News`;
        }

        // Basic meta tags
        getOrCreateMeta('description', 'name').setAttribute('content', description);
        getOrCreateLink('canonical').setAttribute('href', url);

        // Open Graph
        getOrCreateMeta('og:url').setAttribute('content', url);
        getOrCreateMeta('og:title').setAttribute('content', title);
        getOrCreateMeta('og:description').setAttribute('content', description);
        getOrCreateMeta('og:image').setAttribute('content', image);
        getOrCreateMeta('og:image:width').setAttribute('content', '1200');
        getOrCreateMeta('og:image:height').setAttribute('content', '630');
        getOrCreateMeta('og:site_name').setAttribute('content', 'Noteworthy News');
        getOrCreateMeta('og:locale').setAttribute('content', 'en_US');
        getOrCreateMeta('og:type').setAttribute('content', 'article');
        getOrCreateMeta('article:published_time').setAttribute('content', datePosted);
        getOrCreateMeta('article:author').setAttribute('content', 'Noteworthy News');

        // Twitter Card
        getOrCreateMeta('twitter:url', 'name').setAttribute('content', url);
        getOrCreateMeta('twitter:title', 'name').setAttribute('content', title);
        getOrCreateMeta('twitter:description', 'name').setAttribute('content', description);
        getOrCreateMeta('twitter:image', 'name').setAttribute('content', image);
        getOrCreateMeta('twitter:card', 'name').setAttribute('content', 'summary_large_image');
        getOrCreateMeta('twitter:site', 'name').setAttribute('content', '@NoteworthyNews');
        getOrCreateMeta('twitter:creator', 'name').setAttribute('content', '@NoteworthyNews');
    }

    /**
     * Extract keywords from text for related articles matching
     */
    function extractKeywords(text) {
        if (!text) return [];
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));
        
        // Count frequency
        const freq = {};
        words.forEach(word => {
            freq[word] = (freq[word] || 0) + 1;
        });
        
        // Return top keywords
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }

    /**
     * Calculate keyword overlap score between two posts
     */
    function calculateKeywordOverlap(post1, post2) {
        const text1 = (post1.title || post1.story || post1.text || '').toLowerCase();
        const text2 = (post2.title || post2.story || post2.text || '').toLowerCase();
        
        const keywords1 = extractKeywords(text1);
        const keywords2 = extractKeywords(text2);
        
        if (keywords1.length === 0 || keywords2.length === 0) return 0;
        
        const intersection = keywords1.filter(k => keywords2.includes(k));
        return intersection.length / Math.max(keywords1.length, keywords2.length);
    }

    /**
     * Find related articles using deterministic algorithm
     */
    function findRelatedArticles(allPosts, currentPost, currentId, maxResults = 6) {
        // Exclude current post
        const candidates = allPosts.filter(p => {
            const id = p.id || '';
            return id !== currentId && id !== `post-${currentId}` && (p.story || p.text || p.title);
        });

        if (candidates.length === 0) return [];

        // Score each candidate
        const scored = candidates.map(post => {
            let score = 0;
            
            // Prefer same category/tag if exists
            if (currentPost.tags && post.tags) {
                const commonTags = currentPost.tags.filter(tag => post.tags.includes(tag));
                score += commonTags.length * 10;
            }
            
            if (currentPost.category && post.category && currentPost.category === post.category) {
                score += 5;
            }
            
            // Keyword overlap from headline/title
            const overlap = calculateKeywordOverlap(currentPost, post);
            score += overlap * 3;
            
            // Recency bonus (newer posts get slight boost)
            const currentDate = new Date(currentPost.datePosted || currentPost.createdAt || currentPost.created_at || 0);
            const postDate = new Date(post.datePosted || post.createdAt || post.created_at || 0);
            const daysDiff = Math.abs((currentDate - postDate) / (1000 * 60 * 60 * 24));
            if (daysDiff < 7) score += 1;
            
            return { post, score };
        });

        // Sort by score and return top results
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(item => item.post);
    }

    /**
     * Generate earthquake-specific enhancements (location details, nearby places, assessments, etc.)
     */
    async function generateEarthquakeEnhancements(post, magnitude) {
        const lat = post.lat;
        const lon = post.lon;
        const locationDisplay = post.location_display || post.location || 'Unknown Location';
        const magnitudeFormatted = magnitude ? magnitude.toFixed(1) : 'N/A';
        const depth = post.assets?.depth || post.depth;
        const depthFormatted = depth ? `${depth.toFixed(1)} km` : null;
        
        // Extract assessment data
        const impactAssessment = post.assets?.impact_assessment || null;
        const tsunamiAssessment = post.assets?.tsunami_assessment || null;
        const aftershockForecast = post.assets?.aftershock_forecast || null;
        const anomalyDetection = post.assets?.anomaly_detection || null;
        
        let html = '';
        
        // Add interactive map container
        html += `
            <div class="earthquake-map-container" style="margin: 2rem 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                <div id="earthquake-interactive-map" style="width: 100%; height: 500px; background: #f0f0f0;"></div>
            </div>
        `;
        
        // Add location details section
        html += `
            <div class="earthquake-details-section" style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #fff;">📍 Location Details</h2>
                <div class="earthquake-details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div class="detail-card" style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Magnitude</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">M${magnitudeFormatted}</div>
                    </div>
                    ${depthFormatted ? `
                    <div class="detail-card" style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Depth</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${depthFormatted}</div>
                    </div>
                    ` : ''}
                    <div class="detail-card" style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Coordinates</div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #fff; font-family: 'Courier New', monospace;">${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}</div>
                    </div>
                    <div class="detail-card" style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Location</div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #fff;">${escapeHtml(locationDisplay)}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Add impact assessment section
        if (impactAssessment) {
            const severityColor = impactAssessment.severity === 'CRITICAL' ? '#d32f2f' : 
                                 impactAssessment.severity === 'HIGH' ? '#f57c00' : 
                                 impactAssessment.severity === 'MODERATE' ? '#fbc02d' : '#388e3c';
            html += `
                <div class="impact-assessment-section" style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 12px; border-left: 4px solid ${severityColor};">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff;">📊 Impact Assessment</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">Risk Score</div>
                            <div style="font-size: 2rem; font-weight: 700; color: ${severityColor};">${impactAssessment.riskScore}/100</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.25rem;">${impactAssessment.severity}</div>
                        </div>
                        ${impactAssessment.affectedPopulation ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">Affected Population</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${(impactAssessment.affectedPopulation / 1000).toFixed(1)}K</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.25rem;">people</div>
                        </div>
                        ` : ''}
                        ${impactAssessment.criticalInfrastructure ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">Critical Infrastructure</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #fff;">
                                ${impactAssessment.criticalInfrastructure.hospitals} hospitals, 
                                ${impactAssessment.criticalInfrastructure.airports} airports
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // Add tsunami risk section
        if (tsunamiAssessment && tsunamiAssessment.riskLevel !== 'LOW') {
            const riskColor = tsunamiAssessment.riskLevel === 'HIGH' ? '#d32f2f' : '#f57c00';
            html += `
                <div class="tsunami-risk-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(255,152,0,0.1) 0%, rgba(255,152,0,0.05) 100%); border-radius: 12px; border-left: 4px solid ${riskColor};">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff;">🌊 Tsunami Risk Assessment</h2>
                    <div style="font-size: 1.125rem; font-weight: 600; color: ${riskColor}; margin-bottom: 0.5rem;">
                        ${tsunamiAssessment.riskLevel} RISK
                    </div>
                    <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); line-height: 1.6;">
                        ${tsunamiAssessment.assessment || 'Monitor official tsunami warnings.'}
                    </div>
                    ${tsunamiAssessment.travelTime ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8);">
                            Estimated travel time to coast: <strong>${tsunamiAssessment.travelTime.hours}h ${tsunamiAssessment.travelTime.minutes}m</strong>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Add aftershock forecast section
        if (aftershockForecast && aftershockForecast.probability24h >= 40) {
            html += `
                <div class="aftershock-forecast-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(156,39,176,0.1) 0%, rgba(156,39,176,0.05) 100%); border-radius: 12px; border-left: 4px solid #9c27b0;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff;">📊 Aftershock Forecast</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">24 Hour Probability</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #9c27b0;">${aftershockForecast.probability24h}%</div>
                        </div>
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">Expected Largest</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #9c27b0;">M${aftershockForecast.expectedLargestAftershock.toFixed(1)}</div>
                        </div>
                    </div>
                    <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); line-height: 1.6;">
                        ${aftershockForecast.forecast || ''}
                    </div>
                    ${aftershockForecast.recommendation ? `
                    <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.9);">
                            💡 <strong>Recommendation:</strong> ${aftershockForecast.recommendation}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Add anomaly detection section
        if (anomalyDetection && anomalyDetection.anomalyLevel !== 'NORMAL') {
            const anomalyColor = anomalyDetection.anomalyLevel === 'HIGH' ? '#d32f2f' : 
                                anomalyDetection.anomalyLevel === 'MEDIUM' ? '#f57c00' : '#fbc02d';
            html += `
                <div class="anomaly-detection-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(211,47,47,0.1) 0%, rgba(211,47,47,0.05) 100%); border-radius: 12px; border-left: 4px solid ${anomalyColor};">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff;">⚠️ Anomaly Detection</h2>
                    <div style="font-size: 1.125rem; font-weight: 600; color: ${anomalyColor}; margin-bottom: 0.5rem;">
                        ${anomalyDetection.anomalyLevel} ANOMALY LEVEL
                    </div>
                    <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); line-height: 1.6; margin-bottom: 1rem;">
                        ${anomalyDetection.summary || 'Unusual earthquake patterns detected.'}
                    </div>
                    ${anomalyDetection.anomalies && anomalyDetection.anomalies.length > 0 ? `
                    <div style="margin-top: 1rem;">
                        ${anomalyDetection.anomalies.map(anomaly => `
                            <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 3px solid ${anomalyColor};">
                                <div style="font-size: 0.75rem; font-weight: 600; color: ${anomalyColor}; text-transform: uppercase; margin-bottom: 0.25rem;">${anomaly.type}</div>
                                <div style="font-size: 0.875rem; color: rgba(255,255,255,0.9);">${escapeHtml(anomaly.description)}</div>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Add 3D visualization container
        html += `
            <div class="earthquake-3d-container" style="margin: 2rem 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); background: rgba(0,0,0,0.3);">
                <div style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <h3 style="margin: 0; color: #fff; font-size: 1.125rem; font-weight: 600;">🌐 3D Earthquake Visualization</h3>
                </div>
                <div id="earthquake-3d-viewer" style="width: 100%; height: 500px; background: #1a1a1a;"></div>
            </div>
        `;
        
        // Add loading placeholders for nearby locations (will be populated by JavaScript)
        html += `
            <div id="earthquake-nearby-locations" style="margin: 2rem 0;">
                <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">
                    <div class="skeleton" style="height: 200px; border-radius: 12px;"></div>
                </div>
            </div>
        `;
        
        return html;
    }
    
    /**
     * Initialize 3D visualization using Three.js
     */
    function initialize3DVisualization(lat, lon, magnitude, depth, locationDisplay) {
        // Load Three.js if not already loaded
        if (!window.THREE) {
            const threeJS = document.createElement('script');
            threeJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
            threeJS.onload = () => {
                create3DScene(lat, lon, magnitude, depth, locationDisplay);
            };
            document.head.appendChild(threeJS);
        } else {
            create3DScene(lat, lon, magnitude, depth, locationDisplay);
        }
        
        function create3DScene(lat, lon, magnitude, depth, locationDisplay) {
            const container = document.getElementById('earthquake-3d-viewer');
            if (!container || !window.THREE) return;
            
            // Scene setup
            const scene = new window.THREE.Scene();
            scene.background = new window.THREE.Color(0x1a1a1a);
            
            const camera = new window.THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
            const renderer = new window.THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(renderer.domElement);
            
            // Add lights
            const ambientLight = new window.THREE.AmbientLight(0x404040, 0.6);
            scene.add(ambientLight);
            const directionalLight = new window.THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            scene.add(directionalLight);
            
            // Create Earth sphere
            const earthGeometry = new window.THREE.SphereGeometry(5, 32, 32);
            const earthMaterial = new window.THREE.MeshPhongMaterial({ 
                color: 0x2233ff,
                emissive: 0x112244,
                shininess: 100
            });
            const earth = new window.THREE.Mesh(earthGeometry, earthMaterial);
            scene.add(earth);
            
            // Calculate position on sphere (convert lat/lon to 3D coordinates)
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);
            const radius = 5.2;
            const x = -radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            
            // Create epicenter marker (pulsing sphere)
            const epicenterGeometry = new window.THREE.SphereGeometry(0.3, 16, 16);
            const epicenterMaterial = new window.THREE.MeshPhongMaterial({ 
                color: 0xff0000,
                emissive: 0xff4444,
                transparent: true,
                opacity: 0.9
            });
            const epicenter = new window.THREE.Mesh(epicenterGeometry, epicenterMaterial);
            epicenter.position.set(x, y, z);
            scene.add(epicenter);
            
            // Create depth indicator (line from surface to depth)
            if (depth) {
                const depthRatio = Math.min(depth / 100, 0.5); // Max 50% of radius
                const depthPoint = new window.THREE.Vector3(
                    x * (1 - depthRatio),
                    y * (1 - depthRatio),
                    z * (1 - depthRatio)
                );
                const depthGeometry = new window.THREE.BufferGeometry().setFromPoints([
                    new window.THREE.Vector3(x, y, z),
                    depthPoint
                ]);
                const depthMaterial = new window.THREE.LineBasicMaterial({ color: 0xff6666, linewidth: 2 });
                const depthLine = new window.THREE.Line(depthGeometry, depthMaterial);
                scene.add(depthLine);
            }
            
            // Create shake intensity ring
            const ringGeometry = new window.THREE.RingGeometry(0.4, 0.6, 32);
            const ringMaterial = new window.THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                side: window.THREE.DoubleSide,
                transparent: true,
                opacity: 0.6
            });
            const ring = new window.THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.set(x, y, z);
            ring.lookAt(0, 0, 0); // Face outward from Earth
            scene.add(ring);
            
            // Position camera
            camera.position.set(15, 10, 15);
            camera.lookAt(x, y, z);
            
            // Animation loop
            let pulseScale = 1.0;
            function animate() {
                requestAnimationFrame(animate);
                
                // Rotate Earth slowly
                earth.rotation.y += 0.002;
                
                // Pulse epicenter
                pulseScale += 0.02;
                if (pulseScale > 1.3) pulseScale = 1.0;
                epicenter.scale.set(pulseScale, pulseScale, pulseScale);
                epicenterMaterial.opacity = 0.5 + (pulseScale - 1.0) * 0.5;
                
                renderer.render(scene, camera);
            }
            animate();
            
            // Handle window resize
            window.addEventListener('resize', () => {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            });
        }
    }
    
    /**
     * Initialize interactive earthquake map using Leaflet
     */
    function initializeEarthquakeMap(lat, lon, magnitude, locationDisplay) {
        // Load Leaflet CSS and JS if not already loaded
        if (!document.querySelector('link[href*="leaflet"]')) {
            const leafletCSS = document.createElement('link');
            leafletCSS.rel = 'stylesheet';
            leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            leafletCSS.crossOrigin = '';
            document.head.appendChild(leafletCSS);
        }
        
        // Load Leaflet JS
        if (!window.L) {
            const leafletJS = document.createElement('script');
            leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            leafletJS.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            leafletJS.crossOrigin = '';
            leafletJS.onload = () => {
                createMap(lat, lon, magnitude, locationDisplay);
            };
            document.head.appendChild(leafletJS);
        } else {
            createMap(lat, lon, magnitude, locationDisplay);
        }
        
        function createMap(lat, lon, magnitude, locationDisplay) {
            const mapContainer = document.getElementById('earthquake-interactive-map');
            if (!mapContainer) return;
            
            // Create map centered on earthquake location
            const map = window.L.map('earthquake-interactive-map').setView([lat, lon], 10);
            
            // Add OpenStreetMap tiles
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Calculate radius based on magnitude (rough estimate of felt area)
            const radiusKm = magnitude * 10; // km
            const radiusMeters = radiusKm * 1000;
            
            // Add circle showing approximate felt area
            const feltArea = window.L.circle([lat, lon], {
                radius: radiusMeters,
                fillColor: '#ff6b6b',
                fillOpacity: 0.2,
                color: '#ff6b6b',
                weight: 2,
                dashArray: '5, 5'
            }).addTo(map);
            
            // Add epicenter marker with custom icon
            const epicenterIcon = window.L.divIcon({
                className: 'earthquake-epicenter-marker',
                html: `<div style="background: #ff6b6b; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 3px rgba(255,107,107,0.5); animation: pulse 2s infinite;"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const epicenterMarker = window.L.marker([lat, lon], { icon: epicenterIcon }).addTo(map);
            
            // Add popup with earthquake info
            epicenterMarker.bindPopup(`
                <div style="text-align: center; padding: 0.5rem;">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700;">M${magnitude.toFixed(1)} Earthquake</h3>
                    <p style="margin: 0; color: #666;">${escapeHtml(locationDisplay)}</p>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: #999;">Epicenter</p>
                </div>
            `).openPopup();
            
            // Add CSS for pulse animation
            if (!document.querySelector('#earthquake-map-styles')) {
                const style = document.createElement('style');
                style.id = 'earthquake-map-styles';
                style.textContent = `
                    @keyframes pulse {
                        0% { box-shadow: 0 0 0 0 rgba(255,107,107,0.7); }
                        70% { box-shadow: 0 0 0 10px rgba(255,107,107,0); }
                        100% { box-shadow: 0 0 0 0 rgba(255,107,107,0); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Fetch and add nearby locations as markers
            fetchNearbyLocationsForMap(lat, lon, map);
        }
    }
    
    /**
     * Fetch nearby locations and add them to the map
     */
    async function fetchNearbyLocationsForMap(lat, lon, map) {
        try {
            // Fetch nearby locations from a backend function or directly from Overpass API
            const response = await fetch(`/.netlify/functions/get-nearby-locations?lat=${lat}&lon=${lon}&radius=50`);
            
            if (response.ok) {
                const data = await response.json();
                addNearbyLocationsToMap(data, map);
                updateNearbyLocationsUI(data);
            } else {
                // Fallback: try direct Overpass API call (may be rate-limited)
                console.warn('[ArticleLoader] Nearby locations function not available, skipping');
            }
        } catch (error) {
            console.warn('[ArticleLoader] Error fetching nearby locations:', error);
        }
    }
    
    /**
     * Add nearby location markers to the map
     */
    function addNearbyLocationsToMap(locations, map) {
        if (!window.L || !locations || !Array.isArray(locations)) return;
        
        locations.forEach(loc => {
            if (!loc.lat || !loc.lon) return;
            
            const icon = window.L.divIcon({
                className: 'nearby-location-marker',
                html: `<div style="background: #4A90E2; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            
            window.L.marker([loc.lat, loc.lon], { icon })
                .bindPopup(`<strong>${escapeHtml(loc.name)}</strong><br>${loc.distance} km away`)
                .addTo(map);
        });
    }
    
    /**
     * Update the nearby locations UI section
     */
    function updateNearbyLocationsUI(data) {
        const container = document.getElementById('earthquake-nearby-locations');
        if (!container || !data) return;
        
        const { locations = [], education = [], venues = [] } = data;
        
        let html = '';
        
        if (locations.length > 0 || education.length > 0 || venues.length > 0) {
            html += '<h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #fff;">🏙️ Nearby Important Locations</h2>';
            
            if (locations.length > 0) {
                html += `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: rgba(255,255,255,0.9);">Cities & Landmarks</h3>
                        <div style="display: grid; gap: 0.75rem;">
                            ${locations.slice(0, 6).map(loc => `
                                <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem;">${escapeHtml(loc.name)}</div>
                                        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.6); text-transform: capitalize;">${escapeHtml(loc.type)}</div>
                                    </div>
                                    <div style="font-weight: 600; color: #4A90E2;">${loc.distance} km</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            if (education.length > 0) {
                html += `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: rgba(255,255,255,0.9);">🎓 Educational Institutions</h3>
                        <div style="display: grid; gap: 0.75rem;">
                            ${education.map(edu => `
                                <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem;">${escapeHtml(edu.name)}</div>
                                        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.6); text-transform: capitalize;">${escapeHtml(edu.type === 'university' ? 'University' : edu.type === 'college' ? 'College' : 'School')}</div>
                                    </div>
                                    <div style="font-weight: 600; color: #1976d2;">${edu.distance} km</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            if (venues.length > 0) {
                html += `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: rgba(255,255,255,0.9);">🎭 Event Venues & Entertainment</h3>
                        <div style="display: grid; gap: 0.75rem;">
                            ${venues.slice(0, 6).map(venue => `
                                <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem;">${escapeHtml(venue.name)}</div>
                                        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.6); text-transform: capitalize;">${escapeHtml(venue.type.replace(/_/g, ' '))}</div>
                                    </div>
                                    <div style="font-weight: 600; color: #f57c00;">${venue.distance} km</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 0.875rem; color: rgba(255,255,255,0.7); font-style: italic;">
                            💡 These venues may host concerts, festivals, sports events, or other gatherings. Check local event listings for scheduled activities.
                        </div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = html || '<div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">No nearby locations found.</div>';
    }
    
    /**
     * Load article data and populate the page
     */
    async function loadArticle() {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        
        const headingElement = document.getElementById('article-heading');
        const bodyElement = document.getElementById('article-body');
        const timestampElement = document.getElementById('article-timestamp');
        const categoryChip = document.getElementById('category-chip');
        
        if (!headingElement || !bodyElement) {
            console.error('[ArticleLoader] Required elements not found');
            return;
        }
        
        if (!articleId) {
            headingElement.textContent = 'Article Not Found';
            bodyElement.innerHTML = '<p>No article ID provided. Please select an article from the <a href="/index.html" style="color: #4A90E2;">homepage</a>.</p>';
            return;
        }

        // Show loading state
        bodyElement.innerHTML = '<div class="skeleton" style="height: 400px; margin-bottom: 20px;"></div><div class="skeleton" style="height: 200px;"></div>';

        try {
            // Fetch posts
            let response;
            let retries = 2;
            
            while (retries >= 0) {
                try {
                    response = await fetch('/.netlify/functions/posts-read?limit=200', {
                        cache: 'default',
                        headers: { 'Accept': 'application/json' }
                    });
                    if (response.ok) break;
                } catch (fetchError) {
                    if (retries === 0) throw fetchError;
                }
                retries--;
                if (retries >= 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
                }
            }
            
            if (!response || !response.ok) {
                throw new Error(`Failed to fetch posts: ${response?.status || 'Network error'}`);
            }
            
            const posts = await response.json();
            if (!Array.isArray(posts)) {
                throw new Error('Invalid response format from API');
            }
            
            console.log('[ArticleLoader] Fetched', posts.length, 'posts, looking for articleId:', articleId);
            
            // Find the post - try multiple ID formats
            // Posts can have id as: articleId, post-{articleId}, or stored as postId field
            const post = posts.find(p => {
                // Direct match
                if (p.id === articleId) return true;
                // Match with post- prefix
                if (p.id === `post-${articleId}`) return true;
                // Match postId field if it exists
                if (p.postId === articleId || p.postId === `post-${articleId}`) return true;
                // Match if articleId has post- prefix and p.id doesn't
                if (articleId.startsWith('post-') && p.id === articleId.substring(5)) return true;
                // Match if p.id has post- prefix and articleId doesn't
                if (p.id && p.id.startsWith('post-') && p.id.substring(5) === articleId) return true;
                return false;
            });
            
            if (!post) {
                console.error('[ArticleLoader] Post not found. ArticleId:', articleId);
                console.log('[ArticleLoader] First 5 post IDs:', posts.slice(0, 5).map(p => ({ id: p.id, postId: p.postId, title: (p.title || p.story || p.text || '').substring(0, 50) })));
                headingElement.textContent = 'Article Not Found';
                bodyElement.innerHTML = `<p>Article with ID "${articleId}" not found. Please return to the <a href="/index.html" style="color: #4A90E2;">homepage</a>.</p><p style="margin-top: 1rem; font-size: 0.875rem; color: rgba(255,255,255,0.6);">Debug: Found ${posts.length} posts total.</p>`;
                return;
            }
            
            console.log('[ArticleLoader] Found post:', { id: post.id, postId: post.postId, title: (post.title || post.story || post.text || '').substring(0, 50) });

            // Extract post data
            const title = post.title || post.story || post.text || 'Breaking News Story';
            const story = post.story || post.text || post.title || '';
            const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
            
            // Get image - handle both single image and images array
            // Also handle newsletter images stored as get-uploaded-image URLs
            let image = post.image || post.images?.[0] || null;
            
            // If image is a get-uploaded-image URL, ensure it's absolute
            if (image && image.includes('get-uploaded-image')) {
                if (!image.startsWith('http://') && !image.startsWith('https://')) {
                    // Make relative URL absolute
                    image = image.startsWith('/') ? `${SITE_URL}${image}` : `${SITE_URL}/${image}`;
                }
            }
            
            const category = post.category || 'Breaking News';
            
            // Update SEO meta tags
            updatePostMetaTags(post, articleId);
            
            // Update structured data
            const structuredDataEl = document.getElementById('article-structured-data');
            if (structuredDataEl) {
                const structuredData = {
                    "@context": "https://schema.org",
                    "@type": "NewsArticle",
                    "headline": title,
                    "description": truncateDescription(story),
                    "image": ensureAbsoluteImageUrl(image),
                    "datePublished": datePosted,
                    "dateModified": datePosted,
                    "author": {
                        "@type": "Organization",
                        "name": "Noteworthy News"
                    },
                    "publisher": {
                        "@type": "Organization",
                        "name": "Noteworthy News",
                        "logo": {
                            "@type": "ImageObject",
                            "url": `${SITE_URL}/IMG_5794.PNG`
                        }
                    },
                    "mainEntityOfPage": {
                        "@type": "WebPage",
                        "@id": `${SITE_URL}/article.html?id=${encodeURIComponent(articleId)}`
                    }
                };
                structuredDataEl.textContent = JSON.stringify(structuredData, null, 2);
            }
            
            // Update header
            headingElement.textContent = title;
            document.getElementById('article-date').textContent = formatDate(datePosted);
            document.getElementById('article-read-time').textContent = `${calculateReadTime(story)} min`;
            if (timestampElement) timestampElement.textContent = formatRelativeTime(datePosted);
            if (categoryChip) categoryChip.textContent = category.toUpperCase();
            
            // Update header alert pill and timestamp
            const alertPill = document.getElementById('alert-pill');
            const headerTimestamp = document.getElementById('article-timestamp-header');
            const relativeTime = formatRelativeTime(datePosted);
            
            // Show alert pill for breaking/urgent categories
            const alertCategories = ['BREAKING NEWS', 'VOLCANO ALERT', 'EARTHQUAKE', 'BREAKING', 'ALERT'];
            const shouldShowAlert = alertCategories.some(alertCat => 
                category.toUpperCase().includes(alertCat) || category.toUpperCase() === alertCat
            );
            
            if (alertPill) {
                if (shouldShowAlert) {
                    alertPill.textContent = category.toUpperCase();
                    alertPill.style.display = 'inline-flex';
                } else {
                    alertPill.style.display = 'none';
                }
            }
            
            if (headerTimestamp) {
                headerTimestamp.textContent = relativeTime;
                headerTimestamp.style.display = 'inline-block';
            }
            
            // Update share buttons
            const shareUrl = `${SITE_URL}/article.html?id=${encodeURIComponent(articleId)}`;
            const shareTitle = encodeURIComponent(title);
            const shareText = encodeURIComponent(truncateDescription(story));
            
            const twitterBtn = document.getElementById('share-twitter-btn');
            if (twitterBtn) {
                twitterBtn.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareTitle}`;
            }
            
            // Update article body - PRESERVE EXACT POST TEXT
            let bodyHTML = '';
            
            // Normalize URLs for comparison (remove trailing slashes, query params, etc.)
            const normalizeUrl = (url) => {
                if (!url) return '';
                try {
                    const urlObj = new URL(url.startsWith('http') ? url : ensureAbsoluteImageUrl(url));
                    return urlObj.origin + urlObj.pathname;
                } catch {
                    return url;
                }
            };
            
            // STEP 3: Canonical image resolution (SINGLE SOURCE OF TRUTH)
            const primary = post.primary_image_url || post.image_url || post.image || null;
            
            // STEP 4: Build deduplicated secondary image list (NEVER includes primary)
            const secondaryCandidates = [
                ...(post.secondary_images || []),
                ...(post.images || []),
                ...(post.assets?.images || []),
                ...(post.usgs_images || []),
                ...(post.assets?.usgs_images || [])
            ].filter(Boolean);
            
            // Normalize primary URL for comparison
            const primaryNormalized = primary ? normalizeUrl(ensureAbsoluteImageUrl(primary)) : null;
            
            // Filter out primary and deduplicate
            const secondary = secondaryCandidates
                .map(url => ensureAbsoluteImageUrl(url))
                .filter(url => {
                    const normalized = normalizeUrl(url);
                    return normalized !== primaryNormalized; // Remove primary
                })
                .filter((url, i, arr) => {
                    // Deduplicate by normalized URL
                    const normalized = normalizeUrl(url);
                    return arr.findIndex(u => normalizeUrl(u) === normalized) === i;
                });
            
            console.log('[ArticleLoader] Image resolution:', {
                primary: primary ? primary.substring(0, 80) : null,
                primaryNormalized: primaryNormalized,
                secondaryCount: secondary.length,
                secondary: secondary.map(s => s.substring(0, 80))
            });
            
            // STEP 4: Render images (LOGIC ONLY - NO CSS)
            // Render primary image ONCE if it exists
            if (primary) {
                const absoluteImageUrl = ensureAbsoluteImageUrl(primary);
                // Add error handling for get-uploaded-image URLs that might 404
                const isUploadedImage = absoluteImageUrl.includes('get-uploaded-image');
                const errorHandler = isUploadedImage 
                    ? `this.onerror=null; this.style.display='none'; const parent=this.parentElement; if(parent && !parent.querySelector('.image-error')) { parent.innerHTML='<p class=\\'image-error\\' style=\\'color: rgba(255,255,255,0.5); padding: 1rem; text-align: center; font-size: 0.875rem;\\'>Image unavailable</p>'; }`
                    : `this.style.display='none'; this.parentElement.innerHTML='<p style=\\'color: rgba(255,255,255,0.6); padding: 2rem; text-align: center;\\'>Image could not be loaded</p>';`;
                
                bodyHTML += `<div class="article-media">
                    <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.onerror=null; this.style.display='none'; const p=this.parentElement; if(p && !p.querySelector('.image-error')) { p.innerHTML='<p class=\\'image-error\\' style=\\'color: rgba(255,255,255,0.4); padding: 0.5rem; text-align: center; font-size: 0.8125rem; margin: 0;\\'>Image unavailable</p>'; }">
                </div>`;
            }
            
            // Render secondary images ONLY if they exist and are different from primary
            if (secondary.length > 0) {
                secondary.forEach((imgUrl, idx) => {
                    const absoluteImageUrl = ensureAbsoluteImageUrl(imgUrl);
                    const isUploadedImage = absoluteImageUrl.includes('get-uploaded-image');
                    const errorHandler = isUploadedImage
                        ? `this.onerror=null; this.style.display='none';`
                        : `this.style.display='none';`;
                    
                    bodyHTML += `<div class="article-media" style="margin-top: 1.5rem;">
                        <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)} - Image ${idx + 2}" loading="lazy" onerror="${errorHandler}">
                    </div>`;
                });
            }
            
            // Add post text - preserve line breaks as paragraphs
            bodyHTML += formatPostText(story);
            
            // Check if this is an earthquake post and add enhanced content
            const isEarthquake = post.event_type === 'earthquake' || post.category === 'Earthquake' || post.category === 'EARTHQUAKE';
            const hasCoordinates = post.lat && post.lon;
            const magnitude = post.assets?.magnitude || post.magnitude;
            
            if (isEarthquake && hasCoordinates) {
                // Add earthquake-specific enhancements
                bodyHTML += await generateEarthquakeEnhancements(post, magnitude);
            }
            
            bodyElement.innerHTML = bodyHTML;
            
            // Initialize earthquake map and 3D visualization if it exists (after DOM update)
            if (isEarthquake && hasCoordinates) {
                // Use setTimeout to ensure DOM is fully updated
                setTimeout(() => {
                    initializeEarthquakeMap(post.lat, post.lon, magnitude, post.location_display || post.location);
                    const depth = post.assets?.depth || post.depth;
                    initialize3DVisualization(post.lat, post.lon, magnitude, depth, post.location_display || post.location);
                }, 100);
            }
            
            // Initialize comments
            const commentsContainer = document.getElementById('article-comments');
            if (commentsContainer) {
                commentsContainer.setAttribute('data-article-id', articleId);
                // Ensure comment section container exists
                if (!commentsContainer.querySelector('.comment-section')) {
                    const commentSectionDiv = document.createElement('div');
                    commentSectionDiv.className = 'comment-section';
                    commentSectionDiv.setAttribute('data-article-id', articleId);
                    commentsContainer.appendChild(commentSectionDiv);
                }
                
                // Initialize comment section
                const initComments = () => {
                    if (window.CommentSection) {
                        if (!window.commentSections) {
                            window.commentSections = {};
                        }
                        // Only initialize if not already initialized
                        if (!window.commentSections[articleId]) {
                            window.commentSections[articleId] = new window.CommentSection(articleId);
                        }
                    } else {
                        // Wait for CommentSection to load
                        setTimeout(initComments, 200);
                    }
                };
                
                initComments();
            }
            
            // Load sidebar content
            await loadSidebarContent(posts, post, articleId);
            
            // Load more coverage
            loadMoreCoverage(posts, articleId);
            
        } catch (error) {
            console.error('[ArticleLoader] Error loading article:', error);
            if (headingElement) headingElement.textContent = 'Error Loading Article';
            if (bodyElement) {
                const errorMessage = error.message || 'An unknown error occurred';
                const isNetworkError = errorMessage.includes('Network') || errorMessage.includes('Failed to fetch');
                
                bodyElement.innerHTML = `
                    <div style="text-align: center; padding: 40px; background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 12px; margin: 20px 0;">
                        <h3 style="color: #E74C3C; margin-bottom: 15px;">Unable to Load Article</h3>
                        <p style="color: rgba(255, 255, 255, 0.8); margin-bottom: 20px;">
                            ${isNetworkError 
                                ? 'We\'re having trouble connecting to our servers. Please check your internet connection and try again.' 
                                : 'An error occurred while loading this article. Please try again later.'}
                        </p>
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <a href="/index.html" style="display: inline-block; padding: 10px 20px; background: #4A90E2; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Return to Homepage</a>
                            <button onclick="location.reload()" style="padding: 10px 20px; background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; cursor: pointer; font-weight: 600;">Retry</button>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * Load sidebar content (Latest and Related)
     */
    async function loadSidebarContent(allPosts, currentPost, currentId) {
        // Load NewsCard component if available
        if (!window.NewsCard) {
            const script = document.createElement('script');
            script.src = '/src/components/news-card.js';
            document.head.appendChild(script);
            await new Promise(resolve => {
                script.onload = resolve;
                setTimeout(resolve, 1000); // Fallback timeout
            });
        }
        
        // Latest articles (5-8 newest, excluding current)
        const latest = allPosts
            .filter(p => {
                const id = p.id || '';
                return id !== currentId && id !== `post-${currentId}` && (p.story || p.text || p.title);
            })
            .sort((a, b) => {
                const dateA = new Date(a.datePosted || a.createdAt || a.created_at || 0).getTime();
                const dateB = new Date(b.datePosted || b.createdAt || b.created_at || 0).getTime();
                return dateB - dateA;
            })
            .slice(0, 8);
        
        if (window.NewsCard && window.NewsCard.render) {
            window.NewsCard.render(latest, '#latest-articles', { showThumbnail: false });
        }
        
        // Related articles using algorithm
        const related = findRelatedArticles(allPosts, currentPost, currentId, 6);
        
        if (related.length === 0) {
            // Fallback to latest if no related found
            const fallback = latest.slice(0, 6);
            if (window.NewsCard && window.NewsCard.render) {
                window.NewsCard.render(fallback, '#related-articles', { showThumbnail: false });
            }
        } else {
            if (window.NewsCard && window.NewsCard.render) {
                window.NewsCard.render(related, '#related-articles', { showThumbnail: false });
            }
        }
    }

    /**
     * Load more coverage section
     */
    function loadMoreCoverage(allPosts, currentId) {
        const more = allPosts
            .filter(p => {
                const id = p.id || '';
                return id !== currentId && id !== `post-${currentId}` && (p.story || p.text || p.title);
            })
            .sort((a, b) => {
                const dateA = new Date(a.datePosted || a.createdAt || a.created_at || 0).getTime();
                const dateB = new Date(b.datePosted || b.createdAt || b.created_at || 0).getTime();
                return dateB - dateA;
            })
            .slice(0, 6);
        
        if (window.NewsCard && window.NewsCard.render) {
            window.NewsCard.render(more, '#more-coverage-grid', { showThumbnail: true, maxTitleLength: 60 });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadArticle);
    } else {
        loadArticle();
    }
})();
