/**
 * Provider UI Helpers (badges, icons)
 */

const PROVIDER_INFO = {
  windy: {
    name: 'Windy',
    color: '#4A90E2',
    icon: '🌐'
  },
  fl511: {
    name: 'FL511',
    color: '#FF6B6B',
    icon: '🚦'
  },
  ny511: {
    name: 'NY511',
    color: '#4ECDC4',
    icon: '🚦'
  },
  caltrans: {
    name: 'Caltrans',
    color: '#FFE66D',
    icon: '🚦'
  },
  nycdot: {
    name: 'NYC DOT',
    color: '#95E1D3',
    icon: '🏙️'
  }
};

/**
 * Get provider badge HTML
 */
export function getProviderBadge(provider) {
  const info = PROVIDER_INFO[provider] || { name: provider, color: '#666', icon: '📹' };
  return `
    <span class="livecams-provider-badge" style="background: ${info.color}20; color: ${info.color}; border-color: ${info.color}40;">
      ${info.icon} ${info.name}
    </span>
  `;
}

/**
 * Get camera type icon
 */
export function getTypeIcon(type) {
  const icons = {
    dot_traffic: '🚦',
    city_street: '🏙️',
    scenic: '🌄',
    other: '📹'
  };
  return icons[type] || icons.other;
}

/**
 * Get status indicator
 */
export function getStatusIndicator(status) {
  const indicators = {
    online: '<span class="livecams-status-dot online"></span>',
    offline: '<span class="livecams-status-dot offline"></span>',
    unknown: '<span class="livecams-status-dot unknown"></span>'
  };
  return indicators[status] || indicators.unknown;
}
