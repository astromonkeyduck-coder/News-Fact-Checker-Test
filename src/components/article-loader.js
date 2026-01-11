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
     * Get earthquake hashtags in Spanish, Japanese, and location-relevant language
     */
    function getEarthquakeHashtags(location) {
        if (!location) return '#terremoto #地震';
        
        const locationLower = location.toLowerCase();
        
        // Language mapping based on location
        const languageMap = {
            // Spanish-speaking countries/regions
            'mexico': { tag: '#terremoto', lang: 'Spanish' },
            'méxico': { tag: '#terremoto', lang: 'Spanish' },
            'spain': { tag: '#terremoto', lang: 'Spanish' },
            'españa': { tag: '#terremoto', lang: 'Spanish' },
            'chile': { tag: '#terremoto', lang: 'Spanish' },
            'peru': { tag: '#terremoto', lang: 'Spanish' },
            'perú': { tag: '#terremoto', lang: 'Spanish' },
            'colombia': { tag: '#terremoto', lang: 'Spanish' },
            'argentina': { tag: '#terremoto', lang: 'Spanish' },
            'ecuador': { tag: '#terremoto', lang: 'Spanish' },
            'guatemala': { tag: '#terremoto', lang: 'Spanish' },
            'honduras': { tag: '#terremoto', lang: 'Spanish' },
            'nicaragua': { tag: '#terremoto', lang: 'Spanish' },
            'el salvador': { tag: '#terremoto', lang: 'Spanish' },
            'costa rica': { tag: '#terremoto', lang: 'Spanish' },
            'panama': { tag: '#terremoto', lang: 'Spanish' },
            'panamá': { tag: '#terremoto', lang: 'Spanish' },
            'venezuela': { tag: '#terremoto', lang: 'Spanish' },
            'bolivia': { tag: '#terremoto', lang: 'Spanish' },
            'paraguay': { tag: '#terremoto', lang: 'Spanish' },
            'uruguay': { tag: '#terremoto', lang: 'Spanish' },
            'dominican republic': { tag: '#terremoto', lang: 'Spanish' },
            'puerto rico': { tag: '#terremoto', lang: 'Spanish' },
            'california': { tag: '#terremoto', lang: 'Spanish' }, // High Spanish-speaking population
            
            // Japanese regions
            'japan': { tag: '#地震', lang: 'Japanese' },
            'tokyo': { tag: '#地震', lang: 'Japanese' },
            'osaka': { tag: '#地震', lang: 'Japanese' },
            'kyoto': { tag: '#地震', lang: 'Japanese' },
            'hokkaido': { tag: '#地震', lang: 'Japanese' },
            'okinawa': { tag: '#地震', lang: 'Japanese' },
            
            // Chinese-speaking regions
            'china': { tag: '#地震', lang: 'Chinese' },
            'taiwan': { tag: '#地震', lang: 'Chinese' },
            'hong kong': { tag: '#地震', lang: 'Chinese' },
            'beijing': { tag: '#地震', lang: 'Chinese' },
            'shanghai': { tag: '#地震', lang: 'Chinese' },
            
            // French-speaking regions
            'france': { tag: '#séisme', lang: 'French' },
            'haiti': { tag: '#séisme', lang: 'French' },
            'quebec': { tag: '#séisme', lang: 'French' },
            
            // Portuguese-speaking regions
            'brazil': { tag: '#terremoto', lang: 'Portuguese' },
            'brasil': { tag: '#terremoto', lang: 'Portuguese' },
            'portugal': { tag: '#terremoto', lang: 'Portuguese' },
            
            // Italian
            'italy': { tag: '#terremoto', lang: 'Italian' },
            'italia': { tag: '#terremoto', lang: 'Italian' },
            
            // Turkish
            'turkey': { tag: '#deprem', lang: 'Turkish' },
            'türkiye': { tag: '#deprem', lang: 'Turkish' },
            
            // Greek
            'greece': { tag: '#σεισμός', lang: 'Greek' },
            
            // Indonesian
            'indonesia': { tag: '#gempa', lang: 'Indonesian' },
            'jakarta': { tag: '#gempa', lang: 'Indonesian' },
            
            // Filipino
            'philippines': { tag: '#lindol', lang: 'Filipino' },
            'manila': { tag: '#lindol', lang: 'Filipino' },
            
            // Arabic
            'saudi arabia': { tag: '#زلزال', lang: 'Arabic' },
            'uae': { tag: '#زلزال', lang: 'Arabic' },
            'egypt': { tag: '#زلزال', lang: 'Arabic' },
            
            // Russian
            'russia': { tag: '#землетрясение', lang: 'Russian' },
            'moscow': { tag: '#землетрясение', lang: 'Russian' },
            
            // Korean
            'south korea': { tag: '#지진', lang: 'Korean' },
            'korea': { tag: '#지진', lang: 'Korean' },
            'seoul': { tag: '#지진', lang: 'Korean' },
            
            // Hindi/Urdu
            'india': { tag: '#भूकंप', lang: 'Hindi' },
            'pakistan': { tag: '#زلزلہ', lang: 'Urdu' },
            
            // Vietnamese
            'vietnam': { tag: '#độngđất', lang: 'Vietnamese' },
            
            // Thai
            'thailand': { tag: '#แผ่นดินไหว', lang: 'Thai' },
            'bangkok': { tag: '#แผ่นดินไหว', lang: 'Thai' }
        };
        
        // Find matching language
        let relevantTag = null;
        for (const [key, value] of Object.entries(languageMap)) {
            if (locationLower.includes(key)) {
                relevantTag = value.tag;
                break;
            }
        }
        
        // Default: Spanish, Japanese, and English
        const hashtags = ['#terremoto', '#地震'];
        if (relevantTag && !hashtags.includes(relevantTag)) {
            hashtags.push(relevantTag);
        } else if (!relevantTag) {
            // Default to English if no match
            hashtags.push('#earthquake');
        }
        
        return hashtags.join(' ');
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
        // Prioritize primary_image_url (generated earthquake images) over other image fields
        const image = ensureAbsoluteImageUrl(
            post.primary_image_url || 
            post.image_url || 
            post.image || 
            post.images?.[0] || 
            null
        );
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

        // For earthquakes, format title as "BREAKING: M___ Earthquake Near ___. #hashtags"
        const isEarthquake = post.category === 'Earthquake' || post.event_type === 'earthquake' || post.source === 'USGS';
        let formattedTitle = title;
        if (isEarthquake && post.magnitude && (post.location_display || post.location)) {
            const magnitudeFormatted = typeof post.magnitude === 'number' ? post.magnitude.toFixed(1) : post.magnitude;
            const location = post.location_display || post.location;
            const hashtags = getEarthquakeHashtags(location);
            formattedTitle = `BREAKING: M${magnitudeFormatted} Earthquake Near ${location}. ${hashtags}`;
        }

        // Open Graph
        getOrCreateMeta('og:url').setAttribute('content', url);
        getOrCreateMeta('og:title').setAttribute('content', formattedTitle);
        getOrCreateMeta('og:description').setAttribute('content', description);
        getOrCreateMeta('og:image').setAttribute('content', image);
        getOrCreateMeta('og:image:width').setAttribute('content', '1200');
        getOrCreateMeta('og:image:height').setAttribute('content', '630');
        getOrCreateMeta('og:site_name').setAttribute('content', 'Noteworthy News');
        getOrCreateMeta('og:locale').setAttribute('content', 'en_US');
        getOrCreateMeta('og:type').setAttribute('content', 'article');
        getOrCreateMeta('article:published_time').setAttribute('content', datePosted);
        getOrCreateMeta('article:author').setAttribute('content', 'Noteworthy News');

        // Check if video is available for Player Card
        const videoUrl = post.video_url || post.video || null;
        const hasVideo = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('.mp4') || videoUrl.includes('video') || videoUrl.includes('get-uploaded-image'));
        const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));
        
        // For GIFs, use the GIF URL directly as the image for social previews
        let socialImage = image;
        if (isGIF && videoUrl) {
            socialImage = ensureAbsoluteImageUrl(videoUrl);
        }
        
        // Update og:image to use GIF if available
        getOrCreateMeta('og:image').setAttribute('content', socialImage);
        
        if (hasVideo && !isGIF) {
            // Use Player Card for non-GIF videos (MP4, etc.)
            const playerUrl = `${SITE_URL}/video-player.html?url=${encodeURIComponent(ensureAbsoluteImageUrl(videoUrl))}`;
            
            // Open Graph Video
            getOrCreateMeta('og:video').setAttribute('content', playerUrl);
            getOrCreateMeta('og:video:url').setAttribute('content', playerUrl);
            getOrCreateMeta('og:video:secure_url').setAttribute('content', playerUrl);
            getOrCreateMeta('og:video:type').setAttribute('content', 'text/html');
            getOrCreateMeta('og:video:width').setAttribute('content', '1280');
            getOrCreateMeta('og:video:height').setAttribute('content', '720');
            
            // Twitter Player Card
            getOrCreateMeta('twitter:card', 'name').setAttribute('content', 'player');
            getOrCreateMeta('twitter:player', 'name').setAttribute('content', playerUrl);
            getOrCreateMeta('twitter:player:width', 'name').setAttribute('content', '1280');
            getOrCreateMeta('twitter:player:height', 'name').setAttribute('content', '720');
            getOrCreateMeta('twitter:image', 'name').setAttribute('content', socialImage);
        } else {
            // Use summary_large_image for images and GIFs
            getOrCreateMeta('twitter:card', 'name').setAttribute('content', 'summary_large_image');
            getOrCreateMeta('twitter:image', 'name').setAttribute('content', socialImage);
        }
        
        getOrCreateMeta('twitter:url', 'name').setAttribute('content', url);
        getOrCreateMeta('twitter:title', 'name').setAttribute('content', formattedTitle);
        getOrCreateMeta('twitter:description', 'name').setAttribute('content', description);
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
     * Generate professional SVG icon
     */
    function getIconSVG(iconType, size = 20, color = 'currentColor') {
        const icons = {
            location: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
            chart: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
            wave: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c.6.4 1.2.8 2 1 1.1.2 2.2.2 3.2 0 .8-.2 1.4-.6 2-1 .6.4 1.2.8 2 1 1.1.2 2.2.2 3.2 0 .8-.2 1.4-.6 2-1 .6.4 1.2.8 2 1 1.1.2 2.2.2 3.2 0 .8-.2 1.4-.6 2-1"></path><path d="M2 16c.6.4 1.2.8 2 1 1.1.2 2.2.2 3.2 0 .8-.2 1.4-.6 2-1 .6.4 1.2.8 2 1 1.1.2 2.2.2 3.2 0 .8-.2 1.4-.6 2-1 .6.4 1.2.8 2 1 1.1.2 2.2.2 3.2 0 .8-.2 1.4-.6 2-1"></path></svg>`,
            document: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
            dollar: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
            globe: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
            play: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
            warning: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
            lightbulb: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6"></path><path d="M12 3a6 6 0 0 0 0 12c1.657 0 3-1.343 3-3V9a3 3 0 0 0-3-3 3 3 0 0 0-3 3v3c0 1.657 1.343 3 3 3z"></path></svg>`,
            city: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><line x1="9" y1="9" x2="9" y2="9"></line><line x1="9" y1="12" x2="9" y2="12"></line><line x1="9" y1="15" x2="9" y2="15"></line><line x1="9" y1="18" x2="9" y2="18"></line></svg>`
        };
        return icons[iconType] || '';
    }
    
    /**
     * Generate earthquake-specific enhancements (location details, nearby places, assessments, etc.)
     */
    async function generateEarthquakeEnhancements(post, magnitude) {
        // Get coordinates from multiple possible locations
        const lat = post.lat || post.raw?.geometry?.coordinates?.[1] || post.assets?.lat || null;
        const lon = post.lon || post.raw?.geometry?.coordinates?.[0] || post.assets?.lon || null;
        const locationDisplay = post.location_display || post.location || 'Unknown Location';
        const locationEnglishName = post.location_english_name || post.assets?.location_english_name || null;
        const magnitudeFormatted = magnitude ? magnitude.toFixed(1) : 'N/A';
        const depth = post.assets?.depth || post.depth || post.raw?.geometry?.coordinates?.[2] || null;
        const depthFormatted = depth ? `${depth.toFixed(1)} km` : null;
        
        // Extract assessment data
        const impactAssessment = post.assets?.impact_assessment || null;
        const tsunamiAssessment = post.assets?.tsunami_assessment || null;
        const aftershockForecast = post.assets?.aftershock_forecast || null;
        const anomalyDetection = post.assets?.anomaly_detection || null;
        
        let html = '';
        
        // Add interactive map container (only if we have coordinates)
        if (lat && lon) {
            html += `
                <div class="earthquake-map-container" style="margin: 2rem 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <div id="earthquake-interactive-map" style="width: 100%; height: 500px; background: #f0f0f0;"></div>
                </div>
            `;
        }
        
        // Add location details section
        html += `
            <div class="earthquake-details-section" style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="display: inline-flex; align-items: center; color: #4A9EFF;">${getIconSVG('location', 24, '#4A9EFF')}</span>
                    Location Details
                </h2>
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
                    ${lat && lon ? `
                    <div class="detail-card" style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Coordinates</div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #fff; font-family: 'Courier New', monospace;">${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}</div>
                    </div>
                    ` : ''}
                    <div class="detail-card" style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">Location</div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #fff;">
                            ${escapeHtml(locationDisplay)}
                            ${locationEnglishName && locationEnglishName !== locationDisplay ? `
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-top: 0.25rem; font-weight: 400;">
                                    ${escapeHtml(locationEnglishName)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add comprehensive tier breakdown section
        const tierBreakdown = impactAssessment ? {
            tier1: impactAssessment.riskScore >= 80 ? 'CRITICAL' : impactAssessment.riskScore >= 60 ? 'HIGH' : impactAssessment.riskScore >= 40 ? 'MODERATE' : 'LOW',
            tier2: impactAssessment.affectedPopulation > 1000000 ? 'CRITICAL' : impactAssessment.affectedPopulation > 100000 ? 'HIGH' : impactAssessment.affectedPopulation > 10000 ? 'MODERATE' : 'LOW',
            tier3: impactAssessment.populationDensity > 1000 ? 'HIGH' : impactAssessment.populationDensity > 100 ? 'MODERATE' : 'LOW',
        } : null;
        
        // Add impact assessment section (always show if available)
        if (impactAssessment) {
            const severityColor = impactAssessment.severity === 'CRITICAL' ? '#d32f2f' : 
                                 impactAssessment.severity === 'HIGH' ? '#f57c00' : 
                                 impactAssessment.severity === 'MODERATE' ? '#fbc02d' : '#388e3c';
            html += `
                <div id="impact-assessment" class="impact-assessment-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%); border-radius: 12px; border-left: 4px solid ${severityColor}; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: ${severityColor};">${getIconSVG('chart', 24, severityColor)}</span>
                        AI Impact Assessment
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Risk Score</div>
                            <div style="font-size: 2.5rem; font-weight: 700; color: ${severityColor}; line-height: 1;">${impactAssessment.riskScore || 0}/100</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem; font-weight: 600;">${impactAssessment.severity || 'UNKNOWN'}</div>
                        </div>
                        ${impactAssessment.affectedPopulation ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Affected Population</div>
                            <div style="font-size: 2rem; font-weight: 700; color: #fff; line-height: 1;">
                                ${impactAssessment.affectedPopulation >= 1000000 ? (impactAssessment.affectedPopulation / 1000000).toFixed(2) + 'M' : 
                                  impactAssessment.affectedPopulation >= 1000 ? (impactAssessment.affectedPopulation / 1000).toFixed(1) + 'K' : 
                                  impactAssessment.affectedPopulation.toLocaleString()}
                            </div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">people potentially affected</div>
                        </div>
                        ` : ''}
                        ${impactAssessment.populationDensity ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Population Density</div>
                            <div style="font-size: 2rem; font-weight: 700; color: #4A90E2; line-height: 1;">${impactAssessment.populationDensity.toFixed(0)}</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">people per km²</div>
                        </div>
                        ` : ''}
                        ${impactAssessment.affectedRadius ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Affected Radius</div>
                            <div style="font-size: 2rem; font-weight: 700; color: #fff; line-height: 1;">${impactAssessment.affectedRadius.toFixed(1)}</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">kilometers</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${impactAssessment.nearbyCities && impactAssessment.nearbyCities.length > 0 ? `
                    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 0.5rem;">
                            <span style="display: inline-flex; align-items: center; color: #4A90E2;">${getIconSVG('location', 20, '#4A90E2')}</span>
                            Nearby Cities & Population
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
                            ${impactAssessment.nearbyCities.slice(0, 8).map(city => `
                                <div style="padding: 0.875rem; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 3px solid #4A90E2;">
                                    <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem; font-size: 0.9375rem;">${escapeHtml(city.name || 'Unknown')}</div>
                                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">
                                        ${city.population ? city.population.toLocaleString() + ' people' : 'Population data unavailable'}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${impactAssessment.criticalInfrastructure ? `
                    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 0.5rem;">
                            <span style="display: inline-flex; align-items: center; color: #f57c00;">${getIconSVG('building', 20, '#f57c00')}</span>
                            Critical Infrastructure at Risk
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 2rem; font-weight: 700; color: #e74c3c; margin-bottom: 0.25rem;">${impactAssessment.criticalInfrastructure.hospitals || 0}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Hospitals</div>
                            </div>
                            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 2rem; font-weight: 700; color: #3498db; margin-bottom: 0.25rem;">${impactAssessment.criticalInfrastructure.schools || 0}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Schools</div>
                            </div>
                            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 2rem; font-weight: 700; color: #9b59b6; margin-bottom: 0.25rem;">${impactAssessment.criticalInfrastructure.airports || 0}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Airports</div>
                            </div>
                            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 2rem; font-weight: 700; color: #f39c12; margin-bottom: 0.25rem;">${impactAssessment.criticalInfrastructure.powerPlants || 0}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Power Plants</div>
                            </div>
                            ${impactAssessment.criticalInfrastructure.dams ? `
                            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 2rem; font-weight: 700; color: #1abc9c; margin-bottom: 0.25rem;">${impactAssessment.criticalInfrastructure.dams || 0}</div>
                                <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;">Dams</div>
                            </div>
                            ` : ''}
                        </div>
                        ${impactAssessment.criticalInfrastructure.details && (impactAssessment.criticalInfrastructure.details.hospitals?.length > 0 || impactAssessment.criticalInfrastructure.details.schools?.length > 0) ? `
                        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 0.875rem; color: rgba(255,255,255,0.7);">
                            <strong style="color: rgba(255,255,255,0.9);">Note:</strong> Infrastructure data is based on OpenStreetMap and may not be complete. Always follow official emergency guidance.
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Add tsunami risk section
        if (tsunamiAssessment && tsunamiAssessment.riskLevel !== 'LOW') {
            const riskColor = tsunamiAssessment.riskLevel === 'HIGH' ? '#d32f2f' : '#f57c00';
            html += `
                <div class="tsunami-risk-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(255,152,0,0.1) 0%, rgba(255,152,0,0.05) 100%); border-radius: 12px; border-left: 4px solid ${riskColor};">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: ${riskColor};">${getIconSVG('wave', 24, riskColor)}</span>
                        Tsunami Risk Assessment
                    </h2>
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
        
        // Add aftershock forecast section (always show if available)
        if (aftershockForecast) {
            const probabilityColor = aftershockForecast.probability24h >= 70 ? '#d32f2f' : 
                                   aftershockForecast.probability24h >= 40 ? '#f57c00' : 
                                   aftershockForecast.probability24h >= 20 ? '#fbc02d' : '#388e3c';
            html += `
                <div class="aftershock-forecast-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(156,39,176,0.15) 0%, rgba(156,39,176,0.05) 100%); border-radius: 12px; border-left: 4px solid #9c27b0; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: #9c27b0;">${getIconSVG('chart', 24, '#9c27b0')}</span>
                        AI Aftershock Forecast
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">24 Hour Probability</div>
                            <div style="font-size: 2rem; font-weight: 700; color: ${probabilityColor}; line-height: 1;">${aftershockForecast.probability24h || 0}%</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">chance of aftershocks</div>
                        </div>
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Expected Largest</div>
                            <div style="font-size: 2rem; font-weight: 700; color: #9c27b0; line-height: 1;">M${(aftershockForecast.expectedLargestAftershock || 0).toFixed(1)}</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">magnitude estimate</div>
                        </div>
                        ${aftershockForecast.probability48h !== undefined ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">48 Hour Probability</div>
                            <div style="font-size: 2rem; font-weight: 700; color: #9c27b0; line-height: 1;">${aftershockForecast.probability48h}%</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">chance of aftershocks</div>
                        </div>
                        ` : ''}
                        ${aftershockForecast.probability7d !== undefined ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">7 Day Probability</div>
                            <div style="font-size: 2rem; font-weight: 700; color: #9c27b0; line-height: 1;">${aftershockForecast.probability7d}%</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem;">chance of aftershocks</div>
                        </div>
                        ` : ''}
                    </div>
                    ${aftershockForecast.forecast ? `
                    <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 1rem; font-size: 0.875rem; color: rgba(255,255,255,0.9); line-height: 1.6;">
                        ${aftershockForecast.forecast}
                    </div>
                    ` : ''}
                    ${aftershockForecast.recommendation ? `
                    <div style="padding: 1rem; background: rgba(156,39,176,0.2); border-radius: 8px; border-left: 3px solid #9c27b0;">
                        <div style="font-size: 0.875rem; color: rgba(255,255,255,0.95);">
                            <span style="display: inline-flex; align-items: center; gap: 0.5rem; vertical-align: middle;">
                                <span style="display: inline-flex; align-items: center; color: #9c27b0;">${getIconSVG('lightbulb', 18, '#9c27b0')}</span>
                                <strong style="color: #fff;">AI Recommendation:</strong> ${aftershockForecast.recommendation}
                            </span>
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
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: ${anomalyColor};">${getIconSVG('warning', 24, anomalyColor)}</span>
                        Anomaly Detection
                    </h2>
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
        
        // Add comprehensive Tier Breakdown section (if we have impact assessment)
        if (impactAssessment && tierBreakdown) {
            html += `
                <div class="tier-breakdown-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(33,150,243,0.05) 100%); border-radius: 12px; border-left: 4px solid #2196f3; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: #2196f3;">${getIconSVG('chart', 24, '#2196f3')}</span>
                        Risk Tier Breakdown
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Overall Risk</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${impactAssessment.severity === 'CRITICAL' ? '#d32f2f' : impactAssessment.severity === 'HIGH' ? '#f57c00' : impactAssessment.severity === 'MODERATE' ? '#fbc02d' : '#388e3c'};">
                                ${impactAssessment.severity || 'UNKNOWN'}
                            </div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-top: 0.5rem;">Based on multiple factors</div>
                        </div>
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Population Risk</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${tierBreakdown.tier2 === 'CRITICAL' ? '#d32f2f' : tierBreakdown.tier2 === 'HIGH' ? '#f57c00' : tierBreakdown.tier2 === 'MODERATE' ? '#fbc02d' : '#388e3c'};">
                                ${tierBreakdown.tier2}
                            </div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-top: 0.5rem;">${impactAssessment.affectedPopulation ? (impactAssessment.affectedPopulation >= 1000000 ? (impactAssessment.affectedPopulation / 1000000).toFixed(2) + 'M' : (impactAssessment.affectedPopulation / 1000).toFixed(1) + 'K') : 'N/A'} people</div>
                        </div>
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Density Risk</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: ${tierBreakdown.tier3 === 'HIGH' ? '#f57c00' : tierBreakdown.tier3 === 'MODERATE' ? '#fbc02d' : '#388e3c'};">
                                ${tierBreakdown.tier3}
                            </div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-top: 0.5rem;">${impactAssessment.populationDensity ? impactAssessment.populationDensity.toFixed(0) + '/km²' : 'N/A'}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Add Economic Impact section (if available)
        if (impactAssessment?.economicImpact && impactAssessment.economicImpact.estimatedGDP) {
            const economic = impactAssessment.economicImpact;
            html += `
                <div class="economic-impact-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(76,175,80,0.05) 100%); border-radius: 12px; border-left: 4px solid #4caf50;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: #4caf50;">${getIconSVG('dollar', 24, '#4caf50')}</span>
                        Economic Impact Assessment
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        ${economic.estimatedGDP ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">Estimated GDP Affected</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #4caf50;">$${(economic.estimatedGDP / 1000000000).toFixed(2)}B</div>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.25rem;">${economic.country || 'Region'}</div>
                        </div>
                        ` : ''}
                        ${economic.gdpPerCapita ? `
                        <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">GDP Per Capita</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #4caf50;">$${economic.gdpPerCapita.toLocaleString()}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // Add Historical Context section (if available)
        if (impactAssessment?.historicalComparison && impactAssessment.historicalComparison.count > 0) {
            const historical = impactAssessment.historicalComparison;
            html += `
                <div class="historical-context-section" style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(33,150,243,0.1) 0%, rgba(33,150,243,0.05) 100%); border-radius: 12px; border-left: 4px solid #2196f3;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center; color: #2196f3;">${getIconSVG('document', 24, '#2196f3')}</span>
                        Historical Context
                    </h2>
                    <div style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-bottom: 1rem; line-height: 1.6;">
                        ${historical.count} similar earthquake${historical.count !== 1 ? 's' : ''} recorded in this region historically.
                    </div>
                    ${historical.largest ? `
                    <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem;">Largest Historical Event</div>
                        <div style="font-size: 1.125rem; font-weight: 700; color: #2196f3;">M${historical.largest.magnitude?.toFixed(1) || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-top: 0.25rem;">${historical.largest.date ? new Date(historical.largest.date).toLocaleDateString() : 'Date unknown'}</div>
                    </div>
                    ` : ''}
                    ${historical.similar && historical.similar.length > 0 ? `
                    <div style="margin-top: 1rem;">
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Similar Events (within 0.5 magnitude)</div>
                        <div style="display: grid; gap: 0.5rem;">
                            ${historical.similar.slice(0, 3).map(eq => `
                                <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid #2196f3;">
                                    <div style="font-size: 0.875rem; font-weight: 600; color: #fff;">M${eq.magnitude?.toFixed(1) || 'N/A'}</div>
                                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">${eq.date ? new Date(eq.date).toLocaleDateString() : 'Date unknown'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Add 3D visualization container with enhanced features
        html += `
            <div class="earthquake-3d-container" style="margin: 2rem 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); background: rgba(0,0,0,0.3);">
                <div style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #fff; font-size: 1.125rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center;">${getIconSVG('globe', 20, '#fff')}</span>
                        Interactive 3D Visualization
                    </h3>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8);">Drag to rotate • Scroll to zoom</div>
                </div>
                <div id="earthquake-3d-viewer" style="width: 100%; height: 600px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); position: relative;">
                    <div style="position: absolute; top: 10px; right: 10px; z-index: 10; background: rgba(0,0,0,0.7); padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.75rem; color: rgba(255,255,255,0.9);">
                        Epicenter: ${lat?.toFixed(4) || 'N/A'}°N, ${lon?.toFixed(4) || 'N/A'}°E
                        ${depth ? ` • Depth: ${depth.toFixed(1)} km` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Add animation section placeholder (will be populated if animation exists)
        html += `
            <div id="earthquake-animation-section" style="margin: 2rem 0; display: none;">
                <div style="padding: 1rem; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px 12px 0 0;">
                    <h3 style="margin: 0; color: #fff; font-size: 1.125rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="display: inline-flex; align-items: center;">${getIconSVG('play', 20, '#fff')}</span>
                        Shake Intensity Animation
                    </h3>
                </div>
                <div id="earthquake-animation-container" style="width: 100%; background: rgba(0,0,0,0.3); border-radius: 0 0 12px 12px; padding: 1rem; text-align: center;">
                    <img id="earthquake-animation-img" src="" alt="Earthquake shake intensity animation" style="max-width: 100%; border-radius: 8px; display: none;">
                </div>
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
            
            // Create Earth sphere with texture (if available, otherwise use gradient material)
            const earthGeometry = new window.THREE.SphereGeometry(5, 64, 64);
            const earthMaterial = new window.THREE.MeshPhongMaterial({ 
                color: 0x2233ff,
                emissive: 0x112244,
                shininess: 100,
                specular: 0x222222
            });
            const earth = new window.THREE.Mesh(earthGeometry, earthMaterial);
            scene.add(earth);
            
            // Add subtle grid lines for reference
            const gridHelper = new window.THREE.GridHelper(20, 20, 0x444444, 0x222222);
            scene.add(gridHelper);
            
            // Calculate position on sphere (convert lat/lon to 3D coordinates)
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);
            const radius = 5.2;
            const x = -radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            
            // Create epicenter marker (pulsing sphere) - size scales with magnitude
            const epicenterSize = Math.min(0.2 + (magnitude / 20), 0.5);
            const epicenterGeometry = new window.THREE.SphereGeometry(epicenterSize, 32, 32);
            const epicenterMaterial = new window.THREE.MeshPhongMaterial({ 
                color: 0xff0000,
                emissive: 0xff4444,
                transparent: true,
                opacity: 0.95
            });
            const epicenter = new window.THREE.Mesh(epicenterGeometry, epicenterMaterial);
            epicenter.position.set(x, y, z);
            scene.add(epicenter);
            
            // Add multiple pulsing rings for visual impact
            for (let i = 0; i < 3; i++) {
                const ringSize = epicenterSize * (1.5 + i * 0.5);
                const ringGeometry = new window.THREE.RingGeometry(ringSize, ringSize + 0.1, 32);
                const ringMaterial = new window.THREE.MeshBasicMaterial({ 
                    color: 0xff0000,
                    side: window.THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.3 - (i * 0.1)
                });
                const ring = new window.THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.set(x, y, z);
                ring.lookAt(0, 0, 0);
                ring.userData.pulseOffset = i * 0.3;
                scene.add(ring);
            }
            
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
            
            // Position camera with better initial view
            camera.position.set(15, 10, 15);
            camera.lookAt(x, y, z);
            
            // Add orbit controls for interactivity
            let isDragging = false;
            let previousMousePosition = { x: 0, y: 0 };
            let cameraDistance = 20;
            
            container.addEventListener('mousedown', (e) => {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });
            
            container.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.clientX - previousMousePosition.x;
                    const deltaY = e.clientY - previousMousePosition.y;
                    
                    // Rotate camera around epicenter using spherical coordinates
                    const direction = new window.THREE.Vector3();
                    direction.subVectors(camera.position, new window.THREE.Vector3(x, y, z));
                    const radius = direction.length();
                    
                    // Convert to spherical coordinates manually
                    const theta = Math.atan2(direction.z, direction.x);
                    const phi = Math.acos(direction.y / radius);
                    
                    const newTheta = theta - deltaX * 0.01;
                    const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + deltaY * 0.01));
                    
                    // Convert back to Cartesian
                    camera.position.x = x + radius * Math.sin(newPhi) * Math.cos(newTheta);
                    camera.position.y = y + radius * Math.cos(newPhi);
                    camera.position.z = z + radius * Math.sin(newPhi) * Math.sin(newTheta);
                    
                    camera.lookAt(x, y, z);
                    
                    previousMousePosition = { x: e.clientX, y: e.clientY };
                }
            });
            
            container.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                cameraDistance += e.deltaY * 0.01;
                cameraDistance = Math.max(10, Math.min(50, cameraDistance));
                
                // Get direction from epicenter to camera
                const direction = new window.THREE.Vector3();
                direction.subVectors(camera.position, new window.THREE.Vector3(x, y, z));
                direction.normalize();
                
                // Move camera along direction vector
                camera.position.set(x, y, z);
                camera.position.add(direction.multiplyScalar(cameraDistance));
                camera.lookAt(x, y, z);
            });
            
            // Animation loop with enhanced effects
            let pulseScale = 1.0;
            let time = 0;
            function animate() {
                requestAnimationFrame(animate);
                time += 0.016; // ~60fps
                
                // Rotate Earth slowly
                earth.rotation.y += 0.001;
                
                // Pulse epicenter with magnitude-based intensity
                pulseScale = 1.0 + Math.sin(time * 2) * (0.2 + magnitude / 50);
                epicenter.scale.set(pulseScale, pulseScale, pulseScale);
                epicenterMaterial.opacity = 0.7 + Math.sin(time * 2) * 0.25;
                
                // Pulse rings
                scene.children.forEach(child => {
                    if (child.userData.pulseOffset !== undefined) {
                        const ringPulse = 1.0 + Math.sin((time + child.userData.pulseOffset) * 1.5) * 0.3;
                        child.scale.set(ringPulse, ringPulse, 1);
                        child.material.opacity = 0.2 + Math.sin((time + child.userData.pulseOffset) * 1.5) * 0.2;
                    }
                });
                
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
            html += `<h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                <span style="display: inline-flex; align-items: center; color: #4A9EFF;">${getIconSVG('city', 24, '#4A9EFF')}</span>
                Nearby Important Locations
            </h2>`;
            
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
                            <span style="display: inline-flex; align-items: center; gap: 0.5rem; vertical-align: middle;">
                                <span style="display: inline-flex; align-items: center; color: #4A9EFF;">${getIconSVG('lightbulb', 16, '#4A9EFF')}</span>
                                These venues may host concerts, festivals, sports events, or other gatherings. Check local event listings for scheduled activities.
                            </span>
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
        console.log('[ArticleLoader] loadArticle() called');
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        
        console.log('[ArticleLoader] Article ID from URL:', articleId);
        
        const headingElement = document.getElementById('article-heading');
        const bodyElement = document.getElementById('article-body');
        const timestampElement = document.getElementById('article-timestamp');
        const categoryChip = document.getElementById('category-chip');
        
        if (!headingElement || !bodyElement) {
            console.error('[ArticleLoader] Required elements not found', { 
                headingElement: !!headingElement, 
                bodyElement: !!bodyElement 
            });
            return;
        }
        
        if (!articleId) {
            console.warn('[ArticleLoader] No article ID provided');
            headingElement.textContent = 'Article Not Found';
            bodyElement.innerHTML = '<p>No article ID provided. Please select an article from the <a href="/index.html" style="color: #4A90E2;">homepage</a>.</p>';
            return;
        }

        // Show loading state
        console.log('[ArticleLoader] Showing loading state');
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
            // Posts can have id as: articleId, post-{articleId}, usgs-{eventId}, or stored as postId field
            const post = posts.find(p => {
                // Direct match
                if (p.id === articleId) return true;
                // Match with post- prefix
                if (p.id === `post-${articleId}`) return true;
                // Match usgs- prefix (e.g., usgs-ak2026ahhwhz)
                if (articleId.startsWith('usgs-')) {
                    const eventId = articleId.substring(5); // Remove 'usgs-' prefix
                    // Try matching with post-usgs- prefix
                    if (p.id === `post-usgs-${eventId}` || p.id === `post-${articleId}`) return true;
                    // Try matching event_id or canonical_id
                    if (p.event_id === eventId || p.canonical_id === `usgs:${eventId}`) return true;
                }
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
            
            console.log('[ArticleLoader] Found post:', { 
                id: post.id, 
                postId: post.postId, 
                title: (post.title || post.story || post.text || '').substring(0, 50),
                hasImage: !!(post.primary_image_url || post.image_url || post.image),
                hasStory: !!(post.story || post.text),
                category: post.category,
                source: post.source
            });

            // Extract post data
            const title = post.title || post.story || post.text || 'Breaking News Story';
            console.log('[ArticleLoader] Extracted title:', title.substring(0, 100));
            const story = post.story || post.text || post.title || '';
            const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
            
            // Get image - prioritize primary_image_url (generated earthquake images)
            // Also handle newsletter images stored as get-uploaded-image URLs
            let image = post.primary_image_url || 
                       post.image_url || 
                       post.image || 
                       post.images?.[0] || 
                       null;
            
            // If image is a get-uploaded-image URL, ensure it's absolute
            if (image && image.includes('get-uploaded-image')) {
                if (!image.startsWith('http://') && !image.startsWith('https://')) {
                    // Make relative URL absolute
                    image = image.startsWith('/') ? `${SITE_URL}${image}` : `${SITE_URL}/${image}`;
                }
            }
            
            const category = post.category || 'Breaking News';
            
            // Update SEO meta tags (prioritizes primary_image_url for generated earthquake images)
            updatePostMetaTags(post, articleId);
            
            // Log image selection for debugging social media previews
            const selectedImage = post.primary_image_url || post.image_url || post.image || post.images?.[0] || null;
            if (selectedImage) {
                console.log('[ArticleLoader] Image selected for social preview:', {
                    source: post.primary_image_url ? 'primary_image_url' : 
                            post.image_url ? 'image_url' : 
                            post.image ? 'image' : 'images[0]',
                    url: selectedImage.substring(0, 100),
                    isGenerated: selectedImage.includes('get-uploaded-image') && selectedImage.includes('earthquake'),
                    eventId: post.eventId || post.event_id || 'N/A'
                });
            }
            
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
            
            // Update share buttons with proper earthquake format
            const shareUrl = `${SITE_URL}/article.html?id=${encodeURIComponent(articleId)}`;
            
            // Check if this is an earthquake post
            const isEarthquake = post.category === 'Earthquake' || post.event_type === 'earthquake' || post.source === 'USGS';
            const magnitude = post.magnitude || post.assets?.magnitude || null;
            const location = post.location_display || post.location || null;
            
            // For earthquakes, use the proper format: "BREAKING: M___ Earthquake Near ___. #hashtags"
            let shareText = title;
            if (isEarthquake && magnitude && location) {
                const magnitudeFormatted = typeof magnitude === 'number' ? magnitude.toFixed(1) : magnitude;
                const hashtags = getEarthquakeHashtags(location);
                shareText = `BREAKING: M${magnitudeFormatted} Earthquake Near ${location}. ${hashtags}`;
            }
            
            // Update share menu via global function
            if (typeof window.updateShareMenu === 'function') {
                console.log('[ArticleLoader] Updating share menu', { shareText, shareUrl, isEarthquake, magnitude, location });
                window.updateShareMenu(shareText, shareUrl, isEarthquake, magnitude, location);
            } else {
                console.warn('[ArticleLoader] window.updateShareMenu function not found - share menu may not update correctly');
            }
            
            // Also update individual share buttons if they exist (legacy support)
            const twitterBtn = document.getElementById('share-twitter-btn');
            if (twitterBtn) {
                twitterBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
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
                // Add retry logic for get-uploaded-image URLs that might have propagation delays
                const isUploadedImage = absoluteImageUrl.includes('get-uploaded-image');
                
                if (isUploadedImage) {
                    // For uploaded images, add retry logic with exponential backoff
                    bodyHTML += `<div class="article-media" data-image-url="${escapeHtml(absoluteImageUrl)}">
                        <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" loading="lazy" 
                             onerror="(function(img) {
                                const container = img.parentElement;
                                if (!container) return;
                                const retryCount = parseInt(container.dataset.retryCount || '0');
                                if (retryCount < 5) {
                                    container.dataset.retryCount = (retryCount + 1).toString();
                                    const delays = [1000, 2000, 3000, 5000, 8000];
                                    setTimeout(() => {
                                        img.src = img.src.split('?')[0] + '?t=' + Date.now();
                                    }, delays[retryCount]);
                                } else {
                                    img.style.display='none';
                                    if (!container.querySelector('.image-error')) {
                                        container.innerHTML='<p class=\\'image-error\\' style=\\'color: rgba(255,255,255,0.4); padding: 0.5rem; text-align: center; font-size: 0.8125rem; margin: 0;\\'>Image unavailable</p>';
                                    }
                                }
                             })(this);">
                    </div>`;
                } else {
                    // For regular images, use simple error handling
                    bodyHTML += `<div class="article-media">
                        <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" loading="lazy" 
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<p style=\\'color: rgba(255,255,255,0.6); padding: 2rem; text-align: center;\\'>Image could not be loaded</p>';">
                    </div>`;
                }
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
            const isEarthquake = post.event_type === 'earthquake' || post.category === 'Earthquake' || post.category === 'EARTHQUAKE' || post.source === 'USGS';
            // Check for coordinates in multiple places (lat/lon at top level, or in raw geometry, or in assets)
            const hasCoordinates = (post.lat && post.lon) || 
                                   (post.raw?.geometry?.coordinates?.[1] && post.raw?.geometry?.coordinates?.[0]) ||
                                   (post.assets?.lat && post.assets?.lon);
            // Get coordinates from any available source
            if (!post.lat && post.raw?.geometry?.coordinates) {
                post.lat = post.raw.geometry.coordinates[1];
                post.lon = post.raw.geometry.coordinates[0];
            }
            if (!post.lat && post.assets) {
                post.lat = post.assets.lat;
                post.lon = post.assets.lon;
            }
            const magnitude = post.assets?.magnitude || post.magnitude;
            
            console.log('[ArticleLoader] Earthquake check:', {
                isEarthquake,
                hasCoordinates,
                lat: post.lat,
                lon: post.lon,
                magnitude,
                event_type: post.event_type,
                category: post.category,
                hasAssets: !!post.assets,
                hasImpactAssessment: !!post.assets?.impact_assessment,
                hasTsunamiAssessment: !!post.assets?.tsunami_assessment,
                hasAftershockForecast: !!post.assets?.aftershock_forecast,
                hasAnomalyDetection: !!post.assets?.anomaly_detection,
            });
            
            // Show enhancements if it's an earthquake (even without coordinates, we can show assessments)
            if (isEarthquake) {
                // Add earthquake-specific enhancements
                console.log('[ArticleLoader] Adding earthquake enhancements...', {
                    isEarthquake,
                    hasCoordinates,
                    magnitude,
                    lat: post.lat,
                    lon: post.lon,
                    source: post.source,
                    category: post.category,
                    hasAssets: !!post.assets
                });
                const enhancementsHTML = await generateEarthquakeEnhancements(post, magnitude);
                bodyHTML += enhancementsHTML;
                console.log('[ArticleLoader] Enhancements HTML length:', enhancementsHTML.length);
            } else {
                console.warn('[ArticleLoader] Skipping earthquake enhancements:', {
                    isEarthquake,
                    hasCoordinates,
                    source: post.source,
                    category: post.category,
                    event_type: post.event_type,
                    reason: 'not an earthquake'
                });
            }
            
            bodyElement.innerHTML = bodyHTML;
            console.log('[ArticleLoader] Article body updated, total length:', bodyHTML.length);
            
            // Render article tags if they exist
            const tagsContainer = document.getElementById('article-tags');
            if (tagsContainer && post.tags && Array.isArray(post.tags) && post.tags.length > 0) {
                tagsContainer.style.display = 'flex';
                tagsContainer.innerHTML = post.tags.map(tag => {
                    const tagText = escapeHtml(tag);
                    return `<a href="/index.html?tag=${encodeURIComponent(tag)}" class="article-tag">${tagText}</a>`;
                }).join('');
            }
            
            // Initialize earthquake map and 3D visualization if it exists (after DOM update)
            if (isEarthquake && hasCoordinates) {
                // Use setTimeout to ensure DOM is fully updated
                setTimeout(() => {
                    initializeEarthquakeMap(post.lat, post.lon, magnitude, post.location_display || post.location);
                    const depth = post.assets?.depth || post.depth;
                    initialize3DVisualization(post.lat, post.lon, magnitude, depth, post.location_display || post.location);
                    
                    // Try to load animation if available (for magnitude 3.0+)
                    const eventId = post.assets?.event_id || post.event_id || post.id;
                    if (eventId && magnitude >= 3.0) {
                        loadEarthquakeAnimation(eventId, magnitude);
                    }
                }, 100);
            }
            
            /**
             * Load earthquake animation if available
             */
            function loadEarthquakeAnimation(eventId, magnitude) {
                const animationSection = document.getElementById('earthquake-animation-section');
                const animationImg = document.getElementById('earthquake-animation-img');
                if (!animationSection || !animationImg) return;
                
                // Try to fetch animation
                const baseUrl = window.location.origin;
                const animationUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=earthquake-${eventId}-animation`;
                
                // Check if animation exists
                fetch(animationUrl, { method: 'HEAD' })
                    .then(response => {
                        if (response.ok) {
                            animationImg.src = animationUrl;
                            animationImg.style.display = 'block';
                            animationSection.style.display = 'block';
                            animationImg.onerror = () => {
                                animationSection.style.display = 'none';
                            };
                        }
                    })
                    .catch(() => {
                        // Animation not available, hide section
                        animationSection.style.display = 'none';
                    });
            }
            
            // Initialize comments
            const commentsContainer = document.getElementById('article-comments');
            if (commentsContainer) {
                // Normalize articleId for comments (handle usgs- prefix, post- prefix, etc.)
                let commentArticleId = articleId;
                if (articleId.startsWith('usgs-')) {
                    // For usgs-{eventId}, try both formats
                    commentArticleId = `post-${articleId}`;
                } else if (!articleId.startsWith('post-')) {
                    // Ensure post- prefix for consistency
                    commentArticleId = `post-${articleId}`;
                }
                
                commentsContainer.setAttribute('data-article-id', commentArticleId);
                // Ensure comment section container exists
                if (!commentsContainer.querySelector('.comment-section')) {
                    const commentSectionDiv = document.createElement('div');
                    commentSectionDiv.className = 'comment-section';
                    commentSectionDiv.setAttribute('data-article-id', commentArticleId);
                    commentsContainer.appendChild(commentSectionDiv);
                }
                
                // Initialize comment section
                const initComments = () => {
                    if (window.CommentSection) {
                        if (!window.commentSections) {
                            window.commentSections = {};
                        }
                        // Only initialize if not already initialized
                        if (!window.commentSections[commentArticleId]) {
                            try {
                                window.commentSections[commentArticleId] = new window.CommentSection(commentArticleId);
                                console.log('[ArticleLoader] Comment section initialized for', commentArticleId);
                            } catch (error) {
                                console.error('[ArticleLoader] Failed to initialize comment section:', error);
                            }
                        } else {
                            // Re-render if already initialized
                            try {
                                window.commentSections[commentArticleId].render();
                            } catch (error) {
                                console.error('[ArticleLoader] Failed to render comment section:', error);
                            }
                        }
                    } else {
                        // Wait for CommentSection to load (try up to 10 seconds)
                        let attempts = 0;
                        const maxAttempts = 50; // 50 * 200ms = 10 seconds
                        const checkInterval = setInterval(() => {
                            attempts++;
                            if (window.CommentSection) {
                                clearInterval(checkInterval);
                                initComments();
                            } else if (attempts >= maxAttempts) {
                                clearInterval(checkInterval);
                                console.error('[ArticleLoader] CommentSection failed to load after 10 seconds');
                                // Show error message to user
                                const errorDiv = document.createElement('div');
                                errorDiv.style.cssText = 'padding: 1rem; background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.3); border-radius: 8px; color: #ff6b6b; margin: 1rem 0;';
                                errorDiv.textContent = 'Comments failed to load. Please refresh the page.';
                                commentsContainer.appendChild(errorDiv);
                            }
                        }, 200);
                    }
                };
                
                // Wait a bit for DOM to settle, then initialize
                setTimeout(() => {
                    initComments();
                }, 100);
            } else {
                console.error('[ArticleLoader] Comments container not found!');
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
     * Load more coverage section - Show diverse, recent articles
     */
    function loadMoreCoverage(allPosts, currentId) {
        // Get articles excluding current
        const available = allPosts.filter(p => {
            const id = p.id || '';
            return id !== currentId && id !== `post-${currentId}` && (p.story || p.text || p.title);
        });
        
        if (available.length === 0) {
            const grid = document.getElementById('more-coverage-grid');
            if (grid) {
                grid.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No additional articles available.</p>';
            }
            return;
        }
        
        // Sort by date (newest first)
        const sorted = available.sort((a, b) => {
            const dateA = new Date(a.datePosted || a.createdAt || a.created_at || 0).getTime();
            const dateB = new Date(b.datePosted || b.createdAt || b.created_at || 0).getTime();
            return dateB - dateA;
        });
        
        // Select diverse articles: mix of recent and varied categories
        const recent = sorted.slice(0, 12); // Get more recent articles
        const more = recent.slice(0, 6); // Take top 6
        
        // Render with enhanced styling
        if (window.NewsCard && window.NewsCard.render) {
            window.NewsCard.render(more, '#more-coverage-grid', { 
                showThumbnail: true, 
                maxTitleLength: 80,
                enhanced: true // Flag for enhanced styling
            });
        } else {
            // Fallback rendering
            const grid = document.getElementById('more-coverage-grid');
            if (grid) {
                grid.innerHTML = more.map(post => {
                    const postId = post.id || `post-${Date.now()}`;
                    const title = post.title || post.story || post.text || 'Untitled';
                    const shortTitle = title.length > 80 ? title.substring(0, 77) + '...' : title;
                    const image = post.primary_image_url || post.image_url || post.image || post.images?.[0] || '';
                    const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
                    const relativeTime = formatRelativeTime(datePosted);
                    const category = post.category || 'Breaking News';
                    const articleUrl = `/article.html?id=${encodeURIComponent(postId)}`;
                    
                    // Escape all user-generated content to prevent XSS
                    const escapedTitle = escapeHtml(shortTitle);
                    const escapedCategory = escapeHtml(category);
                    // For image URLs, validate and sanitize to prevent XSS while preserving valid URLs
                    // Only allow http://, https://, or relative paths starting with /
                    let safeImageUrl = '';
                    if (image) {
                        const trimmedImage = image.trim();
                        // Check if it's a valid URL format (http/https or relative path)
                        if (trimmedImage.startsWith('http://') || 
                            trimmedImage.startsWith('https://') || 
                            trimmedImage.startsWith('/') ||
                            trimmedImage.startsWith('./') ||
                            trimmedImage.startsWith('../')) {
                            // Escape only characters that could break out of the src attribute
                            // Preserve & in URLs (it's valid), but escape quotes and angle brackets
                            safeImageUrl = trimmedImage
                                .replace(/"/g, '&quot;')  // Escape double quotes (we use double quotes in attribute)
                                .replace(/'/g, '&#x27;')  // Escape single quotes
                                .replace(/</g, '&lt;')    // Escape < to prevent script injection
                                .replace(/>/g, '&gt;');   // Escape > to prevent script injection
                        } else {
                            // Invalid URL format - don't use it (prevents javascript: and data: URLs)
                            safeImageUrl = '';
                        }
                    }
                    
                    // Detect image variant for smart cropping
                    const isEarthquakeGraphic = safeImageUrl && (
                        safeImageUrl.includes('earthquake-') || 
                        safeImageUrl.includes('standard') || 
                        category === 'Earthquake'
                    );
                    const variant = isEarthquakeGraphic ? 'earthquake' : 'photo';
                    
                    return `
                        <a href="${articleUrl}" class="news-card">
                            <div class="news-card-thumbnail-wrapper">
                                ${image && safeImageUrl ? `
                                    <img 
                                        src="${safeImageUrl}" 
                                        alt="${escapedTitle}" 
                                        class="news-card-thumbnail" 
                                        data-variant="${variant}"
                                        loading="lazy"
                                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                    >
                                ` : ''}
                                <div class="news-card-thumbnail-placeholder" style="${image && safeImageUrl ? 'display: none;' : ''}">
                                    <div class="news-card-thumbnail-placeholder-icon">📰</div>
                                    <div class="news-card-thumbnail-placeholder-text">${escapedCategory}</div>
                                </div>
                            </div>
                            <div class="news-card-content">
                                <h3 class="news-card-title">${escapedTitle}</h3>
                                <div class="news-card-meta">
                                    <span class="news-card-category">${escapedCategory}</span>
                                    <span>${relativeTime}</span>
                                </div>
                            </div>
                        </a>
                    `;
                }).join('');
            }
        }
    }
    
    /**
     * Format relative time helper
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadArticle);
    } else {
        loadArticle();
    }
})();
