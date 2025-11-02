/**
 * Utility functions for X Feed Worker
 */

import type { FeedPost, Env } from './types';

/**
 * Extract tweet ID and author from X/Twitter URL
 */
export function parseTweetUrl(url: string): { id: string | null; author: string | null } {
  // Support both twitter.com and x.com URLs
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/i,
    /\/status\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        id: match[2] || match[1] || null,
        author: match[1] || null,
      };
    }
  }

  return { id: null, author: null };
}

/**
 * Check if URL is a valid X/Twitter status URL
 */
export function isValidTweetUrl(url: string): boolean {
  const { id } = parseTweetUrl(url);
  return id !== null;
}

/**
 * Extract text from oEmbed HTML
 */
export function extractTextFromHtml(html: string): string {
  // Remove HTML tags and decode entities
  let text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Extract image from oEmbed HTML or use default
 */
export function extractImage(html: string): string {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : '';
}

/**
 * Calculate read time in minutes
 */
export function calculateReadTime(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.max(1, Math.ceil(words / 225)); // 225 words per minute
}

/**
 * Format timestamp as "X min ago" or date string
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get IP address from request
 */
export function getClientIP(request: Request): string {
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  const xRealIP = request.headers.get('X-Real-IP');

  return cfConnectingIP || xForwardedFor?.split(',')[0]?.trim() || xRealIP || 'unknown';
}

/**
 * CORS headers
 */
export function getCorsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';

  return {
    'Access-Control-Allow-Origin': origin && origin.includes('netlify.app') ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Rate limit check using KV
 */
export async function checkRateLimit(
  env: Env,
  ip: string,
  limit: number = parseInt(env.RATE_LIMIT_PER_MINUTE || '10')
): Promise<{ allowed: boolean; resetIn: number }> {
  const key = `rate_limit:${ip}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  try {
    const data = await env.FEED.get(key, 'json');
    if (data) {
      const { count, resetAt } = data as { count: number; resetAt: number };
      
      if (now < resetAt) {
        if (count >= limit) {
          return { allowed: false, resetIn: Math.ceil((resetAt - now) / 1000) };
        }
        // Increment count
        await env.FEED.put(key, JSON.stringify({ count: count + 1, resetAt }), {
          expirationTtl: Math.ceil((resetAt - now) / 1000),
        });
      } else {
        // Reset window
        await env.FEED.put(key, JSON.stringify({ count: 1, resetAt: now + windowMs }), {
          expirationTtl: 60,
        });
      }
    } else {
      // First request
      await env.FEED.put(key, JSON.stringify({ count: 1, resetAt: now + windowMs }), {
        expirationTtl: 60,
      });
    }
  } catch (error) {
    // Fail open - allow request if rate limit check fails
    console.error('Rate limit check error:', error);
    return { allowed: true, resetIn: 0 };
  }

  return { allowed: true, resetIn: 0 };
}

/**
 * Maintain index in KV (latest 200 IDs)
 */
export async function updateIndex(env: Env, postId: string): Promise<void> {
  try {
    const indexKey = 'feed:index';
    const indexData = await env.FEED.get(indexKey, 'json') as string[] | null;
    
    let ids: string[] = indexData || [];
    
    // Remove if already exists (dedupe)
    ids = ids.filter(id => id !== postId);
    
    // Add to front (newest first)
    ids.unshift(postId);
    
    // Keep only latest 200
    ids = ids.slice(0, 200);
    
    await env.FEED.put(indexKey, JSON.stringify(ids));
  } catch (error) {
    console.error('Index update error:', error);
    // Non-fatal - continue anyway
  }
}


