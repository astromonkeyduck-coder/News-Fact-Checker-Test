/**
 * Personalized Recommendations Utility
 * Provides article recommendations based on reading history
 */

(function() {
  'use strict';

  /**
   * Get personalized recommendations
   */
  async function getRecommendations(limit = 5) {
    if (!window.ReadingHistory) {
      return [];
    }

    try {
      // Get reading history
      const history = await window.ReadingHistory.getFromServer();
      
      if (history.length === 0) {
        // No history, return trending/popular articles
        return await getTrendingArticles(limit);
      }

      // Analyze history to find patterns
      const categories = {};
      const keywords = new Set();
      
      history.forEach(item => {
        // Count category preferences
        if (item.category) {
          categories[item.category] = (categories[item.category] || 0) + 1;
        }
        
        // Extract keywords from titles
        const words = (item.title || '').toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4) { // Only meaningful words
            keywords.add(word);
          }
        });
      });

      // Get preferred category
      const preferredCategory = Object.keys(categories).sort((a, b) => 
        categories[b] - categories[a]
      )[0];

      // Fetch articles
      const allArticles = await fetchArticles();
      
      // Score and rank articles
      const scored = allArticles
        .filter(article => {
          // Exclude already viewed
          return !history.some(h => h.id === article.id);
        })
        .map(article => {
          let score = 0;
          
          // Category match
          if (article.category === preferredCategory) {
            score += 10;
          }
          
          // Keyword matches in title
          const titleWords = (article.title || '').toLowerCase().split(/\s+/);
          titleWords.forEach(word => {
            if (keywords.has(word)) {
              score += 2;
            }
          });
          
          // Recency (newer articles get bonus)
          if (article.datePosted) {
            const daysSince = (Date.now() - new Date(article.datePosted).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) score += 5;
            else if (daysSince < 30) score += 2;
          }
          
          return { ...article, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    } catch (error) {
      console.error('[Recommendations] Error:', error);
      return await getTrendingArticles(limit);
    }
  }

  /**
   * Fetch articles from API
   */
  async function fetchArticles() {
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const endpoint = isLocalhost
        ? 'http://localhost:8888/.netlify/functions/posts-read?limit=50'
        : '/.netlify/functions/posts-read?limit=50';
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch articles');
      
      return await response.json();
    } catch (error) {
      console.error('[Recommendations] Error fetching articles:', error);
      return [];
    }
  }

  /**
   * Get trending articles (fallback)
   */
  async function getTrendingArticles(limit) {
    try {
      const articles = await fetchArticles();
      // Return most recent
      return articles.slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  /**
   * Render recommendations to container
   */
  async function renderRecommendations(containerId, limit = 5) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div style="color: rgba(255,255,255,0.7);">Loading recommendations...</div>';

    try {
      const recommendations = await getRecommendations(limit);
      
      if (recommendations.length === 0) {
        container.innerHTML = '<div style="color: rgba(255,255,255,0.7);">No recommendations available.</div>';
        return;
      }

      container.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #4A90E2;">You might like</h3>
        <div style="display: grid; gap: 1rem;">
          ${recommendations.map(article => `
            <a 
              href="/article.html?id=${encodeURIComponent(article.id)}"
              style="
                display: block;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                text-decoration: none;
                transition: all 0.2s;
              "
              onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.borderColor='rgba(74,144,226,0.3)'"
              onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.1)'"
            >
              <h4 style="margin: 0 0 0.5rem 0; color: white; font-size: 1rem;">${escapeHtml(article.title || 'Untitled')}</h4>
              ${article.story ? `<p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 0.875rem; line-height: 1.4;">${escapeHtml(article.story.substring(0, 100))}${article.story.length > 100 ? '...' : ''}</p>` : ''}
            </a>
          `).join('')}
        </div>
      `;
    } catch (error) {
      console.error('[Recommendations] Error rendering:', error);
      container.innerHTML = '<div style="color: rgba(255,255,255,0.7);">Error loading recommendations.</div>';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Expose API
  window.Recommendations = {
    get: getRecommendations,
    render: renderRecommendations
  };
})();

