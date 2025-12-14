# How to Fix Timestamp Issues

## Quick Fix (Browser)

If you're seeing incorrect timestamps in the browser:

1. **Clear the cache:**
   - Open browser console (F12)
   - Run: `clearEnhancedFeedCache()`
   - Refresh the page

2. **Or manually clear:**
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Find "Local Storage" → your domain
   - Delete `noteworthy-posts-cache-enhanced`
   - Refresh the page

## Fix All Posts (Server-Side)

To fix all posts with incorrect dates in the database:

1. **Run the fix script:**
   ```bash
   node scripts/fix-all-post-dates.js
   ```

2. **The script will:**
   - Fetch all posts from the API
   - Extract correct dates from Twitter Snowflake IDs
   - Update each post with the correct `datePosted` value
   - Show a summary of what was fixed

3. **After running:**
   - Clear browser cache (see above)
   - Refresh the page
   - Timestamps should now be correct

## What Causes Wrong Timestamps?

1. **Posts added before the fix** - May have incorrect dates stored
2. **CSV updates** - Dates set to noon UTC, can be off by hours/days
3. **Date extraction failures** - If Snowflake extraction failed, posts got "now" timestamp

## Prevention

The code now:
- ✅ Validates extracted dates (not in future, not before Twitter existed)
- ✅ Preserves existing dates when re-adding posts
- ✅ Uses cache versioning to invalidate old cached data
- ✅ Logs warnings when date extraction fails

## Verify Fix

After running the script, check:
1. Browser console for date-related warnings
2. Compare displayed times with actual tweet times on Twitter
3. All posts should show accurate relative times (not all "1d")
