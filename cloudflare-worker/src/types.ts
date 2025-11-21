/**
 * Type definitions for X Feed Worker
 */

export interface FeedPost {
  id: string;
  url: string;
  author: string;
  html: string;
  text: string;
  image: string;
  category: "Breaking" | "Developing" | "Update";
  created_at: number; // Unix timestamp in milliseconds
}

export interface TwitterOEmbed {
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

export interface AddPostRequest {
  url: string;
}

export interface Env {
  FEED: KVNamespace;
  ALLOWED_ORIGIN: string;
  RATE_LIMIT_PER_MINUTE: string;
  ADMIN_TOKEN: string;
}






