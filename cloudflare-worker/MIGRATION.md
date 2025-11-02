# Migrate Posts from Netlify to Cloudflare

Your existing posts are stored in Netlify Blobs and won't automatically show up in the new Cloudflare Worker feed. This migration script will transfer them.

## Quick Migration

### Option 1: Run the Script (Easiest)

```bash
cd cloudflare-worker
node migrate-posts.js
```

This will:
1. Fetch all posts from your Netlify endpoint
2. Transform them to Cloudflare format
3. Add them to Cloudflare KV via the `/add` endpoint
4. Show a summary of results

### Option 2: Manual Migration via API

If you prefer to migrate posts one by one:

```bash
# Get your posts from Netlify
curl "https://noteworthynews.co/.netlify/functions/posts-read?limit=200"

# For each post URL, add it to Cloudflare:
curl -X POST https://x-feed-worker.pangpangpangismysubdomainbrutha.workers.dev/add \
  -H "Content-Type: application/json" \
  -d '{"url":"https://x.com/newsnoteworthy/status/123456"}'
```

### Option 3: Re-add via Bookmarklet

1. Visit your old posts on X/Twitter
2. Use the bookmarklet to re-add them to Cloudflare

## What Gets Migrated

- ✅ Post URLs (tweet URLs)
- ✅ Post text/content
- ✅ Author information
- ✅ Images (via oEmbed)
- ✅ Timestamps
- ✅ Categories (mapped: Breaking/Developing/Update)

## Notes

- The migration uses the `/add` endpoint which fetches fresh oEmbed data
- Rate limit: 10 requests/minute (migration includes delays)
- If a post URL is invalid, it will be skipped
- Original timestamps are preserved when possible

## Troubleshooting

**"No posts to migrate"**
- Check that your Netlify endpoint is accessible
- Verify posts exist: `curl https://noteworthynews.co/.netlify/functions/posts-read`

**Rate limit errors**
- Wait 1 minute between batches
- The script includes 100ms delays between requests

**Invalid URLs**
- Some old posts might have malformed URLs
- They'll be skipped with a warning

## After Migration

1. Check your feed: https://x-feed-worker.pangpangpangismysubdomainbrutha.workers.dev/feed
2. Refresh your site to see the migrated posts
3. Old Netlify posts will continue to work as a fallback

---

**Tip:** You can keep both systems running during migration. The new Cloudflare feed takes priority, with Netlify as fallback.


