/**
 * Bookmarks Utility
 * Handles saving, loading, and removing article bookmarks
 * Uses Auth0 for authentication and Netlify Blobs for storage
 */

(function() {
  'use strict';

  const BOOKMARKS_STORAGE_KEY = 'noteworthy-bookmarks-cache';
  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  /**
   * Get user's Auth0 token
   */
  async function getAuthToken() {
    if (!window.auth0) {
      return null;
    }

    try {
      // The wrapper returns a boolean, not a promise
      const isAuthenticated = window.auth0.isAuthenticated();
      if (!isAuthenticated) {
        return null;
      }

      // Check if getTokenSilently exists
      if (typeof window.auth0.getTokenSilently !== 'function') {
        return null;
      }

      const token = await window.auth0.getTokenSilently();
      return token;
    } catch (error) {
      console.error('[Bookmarks] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Get user email
   */
  async function getUserEmail() {
    if (!window.auth0) {
      return null;
    }

    try {
      // Check if auth0 is available
      if (!window.auth0) {
        return null;
      }

      // The wrapper returns a boolean, not a promise
      const isAuthenticated = window.auth0.isAuthenticated();
      if (!isAuthenticated) {
        return null;
      }

      // Check if getUser exists
      if (typeof window.auth0.getUser !== 'function') {
        return null;
      }

      const user = await window.auth0.getUser();
      return user?.email || null;
    } catch (error) {
      console.error('[Bookmarks] Failed to get user:', error);
      return null;
    }
  }

  /**
   * Get bookmarks from server
   */
  async function fetchBookmarks() {
    const token = await getAuthToken();
    const email = await getUserEmail();

    if (!token || !email) {
      return [];
    }

    try {
      const response = await fetch(`/.netlify/functions/user-data?email=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const userData = await response.json();
      return userData.bookmarks || [];
    } catch (error) {
      console.error('[Bookmarks] Failed to fetch:', error);
      return [];
    }
  }

  /**
   * Save bookmarks to server
   */
  async function saveBookmarks(bookmarks) {
    const token = await getAuthToken();
    const email = await getUserEmail();

    if (!token || !email) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('/.netlify/functions/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: email,
          data: {
            bookmarks: bookmarks
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update cache
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify({
        data: bookmarks,
        timestamp: Date.now()
      }));

      return true;
    } catch (error) {
      console.error('[Bookmarks] Failed to save:', error);
      throw error;
    }
  }

  /**
   * Get cached bookmarks
   */
  function getCachedBookmarks() {
    try {
      const cached = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (!cached) return null;

      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;

      if (age > CACHE_EXPIRY) {
        localStorage.removeItem(BOOKMARKS_STORAGE_KEY);
        return null;
      }

      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if article is bookmarked
   */
  async function isBookmarked(articleId) {
    // Check cache first
    const cached = getCachedBookmarks();
    if (cached) {
      return cached.some(b => b.id === articleId);
    }

    // Fetch from server
    const bookmarks = await fetchBookmarks();
    return bookmarks.some(b => b.id === articleId);
  }

  /**
   * Add bookmark
   */
  async function addBookmark(articleId, articleData) {
    const bookmarks = await fetchBookmarks();
    
    // Check if already bookmarked
    if (bookmarks.some(b => b.id === articleId)) {
      return true;
    }

    // Add new bookmark
    const newBookmark = {
      id: articleId,
      title: articleData.title || 'Untitled',
      url: articleData.url || `/article.html?id=${articleId}`,
      excerpt: articleData.excerpt || '',
      image: articleData.image || null,
      dateBookmarked: new Date().toISOString(),
      datePosted: articleData.datePosted || new Date().toISOString()
    };

    bookmarks.unshift(newBookmark); // Add to beginning
    await saveBookmarks(bookmarks);
    return true;
  }

  /**
   * Remove bookmark
   */
  async function removeBookmark(articleId) {
    const bookmarks = await fetchBookmarks();
    const filtered = bookmarks.filter(b => b.id !== articleId);
    await saveBookmarks(filtered);
    return true;
  }

  /**
   * Toggle bookmark
   */
  async function toggleBookmark(articleId, articleData) {
    const bookmarked = await isBookmarked(articleId);
    
    if (bookmarked) {
      await removeBookmark(articleId);
      return false;
    } else {
      await addBookmark(articleId, articleData);
      return true;
    }
  }

  /**
   * Get all bookmarks
   */
  async function getAllBookmarks() {
    // Try cache first
    const cached = getCachedBookmarks();
    if (cached) {
      return cached;
    }

    // Fetch from server
    return await fetchBookmarks();
  }

  // Expose API
  window.Bookmarks = {
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    getAllBookmarks,
    fetchBookmarks
  };
})();

