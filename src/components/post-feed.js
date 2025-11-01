/**
 * Vanilla JS version of PostFeed
 * Usage: renderPostFeed('articlesTrack', '/.netlify/functions/posts-read', 30)
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
    const url = new URL(endpoint, window.location.origin);
    if (!url.searchParams.has('limit')) {
      url.searchParams.set('limit', limit);
    }
    const res = await fetch(url.pathname + url.search);
    if (!res.ok) {
      // Check if response is HTML (404 page)
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error(`Function not found (404). The Netlify function may not be deployed yet.`);
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const posts = await res.json();
    
    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = '<div class="post-feed-empty" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">No posts yet. Posts from X will appear here.</div>';
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
    console.error('Error loading posts:', err);
    // Restore original content (placeholder cards) instead of showing error
    container.innerHTML = originalContent;
    // Optionally add a small error indicator without replacing cards
    const errorNote = document.createElement('div');
    errorNote.className = 'post-feed-error-note';
    errorNote.style.cssText = 'padding: 0.5rem; text-align: center; color: rgba(255,200,100,0.8); font-size: 0.85rem;';
    errorNote.textContent = 'Unable to load new posts. Showing placeholder content.';
    // Insert at the end of container without replacing
    container.appendChild(errorNote);
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.renderPostFeed = renderPostFeed;
}

