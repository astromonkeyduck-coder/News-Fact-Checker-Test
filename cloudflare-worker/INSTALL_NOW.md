# 🚀 Install Cloudflare Worker - Run These Commands

## Step 1: Login to Cloudflare (Interactive - Opens Browser)

```bash
cd cloudflare-worker
npx wrangler login
```

This will open your browser to authorize. After login, continue below.

## Step 2: Create KV Namespaces

Run these two commands:

```bash
# Production namespace
npx wrangler kv:namespace create "FEED"

# Preview namespace  
npx wrangler kv:namespace create "FEED" --preview
```

**IMPORTANT:** Copy the IDs from the output. They look like:
```
{ binding = "FEED", id = "abc123def456..." }
{ binding = "FEED", preview_id = "xyz789uvw012..." }
```

## Step 3: Update wrangler.toml

I've already configured:
- ✅ `ALLOWED_ORIGIN = "https://noteworthynews.co"`
- ✅ `ADMIN_TOKEN` (generated secure token)

You just need to add the KV namespace IDs. Edit `wrangler.toml` and replace:
- Line 13: `id = "your-kv-namespace-id"` → `id = "paste-production-id-here"`
- Line 14: `preview_id = "your-preview-kv-namespace-id"` → `preview_id = "paste-preview-id-here"`

## Step 4: Deploy

```bash
npm run deploy
```

This will output your Worker URL (e.g., `https://x-feed-worker.your-subdomain.workers.dev`)

**Copy this URL** - you'll need it for the next step.

## Step 5: Update Your Site

I'll add the integration code to your `index.html` once you have the Worker URL.

## Alternative: If You Have Cloudflare API Token

Instead of `wrangler login`, you can set an environment variable:

```bash
export CLOUDFLARE_API_TOKEN="your-api-token-here"
npx wrangler kv:namespace create "FEED"
npx wrangler kv:namespace create "FEED" --preview
```

Get API token: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/

---

**Status:**
- ✅ Dependencies installed
- ✅ Configuration updated (site URL, admin token)
- ⏳ Waiting for: KV namespace creation (interactive step)
- ⏳ Waiting for: Worker deployment
- ⏳ Waiting for: Site integration


