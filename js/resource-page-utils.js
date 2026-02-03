/**
 * Resource Page Utilities
 * Common functionality for resource pages
 */

// Reading Progress Indicator
class ReadingProgress {
    constructor() {
        this.progressBar = null;
        this.init();
    }

    init() {
        // Create progress bar if it doesn't exist
        if (!document.getElementById('reading-progress')) {
            const progressBar = document.createElement('div');
            progressBar.id = 'reading-progress';
            progressBar.className = 'reading-progress';
            document.body.appendChild(progressBar);
            this.progressBar = progressBar;
        } else {
            this.progressBar = document.getElementById('reading-progress');
        }

        this.updateProgress();
        window.addEventListener('scroll', () => this.updateProgress());
        window.addEventListener('resize', () => this.updateProgress());
    }

    updateProgress() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollableHeight = documentHeight - windowHeight;
        const progress = (scrollTop / scrollableHeight) * 100;

        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }
}

// Table of Contents Manager
class TableOfContents {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.headings = [];
        this.activeLink = null;
        this.init();
    }

    init() {
        if (!this.container) return;

        // Find all headings in the content
        const content = document.querySelector('.resource-content, .legal-content, .pillar-content, .content, article');
        if (!content) return;

        this.headings = Array.from(content.querySelectorAll('h2, h3, h4'));
        
        // Generate TOC
        this.generateTOC();
        
        // Set up scroll spy
        this.setupScrollSpy();
        
        // Smooth scroll for TOC links
        this.setupSmoothScroll();
    }

    generateTOC() {
        const ul = document.createElement('ul');
        
        this.headings.forEach((heading, index) => {
            // Create ID if it doesn't exist
            if (!heading.id) {
                heading.id = `heading-${index}-${heading.textContent.toLowerCase().replace(/\s+/g, '-')}`;
            }

            const li = document.createElement('li');
            const level = heading.tagName.charAt(1); // H2 = 2, H3 = 3, etc.
            li.className = `level-${level}`;

            const a = document.createElement('a');
            a.href = `#${heading.id}`;
            a.textContent = heading.textContent;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.scrollToHeading(heading.id);
            });

            li.appendChild(a);
            ul.appendChild(li);
        });

        this.container.appendChild(ul);
    }

    scrollToHeading(id) {
        const heading = document.getElementById(id);
        if (heading) {
            const offset = 100; // Account for sticky header
            const elementPosition = heading.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    setupScrollSpy() {
        const observerOptions = {
            root: null,
            rootMargin: '-100px 0px -66% 0px',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Remove active class from all links
                    this.container.querySelectorAll('a').forEach(link => {
                        link.classList.remove('active');
                    });

                    // Add active class to current link
                    const activeLink = this.container.querySelector(`a[href="#${entry.target.id}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                        this.activeLink = activeLink;
                    }
                }
            });
        }, observerOptions);

        this.headings.forEach(heading => observer.observe(heading));
    }

    setupSmoothScroll() {
        this.container.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                this.scrollToHeading(targetId);
            });
        });
    }
}

// Back to Top Button
class BackToTop {
    constructor() {
        this.button = null;
        this.init();
    }

    init() {
        // Create button if it doesn't exist
        if (!document.getElementById('back-to-top')) {
            const button = document.createElement('button');
            button.id = 'back-to-top';
            button.className = 'back-to-top';
            button.innerHTML = '↑';
            button.setAttribute('aria-label', 'Back to top');
            button.addEventListener('click', () => this.scrollToTop());
            document.body.appendChild(button);
            this.button = button;
        } else {
            this.button = document.getElementById('back-to-top');
        }

        window.addEventListener('scroll', () => this.toggleVisibility());
    }

    toggleVisibility() {
        if (window.pageYOffset > 300) {
            this.button.classList.add('visible');
        } else {
            this.button.classList.remove('visible');
        }
    }

    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// Expandable Sections
class ExpandableSections {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('.expandable-section').forEach(section => {
            const header = section.querySelector('.expandable-header');
            if (header) {
                header.addEventListener('click', () => {
                    section.classList.toggle('expanded');
                });
            }
        });
    }
}

// Share Functionality
class ShareButtons {
    constructor() {
        this.init();
    }

    init() {
        document.querySelectorAll('.share-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const platform = button.dataset.platform;
                this.share(platform);
            });
        });
    }

    share(platform) {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);
        const text = encodeURIComponent(document.querySelector('meta[name="description"]')?.content || '');

        let shareUrl = '';

        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${title}&body=${text}%20${url}`;
                break;
            default:
                // Use Web Share API if available
                if (navigator.share) {
                    navigator.share({
                        title: document.title,
                        text: text,
                        url: window.location.href
                    });
                    return;
                }
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
    }
}

// Estimated Reading Time
class ReadingTime {
    constructor() {
        this.init();
    }

    init() {
        const content = document.querySelector('.resource-content, .legal-content, .pillar-content, .content, article');
        if (!content) return;

        const text = content.textContent || content.innerText || '';
        const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
        const readingTime = Math.ceil(words / 200); // Average reading speed: 200 words per minute

        // Find or create reading time element
        let readingTimeEl = document.getElementById('reading-time');
        if (!readingTimeEl) {
            readingTimeEl = document.createElement('div');
            readingTimeEl.id = 'reading-time';
            readingTimeEl.className = 'reading-time';
            readingTimeEl.setAttribute('aria-label', `Estimated reading time: ${readingTime} minute${readingTime !== 1 ? 's' : ''}`);
            
            const header = document.querySelector('.resource-header, .legal-header, .pillar-header, h1');
            if (header && header.parentElement) {
                header.parentElement.insertBefore(readingTimeEl, header.nextSibling);
            } else {
                const article = document.querySelector('article, .content');
                if (article) {
                    article.insertBefore(readingTimeEl, article.firstChild);
                }
            }
        }

        readingTimeEl.textContent = `Estimated reading time: ${readingTime} minute${readingTime !== 1 ? 's' : ''}`;
    }
}

// Keyboard Shortcuts
class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in input, textarea, or contenteditable
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }

            // Don't trigger if modifier keys are pressed (except for specific shortcuts)
            if (e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }

            this.handleKeyPress(e);
        });
    }

    handleKeyPress(e) {
        switch (e.key) {
            case '?':
                e.preventDefault();
                this.showHelp();
                break;
            case 't':
                e.preventDefault();
                this.scrollToTop();
                break;
            case 'b':
                e.preventDefault();
                this.scrollToBottom();
                break;
            case 'ArrowUp':
                if (e.shiftKey) {
                    e.preventDefault();
                    this.scrollToTop();
                }
                break;
            case 'ArrowDown':
                if (e.shiftKey) {
                    e.preventDefault();
                    this.scrollToBottom();
                }
                break;
        }
    }

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrollToBottom() {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }

    showHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'keyboard-shortcuts-help';
        helpModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(15, 21, 42, 0.98);
            backdrop-filter: blur(20px);
            border: 2px solid var(--border-primary);
            border-radius: var(--radius-lg);
            padding: var(--spacing-xl);
            z-index: var(--z-modal);
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;
        
        helpModal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
                <h3 style="color: var(--color-primary); margin: 0;">Keyboard Shortcuts</h3>
                <button onclick="this.closest('.keyboard-shortcuts-help').remove()" 
                        style="background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                    ×
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm); border-bottom: 1px solid var(--border-secondary);">
                    <span style="color: var(--text-secondary);">Scroll to top</span>
                    <kbd style="padding: 4px 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; font-family: monospace;">T</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm); border-bottom: 1px solid var(--border-secondary);">
                    <span style="color: var(--text-secondary);">Scroll to bottom</span>
                    <kbd style="padding: 4px 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; font-family: monospace;">B</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm); border-bottom: 1px solid var(--border-secondary);">
                    <span style="color: var(--text-secondary);">Show this help</span>
                    <kbd style="padding: 4px 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; font-family: monospace;">?</kbd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm);">
                    <span style="color: var(--text-secondary);">Close this dialog</span>
                    <kbd style="padding: 4px 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; font-family: monospace;">ESC</kbd>
                </div>
            </div>
        `;

        document.body.appendChild(helpModal);

        // Close on Escape
        const closeHandler = (e) => {
            if (e.key === 'Escape') {
                helpModal.remove();
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);

        // Close on click outside
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.remove();
            }
        });
    }
}

// Enhanced Share Buttons with Icons
class EnhancedShareButtons {
    constructor() {
        this.init();
    }

    init() {
        // Add icons to existing share buttons
        document.querySelectorAll('.share-btn').forEach(btn => {
            if (!btn.querySelector('svg') && !btn.querySelector('.icon')) {
                const text = btn.textContent.trim();
                const icon = this.getIcon(text);
                if (icon) {
                    btn.innerHTML = icon + ' ' + text;
                }
            }
        });

        // Enhance copy button functionality
        document.querySelectorAll('.share-btn').forEach(btn => {
            if (btn.textContent.includes('Copy')) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.copyToClipboard(btn);
                });
            }
        });
    }

    getIcon(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('x') || lowerText.includes('twitter')) {
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
        } else if (lowerText.includes('facebook')) {
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
        } else if (lowerText.includes('linkedin')) {
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
        } else if (lowerText.includes('copy')) {
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        }
        return null;
    }

    async copyToClipboard(button) {
        try {
            await navigator.clipboard.writeText(window.location.href);
            const originalText = button.innerHTML;
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
            button.style.background = 'var(--color-secondary)';
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy link. Please copy manually: ' + window.location.href);
        }
    }
}

// Initialize all utilities when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize reading progress
    new ReadingProgress();

    // Initialize table of contents if container exists
    const tocContainer = document.getElementById('table-of-contents');
    if (tocContainer) {
        new TableOfContents('table-of-contents');
    }

    // Initialize back to top
    new BackToTop();

    // Initialize expandable sections
    new ExpandableSections();

    // Initialize share buttons
    new ShareButtons();

    // Initialize enhanced share buttons
    new EnhancedShareButtons();

    // Initialize reading time
    new ReadingTime();

    // Initialize keyboard shortcuts
    new KeyboardShortcuts();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ReadingProgress,
        TableOfContents,
        BackToTop,
        ExpandableSections,
        ShareButtons,
        ReadingTime,
        KeyboardShortcuts,
        EnhancedShareButtons
    };
}
