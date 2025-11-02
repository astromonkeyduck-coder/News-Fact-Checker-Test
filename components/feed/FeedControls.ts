/**
 * FeedControls Component - Search and Sort controls
 */

import { PostSortMode } from '../../lib/feed/types';

export interface FeedControlsOptions {
  currentSort: PostSortMode;
  currentSearch: string;
  totalPosts: number;
  onSortChange: (sort: PostSortMode) => void;
  onSearchChange: (query: string) => void;
}

/**
 * Render feed controls (search + sort)
 */
export function renderFeedControls(options: FeedControlsOptions): string {
  const { currentSort, currentSearch, totalPosts, onSortChange, onSearchChange } = options;
  
  // Create unique IDs for inputs
  const searchId = 'feed-search-' + Date.now();
  const sortId = 'feed-sort-' + Date.now();
  
  return `
    <div 
      class="feed-controls"
      style="
        position: sticky;
        top: 0;
        z-index: 10;
        background: rgba(15, 15, 35, 0.95);
        backdrop-filter: blur(10px);
        padding: 1rem;
        margin-bottom: 2rem;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      "
    >
      <div style="flex: 1; min-width: 250px;">
        <input
          id="${searchId}"
          type="text"
          placeholder="🔍 Search posts, tags, @handles..."
          value="${escapeHtml(currentSearch)}"
          class="feed-search-input"
          style="
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            transition: all 0.3s ease;
          "
          onfocus="this.style.borderColor='#4A90E2'; this.style.boxShadow='0 0 0 3px rgba(74, 144, 226, 0.5)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.2)'; this.style.boxShadow='none'"
        />
      </div>
      
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <label 
          for="${sortId}"
          style="color: rgba(255,255,255,0.9); font-size: 0.9rem; white-space: nowrap;"
        >Sort by:</label>
        <select
          id="${sortId}"
          class="feed-sort-select"
          style="
            padding: 0.75rem 1rem;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: #fff;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
          "
          onfocus="this.style.borderColor='#4A90E2'; this.style.boxShadow='0 0 0 3px rgba(74, 144, 226, 0.5)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.2)'; this.style.boxShadow='none'"
        >
          <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>Most Recent</option>
          <option value="views" ${currentSort === 'views' ? 'selected' : ''}>Most Views</option>
          <option value="likes" ${currentSort === 'likes' ? 'selected' : ''}>Most Likes</option>
          <option value="comments" ${currentSort === 'comments' ? 'selected' : ''}>Most Comments</option>
          <option value="reposts" ${currentSort === 'reposts' ? 'selected' : ''}>Most Reposts</option>
        </select>
      </div>
      
      <div 
        class="feed-post-count"
        style="
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
          margin-left: auto;
          white-space: nowrap;
        "
      >
        ${totalPosts} ${totalPosts === 1 ? 'post' : 'posts'}
      </div>
    </div>
    
    <script>
      (function() {
        const searchInput = document.getElementById('${searchId}');
        const sortSelect = document.getElementById('${sortId}');
        
        let searchTimeout;
        
        if (searchInput) {
          searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
              ${onSearchChange.toString().replace(/"/g, '&quot;')}(e.target.value);
            }, 300);
          });
          
          // Keyboard shortcut: / to focus search
          document.addEventListener('keydown', function(e) {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
              e.preventDefault();
              searchInput.focus();
            }
          });
        }
        
        if (sortSelect) {
          sortSelect.addEventListener('change', function(e) {
            ${onSortChange.toString().replace(/"/g, '&quot;')}(e.target.value);
          });
        }
      })();
    </script>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

