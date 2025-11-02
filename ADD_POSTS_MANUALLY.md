# How to Add X/Twitter Posts Manually

Since X/Twitter often blocks automated scraping, you can manually add posts using the function API.

## Method 1: Using Browser Console (Easiest)

**⚠️ Important:** If you see a `429` error, it means X/Twitter is rate-limiting requests. Wait 5-10 minutes between adding posts, or add them one at a time.

1. Open your website in a browser
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Copy and paste ONE of these options (replace `YOUR_TWEET_ID` with actual tweet ID):

```javascript
// Single line version (easier to copy):
fetch('/.netlify/functions/fetch-profile-tweets', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({tweetUrl: 'https://x.com/newsnoteworthy/status/YOUR_TWEET_ID'})}).then(r=>r.json()).then(d=>{console.log('Post added:',d);location.reload();}).catch(e=>console.error('Error:',e));

// Or multi-line version (easier to read):
(function() {
  const tweetUrl = 'https://x.com/newsnoteworthy/status/YOUR_TWEET_ID';
  fetch('/.netlify/functions/fetch-profile-tweets', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({tweetUrl: tweetUrl})
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    console.log('Post added:', data);
    location.reload();
  })
  .catch(function(err) {
    console.error('Error:', err);
  });
})();
```

Replace `YOUR_TWEET_ID` with the actual tweet ID from the URL.

## Method 2: Using curl (Terminal)

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/fetch-profile-tweets \
  -H "Content-Type: application/json" \
  -d '{"tweetUrl": "https://x.com/newsnoteworthy/status/YOUR_TWEET_ID"}'
```

## Method 3: Using the X Webhook (Automatic)

If you set up the X webhook (`x-webhook.ts`), new tweets will automatically be added when you post them.

## Finding Tweet URLs

1. Go to https://x.com/newsnoteworthy
2. Click on a tweet
3. Copy the URL from the address bar
4. It should look like: `https://x.com/newsnoteworthy/status/1234567890123456789`

## Verify Posts Were Added

After adding posts, refresh your website. The posts should appear in the article cards.

To check if posts are in storage, you can also check the Netlify function logs:
- Go to Netlify Dashboard → Your Site → Functions → `posts-read` → Logs
- Look for `[posts-read] Returning X posts`

