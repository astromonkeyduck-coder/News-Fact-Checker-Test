# Add Your Posts - Quick Guide

## Step 1: Prepare Your Tweet URLs File

### If you have tweet URLs:
1. Open `tweet-urls.txt` in your editor
2. Delete the example lines (lines starting with `#`)
3. Paste your tweet URLs (one per line):
   ```
   https://x.com/newsnoteworthy/status/1234567890123456789
   https://x.com/newsnoteworthy/status/0987654321098765432
   https://x.com/newsnoteworthy/status/1111111111111111111
   ```
4. Save the file

### If you have tweet IDs or mixed content:
1. Create a file called `my-tweets-raw.txt` 
2. Paste all your content (URLs, IDs, or mixed format)
3. Run the helper script:
   ```bash
   node scripts/prepare-tweet-urls.js my-tweets-raw.txt tweet-urls.txt
   ```
4. The script will extract tweet IDs and create proper URLs

### Verify your file:
```bash
# Count how many URLs you have
wc -l tweet-urls.txt

# Check first 5 lines
head -5 tweet-urls.txt
```

## Step 2: Find Your Netlify Site URL

Your site is likely at one of these:
- `https://noteworthynews.co`
- `https://noteworthynews.netlify.app`
- Or check your Netlify dashboard

## Step 3: Set Environment Variable

**In your terminal**, run:

```bash
export NETLIFY_FUNCTION_URL=https://YOUR-SITE-URL/.netlify/functions/fetch-profile-tweets
```

**Replace `YOUR-SITE-URL`** with your actual domain (no trailing slash).

**Examples:**
```bash
export NETLIFY_FUNCTION_URL=https://noteworthynews.co/.netlify/functions/fetch-profile-tweets
# OR
export NETLIFY_FUNCTION_URL=https://noteworthynews.netlify.app/.netlify/functions/fetch-profile-tweets
```

## Step 4: Run the Batch Script

```bash
node scripts/batch-add-posts.js tweet-urls.txt
```

The script will:
- ✅ Process all your posts automatically
- ✅ Show progress every 10 posts
- ✅ Save progress after each post (you can stop with `Ctrl+C` and resume later)
- ✅ Automatically retry if rate-limited

### Expected Output:
```
📄 Loaded 2100 URLs from file

📊 Processing 2100 posts (0 already completed)
⏱️  Estimated time: ~70 minutes

[1/2100] Adding: https://x.com/newsnoteworthy/status/1234567890
  ✓ Success
  ⏳ Waiting 2s before next post...
```

## Step 5: Verify Posts Appear

1. Go to your live website
2. Refresh the page
3. Check the article cards - new posts should appear!

## Troubleshooting

### "Please set NETLIFY_FUNCTION_URL environment variable"
**Solution:** Make sure you ran the `export NETLIFY_FUNCTION_URL=...` command in Step 3

### 429 Rate Limit Errors
**Normal!** The script automatically:
- Waits 60 seconds
- Retries the request
- Continues processing

This will just take longer, but it's working correctly.

### Posts Not Appearing
1. Wait a few minutes (there may be caching)
2. Force refresh your browser (`Cmd+Shift+R` or `Ctrl+Shift+R`)
3. Check Netlify function logs in the dashboard

## Resume If Interrupted

If the script stops (network issue, closed terminal, etc.), just run it again:

```bash
node scripts/batch-add-posts.js tweet-urls.txt
```

It will automatically skip already-processed posts and continue from where it left off.

