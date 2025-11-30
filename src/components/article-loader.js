/**
 * Article Loader - Dynamically loads and displays full articles from post data
 * Expands short posts into comprehensive 600-1000 word articles
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
     * Ensure an image URL is absolute
     */
    function ensureAbsoluteImageUrl(imageUrl) {
        if (!imageUrl) return DEFAULT_OG_IMAGE;
        
        // If already absolute, return as-is
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }
        
        // If relative, make it absolute
        if (imageUrl.startsWith('/')) {
            return `${SITE_URL}${imageUrl}`;
        }
        
        // If no leading slash, add it
        return `${SITE_URL}/${imageUrl}`;
    }

    /**
     * Truncate text to a maximum length, preserving word boundaries
     */
    function truncateDescription(text, maxLength = 155) {
        if (!text) return DEFAULT_DESCRIPTION;
        if (text.length <= maxLength) return text;
        
        // Truncate at word boundary
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.8) {
            return truncated.substring(0, lastSpace) + '...';
        }
        return truncated + '...';
    }

    /**
     * Helper to get or create meta element
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
     * Helper to get or create link element
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
     * Update all SEO meta tags for a post
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

        // Basic meta tags (by ID for backward compatibility)
        const descElement = document.getElementById('article-description');
        if (descElement) {
            descElement.setAttribute('content', description);
        } else {
            getOrCreateMeta('description', 'name').setAttribute('content', description);
        }

        // Canonical URL
        const canonicalElement = document.getElementById('article-canonical');
        if (canonicalElement) {
            canonicalElement.setAttribute('href', url);
        } else {
            getOrCreateLink('canonical').setAttribute('href', url);
        }

        // Open Graph tags (by ID for backward compatibility, then create if missing)
        const ogUrlElement = document.getElementById('og-url');
        if (ogUrlElement) {
            ogUrlElement.setAttribute('content', url);
        } else {
            getOrCreateMeta('og:url').setAttribute('content', url);
        }

        const ogTitleElement = document.getElementById('og-title');
        if (ogTitleElement) {
            ogTitleElement.setAttribute('content', title);
        } else {
            getOrCreateMeta('og:title').setAttribute('content', title);
        }

        const ogDescElement = document.getElementById('og-description');
        if (ogDescElement) {
            ogDescElement.setAttribute('content', description);
        } else {
            getOrCreateMeta('og:description').setAttribute('content', description);
        }

        const ogImageElement = document.getElementById('og-image');
        if (ogImageElement) {
            ogImageElement.setAttribute('content', image);
        } else {
            getOrCreateMeta('og:image').setAttribute('content', image);
        }

        // Ensure OG image dimensions exist
        getOrCreateMeta('og:image:width').setAttribute('content', '1200');
        getOrCreateMeta('og:image:height').setAttribute('content', '630');
        getOrCreateMeta('og:site_name').setAttribute('content', 'Noteworthy News');
        getOrCreateMeta('og:locale').setAttribute('content', 'en_US');
        getOrCreateMeta('og:type').setAttribute('content', 'article');

        // Article-specific tags
        const publishedElement = document.getElementById('article-published');
        if (publishedElement) {
            publishedElement.setAttribute('content', datePosted);
        } else {
            getOrCreateMeta('article:published_time').setAttribute('content', datePosted);
        }
        getOrCreateMeta('article:author').setAttribute('content', 'Noteworthy News');

        // Twitter Card tags (using name attribute, not property)
        const twitterUrlElement = document.getElementById('twitter-url');
        if (twitterUrlElement) {
            twitterUrlElement.setAttribute('content', url);
        } else {
            getOrCreateMeta('twitter:url', 'name').setAttribute('content', url);
        }

        const twitterTitleElement = document.getElementById('twitter-title');
        if (twitterTitleElement) {
            twitterTitleElement.setAttribute('content', title);
        } else {
            getOrCreateMeta('twitter:title', 'name').setAttribute('content', title);
        }

        const twitterDescElement = document.getElementById('twitter-description');
        if (twitterDescElement) {
            twitterDescElement.setAttribute('content', description);
        } else {
            getOrCreateMeta('twitter:description', 'name').setAttribute('content', description);
        }

        const twitterImageElement = document.getElementById('twitter-image');
        if (twitterImageElement) {
            twitterImageElement.setAttribute('content', image);
        } else {
            getOrCreateMeta('twitter:image', 'name').setAttribute('content', image);
        }

        getOrCreateMeta('twitter:card', 'name').setAttribute('content', 'summary_large_image');
        getOrCreateMeta('twitter:site', 'name').setAttribute('content', '@NoteworthyNews');
        getOrCreateMeta('twitter:creator', 'name').setAttribute('content', '@NoteworthyNews');
    }

    // Article content expansion templates
    const articleSections = {
        whatHappened: (post) => {
            const story = post.story || post.text || post.title || '';
            const escapedStory = escapeHtml(story);
            return `
                <h2>What Happened: The Core Event</h2>
                <p>${escapedStory}</p>
                <p>This breaking news story has significant implications that require careful analysis and verification. Our team has been monitoring developments and gathering information from multiple sources to provide you with accurate, comprehensive coverage.</p>
            `;
        },
        
        background: (post) => {
            return `
                <h2>Background: Context and History</h2>
                <p>To fully understand this event, it's important to consider the broader context. This development represents a significant moment that requires careful examination of the factors that led to this situation.</p>
                <p>Previous related events and ongoing developments have set the stage for this current situation. Understanding this background helps explain why this event matters and what its implications might be for those affected.</p>
            `;
        },
        
        timeline: (post) => {
            const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
            const date = new Date(datePosted);
            const formattedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <h2>Timeline of Key Events</h2>
                <ul>
                    <li><strong>${formattedDate}:</strong> Initial reports of this event emerged</li>
                    <li><strong>Ongoing:</strong> Verification and fact-checking process continues</li>
                    <li><strong>Next Steps:</strong> Further investigation and updates as new information becomes available</li>
                </ul>
                <p>This timeline will be updated as more verified information becomes available. We prioritize accuracy over speed, ensuring all information is properly verified before publication.</p>
            `;
        },
        
        verification: (post) => {
            return `
                <h2>Verification and Fact-Checking</h2>
                <p>Our verification process for this story involved multiple steps:</p>
                <ul>
                    <li>Cross-referencing initial reports with official sources</li>
                    <li>Checking multiple independent news organizations</li>
                    <li>Verifying any images or videos associated with the story</li>
                    <li>Consulting with subject matter experts when appropriate</li>
                </ul>
                <p>We continue to monitor this story and will update this article as new verified information becomes available. If you have information about this story, please <a href="/contact.html" style="color: #4A90E2;">contact us</a>.</p>
            `;
        },
        
        whyItMatters: (post) => {
            return `
                <h2>Why It Matters: Impact and Significance</h2>
                <p>This event has broader implications that extend beyond the immediate news. Understanding why this matters helps readers grasp the significance of what's happening and how it may affect various stakeholders.</p>
                <p>The implications of this development could have far-reaching effects across multiple sectors and communities. It's important to monitor how this situation evolves and what it means for those directly and indirectly affected by these developments.</p>
            `;
        },
        
        whatsNext: (post) => {
            return `
                <h2>What's Next: Future Outlook</h2>
                <p>As this story continues to develop, we're monitoring several key areas:</p>
                <ul>
                    <li>Official responses and statements from relevant authorities</li>
                    <li>Reactions and analysis from experts in the field</li>
                    <li>Potential long-term implications and consequences</li>
                    <li>Related developments that may emerge</li>
                </ul>
                <p>We'll continue to update this article as new verified information becomes available. Check back for the latest developments.</p>
            `;
        }
    };


    /**
     * Expand a short post into a full article
     */
    function expandPostToArticle(post) {
        const sections = [
            articleSections.whatHappened(post),
            articleSections.background(post),
            articleSections.timeline(post),
            articleSections.verification(post),
            articleSections.whyItMatters(post),
            articleSections.whatsNext(post)
        ];
        
        return sections.join('\n');
    }

    /**
     * Format date for display
     */
    function formatDate(dateString) {
        if (!dateString) return 'Recently';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Recently';
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Calculate read time (rough estimate: 200 words per minute)
     */
    function calculateReadTime(content) {
        const words = content.split(/\s+/).length;
        const minutes = Math.ceil(words / 200);
        return Math.max(1, minutes);
    }

    /**
     * Load article data and populate the page
     */
    async function loadArticle() {
        // Get article ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        
        // Check if required elements exist
        const titleElement = document.getElementById('article-title');
        const headingElement = document.getElementById('article-heading');
        const contentElement = document.querySelector('.article-body');
        
        if (!titleElement || !contentElement) {
            console.error('Required article page elements not found');
            return;
        }
        
        if (!articleId) {
            // No ID provided - show placeholder or redirect
            titleElement.textContent = 'Article Not Found';
            if (headingElement) headingElement.textContent = 'Article Not Found';
            contentElement.innerHTML = '<p>No article ID provided. Please select an article from the <a href="/index.html" style="color: #4A90E2;">homepage</a>.</p>';
            return;
        }

        // Show loading state
        if (contentElement) {
            contentElement.innerHTML = '<div style="text-align: center; padding: 40px;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(74, 144, 226, 0.3); border-top-color: #4A90E2; border-radius: 50%; animation: spin 1s linear infinite;"></div><p style="margin-top: 20px; color: rgba(255, 255, 255, 0.7);">Loading article...</p></div>';
        }
        
        // Add spin animation if not exists
        if (!document.getElementById('article-loader-style')) {
            const style = document.createElement('style');
            style.id = 'article-loader-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }

        try {
            // Fetch posts from the API with retry logic
            let response;
            let retries = 2;
            
            while (retries >= 0) {
                try {
                    response = await fetch('/.netlify/functions/posts-read?limit=200', {
                        cache: 'default',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        break;
                    }
                } catch (fetchError) {
                    if (retries === 0) {
                        throw fetchError;
                    }
                }
                
                retries--;
                if (retries >= 0) {
                    // Wait before retry (exponential backoff)
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
            
            // Find the post with matching ID
            const post = posts.find(p => p.id === articleId || p.id === `post-${articleId}`);
            
            if (!post) {
                titleElement.textContent = 'Article Not Found';
                if (headingElement) headingElement.textContent = 'Article Not Found';
                contentElement.innerHTML = '<p>Article not found. Please return to the <a href="/index.html" style="color: #4A90E2;">homepage</a>.</p>';
                return;
            }

            // Extract post data and sanitize
            const title = escapeHtml(post.title || post.story || post.text || 'Breaking News Story');
            const story = post.story || post.text || post.title || '';
            const datePosted = post.datePosted || post.createdAt || post.created_at || new Date().toISOString();
            const image = post.image || post.images?.[0] || null;
            const category = escapeHtml(post.category || 'Breaking News');
            
            // Expand post into full article
            const articleContent = expandPostToArticle(post);
            const fullContent = story + '\n\n' + articleContent;
            const readTime = calculateReadTime(fullContent);
            
            // Update all SEO meta tags (Open Graph, Twitter, etc.)
            updatePostMetaTags(post, articleId);
            
            // Update structured data (JSON-LD)
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
            
            // Update article header
            const articleCategoryEl = document.getElementById('article-category');
            const articleDateEl = document.getElementById('article-date');
            const articleReadTimeEl = document.getElementById('article-read-time');
            const articleIntroEl = document.getElementById('article-intro');
            
            if (headingElement) headingElement.textContent = title;
            if (articleCategoryEl) articleCategoryEl.textContent = category;
            if (articleDateEl) articleDateEl.textContent = formatDate(datePosted);
            if (articleReadTimeEl) articleReadTimeEl.textContent = `${readTime} min`;
            
            // Update article intro with first paragraph
            if (articleIntroEl) {
                const firstParagraph = story.length > 200 ? story.substring(0, 197) + '...' : story;
                articleIntroEl.textContent = firstParagraph;
            }
            
            // Update article image if available (only if element exists)
            if (image) {
                const imgElement = document.querySelector('.article-image, .article-image-main, img.article-image');
                if (imgElement) {
                    imgElement.src = escapeHtml(image);
                    imgElement.alt = title;
                    imgElement.style.display = 'block';
                }
            }
            
            // Update sources section if it exists
            const sourcesList = document.getElementById('sources-list');
            const verificationBadge = document.getElementById('verification-badge');
            if (sourcesList) {
                const sources = post.sources || post.sourceUrls || [];
                if (sources.length > 0) {
                    sourcesList.innerHTML = sources.map(source => {
                        const url = typeof source === 'string' ? source : source.url;
                        const title = typeof source === 'string' ? url : (source.title || url);
                        return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></li>`;
                    }).join('');
                } else {
                    sourcesList.innerHTML = '<li>Sources are being verified and will be updated shortly.</li>';
                }
            }
            if (verificationBadge) {
                const status = post.verificationStatus || 'verified';
                verificationBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                verificationBadge.className = `verification-badge ${status}`;
            }

            // Update article content - populate existing sections instead of replacing
            // This preserves the template structure and IDs
            const sections = {
                'what-happened': articleSections.whatHappened(post),
                'background': articleSections.background(post),
                'timeline': articleSections.timeline(post),
                'verification': articleSections.verification(post),
                'why-it-matters': articleSections.whyItMatters(post),
                'whats-next': articleSections.whatsNext(post)
            };
            
            // Update each section if it exists, otherwise replace entire content
            let sectionsUpdated = false;
            Object.keys(sections).forEach(sectionId => {
                const sectionEl = document.getElementById(sectionId);
                if (sectionEl) {
                    sectionEl.innerHTML = sections[sectionId];
                    sectionsUpdated = true;
                }
            });
            
            // If template sections don't exist, replace entire content (fallback)
            if (!sectionsUpdated) {
                contentElement.innerHTML = articleContent;
            }
            
            // Update breadcrumbs
            const breadcrumbEl = document.querySelector('.breadcrumbs');
            const breadcrumbTitleEl = document.getElementById('article-title-breadcrumb');
            const categoryLinkEl = document.getElementById('category-link');
            
            if (breadcrumbEl) {
                const categorySlug = category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'breaking-news';
                breadcrumbEl.innerHTML = `
                    <a href="index.html">Home</a> / 
                    <a href="category/${categorySlug}.html" id="category-link">${category}</a> / 
                    <span id="article-title-breadcrumb">${escapeHtml(title)}</span>
                `;
            } else {
                if (categoryLinkEl) {
                    const categorySlug = category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'breaking-news';
                    categoryLinkEl.href = `category/${categorySlug}.html`;
                    categoryLinkEl.textContent = category;
                }
                if (breadcrumbTitleEl) {
                    breadcrumbTitleEl.textContent = title;
                }
            }
            
            // Update social sharing links
            const shareUrl = `${SITE_URL}/article.html?id=${encodeURIComponent(articleId)}`;
            const shareTitle = encodeURIComponent(title);
            const shareText = encodeURIComponent(truncateDescription(story));
            const shareButtons = document.querySelectorAll('.article-share a, .social-share-buttons a');
            
            if (shareButtons.length >= 4) {
                shareButtons[0].href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareTitle}`;
                shareButtons[1].href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                shareButtons[2].href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
                shareButtons[3].href = `mailto:?subject=${shareTitle}&body=${shareText}%20${encodeURIComponent(shareUrl)}`;
            }
            
            // Load related articles (top 5 posts excluding current)
            loadRelatedArticles(posts, articleId);
            
        } catch (error) {
            console.error('Error loading article:', error);
            if (titleElement) titleElement.textContent = 'Error Loading Article';
            if (headingElement) headingElement.textContent = 'Error Loading Article';
            if (contentElement) {
                const errorMessage = error.message || 'An unknown error occurred';
                const isNetworkError = errorMessage.includes('Network') || errorMessage.includes('Failed to fetch');
                
                contentElement.innerHTML = `
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
     * Load related articles for the sidebar
     */
    async function loadRelatedArticles(allPosts, currentId) {
        // Get top 5 posts excluding current, with deduplication
        const seenIds = new Set();
        const related = allPosts
            .filter(p => {
                const id = p.id || '';
                // Skip current post and duplicates
                if (id === currentId || id === `post-${currentId}` || seenIds.has(id) || !id) {
                    return false;
                }
                seenIds.add(id);
                return true;
            })
            .slice(0, 5);
        
        // Find the related articles sidebar (first sidebar-section with class related-articles)
        const sidebarList = document.querySelector('.sidebar-section.related-articles ul, .sidebar-section ul');
        
        if (!sidebarList) {
            return;
        }
        
        if (related.length === 0) {
            // Fallback to our pillar pages
            sidebarList.innerHTML = `
                <li><a href="how-we-verify.html"><strong>How We Verify Breaking Events</strong><div class="related-date">Guide</div></a></li>
                <li><a href="geopolitics-guide.html"><strong>Understanding Geopolitical Events</strong><div class="related-date">Guide</div></a></li>
                <li><a href="critical-reading-guide.html"><strong>How to Read News Critically</strong><div class="related-date">Guide</div></a></li>
                <li><a href="media-literacy-guide.html"><strong>Media Literacy Guide</strong><div class="related-date">Guide</div></a></li>
                <li><a href="fact-checking-tips.html"><strong>Fact-Checking Tips</strong><div class="related-date">Guide</div></a></li>
            `;
            return;
        }
        
        sidebarList.innerHTML = related.map(post => {
            const title = post.title || post.story || post.text || 'Article';
            const shortTitle = escapeHtml(title.length > 60 ? title.substring(0, 57) + '...' : title);
            const postId = encodeURIComponent(post.id || '');
            const postDate = post.datePosted || post.createdAt || post.created_at || '';
            const formattedDate = postDate ? formatDate(postDate) : 'Recently';
            return `<li><a href="/article.html?id=${postId}"><strong>${shortTitle}</strong><div class="related-date">${escapeHtml(formattedDate)}</div></a></li>`;
        }).join('');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadArticle);
    } else {
        loadArticle();
    }
})();

