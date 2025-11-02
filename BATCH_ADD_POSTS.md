# Batch Add 2,100 Posts to Noteworthy News

This guide will help you efficiently add all 2,100 of your X/Twitter posts to your Noteworthy News site.

## ⏱️ Time Estimate

- **2,100 posts** × **2 seconds per post** = **~70 minutes** (~1.2 hours)
- The script includes automatic retries for rate limits, which may add extra time
- **You can stop and resume anytime** - progress is saved automatically

## 📋 Prerequisites

1. **Node.js installed** (check with `node --version`)
2. **All 2,100 tweet URLs** ready in a text file
3. **Your Netlify site URL** (find it below)

## Step 1: Find Your Netlify Site URL

1. Go to https://app.netlify.com/
2. Select your **Noteworthy News** site
3. In the site dashboard, you'll see your site URL at the top (e.g., `https://noteworthynews.netlify.app` or `https://noteworthynews.co`)
4. **Write down your full site URL** - you'll need it in Step 3

## Step 2: Create Your Tweet URLs File

You need a text file with all 2,100 tweet URLs, one per line.

### Option A: Extract from X/Twitter (Recommended)

1. Go to https://x.com/newsnoteworthy
2. Scroll to load as many tweets as possible (X shows ~20 at a time, so this is limited)
3. Open browser console (**F12** → Console tab)
4. Run this command:
   ```javascript
   Array.from(document.querySelectorAll('a[href*="/status/"]'))
     .map(a => a.href.split('?')[0])  // Remove query params
     .filter((v, i, a) => a.indexOf(v) === i)  // Remove duplicates
     .join('\n')
   ```
5. Copy all the URLs and paste into a file named `tweet-urls.txt`

**Note:** X only shows ~20 tweets per page, so you'll need to:
- Extract URLs from multiple pages
- Or use a browser extension to scroll and collect URLs
- Or manually create the file with all your tweet IDs

### Option B: Create from Tweet IDs

If you have a list of tweet IDs (just the numbers), create `tweet-urls.txt` like this:

```
https://x.com/newsnoteworthy/status/1234567890123456789
https://x.com/newsnoteworthy/status/0987654321098765432
https://x.com/newsnoteworthy/status/1111111111111111111
...
```

**One URL per line, exactly 2,100 lines.**

### Verify Your File

```bash
# Count lines (should be 2,100)
wc -l tweet-urls.txt

# Check first few lines
head -5 tweet-urls.txt
```

## Step 3: Configure and Run the Script

### Set Your Netlify URL

**In your terminal**, navigate to your project directory and run:

```bash
export NETLIFY_FUNCTION_URL=https://YOUR-SITE-URL/.netlify/functions/fetch-profile-tweets
```

**Replace `YOUR-SITE-URL`** with your actual Netlify domain (no trailing slash).

**Examples:**
```bash
export NETLIFY_FUNCTION_URL=https://noteworthynews.netlify.app/.netlify/functions/fetch-profile-tweets
# OR
export NETLIFY_FUNCTION_URL=https://noteworthynews.co/.netlify/functions/fetch-profile-tweets
```

**Tip:** Add this to your `~/.zshrc` or `~/.bashrc` to persist it across terminal sessions.

### Run the Batch Script

```bash
node scripts/batch-add-posts.js tweet-urls.txt
```

The script will:
- ✅ Start processing immediately
- ✅ Show progress every 10 posts
- ✅ Save progress after each post (you can stop anytime with `Ctrl+C`)
- ✅ Automatically retry if rate-limited (429 errors)
- ✅ Skip already-processed posts if you restart

### Expected Output

```
📄 Loaded 2100 URLs from file

📊 Processing 2100 posts (0 already completed)
⏱️  Estimated time: ~70 minutes

[1/2100] Adding: https://x.com/newsnoteworthy/status/1234567890
  ✓ Success
  ⏳ Waiting 2s before next post...
[2/2100] Adding: https://x.com/newsnoteworthy/status/0987654321
  ✓ Success
  ⏳ Waiting 2s before next post...
...

📈 Progress: 10/2100 (10 succeeded, 0 failed)

✅ Batch complete!
   ✓ Succeeded: 2100
   ✗ Failed: 0
```

## Step 4: Resume If Interrupted

If the script stops (network issue, you close terminal, etc.):

1. **Just run it again** with the same command:
   ```bash
   node scripts/batch-add-posts.js tweet-urls.txt
   ```

2. The script will automatically:
   - Detect which posts were already processed
   - Skip completed posts
   - Continue from where it left off

## Step 5: Verify Posts on Your Site

After the script completes (or periodically during processing):

1. Go to your live site
2. Refresh the page
3. Check the article cards - new posts should appear
4. You can also check Netlify logs:
   - Netlify Dashboard → Your Site → Functions → `posts-read` → Logs

## 🔧 Troubleshooting

### "Please set NETLIFY_FUNCTION_URL environment variable"

**Solution:** Make sure you ran `export NETLIFY_FUNCTION_URL=...` before running the script.

### 429 Rate Limit Errors

**What it means:** X/Twitter is limiting how many requests you can make.

**What happens:** The script automatically:
- Waits 60 seconds
- Retries the request
- Continues processing

**If it happens frequently:**
- The script is working correctly
- It will just take longer (adds ~1 minute per 429 error)
- Consider running during off-peak hours

### "File not found: tweet-urls.txt"

**Solution:** 
1. Make sure `tweet-urls.txt` is in the **root** of your project (same folder as `package.json`)
2. Or provide the full path: `node scripts/batch-add-posts.js /full/path/to/tweet-urls.txt`

### Posts Not Appearing on Site

1. **Wait a few minutes** - there may be a caching delay
2. **Force refresh** your browser (Ctrl+Shift+R or Cmd+Shift+R)
3. **Check Netlify function logs** for errors
4. **Verify posts are in storage:**
   - Netlify Dashboard → Your Site → Blobs
   - Look for the `x-posts` store

### Script Runs Very Slowly

**Normal:** With 2-second delays, 2,100 posts takes ~70 minutes. This is intentional to avoid rate limits.

**To speed up (risky):**
- Edit `scripts/batch-add-posts.js`
- Change `DELAY_BETWEEN_REQUESTS` from `2000` to `1500` (1.5 seconds)
- **Warning:** May increase chance of 429 errors

## 📊 Monitoring Progress

The script saves progress to `.batch-progress.json`. You can check it:

```bash
cat .batch-progress.json
```

You'll see:
```json
{
  "completed": ["url1", "url2", ...],
  "failed": [],
  "lastIndex": 150,
  "total": 2100,
  "processed": 150
}
```

## 💡 Tips

1. **Test with a small batch first:**
   - Create `test-urls.txt` with just 5-10 URLs
   - Run the script on that file
   - Verify posts appear on your site
   - Then proceed with the full 2,100

2. **Run overnight or during off-hours:**
   - Less likely to hit rate limits
   - Won't tie up your terminal

3. **Keep the terminal open:**
   - Don't close the terminal while the script is running
   - You can minimize it

4. **Check periodically:**
   - Let it run for 30 minutes
   - Refresh your site to see progress
   - Verify posts are appearing

## ✅ Success Checklist

- [ ] Node.js installed (`node --version`)
- [ ] `tweet-urls.txt` created with 2,100 URLs
- [ ] `NETLIFY_FUNCTION_URL` environment variable set
- [ ] Tested with 5-10 URLs first
- [ ] Script running successfully
- [ ] Progress file (`.batch-progress.json`) is being created
- [ ] Posts appearing on your live site

## 🆘 Still Having Issues?

1. Check the script logs for error messages
2. Verify Netlify function is working: Visit `https://YOUR-SITE/.netlify/functions/posts-read` - should return JSON
3. Check Netlify function logs in the dashboard
4. Verify environment variables are set in Netlify Dashboard → Site Settings → Environment Variables
