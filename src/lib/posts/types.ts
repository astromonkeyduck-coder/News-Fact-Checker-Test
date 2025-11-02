export type PostType = "text" | "photo" | "video";

export type CardPost = {
  id: string;
  image: string | null;
  images?: string[]; // Multiple images
  videos?: string[]; // Video URLs
  title: string;
  story: string;
  datePosted: string; // ISO
  link: string;
  postType: PostType;
  readTime: number; // minutes
  // Engagement stats
  views?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
  // Author info
  author?: string;
  authorUrl?: string;
};

