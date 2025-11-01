/**
 * Free alternative using X's oEmbed API
 * No authentication required for public tweets
 */

export interface OEmbedTweet {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number;
  height: number;
  type: string;
  cache_age: string;
  provider_name: string;
  provider_url: string;
  version: string;
}

/**
 * Fetch tweet data from X's oEmbed API
 * Free, no authentication needed
 * 
 * @param tweetUrl - Full X/Twitter URL (e.g., https://x.com/username/status/123456)
 * @returns Promise with oEmbed data including HTML embed code
 */
export async function fetchTweetOEmbed(tweetUrl: string): Promise<OEmbedTweet> {
  const encodedUrl = encodeURIComponent(tweetUrl);
  const apiUrl = `https://publish.twitter.com/oembed?url=${encodedUrl}&omit_script=true`;
  
  const response = await fetch(apiUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tweet: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Extract tweet ID from X URL
 */
export function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract username from X URL
 */
export function extractUsername(url: string): string | null {
  const match = url.match(/x\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

