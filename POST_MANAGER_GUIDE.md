# Post Manager Guide

## Overview

The Post Manager (`admin-posts-manager.html`) provides **5 easy ways** to add and update posts on your website:

1. **🔗 Paste URL** - Quickest method for X/Twitter posts
2. **✏️ Manual Entry** - Full control over all fields
3. **📸 Screenshot OCR** - Upload screenshot, auto-extract data
4. **📊 CSV Upload** - Bulk process multiple posts
5. **📋 Copy & Paste** - Smart detection of URLs or text

## Quick Start

Navigate to: `https://yourdomain.com/admin-posts-manager.html`

## Method 1: Paste URL (Fastest)

**Best for:** Adding posts from X/Twitter that you already have the URL for

1. Click the **🔗 URL** tab
2. Paste the full X/Twitter URL (e.g., `https://x.com/newsnoteworthy/status/2000243348691640646`)
3. Click **Add Post from URL**
4. The system automatically:
   - Fetches the post content
   - Extracts images/videos
   - Gets engagement stats (if available)
   - Adds it to your site

**Pro tip:** You can paste multiple URLs in the bulk section of the old admin page, or use this method one at a time.

## Method 2: Manual Entry (Most Control)

**Best for:** When you have all the data and want precise control

1. Click the **✏️ Manual** tab
2. Fill in the fields:
   - **Post ID**: The tweet ID (e.g., `2000243348691640646`)
   - **Post Text**: The full post content
   - **Post Link**: The X/Twitter URL
   - **Date Posted**: When the post was made
   - **Engagement Stats**: Views, Likes, Reposts, Replies, etc.
   - **Post Image URL**: Optional image URL
3. Click **Add Post**

**Note:** If the post already exists, it will be updated with your new data.

## Method 3: Screenshot OCR (Most Automated)

**Best for:** When you have a screenshot of a post and want to extract all data automatically

1. Click the **📸 Screenshot** tab
2. Upload a screenshot of the post (drag & drop or click to select)
3. Click **Extract Data from Screenshot**
4. The system uses AI vision to extract:
   - Post text
   - Views, Likes, Reposts, Replies
   - Date posted
   - Post URL (if visible)
   - Images in the post
5. Review and edit the extracted data if needed
6. Click **Add Post with Extracted Data**

**Requirements:**
- Screenshot should be clear and readable
- Make sure engagement numbers are visible
- Works best with full post screenshots

**Note:** This uses OpenAI Vision API, so it requires your `OPENAI_API_KEY` to be configured.

## Method 4: CSV Upload (Bulk Processing)

**Best for:** Processing multiple posts from analytics exports

1. Click the **📊 CSV** tab
2. Upload your CSV file (drag & drop or click to select)
3. Click **Process CSV File**

**CSV Format Required:**
```csv
Post id,Date,Post text,Post Link,Impressions,Likes,Engagements,Bookmarks,Shares,New follows,Replies,Reposts,...
2000243348691640646,"Sun, Dec 14, 2025","BREAKING: ...",https://x.com/...,655,2,13,1,0,0,1,0,...
```

**Note:** The function processes up to 10 posts at a time to avoid timeouts. For larger batches, use the command-line script:
```bash
node scripts/add-and-update-posts-from-csv.js your-file.csv
```

## Method 5: Copy & Paste (Smart Detection)

**Best for:** Quick paste of tweet URLs or text

1. Click the **📋 Paste** tab
2. Paste any of the following:
   - A tweet URL (e.g., `https://x.com/newsnoteworthy/status/123456`)
   - Tweet text
   - Full post content
3. Click **Process & Add Post**

**How it works:**
- If it detects a URL, it automatically fetches the post
- If it's just text, it prompts you to use Manual Entry for full details

## Comparison Table

| Method | Speed | Automation | Best For |
|--------|-------|------------|----------|
| **URL** | ⚡⚡⚡ Fastest | ✅ Auto-fetches everything | Single posts with URLs |
| **Manual** | ⚡⚡ Medium | ❌ Full manual control | Precise data entry |
| **Screenshot** | ⚡ Medium | ✅✅ AI extraction | Screenshots of posts |
| **CSV** | ⚡⚡⚡ Fastest (bulk) | ✅✅ Auto-processes | Analytics exports |
| **Paste** | ⚡⚡ Fast | ✅ Smart detection | Quick URL/text paste |

## Tips & Best Practices

### For Daily Updates:
- Use **URL method** for individual posts
- Use **CSV method** for bulk analytics updates

### For Screenshots:
- Take full screenshots showing all metrics
- Ensure text is readable (not too small)
- Include the post URL if possible

### For Manual Entry:
- Always include Post ID and Link for proper tracking
- Set accurate dates for proper sorting
- Fill in engagement stats for analytics

### For CSV:
- Export from X Analytics in CSV format
- Ensure date format is: "Day, Mon DD, YYYY" (e.g., "Sun, Dec 14, 2025")
- Include all required columns

## Troubleshooting

### "Failed to add post"
- Check that the URL is valid and accessible
- Ensure the post hasn't been deleted
- Verify your API keys are configured

### "Screenshot extraction failed"
- Ensure `OPENAI_API_KEY` is set in Netlify environment variables
- Check that the screenshot is clear and readable
- Try a different screenshot if metrics aren't visible

### "CSV processing incomplete"
- Large CSVs (>10 posts) need to be processed in batches
- Use the command-line script for full CSV processing
- Check CSV format matches the required structure

### "Post not appearing on site"
- Posts are added to storage immediately
- Refresh your website to see new posts
- Check that the post has a valid date for sorting

## Technical Details

### Backend Functions:
- `fetch-tweets-simple` - Fetches posts from URLs
- `update-post-data` - Updates post stats and metadata
- `process-post-screenshot` - OCR extraction from screenshots
- `process-csv-posts` - Bulk CSV processing

### Storage:
- Posts stored in Netlify Blobs (`x-posts` store)
- Index maintained in `index.json`
- Images stored with posts or as separate blobs

### API Requirements:
- `OPENAI_API_KEY` - Required for screenshot OCR
- Netlify Blob storage - Required for all operations

## Future Enhancements

Potential improvements:
- Batch URL processing
- Direct image upload for posts
- Auto-sync from X profile
- Scheduled CSV processing
- Post preview before adding

---

**Need help?** Check the console for detailed error messages and logs.
















