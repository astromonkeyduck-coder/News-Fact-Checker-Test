/**
 * Sorting utilities for posts
 */

import { Post, PostSortMode } from './types';

/**
 * Sort posts by most recent (newest first)
 * Falls back to createdAt desc for ties
 */
export function byRecent(a: Post, b: Post): number {
  const dateA = new Date(a.createdAt).getTime();
  const dateB = new Date(b.createdAt).getTime();
  
  if (dateB !== dateA) {
    return dateB - dateA; // Newer first
  }
  
  // Tie-breaker: compare IDs
  return b.id.localeCompare(a.id);
}

/**
 * Sort posts by most views
 * Falls back to createdAt desc for ties
 */
export function byViews(a: Post, b: Post): number {
  const viewsDiff = b.stats.views - a.stats.views;
  if (viewsDiff !== 0) return viewsDiff;
  return byRecent(a, b);
}

/**
 * Sort posts by most likes
 * Falls back to createdAt desc for ties
 */
export function byLikes(a: Post, b: Post): number {
  const likesDiff = b.stats.likes - a.stats.likes;
  if (likesDiff !== 0) return likesDiff;
  return byRecent(a, b);
}

/**
 * Sort posts by most comments
 * Falls back to createdAt desc for ties
 */
export function byComments(a: Post, b: Post): number {
  const commentsDiff = b.stats.comments - a.stats.comments;
  if (commentsDiff !== 0) return commentsDiff;
  return byRecent(a, b);
}

/**
 * Sort posts by most reposts
 * Falls back to createdAt desc for ties
 */
export function byReposts(a: Post, b: Post): number {
  const repostsDiff = b.stats.reposts - a.stats.reposts;
  if (repostsDiff !== 0) return repostsDiff;
  return byRecent(a, b);
}

/**
 * Get sort function for a given sort mode
 */
export function getSortFunction(mode: PostSortMode): (a: Post, b: Post) => number {
  switch (mode) {
    case 'recent':
      return byRecent;
    case 'views':
      return byViews;
    case 'likes':
      return byLikes;
    case 'comments':
      return byComments;
    case 'reposts':
      return byReposts;
    default:
      return byRecent;
  }
}

/**
 * Sort an array of posts
 */
export function sortPosts(posts: Post[], mode: PostSortMode): Post[] {
  const sorted = [...posts];
  sorted.sort(getSortFunction(mode));
  return sorted;
}

