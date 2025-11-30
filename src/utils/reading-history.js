/**
 * Reading History Utility
 * Tracks articles viewed by users
 */

(function() {
  'use strict';

  const HISTORY_STORAGE_KEY = 'noteworthy-reading-history';
  const MAX_HISTORY_ITEMS = 100; // Keep last 100 articles

  /**
   * Add article to reading history
   */
  function addToHistory(articleId, articleData) {
    if (!articleId) return;

    try {
      let history = getHistory();
      
      // Remove if already exists (to move to top)
      history = history.filter(item => item.id !== articleId);
      
      // Add to beginning
      history.unshift({
        id: articleId,
        title: articleData.title || document.title,
        url: articleData.url || window.location.href,
        excerpt: articleData.excerpt || '',
        image: articleData.image || null,
        dateViewed: new Date().toISOString(),
        category: articleData.category || null
      });
      
      // Limit size
      history = history.slice(0, MAX_HISTORY_ITEMS);
      
      // Save to localStorage
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      
      // Also save to server if authenticated
      saveHistoryToServer(history);
      
      return history;
    } catch (error) {
      console.error('[Reading History] Error adding to history:', error);
      return [];
    }
  }

  /**
   * Get reading history
   */
  function getHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!stored) return [];
      
      const history = JSON.parse(stored);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('[Reading History] Error reading history:', error);
      return [];
    }
  }

  /**
   * Clear reading history
   */
  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      saveHistoryToServer([]);
      return true;
    } catch (error) {
      console.error('[Reading History] Error clearing history:', error);
      return false;
    }
  }

  /**
   * Save history to server (if authenticated)
   */
  async function saveHistoryToServer(history) {
    if (!window.auth0) {
      return;
    }

    try {
      // The wrapper returns a boolean, not a promise
      const isAuthenticated = window.auth0.isAuthenticated();
      if (!isAuthenticated) {
        return;
      }

      if (typeof window.auth0.getTokenSilently !== 'function' || 
          typeof window.auth0.getUser !== 'function') {
        return;
      }

      const token = await window.auth0.getTokenSilently();
      const user = await window.auth0.getUser();
      
      if (!token || !user?.email) return;

      // Save via user-data API
      await fetch('/.netlify/functions/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email,
          data: {
            readingHistory: history
          }
        })
      });
    } catch (error) {
      // Fail silently - localStorage is the primary storage
      console.log('[Reading History] Could not save to server:', error);
    }
  }

  /**
   * Get reading history from server (if authenticated)
   */
  async function getHistoryFromServer() {
    if (!window.auth0) {
      return getHistory();
    }

    try {
      // The wrapper returns a boolean, not a promise
      const isAuthenticated = window.auth0.isAuthenticated();
      if (!isAuthenticated) {
        return getHistory();
      }

      if (typeof window.auth0.getTokenSilently !== 'function' || 
          typeof window.auth0.getUser !== 'function') {
        return getHistory();
      }

      const token = await window.auth0.getTokenSilently();
      const user = await window.auth0.getUser();
      
      if (!token || !user?.email) return getHistory();

      const response = await fetch(`/.netlify/functions/user-data?email=${encodeURIComponent(user.email)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        const serverHistory = userData.readingHistory || [];
        
        // Merge with local history (server takes precedence)
        if (serverHistory.length > 0) {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(serverHistory));
          return serverHistory;
        }
      }
    } catch (error) {
      console.log('[Reading History] Could not load from server:', error);
    }

    return getHistory();
  }

  /**
   * Track current page view
   */
  function trackCurrentPage() {
    // Only track article pages
    if (!window.location.pathname.includes('article.html')) {
      return;
    }

    const articleId = new URLSearchParams(window.location.search).get('id');
    if (!articleId) return;

    const articleData = {
      title: document.title.replace(' - Noteworthy News', ''),
      url: window.location.href,
      excerpt: document.querySelector('meta[name="description"]')?.content || '',
      image: document.querySelector('meta[property="og:image"]')?.content || null,
      category: document.getElementById('article-category')?.textContent || null
    };

    addToHistory(articleId, articleData);
  }

  // Auto-track on article pages
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(trackCurrentPage, 1000); // Wait for article to load
    });
  } else {
    setTimeout(trackCurrentPage, 1000);
  }

  // Expose API
  window.ReadingHistory = {
    add: addToHistory,
    get: getHistory,
    getFromServer: getHistoryFromServer,
    clear: clearHistory,
    track: trackCurrentPage
  };
})();

