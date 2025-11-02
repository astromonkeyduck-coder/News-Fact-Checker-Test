# Step-by-Step: Register workers.dev Subdomain

## Via Cloudflare Dashboard (Easiest)

### Step 1: Go to Dashboard
1. Open: https://dash.cloudflare.com/
2. Login to your account

### Step 2: Find Workers Section
1. In the **left sidebar**, click **"Workers & Pages"**
   - If you don't see it, look for **"Workers"** or **"Workers & Pages"** in the main menu
   - Direct link: https://dash.cloudflare.com/?to=/:account/workers

### Step 3: Register Subdomain
1. On the Workers & Pages page, look for **"Your subdomain"** section
2. Click **"Change"** or **"Configure"** next to it
3. Enter your desired subdomain name (e.g., `noteworthy` or `yourname`)
   - This creates: `yourname.workers.dev`
4. Click **Save** or **Confirm**

### Step 4: Deploy
After registering, come back here and run:
```bash
cd cloudflare-worker
npx wrangler deploy
```

Your Worker will be at: `https://x-feed-worker.yourname.workers.dev`

---

## Can't Find Workers Section?

If you can't find "Workers & Pages" in the dashboard:

1. **Check Account Permissions**
   - Make sure you're logged into the correct Cloudflare account
   - Try: https://dash.cloudflare.com/profile

2. **Try Direct Workers URL**
   - https://workers.cloudflare.com/
   - https://dash.cloudflare.com/?to=/:account/workers/overview

3. **Contact Support**
   - Some accounts might need Workers enabled first
   - Check: https://dash.cloudflare.com/?to=/:account/workers

---

## Alternative: Use Your Custom Domain

If `noteworthynews.co` is on Cloudflare, we can skip workers.dev entirely and use:
- `feed.noteworthynews.co`
- `x-feed.noteworthynews.co`

Let me know if you want to try this approach!


