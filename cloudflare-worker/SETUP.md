# Setup Guide - Cloudflare Feed Worker

## Step-by-Step Setup Instructions

### Step 1: Install Prerequisites

```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Or use npx (no install needed)
npx wrangler --version
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens your browser to authenticate with Cloudflare.

### Step 3: Create KV Namespace

```bash
cd cloudflare-worker

# Create production namespace
wrangler kv:namespace create "FEED"

# Output will show:
# { binding = "FEED", id = "your-production-id-here" }
```

```bash
# Create preview namespace (for local dev)
wrangler kv:namespace create "FEED" --preview

# Output will show:
# { binding = "FEED", preview_id = "your-preview-id-here" }
```

**Copy both IDs** - you'll need them in the next step.

### Step 4: Configure Worker

Edit `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FEED"
id = "paste-your-production-id-here"
preview_id = "paste-your-preview-id-here"

[vars]
ALLOWED_ORIGIN = "https://your-site.netlify.app"  # Your actual Netlify URL
RATE_LIMIT_PER_MINUTE = "10"
ADMIN_TOKEN = "generate-strong-random-token"  # Use: openssl rand -hex 32
```

**Generate Admin Token:**
```bash
openssl rand -hex 32
# Or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### Step 6: Test Locally

```bash
npm run dev
```

Worker will run on `http://localhost:8787`

Test the endpoints:
- `http://localhost:8787/feed?limit=5`
- `POST http://localhost:8787/add` with `{ "url": "https://x.com/..." }`

### Step 7: Deploy

```bash
npm run deploy
```

Output will show:
```
✨  Successfully published your Worker to the following routes:
   https://x-feed-worker.your-subdomain.workers.dev
```

### Step 8: Set Custom Domain (Optional but Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Go to **Workers & Pages** > Your Worker
4. Click **Settings** > **Triggers**
5. Click **Add Custom Domain**
6. Enter: `x-feed.yourdomain.com` (or your preferred subdomain)
7. Update DNS automatically or manually add CNAME

### Step 9: Update Your Site

In your `index.html` or site code:

```html
<script>
  // Set Worker URL
  window.WORKER_BASE_URL = 'https://x-feed.yourdomain.com';
</script>
<script type="module" src="/src/components/cloudflare-post-feed.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    window.renderCloudflareFeed('articlesTrack', {
      limit: 50,
      autoRefresh: true,
      refreshInterval: 60000,
    });
  });
</script>
```

### Step 10: Test Adding a Tweet

**Option 1: Browser Bookmarklet**
1. Copy code from `bookmarklet.js`
2. Create bookmark with the code as URL
3. Visit a tweet on X/Twitter
4. Click bookmarklet

**Option 2: Direct API Call**
```bash
curl -X POST https://x-feed.yourdomain.com/add \
  -H "Content-Type: application/json" \
  -d '{"url":"https://x.com/username/status/123456"}'
```

**Option 3: Browser Console**
```javascript
fetch('https://x-feed.yourdomain.com/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: window.location.href })
}).then(r => r.json()).then(console.log);
```

### Step 11: Verify Feed

Visit in browser:
```
https://x-feed.yourdomain.com/feed?limit=10
```

Should return JSON array of posts.

## Troubleshooting

### "KV namespace not found"
- Double-check IDs in `wrangler.toml`
- Run `wrangler kv:namespace list` to see your namespaces

### "CORS error"
- Check `ALLOWED_ORIGIN` matches your site URL exactly
- Include `https://` and no trailing slash

### "Rate limit exceeded"
- Increase `RATE_LIMIT_PER_MINUTE` in `wrangler.toml`
- Wait 1 minute for limit to reset

### Worker not responding
- Check Cloudflare Dashboard > Workers & Pages for errors
- View logs: `wrangler tail`

### Posts not showing
- Verify posts exist: `curl https://x-feed.yourdomain.com/feed`
- Check browser console for fetch errors
- Verify `WORKER_BASE_URL` is set correctly

## Cost Breakdown

- **Workers**: 100K requests/day free
- **KV**: 100K reads/day, 1K writes/day free
- **Total**: $0 for typical usage

You only pay if you exceed free tier:
- Workers: $5/month per million requests
- KV: $0.50 per million reads, $5 per million writes

## Security Notes

1. **Admin Token**: Keep `ADMIN_TOKEN` secret - never commit to git
2. **CORS**: Only allow your specific domain
3. **Rate Limiting**: Prevents spam/abuse
4. **Input Validation**: URLs are validated before processing

## Next Steps

- Set up iOS Shortcut (see `ios-shortcut.txt`)
- Create bookmarklet (see `bookmarklet.js`)
- Integrate with your site (see Netlify integration code)
- Customize categories and styling

