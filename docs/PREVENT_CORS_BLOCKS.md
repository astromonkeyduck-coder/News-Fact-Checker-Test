# How to Prevent CORS Blocks in Situation Monitor

## The Problem

Browsers block cross-origin requests (CORS) when fetching RSS feeds, APIs, etc. directly from JavaScript. This causes errors like:
```
Access to fetch at 'https://feeds.bbci.co.uk/news/world/rss.xml' from origin 'https://noteworthynews.co' 
has been blocked by CORS policy
```

## The Solution: Netlify Functions

All external API calls must go through **Netlify Functions** (server-side proxies) that run on Netlify's servers, not in the browser.

## Current Setup

✅ **Already Using Functions:**
- RSS Feeds: `/.netlify/functions/rssProxy`
- Markets (CoinGecko): `/.netlify/functions/marketsProxy`
- Geocoding (Nominatim): `/.netlify/functions/geocodeProxy`
- RSS Aggregate: `/.netlify/functions/rss-aggregate`

## Deployment Checklist

### 1. Verify Functions Are Deployed

Check that these files exist in your Netlify deployment:
- `netlify/functions/rssProxy.js`
- `netlify/functions/marketsProxy.js`
- `netlify/functions/geocodeProxy.js`
- `netlify/functions/rss-aggregate.js`

### 2. Test Functions Manually

Test each function in your browser or with curl:

```bash
# Test RSS Proxy
curl "https://noteworthynews.co/.netlify/functions/rssProxy?source=bbc-world"

# Test Markets Proxy
curl "https://noteworthynews.co/.netlify/functions/marketsProxy?source=crypto_simple_price"

# Test Geocode Proxy
curl "https://noteworthynews.co/.netlify/functions/geocodeProxy?q=New%20York"
```

### 3. Check Browser Console

After deployment, check the browser console:
- ✅ **Good**: Requests to `/.netlify/functions/*` succeed
- ❌ **Bad**: Direct requests to `feeds.bbci.co.uk`, `api.coingecko.com`, etc. (CORS errors)

### 4. Verify Function Logs

In Netlify Dashboard → Functions → View Logs:
- Check for errors in function execution
- Verify functions are being called
- Check for rate limiting or timeout errors

## If Functions Are Not Working

### Common Issues:

1. **Functions Not Deployed**
   - Ensure `netlify.toml` has `functions = "netlify/functions"`
   - Redeploy your site
   - Check Netlify Dashboard → Functions tab

2. **Function Errors**
   - Check Netlify Function logs
   - Verify dependencies are installed (`rss-parser` for RSS functions)
   - Check function syntax/imports

3. **Still Getting CORS Errors**
   - Clear browser cache
   - Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
   - Check Network tab to see if requests are going to functions or direct URLs

## Local Development

For local testing, use `netlify dev`:

```bash
netlify dev
```

This will:
- Start local server on port 8888
- Proxy function requests to `/.netlify/functions/*`
- Allow testing without deploying

## Rate Limiting

Functions include rate limiting to prevent abuse:
- **Geocode Proxy**: 1 request per second
- **RSS Proxy**: 10-minute cache per feed
- **Markets Proxy**: 60-second cache

If you hit rate limits:
- Wait and retry
- Check function logs for 429 errors
- Consider increasing cache TTL

## Monitoring

Monitor function health:
1. Netlify Dashboard → Functions → View metrics
2. Check error rates
3. Monitor execution time
4. Watch for timeout errors (8s timeout on most functions)

## Summary

✅ **All external API calls go through Netlify Functions**
✅ **Functions are deployed and accessible**
✅ **No direct browser fetches to external APIs**
✅ **Functions handle CORS, rate limiting, and caching**

If you're still seeing CORS errors, the functions likely aren't deployed or there's a code path still doing direct fetches.
