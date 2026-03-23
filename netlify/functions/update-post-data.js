/**
 * Update individual post data (dates, stats, media)
 * Creates a new post if one doesn't exist for the given ID.
 */

const { requireAdminAuth } = require("./middleware/requireAuth");
const {
  getPostStore,
  readPost,
  writePost,
  addToIndex,
  readIndex,
  writeIndex,
} = require("./lib/postStore");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  if (event.httpMethod !== "POST" && event.httpMethod !== "PATCH") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      postId,
      datePosted,
      views,
      likes,
      reposts,
      replies,
      engagements,
      bookmarks,
      shares,
      story,
      text,
      link,
      url,
      image,
      images,
      videos,
      video,
      video_url,
      primary_image_url,
    } = body;

    if (!postId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "postId is required" }),
      };
    }

    const store = getPostStore();
    let post = await readPost(store, postId);
    let isNewPost = !post;

    if (!post) {
      post = {
        id: postId,
        link: link || url || `https://x.com/newsnoteworthy/status/${postId}`,
        url: url || link || `https://x.com/newsnoteworthy/status/${postId}`,
      };
    }

    const updatedPost = {
      ...post,
      id: post.id || postId,
      link:
        link ||
        url ||
        post.link ||
        `https://x.com/newsnoteworthy/status/${postId}`,
      url:
        url ||
        link ||
        post.url ||
        post.link ||
        `https://x.com/newsnoteworthy/status/${postId}`,
    };

    // Text / story
    if (story !== undefined && story !== null && story !== "") {
      updatedPost.story = story;
      updatedPost.text = story;
    } else if (text !== undefined && text !== null && text !== "") {
      updatedPost.story = text;
      updatedPost.text = text;
    } else if (!updatedPost.story && !updatedPost.text) {
      updatedPost.story = post.story || post.text || post.title || "";
      updatedPost.text = post.text || post.story || post.title || "";
    }

    // Dates
    if (datePosted) {
      updatedPost.datePosted = datePosted;
      updatedPost.createdAt = datePosted;
    }

    // Engagement stats
    if (views !== undefined) updatedPost.views = views;
    if (likes !== undefined) updatedPost.likes = likes;
    if (reposts !== undefined) updatedPost.reposts = reposts;
    if (replies !== undefined) updatedPost.replies = replies;
    if (engagements !== undefined) updatedPost.engagements = engagements;
    if (bookmarks !== undefined) updatedPost.bookmarks = bookmarks;
    if (shares !== undefined) updatedPost.shares = shares;

    // Images
    if (
      primary_image_url !== undefined &&
      primary_image_url !== null &&
      primary_image_url !== ""
    ) {
      updatedPost.primary_image_url = primary_image_url;
      updatedPost.image = primary_image_url;
      updatedPost.image_url = primary_image_url;
    } else if (image !== undefined && image !== null && image !== "") {
      updatedPost.image = image;
      updatedPost.primary_image_url = image;
      updatedPost.image_url = image;
    }
    if (images !== undefined && Array.isArray(images) && images.length > 0) {
      updatedPost.images = images;
      if (!updatedPost.primary_image_url && images[0]) {
        updatedPost.primary_image_url = images[0];
        updatedPost.image = images[0];
      }
    }

    // Videos
    if (video_url !== undefined && video_url !== null && video_url !== "") {
      updatedPost.video_url = video_url;
      updatedPost.video = video_url;
    } else if (video !== undefined && video !== null && video !== "") {
      updatedPost.video = video;
      updatedPost.video_url = video;
    }
    if (videos !== undefined && Array.isArray(videos) && videos.length > 0) {
      updatedPost.videos = videos;
      if (!updatedPost.video_url && videos[0]) {
        updatedPost.video_url = videos[0];
        updatedPost.video = videos[0];
      }
    }

    await writePost(store, postId, updatedPost);

    if (isNewPost) {
      await addToIndex(store, postId);
      console.log(`[update-post-data] Created new post ${postId} and added to index`);
    } else {
      // Deduplicate index if needed
      const ids = await readIndex(store);
      const count = ids.filter((id) => id === postId).length;
      if (count > 1) {
        console.log(
          `[update-post-data] Found ${count} duplicates for ${postId}, deduplicating`
        );
        const deduped = [];
        const seen = new Set();
        for (const id of ids) {
          if (!seen.has(id)) {
            seen.add(id);
            deduped.push(id);
          }
        }
        await writeIndex(store, deduped);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, post: updatedPost }),
    };
  } catch (error) {
    console.error("[update-post-data] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Failed to update post",
      }),
    };
  }
};
