/**
 * Type definitions for the feed system
 */

export type PostMediaType = 'image' | 'video';

export interface PostMedia {
  type: PostMediaType;
  url: string;
  ratio?: number; // width/height for aspect ratio
  thumbnail?: string;
}

export interface PostAuthor {
  name: string; // "Noteworthy News"
  handle: string; // "newsnoteworthy"
  avatarUrl: string; // site asset or CDN
  verified?: boolean;
}

export interface PostStats {
  views: number;
  likes: number;
  comments: number;
  reposts: number;
  bookmarks?: number;
}

export type PostSortMode = 'recent' | 'views' | 'likes' | 'comments' | 'reposts';

export interface Post {
  id: string;
  author: PostAuthor;
  createdAt: string; // ISO date string
  text: string;
  media?: PostMedia[];
  stats: PostStats;
  tags?: string[]; // hashtags, entities
  url?: string; // canonical link
  isPinned?: boolean;
}

/**
 * Raw post data from API (before mapping to Post)
 * This matches the current Netlify Blobs structure
 */
export interface RawPost {
  id: string;
  title?: string;
  story?: string;
  text?: string;
  datePosted?: string;
  createdAt?: string;
  created_at?: string;
  link?: string;
  url?: string;
  views?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
  comments?: number;
  bookmarks?: number;
  images?: string[];
  videos?: string[];
  image?: string | null;
  postType?: 'text' | 'photo' | 'video';
  tags?: string[];
  author?: string;
  authorUrl?: string;
  isPinned?: boolean;
}

/**
 * Mapper function to convert RawPost to Post
 */
export function mapRawPostToPost(raw: RawPost): Post {
  const author: PostAuthor = {
    name: raw.author || 'Noteworthy News',
    handle: 'newsnoteworthy',
    avatarUrl: '/IMG_5794.PNG',
    verified: false, // Could be added to raw data later
  };

  const createdAt = raw.datePosted || raw.createdAt || raw.created_at || new Date().toISOString();

  // Combine images and videos into media array
  const media: PostMedia[] = [];
  if (raw.images && raw.images.length > 0) {
    raw.images.forEach(url => {
      if (url) media.push({ type: 'image', url });
    });
  } else if (raw.image) {
    media.push({ type: 'image', url: raw.image });
  }
  if (raw.videos && raw.videos.length > 0) {
    raw.videos.forEach(url => {
      if (url) media.push({ type: 'video', url });
    });
  }

  const stats: PostStats = {
    views: raw.views ?? 0,
    likes: raw.likes ?? 0,
    comments: raw.replies ?? raw.comments ?? 0,
    reposts: raw.reposts ?? 0,
    bookmarks: raw.bookmarks,
  };

  return {
    id: raw.id,
    author,
    createdAt,
    text: raw.story || raw.text || raw.title || '',
    media: media.length > 0 ? media : undefined,
    stats,
    tags: raw.tags,
    url: raw.link || raw.url || `https://x.com/newsnoteworthy/status/${raw.id}`,
    isPinned: raw.isPinned,
  };
}

