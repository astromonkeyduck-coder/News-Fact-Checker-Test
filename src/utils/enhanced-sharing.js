/**
 * Enhanced Social Sharing Utility
 * Improves share buttons with copy link, native share, and analytics
 */

(function() {
  'use strict';

  /**
   * Initialize enhanced sharing for article pages
   */
  function initEnhancedSharing() {
    // Get share buttons
    const shareTwitter = document.getElementById('share-twitter');
    const shareFacebook = document.getElementById('share-facebook');
    const shareLinkedIn = document.getElementById('share-linkedin');
    const shareCopy = document.getElementById('share-copy');

    if (!shareTwitter && !shareFacebook && !shareLinkedIn && !shareCopy) {
      // No share buttons found, exit
      return;
    }

    // Get current page info
    const currentUrl = window.location.href;
    const currentTitle = document.title.replace(' - Noteworthy News', '');
    const currentDescription = document.querySelector('meta[name="description"]')?.content || 
                               document.querySelector('meta[property="og:description"]')?.content || 
                               '';

    // Build share URLs
    const shareUrl = encodeURIComponent(currentUrl);
    const shareTitle = encodeURIComponent(currentTitle);
    const shareText = encodeURIComponent(currentDescription.substring(0, 200));

    // Update Twitter share
    if (shareTwitter) {
      shareTwitter.href = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`;
      shareTwitter.addEventListener('click', function(e) {
        trackShare('twitter');
      });
    }

    // Update Facebook share
    if (shareFacebook) {
      shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
      shareFacebook.addEventListener('click', function(e) {
        trackShare('facebook');
      });
    }

    // Update LinkedIn share
    if (shareLinkedIn) {
      shareLinkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
      shareLinkedIn.addEventListener('click', function(e) {
        trackShare('linkedin');
      });
    }

    // Copy link functionality
    if (shareCopy) {
      shareCopy.addEventListener('click', async function(e) {
        e.preventDefault();
        await copyToClipboard(currentUrl);
        trackShare('copy');
      });
    }

    // Add native share button if supported
    addNativeShareButton(currentUrl, currentTitle, currentDescription);
  }

  /**
   * Copy text to clipboard
   */
  async function copyToClipboard(text) {
    try {
      // Try modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showCopyFeedback(true);
        return;
      }
    } catch (err) {
      console.log('Clipboard API failed, using fallback');
    }

    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        showCopyFeedback(true);
      } else {
        showCopyFeedback(false);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      showCopyFeedback(false);
    }
  }

  /**
   * Show copy feedback
   */
  function showCopyFeedback(success) {
    const shareCopy = document.getElementById('share-copy');
    if (!shareCopy) return;

    const originalText = shareCopy.innerHTML;
    
    if (success) {
      shareCopy.innerHTML = '<span>✓</span> Copied!';
      shareCopy.style.background = 'rgba(46, 204, 113, 0.3)';
      shareCopy.style.borderColor = '#2ECC71';
      
      setTimeout(() => {
        shareCopy.innerHTML = originalText;
        shareCopy.style.background = '';
        shareCopy.style.borderColor = '';
      }, 2000);
    } else {
      shareCopy.innerHTML = '<span>✗</span> Failed';
      shareCopy.style.background = 'rgba(231, 76, 60, 0.3)';
      
      setTimeout(() => {
        shareCopy.innerHTML = originalText;
        shareCopy.style.background = '';
      }, 2000);
    }
  }

  /**
   * Add native share button if supported
   */
  function addNativeShareButton(url, title, description) {
    // Check if native share is supported
    if (!navigator.share) {
      return;
    }

    // Check if native share button already exists
    if (document.getElementById('share-native')) {
      return;
    }

    // Find share buttons container
    const shareButtons = document.querySelector('.share-buttons');
    if (!shareButtons) {
      return;
    }

    // Create native share button
    const nativeShareBtn = document.createElement('button');
    nativeShareBtn.id = 'share-native';
    nativeShareBtn.className = 'share-btn';
    nativeShareBtn.setAttribute('aria-label', 'Share');
    nativeShareBtn.innerHTML = '<span>📤</span> Share';
    
    nativeShareBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      try {
        await navigator.share({
          title: title,
          text: description,
          url: url
        });
        trackShare('native');
      } catch (err) {
        // User cancelled or error
        if (err.name !== 'AbortError') {
          console.log('Share failed:', err);
        }
      }
    });

    // Insert at the beginning
    shareButtons.insertBefore(nativeShareBtn, shareButtons.firstChild);
  }

  /**
   * Track share events
   */
  function trackShare(platform) {
    // Track with analytics if available
    if (typeof window !== 'undefined' && window.trackEvent) {
      window.trackEvent('article_shared', {
        platform: platform,
        url: window.location.href,
        title: document.title
      });
    }

    // Track with analytics tracker if available
    if (typeof window !== 'undefined' && window.analyticsTracker) {
      window.analyticsTracker.trackEvent('article_shared', {
        platform: platform,
        url: window.location.href
      });
    }

    // Console log for debugging
    console.log('[Share]', platform, window.location.href);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancedSharing);
  } else {
    initEnhancedSharing();
  }

  // Also initialize after article loads (for dynamic content)
  setTimeout(initEnhancedSharing, 1000);
})();

