import { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import type { CardPost } from "../../src/lib/posts/types";

interface IndexData {
  ids: string[];
}

/**
 * Read latest posts from blob storage
 */
export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    // Get limit from query (default 30)
    const limit = parseInt(event.queryStringParameters?.limit || "30", 10);
    const maxLimit = Math.min(limit, 200); // Cap at 200

    const store = getStore({ name: "x-posts" });

    // Read index
    let indexData: IndexData = { ids: [] };
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob && Array.isArray((indexBlob as any).ids)) {
        indexData = indexBlob as IndexData;
      }
    } catch (err) {
      // Index doesn't exist yet
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    // Get IDs to fetch (first N)
    const idsToFetch = indexData.ids.slice(0, maxLimit);

    // Fetch all posts in parallel
    const postPromises = idsToFetch.map(async (id) => {
      const postKey = `post-${id}.json`;
      try {
        const postBlob = await store.get(postKey, { type: "json" });
        return postBlob as CardPost | null;
      } catch (err) {
        // Post doesn't exist (maybe was deleted or index is stale)
        return null;
      }
    });

    const posts = await Promise.all(postPromises);
    
    // Filter out nulls and return
    const validPosts = posts.filter((post): post is CardPost => post !== null);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(validPosts),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

