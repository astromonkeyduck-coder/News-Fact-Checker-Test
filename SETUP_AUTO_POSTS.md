# Setup Automatic Post Fetching

There are several ways to ensure future posts show up automatically:

## Option 1: X/Twitter Webhook (Recommended - Most Reliable)

This is the best option for automatic posts. X/Twitter will send webhook events whenever you post a new tweet.

### Setup Steps:

1. **Get X Developer Account**:
   - Go to https://developer.twitter.com/
   - Apply for a developer account (free tier available)
   - Create an app to get API credentials

2. **Set Environment Variables in Netlify**:
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add:
     - `X_CONSUMER_SECRET` - Your X app consumer secret
     - `X_USER_ID` - Your X user ID (found in your developer account)
     - `NETLIFY_SITE_ID` - Already set
     - `NETLIFY_BLOB_READ_WRITE_TOKEN` - Already set

3. **Configure Webhook in X Developer Portal**:
   - Go to your X app settings
   - Add webhook URL: `https://noteworthynews.co/.netlify/functions/x-webhook`
   - X will send a CRC challenge (handled automatically)
   - Subscribe to `tweet_create_events`

4. **Test the Webhook**:
   - Post a new tweet on your account
   - It should automatically appear on your website within seconds!

## Option 2: Manual Addition via Bookmarklet (Easiest for Now)

While setting up webhooks, you can quickly add posts using a browser bookmarklet:

1. **Create the Bookmarklet**:
   - Create a new bookmark in your browser
   - Name it "Add to Noteworthy"
   - Set URL to this JavaScript (all on one line):
   ```javascript
   javascript:(function(){const tweetId=window.location.pathname.match(/\/status\/(\d+)/)?.[1];if(!tweetId){alert('Not a tweet page');return;}const url=`https://x.com/newsnoteworthy/status/${tweetId}`;fetch('https://noteworthynews.co/.netlify/functions/fetch-tweets-simple',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tweetUrl:url})}).then(r=>r.json()).then(d=>{console.log('Added:',d);alert(d.error||'Post added! Refresh to see it.');}).catch(e=>{console.error(e);alert('Error: '+e.message);});})();
   ```

2. **Use It**:
   - Visit any tweet on X/Twitter
   - Click the bookmarklet
   - The post will be added automatically

## Option 3: Browser Console Script (Quick Add)

For faster bulk additions, use the browser console:

1. Go to https://x.com/newsnoteworthy
2. Open Developer Tools (F12)
3. Run this in console:

```javascript
// Get all tweet IDs from current page
const tweetIds = Array.from(document.querySelectorAll('a[href*="/status/"]'))
  .map(a => a.href.match(/\/status\/(\d+)/)?.[1])
  .filter(Boolean)
  .filter((v, i, a) => a.indexOf(v) === i);

console.log(`Found ${tweetIds.length} tweets`);
console.log('Adding posts...');

// Add each post
let added = 0;
for (const id of tweetIds) {
  const url = `https://x.com/newsnoteworthy/status/${id}`;
  await fetch('https://noteworthynews.co/.netlify/functions/fetch-tweets-simple', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({tweetUrl: url})
  }).then(r => r.json()).then(d => {
    if (d.error) console.error(`Error for ${id}:`, d.error);
    else { added++; console.log(`✓ Added ${id}`); }
  });
  await new Promise(r => setTimeout(r, 2000)); // 2 second delay
}

console.log(`\n✅ Added ${added}/${tweetIds.length} posts!`);
console.log('Refresh the page to see them.');
```

## Option 4: Scheduled Function (Limited by Rate Limits)

A scheduled function exists (`auto-sync-posts.ts`) but is limited because:
- X blocks automated profile scraping
- Rate limits prevent frequent checks
- Requires more complex setup

The webhook (Option 1) is much more reliable.

## Recommendation

**For best results:**
1. Set up the X webhook (Option 1) - this is automatic and instant
2. Use the bookmarklet (Option 2) as a backup for quick manual additions
3. The webhook will automatically add all new posts as soon as you tweet them

## Current Status

- ✅ Webhook function exists and is ready: `netlify/functions/x-webhook.ts`
- ✅ Manual addition works via `fetch-tweets-simple`
- ⚠️ Automated scraping is blocked by X (this is why webhooks are needed)

## Need Help?

If you need help setting up the X developer account or webhook, I can guide you through it step by step!

