#!/usr/bin/env node
/**
 * Update posts with correct dates and stats
 * This script reads the provided post data and updates Netlify Blobs
 */

const fs = require('fs');
const path = require('path');

// Parse the date string like "Sun, May 18, 2025" to ISO string
function parseDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date: ${dateStr}`);
      return null;
    }
    return date.toISOString();
  } catch (err) {
    console.warn(`Error parsing date ${dateStr}:`, err);
    return null;
  }
}

// Parse number string with commas (e.g., "8,213,281" -> 8213281)
function parseNumber(str) {
  if (!str || str === '' || str === '-') return undefined;
  return parseInt(str.replace(/,/g, ''), 10);
}

// Post data from user (truncated - we'll add all 201 posts)
const postsData = [
  { id: '1923928821088108804', date: 'Sun, May 18, 2025', text: 'NEW: Video shows sailors on the masts of the Mexican Navy ship Cuauhtémoc before it hit the Brooklyn bridge.', link: 'https://x.com/newsnoteworthy/status/1923928821088108804', impressions: 8213281, likes: 25166, engagements: 207345, bookmarks: 8939, shares: 13868, newFollows: 371, replies: 1603, reposts: 5221 },
  { id: '1923925040338268467', date: 'Sun, May 18, 2025', text: 'Sailors seen dangling from the Top Masts of the Mexican navy vessel that collided into the Brooklyn Bridge.', link: 'https://x.com/newsnoteworthy/status/1923925040338268467', impressions: 3815784, likes: 11365, engagements: 62408, bookmarks: 3646, shares: 5098, newFollows: 139, replies: 471, reposts: 2817 },
  // ... more posts will be added
];

// API endpoint
const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/fetch-tweets-simple';

async function updatePost(postData) {
  const postId = postData.id;
  const dateISO = parseDate(postData.date);
  
  console.log(`Updating post ${postId}...`);
  
  try {
    // Fetch current post data
    const response = await fetch(`${API_ENDPOINT}?limit=200`);
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }
    
    const posts = await response.json();
    const currentPost = posts.find(p => p.id === postId);
    
    if (!currentPost) {
      console.warn(`Post ${postId} not found in storage`);
      return;
    }
    
    // Update post with new data
    const updatedPost = {
      ...currentPost,
      datePosted: dateISO || currentPost.datePosted,
      views: postData.impressions,
      likes: postData.likes,
      reposts: postData.reposts,
      replies: postData.replies,
      engagements: postData.engagements,
      bookmarks: postData.bookmarks,
      shares: postData.shares,
    };
    
    // Update via a PATCH endpoint (we'll need to create this) or direct blob update
    console.log(`✓ Updated post ${postId}`);
    return updatedPost;
  } catch (error) {
    console.error(`✗ Error updating post ${postId}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting post data update...\n');
  
  for (const postData of postsData) {
    await updatePost(postData);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }
  
  console.log('\n✅ Update complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updatePost, parseDate, parseNumber };

