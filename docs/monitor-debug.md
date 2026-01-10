# Situation Monitor - Debugging Guide

## Overview

The Situation Monitor uses server-side Netlify Functions to proxy external API calls, avoiding CORS issues and implementing rate limiting and caching.

## Architecture

### Netlify Functions (Server-Side Proxies)

All external API calls are routed through Netlify Functions:

1. **`/.netlify/functions/rssProxy`** - RSS feed fetcher
   - Query: `?source=<feedId>`
   - Returns: Normalized RSS items with title, URL, snippet, published date
   - Caching: 10 minutes
   - SSRF Protection: Only allows feeds from registry

2. **`/.netlify/functions/marketsProxy`** - Market data fetcher
   - Query: `?source=crypto_simple_price`
   - Returns: Bitcoin, Ethereum, Solana prices with 24h change
   - Caching: 60 seconds
   - Rate Limit Handling: Serves cached data on 429

3. **`/.netlify/functions/geocodeProxy`** - Geocoding service
   - Query: `?q=<encoded-query>`
   - Returns: lat, lon, displayName, precision
   - Caching: 24 hours
   - Rate Limiting: 1 request per second (token bucket)
   - Query Validation: Filters out garbage strings

### Client-Side Components

- **`fetchers.js`**: Updated to use Netlify Functions instead of direct fetch
- **`geocoding.js`**: Updated to use geocodeProxy with query validation
- **`NewsPanel.js`**: Uses RSS_FEEDS registry with feed IDs
- **Single-Flight Pattern**: Prevents duplicate simultaneous requests

## Adding a New RSS Feed

1. **Add to Registry** (`src/rss/feeds.js`):
   ```javascript
   {
     id: 'my-feed-id',
     name: 'My Feed Name',
     homepage: 'https://example.com',
     feedUrl: 'https://example.com/feed.xml',
     regions: ['Global'],
     topics: ['News'],
     refreshMinutes: 10,
     enabledByDefault: true,
     snippetPolicy: {
       allowDescription: true,
       maxChars: 200
     },
     licenseNotes: 'headline+link only; attribution required'
   }
   ```

2. **The feed will automatically be available** via `rssProxy?source=my-feed-id`

3. **No code changes needed** - the registry is the source of truth

## Testing Locally

### Using Netlify Dev

```bash
netlify dev
```

This will:
- Start local server on port 8888
- Run Netlify Functions locally
- Proxy requests to `/.netlify/functions/*`

### Testing RSS Proxy

```bash
curl "http://localhost:8888/.netlify/functions/rssProxy?source=bbc-world"
```

### Testing Markets Proxy

```bash
curl "http://localhost:8888/.netlify/functions/marketsProxy?source=crypto_simple_price"
```

### Testing Geocode Proxy

```bash
curl "http://localhost:8888/.netlify/functions/geocodeProxy?q=New%20York"
```

## Troubleshooting

### CORS Errors

**Symptom**: `Access to fetch at '...' has been blocked by CORS policy`

**Solution**: All external fetches should go through Netlify Functions. Check:
- `fetchers.js` uses `/.netlify/functions/rssProxy` not direct URLs
- `geocoding.js` uses `/.netlify/functions/geocodeProxy` not Nominatim directly
- `fetchMarkets()` uses `/.netlify/functions/marketsProxy` not CoinGecko directly

### Rate Limiting (429 Errors)

**Symptom**: `HTTP 429: Too Many Requests`

**Solution**: 
- Functions implement caching and backoff
- Geocode proxy limits to 1 req/sec
- Markets proxy serves cached data on 429
- Client-side fetchers use single-flight pattern

### BasePanel "Content element not found"

**Symptom**: `[BasePanel] Content element not found in container #sitmon-panel-*-body`

**Solution**: 
- BasePanel now uses container directly (no nested `.sitmon-panel-content`)
- Ensure shell creates `#sitmon-panel-*-body` elements in HTML
- Check `SituationMonitorShell.js` DOM structure

### D3 "transition not found"

**Symptom**: `Uncaught Error: transition not found`

**Solution**:
- Earthquake markers now track timeouts and validate selections
- `clearEarthquakeTimeouts()` called before refresh
- Selection validity checked before transition

### Auth0 Double Initialization

**Symptom**: `[Auth0] Starting initialization...` appears twice

**Solution**:
- Guard flags (`auth0Initializing`, `auth0Initialized`) prevent double init
- Check for multiple script includes or event listeners

### Geocoding Garbage Queries

**Symptom**: Queries like "terms that directly relate to" being geocoded

**Solution**:
- `validateGeocodeQuery()` filters invalid queries
- Banned phrases list blocks common garbage patterns
- Length, word count, and capitalization checks

### Refresh Spam

**Symptom**: Multiple simultaneous refresh calls

**Solution**:
- `_refreshing` flag prevents concurrent refreshes
- Single-flight pattern in fetchers prevents duplicate requests
- Geocode queue limited to 1 request at a time

## Performance Optimizations

1. **Caching**: 
   - RSS: 10 minutes
   - Markets: 60 seconds
   - Geocoding: 24 hours

2. **Single-Flight**: Duplicate requests share the same promise

3. **Rate Limiting**: 
   - Geocoding: 1 req/sec
   - Markets: Respects Retry-After header

4. **Query Validation**: Prevents unnecessary geocoding calls

## Monitoring

Check browser console for:
- `[Fetcher]` - Fetch operations
- `[Geocoding]` - Geocoding operations
- `[SituationMonitorShell]` - Shell lifecycle
- `[Auth0]` - Authentication state

## Production Deployment

1. Ensure Netlify Functions are deployed
2. Verify environment variables (if any)
3. Test all three proxy endpoints
4. Monitor function logs in Netlify dashboard
5. Check rate limits are respected
