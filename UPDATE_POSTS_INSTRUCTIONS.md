# Update Posts with Correct Dates and Stats

## Overview
Your posts currently show incorrect dates (all showing the same date extracted from tweet IDs). 
You've provided the correct dates and engagement stats for all 201 posts.

## Solution

### Step 1: Save your data to a TSV file

Create a file called `posts-data.tsv` with your post data. The format should be tab-separated with columns:

```
Post id	Date	Post text	Post Link	Impressions	Likes	Engagements	Bookmarks	Shares	New follows	Replies	Reposts
```

### Step 2: Run the update script

```bash
node scripts/batch-update-posts.js posts-data.tsv
```

The script will:
- Parse all posts from the TSV file
- Update each post with correct date and stats via the Netlify API
- Show progress as it updates

### Alternative: Direct API Updates

If you prefer, you can update posts individually via the API:

```bash
curl -X POST https://noteworthynews.co/.netlify/functions/update-post-data \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "1923928821088108804",
    "datePosted": "2025-05-18T00:00:00.000Z",
    "views": 8213281,
    "likes": 25166,
    "reposts": 5221,
    "replies": 1603
  }'
```

## Files Created

1. `netlify/functions/update-post-data.js` - Netlify function to update individual posts
2. `scripts/batch-update-posts.js` - Script to batch update all posts
3. `scripts/create-posts-tsv.js` - Helper to format your data

## Note

Dates will be parsed from format like "Sun, May 18, 2025" to ISO format automatically.
All stats (impressions, likes, reposts, replies) will be updated.
