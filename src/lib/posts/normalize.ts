import type { CardPost, PostType } from "./types";

/**
 * Extract the best image URL from a tweet event
 */
export function extractImage(rawEvent: any): string | null {
  if (!rawEvent?.extended_entities?.media) {
    return null;
  }

  const media = rawEvent.extended_entities.media;
  
  // Find first photo
  const photo = media.find((m: any) => m.type === "photo");
  if (photo?.media_url_https) {
    return photo.media_url_https;
  }

  // Find video/gif and use thumbnail
  const video = media.find((m: any) => m.type === "video" || m.type === "animated_gif");
  if (video?.media_url_https) {
    return video.media_url_https;
  }

  // Fallback: any media URL
  if (media[0]?.media_url_https) {
    return media[0].media_url_https;
  }

  return null;
}

/**
 * Infer post type from tweet media
 */
export function inferPostType(rawEvent: any): PostType {
  if (!rawEvent?.extended_entities?.media) {
    return "text";
  }

  const media = rawEvent.extended_entities.media;
  
  // Check for photos first
  const hasPhoto = media.some((m: any) => m.type === "photo");
  if (hasPhoto) {
    return "photo";
  }

  // Check for video/gif
  const hasVideo = media.some((m: any) => m.type === "video" || m.type === "animated_gif");
  if (hasVideo) {
    return "video";
  }

  return "text";
}

/**
 * Extract title from tweet text (first sentence or up to 80 chars at word boundary)
 * Strips URLs, hashtags, and mentions for title
 */
export function toTitle(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Remove URLs
  let cleaned = text.replace(/https?:\/\/[^\s]+/gi, "").trim();
  
  // Remove hashtags and mentions for title
  cleaned = cleaned.replace(/#\w+/g, "").replace(/@\w+/g, "").trim();
  
  // Find first sentence (ending with . ! ?)
  const sentenceMatch = cleaned.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch) {
    let title = sentenceMatch[0].trim();
    // If sentence is too long, truncate at word boundary
    if (title.length > 80) {
      const truncated = title.substring(0, 80);
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 50) {
        title = truncated.substring(0, lastSpace) + "...";
      } else {
        title = truncated + "...";
      }
    }
    return title;
  }

  // No sentence ending found, truncate at 80 chars on word boundary
  if (cleaned.length <= 80) {
    return cleaned;
  }

  const truncated = cleaned.substring(0, 80);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 50) {
    return truncated.substring(0, lastSpace) + "...";
  }
  
  return truncated + "...";
}

/**
 * Calculate read time in minutes from text
 * Words are counted after removing URLs
 */
export function readTimeFromText(text: string): number {
  if (!text || typeof text !== "string") {
    return 1;
  }

  // Remove URLs
  const withoutUrls = text.replace(/https?:\/\/[^\s]+/gi, "").trim();
  
  // Count words (split on whitespace)
  const words = withoutUrls.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Calculate read time: ceil(words / 200)
  const readTime = Math.ceil(wordCount / 200);
  return Math.max(1, readTime); // At least 1 minute
}

/**
 * Clean story text (preserve original with URLs/mentions/hashtags)
 * Note: HTML escaping and \n → <br> conversion should be done in renderer
 */
export function cleanStory(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }
  
  // Return text as-is, renderer will handle display
  return text.trim();
}

/**
 * Normalize a tweet event to CardPost format
 */
export function normalizeTweetToCard(rawEvent: any, screenName?: string): CardPost {
  if (!rawEvent || !rawEvent.id_str) {
    throw new Error("Invalid tweet event: missing id_str");
  }

  const id = rawEvent.id_str;
  const text = rawEvent.text || rawEvent.full_text || "";
  const createdAt = rawEvent.created_at || new Date().toISOString();
  
  // Parse date if it's Twitter format
  let datePosted: string;
  if (createdAt.includes("+") || createdAt.includes(" GMT")) {
    // Twitter date format: parse and convert to ISO
    try {
      datePosted = new Date(createdAt).toISOString();
    } catch {
      datePosted = new Date().toISOString();
    }
  } else {
    datePosted = createdAt;
  }

  // Extract screen name from event or use provided
  const user = rawEvent.user || {};
  const name = screenName || user.screen_name || "unknown";
  
  const link = `https://x.com/${name}/status/${id}`;
  const image = extractImage(rawEvent);
  const postType = inferPostType(rawEvent);
  const title = toTitle(text);
  const story = cleanStory(text);
  const readTime = readTimeFromText(text);

  return {
    id,
    image,
    title,
    story,
    datePosted,
    link,
    postType,
    readTime,
  };
}

