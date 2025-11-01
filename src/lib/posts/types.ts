export type PostType = "text" | "photo" | "video";

export type CardPost = {
  id: string;
  image: string | null;
  title: string;
  story: string;
  datePosted: string; // ISO
  link: string;
  postType: PostType;
  readTime: number; // minutes
};

