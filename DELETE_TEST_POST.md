# How to Delete Test Earthquake Post

After running the test, you'll need to delete the test post. Here's how:

## Method 1: Using the Admin Interface

1. Go to: `http://localhost:8888/admin-posts-manager.html` (or your production URL)
2. Search for the post ID (format: `eq-{event_id}`)
3. Click "Delete This Post"

## Method 2: Using the API

```bash
curl -X POST "http://localhost:8888/.netlify/functions/remove-post" \
  -H "Content-Type: application/json" \
  -d '{"postId": "eq-{event_id}"}'
```

Replace `{event_id}` with the actual event ID from the test output.

## Method 3: Quick Delete Script

After the test runs, it will output the post ID. You can quickly delete it:

```bash
# Replace POST_ID with the actual post ID from test output
curl -X POST "http://localhost:8888/.netlify/functions/remove-post" \
  -H "Content-Type: application/json" \
  -d "{\"postId\": \"POST_ID\"}"
```

## Note

The test post will have:
- Post ID format: `eq-{usgs_event_id}`
- Category: "Earthquake"
- Source: "USGS"

You can identify it by these fields or by the recent timestamp.

