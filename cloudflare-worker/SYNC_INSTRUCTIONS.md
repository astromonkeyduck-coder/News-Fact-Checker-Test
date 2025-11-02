# How to Get Your @newsnoteworthy Posts

## Automatic Sync (Limited)

X/Twitter blocks automated profile scraping, so the `/sync` endpoint may not always work. However, I've set up:

1. **Cron Job**: Automatically tries to sync every hour
2. **Manual Sync**: You can trigger it anytime

## Manual Sync Options

### Option 1: Via Browser
Visit this URL:
```
https://x-feed-worker.pangpangpangismysubdomainbrutha.workers.dev/sync?username=newsnoteworthy&limit=20
```

### Option 2: Via Bookmarklet (Easiest)
1. Go to your X profile: https://x.com/newsnoteworthy
2. Click on each tweet you want to add
3. Use the bookmarklet to add it (one-click)

### Option 3: Keep Using Netlify Feed
Your existing Netlify feed should still work and show your posts. The new Cloudflare system will show posts you manually add.

## Best Approach

Since X blocks scraping, the most reliable method is:

1. **For existing posts**: Keep using the Netlify feed (already configured)
2. **For new posts**: Use the bookmarklet when you post new tweets
3. **Or**: Add them manually via the `/add` endpoint

## Quick Start

To see your posts right now:

1. Visit your X profile
2. Open each tweet you want
3. Click the bookmarklet
4. Refresh your site

The feed will update automatically!


