/**
 * Markets Panel Component
 */

import { BasePanel } from './BasePanel.js';
import { fetchMarkets } from '../data/fetchers.js';

export class MarketsPanel extends BasePanel {
  constructor(containerId) {
    super(containerId, 'Markets', { collapsible: true });
    this.marketData = null;
    // Initialize asynchronously - don't call init() here, it's called once in async init()
    // Don't await - let it run asynchronously
    this.init().catch(err => {
      console.error('[MarketsPanel] Init error:', err);
    });
  }

  async init() {
    super.init(); // Call BasePanel.init() to set up DOM structure (idempotent)
    await this.loadMarkets();
    this.setupRefresh();
  }

  async loadMarkets() {
    this.setLoading(true);
    this.setError(null);

    try {
      const data = await fetchMarkets();
      
      if (data) {
        this.marketData = data;
        this.render();
      } else {
        this.setError(new Error('Market data unavailable'));
      }
      
      this.setLoading(false);
    } catch (error) {
      console.error('[MarketsPanel] Load error:', error);
      this.setError(error);
      this.setLoading(false);
    }
  }

  render() {
    if (!this.marketData) {
      super.render('<p>Market data unavailable</p>');
      return;
    }

    const coins = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
      { id: 'solana', name: 'Solana', symbol: 'SOL' }
    ];

    const content = coins.map(coin => {
      const data = this.marketData[coin.id];
      if (!data) return '';

      const price = data.usd || 0;
      const change24h = data.usd_24h_change || 0;
      const changeClass = change24h >= 0 ? 'positive' : 'negative';
      const changeIcon = change24h >= 0 ? '▲' : '▼';

      return `
        <div class="sitmon-market-item">
          <div class="sitmon-market-header">
            <span class="sitmon-market-name">${coin.name} (${coin.symbol})</span>
          </div>
          <div class="sitmon-market-price">
            $${formatNumber(price)}
          </div>
          <div class="sitmon-market-change ${changeClass}">
            ${changeIcon} ${Math.abs(change24h).toFixed(2)}%
          </div>
        </div>
      `;
    }).join('');

    super.render(`
      <div class="sitmon-markets-list">
        ${content || '<p>No market data available</p>'}
      </div>
      <div class="sitmon-market-note">
        <small>Data from CoinGecko (free tier)</small>
      </div>
    `);
  }

  setupRefresh() {
    // Auto-refresh every 30 seconds
    setInterval(() => {
      if (!this.collapsed && this.enabled) {
        this.loadMarkets();
      }
    }, 30000);
  }
}

function formatNumber(num) {
  if (num >= 1000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return num.toFixed(2);
}
