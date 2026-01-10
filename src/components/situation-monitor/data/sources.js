/**
 * Data Sources Configuration
 * Free, reliable sources for Situation Monitor
 */

export const NEWS_FEEDS = {
  world: [
    {
      name: 'BBC World',
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      category: 'world',
      reliability: 'high'
    },
    {
      name: 'NPR World',
      url: 'https://feeds.npr.org/1004/rss.xml',
      category: 'world',
      reliability: 'high'
    },
    {
      name: 'Guardian World',
      url: 'https://www.theguardian.com/world/rss',
      category: 'world',
      reliability: 'high'
    }
  ],
  tech: [
    {
      name: 'Hacker News',
      url: 'https://hnrss.org/frontpage',
      category: 'tech',
      reliability: 'medium'
    },
    {
      name: 'The Verge',
      url: 'https://www.theverge.com/rss/index.xml',
      category: 'tech',
      reliability: 'high'
    },
    {
      name: 'MIT Tech Review',
      url: 'https://www.technologyreview.com/feed/',
      category: 'tech',
      reliability: 'high'
    },
    {
      name: 'arXiv AI',
      url: 'https://arxiv.org/list/cs.AI/recent?show=100',
      category: 'tech',
      reliability: 'high',
      note: 'Requires HTML parsing, not RSS'
    }
  ],
  finance: [
    {
      name: 'MarketWatch',
      url: 'https://feeds.marketwatch.com/marketwatch/topstories/',
      category: 'finance',
      reliability: 'high'
    },
    {
      name: 'CNBC',
      url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
      category: 'finance',
      reliability: 'high'
    }
  ],
  gov: [
    {
      name: 'White House',
      url: 'https://www.whitehouse.gov/feed/',
      category: 'gov',
      reliability: 'high'
    },
    {
      name: 'State Department',
      url: 'https://www.state.gov/rss-feed/',
      category: 'gov',
      reliability: 'high'
    }
  ]
};

// GDELT fallback (if RSS fails)
export const GDELT_CONFIG = {
  baseUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
  categories: {
    world: 'World',
    tech: 'Technology',
    finance: 'Finance',
    gov: 'Government'
  },
  note: 'Requires CORS proxy or backend function'
};

// Weather sources
export const WEATHER_SOURCES = {
  openMeteo: {
    baseUrl: 'https://api.open-meteo.com/v1',
    noKey: true,
    endpoints: {
      current: '/forecast',
      alerts: '/alerts'
    }
  },
  weatherGov: {
    baseUrl: 'https://api.weather.gov',
    alertsUrl: 'https://api.weather.gov/alerts/active',
    noKey: true,
    note: 'Requires User-Agent header'
  }
};

// Earthquake sources
export const EARTHQUAKE_SOURCES = {
  usgs: {
    baseUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary',
    feeds: {
      day45: '/4.5_day.geojson',
      week45: '/4.5_week.geojson',
      month45: '/4.5_month.geojson'
    },
    noKey: true
  }
};

// Market sources
export const MARKET_SOURCES = {
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    endpoints: {
      simple: '/simple/price',
      markets: '/coins/markets'
    },
    noKey: true,
    rateLimit: '10-50 calls/minute'
  }
};

// Flight sources (optional, best effort)
export const FLIGHT_SOURCES = {
  openSky: {
    baseUrl: 'https://opensky-network.org/api',
    endpoints: {
      states: '/states/all'
    },
    noKey: true,
    note: 'May have CORS/rate limit issues'
  }
};

// Hotspots configuration (geopolitical hotspots)
export const HOTSPOTS = [
  {
    id: 'ukraine',
    name: 'Ukraine',
    lat: 48.3794,
    lon: 31.1656,
    threatLevel: 'high',
    category: 'conflict'
  },
  {
    id: 'gaza',
    name: 'Gaza Strip',
    lat: 31.3547,
    lon: 34.3088,
    threatLevel: 'high',
    category: 'conflict'
  },
  {
    id: 'taiwan',
    name: 'Taiwan Strait',
    lat: 23.5,
    lon: 121.0,
    threatLevel: 'medium',
    category: 'tension'
  },
  {
    id: 'korea',
    name: 'Korean Peninsula',
    lat: 38.5,
    lon: 127.5,
    threatLevel: 'medium',
    category: 'tension'
  },
  {
    id: 'south-china-sea',
    name: 'South China Sea',
    lat: 12.0,
    lon: 115.0,
    threatLevel: 'medium',
    category: 'tension'
  }
];

// Conflict zones (polygon bounds)
export const CONFLICT_ZONES = [
  {
    id: 'ukraine-zone',
    name: 'Ukraine Conflict Zone',
    bounds: [[44.0, 22.0], [52.0, 40.0]],
    threatLevel: 'high'
  },
  {
    id: 'gaza-zone',
    name: 'Gaza Conflict Zone',
    bounds: [[31.0, 34.0], [32.0, 35.0]],
    threatLevel: 'high'
  }
];

// Shipping chokepoints
export const CHOKEPOINTS = [
  { id: 'strait-hormuz', name: 'Strait of Hormuz', lat: 26.5, lon: 56.5 },
  { id: 'strait-malacca', name: 'Strait of Malacca', lat: 1.5, lon: 103.0 },
  { id: 'suez-canal', name: 'Suez Canal', lat: 30.0, lon: 32.3 },
  { id: 'panama-canal', name: 'Panama Canal', lat: 9.0, lon: -79.5 },
  { id: 'bab-el-mandeb', name: 'Bab el-Mandeb', lat: 12.5, lon: 43.0 }
];

// Undersea cable landing points (major ones)
export const CABLE_POINTS = [
  { id: 'nyc', name: 'New York', lat: 40.7, lon: -74.0 },
  { id: 'london', name: 'London', lat: 51.5, lon: -0.1 },
  { id: 'tokyo', name: 'Tokyo', lat: 35.7, lon: 139.8 },
  { id: 'singapore', name: 'Singapore', lat: 1.3, lon: 103.8 },
  { id: 'mumbai', name: 'Mumbai', lat: 19.1, lon: 72.9 }
];

// Military bases (major strategic locations)
export const MILITARY_BASES = [
  { id: 'diego-garcia', name: 'Diego Garcia', lat: -7.3, lon: 72.4, type: 'naval' },
  { id: 'guam', name: 'Guam', lat: 13.4, lon: 144.8, type: 'air' },
  { id: 'okinawa', name: 'Okinawa', lat: 26.3, lon: 127.8, type: 'air' }
];

// Nuclear facilities (major ones)
export const NUCLEAR_FACILITIES = [
  { id: 'fukushima', name: 'Fukushima', lat: 37.4, lon: 141.0 },
  { id: 'chernobyl', name: 'Chernobyl', lat: 51.4, lon: 30.1 },
  { id: 'zaporizhzhia', name: 'Zaporizhzhia', lat: 47.5, lon: 34.6 }
];
