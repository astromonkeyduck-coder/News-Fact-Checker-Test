/**
 * Vanilla JS version of PostFeed
 * Usage: renderPostFeed('articlesTrack', '/.netlify/functions/posts-read', 30)
 * Version: 2.0 - Silent error handling for local dev
 */
async function renderPostFeed(containerId, endpoint = '/.netlify/functions/posts-read', limit = 30) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // Store original content in case of error
  const originalContent = container.innerHTML;
  container.innerHTML = '<div class="post-feed-loading" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">Loading posts...</div>';

  try {
    // Handle endpoint - add limit param if not already present
    // Support both relative and absolute URLs
    let fetchUrl;
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      // Absolute URL
      const url = new URL(endpoint);
      if (!url.searchParams.has('limit')) {
        url.searchParams.set('limit', limit);
      }
      fetchUrl = url.toString();
    } else {
      // Relative URL
      const url = new URL(endpoint, window.location.origin);
      if (!url.searchParams.has('limit')) {
        url.searchParams.set('limit', limit);
      }
      fetchUrl = url.pathname + url.search;
    }
    
    // Check if we're in local development
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.port === '8888';
    
    let res;
    try {
      res = await fetch(fetchUrl);
    } catch (fetchError) {
      // Silently handle fetch errors in local dev - don't throw, just restore content
      if (isLocalDev) {
        container.innerHTML = originalContent;
        return; // Exit early, no error thrown
      }
      throw fetchError;
    }
    
    // Check if response is HTML (404 page) - happens before checking res.ok
    const contentType = res.headers.get('content-type') || '';
    const isHtmlResponse = contentType.includes('text/html');
    
    if (!res.ok || isHtmlResponse || res.status === 404) {
      // Silently handle 404s in local development - restore content without throwing error
      if (isLocalDev) {
        container.innerHTML = originalContent;
        return; // Exit early, no error thrown
      }
      // Only throw errors in production
      if (isHtmlResponse || res.status === 404) {
        throw new Error(`Function not found (404). The Netlify function may not be deployed yet.`);
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const posts = await res.json();
    
    console.log('Posts received:', posts.length, posts);
    
    if (!Array.isArray(posts) || posts.length === 0) {
      // Keep placeholder cards if no posts yet (don't show empty message)
      container.innerHTML = originalContent;
      console.info('No posts in storage yet. Add posts via fetch-profile-tweets or x-webhook.');
      return;
    }

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

    container.innerHTML = posts.map(post => {
      const imageHtml = post.image 
        ? `<div class="article-image">
            <img src="${post.image}" alt="${(post.title || '').replace(/"/g, '&quot;')}" loading="lazy" />
          </div>`
        : '';

      return `
        <article class="article-card" role="listitem" data-post-type="${post.postType || 'text'}">
          ${imageHtml}
          <div class="article-content">
            <h3 class="article-headline">
              <a href="${post.link || '#'}" target="_blank" rel="noopener noreferrer">${(post.title || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
            </h3>
            <p class="article-excerpt">${formatStory(post.story || '')}</p>
            <div class="article-meta">
              <span class="article-date">${formatDate(post.datePosted || new Date().toISOString())}</span>
              <span class="article-read-time">${post.readTime || 1} min read</span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Reinitialize carousel if it exists
    if (typeof initializeNewsCarousel === 'function') {
      initializeNewsCarousel();
    }
  } catch (err) {
    // Restore original content (placeholder cards) instead of showing error
    container.innerHTML = originalContent;
    
    // Silently handle expected errors in local development
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const is404 = err.message && (err.message.includes('404') || err.message.includes('File not found'));
    const isNetworkError = err.message && (err.message.includes('Failed to fetch') || err.message.includes('network'));
    
    // Only log unexpected errors (not in local dev, not 404s, not network errors)
    if (!isLocalDev && !is404 && !isNetworkError) {
      console.warn('Unable to load new posts. Showing placeholder content.', err.message || err);
    }
    // In local dev with expected errors, do nothing - silently fail
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.renderPostFeed = renderPostFeed;
}

