# Situation Monitor - Global Intelligence Dashboard

A comprehensive real-time monitoring dashboard for tracking global events, news, markets, weather, and geopolitical intelligence.

## Features

- **Interactive World Map**: D3.js + TopoJSON map with hotspots, conflict zones, chokepoints, and infrastructure markers
- **News Feed Aggregation**: RSS feeds from multiple sources (BBC, NPR, Guardian, etc.)
- **Market Data**: Real-time cryptocurrency prices (Bitcoin, Ethereum, Solana) via CoinGecko
- **Earthquake Monitoring**: USGS earthquake data (M4.5+) with map visualization
- **Weather Alerts**: US severe weather alerts from weather.gov
- **Analytics Panels**:
  - **Main Characters**: Top mentioned entities (countries, leaders, organizations)
  - **Correlations**: Topics spiking across multiple categories
  - **Narrative Tracking**: Fringe vs mainstream signal detection
  - **Custom Monitors**: User-defined keyword monitors with location markers

## File Structure

```
src/components/situation-monitor/
├── SituationMonitorShell.js    # Main component orchestrator
├── MapView.js                  # D3 map component
├── data/
│   ├── sources.js             # Data source configurations
│   ├── fetchers.js             # Fetch functions with caching
│   ├── parsers.js              # RSS/XML/GeoJSON parsers
│   └── analysis.js             # Analytics engine
└── Panels/
    ├── BasePanel.js            # Base panel component
    ├── NewsPanel.js            # News feed panel
    ├── MarketsPanel.js         # Markets panel
    ├── EarthquakePanel.js      # Earthquakes panel
    ├── WeatherAlertsPanel.js  # Weather alerts panel
    ├── IntelFeedPanel.js       # Main characters panel
    ├── CorrelationPanel.js    # Correlations panel
    ├── NarrativePanel.js      # Narrative tracking panel
    └── MonitorsPanel.js       # Custom monitors panel
```

## Data Sources

### News Feeds (RSS)
- **World**: BBC World, NPR, Guardian World
- **Tech**: Hacker News, The Verge, MIT Tech Review
- **Finance**: MarketWatch, CNBC
- **Government**: White House, State Department

### Weather
- **Open-Meteo**: Current conditions (no key required)
- **weather.gov**: US severe weather alerts (requires User-Agent header)

### Earthquakes
- **USGS**: GeoJSON feeds for M4.5+ earthquakes (no key required)

### Markets
- **CoinGecko**: Cryptocurrency prices (free tier, no key required)

### Fallback
- If RSS feeds fail due to CORS, consider using GDELT API (requires backend proxy)

## Adding/Removing Feeds

Edit `src/components/situation-monitor/data/sources.js`:

```javascript
export const NEWS_FEEDS = {
  world: [
    {
      name: 'Your Feed Name',
      url: 'https://example.com/feed.xml',
      category: 'world',
      reliability: 'high'
    }
  ]
};
```

## Adding Hotspots

Edit `src/components/situation-monitor/data/sources.js`:

```javascript
export const HOTSPOTS = [
  {
    id: 'unique-id',
    name: 'Location Name',
    lat: 48.3794,
    lon: 31.1656,
    threatLevel: 'high', // or 'medium', 'low'
    category: 'conflict' // or 'tension', 'crisis'
  }
];
```

## Caching

The system uses a two-tier caching strategy:

1. **Memory Cache**: Session-based, fastest access
2. **localStorage Cache**: Persists across sessions with TTL

Cache TTLs:
- News: 2 minutes
- Weather: 5 minutes
- Earthquakes: 1 minute
- Markets: 30 seconds

Cache keys are prefixed with `sitmon_` in localStorage.

To clear cache programmatically:
```javascript
import { clearCache } from './data/fetchers.js';
clearCache();
```

## Custom Monitors

Users can create custom monitors via the Monitors Panel:
1. Enter monitor name
2. Add comma-separated keywords
3. Optionally add lat/lon for map marker
4. Choose color

Monitors are saved to localStorage and persist across sessions.

## Backend Proxy (Optional)

If RSS feeds are blocked by CORS, create a Netlify function:

```javascript
// netlify/functions/rss-proxy.js
exports.handler = async (event) => {
  const url = event.queryStringParameters.url;
  const response = await fetch(url);
  const text = await response.text();
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Access-Control-Allow-Origin': '*'
    },
    body: text
  };
};
```

Then update fetchers to use the proxy:
```javascript
const url = `/.netlify/functions/rss-proxy?url=${encodeURIComponent(feedUrl)}`;
```

## Security

- All user input is sanitized with `escapeHtml()` to prevent XSS
- RSS HTML descriptions are stripped of tags
- External links use `rel="noopener noreferrer"`
- No API keys stored in client code

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly
- Mobile-responsive with touch-friendly controls

## Performance

- Debounced map tooltips (50ms)
- Lazy loading of map data
- Efficient DOM updates
- Cached API responses
- Responsive design with mobile optimizations

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6 modules required
- D3.js v7 required for map

## Deployment

1. Ensure all files are in place
2. Add navigation link (already done in `index.html`)
3. Deploy to Netlify (or your hosting)
4. If using backend proxy, deploy Netlify functions
5. Test all data sources

## Troubleshooting

**Map not loading:**
- Check browser console for D3 errors
- Verify CDN links for D3 and TopoJSON

**RSS feeds failing:**
- Check CORS errors in console
- Consider using backend proxy
- Verify feed URLs are correct

**Markets not updating:**
- CoinGecko has rate limits (10-50 calls/minute)
- Check if cache is working
- Verify network connectivity

**Earthquakes not showing:**
- USGS API may be down
- Check for GeoJSON parsing errors
- Verify magnitude filter (default M4.5+)

## License

Part of Noteworthy News codebase.
