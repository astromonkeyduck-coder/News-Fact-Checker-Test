# Batch Add Posts (For 2,100+ Posts)

Since you have 2,100 posts, here's how to add them all efficiently:

## Method 1: Using the Batch Script (Recommended)

### Step 1: Create a file with all your tweet URLs

Create a text file `tweet-urls.txt` with one URL per line:

```
https://x.com/newsnoteworthy/status/1234567890
https://x.com/newsnoteworthy/status/0987654321
https://x.com/newsnoteworthy/status/1111111111
...
```

**Quick way to get URLs:**
1. Go to https://x.com/newsnoteworthy
2. Open browser console (F12)
3. Run this to extract all visible tweet URLs:
```javascript
Array.from(document.querySelectorAll('a[href*="/status/"]')).map(a => a.href).filter((v, i, a) => a.indexOf(v) === i).join('\n')
```
4. Copy and paste into `tweet-urls.txt`

### Step 2: Set your Netlify site URL

```bash
export NETLIFY_FUNCTION_URL=https://your-site.netlify.app/.netlify/functions/fetch-profile-tweets
```

Replace `your-site.netlify.app` with your actual Netlify domain.

### Step 3: Run the batch script

```bash
node scripts/batch-add-posts.js tweet-urls.txt
```

The script will:
- ✅ Process posts one at a time with 2-second delays
- ✅ Automatically retry if rate-limited (429 errors)
- ✅ Save progress after each post (can resume if interrupted)
- ✅ Skip already-processed posts
- ✅ Show progress every 10 posts

**Estimated time for 2,100 posts:** ~70 minutes (with 2-second delays)

### Resume if interrupted

If the script stops, just run it again with the same file. It will skip already-completed posts and continue from where it left off.

---

## Method 2: Browser Console (For smaller batches)

If you want to test with a smaller batch first, use the browser console:

```javascript
// Array of tweet URLs
const urls = [
  'https://x.com/newsnoteworthy/status/1234567890',
  'https://x.com/newsnoteworthy/status/0987654321',
  // ... add more URLs
];

// Process with delays
(async function() {
  for (let i = 0; i < urls.length; i++) {
    console.log(`[${i + 1}/${urls.length}] Processing...`);
    
    try {
      const res = await fetch('/.netlify/functions/fetch-profile-tweets', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({tweetUrl: urls[i]})
      });
      
      const data = await res.json();
      console.log(`✓ Success: ${urls[i]}`);
    } catch (err) {
      console.error(`✗ Error: ${urls[i]}`, err);
    }
    
    // Wait 2 seconds before next (except last one)
    if (i < urls.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log('Done! Refresh page to see posts.');
  location.reload();
})();
```

---

## Method 3: Use X API (If Available)

If you have access to the X/Twitter API, you can fetch all posts at once and store them. Contact me if you want help setting this up.

---

## Tips

- **Start small:** Test with 10-20 URLs first to make sure it works
- **Be patient:** With rate limiting, expect ~1-2 minutes per 100 posts
- **Resume capability:** The script saves progress, so you can stop and resume anytime
- **Check Netlify logs:** If posts aren't appearing, check the function logs for errors

---

## Troubleshooting

**429 Errors:**
- The script automatically waits and retries
- If you still get 429s, increase `DELAY_BETWEEN_REQUESTS` in the script

**Script won't run:**
- Make sure Node.js is installed: `node --version`
- Make sure the script is executable: `chmod +x scripts/batch-add-posts.js`

**Progress lost:**
- Progress is saved to `.batch-progress.json`
- You can manually edit this file if needed

