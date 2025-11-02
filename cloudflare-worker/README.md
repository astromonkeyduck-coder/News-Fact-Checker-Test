# X Feed Worker - Cloudflare Workers + KV

A $0 dynamic feed system for X/Twitter posts using Cloudflare Workers, KV storage, and oEmbed API.

## Features

- ✅ No API keys needed (uses public oEmbed API)
- ✅ Free tier (100K requests/day on Cloudflare Workers)
- ✅ Fast global edge deployment
- ✅ Auto-refresh feed on your site
- ✅ One-tap adding via bookmarklet or iOS Shortcut
- ✅ Rate limiting built-in
- ✅ Admin endpoints for moderation

## Quick Start

### 1. Create Cloudflare KV Namespace

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create "FEED"

# Create preview namespace (for dev)
wrangler kv:namespace create "FEED" --preview
```

Copy the IDs from the output.

### 2. Configure Worker

Edit `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FEED"
id = "your-production-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

[vars]
ALLOWED_ORIGIN = "https://your-site.netlify.app"
RATE_LIMIT_PER_MINUTE = "10"
ADMIN_TOKEN = "generate-a-strong-random-token-here"
```

### 3. Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### 4. Deploy

```bash
# Test locally
npm run dev

# Deploy to production
npm run deploy
```

### 5. Set Custom Domain (Optional)

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your worker
3. Go to Settings > Triggers
4. Add a Custom Domain (e.g., `x-feed.yourdomain.com`)

Update your DNS to point the subdomain to Cloudflare.

## API Endpoints

### POST /add
Add a tweet URL to the feed.

**Request:**
```json
{
  "url": "https://x.com/username/status/123456"
}
```

**Response:**
```json
{
  "success": true,
  "post": { ... },
  "message": "Post added successfully"
}
```

### GET /feed?limit=50
Get the latest posts.

**Response:**
```json
[
  {
    "id": "123456",
    "url": "https://x.com/...",
    "author": "Username",
    "text": "Tweet text...",
    "image": "https://...",
    "category": "Update",
    "created_at": 1700000000000
  }
]
```

### DELETE /post/:id
Delete a post (requires `Authorization: Bearer <ADMIN_TOKEN>` header).

### PATCH /post/:id
Update post category (requires `Authorization: Bearer <ADMIN_TOKEN>` header).

**Request:**
```json
{
  "category": "Breaking"  // or "Developing" or "Update"
}
```

## Netlify Integration

### 1. Add to your HTML

```html
<script type="module">
  // Set your Worker URL
  window.WORKER_BASE_URL = 'https://x-feed.yourdomain.com';
  
  // Load the feed component
  import { renderCloudflareFeed } from '/src/components/cloudflare-post-feed.js';
  
  // Initialize when page loads
  document.addEventListener('DOMContentLoaded', () => {
    renderCloudflareFeed('articlesTrack', {
      limit: 50,
      autoRefresh: true,
      refreshInterval: 60000, // 60 seconds
    });
  });
</script>
```

### 2. Or use the vanilla JS version

```html
<script src="/src/components/cloudflare-post-feed.js" type="module"></script>
<script>
  window.WORKER_BASE_URL = 'https://x-feed.yourdomain.com';
  
  document.addEventListener('DOMContentLoaded', () => {
    window.renderCloudflareFeed('articlesTrack', {
      limit: 50,
      autoRefresh: true,
    });
  });
</script>
```

## Bookmarklet

1. Copy the code from `bookmarklet.js`
2. Create a new bookmark in your browser
3. Edit the bookmark
4. Set the URL to the bookmarklet code (paste the entire `javascript:` code)
5. When on a tweet page, click the bookmarklet to add it to your feed

## iOS Shortcut

See `ios-shortcut.txt` for detailed setup instructions.

## Local Development

```bash
cd cloudflare-worker
npm run dev
```

This starts a local server with Miniflare (Wrangler's local runtime).

## Deployment

```bash
npm run deploy
```

The worker will be deployed to Cloudflare's edge network globally.

## Environment Variables

Set these in `wrangler.toml` or via Cloudflare Dashboard:

- `ALLOWED_ORIGIN` - Your Netlify site URL for CORS
- `RATE_LIMIT_PER_MINUTE` - Rate limit for /add endpoint (default: 10)
- `ADMIN_TOKEN` - Secret token for DELETE/PATCH endpoints

## Cost

- **Cloudflare Workers**: Free tier = 100K requests/day
- **KV Storage**: Free tier = 100K reads/day, 1K writes/day
- **Total**: $0 for most small to medium sites

## Troubleshooting

### CORS Errors
- Check `ALLOWED_ORIGIN` matches your site URL
- Verify Worker URL is correct

### Rate Limit Errors
- Increase `RATE_LIMIT_PER_MINUTE` if needed
- Rate limit resets every minute

### KV Not Working
- Verify KV namespace IDs in `wrangler.toml`
- Check KV namespace exists in Cloudflare Dashboard

### Posts Not Appearing
- Check browser console for errors
- Verify Worker URL is correct
- Test `/feed` endpoint directly in browser

## Files Structure

```
cloudflare-worker/
├── src/
│   ├── index.ts      # Main worker entry point
│   ├── types.ts      # TypeScript type definitions
│   └── utils.ts      # Utility functions
├── wrangler.toml     # Worker configuration
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript config
├── bookmarklet.js    # Browser bookmarklet code
├── ios-shortcut.txt  # iOS Shortcut instructions
└── README.md         # This file
```


