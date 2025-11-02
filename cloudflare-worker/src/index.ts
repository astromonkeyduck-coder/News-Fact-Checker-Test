/**
 * X Feed Worker - Main entry point
 * 
 * Routes:
 * - POST /add - Add a tweet URL to the feed
 * - GET /feed - Get the feed
 * - DELETE /post/:id - Delete a post (admin only)
 * - PATCH /post/:id - Update post category (admin only)
 */

import type { Env, FeedPost, AddPostRequest, TwitterOEmbed } from './types';
import {
  parseTweetUrl,
  isValidTweetUrl,
  extractTextFromHtml,
  extractImage,
  getClientIP,
  getCorsHeaders,
  checkRateLimit,
  updateIndex,
} from './utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle OPTIONS (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env, request),
      });
    }

    // Route handlers
    if (path === '/add' && request.method === 'POST') {
      return handleAddPost(request, env);
    }

    if (path === '/feed' && request.method === 'GET') {
      return handleGetFeed(request, env);
    }

    if (path === '/sync' && request.method === 'GET') {
      return handleSyncProfile(request, env);
    }

    if (path.startsWith('/post/') && request.method === 'DELETE') {
      return handleDeletePost(request, env, path);
    }

    if (path.startsWith('/post/') && request.method === 'PATCH') {
      return handleUpdatePost(request, env, path);
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(env, request),
      },
    });
  },
};

/**
 * POST /add - Add a tweet URL to the feed
 */
async function handleAddPost(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(env, request);
  const ip = getClientIP(request);

  // Rate limiting
  const rateLimit = await checkRateLimit(env, ip);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${rateLimit.resetIn} second(s).`,
        resetIn: rateLimit.resetIn,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimit.resetIn.toString(),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const body: AddPostRequest = await request.json();
    const { url: tweetUrl } = body;

    if (!tweetUrl || typeof tweetUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid URL in request body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Validate URL is a tweet
    if (!isValidTweetUrl(tweetUrl)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid tweet URL',
          message: 'URL must be a valid X/Twitter status URL (e.g., https://x.com/username/status/123456)',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Fetch oEmbed data
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
    const oembedResponse = await fetch(oembedUrl);

    if (!oembedResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch tweet data',
          message: `oEmbed API returned ${oembedResponse.status}`,
        }),
        {
          status: oembedResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const oembed: TwitterOEmbed = await oembedResponse.json();
    const { id, author } = parseTweetUrl(tweetUrl);

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract tweet ID from URL' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Build post object
    const text = extractTextFromHtml(oembed.html);
    const image = extractImage(oembed.html);

    const post: FeedPost = {
      id,
      url: tweetUrl,
      author: oembed.author_name || author || 'Unknown',
      html: oembed.html,
      text: text || oembed.author_name || 'Tweet',
      image,
      category: 'Update', // Default category
      created_at: Date.now(),
    };

    // Store post in KV
    const postKey = `feed:post:${id}`;
    await env.FEED.put(postKey, JSON.stringify(post));

    // Update index
    await updateIndex(env, id);

    return new Response(
      JSON.stringify({
        success: true,
        post,
        message: 'Post added successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Add post error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

/**
 * GET /feed?limit=50 - Get the feed
 */
async function handleGetFeed(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(env, request);
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  try {
    // Get index
    const indexKey = 'feed:index';
    const indexData = await env.FEED.get(indexKey, 'json') as string[] | null;
    
    if (!indexData || indexData.length === 0) {
      return new Response(
        JSON.stringify([]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...corsHeaders,
          },
        }
      );
    }

    // Get posts for IDs (up to limit)
    const idsToFetch = indexData.slice(0, limit);
    const postPromises = idsToFetch.map(async (id: string) => {
      const postKey = `feed:post:${id}`;
      const postData = await env.FEED.get(postKey, 'json');
      return postData as FeedPost | null;
    });

    const posts = await Promise.all(postPromises);

    // Filter out nulls and sort by created_at (newest first)
    const validPosts = posts
      .filter((post): post is FeedPost => post !== null)
      .sort((a, b) => b.created_at - a.created_at);

    return new Response(
      JSON.stringify(validPosts),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Get feed error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

/**
 * DELETE /post/:id - Delete a post (admin only)
 */
async function handleDeletePost(request: Request, env: Env, path: string): Promise<Response> {
  const corsHeaders = getCorsHeaders(env, request);
  
  // Check admin token
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  
  if (token !== env.ADMIN_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const postId = path.replace('/post/', '');
  if (!postId) {
    return new Response(
      JSON.stringify({ error: 'Missing post ID' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    // Delete post
    const postKey = `feed:post:${postId}`;
    await env.FEED.delete(postKey);

    // Remove from index
    const indexKey = 'feed:index';
    const indexData = await env.FEED.get(indexKey, 'json') as string[] | null;
    if (indexData) {
      const updatedIndex = indexData.filter(id => id !== postId);
      await env.FEED.put(indexKey, JSON.stringify(updatedIndex));
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Post deleted' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Delete post error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

/**
 * GET /sync?username=newsnoteworthy&limit=10 - Sync tweets from a profile
 */
async function handleSyncProfile(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(env, request);
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || 'newsnoteworthy';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  try {
    // Try to fetch profile RSS feed (X/Twitter provides RSS for profiles)
    const rssUrl = `https://nitter.net/${username}/rss`;
    
    let tweetUrls: string[] = [];
    
    try {
      // Try RSS feed first (via nitter or similar service)
      const rssResponse = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FeedBot/1.0)',
        },
      });
      
      if (rssResponse.ok) {
        const rssText = await rssResponse.text();
        // Extract tweet URLs from RSS
        const urlMatches = rssText.matchAll(/https?:\/\/(?:twitter\.com|x\.com)\/[^\/]+\/status\/\d+/g);
        tweetUrls = Array.from(urlMatches, m => m[0])
          .filter((url, index, self) => self.indexOf(url) === index) // dedupe
          .slice(0, limit);
      }
    } catch (err) {
      console.log('[Sync] RSS fetch failed, trying alternative method');
    }

    // If RSS didn't work, try fetching profile page HTML
    if (tweetUrls.length === 0) {
      try {
        const profileUrl = `https://twitter.com/${username}`;
        const htmlResponse = await fetch(profileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (htmlResponse.ok) {
          const html = await htmlResponse.text();
          // Extract tweet URLs from HTML
          const urlPattern = /https?:\/\/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/gi;
          const matches = Array.from(html.matchAll(urlPattern));
          tweetUrls = matches
            .map(m => m[0].split('?')[0]) // remove query params
            .filter((url, index, self) => self.indexOf(url) === index) // dedupe
            .slice(0, limit);
        }
      } catch (err) {
        console.error('[Sync] Profile fetch failed:', err);
      }
    }

    if (tweetUrls.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No tweets found',
          message: 'Could not fetch tweets from profile. X may block automated requests.',
          suggestion: 'Try adding tweets manually via /add endpoint or use the bookmarklet',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Add each tweet URL to the feed
    const results = [];
    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const tweetUrl of tweetUrls) {
      try {
        // Use existing /add logic
        const { id } = parseTweetUrl(tweetUrl);
        if (!id) {
          failed++;
          continue;
        }

        // Check if already exists
        const postKey = `feed:post:${id}`;
        const existing = await env.FEED.get(postKey, 'json');
        if (existing) {
          skipped++;
          continue;
        }

        // Fetch oEmbed and add
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
        const oembedResponse = await fetch(oembedUrl);

        if (!oembedResponse.ok) {
          failed++;
          continue;
        }

        const oembed: TwitterOEmbed = await oembedResponse.json();
        const { author } = parseTweetUrl(tweetUrl);

        const post: FeedPost = {
          id,
          url: tweetUrl,
          author: oembed.author_name || author || username,
          html: oembed.html,
          text: extractTextFromHtml(oembed.html) || oembed.author_name || 'Tweet',
          image: extractImage(oembed.html),
          category: 'Update',
          created_at: Date.now(),
        };

        await env.FEED.put(postKey, JSON.stringify(post));
        await updateIndex(env, id);
        success++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.error(`[Sync] Error processing ${tweetUrl}:`, error);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        username,
        total: tweetUrls.length,
        added: success,
        skipped,
        failed,
        message: `Synced ${success} new tweets from @${username}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

/**
 * PATCH /post/:id - Update post category (admin only)
 */
async function handleUpdatePost(request: Request, env: Env, path: string): Promise<Response> {
  const corsHeaders = getCorsHeaders(env, request);
  
  // Check admin token
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  
  if (token !== env.ADMIN_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const postId = path.replace('/post/', '');
  if (!postId) {
    return new Response(
      JSON.stringify({ error: 'Missing post ID' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    const body = await request.json();
    const { category } = body;

    if (!category || !['Breaking', 'Developing', 'Update'].includes(category)) {
      return new Response(
        JSON.stringify({ error: 'Invalid category. Must be Breaking, Developing, or Update' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Get existing post
    const postKey = `feed:post:${postId}`;
    const postData = await env.FEED.get(postKey, 'json') as FeedPost | null;

    if (!postData) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Update category
    postData.category = category as 'Breaking' | 'Developing' | 'Update';
    await env.FEED.put(postKey, JSON.stringify(postData));

    return new Response(
      JSON.stringify({ success: true, post: postData }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Update post error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

