/**
 * Update individual post data (dates, stats)
 * This function allows updating existing posts with correct dates and engagement stats
 */

const { getStore } = require("@netlify/blobs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let store;
    try {
      if (siteID && token) {
        store = getStore({
          name: "x-posts",
          siteID: siteID,
          token: token,
        });
      } else {
        store = getStore({ name: "x-posts" });
      }
    } catch (storeErr) {
      console.error('[update-post-data] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    if (event.httpMethod === "POST" || event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { postId, datePosted, views, likes, reposts, replies, engagements, bookmarks, shares, story, text, link, url, image, images } = body;

      if (!postId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "postId is required" }),
        };
      }

      try {
        // Get existing post or create new one
        const postKey = `post-${postId}.json`;
        let post = null;
        let isNewPost = false;
        
        try {
          const existing = await store.get(postKey, { type: "json" });
          if (existing) {
            post = existing;
          } else {
            // Post doesn't exist - create new one
            isNewPost = true;
            post = {
              id: postId,
              link: link || url || `https://x.com/newsnoteworthy/status/${postId}`,
              url: url || link || `https://x.com/newsnoteworthy/status/${postId}`,
            };
          }
        } catch (err) {
          // Post doesn't exist - create new one
          isNewPost = true;
          post = {
            id: postId,
            link: link || url || `https://x.com/newsnoteworthy/status/${postId}`,
            url: url || link || `https://x.com/newsnoteworthy/status/${postId}`,
          };
        }

        // Ensure post object exists (safety check)
        if (!post) {
          isNewPost = true;
          post = {
            id: postId,
            link: link || url || `https://x.com/newsnoteworthy/status/${postId}`,
            url: url || link || `https://x.com/newsnoteworthy/status/${postId}`,
          };
        }

        // Update post with new data
        // Ensure ID and link are preserved (they might be missing in corrupted posts)
        const updatedPost = {
          ...(post || {}), // Safely spread post (handle null case)
          id: (post && post.id) || postId, // Ensure ID is always set
          link: link || url || (post && post.link) || `https://x.com/newsnoteworthy/status/${postId}`, // Ensure link is always set
          url: url || link || (post && post.url) || (post && post.link) || `https://x.com/newsnoteworthy/status/${postId}`, // Ensure url is always set
        };
        
        // Update text/story fields - use provided values if available, otherwise keep existing
        if (story !== undefined && story !== null && story !== '') {
          updatedPost.story = story;
          updatedPost.text = story;
        } else if (text !== undefined && text !== null && text !== '') {
          updatedPost.story = text;
          updatedPost.text = text;
        } else if (!updatedPost.story && !updatedPost.text) {
          // Only set default if both are missing
          updatedPost.story = (post && (post.story || post.text || post.title)) || '';
          updatedPost.text = (post && (post.text || post.story || post.title)) || '';
        }
        
        // Update other fields
        if (datePosted) updatedPost.datePosted = datePosted;
        if (views !== undefined) updatedPost.views = views;
        if (likes !== undefined) updatedPost.likes = likes;
        if (reposts !== undefined) updatedPost.reposts = reposts;
        if (replies !== undefined) updatedPost.replies = replies;
        if (engagements !== undefined) updatedPost.engagements = engagements;
        if (bookmarks !== undefined) updatedPost.bookmarks = bookmarks;
        if (shares !== undefined) updatedPost.shares = shares;
        
        // Update image fields
        if (image !== undefined && image !== null && image !== '') {
          updatedPost.image = image;
        }
        if (images !== undefined && Array.isArray(images) && images.length > 0) {
          updatedPost.images = images;
        }

        // Save updated/created post
        await store.setJSON(postKey, updatedPost);
        
        // If this is a new post, add it to the index so it appears on the site
        // CRITICAL: Always check for duplicates in index to prevent duplicates
        if (isNewPost) {
          try {
            let indexData = { ids: [], urls: [] };
            try {
              const indexBlob = await store.get("index.json", { type: "json" });
              if (indexBlob) {
                indexData = indexBlob;
              }
            } catch (err) {
              // Index doesn't exist yet, will create it
            }
            
            // Add post to index if not already there (DUPLICATE PREVENTION)
            const existingIds = indexData.ids || [];
            const existingUrls = indexData.urls || [];
            
            // Remove any existing instances of this postId to prevent duplicates
            const filteredIds = existingIds.filter(id => id !== postId);
            const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== postId);
            
            if (!existingIds.includes(postId)) {
              // Prepend new post to index (only if not already there)
              const newIds = [postId, ...filteredIds];
              const newUrls = [updatedPost.link || updatedPost.url, ...filteredUrls];
              
              // Cap at 200 posts
              const updatedIds = newIds.slice(0, 200);
              const updatedUrls = newUrls.slice(0, 200);
              
              await store.set("index.json", JSON.stringify({ ids: updatedIds, urls: updatedUrls }), {
                contentType: "application/json",
              });
              
              console.log(`[update-post-data] Added new post ${postId} to index`);
            } else {
              console.log(`[update-post-data] Post ${postId} already in index, skipping to prevent duplicate`);
            }
          } catch (indexErr) {
            console.error('[update-post-data] Failed to update index:', indexErr);
            // Don't fail the whole request if index update fails
          }
        } else {
          // Even for existing posts, ensure no duplicates in index
          try {
            let indexData = { ids: [], urls: [] };
            try {
              const indexBlob = await store.get("index.json", { type: "json" });
              if (indexBlob) {
                indexData = indexBlob;
              }
            } catch (err) {
              // Index doesn't exist yet
            }
            
            const existingIds = indexData.ids || [];
            const existingUrls = indexData.urls || [];
            
            // Check if postId appears multiple times in index (duplicate detection)
            const duplicateCount = existingIds.filter(id => id === postId).length;
            if (duplicateCount > 1) {
              console.log(`[update-post-data] ⚠️ Found ${duplicateCount} duplicate entries for post ${postId} in index, removing duplicates`);
              
              // Remove all instances, then add back once
              const filteredIds = existingIds.filter(id => id !== postId);
              const filteredUrls = existingUrls.filter((url, idx) => existingIds[idx] !== postId);
              
              // Add back at the beginning (most recent)
              const deduplicatedIds = [postId, ...filteredIds].slice(0, 200);
              const deduplicatedUrls = [updatedPost.link || updatedPost.url, ...filteredUrls].slice(0, 200);
              
              await store.set("index.json", JSON.stringify({ ids: deduplicatedIds, urls: deduplicatedUrls }), {
                contentType: "application/json",
              });
              
              console.log(`[update-post-data] ✅ Removed duplicates for post ${postId}`);
            }
          } catch (indexErr) {
            console.error('[update-post-data] Failed to check/clean index:', indexErr);
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, post: updatedPost }),
        };
      } catch (error) {
        console.error('[update-post-data] Error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: error?.message || "Failed to update post",
          }),
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error('[update-post-data] Fatal error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

