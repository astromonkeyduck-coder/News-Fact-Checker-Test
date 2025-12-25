/**
 * Debug function to check post image fields
 * GET /.netlify/functions/debug-posts?limit=5
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const limit = parseInt(event.queryStringParameters?.limit || "5", 10);
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    
    if (!siteID || !token) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Missing credentials" }),
      };
    }

    const store = getStore({
      name: "x-posts",
      siteID: siteID,
      token: token,
    });

    // Read index
    let indexData = { ids: [] };
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob && Array.isArray(indexBlob.ids)) {
        indexData = indexBlob;
      }
    } catch (err) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: "No index found", posts: [] }),
      };
    }

    const idsToFetch = indexData.ids.slice(0, limit);
    const posts = await Promise.all(
      idsToFetch.map(async (id) => {
        try {
          const post = await store.get(`post-${id}.json`, { type: "json" });
          return {
            id: post.id,
            title: post.title?.substring(0, 50),
            image: post.image,
            image_url: post.image_url,
            primary_image_url: post.primary_image_url,
            hasImage: !!(post.image || post.image_url || post.primary_image_url),
            datePosted: post.datePosted,
          };
        } catch {
          return null;
        }
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total: indexData.ids.length,
        checked: limit,
        posts: posts.filter(Boolean),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

