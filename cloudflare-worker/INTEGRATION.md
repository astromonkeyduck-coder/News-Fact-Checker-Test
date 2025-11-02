# Netlify Site Integration Guide

## Quick Integration Steps

### 1. Add Worker URL Configuration

In your `index.html`, add this before loading the feed component:

```html
<script>
  // Set your Cloudflare Worker URL
  window.WORKER_BASE_URL = 'https://x-feed.yourdomain.com'; // Replace with your actual URL
</script>
```

### 2. Load the Feed Component

Add this to your `index.html` where you want the feed to appear:

```html
<!-- Load Cloudflare feed component -->
<script type="module" src="/src/components/cloudflare-post-feed.js"></script>

<script>
  // Initialize feed when page loads
  document.addEventListener('DOMContentLoaded', () => {
    // Replace 'articlesTrack' with your container ID
    window.renderCloudflareFeed('articlesTrack', {
      limit: 50,              // Number of posts to fetch
      autoRefresh: true,      // Auto-refresh every 60 seconds
      refreshInterval: 60000, // Refresh interval in ms
      showLoading: true,      // Show loading state
    });
  });
</script>
```

### 3. HTML Container

Make sure you have a container element in your HTML:

```html
<div class="news-carousel" role="region" aria-label="News articles carousel">
  <div class="articles-track" id="articlesTrack" role="list" aria-live="polite">
    <!-- Feed posts will be inserted here -->
  </div>
</div>
```

## Alternative: Vanilla JS Integration

If you prefer not to use modules:

```html
<script>
  // Set Worker URL
  window.WORKER_BASE_URL = 'https://x-feed.yourdomain.com';
  
  // Fetch and render function
  async function renderFeed() {
    const container = document.getElementById('articlesTrack');
    if (!container) return;
    
    try {
      const response = await fetch(`${window.WORKER_BASE_URL}/feed?limit=50`, {
        cache: 'no-store'
      });
      const posts = await response.json();
      
      // Map to your card format
      container.innerHTML = posts.map(post => {
        const imageHtml = post.image 
          ? `<div class="article-image"><img src="${post.image}" alt="" loading="lazy" /></div>`
          : `<div class="article-image" style="background: linear-gradient(135deg, rgba(74,144,226,0.2), rgba(46,204,113,0.2)); display: flex; align-items: center; justify-content: center; min-height: 200px;"><div style="font-size: 48px; font-weight: 700; color: rgba(74,144,226,0.8);">NW</div></div>`;
        
        return `
          <article class="article-card">
            ${imageHtml}
            <div class="article-content">
              <h3 class="article-headline">
                <a href="${post.url}" target="_blank">${post.text.substring(0, 80)}</a>
              </h3>
              <p class="article-excerpt">${post.text.substring(0, 200)}</p>
              <div class="article-meta">
                <span class="article-date">${formatTimeAgo(post.created_at)}</span>
                <span class="article-read-time">${Math.ceil(post.text.split(/\s+/).length / 225)} min read</span>
              </div>
            </div>
          </article>
        `;
      }).join('');
      
    } catch (error) {
      console.error('Feed error:', error);
    }
  }
  
  function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return new Date(timestamp).toLocaleDateString();
  }
  
  // Auto-refresh every 60 seconds
  renderFeed();
  setInterval(renderFeed, 60000);
</script>
```

## Manual Refresh

Add a refresh button:

```html
<button id="refreshFeed" onclick="window.renderCloudflareFeed('articlesTrack')">
  🔄 Refresh Feed
</button>
```

## Error Handling

The component automatically handles errors and shows user-friendly messages. You can also catch errors:

```javascript
window.renderCloudflareFeed('articlesTrack', {
  limit: 50,
  autoRefresh: true,
}).catch(error => {
  console.error('Failed to load feed:', error);
  // Show fallback content
});
```

## Customization

### Custom Categories

The feed supports three categories:
- `Breaking` - Shown with red/bold styling
- `Developing` - Shown with yellow/orange styling  
- `Update` - Default, standard styling

You can update categories via the PATCH endpoint or set default in the Worker code.

### Styling

The component uses your existing `.article-card` styles. To customize:

```css
.article-card[data-category="breaking"] {
  border-left: 4px solid #ff6b6b;
}

.article-card[data-category="developing"] {
  border-left: 4px solid #ffa500;
}
```

## Testing

1. **Test feed endpoint:**
   ```bash
   curl https://x-feed.yourdomain.com/feed?limit=5
   ```

2. **Test adding a tweet:**
   ```bash
   curl -X POST https://x-feed.yourdomain.com/add \
     -H "Content-Type: application/json" \
     -d '{"url":"https://x.com/username/status/123456"}'
   ```

3. **Check browser console:**
   - Open DevTools (F12)
   - Look for `[CloudflareFeed]` log messages
   - Check Network tab for requests to Worker

## Migration from Netlify Functions

If you're migrating from the old Netlify Functions approach:

1. Replace `renderPostFeed()` calls with `renderCloudflareFeed()`
2. Update endpoint from `/.netlify/functions/posts-read` to your Worker URL
3. Remove old `post-feed.js` import
4. Add new `cloudflare-post-feed.js` import
5. Set `window.WORKER_BASE_URL`

The card format is compatible, so no HTML/CSS changes needed!


