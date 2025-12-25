/**
 * Vanilla JS version of PostFeed
 * Usage: renderPostFeed('articlesTrack', '/.netlify/functions/posts-read', 30)
 * Version: 3.0 - Improved reliability with retries, caching, and better error handling
 */

// Cache key for storing posts locally
const CACHE_KEY = 'noteworthy-posts-cache';
const CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutes (reduced for faster updates)

// Loading lock to prevent multiple simultaneous calls
let isLoading = false;
let loadAttempts = new Map(); // Track attempts per container

/**
 * Fetch with retry logic and timeout
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, timeout = 15000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw fetchError;
      }
    } catch (error) {
      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: wait 500ms, 1s, 2s, 3s
      const delay = Math.min(500 * Math.pow(2, attempt), 3000);
      console.warn(`[PostFeed] Fetch attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Get cached posts if available and not expired
 */
function getCachedPosts() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { posts, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age < CACHE_EXPIRY && Array.isArray(posts) && posts.length > 0) {
      return posts;
    }
    
    // Cache expired or invalid, remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache posts locally
 */
function cachePosts(posts) {
  try {
    const cacheData = {
      posts,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log('[PostFeed] Cache updated:', posts.length, 'posts, timestamp:', new Date(cacheData.timestamp).toLocaleTimeString());
  } catch (error) {
    console.warn('[PostFeed] Failed to cache posts:', error);
  }
}

async function renderPostFeed(containerId, endpoint = '/.netlify/functions/posts-read', limit = 200, forceRefresh = false) {
  console.log('[PostFeed] renderPostFeed called for', containerId, 'forceRefresh:', forceRefresh);
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[PostFeed] Container ${containerId} not found`);
    return;
  }

  // If forcing refresh, clear cache
  if (forceRefresh) {
    console.log('[PostFeed] Force refresh - clearing cache');
    localStorage.removeItem(CACHE_KEY);
  }

  // Prevent multiple simultaneous loads for the same container
  const lockKey = `${containerId}-${endpoint}`;
  if (loadAttempts.has(lockKey) && loadAttempts.get(lockKey).loading) {
    console.log(`[PostFeed] Already loading posts for ${containerId}, skipping duplicate call`);
    return;
  }
  
  // Initialize loading lock
  loadAttempts.set(lockKey, { loading: true, timestamp: Date.now() });
  
  // Clean up old locks (older than 30 seconds)
  const now = Date.now();
  for (const [key, value] of loadAttempts.entries()) {
    if (now - value.timestamp > 30000) {
      loadAttempts.delete(key);
    }
  }

  // Store original content (existing article cards), but remove any Twitter widget links
  let originalContent = '';
  const existingCards = container.querySelectorAll('article.article-card');
  if (existingCards.length > 0) {
    originalContent = Array.from(existingCards).map(card => card.outerHTML).join('');
  }
  
  // Remove any Twitter timeline links if they got into the container
  container.innerHTML = container.innerHTML.replace(/<a[^>]*twitter-timeline[^>]*>.*?<\/a>/gi, '');
  
  // If no valid original content, use placeholder
  if (!originalContent || originalContent.trim().length < 50) {
    originalContent = '<article class="article-card"><div class="article-content"><h3>Loading posts...</h3></div></article>';
  }

  // Try to load cached posts first for instant display (unless forcing refresh)
  let cachedPosts = null;
  if (!forceRefresh) {
    cachedPosts = getCachedPosts();
    if (cachedPosts && cachedPosts.length > 0) {
      console.log('[PostFeed] Found', cachedPosts.length, 'cached posts, displaying immediately');
      renderPosts(cachedPosts, container, originalContent);
    } else {
      // Show loading skeleton state only if no cache
      container.innerHTML = `
        <div class="post-feed-loading" style="padding: 2rem;">
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite;">
            <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.1);"></div>
              <div style="flex: 1;">
                <div style="height: 16px; width: 40%; background: rgba(255, 255, 255, 0.1); border-radius: 4px; margin-bottom: 0.5rem;"></div>
                <div style="height: 12px; width: 30%; background: rgba(255, 255, 255, 0.1); border-radius: 4px;"></div>
              </div>
            </div>
            <div style="height: 14px; width: 100%; background: rgba(255, 255, 255, 0.1); border-radius: 4px; margin-bottom: 0.5rem;"></div>
            <div style="height: 14px; width: 90%; background: rgba(255, 255, 255, 0.1); border-radius: 4px; margin-bottom: 0.5rem;"></div>
            <div style="height: 200px; width: 100%; background: rgba(255, 255, 255, 0.1); border-radius: 12px; margin-bottom: 0.75rem;"></div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite;">
            <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.1);"></div>
              <div style="flex: 1;">
                <div style="height: 16px; width: 40%; background: rgba(255, 255, 255, 0.1); border-radius: 4px; margin-bottom: 0.5rem;"></div>
                <div style="height: 12px; width: 30%; background: rgba(255, 255, 255, 0.1); border-radius: 4px;"></div>
              </div>
            </div>
            <div style="height: 14px; width: 100%; background: rgba(255, 255, 255, 0.1); border-radius: 4px; margin-bottom: 0.5rem;"></div>
            <div style="height: 200px; width: 100%; background: rgba(255, 255, 255, 0.1); border-radius: 12px;"></div>
          </div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        </style>
      `;
    }
  } else {
    // Force refresh - show loading state
    container.innerHTML = '<div class="post-feed-loading" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">Refreshing posts...</div>';
  }

  try {
    // Check if we're in local development
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.port === '8888' ||
                       window.location.href.includes('localhost:8888');
    
    console.log('[PostFeed] Local dev detection:', {
      hostname: window.location.hostname,
      port: window.location.port,
      href: window.location.href,
      isLocalDev: isLocalDev
    });
    
    // Handle endpoint - add limit param if not already present
    // Support both relative and absolute URLs
    // On localhost, automatically use localhost:8888 if endpoint is relative
    let fetchUrl;
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      // Absolute URL - use as is
      const url = new URL(endpoint);
      if (!url.searchParams.has('limit')) {
        url.searchParams.set('limit', limit);
      }
      fetchUrl = url.toString();
    } else {
      // Relative URL
      if (isLocalDev && endpoint.startsWith('/.netlify/functions/')) {
        // On localhost, try to detect if we're using netlify dev (port 8888)
        // If current page is on 8888, use same origin; otherwise try localhost:8888
        const currentPort = window.location.port;
        const netlifyDevUrl = currentPort === '8888' 
          ? window.location.origin 
          : 'http://localhost:8888';
        
        const url = new URL(endpoint, netlifyDevUrl);
        if (!url.searchParams.has('limit')) {
          url.searchParams.set('limit', limit);
        }
        fetchUrl = url.toString();
      } else {
        // Production or other cases
        const url = new URL(endpoint, window.location.origin);
        if (!url.searchParams.has('limit')) {
          url.searchParams.set('limit', limit);
        }
        fetchUrl = url.pathname + url.search;
      }
    }
    
    let res;
    try {
      // Use fetch with retry and timeout (increased timeout and retries for reliability)
      res = await fetchWithRetry(fetchUrl, {}, 3, 12000);
    } catch (fetchError) {
      // If we have cached posts, keep showing them
      if (cachedPosts && cachedPosts.length > 0) {
        console.warn('Using cached posts due to fetch error:', fetchError.message);
        return; // Already rendered cached posts above
      }
      
      // Handle fetch errors in local dev with helpful message
      if (isLocalDev) {
        // Check if this might be because netlify dev isn't running
        const isTimeout = fetchError.message && fetchError.message.includes('timeout');
        const isConnectionRefused = fetchError.message && (
          fetchError.message.includes('Failed to fetch') || 
          fetchError.message.includes('ERR_CONNECTION_REFUSED') ||
          fetchError.message.includes('network')
        );
        
        if (isConnectionRefused || isTimeout) {
          container.innerHTML = originalContent + 
            '<div style="padding: 1.5rem; margin-top: 1rem; background: rgba(74, 144, 226, 0.15); border: 1px solid rgba(74, 144, 226, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">' +
            '<p style="margin: 0 0 0.75rem 0; font-weight: 600; font-size: 1.05em;">📡 Connection Error</p>' +
            '<p style="margin: 0 0 1rem 0; font-size: 0.95em; opacity: 0.9; line-height: 1.6;">Could not connect to Netlify Functions. Troubleshooting:</p>' +
            '<ul style="margin: 0.5rem 0 1rem 0; padding-left: 1.5rem; font-size: 0.9em; opacity: 0.9;">' +
            '<li>Make sure <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">netlify dev</code> is running</li>' +
            '<li>Check terminal for errors</li>' +
            '<li>Test endpoint: <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">curl ' + fetchUrl + '</code></li>' +
            '</ul>' +
            '<p style="margin: 1rem 0 0 0; font-size: 0.85em; opacity: 0.8;">Error: <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">' + (fetchError.message || 'Unknown error') + '</code></p>' +
            '</div>';
        } else {
          // Other errors - show with details
          container.innerHTML = originalContent + 
            '<div style="padding: 1.5rem; margin-top: 1rem; background: rgba(255, 107, 107, 0.15); border: 1px solid rgba(255, 107, 107, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">' +
            '<p style="margin: 0 0 0.75rem 0; font-weight: 600; font-size: 1.05em;">⚠️ Fetch Error</p>' +
            '<p style="margin: 0 0 1rem 0; font-size: 0.95em; opacity: 0.9; line-height: 1.6;">Error loading posts:</p>' +
            '<p style="margin: 0.5rem 0 0 0; font-size: 0.85em; opacity: 0.8; font-family: monospace; word-break: break-all;">' + (fetchError.message || 'Unknown error') + '</p>' +
            '<p style="margin: 1rem 0 0 0; font-size: 0.85em; opacity: 0.8;">Endpoint: <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">' + fetchUrl + '</code></p>' +
            '</div>';
        }
        console.error('[PostFeed] Local dev: Fetch error:', fetchError.message, 'URL:', fetchUrl);
        return; // Exit early, no error thrown
      }
      
      // In production, show user-friendly error but don't break the page
      container.innerHTML = originalContent + 
        '<div style="padding: 1rem; margin-top: 1rem; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 8px; color: rgba(255,255,255,0.9); text-align: center;">' +
        '<p style="margin: 0 0 0.5rem 0; font-weight: 600;">Unable to load latest posts</p>' +
        '<p style="margin: 0; font-size: 0.9em; opacity: 0.8;">Showing cached content or placeholder cards. Posts will refresh when connection is restored.</p>' +
        '</div>';
      return;
    }
    
    // Check if response is HTML (404 page) - happens before checking res.ok
    const contentType = res.headers.get('content-type') || '';
    const isHtmlResponse = contentType.includes('text/html');
    
    if (!res.ok || isHtmlResponse || res.status === 404) {
      // Use cached posts if available
      if (cachedPosts && cachedPosts.length > 0) {
        console.warn('Using cached posts due to server error:', res.status);
        return;
      }
      
      // Handle 404s in local development with helpful message
      if (isLocalDev) {
        // Try to test if the function endpoint is accessible
        fetch(fetchUrl.replace('?limit=10', ''), { method: 'OPTIONS' })
          .then(testRes => {
            console.log('[PostFeed] OPTIONS test result:', testRes.status);
          })
          .catch(() => {
            console.warn('[PostFeed] OPTIONS test failed');
          });
        
        container.innerHTML = originalContent + 
          '<div style="padding: 1.5rem; margin-top: 1rem; background: rgba(255, 165, 0, 0.15); border: 1px solid rgba(255, 165, 0, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">' +
          '<p style="margin: 0 0 0.75rem 0; font-weight: 600; font-size: 1.05em;">⚠️ Function Not Found (404)</p>' +
          '<p style="margin: 0 0 1rem 0; font-size: 0.95em; opacity: 0.9; line-height: 1.6;">The posts function returned 404. Troubleshooting steps:</p>' +
          '<ol style="margin: 0.5rem 0 1rem 0; padding-left: 1.5rem; font-size: 0.9em; opacity: 0.9;">' +
          '<li>Check your terminal where <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">netlify dev</code> is running for errors</li>' +
          '<li>Make sure the function file exists: <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">netlify/functions/posts-read.js</code></li>' +
          '<li>Try restarting Netlify Dev (Ctrl+C, then <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">npm run dev</code> again)</li>' +
          '<li>Check if TypeScript compilation is working</li>' +
          '</ol>' +
          '<p style="margin: 1rem 0 0.5rem 0; font-size: 0.9em; opacity: 0.9; font-weight: 600;">Endpoint tried:</p>' +
          '<code style="display: block; padding: 0.75rem; background: rgba(0, 0, 0, 0.3); border-radius: 6px; font-family: monospace; font-size: 0.85em; word-break: break-all; margin: 0.5rem 0;">' + fetchUrl + '</code>' +
          '<p style="margin: 1rem 0 0 0; font-size: 0.85em; opacity: 0.8;">Check browser console (F12) for more details.</p>' +
          '</div>';
        console.error('[PostFeed] Local dev: Function returned 404');
        console.error('[PostFeed] URL attempted:', fetchUrl);
        console.error('[PostFeed] Status:', res.status, res.statusText);
        console.error('[PostFeed] Response headers:', Array.from(res.headers.entries()));
        // Try to get response text for debugging
        res.text().then(text => {
          console.error('[PostFeed] Response body:', text.substring(0, 500));
        }).catch((err) => {
          // Response body may already be consumed, log for debugging
          console.debug('[PostFeed] Could not read response text:', err?.message || err);
        });
        return; // Exit early, no error thrown
      }
      
      // Show error but keep page functional
      container.innerHTML = originalContent + 
        '<div style="padding: 1rem; margin-top: 1rem; background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.3); border-radius: 8px; color: rgba(255,255,255,0.9); text-align: center;">' +
        '<p style="margin: 0; font-size: 0.9em;">Posts service temporarily unavailable. Showing placeholder content.</p>' +
        '</div>';
      return;
    }
    
    let posts;
    try {
      const responseText = await res.text();
      console.log('[PostFeed] Raw response (first 500 chars):', responseText.substring(0, 500));
      posts = JSON.parse(responseText);
      console.log('[PostFeed] Parsed posts:', {
        isArray: Array.isArray(posts),
        count: Array.isArray(posts) ? posts.length : 0,
        sample: Array.isArray(posts) && posts.length > 0 ? {
          id: posts[0].id,
          title: posts[0].title,
          story: posts[0].story?.substring(0, 50),
          link: posts[0].link,
          image: posts[0].image
        } : null
      });
    } catch (jsonError) {
      console.error('[PostFeed] Failed to parse JSON response:', jsonError);
      const text = await res.text().catch(() => '');
      console.error('[PostFeed] Response text:', text.substring(0, 200));
      
      // Use cached posts if available
      if (cachedPosts && cachedPosts.length > 0) {
        console.warn('[PostFeed] Using cached posts due to JSON parse error');
        return;
      }
      
      container.innerHTML = originalContent + 
        '<div style="padding: 1rem; margin-top: 1rem; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 8px; color: rgba(255,255,255,0.9);">' +
        '<p style="margin: 0; font-size: 0.9em;">Error parsing posts response. Check console for details.</p>' +
        '</div>';
      return;
    }
    
    console.log('[PostFeed] Posts received:', posts ? posts.length : 'null', posts);
    
    // Validate response is an array
    if (!Array.isArray(posts)) {
      console.error('[PostFeed] Posts response is not an array:', typeof posts, posts);
      // Use cached posts if available
      if (cachedPosts && cachedPosts.length > 0) {
        console.warn('[PostFeed] Using cached posts - response not an array');
        return;
      }
      container.innerHTML = originalContent;
      return;
    }
    
    if (posts.length === 0) {
      // Use cached posts if available
      if (cachedPosts && cachedPosts.length > 0) {
        console.info('[PostFeed] No new posts from API, using cached posts');
        return;
      }
      
      // Show helpful message if no posts
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isProduction = window.location.hostname.includes('noteworthynews.co');
      
      let helpMessage = '';
      if (isLocalDev) {
        helpMessage = 
          '<div style="padding: 1.5rem; margin-top: 1rem; background: rgba(74, 144, 226, 0.15); border: 1px solid rgba(74, 144, 226, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">' +
          '<p style="margin: 0 0 0.75rem 0; font-weight: 600; font-size: 1.05em;">📭 No Posts Yet</p>' +
          '<p style="margin: 0 0 1rem 0; font-size: 0.95em; opacity: 0.9; line-height: 1.6;">The function is working, but there are no posts stored yet.</p>' +
          '<p style="margin: 0 0 1rem 0; font-size: 0.9em; opacity: 0.8;">To add posts manually:</p>' +
          '<ol style="margin: 0.5rem 0 1rem 0; padding-left: 1.5rem; font-size: 0.9em; opacity: 0.9;">' +
          '<li>Open browser console (F12) and run:</li>' +
          '<li><code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; display: block; margin-top: 0.5rem;">fetch(\'/.netlify/functions/fetch-profile-tweets\', {method: \'POST\', headers: {\'Content-Type\': \'application/json\'}, body: JSON.stringify({tweetUrl: \'https://x.com/newsnoteworthy/status/YOUR_TWEET_ID\'})})</code></li>' +
          '<li>Or visit the function URL directly in browser</li>' +
          '<li>Then refresh this page</li>' +
          '</ol>' +
          '</div>';
      } else if (isProduction) {
        helpMessage = 
          '<div style="padding: 1.5rem; margin-top: 1rem; background: rgba(255, 165, 0, 0.15); border: 1px solid rgba(255, 165, 0, 0.4); border-radius: 8px; color: rgba(255,255,255,0.9);">' +
          '<p style="margin: 0 0 0.75rem 0; font-weight: 600; font-size: 1.05em;">📭 No Posts Available</p>' +
          '<p style="margin: 0 0 1rem 0; font-size: 0.95em; opacity: 0.9; line-height: 1.6;">Posts are being set up. Check back soon or follow us on <a href="https://x.com/newsnoteworthy" target="_blank" style="color: #4A90E2;">X/Twitter</a> for updates.</p>' +
          '</div>';
      }
      
      container.innerHTML = originalContent + helpMessage;
      console.info('[PostFeed] No posts in storage yet. Posts need to be added via:');
      console.info('[PostFeed] 1. Manual POST to fetch-profile-tweets with tweetUrl');
      console.info('[PostFeed] 2. X webhook (if configured)');
      console.info('[PostFeed] 3. Profile scraping (may be blocked by X)');
      return;
    }
    
    // Cache the successful response (always update cache with latest)
    cachePosts(posts);
    console.log('[PostFeed] Cached', posts.length, 'posts at', new Date().toLocaleTimeString());
    
    // Render the posts (with originalContent for fallback)
    console.log('[PostFeed] Successfully fetched', posts.length, 'posts, rendering now...');
    renderPosts(posts, container, originalContent);
    console.log('[PostFeed] Posts rendered successfully, container now has', container.children.length, 'articles');
    
    // Clear loading lock on success
    loadAttempts.delete(lockKey);

  } catch (err) {
    // Clear loading lock on error
    loadAttempts.delete(lockKey);
    
    // If we have cached posts, keep showing them
    if (cachedPosts && cachedPosts.length > 0) {
      console.warn('[PostFeed] Using cached posts due to error:', err.message);
      return; // Already rendered cached posts
    }
    
    // Restore original content (placeholder cards) instead of showing error
    container.innerHTML = originalContent;
    
    // Silently handle expected errors in local development
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const is404 = err.message && (err.message.includes('404') || err.message.includes('File not found'));
    const isNetworkError = err.message && (err.message.includes('Failed to fetch') || err.message.includes('network') || err.message.includes('timeout'));
    const isTimeout = err.message && err.message.includes('timeout');
    
    // Only log unexpected errors (not in local dev, not 404s, not network errors)
    if (!isLocalDev && !is404 && !isNetworkError) {
      console.warn('[PostFeed] Unable to load new posts. Showing placeholder content.', err.message || err);
    } else if (isNetworkError || isTimeout) {
      // Log network errors for debugging intermittent issues
      console.warn('[PostFeed] Network error (will retry automatically):', err.message);
    }
    
    // Auto-retry mechanism: if load failed and no cache, schedule a retry after delay
    if (!cachedPosts || cachedPosts.length === 0) {
      const shouldRetry = !isLocalDev && (isNetworkError || isTimeout);
      
      if (shouldRetry) {
        console.info('[PostFeed] Scheduling automatic retry in 15 seconds...');
        setTimeout(() => {
          // Only retry if container still exists and lock is cleared
          const retryContainer = document.getElementById(containerId);
          const currentLock = loadAttempts.get(lockKey);
          if (retryContainer && (!currentLock || !currentLock.loading)) {
            console.info('[PostFeed] Automatic retry starting...');
            renderPostFeed(containerId, endpoint, limit);
          }
        }, 15000);
      }
    }
    // In local dev with expected errors, do nothing - silently fail
  }
}

/**
 * Global state for sorting and filtering
 */
let currentSort = 'recent'; // 'recent', 'views', 'likes', 'reposts', 'comments'
let currentSearch = '';

/**
 * Sort posts based on current sort option
 */
function sortPosts(posts, sortBy) {
  const sorted = [...posts];
  
  switch(sortBy) {
    case 'views':
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
      break;
    case 'likes':
      sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      break;
    case 'reposts':
      sorted.sort((a, b) => (b.reposts || 0) - (a.reposts || 0));
      break;
    case 'comments':
      // Sort by replies (comments) - most replies first
      sorted.sort((a, b) => (b.replies || 0) - (a.replies || 0));
      break;
    case 'recent':
    default:
      sorted.sort((a, b) => {
        const dateA = new Date(a.datePosted || 0);
        const dateB = new Date(b.datePosted || 0);
        return dateB - dateA; // Newest first
      });
      break;
  }
  
  return sorted;
}

/**
 * Filter posts by search query
 */
function filterPosts(posts, searchQuery) {
  if (!searchQuery || searchQuery.trim() === '') {
    return posts;
  }
  
  const query = searchQuery.toLowerCase().trim();
  
  return posts.filter(post => {
    const title = (post.title || '').toLowerCase();
    const story = (post.story || '').toLowerCase();
    const keywords = `${title} ${story}`;
    return keywords.includes(query);
  });
}

/**
 * Format number with abbreviations (K, M, B)
 */
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format relative time (e.g., "2 hours ago")
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
    return dateString;
  }
}

/**
 * Render posts to the container with enhanced features
 */
function renderPosts(posts, container, originalContent = null) {
  const formatStory = (text) => {
    if (!text) return '';
    
    // Normalize whitespace so posts don't show extra indent on first line
    // Strip ALL leading whitespace (including tabs, spaces, newlines, non-breaking spaces)
    // Also strip any leading HTML entities or whitespace that might cause indentation
    let normalizedText = String(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00a0/g, ' ')  // Non-breaking space to regular space
      .replace(/^[\s\u00a0\u2000-\u200B\u2028\u2029]+/, '')  // Strip all leading whitespace including various unicode spaces
      .replace(/\n[\s\u00a0\u2000-\u200B]+/g, '\n')  // Strip leading whitespace from each line
      .trim();  // Final trim to be absolutely sure
    
    if (!normalizedText) {
      return '';
    }
    
    // Split text into parts to handle URLs and plain text separately
    const parts = [];
    let lastIndex = 0;
    
    // Match both image URLs and regular URLs
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match;
    
    while ((match = urlRegex.exec(normalizedText)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        const beforeText = normalizedText.substring(lastIndex, match.index);
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText });
        }
      }
      
      const url = match[0];
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg|JPG|JPEG|PNG|GIF|WEBP|SVG)(\?[^\s]*)?$/i.test(url);
      
      if (isImage) {
        // Create img tag for images
        parts.push({ 
          type: 'image', 
          content: `<img src="${url}" alt="Post image" loading="lazy" style="max-width: 100%; height: auto; border-radius: 12px; margin: 0.5rem 0; display: block;" onerror="this.style.display='none';" />` 
        });
      } else {
        // Create clickable link for other URLs
        const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
        parts.push({ 
          type: 'link', 
          content: `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: rgb(29, 155, 240); text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${displayUrl}</a>` 
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last URL
    if (lastIndex < normalizedText.length) {
      const afterText = normalizedText.substring(lastIndex);
      if (afterText) {
        parts.push({ type: 'text', content: afterText });
      }
    }
    
    // If no URLs found, just process the whole text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: normalizedText });
    }
    
    // Process each part: escape HTML for text, keep HTML for images/links
    const processed = parts.map(part => {
      if (part.type === 'text') {
        // Strip any remaining leading/trailing whitespace from text parts
        let content = part.content.trim();
        // Escape HTML and convert newlines to <br>
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br>');
      } else {
        // Images and links are already HTML, just convert newlines before/after
        return part.content;
      }
    }).join('');
    
    // Final cleanup - remove any leading whitespace from the entire result
    return processed.replace(/^[\s\u00a0\u2000-\u200B]+/, '').trim();
  };

  // Validate posts before rendering
  if (!posts || !Array.isArray(posts)) {
    console.error('[PostFeed] Invalid posts data:', posts);
    if (originalContent && originalContent.trim().length > 50) {
      container.innerHTML = originalContent;
    } else {
      container.innerHTML = '<article class="article-card"><div class="article-content"><h3>No posts available</h3><p>Posts will appear here once they are loaded.</p></div></article>';
    }
    return;
  }

  if (posts.length === 0) {
    console.warn('[PostFeed] Empty posts array');
    if (originalContent && originalContent.trim().length > 50) {
      container.innerHTML = originalContent;
    } else {
      container.innerHTML = '<article class="article-card"><div class="article-content"><h3>No posts yet</h3><p>More posts coming soon!</p></div></article>';
    }
    return;
  }

  // Apply filtering and sorting
  let filteredPosts = filterPosts(posts, currentSearch);
  filteredPosts = sortPosts(filteredPosts, currentSort);
  
  // Create controls UI (search and sort)
  const controlsHtml = `
    <div class="post-feed-controls" style="margin-bottom: 2rem; padding: 1rem; background: rgba(15, 15, 35, 0.8); border-radius: 12px; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
      <div class="post-search" style="flex: 1; min-width: 250px;">
        <input 
          type="text" 
          id="postSearchInput" 
          placeholder="🔍 Search by title or keywords..." 
          value="${currentSearch}"
          style="width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; font-size: 1rem;"
        />
      </div>
      <div class="post-sort" style="display: flex; gap: 0.5rem; align-items: center;">
        <label style="color: rgba(255,255,255,0.9); font-size: 0.9rem;">Sort by:</label>
        <select 
          id="postSortSelect" 
          style="padding: 0.75rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer;"
        >
          <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>Most Recent</option>
          <option value="views" ${currentSort === 'views' ? 'selected' : ''}>Most Views</option>
          <option value="likes" ${currentSort === 'likes' ? 'selected' : ''}>Most Likes</option>
          <option value="comments" ${currentSort === 'comments' ? 'selected' : ''}>Most Comments</option>
          <option value="reposts" ${currentSort === 'reposts' ? 'selected' : ''}>Most Reposts</option>
        </select>
      </div>
      <div class="post-count" style="color: rgba(255,255,255,0.7); font-size: 0.9rem;">
        ${filteredPosts.length} of ${posts.length} posts
      </div>
    </div>
  `;

  // Store original posts array for re-rendering on sort/search change
  if (!container.dataset.originalPosts) {
    container.dataset.originalPosts = JSON.stringify(posts);
  } else {
    // Update stored posts if we have new data
    container.dataset.originalPosts = JSON.stringify(posts);
  }
  
  console.log('[PostFeed] Rendering', filteredPosts.length, 'filtered posts from', posts.length, 'total');
  
  try {
    // Render media gallery (images/videos) - modern style
    const renderMedia = (post) => {
      let mediaHtml = '';
      // Collect all images: primary first, then secondary
      // Check canonical primary_image_url, then legacy image/image_url, then images array
      const primaryImage = post.primary_image_url || post.image_url || post.image || null;
      const secondaryImages = post.images || post.secondary_images || [];
      // Combine primary + secondary, filtering out duplicates
      const allImages = [];
      if (primaryImage) {
        allImages.push(primaryImage);
      }
      // Add secondary images that aren't duplicates of primary
      secondaryImages.forEach(img => {
        if (img && img !== primaryImage && !allImages.includes(img)) {
          allImages.push(img);
        }
      });
      const images = allImages;
      const videos = post.videos || [];
      
      if (images.length > 0 || videos.length > 0) {
        mediaHtml = '<div class="modern-post-media" style="margin: 1.25rem 0; border-radius: 12px; overflow: hidden;">';
        
        // Render images
        if (images.length > 0) {
          if (images.length === 1) {
            mediaHtml += `<div class="post-image-single" style="border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.2);">
              <img src="${images[0]}" alt="Post image" loading="lazy" style="width: 100%; height: auto; display: block; max-height: 600px; object-fit: cover;" 
                   onerror="console.error('[PostFeed] Image failed:', this.src); this.style.display='none';" 
                   onload="console.log('[PostFeed] Image loaded:', this.src);" />
            </div>`;
          } else {
            const gridCols = Math.min(images.length, 3);
            mediaHtml += `<div class="post-image-grid" style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 0.5rem; border-radius: 12px; overflow: hidden;">
              ${images.slice(0, 4).map(img => `
                <div style="aspect-ratio: 1; overflow: hidden; background: rgba(0,0,0,0.2);">
                  <img src="${img}" alt="Post image" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';" />
                </div>
              `).join('')}
            </div>`;
          }
        }
        
        // Render videos
        if (videos.length > 0) {
          videos.forEach(video => {
            if (video.includes('youtube.com') || video.includes('youtu.be')) {
              // YouTube embed
              const videoId = video.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
              if (videoId) {
                mediaHtml += `<div class="post-video" style="margin-top: 0.5rem; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: rgba(0,0,0,0.2);">
                  <iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" allowfullscreen></iframe>
                </div>`;
              }
            } else {
              // Regular video tag
              mediaHtml += `<div class="post-video" style="margin-top: 0.5rem; border-radius: 12px; overflow: hidden;">
                <video src="${video}" controls style="width: 100%; border-radius: 12px;" onerror="this.style.display='none';"></video>
              </div>`;
            }
          });
        }
        
        mediaHtml += '</div>';
      }
      
      return mediaHtml;
    };
    
    // Render engagement bar (Twitter/X style with icons and counts)
    const renderEngagementBar = (post, articleLink, twitterLink) => {
      const replies = post.replies !== undefined && post.replies !== null ? post.replies : null;
      const reposts = post.reposts !== undefined && post.reposts !== null ? post.reposts : null;
      const likes = post.likes !== undefined && post.likes !== null ? post.likes : null;
      const views = post.views !== undefined && post.views !== null ? post.views : null;
      
      // Engagement buttons - link to article page (not Twitter)
      const buttons = [];
      
      // Reply button - link to article page
      buttons.push({
        icon: '💬',
        count: replies,
        label: 'Reply',
        color: 'rgb(113, 118, 123)',
        hoverColor: 'rgb(29, 155, 240)',
        href: articleLink,
        external: false
      });
      
      // Repost button - link to article page
      buttons.push({
        icon: '🔄',
        count: reposts,
        label: 'Repost',
        color: 'rgb(113, 118, 123)',
        hoverColor: 'rgb(0, 186, 124)',
        href: articleLink,
        external: false
      });
      
      // Like button - link to article page
      buttons.push({
        icon: '❤️',
        count: likes,
        label: 'Like',
        color: 'rgb(113, 118, 123)',
        hoverColor: 'rgb(249, 24, 128)',
        href: articleLink,
        external: false
      });
      
      // Views button - link to article page
      buttons.push({
        icon: '👁️',
        count: views,
        label: 'Views',
        color: 'rgb(113, 118, 123)',
        hoverColor: 'rgb(29, 155, 240)',
        href: articleLink,
        external: false
      });
      
      // Add "View on Twitter" button if twitterLink exists
      let twitterButton = '';
      if (twitterLink && (twitterLink.includes('x.com') || twitterLink.includes('twitter.com'))) {
        twitterButton = `
          <a href="${twitterLink}" target="_blank" rel="noopener noreferrer" 
             class="x-engagement-btn" 
             style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; color: rgb(113, 118, 123); text-decoration: none; border-radius: 50%; transition: all 0.2s ease; min-width: 36px; justify-content: flex-start;" 
             onmouseover="this.style.color='rgb(29, 155, 240)'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'" 
             onmouseout="this.style.color='rgb(113, 118, 123)'; this.style.backgroundColor='transparent'"
             title="View on Twitter">
            <span style="font-size: 1.25rem; line-height: 1;">𝕏</span>
          </a>
        `;
      }
      
      const buttonsHtml = buttons.map(btn => `
        <a href="${btn.href}" ${btn.external ? 'target="_blank" rel="noopener noreferrer"' : ''} 
           class="x-engagement-btn" 
           style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; color: ${btn.color}; text-decoration: none; border-radius: 50%; transition: all 0.2s ease; min-width: 36px; justify-content: flex-start;" 
           onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'" 
           onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
           title="${btn.label}">
          <span style="font-size: 1.25rem; line-height: 1;">${btn.icon}</span>
          ${btn.count !== null && btn.count !== undefined ? `<span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatNumber(btn.count)}</span>` : ''}
        </a>
      `).join('');
      
      return buttonsHtml + twitterButton;
    };
    
    const postsHtml = filteredPosts.map((post, index) => {
      // Validate post structure
      if (!post || typeof post !== 'object') {
        console.warn(`[PostFeed] Invalid post at index ${index}:`, post);
        return '';
      }
      
      // Extract fields with multiple fallbacks
      const fullStory = post.story || post.text || post.html?.replace(/<[^>]*>/g, '') || '';
      // Link to article page instead of Twitter
      // Use the actual post ID - this MUST match what's stored in the database
      // Priority: post.id > post.postId > extract from post.link/url > fallback hash
      let stableId = post.id || post.postId;
      
      // If no ID, try to extract from link/url (Twitter/X status URLs contain the post ID)
      if (!stableId && (post.link || post.url)) {
        const url = post.link || post.url;
        const match = url.match(/status\/(\d+)/);
        if (match && match[1]) {
          stableId = match[1];
        }
      }
      
      // Last resort: create hash (but this won't match database, so article won't load)
      if (!stableId && fullStory) {
        console.warn(`[PostFeed] Post at index ${index} has no ID, creating hash (article page won't work)`);
        let hash = 0;
        const str = fullStory.substring(0, 100);
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        stableId = `post-${Math.abs(hash)}`;
      } else if (!stableId) {
        stableId = `post-${Date.now()}-${index}`;
      }
      
      const articleLink = `/article.html?id=${encodeURIComponent(stableId)}`;
      // Only create Twitter link if we have a valid post.id or valid link
      const twitterLink = post.link || post.url || (post.id ? `https://x.com/newsnoteworthy/status/${post.id}` : null);
      const datePosted = post.datePosted || post.created_at || new Date().toISOString();
      
      // Title is the full content (displayed as big bold heading)
      // Story is empty since title shows everything
      const titleText = fullStory || `Post ${index + 1}`;
      
      // Debug: Log first few posts to see what data we have
      if (index < 3) {
        console.log(`[PostFeed] Post ${index + 1}:`, {
          id: post.id,
          storyLength: fullStory.length,
          datePosted,
          views: post.views,
          likes: post.likes,
          reposts: post.reposts,
          replies: post.replies,
          hasStats: !!(post.views || post.likes || post.reposts || post.replies)
        });
      }
      
      return `
        <article class="x-post-card" role="listitem" data-post-type="${post.postType || 'text'}" data-post-id="${post.id || index}" style="background: transparent; padding: 1rem; margin-bottom: 0; border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s ease; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'" onclick="window.location.href='${articleLink}'">
          <div style="display: flex; gap: 0.75rem;">
            <!-- Avatar -->
            <div style="flex-shrink: 0;">
              <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none;" onclick="event.stopPropagation();">
                <img src="/IMG_5794.PNG" alt="Noteworthy News" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1DA1F2 0%, #1a91da 100%); display: none; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; color: white; flex-shrink: 0;">
                  NW
                </div>
              </a>
            </div>
            
            <!-- Post Content -->
            <div style="flex: 1; min-width: 0;">
              <!-- Header: Username, handle, timestamp -->
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                <a href="https://x.com/newsnoteworthy" target="_blank" rel="noopener noreferrer" style="font-weight: 700; font-size: 0.938rem; color: rgb(231, 233, 234); text-decoration: none; line-height: 1.25rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" onclick="event.stopPropagation();">Noteworthy News</a>
                <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">@newsnoteworthy</span>
                <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
                <a href="${articleLink}" style="color: rgb(113, 118, 123); font-size: 0.938rem; text-decoration: none; line-height: 1.25rem;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'" onclick="event.stopPropagation();">${formatRelativeTime(datePosted)}</a>
              </div>
              
              <!-- Post Text -->
              <div style="color: rgb(231, 233, 234); font-size: 0.938rem; line-height: 1.375rem; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; margin-bottom: 0.75rem; text-align: left; text-indent: 0; padding: 0; margin: 0 0 0.75rem 0;">${formatStory(titleText)}</div>
              
              <!-- Media -->
              ${renderMedia(post)}
              
              <!-- Engagement Bar (Twitter-style) -->
              <div style="display: flex; align-items: center; justify-content: space-between; max-width: 425px; margin-top: 0.75rem; padding-top: 0.5rem;" onclick="event.stopPropagation();">
                ${renderEngagementBar(post, articleLink, twitterLink)}
              </div>
              
              <!-- Comment Section -->
              <div class="comment-section-separated" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);" onclick="event.stopPropagation();">
                <div class="comment-section" data-article-id="post-${post.id}"></div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).filter(html => html.length > 0).join('');
    
    console.log('[PostFeed] Generated HTML for', posts.length, 'posts, HTML length:', postsHtml.length);
    
    if (!postsHtml || postsHtml.trim().length === 0) {
      console.error('[PostFeed] No valid posts HTML generated');
      // Fall back to original content
      if (originalContent && originalContent.trim().length > 50) {
        container.innerHTML = originalContent;
      } else {
        container.innerHTML = '<article class="article-card"><div class="article-content"><h3>Unable to render posts</h3><p>Please try refreshing the page.</p></div></article>';
      }
      return;
    }
    
    // Set the posts HTML - this REPLACES all content in the container
    console.log('[PostFeed] Setting container HTML, HTML length:', postsHtml.length);
    console.log('[PostFeed] Container before:', container.children.length, 'children');
    console.log('[PostFeed] Container ID:', container.id);
    
    // Insert controls before container if they don't exist
    const parentContainer = container.parentElement;
    if (!parentContainer) {
      console.error('[PostFeed] Container has no parent element, cannot insert controls');
      container.innerHTML = postsHtml;
      return;
    }
    
    let controlsElement = parentContainer.querySelector('.post-feed-controls');
    
    if (!controlsElement) {
      // Create and insert controls BEFORE the container
      controlsElement = document.createElement('div');
      controlsElement.className = 'post-feed-controls';
      parentContainer.insertBefore(controlsElement, container);
      console.log('[PostFeed] Created new controls element above container');
    }
    
    // Update controls HTML (preserves position above container)
    controlsElement.outerHTML = controlsHtml;
    
    // Re-select the controls element after outerHTML replacement (creates new element)
    const newControlsElement = parentContainer.querySelector('.post-feed-controls');
    if (newControlsElement && newControlsElement.nextSibling !== container) {
      // If controls ended up in wrong position, move them before container
      parentContainer.insertBefore(newControlsElement, container);
      console.log('[PostFeed] Repositioned controls above container');
    }
    
    // Update container with posts
    container.innerHTML = postsHtml;
    
    // Setup event listeners for search and sort
    const searchInput = document.getElementById('postSearchInput');
    const sortSelect = document.getElementById('postSortSelect');
    
    if (searchInput) {
      // Use debounce utility for better performance
      let debounceTimeout;
      const performSearch = () => {
        currentSearch = searchInput.value;
        const storedPosts = JSON.parse(container.dataset.originalPosts || '[]');
        renderPosts(storedPosts, container, originalContent);
      };
      
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(performSearch, 300); // Debounce 300ms
      });
      
      // Also handle Enter key for immediate search
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(debounceTimeout);
          performSearch();
        }
      });
    }
    
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        const storedPosts = JSON.parse(container.dataset.originalPosts || '[]');
        renderPosts(storedPosts, container, originalContent);
      });
    }
    
    // Initialize comment sections (separated from cards)
    setTimeout(() => {
      console.log('[PostFeed] Initializing comment sections for', filteredPosts.length, 'posts');
      console.log('[PostFeed] CommentSection available?', typeof CommentSection !== 'undefined');
      console.log('[PostFeed] window.commentSections?', !!window.commentSections);
      
      filteredPosts.forEach((post, idx) => {
        const articleId = `post-${post.id}`;
        const commentContainer = document.querySelector(`[data-article-id="${articleId}"]`);
        
        if (!commentContainer) {
          console.warn('[PostFeed] Comment container not found for', articleId, 'at index', idx);
          // Try to find by parent
          const articleCard = document.querySelector(`article[data-post-id="${post.id}"]`);
          if (articleCard) {
            const commentSection = articleCard.querySelector('.comment-section-separated .comment-section');
            if (commentSection) {
              console.log('[PostFeed] Found comment container via parent for', articleId);
              initCommentSection(commentSection, articleId);
            }
          }
          return;
        }
        
        console.log('[PostFeed] Found comment container for', articleId);
        initCommentSection(commentContainer, articleId);
      });
      
      function initCommentSection(container, articleId) {
        // Initialize if not already initialized
        if (!window.commentSections) window.commentSections = {};
        
        if (!window.commentSections[articleId]) {
          // Create CommentSection instance if available
          if (typeof CommentSection !== 'undefined') {
            try {
              window.commentSections[articleId] = new CommentSection(articleId);
              console.log('[PostFeed] ✓ Initialized CommentSection for', articleId);
            } catch (err) {
              console.error('[PostFeed] ✗ Failed to initialize CommentSection for', articleId, err);
              container.innerHTML = '<div style="padding: 1rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;">💬 Comments will appear here</div>';
            }
          } else {
            console.warn('[PostFeed] ⚠ CommentSection class not available - script may not be loaded');
            container.innerHTML = '<div style="padding: 1rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;">💬 <a href="#" onclick="location.reload(); return false;" style="color: #4A90E2;">Reload page</a> to load comments</div>';
            // Try multiple times with increasing delays
            [1000, 2000, 3000].forEach((delay, attempt) => {
              setTimeout(() => {
                if (typeof CommentSection !== 'undefined') {
                  try {
                    window.commentSections[articleId] = new CommentSection(articleId);
                    console.log('[PostFeed] ✓ Delayed initialization successful for', articleId, `(attempt ${attempt + 1})`);
                  } catch (err) {
                    console.error('[PostFeed] ✗ Delayed initialization failed for', articleId, err);
                  }
                }
              }, delay);
            });
          }
        } else {
          // Re-render existing section
          try {
            window.commentSections[articleId].render();
            console.log('[PostFeed] ✓ Re-rendered existing CommentSection for', articleId);
          } catch (err) {
            console.error('[PostFeed] ✗ Failed to re-render CommentSection for', articleId, err);
          }
        }
      }
    }, 500); // Increased delay to ensure DOM is ready
    
    // Verify the replacement worked
    const articleCards = container.querySelectorAll('article.article-card');
    console.log('[PostFeed] Successfully replaced container content');
    console.log('[PostFeed] Container now has', articleCards.length, 'article cards');
    
    if (articleCards.length === 0) {
      console.error('[PostFeed] WARNING: No article cards found after setting innerHTML!');
      console.error('[PostFeed] Container HTML:', container.innerHTML.substring(0, 500));
    } else {
      console.log('[PostFeed] First card:', {
        title: articleCards[0].querySelector('.article-headline')?.textContent?.substring(0, 50),
        hasImage: !!articleCards[0].querySelector('.article-image img'),
        link: articleCards[0].querySelector('a')?.href
      });
    }
    
  } catch (renderError) {
    console.error('[PostFeed] Error rendering posts:', renderError);
    // Fall back to original content
    if (originalContent && originalContent.trim().length > 50) {
      container.innerHTML = originalContent;
    } else {
      container.innerHTML = '<article class="article-card"><div class="article-content"><h3>Error rendering posts</h3><p>Please try refreshing the page.</p></div></article>';
    }
    return;
  }

  // Reinitialize carousel if it exists
  if (typeof initializeNewsCarousel === 'function') {
    initializeNewsCarousel();
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.renderPostFeed = renderPostFeed;
}

