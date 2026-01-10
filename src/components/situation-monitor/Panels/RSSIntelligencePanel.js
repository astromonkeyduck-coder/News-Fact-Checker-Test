/**
 * RSS Intelligence Panel
 * 
 * Displays aggregated headlines from credible RSS feeds with proper attribution.
 * Follows copyright-compliant headline+link policy.
 */

import { BasePanel } from './BasePanel.js';

export class RSSIntelligencePanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'RSS Intelligence', { collapsible: true });
    this.headlines = [];
    this.sources = [];
    this.filters = {
      region: null,
      topic: null,
      source: null,
      timeWindowHours: 24
    };
    this.searchQuery = '';
    this.lastUpdated = null;
    // Initialize asynchronously - don't call init() here, it's called once in async init()
    // Don't await - let it run asynchronously
    this.init().catch(err => {
      console.error('[RSSIntelligencePanel] Init error:', err);
    });
  }

  async init() {
    super.init(); // Call BasePanel.init() to set up DOM structure (idempotent)
    // Set up retry callback to reload headlines
    this.onRetry = () => {
      this.loadHeadlines();
    };
    this.setupControls(); // Setup controls after DOM is ready
    await this.loadHeadlines();
    this.setupRefresh();
  }

  setupControls() {
    const contentEl = this.getContentElement();
    if (!contentEl) return;

    // Search box
    const searchBox = contentEl.querySelector('.rss-search');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.render();
      });
    }

    // Filter dropdowns
    const regionFilter = contentEl.querySelector('.rss-filter-region');
    const topicFilter = contentEl.querySelector('.rss-filter-topic');
    const sourceFilter = contentEl.querySelector('.rss-filter-source');
    const timeFilter = contentEl.querySelector('.rss-filter-time');

    if (regionFilter) {
      regionFilter.addEventListener('change', (e) => {
        this.filters.region = e.target.value || null;
        this.loadHeadlines();
      });
    }

    if (topicFilter) {
      topicFilter.addEventListener('change', (e) => {
        this.filters.topic = e.target.value || null;
        this.loadHeadlines();
      });
    }

    if (sourceFilter) {
      sourceFilter.addEventListener('change', (e) => {
        this.filters.source = e.target.value || null;
        this.loadHeadlines();
      });
    }

    if (timeFilter) {
      timeFilter.addEventListener('change', (e) => {
        this.filters.timeWindowHours = parseInt(e.target.value) || 24;
        this.loadHeadlines();
      });
    }

    // Refresh button
    const refreshBtn = contentEl.querySelector('.rss-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadHeadlines(true); // Force refresh
      });
    }
  }

  async loadHeadlines(forceRefresh = false) {
    this.setLoading(true);
    this.setError(null);

    try {
      // Ensure filters is initialized
      if (!this.filters) {
        this.filters = {
          region: null,
          topic: null,
          source: null,
          timeWindowHours: 24
        };
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (this.filters.region) params.set('region', this.filters.region);
      if (this.filters.topic) params.set('topic', this.filters.topic);
      if (this.filters.source) params.set('source', this.filters.source);
      if (this.filters.timeWindowHours) params.set('timeWindowHours', this.filters.timeWindowHours);
      if (forceRefresh) params.set('_t', Date.now()); // Cache bust

      const response = await fetch(`/.netlify/functions/rss-aggregate?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feeds: ${response.statusText}`);
      }

      const data = await response.json();
      
      this.headlines = data.items || [];
      this.sources = data.sources || [];
      this.lastUpdated = data.fetchedAt || new Date().toISOString();
      
      this.render();
      this.setLoading(false);
    } catch (error) {
      console.error('[RSSIntelligencePanel] Load error:', error);
      this.setError(error);
      this.setLoading(false);
    }
  }

  render() {
    const contentEl = this.getContentElement();
    if (!contentEl) return;

    // Filter headlines by search query
    let filteredHeadlines = this.headlines;
    if (this.searchQuery) {
      filteredHeadlines = this.headlines.filter(item => 
        item.title.toLowerCase().includes(this.searchQuery) ||
        (item.snippet && item.snippet.toLowerCase().includes(this.searchQuery))
      );
    }

    // Get unique regions and topics from sources
    const allRegions = new Set();
    const allTopics = new Set();
    const allSources = new Set();
    
    // This would ideally come from feed metadata, but for now we'll use source names
    this.sources.forEach(source => {
      allSources.add(source.name);
    });

    const content = `
      <div class="rss-controls">
        <div class="rss-controls-top">
          <input 
            type="text" 
            class="rss-search" 
            placeholder="Search headlines..."
            value="${this.escapeHtml(this.searchQuery)}"
          />
          <button class="rss-refresh-btn" aria-label="Refresh feeds">Refresh</button>
        </div>
        <div class="rss-controls-filters">
          <select class="rss-filter-region">
            <option value="">All Regions</option>
            <option value="Global" ${this.filters.region === 'Global' ? 'selected' : ''}>Global</option>
            <option value="US" ${this.filters.region === 'US' ? 'selected' : ''}>US</option>
            <option value="Europe" ${this.filters.region === 'Europe' ? 'selected' : ''}>Europe</option>
            <option value="Middle East" ${this.filters.region === 'Middle East' ? 'selected' : ''}>Middle East</option>
          </select>
          <select class="rss-filter-topic">
            <option value="">All Topics</option>
            <option value="World" ${this.filters.topic === 'World' ? 'selected' : ''}>World</option>
            <option value="Politics" ${this.filters.topic === 'Politics' ? 'selected' : ''}>Politics</option>
            <option value="Business" ${this.filters.topic === 'Business' ? 'selected' : ''}>Business</option>
            <option value="Breaking" ${this.filters.topic === 'Breaking' ? 'selected' : ''}>Breaking</option>
          </select>
          <select class="rss-filter-source">
            <option value="">All Sources</option>
            ${Array.from(allSources).map(name => `
              <option value="${this.escapeHtml(name)}" ${this.filters.source === name ? 'selected' : ''}>
                ${this.escapeHtml(name)}
              </option>
            `).join('')}
          </select>
          <select class="rss-filter-time">
            <option value="1" ${this.filters.timeWindowHours === 1 ? 'selected' : ''}>Last 1 hour</option>
            <option value="6" ${this.filters.timeWindowHours === 6 ? 'selected' : ''}>Last 6 hours</option>
            <option value="24" ${this.filters.timeWindowHours === 24 ? 'selected' : ''}>Last 24 hours</option>
            <option value="168" ${this.filters.timeWindowHours === 168 ? 'selected' : ''}>Last week</option>
          </select>
        </div>
        <div class="rss-status">
          <span class="rss-last-updated">
            Last updated: ${this.formatTime(this.lastUpdated)}
          </span>
          <span class="rss-count">
            ${filteredHeadlines.length} headline${filteredHeadlines.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div class="rss-headlines-list">
        ${filteredHeadlines.length === 0 ? `
          <div class="rss-empty">
            <p>No headlines found. ${this.searchQuery ? 'Try a different search.' : 'Feeds may be updating.'}</p>
          </div>
        ` : filteredHeadlines.map(item => this.renderHeadlineItem(item)).join('')}
      </div>

      <div class="rss-footer">
        <p class="rss-disclaimer">
          Headlines and snippets are provided by their respective publishers. 
          Click through for full context. © rights belong to original owners.
        </p>
        <p class="rss-affiliation">
          Not affiliated with publishers. <a href="/contact.html">Contact</a> to request feed removal.
        </p>
      </div>
    `;

    super.render(content);
    
    // Re-bind controls after render (DOM is now ready)
    setTimeout(() => {
      this.setupControls();
    }, 0);
  }

  renderHeadlineItem(item) {
    const timeAgo = this.formatTimeAgo(item.publishedAt);
    const snippet = item.snippet ? `<p class="rss-snippet">${this.escapeHtml(item.snippet)}</p>` : '';
    
    return `
      <div class="rss-headline-item">
        <div class="rss-headline-header">
          <h4 class="rss-headline-title">
            <a 
              href="${this.escapeHtml(item.url)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="rss-headline-link"
            >
              ${this.escapeHtml(item.title)}
            </a>
          </h4>
          <span class="rss-headline-time">${timeAgo}</span>
        </div>
        ${snippet}
        <div class="rss-headline-footer">
          <span class="rss-source">
            Source: 
            <a 
              href="${this.escapeHtml(item.url)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="rss-source-link"
            >
              ${this.escapeHtml(item.rawSourceName)}
            </a>
          </span>
          <span class="rss-via">via RSS</span>
        </div>
      </div>
    `;
  }

  formatTime(isoString) {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString();
  }

  formatTimeAgo(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setupRefresh() {
    // Auto-refresh every 10 minutes
    setInterval(() => {
      if (!this.collapsed && this.enabled) {
        this.loadHeadlines();
      }
    }, 10 * 60 * 1000);
  }
}
