/**
 * Article Page Functionality
 * Reading progress, lightbox, share menu, text controls, print, keyboard nav
 */

// Create subtle starfield
(function() {
    const starfield = document.getElementById('starfield');
    if (starfield) {
        const starCount = 50;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.animationDuration = (2 + Math.random() * 2) + 's';
            starfield.appendChild(star);
        }
    }
})();

// Reading Progress Indicator
function updateReadingProgress() {
    const article = document.querySelector('.article-body');
    if (!article) return;
    
    const articleTop = article.offsetTop;
    const articleHeight = article.scrollHeight;
    const windowHeight = window.innerHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    const articleBottom = articleTop + articleHeight;
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + windowHeight;
    
    let progress = 0;
    if (viewportTop < articleTop) {
        // Haven't reached article yet
        progress = 0;
    } else if (viewportBottom > articleBottom) {
        // Scrolled past article
        progress = 100;
    } else {
        // Reading article
        const readHeight = viewportBottom - articleTop;
        progress = Math.min(100, (readHeight / articleHeight) * 100);
    }
    
    const progressBar = document.getElementById('reading-progress-bar');
    if (progressBar) {
        progressBar.style.width = progress + '%';
        document.getElementById('reading-progress').setAttribute('aria-valuenow', Math.round(progress));
    }
}

// Image Lightbox
function initImageLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const articleImages = document.querySelectorAll('.article-media img, .article-body img');
    
    // Fix: Check if lightbox elements exist before using them
    if (!lightbox || !lightboxImage) {
        console.warn('[Article] Lightbox elements not found, skipping lightbox initialization');
        return;
    }
    
    function openLightbox(src, alt) {
        if (!lightbox || !lightboxImage) return;
        lightboxImage.src = src;
        lightboxImage.alt = alt || 'Article image';
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    
    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    
    articleImages.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            openLightbox(img.src, img.alt);
        });
    });
    
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

// Share Menu - Will be updated by article-loader.js when article loads
function initShareMenu() {
    const shareBtn = document.getElementById('share-menu-btn');
    const shareMenu = document.getElementById('share-menu');
    
    if (!shareBtn || !shareMenu) return;
    
    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = shareMenu.getAttribute('aria-hidden') === 'false';
        
        if (!isOpen) {
            // Make menu visible first to calculate dimensions
            shareMenu.style.display = 'block';
            shareMenu.style.opacity = '0';
            
            // Position menu near the button
            const btnRect = shareBtn.getBoundingClientRect();
            const menuRect = shareMenu.getBoundingClientRect();
            const menuHeight = menuRect.height || 250;
            const menuWidth = menuRect.width || 200;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Calculate position
            let top = btnRect.bottom + 8;
            let left = btnRect.left;
            
            // If menu would go below viewport, show it above the button
            if (top + menuHeight > viewportHeight - 10) {
                top = btnRect.top - menuHeight - 8;
            }
            
            // If menu would go off right edge, align to right edge of button instead
            if (left + menuWidth > viewportWidth - 20) {
                left = btnRect.right - menuWidth;
                // If that still goes off the left edge, position from right with margin
                if (left < 20) {
                    left = viewportWidth - menuWidth - 20;
                }
            }
            
            // If menu would go off left edge, add margin from left
            if (left < 20) {
                left = 20;
            }
            
            // Ensure menu stays within viewport with margins
            top = Math.max(10, Math.min(top, viewportHeight - menuHeight - 10));
            
            shareMenu.style.top = `${top}px`;
            shareMenu.style.left = `${left}px`;
            shareMenu.style.right = 'auto';
            
            // Fade in
            setTimeout(() => {
                shareMenu.style.opacity = '1';
            }, 10);
            
            // Scroll button into view if needed
            shareBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            shareMenu.style.opacity = '0';
            setTimeout(() => {
                shareMenu.style.display = 'none';
            }, 200);
        }
        
        shareMenu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        shareBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    
    // Close menu when clicking outside (but allow share links to work)
    document.addEventListener('click', (e) => {
        // Don't close if clicking on a share link
        if (e.target.closest('.share-option')) {
            // Allow the link to navigate normally
            return;
        }
        
        if (!shareMenu.contains(e.target) && e.target !== shareBtn) {
            shareMenu.style.opacity = '0';
            setTimeout(() => {
                shareMenu.style.display = 'none';
            }, 200);
            shareMenu.setAttribute('aria-hidden', 'true');
            shareBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

// Function to update share links (called by article-loader.js)
window.updateShareMenu = function(articleTitle, articleUrl, isEarthquake = false, magnitude = null, location = null) {
    const shareMenu = document.getElementById('share-menu');
    if (!shareMenu) {
        console.warn('[Share Menu] Share menu element not found');
        return;
    }
    
    // Helper function to get earthquake hashtags
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
            'california': { tag: '#terremoto', lang: 'Spanish' },
            
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
    
    // For earthquakes, use the proper format: "BREAKING: M___ Earthquake Near ___. #hashtags"
    let shareText = articleTitle;
    if (isEarthquake && magnitude && location) {
        const magnitudeFormatted = typeof magnitude === 'number' ? magnitude.toFixed(1) : magnitude;
        const hashtags = getEarthquakeHashtags(location);
        shareText = `BREAKING: M${magnitudeFormatted} Earthquake Near ${location}. ${hashtags}`;
    }
    
    // Setup share links with proper text
    const shareLinks = {
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(articleUrl)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
        email: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${articleUrl}`)}`,
        reddit: `https://reddit.com/submit?url=${encodeURIComponent(articleUrl)}&title=${encodeURIComponent(shareText)}`
    };
    
    // Update each share link
    Object.keys(shareLinks).forEach(platform => {
        const link = document.getElementById(`share-${platform}`);
        if (link) {
            link.href = shareLinks[platform];
            // Ensure link is clickable and opens in new tab (except email)
            if (platform !== 'email') {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            // Remove any click handlers that might prevent navigation
            link.onclick = null;
            // Ensure clicks on share links work properly
            link.addEventListener('click', (e) => {
                // Allow the link to navigate normally
                e.stopPropagation(); // Prevent closing menu immediately
                // The browser will handle navigation via href
            }, { once: false });
        } else {
            console.warn(`[Share Menu] Link not found for platform: ${platform}`);
        }
    });
    
    console.log('[Share Menu] Share links updated', { shareText, articleUrl, shareLinks });
};

// Text Size Controls
function initTextSizeControls() {
    const decreaseBtn = document.getElementById('text-size-decrease');
    const resetBtn = document.getElementById('text-size-reset');
    const increaseBtn = document.getElementById('text-size-increase');
    const articleBody = document.querySelector('.article-body');
    
    if (!articleBody) return;
    
    const sizes = ['text-small', '', 'text-large', 'text-xlarge'];
    let currentSize = 1; // Default (no class)
    
    // Load saved preference
    const savedSize = localStorage.getItem('article-text-size');
    if (savedSize) {
        currentSize = parseInt(savedSize) || 1;
        if (sizes[currentSize]) {
            articleBody.classList.add(sizes[currentSize]);
        }
    }
    
    function updateSize(delta) {
        currentSize = Math.max(0, Math.min(sizes.length - 1, currentSize + delta));
        articleBody.className = articleBody.className.replace(/text-\w+/g, '').trim();
        if (sizes[currentSize]) {
            articleBody.classList.add(sizes[currentSize]);
        }
        localStorage.setItem('article-text-size', currentSize.toString());
    }
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => updateSize(-1));
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentSize = 1;
            articleBody.className = articleBody.className.replace(/text-\w+/g, '').trim();
            localStorage.setItem('article-text-size', '1');
        });
    }
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => updateSize(1));
    }
}

// Print Functionality
function initPrint() {
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

// Keyboard Navigation
function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // '/' to focus search (if exists)
        // '?' for help (could add)
        // 'j' and 'k' for next/prev article (if implemented)
        // 'f' for fullscreen (if implemented)
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const shareMenu = document.getElementById('share-menu');
            if (shareMenu && shareMenu.getAttribute('aria-hidden') === 'false') {
                shareMenu.setAttribute('aria-hidden', 'true');
                document.getElementById('share-menu-btn')?.setAttribute('aria-expanded', 'false');
            }
        }
    });
}

// Initialize all features
// Initialize share menu links with fallback URLs on page load
// NOTE: This is just a fallback - the actual share text will be updated by article-loader.js
// when the article loads. This prevents "Loading article..." from appearing.
function initializeShareLinks() {
    const articleId = new URLSearchParams(window.location.search).get('id');
    if (articleId) {
        const articleUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(articleId)}`;
        // Use a generic but descriptive fallback - article-loader.js will update this
        const shareText = 'Breaking News from Noteworthy News';
        
        // Set default share links immediately (will be updated when article loads)
        const shareLinks = {
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(articleUrl)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
            email: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${articleUrl}`)}`,
            reddit: `https://reddit.com/submit?url=${encodeURIComponent(articleUrl)}&title=${encodeURIComponent(shareText)}`
        };
        
        Object.keys(shareLinks).forEach(platform => {
            const link = document.getElementById(`share-${platform}`);
            if (link) {
                // Only set if not already set (to avoid overwriting updates from article-loader)
                if (link.href === '#' || link.href.endsWith('#')) {
                    link.href = shareLinks[platform];
                    if (platform !== 'email') {
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                    }
                }
            }
        });
    }
}

// Add class to html element when body has article-page class
// This scopes the html background gradient to article pages only
function initArticlePageClass() {
    if (document.body.classList.contains('article-page')) {
        document.documentElement.classList.add('article-page-active');
    }
}

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    // Scope html styles
    initArticlePageClass();
    
    // Initialize share links
    initializeShareLinks();
    
    // Reading progress
    window.addEventListener('scroll', updateReadingProgress);
    window.addEventListener('resize', updateReadingProgress);
    updateReadingProgress();
    
    // Copy link functionality
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(function() {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span>✓</span><span>Copied!</span>';
                setTimeout(function() {
                    copyBtn.innerHTML = originalHTML;
                }, 2000);
            }).catch(function() {
                alert('Failed to copy link. Please copy manually: ' + url);
            });
        });
    }
    
    // Initialize new features
    initImageLightbox();
    initShareMenu();
    initTextSizeControls();
    initPrint();
    initKeyboardNavigation();
});
