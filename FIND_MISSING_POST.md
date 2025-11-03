# Finding the Missing 8.2M View Post

## Problem
The index is limited to 200 posts. When new posts are added, older posts (even high-performing ones) can get pushed out. The post still exists in storage but isn't in the index.

## Solution 1: Rebuild the Index (Recommended)

Run the rebuild-index function to restore top-performing posts:

```bash
# Via curl
curl -X POST https://noteworthynews.co/.netlify/functions/rebuild-index

# Or via browser console
fetch('/.netlify/functions/rebuild-index', {method: 'POST'})
  .then(r => r.json())
  .then(data => {
    console.log('Index rebuilt:', data);
    location.reload();
  });
```

This will:
- Keep the 50 most recent posts
- Keep the top 100 by views/engagement
- Fill remaining slots with other posts
- Total: 200 posts with high-performing posts guaranteed

## Solution 2: Search All Posts

If you know the tweet ID, you can add it directly:

```bash
node scripts/quick-add-post.js <tweet-id>
```

This will re-add it to the index.

## Prevention

The system now:
- ✅ Removes duplicates when adding posts
- ✅ Has a rebuild-index function to restore top posts
- ✅ Updated index logic to be smarter about keeping posts

**Recommendation**: Run `rebuild-index` once a week or after adding many posts to ensure top performers stay visible.

