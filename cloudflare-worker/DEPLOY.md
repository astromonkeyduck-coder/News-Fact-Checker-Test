# Deployment Checklist

## Pre-Deployment

- [ ] Created KV namespace: `wrangler kv:namespace create "FEED"`
- [ ] Created preview KV namespace: `wrangler kv:namespace create "FEED" --preview`
- [ ] Updated `wrangler.toml` with KV namespace IDs
- [ ] Set `ALLOWED_ORIGIN` to your Netlify site URL
- [ ] Generated `ADMIN_TOKEN` (strong random string)
- [ ] Installed dependencies: `npm install`

## Local Testing

- [ ] Tested locally: `npm run dev`
- [ ] Tested GET `/feed` endpoint
- [ ] Tested POST `/add` endpoint with valid tweet URL
- [ ] Tested POST `/add` with invalid URL (should error)
- [ ] Tested rate limiting (make 11 requests quickly)
- [ ] Tested CORS headers

## Deployment

- [ ] Deployed to Cloudflare: `npm run deploy`
- [ ] Copied Worker URL from deployment output
- [ ] Tested Worker URL directly in browser: `https://your-worker.workers.dev/feed`

## Custom Domain (Optional)

- [ ] Added custom domain in Cloudflare Dashboard
- [ ] Updated DNS records if needed
- [ ] Tested custom domain: `https://x-feed.yourdomain.com/feed`

## Site Integration

- [ ] Updated `window.WORKER_BASE_URL` in your site code
- [ ] Added feed component script tag
- [ ] Added initialization code
- [ ] Tested feed loads on your site
- [ ] Tested auto-refresh works

## Tools Setup

- [ ] Created bookmarklet with correct Worker URL
- [ ] Tested bookmarklet on a tweet page
- [ ] Created iOS Shortcut (if using iOS)
- [ ] Tested iOS Shortcut

## Verification

- [ ] Feed displays posts on your site
- [ ] Posts appear in correct card format
- [ ] Images load (or fallback shows)
- [ ] Dates show as "X min ago"
- [ ] Clicking posts opens tweet in new tab
- [ ] Auto-refresh updates feed every 60 seconds
- [ ] No console errors

## Production Checklist

- [ ] `ADMIN_TOKEN` is strong and secure
- [ ] CORS only allows your domain
- [ ] Rate limiting is appropriate for your use
- [ ] Worker URL is correct everywhere
- [ ] Error handling works gracefully
- [ ] Mobile responsive
- [ ] Dark mode compatible

## Troubleshooting

If something doesn't work:
1. Check Cloudflare Dashboard for Worker errors
2. Check browser console for JavaScript errors
3. Test Worker endpoints directly with curl
4. Verify KV namespace IDs are correct
5. Check CORS configuration matches your domain
6. Review `wrangler tail` for runtime logs


