/**
 * Fetches tweets from an X profile and converts them to card format
 * Uses X's public profile page (no API needed)
 */

import { Handler } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { fetchTweetOEmbed } from "../../src/lib/posts/oembed-fetch";
import { extractTweetId, extractUsername } from "../../src/lib/posts/oembed-fetch";

interface IndexData {
  ids: string[];
  urls: string[];
}

/**
 * Extract tweet URLs from profile HTML
 * Note: This is a simplified parser - X's HTML structure may change
 */
function extractTweetUrlsFromProfile(html: string, limit: number = 10): string[] {
  const urls: string[] = [];
  
  // Look for tweet links in HTML
  // X uses various patterns for tweet URLs
  const patterns = [
    /https?:\/\/(twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/gi,
    /href=["']([^"']*\/status\/\d+[^"']*)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null && urls.length < limit) {
      let url = match[0];
      if (match[1] && !url.startsWith('http')) {
        url = match[1];
      }
      // Normalize URL
      url = url.replace(/['"]/g, '').split('?')[0];
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls.slice(0, limit);
}

/**
 * Convert oEmbed data to Card format
 */
function oEmbedToCard(oembed: any, tweetUrl: string): any {
  const tweetId = extractTweetId(tweetUrl) || Date.now().toString();
  const username = extractUsername(tweetUrl) || 'unknown';
  
  // Extract text from HTML
  const textMatch = oembed.html?.match(/<p[^>]*>(.*?)<\/p>/s);
  const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  
  // Extract title (first sentence or 80 chars)
  const title = text.match(/^[^.!?]+[.!?]?/)?.[0] || text;
  const finalTitle = title.length > 80 
    ? title.substring(0, 77) + '...'
    : title;

  // Calculate read time
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const readTime = Math.ceil(wordCount / 200) || 1;

  // Try to extract image from oEmbed HTML
  let image: string | null = null;
  const imgMatch = oembed.html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    image = imgMatch[1];
  }

  return {
    id: tweetId,
    image,
    title: finalTitle,
    story: text,
    datePosted: new Date().toISOString(), // oEmbed doesn't provide date
    link: tweetUrl,
    postType: image ? 'photo' as const : 'text' as const,
    readTime,
  };
}

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Get siteID and token from environment (shared for both GET and POST)
  const siteID = process.env.NETLIFY_SITE_ID || (event as any).headers?.['x-nf-site-id'];
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || (event as any).headers?.['x-nf-token'];
  
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
    console.error('[fetch-profile-tweets] Failed to create store:', storeErr);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Storage configuration error",
        message: storeErr.message,
      }),
    };
  }

  // GET: Fetch tweets from profile and return as cards
  if (event.httpMethod === "GET") {
    try {
      const username = event.queryStringParameters?.username;
      const limit = parseInt(event.queryStringParameters?.limit || "10", 10);

      if (!username) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: "username parameter required",
            example: "/.netlify/functions/fetch-profile-tweets?username=newsnoteworthy&limit=10"
          }),
        };
      }

      try {
        // Fetch profile page
        const profileUrl = `https://twitter.com/${username}`;
        const response = await fetch(profileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TwitterBot/1.0)',
          },
        });

        if (!response.ok) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: `Profile not found: ${username}` }),
          };
        }

        const html = await response.text();
        
        // Extract tweet URLs from HTML
        const tweetUrls = extractTweetUrlsFromProfile(html, limit);
        
        if (tweetUrls.length === 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              message: "No tweet URLs found. X may have changed their HTML structure.",
              suggestion: "Use manual entry: POST with tweetUrl parameter"
            }),
          };
        }

        // Fetch each tweet via oEmbed with rate limiting
        // Add delays between requests to avoid 429 errors
        const cards = [];
        for (let i = 0; i < tweetUrls.length; i++) {
          const url = tweetUrls[i];
          try {
            // Add delay between requests (except first one)
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
            const oembed = await fetchTweetOEmbed(url);
            const card = oEmbedToCard(oembed, url);
            cards.push(card);
            console.log(`[fetch-profile-tweets] Fetched tweet ${i + 1}/${tweetUrls.length}: ${url}`);
          } catch (err: any) {
            console.error(`[fetch-profile-tweets] Error fetching tweet ${url}:`, err);
            // If rate limited, stop processing more tweets
            if (err.message?.includes('429') || err.message?.includes('Rate limited')) {
              console.error('[fetch-profile-tweets] Rate limited by X. Stopping fetch. Try again later or add posts manually.');
              break;
            }
            // For other errors, continue with next tweet
          }
        }

        const validCards = cards.filter(c => c !== null);

        // Store fetched tweets
        const indexData: IndexData = { ids: [], urls: [] };
        try {
          const existing = await store.get("index.json", { type: "json" });
          if (existing) {
            indexData.ids = (existing as any).ids || [];
            indexData.urls = (existing as any).urls || [];
          }
        } catch {}

        // Add new tweets to storage
        let storedCount = 0;
        for (const card of validCards) {
          if (!indexData.ids.includes(card.id)) {
            try {
              await store.setJSON(`post-${card.id}.json`, card);
              indexData.ids.unshift(card.id);
              indexData.urls.unshift(card.link);
              storedCount++;
              console.log(`[fetch-profile-tweets] Stored post ${card.id}: ${card.title?.substring(0, 50)}`);
            } catch (storeErr: any) {
              console.error(`[fetch-profile-tweets] Failed to store post ${card.id}:`, storeErr);
            }
          } else {
            console.log(`[fetch-profile-tweets] Post ${card.id} already exists, skipping`);
          }
        }

        // Update index (cap at 200)
        indexData.ids = indexData.ids.slice(0, 200);
        indexData.urls = indexData.urls.slice(0, 200);
        try {
          await store.setJSON("index.json", indexData);
          console.log(`[fetch-profile-tweets] Updated index with ${indexData.ids.length} posts (${storedCount} new)`);
        } catch (indexErr: any) {
          console.error('[fetch-profile-tweets] Failed to update index:', indexErr);
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(validCards),
        };
      } catch (error: any) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: error?.message || "Failed to fetch profile",
            hint: "X may block automated requests. Try manual entry instead."
          }),
        };
      }
    }

    // POST: Manual tweet URL entry
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { tweetUrl } = body;

      if (!tweetUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "tweetUrl required" }),
        };
      }

      try {
        const oembed = await fetchTweetOEmbed(tweetUrl);
        const card = oEmbedToCard(oembed, tweetUrl);
        const tweetId = card.id;

        // Check for duplicates
        try {
          const existing = await store.get(`post-${tweetId}.json`);
          if (existing) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ message: "Tweet already exists", card }),
            };
          }
        } catch {}

        // Store using setJSON
        try {
          await store.setJSON(`post-${tweetId}.json`, card);
          console.log(`[fetch-profile-tweets] Stored post ${tweetId}: ${card.title?.substring(0, 50)}`);
        } catch (storeErr: any) {
          console.error(`[fetch-profile-tweets] Failed to store post:`, storeErr);
          throw storeErr;
        }

        // Update index
        let indexData: IndexData = { ids: [], urls: [] };
        try {
          const existing = await store.get("index.json", { type: "json" });
          if (existing) {
            indexData.ids = (existing as any).ids || [];
            indexData.urls = (existing as any).urls || [];
          }
        } catch {}

        indexData.ids.unshift(tweetId);
        indexData.urls.unshift(tweetUrl);
        indexData.ids = indexData.ids.slice(0, 200);
        indexData.urls = indexData.urls.slice(0, 200);

        try {
          await store.setJSON("index.json", indexData);
          console.log(`[fetch-profile-tweets] Updated index, total posts: ${indexData.ids.length}`);
        } catch (indexErr: any) {
          console.error('[fetch-profile-tweets] Failed to update index:', indexErr);
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, card }),
        };
      } catch (error: any) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error?.message || "Failed to fetch tweet" }),
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
};
