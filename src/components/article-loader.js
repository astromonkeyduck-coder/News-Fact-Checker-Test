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
     * Derive key takeaways from post for "At a glance" block.
     * Uses post.key_takeaways, post.summary, or derives from story (lines or sentences).
     * @param {Object} post - Post object
     * @returns {string[]} Array of takeaway strings (max 5), or empty if none
     */
    function deriveKeyTakeaways(post) {
        const maxItems = 5;
        const maxLineLen = 120;

        if (post.key_takeaways && Array.isArray(post.key_takeaways) && post.key_takeaways.length > 0) {
            return post.key_takeaways
                .slice(0, maxItems)
                .map(s => (typeof s === 'string' ? s.trim() : String(s).trim()))
                .filter(Boolean)
                .map(s => s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : s);
        }

        if (post.summary && typeof post.summary === 'string') {
            const trimmed = post.summary.trim();
            if (!trimmed) return [];
            const byNewline = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
            if (byNewline.length > 0) {
                return byNewline.slice(0, maxItems).map(s =>
                    s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : s
                );
            }
            const bySentence = trimmed.split(/\.\s+/).map(s => s.trim()).filter(Boolean);
            return bySentence.slice(0, maxItems).map(s =>
                s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : (s.endsWith('.') ? s : s + '.')
            );
        }

        const story = post.story || post.text || post.title || '';
        if (!story || typeof story !== 'string') return [];

        const lines = story.split(/\n+/).map(s => s.trim()).filter(Boolean);
        if (lines.length >= 2) {
            return lines.slice(0, maxItems).map(s =>
                s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : s
            );
        }

        const single = story.trim();
        if (!single) return [];
        const sentences = single.split(/\.\s+/).map(s => s.trim()).filter(Boolean);
        if (sentences.length >= 2) {
            return sentences.slice(0, 3).map(s =>
                s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : (s.endsWith('.') ? s : s + '.')
            );
        }
        if (sentences.length === 1 && sentences[0].length > 40) {
            const s = sentences[0];
            return [s.length > maxLineLen ? s.substring(0, maxLineLen).trim() + '…' : s];
        }
        return [];
    }

    /**
     * Build key takeaways HTML block (empty string if no takeaways).
     */
    function buildKeyTakeawaysHTML(post) {
        const items = deriveKeyTakeaways(post);
        if (items.length === 0) return '';
        const listItems = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
        return `<div class="key-takeaways" role="region" aria-label="Key points">
            <h2 class="key-takeaways__title">Key points</h2>
            <ul class="key-takeaways__list">${listItems}</ul>
        </div>`;
    }

    /**
     * Generate a URL-safe slug from heading text (for id and TOC links).
     */
    function slugify(text) {
        if (!text) return '';
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    }

    /**
     * Inject heading IDs and build table of contents in sidebar.
     * Call after bodyElement.innerHTML is set. Shows TOC only if 2+ headings.
     */
    function buildTableOfContents(bodyElement) {
        const headings = bodyElement.querySelectorAll('h2, h3');
        if (headings.length < 2) return;

        const used = new Set();
        const tocEntries = [];

        headings.forEach((el) => {
            const text = (el.textContent || '').trim();
            let id = el.id || slugify(text);
            if (used.has(id)) {
                let n = 2;
                while (used.has(id + '-' + n)) n++;
                id = id + '-' + n;
            }
            used.add(id);
            el.id = id;
            const tag = el.tagName.toLowerCase();
            tocEntries.push({ id, text, tag });
        });

        const tocWrap = document.getElementById('article-toc-wrap');
        const tocNav = document.getElementById('article-toc');
        if (!tocWrap || !tocNav) return;

        tocNav.innerHTML = tocEntries.map(({ id, text, tag }) => {
            const cls = tag === 'h3' ? 'article-toc__item article-toc__item--h3' : 'article-toc__item';
            return `<a href="#${escapeHtml(id)}" class="${cls}">${escapeHtml(text)}</a>`;
        }).join('');

        tocWrap.style.display = '';
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
        // CRITICAL: Prioritize GIF (video_url) first, then PNG (primary_image_url) for social media previews
        // This ensures the generated branded earthquake images (especially animated GIFs) appear in social media cards
        // Check both top-level video_url and assets.video_url (stored in JSONB column)
        const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
        const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));
        
        // Priority order: GIF > PNG > Other images > Default
        let image = null;
        if (isGIF && videoUrl) {
            // Use GIF first if available
            image = videoUrl;
        } else {
            // Fall back to PNG or other images
            image = post.primary_image_url || 
                    post.image_url || 
                    post.image || 
                    post.images?.[0] || 
                    null;
        }
        
        // Only use default if no image found at all
        if (!image) {
            image = `${SITE_URL}/PREVIEWIMAGEBRUH.jpg`;
        }
        
        const imageUrl = ensureAbsoluteImageUrl(image);
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

        // Open Graph - use the selected image (GIF if available, otherwise PNG)
        getOrCreateMeta('og:url').setAttribute('content', url);
        getOrCreateMeta('og:title').setAttribute('content', formattedTitle);
        getOrCreateMeta('og:description').setAttribute('content', description);
        getOrCreateMeta('og:image').setAttribute('content', imageUrl);
        getOrCreateMeta('og:image:width').setAttribute('content', '1200');
        getOrCreateMeta('og:image:height').setAttribute('content', '630');
        getOrCreateMeta('og:site_name').setAttribute('content', 'Noteworthy News');
        getOrCreateMeta('og:locale').setAttribute('content', 'en_US');
        getOrCreateMeta('og:type').setAttribute('content', 'article');
        getOrCreateMeta('article:published_time').setAttribute('content', datePosted);
        getOrCreateMeta('article:author').setAttribute('content', 'Noteworthy News');

        // Check if video is available for Player Card (non-GIF videos only)
        const hasVideo = videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('video'));
        
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
            getOrCreateMeta('twitter:image', 'name').setAttribute('content', imageUrl);
        } else {
            // Use summary_large_image for images and GIFs
            getOrCreateMeta('twitter:card', 'name').setAttribute('content', 'summary_large_image');
            getOrCreateMeta('twitter:image', 'name').setAttribute('content', imageUrl);
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
        
        let html = '<div class="earthquake-enhancements">';
        
        // Add generated earthquake animation (GIF/video) when available
        const videoUrl = post.video_url || post.video || post.assets?.video_url || null;
        const isGIF = videoUrl && (videoUrl.includes('.gif') || videoUrl.includes('get-uploaded-image'));
        if (videoUrl && isGIF) {
            const absoluteVideoUrl = ensureAbsoluteImageUrl(videoUrl);
            html += `
                <div class="earthquake-animation-section earthquake-section">
                    <h2 class="earthquake-section-heading">Animated Visualization</h2>
                    <div class="article-media earthquake-animation-media">
                        <img src="${escapeHtml(absoluteVideoUrl)}" alt="Animated earthquake visualization near ${escapeHtml(locationDisplay)}" loading="lazy" style="width: 100%; max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #e5e5e5;">
                    </div>
                </div>
            `;
        }
        
        // Add interactive map container (only if we have coordinates)
        if (lat && lon) {
            html += `
                <div class="earthquake-map-container">
                    <div id="earthquake-interactive-map" style="width: 100%; height: 500px;"></div>
                </div>
            `;
        }
        
        // Add location details section
        html += `
            <div class="earthquake-details-section earthquake-section">
                <h2 class="earthquake-section-heading">Location Details</h2>
                <div class="earthquake-details-grid">
                    <div class="detail-card">
                        <div class="earthquake-label">Magnitude</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">M${magnitudeFormatted}</div>
                    </div>
                    ${depthFormatted ? `
                    <div class="detail-card">
                        <div class="earthquake-label">Depth</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">${depthFormatted}</div>
                    </div>
                    ` : ''}
                    ${lat && lon ? `
                    <div class="detail-card">
                        <div class="earthquake-label">Coordinates</div>
                        <div style="font-size: 0.875rem; font-weight: 600; color: #1a1a1a; font-family: 'Courier New', monospace;">${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}</div>
                    </div>
                    ` : ''}
                    <div class="detail-card">
                        <div class="earthquake-label">Location</div>
                        <div style="font-size: 0.9375rem; font-weight: 600; color: #1a1a1a;">
                            ${escapeHtml(locationDisplay)}
                            ${locationEnglishName && locationEnglishName !== locationDisplay ? `
                                <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem; font-weight: 400;">
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
            const severityClass = impactAssessment.severity === 'CRITICAL' ? 'severity-critical' : 
                                 impactAssessment.severity === 'HIGH' ? 'severity-high' : 
                                 impactAssessment.severity === 'MODERATE' ? 'severity-moderate' : 'severity-low';
            html += `
                <div id="impact-assessment" class="impact-assessment-section earthquake-section">
                    <h2 class="earthquake-section-heading">AI Impact Assessment</h2>
                    <div class="earthquake-metric-grid">
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Risk Score</div>
                            <div style="font-size: 1.5rem; font-weight: 700; line-height: 1.2;" class="${severityClass}">${impactAssessment.riskScore || 0}/100</div>
                            <div style="font-size: 0.875rem; color: #666; margin-top: 0.25rem;">${impactAssessment.severity || 'UNKNOWN'}</div>
                        </div>
                        ${impactAssessment.affectedPopulation ? `
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Affected Population</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a; line-height: 1.2;">
                                ${impactAssessment.affectedPopulation >= 1000000 ? (impactAssessment.affectedPopulation / 1000000).toFixed(2) + 'M' : 
                                  impactAssessment.affectedPopulation >= 1000 ? (impactAssessment.affectedPopulation / 1000).toFixed(1) + 'K' : 
                                  impactAssessment.affectedPopulation.toLocaleString()}
                            </div>
                            <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">people potentially affected</div>
                        </div>
                        ` : ''}
                        ${impactAssessment.populationDensity ? `
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Population Density</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">${impactAssessment.populationDensity.toFixed(0)}</div>
                            <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">people per km²</div>
                        </div>
                        ` : ''}
                        ${impactAssessment.affectedRadius ? `
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Affected Radius</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">${impactAssessment.affectedRadius.toFixed(1)} km</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${impactAssessment.nearbyCities && impactAssessment.nearbyCities.length > 0 ? `
                    <div class="earthquake-subsection">
                        <h3 class="earthquake-subsection-heading">Nearby Cities & Population</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem;">
                            ${impactAssessment.nearbyCities.slice(0, 8).map(city => `
                                <div style="padding: 0.5em 0; border-bottom: 1px solid #e5e5e5;">
                                    <div style="font-weight: 600; color: #1a1a1a; font-size: 0.9375rem;">${escapeHtml(city.name || 'Unknown')}</div>
                                    <div class="earthquake-label" style="margin-bottom: 0;">${city.population ? city.population.toLocaleString() + ' people' : 'Population data unavailable'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${impactAssessment.criticalInfrastructure ? `
                    <div class="earthquake-subsection">
                        <h3 class="earthquake-subsection-heading">Critical Infrastructure at Risk</h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                            <div><span style="font-weight: 700; color: #1a1a1a;">${impactAssessment.criticalInfrastructure.hospitals || 0}</span> <span class="earthquake-label" style="margin: 0;">Hospitals</span></div>
                            <div><span style="font-weight: 700; color: #1a1a1a;">${impactAssessment.criticalInfrastructure.schools || 0}</span> <span class="earthquake-label" style="margin: 0;">Schools</span></div>
                            <div><span style="font-weight: 700; color: #1a1a1a;">${impactAssessment.criticalInfrastructure.airports || 0}</span> <span class="earthquake-label" style="margin: 0;">Airports</span></div>
                            <div><span style="font-weight: 700; color: #1a1a1a;">${impactAssessment.criticalInfrastructure.powerPlants || 0}</span> <span class="earthquake-label" style="margin: 0;">Power Plants</span></div>
                            ${impactAssessment.criticalInfrastructure.dams ? `<div><span style="font-weight: 700; color: #1a1a1a;">${impactAssessment.criticalInfrastructure.dams || 0}</span> <span class="earthquake-label" style="margin: 0;">Dams</span></div>` : ''}
                        </div>
                        ${impactAssessment.criticalInfrastructure.details && (impactAssessment.criticalInfrastructure.details.hospitals?.length > 0 || impactAssessment.criticalInfrastructure.details.schools?.length > 0) ? `
                        <p style="margin: 0.75em 0 0; font-size: 0.8125rem; color: #666;"><strong>Note:</strong> Infrastructure data is based on OpenStreetMap and may not be complete. Always follow official emergency guidance.</p>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            html += `
                <div id="impact-assessment" class="impact-assessment-section earthquake-section">
                    <h2 class="earthquake-section-heading">AI Impact Assessment</h2>
                    <p style="font-size: 0.9375rem; color: #666; margin: 0;">Assessment data will appear here when available.</p>
                </div>
            `;
        }
        
        // Add tsunami risk section
        if (tsunamiAssessment && tsunamiAssessment.riskLevel !== 'LOW') {
            const riskClass = tsunamiAssessment.riskLevel === 'HIGH' ? 'severity-critical' : 'severity-high';
            html += `
                <div class="tsunami-risk-section earthquake-section">
                    <h2 class="earthquake-section-heading">Tsunami Risk Assessment</h2>
                    <div style="font-size: 0.9375rem; font-weight: 600; margin-bottom: 0.5rem;" class="${riskClass}">${tsunamiAssessment.riskLevel} RISK</div>
                    <p style="font-size: 0.9375rem; color: #1a1a1a; line-height: 1.6; margin: 0 0 0.5em 0;">
                        ${tsunamiAssessment.assessment || 'Monitor official tsunami warnings.'}
                    </p>
                    ${tsunamiAssessment.travelTime ? `
                    <p style="font-size: 0.875rem; color: #666; margin: 0.5em 0 0;">
                        Estimated travel time to coast: <strong>${tsunamiAssessment.travelTime.hours}h ${tsunamiAssessment.travelTime.minutes}m</strong>
                    </p>
                    ` : ''}
                </div>
            `;
        }
        
        // Add aftershock forecast section (always show if available)
        if (aftershockForecast) {
            const probClass = aftershockForecast.probability24h >= 70 ? 'severity-critical' : 
                             aftershockForecast.probability24h >= 40 ? 'severity-high' : 
                             aftershockForecast.probability24h >= 20 ? 'severity-moderate' : 'severity-low';
            html += `
                <div class="aftershock-forecast-section earthquake-section">
                    <h2 class="earthquake-section-heading">AI Aftershock Forecast</h2>
                    <div class="earthquake-metric-grid">
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">24 Hour Probability</div>
                            <div style="font-size: 1.25rem; font-weight: 700; line-height: 1.2;" class="${probClass}">${aftershockForecast.probability24h || 0}%</div>
                            <div style="font-size: 0.75rem; color: #666;">chance of aftershocks</div>
                        </div>
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Expected Largest</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">M${(aftershockForecast.expectedLargestAftershock || 0).toFixed(1)}</div>
                            <div style="font-size: 0.75rem; color: #666;">magnitude estimate</div>
                        </div>
                        ${aftershockForecast.probability48h !== undefined ? `
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">48 Hour Probability</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">${aftershockForecast.probability48h}%</div>
                        </div>
                        ` : ''}
                        ${aftershockForecast.probability7d !== undefined ? `
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">7 Day Probability</div>
                            <div style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a;">${aftershockForecast.probability7d}%</div>
                        </div>
                        ` : ''}
                    </div>
                    ${aftershockForecast.forecast ? `
                    <p style="font-size: 0.9375rem; color: #1a1a1a; line-height: 1.6; margin: 0.75em 0 0;">
                        ${aftershockForecast.forecast}
                    </p>
                    ` : ''}
                    ${aftershockForecast.recommendation ? `
                    <p style="font-size: 0.875rem; color: #1a1a1a; margin: 0.75em 0 0; padding-left: 1em; border-left: 3px solid #1a1a1a;">
                        <strong>Recommendation:</strong> ${aftershockForecast.recommendation}
                    </p>
                    ` : ''}
                </div>
            `;
        } else {
            html += `
                <div class="aftershock-forecast-section earthquake-section">
                    <h2 class="earthquake-section-heading">AI Aftershock Forecast</h2>
                    <p style="font-size: 0.9375rem; color: #666; margin: 0;">Assessment data will appear here when available.</p>
                </div>
            `;
        }
        
        // Add anomaly detection section
        if (anomalyDetection && anomalyDetection.anomalyLevel !== 'NORMAL') {
            const anomalyClass = anomalyDetection.anomalyLevel === 'HIGH' ? 'severity-critical' : 
                                anomalyDetection.anomalyLevel === 'MEDIUM' ? 'severity-high' : 'severity-moderate';
            html += `
                <div class="anomaly-detection-section earthquake-section">
                    <h2 class="earthquake-section-heading">Anomaly Detection</h2>
                    <div style="font-size: 0.9375rem; font-weight: 600; margin-bottom: 0.5rem;" class="${anomalyClass}">${anomalyDetection.anomalyLevel} ANOMALY LEVEL</div>
                    <p style="font-size: 0.9375rem; color: #1a1a1a; line-height: 1.6; margin: 0 0 0.5em 0;">
                        ${anomalyDetection.summary || 'Unusual earthquake patterns detected.'}
                    </p>
                    ${anomalyDetection.anomalies && anomalyDetection.anomalies.length > 0 ? `
                    <div style="margin-top: 0.75em;">
                        ${anomalyDetection.anomalies.map(anomaly => `
                            <div style="padding: 0.5em 0; border-bottom: 1px solid #e5e5e5;">
                                <div class="earthquake-label">${anomaly.type}</div>
                                <div style="font-size: 0.875rem; color: #1a1a1a;">${escapeHtml(anomaly.description)}</div>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            html += `
                <div class="anomaly-detection-section earthquake-section">
                    <h2 class="earthquake-section-heading">Anomaly Detection</h2>
                    <p style="font-size: 0.9375rem; color: #666; margin: 0;">Assessment data will appear here when available.</p>
                </div>
            `;
        }
        
        // Add comprehensive Tier Breakdown section (if we have impact assessment)
        if (impactAssessment && tierBreakdown) {
            const t1Class = impactAssessment.severity === 'CRITICAL' ? 'severity-critical' : impactAssessment.severity === 'HIGH' ? 'severity-high' : impactAssessment.severity === 'MODERATE' ? 'severity-moderate' : 'severity-low';
            const t2Class = tierBreakdown.tier2 === 'CRITICAL' ? 'severity-critical' : tierBreakdown.tier2 === 'HIGH' ? 'severity-high' : tierBreakdown.tier2 === 'MODERATE' ? 'severity-moderate' : 'severity-low';
            const t3Class = tierBreakdown.tier3 === 'HIGH' ? 'severity-high' : tierBreakdown.tier3 === 'MODERATE' ? 'severity-moderate' : 'severity-low';
            html += `
                <div class="tier-breakdown-section earthquake-section">
                    <h2 class="earthquake-section-heading">Risk Tier Breakdown</h2>
                    <div class="earthquake-metric-grid">
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Overall Risk</div>
                            <div style="font-size: 1.25rem; font-weight: 700;" class="${t1Class}">${impactAssessment.severity || 'UNKNOWN'}</div>
                            <div style="font-size: 0.75rem; color: #666;">Based on multiple factors</div>
                        </div>
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Population Risk</div>
                            <div style="font-size: 1.25rem; font-weight: 700;" class="${t2Class}">${tierBreakdown.tier2}</div>
                            <div style="font-size: 0.75rem; color: #666;">${impactAssessment.affectedPopulation ? (impactAssessment.affectedPopulation >= 1000000 ? (impactAssessment.affectedPopulation / 1000000).toFixed(2) + 'M' : (impactAssessment.affectedPopulation / 1000).toFixed(1) + 'K') : 'N/A'} people</div>
                        </div>
                        <div class="earthquake-metric-card">
                            <div class="earthquake-label">Density Risk</div>
                            <div style="font-size: 1.25rem; font-weight: 700;" class="${t3Class}">${tierBreakdown.tier3}</div>
                            <div style="font-size: 0.75rem; color: #666;">${impactAssessment.populationDensity ? impactAssessment.populationDensity.toFixed(0) + '/km²' : 'N/A'}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="tier-breakdown-section earthquake-section">
                    <h2 class="earthquake-section-heading">Risk Tier Breakdown</h2>
                    <p style="font-size: 0.9375rem; color: #666; margin: 0;">Assessment data will appear here when available.</p>
                </div>
            `;
        }
        
        // Add Historical Context section (if available)
        if (impactAssessment?.historicalComparison && impactAssessment.historicalComparison.count > 0) {
            const historical = impactAssessment.historicalComparison;
            html += `
                <div class="historical-context-section earthquake-section">
                    <h2 class="earthquake-section-heading">Historical Context</h2>
                    <p style="font-size: 0.9375rem; color: #1a1a1a; margin: 0 0 1rem 0; line-height: 1.6;">
                        ${historical.count} similar earthquake${historical.count !== 1 ? 's' : ''} recorded in this region historically.
                    </p>
                    ${historical.largest ? `
                    <div class="earthquake-metric-card" style="margin-bottom: 0.5rem;">
                        <div class="earthquake-label">Largest Historical Event</div>
                        <div style="font-size: 1.125rem; font-weight: 700; color: #1a1a1a;">M${historical.largest.magnitude?.toFixed(1) || 'N/A'}</div>
                        <div style="font-size: 0.75rem; color: #666;">${historical.largest.date ? new Date(historical.largest.date).toLocaleDateString() : 'Date unknown'}</div>
                    </div>
                    ` : ''}
                    ${historical.similar && historical.similar.length > 0 ? `
                    <div class="earthquake-subsection">
                        <div class="earthquake-subsection-heading">Similar Events (within 0.5 magnitude)</div>
                        <div style="display: grid; gap: 0.5rem;">
                            ${historical.similar.slice(0, 3).map(eq => `
                                <div style="padding: 0.5em 0; border-bottom: 1px solid #e5e5e5;">
                                    <div style="font-size: 0.9375rem; font-weight: 600; color: #1a1a1a;">M${eq.magnitude?.toFixed(1) || 'N/A'}</div>
                                    <div style="font-size: 0.75rem; color: #666;">${eq.date ? new Date(eq.date).toLocaleDateString() : 'Date unknown'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            html += `
                <div class="historical-context-section earthquake-section">
                    <h2 class="earthquake-section-heading">Historical Context</h2>
                    <p style="font-size: 0.9375rem; color: #666; margin: 0;">Assessment data will appear here when available.</p>
                </div>
            `;
        }
        
        // Add 3D visualization container with enhanced features
        html += `
            <div class="earthquake-3d-container" style="margin: 2rem 0; border-radius: 4px; overflow: hidden; border: 1px solid #e5e5e5;">
                <div class="earthquake-3d-header">
                    <h3 class="earthquake-3d-header-title">Interactive 3D Visualization</h3>
                    <div class="earthquake-3d-header-hint">Drag to rotate • Scroll to zoom</div>
                </div>
                <div id="earthquake-3d-viewer" style="width: 100%; height: 600px; background: linear-gradient(135deg, #0a0a18 0%, #1a1a2e 50%, #16213e 100%); position: relative;">
                    <div class="earthquake-3d-hud" style="position: absolute; top: 12px; left: 12px; z-index: 10; display: flex; align-items: center; gap: 10px;">
                        <span class="earthquake-3d-magnitude-badge" style="background: rgba(255,68,34,0.9); color: #fff; font-weight: 700; font-size: 1.25rem; padding: 0.35rem 0.75rem; border-radius: 6px;">M ${magnitudeFormatted}</span>
                        ${depth ? `<span style="background: rgba(0,0,0,0.6); color: rgba(255,255,255,0.95); font-size: 0.8rem; padding: 0.3rem 0.6rem; border-radius: 4px;">Depth: ${depth.toFixed(1)} km</span>` : ''}
                    </div>
                    <div style="position: absolute; top: 10px; right: 10px; z-index: 10; background: rgba(0,0,0,0.7); padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.75rem; color: rgba(255,255,255,0.9); white-space: nowrap;">
                        Epicenter: ${lat?.toFixed(4) || 'N/A'}°N, ${lon?.toFixed(4) || 'N/A'}°E
                        ${depth ? ` • Depth: ${depth.toFixed(1)} km` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Add loading placeholders for nearby locations (cleaner card format, matches other sections)
        html += `
            <div id="earthquake-nearby-locations" class="earthquake-section earthquake-nearby-section">
                <h2 class="earthquake-section-heading">Nearby Important Locations</h2>
                <div class="earthquake-nearby-skeleton" style="text-align: center; padding: 2rem;">
                    <div class="skeleton" style="height: 200px; border-radius: 4px;"></div>
                </div>
            </div>
        `;
        
        html += '</div>';
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
            
            const THREE = window.THREE;
            
            // Scene setup — deep space feel
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x050510);
            
            // Starfield background
            const starCount = 800;
            const starGeometry = new THREE.BufferGeometry();
            const starPositions = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount * 3; i += 3) {
                const r = 80 + Math.random() * 120;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
                starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
                starPositions[i + 2] = r * Math.cos(phi);
            }
            starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
            starGeometry.computeBoundingSphere();
            const starMaterial = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 0.4,
                transparent: true,
                opacity: 0.7,
                sizeAttenuation: true
            });
            const stars = new THREE.Points(starGeometry, starMaterial);
            scene.add(stars);
            
            const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            if (renderer.toneMapping !== undefined && THREE.ACESFilmicToneMapping !== undefined) {
                renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 0.9;
            }
            container.appendChild(renderer.domElement);
            
            // Professional lighting — no harsh single highlight
            const hemi = new THREE.HemisphereLight(0x1a2a4a, 0x0a0a12, 0.5);
            scene.add(hemi);
            const keyLight = new THREE.DirectionalLight(0xe8f0ff, 0.5);
            keyLight.position.set(8, 12, 6);
            scene.add(keyLight);
            const fillLight = new THREE.DirectionalLight(0x8090b0, 0.25);
            fillLight.position.set(-6, 4, -4);
            scene.add(fillLight);
            
            // Earth sphere — soft, realistic shading (no blown-out highlight)
            const earthGeometry = new THREE.SphereGeometry(5, 72, 72);
            const earthMaterial = new THREE.MeshPhongMaterial({
                color: 0x1e3a5f,
                emissive: 0x061220,
                specular: 0x0a1628,
                shininess: 25,
                flatShading: false
            });
            const earth = new THREE.Mesh(earthGeometry, earthMaterial);
            scene.add(earth);
            
            // Subtle reference plane (soft dark disk instead of harsh grid)
            const planeGeometry = new THREE.CircleGeometry(14, 48);
            const planeMaterial = new THREE.MeshBasicMaterial({
                color: 0x080810,
                transparent: true,
                opacity: 0.6
            });
            const plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.rotation.x = -Math.PI / 2;
            plane.position.y = -5.02;
            scene.add(plane);
            
            // Very subtle grid only at low opacity
            const gridHelper = new THREE.GridHelper(24, 12, 0x15152a, 0x0c0c18);
            gridHelper.position.y = -5.01;
            gridHelper.material.transparent = true;
            gridHelper.material.opacity = 0.2;
            scene.add(gridHelper);
            
            // Epicenter position on sphere
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lon + 180) * (Math.PI / 180);
            const radius = 5.2;
            const x = -radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.sin(theta);
            
            // Epicenter glow (point light so the marker reads clearly)
            const epicenterLight = new THREE.PointLight(0xff6644, 0.4, 8);
            epicenterLight.position.set(x, y, z);
            scene.add(epicenterLight);
            
            // Epicenter marker — smooth sphere, no wireframe look
            const epicenterSize = Math.min(0.2 + (magnitude / 20), 0.5);
            const epicenterGeometry = new THREE.SphereGeometry(epicenterSize, 36, 36);
            const epicenterMaterial = new THREE.MeshPhongMaterial({
                color: 0xff4422,
                emissive: 0xcc2200,
                emissiveIntensity: 0.4,
                specular: 0x331100,
                shininess: 20,
                transparent: true,
                opacity: 0.98
            });
            const epicenter = new THREE.Mesh(epicenterGeometry, epicenterMaterial);
            epicenter.position.set(x, y, z);
            scene.add(epicenter);
            
            // Pulsing rings — smooth, no harsh edges
            for (let i = 0; i < 3; i++) {
                const ringSize = epicenterSize * (1.6 + i * 0.6);
                const ringGeometry = new THREE.RingGeometry(ringSize, ringSize + 0.08, 64);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff4422,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.25 - (i * 0.06),
                    depthWrite: false
                });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.set(x, y, z);
                ring.lookAt(earth.position.x, earth.position.y, earth.position.z);
                ring.userData.pulseOffset = i * 0.35;
                scene.add(ring);
            }
            
            // Depth indicator (subtle line)
            if (depth) {
                const depthRatio = Math.min(depth / 100, 0.5);
                const depthPoint = new THREE.Vector3(
                    x * (1 - depthRatio),
                    y * (1 - depthRatio),
                    z * (1 - depthRatio)
                );
                const depthGeometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(x, y, z),
                    depthPoint
                ]);
                const depthMaterial = new THREE.LineBasicMaterial({ color: 0xaa3322, linewidth: 1 });
                const depthLine = new THREE.Line(depthGeometry, depthMaterial);
                scene.add(depthLine);
            }
            
            // Single subtle intensity ring at epicenter
            const ringGeometry = new THREE.RingGeometry(epicenterSize * 1.4, epicenterSize * 1.7, 48);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xff5522,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.35,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeometry, ringMat);
            ring.position.set(x, y, z);
            ring.lookAt(earth.position.x, earth.position.y, earth.position.z);
            ring.userData.isMainRing = true;
            scene.add(ring);
            
            // Expanding shockwave rings (seismic wave effect)
            const shockwaves = [];
            const shockwaveInterval = 1.8;
            let nextShockwaveTime = 0.5;
            function addShockwave() {
                const swRadius = epicenterSize * 1.2;
                const swGeometry = new THREE.RingGeometry(swRadius, swRadius + 0.15, 64);
                const swMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff6622,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.6,
                    depthWrite: false
                });
                const sw = new THREE.Mesh(swGeometry, swMaterial);
                sw.position.set(x, y, z);
                sw.lookAt(earth.position.x, earth.position.y, earth.position.z);
                sw.userData.birth = performance.now() / 1000;
                sw.userData.isShockwave = true;
                scene.add(sw);
                shockwaves.push(sw);
            }
            
            // Initial camera and smooth orbit state
            camera.position.set(15, 10, 15);
            camera.lookAt(x, y, z);
            let cameraDistance = 20;
            let targetDistance = 20;
            let cameraTheta = Math.atan2(camera.position.z - z, camera.position.x - x);
            let cameraPhi = Math.acos(Math.max(-1, Math.min(1, (camera.position.y - y) / cameraDistance)));
            let targetTheta = cameraTheta;
            let targetPhi = cameraPhi;
            const damp = 0.08;
            
            container.addEventListener('mousedown', (e) => {
                isDragging = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            });
            
            let isDragging = false;
            let previousMousePosition = { x: 0, y: 0 };
            
            container.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const deltaX = e.clientX - previousMousePosition.x;
                    const deltaY = e.clientY - previousMousePosition.y;
                    targetTheta -= deltaX * 0.008;
                    targetPhi += deltaY * 0.008;
                    targetPhi = Math.max(0.15, Math.min(Math.PI - 0.15, targetPhi));
                    previousMousePosition = { x: e.clientX, y: e.clientY };
                }
            });
            
            container.addEventListener('mouseup', () => { isDragging = false; });
            
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                targetDistance += e.deltaY * 0.015;
                targetDistance = Math.max(8, Math.min(55, targetDistance));
            });
            
            // Animation loop — smooth motion, shockwaves, camera damping
            let pulseScale = 1.0;
            let time = 0;
            function animate() {
                requestAnimationFrame(animate);
                const dt = 0.016;
                time += dt;
                
                earth.rotation.y += 0.0008;
                
                // Spawn shockwaves periodically
                if (time >= nextShockwaveTime) {
                    addShockwave();
                    nextShockwaveTime = time + shockwaveInterval;
                }
                for (let i = shockwaves.length - 1; i >= 0; i--) {
                    const sw = shockwaves[i];
                    const age = time - sw.userData.birth;
                    const scale = 1 + age * 2.5;
                    sw.scale.set(scale, scale, 1);
                    sw.material.opacity = Math.max(0, 0.5 - age * 0.4);
                    if (age > 1.2) {
                        scene.remove(sw);
                        shockwaves.splice(i, 1);
                    }
                }
                
                pulseScale = 1.0 + Math.sin(time * 1.8) * (0.12 + magnitude / 60);
                epicenter.scale.set(pulseScale, pulseScale, pulseScale);
                epicenterMaterial.opacity = 0.88 + Math.sin(time * 1.8) * 0.1;
                
                // Smooth camera (damped orbit and zoom)
                cameraTheta += (targetTheta - cameraTheta) * damp;
                cameraPhi += (targetPhi - cameraPhi) * damp;
                cameraDistance += (targetDistance - cameraDistance) * damp;
                camera.position.x = x + cameraDistance * Math.sin(cameraPhi) * Math.cos(cameraTheta);
                camera.position.y = y + cameraDistance * Math.cos(cameraPhi);
                camera.position.z = z + cameraDistance * Math.sin(cameraPhi) * Math.sin(cameraTheta);
                camera.lookAt(x, y, z);
                
                // Pulse rings (offset rings and main ring)
                scene.children.forEach(child => {
                    if (child.userData.pulseOffset !== undefined && child.material) {
                        const ringPulse = 1.0 + Math.sin((time + child.userData.pulseOffset) * 1.2) * 0.2;
                        child.scale.set(ringPulse, ringPulse, 1);
                        const base = 0.25 - (child.userData.pulseOffset * 0.06);
                        child.material.opacity = Math.max(0.06, base + Math.sin((time + child.userData.pulseOffset) * 1.2) * 0.12);
                    }
                    if (child.userData.isMainRing && child.material) {
                        child.material.opacity = 0.28 + Math.sin(time * 1.5) * 0.12;
                        const s = 1.0 + Math.sin(time * 1.5) * 0.15;
                        child.scale.set(s, s, 1);
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
        function runCreateMap() {
            const mapContainer = document.getElementById('earthquake-interactive-map');
            if (!mapContainer) return;
            // Wait until container is visible and has size so Leaflet tiles load
            const tryCreate = () => {
                const w = mapContainer.offsetWidth;
                const h = mapContainer.offsetHeight;
                if (w > 0 && h > 0) {
                    createMap(lat, lon, magnitude, locationDisplay);
                    return true;
                }
                return false;
            };
            requestAnimationFrame(() => {
                if (tryCreate()) return;
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && tryCreate()) {
                            observer.disconnect();
                        }
                    });
                }, { rootMargin: '100px', threshold: 0 });
                observer.observe(mapContainer);
                setTimeout(() => { tryCreate(); observer.disconnect(); }, 800);
            });
        }
        
        const leafletLink = document.querySelector('link[href*="leaflet"]');
        if (!leafletLink) {
            const leafletCSS = document.createElement('link');
            leafletCSS.rel = 'stylesheet';
            leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            leafletCSS.crossOrigin = 'anonymous';
            leafletCSS.onload = () => loadLeafletJS(runCreateMap);
            leafletCSS.onerror = () => loadLeafletJS(runCreateMap);
            document.head.appendChild(leafletCSS);
        } else {
            loadLeafletJS(runCreateMap);
        }
        
        function loadLeafletJS(whenReady) {
            if (window.L) {
                whenReady();
                return;
            }
            const leafletJS = document.createElement('script');
            leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            leafletJS.crossOrigin = 'anonymous';
            leafletJS.onload = whenReady;
            leafletJS.onerror = whenReady;
            document.head.appendChild(leafletJS);
        }
        
        function createMap(lat, lon, magnitude, locationDisplay) {
            const mapContainer = document.getElementById('earthquake-interactive-map');
            if (!mapContainer) return;
            
            // Remove previous map instance if any (e.g. when re-opening same article)
            if (mapContainer._leafletMap) {
                mapContainer._leafletMap.remove();
                mapContainer._leafletMap = null;
            }
            
            const map = window.L.map('earthquake-interactive-map', {
                preferCanvas: false
            }).setView([lat, lon], 10);
            
            // Use CARTO as primary (reliable, OSM data) - OSM tile server often returns 403
            const cartoLayer = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            });
            const osmLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19
            });
            const topoLayer = window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
                maxZoom: 17
            });
            cartoLayer.addTo(map);
            const tryFallback = (fromLayer, toLayer) => {
                if (map.hasLayer(fromLayer)) {
                    map.removeLayer(fromLayer);
                    toLayer.addTo(map);
                }
            };
            cartoLayer.on('tileerror', () => tryFallback(cartoLayer, osmLayer));
            osmLayer.on('tileerror', () => tryFallback(osmLayer, topoLayer));
            
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
            
            // Add popup with earthquake info (min-width prevents vertical character wrap)
            epicenterMarker.bindPopup(`
                <div style="text-align: center; padding: 0.5rem; min-width: 200px; white-space: normal;">
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
            
            mapContainer._leafletMap = map;
            
            // Force Leaflet to recalculate size so tiles load (container may have 0 size if created off-screen)
            function refreshMapSize() {
                if (mapContainer._leafletMap) {
                    mapContainer._leafletMap.invalidateSize();
                }
            }
            refreshMapSize();
            [100, 300, 500].forEach(ms => setTimeout(refreshMapSize, ms));
            
            // When user scrolls to the map, recalculate size so tiles load if they didn't before
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        refreshMapSize();
                    }
                });
            }, { rootMargin: '50px', threshold: 0.1 });
            observer.observe(mapContainer);
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
        
        let html = '<h2 class="earthquake-section-heading">Nearby Important Locations</h2>';
        
        if (locations.length > 0 || education.length > 0 || venues.length > 0) {
            if (locations.length > 0) {
                html += `
                    <div class="earthquake-nearby-block">
                        <h3 class="earthquake-nearby-subheading">Cities & Landmarks</h3>
                        <div class="earthquake-nearby-grid">
                            ${locations.slice(0, 6).map(loc => `
                                <div class="earthquake-nearby-card">
                                    <div class="earthquake-nearby-card-main">
                                        <span class="earthquake-nearby-name">${escapeHtml(loc.name)}</span>
                                        <span class="earthquake-nearby-type">${escapeHtml(loc.type)}</span>
                                    </div>
                                    <span class="earthquake-nearby-distance">${loc.distance} km</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            if (education.length > 0) {
                html += `
                    <div class="earthquake-nearby-block">
                        <h3 class="earthquake-nearby-subheading">Educational Institutions</h3>
                        <div class="earthquake-nearby-grid">
                            ${education.map(edu => `
                                <div class="earthquake-nearby-card">
                                    <div class="earthquake-nearby-card-main">
                                        <span class="earthquake-nearby-name">${escapeHtml(edu.name)}</span>
                                        <span class="earthquake-nearby-type">${escapeHtml(edu.type === 'university' ? 'University' : edu.type === 'college' ? 'College' : 'School')}</span>
                                    </div>
                                    <span class="earthquake-nearby-distance earthquake-nearby-distance-edu">${edu.distance} km</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            if (venues.length > 0) {
                html += `
                    <div class="earthquake-nearby-block">
                        <h3 class="earthquake-nearby-subheading">Event Venues & Entertainment</h3>
                        <div class="earthquake-nearby-grid">
                            ${venues.slice(0, 6).map(venue => `
                                <div class="earthquake-nearby-card">
                                    <div class="earthquake-nearby-card-main">
                                        <span class="earthquake-nearby-name">${escapeHtml(venue.name)}</span>
                                        <span class="earthquake-nearby-type">${escapeHtml(venue.type.replace(/_/g, ' '))}</span>
                                    </div>
                                    <span class="earthquake-nearby-distance earthquake-nearby-distance-venue">${venue.distance} km</span>
                                </div>
                            `).join('')}
                        </div>
                        <p class="earthquake-nearby-hint">These venues may host concerts, festivals, sports events, or other gatherings. Check local event listings for scheduled activities.</p>
                    </div>
                `;
            }
        }
        
        if (locations.length === 0 && education.length === 0 && venues.length === 0) {
            html += '<p class="earthquake-nearby-empty">No nearby locations found.</p>';
        }
        container.innerHTML = html;
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
            // Fetch post by ID directly (bypasses index - fixes "not found" after editing)
            let response;
            let retries = 2;
            const directUrl = `/.netlify/functions/posts-read?id=${encodeURIComponent(articleId)}`;

            while (retries >= 0) {
                try {
                    response = await fetch(directUrl, {
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

            let posts = await response.json();
            if (!Array.isArray(posts)) {
                throw new Error('Invalid response format from API');
            }

            // If direct lookup returned empty, fall back to full list (legacy ID formats)
            let post = posts[0] || null;
            if (!post && posts.length === 0) {
                const fallbackResponse = await fetch('/.netlify/functions/posts-read?limit=200', {
                    cache: 'default',
                    headers: { 'Accept': 'application/json' }
                });
                if (fallbackResponse.ok) {
                    const allPosts = await fallbackResponse.json();
                    if (Array.isArray(allPosts)) {
                        post = allPosts.find(p => {
                            if (p.id === articleId) return true;
                            if (p.id === `post-${articleId}`) return true;
                            if (articleId.startsWith('usgs-')) {
                                const eventId = articleId.substring(5);
                                if (p.id === `post-usgs-${eventId}` || p.id === `post-${articleId}`) return true;
                                if (p.event_id === eventId || p.canonical_id === `usgs:${eventId}`) return true;
                            }
                            if (p.postId === articleId || p.postId === `post-${articleId}`) return true;
                            if (articleId.startsWith('post-') && p.id === articleId.substring(5)) return true;
                            if (p.id && p.id.startsWith('post-') && p.id.substring(5) === articleId) return true;
                            return false;
                        }) || null;
                    }
                }
            }

            if (!post) {
                console.error('[ArticleLoader] Post not found. ArticleId:', articleId);
                const debugPosts = Array.isArray(posts) ? posts : [];
                console.log('[ArticleLoader] First 5 post IDs:', debugPosts.slice(0, 5).map(p => ({ id: p.id, postId: p.postId, title: (p.title || p.story || p.text || '').substring(0, 50) })));
                headingElement.textContent = 'Article Not Found';
                bodyElement.innerHTML = `<p>Article with ID "${articleId}" not found. Please return to the <a href="/index.html" style="color: #4A90E2;">homepage</a>.</p><p style="margin-top: 1rem; font-size: 0.875rem; color: rgba(255,255,255,0.6);">Debug: Direct lookup returned ${Array.isArray(posts) ? posts.length : 0} post(s).</p>`;
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
            
            // Update article body - Hero image FIRST (like AP News), then key takeaways, then text
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
            
            // Filter for video URLs (used below)
            const isVideoUrl = (url) => url && typeof url === 'string' && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.toLowerCase());
            // STEP 3: Canonical image resolution (SINGLE SOURCE OF TRUTH)
            // For earthquakes: prefer generated image (get-uploaded-image) over raw usgs_images
            let primary = post.primary_image_url || post.image_url || post.image || null;
            if (post.category === 'Earthquake' || post.source === 'USGS') {
                const fromAssets = post.assets?.standard_image || post.assets?.image_url || post.assets?.generated_image;
                if (fromAssets) primary = primary || fromAssets;
                if (!primary && post.images && post.images.length > 0) {
                    const generated = post.images.find(u => u && typeof u === 'string' && u.includes('get-uploaded-image') && u.includes('earthquake'));
                    if (generated) primary = generated;
                }
                if (!primary) {
                    const usgsImages = post.assets?.usgs_images || post.usgs_images || [];
                    const firstUsgs = usgsImages[0];
                    primary = firstUsgs ? (typeof firstUsgs === 'string' ? firstUsgs : firstUsgs?.url) : null;
                }
            }
            // Don't treat video URLs as primary image (legacy data may have mixed)
            if (primary && isVideoUrl(primary)) primary = null;
            
            // STEP 4: Build deduplicated secondary image list (NEVER includes primary, excludes videos)
            const secondaryCandidates = [
                ...(post.secondary_images || []),
                ...(post.images || []),
                ...(post.assets?.images || []),
                ...(post.usgs_images || []),
                ...(post.assets?.usgs_images || [])
            ].filter(Boolean).filter(u => !isVideoUrl(u));
            
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
                    bodyHTML += `<div class="article-media article-media-hero" data-image-url="${escapeHtml(absoluteImageUrl)}">
                        <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" loading="eager" 
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
                                        container.innerHTML='<p class=\\'image-error\\' style=\\'color: #666; padding: 0.5rem; text-align: center; font-size: 0.8125rem; margin: 0;\\'>Image unavailable</p>';
                                    }
                                }
                             })(this);">
                    </div>`;
                } else {
                    // For regular images, use simple error handling (dark text for white background visibility)
                    bodyHTML += `<div class="article-media article-media-hero">
                        <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" loading="eager" 
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<p style=\\'color: #666; padding: 2rem; text-align: center;\\'>Image could not be loaded</p>';">
                    </div>`;
                }
            }
            
            // Key takeaways after hero image
            bodyHTML += buildKeyTakeawaysHTML(post);
            
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

            // Render videos (MP4, WebM, etc. - from admin upload or post data)
            // Deduplicate: video_url/video/assets.video_url may also appear in post.videos
            const articleVideosRaw = [
                ...(post.video_url || post.video || post.assets?.video_url ? [post.video_url || post.video || post.assets?.video_url] : []),
                ...(post.videos || [])
            ].filter(Boolean);
            const videoUrls = articleVideosRaw
                .filter(u => u && isVideoUrl(u))
                .map(u => ensureAbsoluteImageUrl(u))
                .filter((url, i, arr) => arr.findIndex(u => normalizeUrl(u) === normalizeUrl(url)) === i);
            if (videoUrls.length > 0 && !primary) {
                // Video as hero when no primary image
                const videoUrl = ensureAbsoluteImageUrl(videoUrls[0]);
                bodyHTML += `<div class="article-media article-media-hero">
                    <video src="${escapeHtml(videoUrl)}" controls style="width:100%;max-height:500px;border-radius:12px;" playsinline></video>
                </div>`;
            }
            videoUrls.forEach((vUrl, idx) => {
                if (idx === 0 && !primary) return; // Already rendered as hero
                const absoluteVideoUrl = ensureAbsoluteImageUrl(vUrl);
                bodyHTML += `<div class="article-media" style="margin-top: 1.5rem;">
                    <video src="${escapeHtml(absoluteVideoUrl)}" controls style="width:100%;max-height:500px;border-radius:12px;" playsinline></video>
                </div>`;
            });
            
            // Add post text - preserve line breaks as paragraphs
            bodyHTML += formatPostText(story);

            // Source URLs extracted from X post entities
            const sourceUrls = Array.isArray(post.source_urls) ? post.source_urls : [];
            if (sourceUrls.length > 0) {
                bodyHTML += '<div class="article-sources" style="margin-top: 1.5rem; padding: 1rem 1.25rem; background: #f8f9fa; border-left: 3px solid #4A90E2; border-radius: 4px;">';
                bodyHTML += '<h4 style="margin: 0 0 0.5rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-family: Inter, sans-serif;">Sources</h4>';
                sourceUrls.forEach(function(s) {
                    const href = escapeHtml(typeof s === 'string' ? s : s.url);
                    const label = escapeHtml(typeof s === 'string' ? s : (s.display || s.title || s.url));
                    bodyHTML += '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="display: block; color: #4A90E2; font-size: 0.9rem; margin-bottom: 4px; word-break: break-all;">' + label + '</a>';
                });
                bodyHTML += '</div>';
            }

            // "View on X" link for X-sourced posts
            const xUrl = post.x_url || post.link;
            if (xUrl && (xUrl.includes('x.com') || xUrl.includes('twitter.com'))) {
                bodyHTML += '<a href="' + escapeHtml(xUrl) + '" target="_blank" rel="noopener noreferrer" '
                    + 'style="display: inline-flex; align-items: center; gap: 6px; margin-top: 1.5rem; padding: 10px 18px; '
                    + 'background: #000; color: #fff; border-radius: 8px; font-size: 0.875rem; font-weight: 600; '
                    + 'text-decoration: none; font-family: Inter, sans-serif; transition: opacity 0.15s;" '
                    + 'onmouseover="this.style.opacity=\'0.85\'" onmouseout="this.style.opacity=\'1\'">'
                    + '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
                    + 'View on X</a>';
            }

            // Check for coordinates in multiple places (lat/lon at top level, or in raw geometry, or in assets)
            // Note: isEarthquake is already declared above (line 1577), so reuse it
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
            const earthquakeMagnitude = post.assets?.magnitude || post.magnitude;
            
            console.log('[ArticleLoader] Earthquake check:', {
                isEarthquake,
                hasCoordinates,
                lat: post.lat,
                lon: post.lon,
                magnitude: earthquakeMagnitude,
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
                    magnitude: earthquakeMagnitude,
                    lat: post.lat,
                    lon: post.lon,
                    source: post.source,
                    category: post.category,
                    hasAssets: !!post.assets
                });
                const enhancementsHTML = await generateEarthquakeEnhancements(post, earthquakeMagnitude);
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

            // Mark first paragraph for lead/drop-cap styling
            const firstP = bodyElement.querySelector('p');
            if (firstP) firstP.classList.add('lead-paragraph');

            // Heading IDs and table of contents (sidebar)
            buildTableOfContents(bodyElement);
            if (typeof window.initArticleTocScrollSpy === 'function') {
                window.initArticleTocScrollSpy();
            }

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
                    initializeEarthquakeMap(post.lat, post.lon, earthquakeMagnitude, post.location_display || post.location);
                    const depth = post.assets?.depth || post.depth;
                    initialize3DVisualization(post.lat, post.lon, earthquakeMagnitude, depth, post.location_display || post.location);
                }, 100);
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
