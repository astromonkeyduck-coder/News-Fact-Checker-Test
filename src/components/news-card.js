/**
 * NewsCard Component - Reusable card for displaying article previews
 * Used in sidebar, related articles, and "more coverage" sections
 */

(function() {
    'use strict';

    const PLACEHOLDER_ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22h16a2 2 0 0 0 2-2V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v16a2 2 0 0 0 2 2Z"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/><path d="M2 6h4v14"/></svg>';

    /**
     * Format relative time (e.g., "2h ago", "3d ago")
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
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate stable ID for post
     */
    function getPostId(post) {
        if (post.id) return post.id;
        
        // Create hash from content if no ID
        const content = post.story || post.text || post.title || '';
        if (content) {
            let hash = 0;
            const str = content.substring(0, 100);
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return `post-${Math.abs(hash)}`;
        }
        
        return `post-${Date.now()}`;
    }

    /**
     * Create a NewsCard HTML element
     * @param {Object} post - Post object with id, story/text, datePosted, image, etc.
     * @param {Object} options - Options for rendering
     * @returns {string} HTML string for the card
     */
    function createNewsCard(post, options = {}) {
        const {
            showThumbnail = false,
            maxTitleLength = 80,
            className = '',
            enhanced = false
        } = options;

        const postId = getPostId(post);
        const cn = (typeof window !== 'undefined' && window.ContentNormalize) || null;
        const title = (cn && cn.cleanHeadline)
            ? cn.cleanHeadline(post)
            : (post.title || post.story || post.text || 'Untitled');
        const shortTitle = (cn && cn.truncate)
            ? cn.truncate(title, maxTitleLength)
            : (title.length > maxTitleLength ? title.substring(0, maxTitleLength - 3) + '...' : title);
        const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
        const relativeTime = formatRelativeTime(datePosted);
        const image = post.primary_image_url || post.image_url || post.image || post.images?.[0] || null;
        const category = post.category || 'Breaking News';
        const articleUrl = `/article.html?id=${encodeURIComponent(postId)}`;

        let cardHTML = `<a href="${articleUrl}" class="news-card ${className}" aria-label="Read article: ${escapeHtml(shortTitle)}">`;
        
        if (showThumbnail) {
            // Detect image variant for smart cropping
            const imageUrl = image || '';
            const isEarthquakeGraphic = imageUrl.includes('earthquake-') || 
                                       imageUrl.includes('standard') || 
                                       post.category === 'Earthquake' ||
                                       post.source === 'USGS';
            const variant = isEarthquakeGraphic ? 'earthquake' : 'photo';
            
            cardHTML += `<div class="news-card-thumbnail-wrapper">`;
            
            if (image) {
                cardHTML += `<img 
                    src="${escapeHtml(image)}" 
                    alt="${escapeHtml(shortTitle)}" 
                    class="news-card-thumbnail" 
                    data-variant="${variant}"
                    loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                >`;
            }
            
            // Placeholder for missing/broken images
            const placeholderStyle = image ? 'display: none;' : '';
            cardHTML += `<div class="news-card-thumbnail-placeholder" style="${placeholderStyle}">
                <div class="news-card-thumbnail-placeholder-icon">${PLACEHOLDER_ICON}</div>
                <div class="news-card-thumbnail-placeholder-text">${escapeHtml(category)}</div>
            </div>`;
            
            cardHTML += `</div>`;
        }
        
        if (enhanced) {
            // Enhanced card with content wrapper
            cardHTML += `
                <div class="news-card-content">
                    <h3 class="news-card-title">${escapeHtml(shortTitle)}</h3>
                    <div class="news-card-meta">
                        <span class="news-card-category">${escapeHtml(category)}</span>
                        <span>${escapeHtml(relativeTime)}</span>
                    </div>
                </div>
            `;
        } else {
            // Standard card
            cardHTML += `
                <h3 class="news-card-title">${escapeHtml(shortTitle)}</h3>
                <div class="news-card-meta">
                    <span>${escapeHtml(relativeTime)}</span>
                </div>
            `;
        }
        
        cardHTML += `</a>`;

        return cardHTML;
    }

    /**
     * Render multiple news cards to a container
     * @param {Array} posts - Array of post objects
     * @param {string|HTMLElement} container - Container selector or element
     * @param {Object} options - Options for rendering
     */
    function renderNewsCards(posts, container, options = {}) {
        const containerEl = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!containerEl) {
            console.warn('[NewsCard] Container not found:', container);
            return;
        }

        if (!Array.isArray(posts) || posts.length === 0) {
            containerEl.innerHTML = '<p style="color: rgba(255, 255, 255, 0.5); font-size: 0.9rem;">No articles available.</p>';
            return;
        }

        const cardsHTML = posts
            .filter(post => post && (post.story || post.text || post.title))
            .map(post => createNewsCard(post, options))
            .join('');

        containerEl.innerHTML = cardsHTML;
    }

    // Export to global scope
    window.NewsCard = {
        create: createNewsCard,
        render: renderNewsCards
    };
})();



