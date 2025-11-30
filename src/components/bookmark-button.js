/**
 * Bookmark Button Component
 * Reusable bookmark button for article cards and pages
 */

(function() {
  'use strict';

  /**
   * Create bookmark button HTML
   */
  function createBookmarkButton(articleId, articleData = {}) {
    return `
      <button 
        class="bookmark-btn" 
        data-article-id="${articleId}"
        aria-label="Bookmark this article"
        title="Save for later"
      >
        <span class="bookmark-icon">🔖</span>
        <span class="bookmark-text">Save</span>
      </button>
    `;
  }

  /**
   * Update button state
   */
  function updateButtonState(button, isBookmarked) {
    if (!button) return;

    if (isBookmarked) {
      button.classList.add('bookmarked');
      button.querySelector('.bookmark-icon').textContent = '⭐';
      button.querySelector('.bookmark-text').textContent = 'Saved';
      button.setAttribute('aria-label', 'Remove bookmark');
      button.title = 'Remove from saved';
    } else {
      button.classList.remove('bookmarked');
      button.querySelector('.bookmark-icon').textContent = '🔖';
      button.querySelector('.bookmark-text').textContent = 'Save';
      button.setAttribute('aria-label', 'Bookmark this article');
      button.title = 'Save for later';
    }
  }

  /**
   * Initialize bookmark button
   */
  async function initBookmarkButton(button, articleId, articleData) {
    if (!button || !articleId) return;

    // Check if user is authenticated
    if (!window.auth0 || typeof window.auth0.isAuthenticated !== 'function') {
      // Hide button if auth0 not available
      button.style.display = 'none';
      return;
    }

    // Check authentication status (synchronous - wrapper returns boolean)
    const isAuth = window.auth0.isAuthenticated();
    if (!isAuth) {
      // Show button but it will prompt login on click
      // Don't hide it - let users know they can bookmark if they sign in
    }

    // Check initial state
    if (window.Bookmarks) {
      const bookmarked = await window.Bookmarks.isBookmarked(articleId);
      updateButtonState(button, bookmarked);
    }

    // Add click handler
    button.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      // Check authentication
      if (!window.auth0 || !window.auth0.isAuthenticated()) {
        // Prompt to login
        if (confirm('Please sign in to save articles. Sign in now?')) {
          window.auth0.login();
        }
        return;
      }

      if (!window.Bookmarks) {
        console.error('[Bookmark] Bookmarks API not available');
        return;
      }

      // Disable button during operation
      button.disabled = true;
      button.style.opacity = '0.6';

      try {
        const isBookmarked = await window.Bookmarks.toggleBookmark(articleId, articleData);
        updateButtonState(button, isBookmarked);

        // Show feedback
        const feedback = document.createElement('div');
        feedback.className = 'bookmark-feedback';
        feedback.textContent = isBookmarked ? 'Saved!' : 'Removed';
        feedback.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${isBookmarked ? '#2ECC71' : '#E74C3C'};
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(feedback);

        setTimeout(() => {
          feedback.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => feedback.remove(), 300);
        }, 2000);

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('bookmark-changed', {
          detail: { articleId, isBookmarked }
        }));
      } catch (error) {
        console.error('[Bookmark] Error:', error);
        alert('Failed to save bookmark. Please try again.');
      } finally {
        button.disabled = false;
        button.style.opacity = '1';
      }
    });
  }

  /**
   * Initialize all bookmark buttons on page
   */
  function initAllBookmarkButtons() {
    const buttons = document.querySelectorAll('.bookmark-btn');
    buttons.forEach(button => {
      const articleId = button.getAttribute('data-article-id');
      if (!articleId) return;

      // Get article data from page or button attributes
      const articleData = {
        title: button.getAttribute('data-article-title') || document.title,
        url: button.getAttribute('data-article-url') || window.location.href,
        excerpt: button.getAttribute('data-article-excerpt') || '',
        image: button.getAttribute('data-article-image') || null,
        datePosted: button.getAttribute('data-article-date') || new Date().toISOString()
      };

      initBookmarkButton(button, articleId, articleData);
    });
  }

  /**
   * Add bookmark button to article card
   */
  function addBookmarkButtonToCard(cardElement, articleId, articleData) {
    // Check if button already exists
    if (cardElement.querySelector('.bookmark-btn')) {
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.className = 'bookmark-btn';
    button.setAttribute('data-article-id', articleId);
    button.setAttribute('data-article-title', articleData.title || '');
    button.setAttribute('data-article-url', articleData.url || '');
    button.setAttribute('data-article-excerpt', articleData.excerpt || '');
    button.setAttribute('data-article-image', articleData.image || '');
    button.setAttribute('data-article-date', articleData.datePosted || '');
    button.innerHTML = '<span class="bookmark-icon">🔖</span><span class="bookmark-text">Save</span>';
    button.setAttribute('aria-label', 'Bookmark this article');

    // Find where to insert (usually in article meta or action bar)
    const meta = cardElement.querySelector('.article-meta, .feed-post-card > div:last-child');
    if (meta) {
      meta.appendChild(button);
    } else {
      cardElement.appendChild(button);
    }

    // Initialize
    initBookmarkButton(button, articleId, articleData);
  }

  // Add CSS
  if (!document.querySelector('style[data-bookmark-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-bookmark-styles', 'true');
    style.textContent = `
      .bookmark-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .bookmark-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
      }

      .bookmark-btn.bookmarked {
        background: rgba(255, 215, 0, 0.2);
        border-color: rgba(255, 215, 0, 0.4);
      }

      .bookmark-btn.bookmarked:hover {
        background: rgba(255, 215, 0, 0.3);
      }

      .bookmark-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .bookmark-icon {
        font-size: 1rem;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllBookmarkButtons);
  } else {
    initAllBookmarkButtons();
  }

  // Also initialize after dynamic content loads
  setTimeout(initAllBookmarkButtons, 1000);

  // Expose API
  window.BookmarkButton = {
    create: createBookmarkButton,
    init: initBookmarkButton,
    addToCard: addBookmarkButtonToCard
  };
})();

