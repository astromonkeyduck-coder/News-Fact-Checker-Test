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
export async function fetchTweetOEmbed(tweetUrl: string, retries = 3): Promise<OEmbedTweet> {
  const encodedUrl = encodeURIComponent(tweetUrl);
  const apiUrl = `https://publish.twitter.com/oembed?url=${encodedUrl}&omit_script=true`;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(apiUrl);
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
        
        if (attempt < retries - 1) {
          console.warn(`[oEmbed] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error(`Rate limited (429): Too many requests. Please wait before trying again.`);
        }
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tweet: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    } catch (error: any) {
      // If it's a rate limit error and we're out of retries, throw it
      if (error.message?.includes('429') && attempt === retries - 1) {
        throw error;
      }
      // For other errors, throw immediately
      if (error.message && !error.message.includes('Rate limited')) {
        throw error;
      }
      // If it's a rate limit and we have retries left, continue the loop
    }
  }
  
  throw new Error('Failed to fetch tweet after retries');
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

