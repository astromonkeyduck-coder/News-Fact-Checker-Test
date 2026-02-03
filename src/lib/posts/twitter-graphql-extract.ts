/**
 * Extract Twitter media using GraphQL API (like Discord bots do)
 * This uses Twitter's internal GraphQL endpoints with guest tokens
 */

export interface TwitterMedia {
  images: string[];
  videos: string[];
  primary_image_url?: string;
  video_url?: string;
}

/**
 * Get a guest token from Twitter (public, no auth needed)
 */
async function getGuestToken(): Promise<string | null> {
  try {
    const response = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.guest_token || null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract tweet ID from URL
 */
function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract media from Twitter using GraphQL API
 */
export async function extractTwitterMediaGraphQL(tweetUrl: string): Promise<TwitterMedia> {
  const media: TwitterMedia = {
    images: [],
    videos: [],
  };

  try {
    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      return media;
    }

    // Get guest token
    const guestToken = await getGuestToken();
    if (!guestToken) {
      console.warn('[extractTwitterMediaGraphQL] Failed to get guest token');
      return media;
    }

    // Try multiple GraphQL query IDs (Twitter uses different ones)
    const queryIds = [
      'V3ZzeV7Q-LBvF8o0jXx9zw', // TweetDetail
      'VWFGPVAGkWLQ4a5x5x5x5x', // TweetResultByRestId
      'VZ0VzX5X5X5X5X5X5X5X5X', // TweetDetail (alternative)
    ];

    for (const queryId of queryIds) {
      try {
        const variables = {
          tweetId: tweetId,
          with_rux_injections: false,
          includePromotedContent: false,
          withCommunity: true,
          withQuickPromoteEligibilityTweetFields: false,
          withBirdwatchNotes: false,
          withSuperFollowsUserFields: false,
          withDownvotePerspective: false,
          withReactionsMetadata: false,
          withReactionsPerspective: false,
          withSuperFollowsTweetFields: false,
          withVoice: false,
          withV2Timeline: false,
        };

        const graphqlUrl = `https://twitter.com/i/api/graphql/${queryId}/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables))}`;

        const response = await fetch(graphqlUrl, {
          headers: {
            'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            'x-guest-token': guestToken,
            'x-twitter-client-language': 'en',
            'x-twitter-active-user': 'yes',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          // Extract media from GraphQL response
          const extracted = extractMediaFromGraphQLResponse(data);
          
          if (extracted.images.length > 0 || extracted.videos.length > 0) {
            media.images = extracted.images;
            media.videos = extracted.videos;
            media.primary_image_url = extracted.images[0];
            media.video_url = extracted.videos[0];
            return media;
          }
        }
      } catch (error) {
        // Try next query ID
        continue;
      }
    }

    return media;
  } catch (error) {
    console.error('[extractTwitterMediaGraphQL] Error:', error);
    return media;
  }
}

/**
 * Extract media URLs from GraphQL response
 */
function extractMediaFromGraphQLResponse(data: any): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];
  const seen = new Set<string>();

  // Recursively search for media URLs
  function search(obj: any, depth = 0): void {
    if (depth > 20) return;
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => search(item, depth + 1));
      return;
    }

    // Look for media_url_https
    if (obj.media_url_https && typeof obj.media_url_https === 'string') {
      const url = obj.media_url_https;
      if (url.includes('pbs.twimg.com') && !url.includes('profile_images') && !seen.has(url)) {
        images.push(url);
        seen.add(url);
      }
    }

    // Look for video_info
    if (obj.video_info && obj.video_info.variants) {
      obj.video_info.variants.forEach((variant: any) => {
        if (variant.url && !seen.has(variant.url)) {
          videos.push(variant.url);
          seen.add(variant.url);
        }
      });
    }

    // Look for extended_entities
    if (obj.extended_entities && obj.extended_entities.media) {
      obj.extended_entities.media.forEach((media: any) => {
        if (media.media_url_https && !seen.has(media.media_url_https)) {
          images.push(media.media_url_https);
          seen.add(media.media_url_https);
        }
        if (media.video_info && media.video_info.variants) {
          media.video_info.variants.forEach((variant: any) => {
            if (variant.url && !seen.has(variant.url)) {
              videos.push(variant.url);
              seen.add(variant.url);
            }
          });
        }
      });
    }

    // Recursively search
    for (const key in obj) {
      if (key.includes('media') || key.includes('video') || key.includes('entities') || 
          key.includes('tweet') || key.includes('result') || key.includes('legacy')) {
        search(obj[key], depth + 1);
      }
    }
  }

  search(data);
  return { images, videos };
}
