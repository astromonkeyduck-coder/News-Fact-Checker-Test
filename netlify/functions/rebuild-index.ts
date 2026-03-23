/**
 * Rebuild the index to include top-performing posts.
 * Ensures high-view posts don't get pushed out by the 200-post limit.
 *
 * Strategy:
 *   1. Recent posts (last 50)
 *   2. Top-performing posts by views (next 100)
 *   3. Other posts by date (fill to 200)
 */

import { Handler } from "@netlify/functions";

const {
  getPostStore,
  readIndex,
  readPost,
  writeIndex,
  MAX_INDEX_SIZE,
} = require("./lib/postStore");
const { requireAdminAuth } = require("./middleware/requireAuth");

interface CardPost {
  id: string;
  views?: number;
  likes?: number;
  datePosted?: string;
}

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const auth = await requireAdminAuth(event);
  if (auth.statusCode) return auth;

  try {
    const store = getPostStore();
    const allIds: string[] = await readIndex(store);

    if (allIds.length === 0) {
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

    const postsWithStats: Array<{
      id: string;
      views: number;
      likes: number;
      datePosted?: string;
      score: number;
    }> = [];

    for (const id of allIds) {
      const post = (await readPost(store, id)) as CardPost | null;
      if (post) {
        const views = post.views || 0;
        const likes = post.likes || 0;
        postsWithStats.push({
          id: post.id,
          views,
          likes,
          datePosted: post.datePosted,
          score: views + likes * 10,
        });
      } else {
        console.log(`[rebuild-index] Post ${id} not found, skipping`);
      }
    }

    console.log(
      `[rebuild-index] Loaded ${postsWithStats.length} posts with stats`
    );

    const sortedByDate = [...postsWithStats].sort((a, b) => {
      const dateA = a.datePosted ? new Date(a.datePosted).getTime() : 0;
      const dateB = b.datePosted ? new Date(b.datePosted).getTime() : 0;
      return dateB - dateA;
    });

    const sortedByScore = [...postsWithStats].sort(
      (a, b) => b.score - a.score
    );

    const recentIds = sortedByDate.slice(0, 50).map((p) => p.id);
    const topPerformers = sortedByScore
      .filter((p) => !recentIds.includes(p.id))
      .slice(0, 100)
      .map((p) => p.id);

    const newIds: string[] = [];
    const seen = new Set<string>();

    for (const id of [...recentIds, ...topPerformers]) {
      if (!seen.has(id)) {
        newIds.push(id);
        seen.add(id);
      }
    }

    if (newIds.length < MAX_INDEX_SIZE) {
      for (const post of sortedByDate) {
        if (newIds.length >= MAX_INDEX_SIZE) break;
        if (!seen.has(post.id)) {
          newIds.push(post.id);
          seen.add(post.id);
        }
      }
    }

    const finalIds = newIds.slice(0, MAX_INDEX_SIZE);

    await writeIndex(store, finalIds);

    console.log(`[rebuild-index] Rebuilt index with ${finalIds.length} posts`);
    console.log(
      `[rebuild-index] Recent: ${recentIds.length}, Top performers: ${topPerformers.length}`
    );

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
    console.error("[rebuild-index] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};
