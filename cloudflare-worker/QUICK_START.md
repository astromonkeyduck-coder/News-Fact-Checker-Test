# Quick Start - Install Cloudflare Worker

## Automated Setup (Recommended)

Run the setup script:

```bash
cd cloudflare-worker
./setup.sh
```

This will:
1. Check/login to Cloudflare
2. Create KV namespaces
3. Update `wrangler.toml` with IDs
4. Guide you through next steps

## Manual Setup

### Step 1: Login to Cloudflare

```bash
cd cloudflare-worker
npx wrangler login
```

This opens your browser - authorize the app.

### Step 2: Create KV Namespaces

```bash
# Production namespace
npx wrangler kv:namespace create "FEED"

# Preview namespace (for local dev)
npx wrangler kv:namespace create "FEED" --preview
```

**Copy the IDs** from the output.

### Step 3: Update wrangler.toml

Edit `wrangler.toml` and replace:
- `id = "your-kv-namespace-id"` with your production ID
- `preview_id = "your-preview-kv-namespace-id"` with your preview ID

### Step 4: Test Locally

```bash
npm run dev
```

Then test:
```bash
curl http://localhost:8787/feed
```

### Step 5: Deploy

```bash
npm run deploy
```

Copy the Worker URL from the output (e.g., `https://x-feed-worker.your-subdomain.workers.dev`)

### Step 6: Update Your Site

In your `index.html`, add:

```html
<script>
  window.WORKER_BASE_URL = 'https://your-worker-url.workers.dev'; // Paste your URL here
</script>
<script src="/src/components/cloudflare-post-feed-standalone.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    window.renderCloudflareFeed('articlesTrack', {
      limit: 50,
      autoRefresh: true
    });
  });
</script>
```

## Done! 🎉

Your feed is now live. Add tweets using the bookmarklet or by POSTing to `/add`.


