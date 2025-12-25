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
                bodyHTML += `<div class="article-media">
                    <img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='<p style=\\'color: rgba(255,255,255,0.6); padding: 2rem; text-align: center;\\'>Image could not be loaded</p>';">
                </div>`;
            }
            
            // Render secondary images ONLY if they exist and are different from primary
            if (secondary.length > 0) {
                secondary.forEach((imgUrl, idx) => {
                    bodyHTML += `<div class="article-media" style="margin-top: 1.5rem;">
                        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)} - Image ${idx + 2}" loading="lazy" onerror="this.style.display='none';">
                    </div>`;
                });
            }
            
            // Add post text - preserve line breaks as paragraphs
            bodyHTML += formatPostText(story);
            
            bodyElement.innerHTML = bodyHTML;
            
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
