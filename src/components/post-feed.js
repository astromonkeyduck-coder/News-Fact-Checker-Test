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

async function renderPostFeed(containerId, endpoint = '/.netlify/functions/posts-read', limit = 30, forceRefresh = false) {
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
      // Show loading state only if no cache
      container.innerHTML = '<div class="post-feed-loading" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">Loading posts...</div>';
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
        }).catch(() => {});
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
 * Render posts to the container
 */
function renderPosts(posts, container, originalContent = null) {
  const formatDate = (isoString) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const formatStory = (text) => {
    if (!text) return '';
    // Escape HTML
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    // Convert \n to <br>
    return escaped.replace(/\n/g, '<br>');
  };

  // Validate posts before rendering
  if (!posts || !Array.isArray(posts)) {
    console.error('[PostFeed] Invalid posts data:', posts);
    // Show original content (placeholder cards) if available, otherwise error message
    if (originalContent && originalContent.trim().length > 50) {
      container.innerHTML = originalContent;
    } else {
      container.innerHTML = '<article class="article-card"><div class="article-content"><h3>No posts available</h3><p>Posts will appear here once they are loaded.</p></div></article>';
    }
    return;
  }

  if (posts.length === 0) {
    console.warn('[PostFeed] Empty posts array');
    // Show original content if available
    if (originalContent && originalContent.trim().length > 50) {
      container.innerHTML = originalContent;
    } else {
      container.innerHTML = '<article class="article-card"><div class="article-content"><h3>No posts yet</h3><p>More posts coming soon!</p></div></article>';
    }
    return;
  }

  console.log('[PostFeed] Rendering', posts.length, 'posts');
  console.log('[PostFeed] Sample post data:', posts.length > 0 ? {
    id: posts[0].id,
    title: posts[0].title,
    story: posts[0].story?.substring(0, 100),
    link: posts[0].link,
    image: posts[0].image,
    datePosted: posts[0].datePosted
  } : 'No posts');
  
  try {
    const postsHtml = posts.map((post, index) => {
      // Validate post structure
      if (!post || typeof post !== 'object') {
        console.warn(`[PostFeed] Invalid post at index ${index}:`, post);
        return '';
      }
      
      // Extract fields with multiple fallbacks
      const title = post.title || post.text || post.story?.substring(0, 80) || `Post ${index + 1}`;
      const story = post.story || post.text || post.html?.replace(/<[^>]*>/g, '').substring(0, 200) || '';
      const link = post.link || post.url || `https://x.com/newsnoteworthy/status/${post.id || ''}`;
      const imageUrl = post.image || post.thumbnail || null;
      
      console.log(`[PostFeed] Rendering post ${index + 1}:`, {
        title: title.substring(0, 50),
        hasStory: !!story,
        link,
        hasImage: !!imageUrl
      });
      
      const imageHtml = imageUrl 
        ? `<div class="article-image">
            <img src="${imageUrl}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy" onerror="this.style.display='none';" />
          </div>`
        : '';

      return `
        <article class="article-card" role="listitem" data-post-type="${post.postType || 'text'}" data-post-id="${post.id || index}">
          ${imageHtml}
          <div class="article-content">
            <h3 class="article-headline">
              <a href="${link}" target="_blank" rel="noopener noreferrer">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
            </h3>
            ${story ? `<p class="article-excerpt">${formatStory(story)}</p>` : ''}
            <div class="article-meta">
              <span class="article-date">${formatDate(post.datePosted || post.created_at || new Date().toISOString())}</span>
              <span class="article-read-time">${post.readTime || Math.ceil((story || title).split(/\s+/).length / 200) || 1} min read</span>
            </div>
          </div>
        </article>
      `;
    }).filter(html => html.length > 0).join(''); // Filter out empty posts
    
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
    
    // Clear and replace ALL content in the container
    container.innerHTML = postsHtml;
    
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

