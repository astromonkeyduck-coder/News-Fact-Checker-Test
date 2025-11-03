/**
 * Rebuild the index to include top-performing posts
 * This ensures high-view posts don't get pushed out by the 200-post limit
 */

import { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface IndexData {
  ids: string[];
  urls?: string[];
}

interface CardPost {
  id: string;
  views?: number;
  likes?: number;
  reposts?: number;
  datePosted?: string;
}

/**
 * Rebuild index prioritizing:
 * 1. Recent posts (last 50)
 * 2. Top-performing posts by views (next 100)
 * 3. Other posts by engagement (next 50)
 * Total: 200 posts
 */
export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    
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
    } catch (storeErr: any) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }

    // Read current index to get all known IDs
    let allIds: string[] = [];
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob && Array.isArray((indexBlob as any).ids)) {
        allIds = (indexBlob as any).ids;
      }
    } catch (err) {
      // No index yet
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: "No existing index found",
        }),
      };
    }

    console.log(`[rebuild-index] Found ${allIds.length} posts in index`);

    // Fetch all posts with their stats
    const postsWithStats: Array<{ id: string; views: number; likes: number; datePosted?: string; score: number }> = [];
    
    for (const id of allIds) {
      try {
        const post = await store.get(`post-${id}.json`, { type: "json" }) as CardPost;
        if (post) {
          const views = post.views || 0;
          const likes = post.likes || 0;
          // Calculate score: views are weighted heavily, likes add bonus
          const score = views + (likes * 10);
          
          postsWithStats.push({
            id: post.id,
            views,
            likes,
            datePosted: post.datePosted,
            score,
          });
        }
      } catch (err) {
        // Post doesn't exist, skip
        console.log(`[rebuild-index] Post ${id} not found, skipping`);
      }
    }

    console.log(`[rebuild-index] Loaded ${postsWithStats.length} posts with stats`);

    // Sort by date (newest first)
    const sortedByDate = [...postsWithStats].sort((a, b) => {
      const dateA = a.datePosted ? new Date(a.datePosted).getTime() : 0;
      const dateB = b.datePosted ? new Date(b.datePosted).getTime() : 0;
      return dateB - dateA;
    });

    // Sort by score (top-performing)
    const sortedByScore = [...postsWithStats].sort((a, b) => b.score - a.score);

    // Build new index:
    // 1. Top 50 most recent
    // 2. Top 100 by views/engagement (excluding those already in recent 50)
    // 3. Fill remaining slots with other posts
    const recentIds = sortedByDate.slice(0, 50).map(p => p.id);
    const topPerformers = sortedByScore
      .filter(p => !recentIds.includes(p.id))
      .slice(0, 100)
      .map(p => p.id);
    
    // Combine and dedupe
    const newIds: string[] = [];
    const seen = new Set<string>();
    
    for (const id of [...recentIds, ...topPerformers]) {
      if (!seen.has(id)) {
        newIds.push(id);
        seen.add(id);
      }
    }

    // Fill remaining slots if needed
    if (newIds.length < 200) {
      for (const post of sortedByDate) {
        if (newIds.length >= 200) break;
        if (!seen.has(post.id)) {
          newIds.push(post.id);
          seen.add(post.id);
        }
      }
    }

    // Limit to 200
    const finalIds = newIds.slice(0, 200);

    // Update index
    await store.set("index.json", JSON.stringify({ ids: finalIds }), {
      contentType: "application/json",
    });

    console.log(`[rebuild-index] Rebuilt index with ${finalIds.length} posts`);
    console.log(`[rebuild-index] Recent: ${recentIds.length}, Top performers: ${topPerformers.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Index rebuilt successfully",
        totalPosts: postsWithStats.length,
        indexSize: finalIds.length,
        recentPosts: recentIds.length,
        topPerformers: topPerformers.length,
      }),
    };
  } catch (error: any) {
    console.error('[rebuild-index] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

