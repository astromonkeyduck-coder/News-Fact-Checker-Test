/**
 * News Panel Component
 */

import { BasePanel } from './BasePanel.js';
import { fetchRSSFeed } from '../data/fetchers.js';
import { parseRSS } from '../data/parsers.js';
import { NEWS_FEEDS } from '../data/sources.js';

export class NewsPanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'News Feed', { collapsible: true });
    this.headlines = [];
    this.currentFeed = 'all';
    // Don't await - let it run asynchronously
    this.init().catch(err => {
      console.error('[NewsPanel] Init error:', err);
    });
  }

  async init() {
    await this.loadNews();
    this.setupRefresh();
  }

  async loadNews() {
    this.setLoading(true);
    this.setError(null);

    try {
      const allHeadlines = [];
      
      // Fetch from all categories
      for (const category of Object.keys(NEWS_FEEDS)) {
        for (const feed of NEWS_FEEDS[category]) {
          try {
            const feedData = await fetchRSSFeed(feed.url, feed.name);
            const items = parseRSS(feedData.content);
            
            items.forEach(item => {
              allHeadlines.push({
                ...item,
                source: feed.name,
                category: feed.category,
                reliability: feed.reliability
              });
            });
          } catch (error) {
            console.warn(`[NewsPanel] Failed to load ${feed.name}:`, error);
          }
        }
      }

      // Sort by date (newest first)
      allHeadlines.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      this.headlines = allHeadlines.slice(0, 50); // Top 50

      this.render();
      this.setLoading(false);
    } catch (error) {
      console.error('[NewsPanel] Load error:', error);
      this.setError(error);
      this.setLoading(false);
    }
  }

  render() {
    if (!this.headlines || this.headlines.length === 0) {
      this.showEmptyState('No headlines available – will refresh automatically');
      return;
    }

    const content = this.headlines.map(headline => `
      <div class="sitmon-news-item">
        <div class="sitmon-news-header">
          <span class="sitmon-news-source">${escapeHtml(headline.source)}</span>
          <span class="sitmon-news-time">${formatTime(headline.timestamp)}</span>
        </div>
        <h4 class="sitmon-news-title">
          <a href="${escapeHtml(headline.link)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(headline.title)}
          </a>
        </h4>
        ${headline.description ? `
          <p class="sitmon-news-description">${escapeHtml(headline.description.substring(0, 150))}...</p>
        ` : ''}
      </div>
    `).join('');

    super.render(`
      <div class="sitmon-news-list">
        ${content}
      </div>
    `);
  }

  setupRefresh() {
    // Auto-refresh every 5 minutes
    setInterval(() => {
      if (!this.collapsed && this.enabled) {
        this.loadNews();
      }
    }, 5 * 60 * 1000);
  }

  getHeadlines() {
    return this.headlines;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
