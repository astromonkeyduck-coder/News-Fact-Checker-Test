#!/usr/bin/env node
/**
 * Update posts from CSV file (account analytics format)
 * Reads CSV data and updates posts via update-post-data API
 */

const fs = require('fs');
const path = require('path');

// Parse date string like "Sun, Nov 9, 2025" to ISO
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
  if (!str || str.trim() === '' || str === '-' || str === 'undefined' || str === '0') return undefined;
  return parseInt(str.replace(/,/g, ''), 10);
}

// API endpoint
const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/update-post-data';

async function updatePost(postData) {
  const postId = postData.id;
  const dateISO = parseDate(postData.date);
  
  if (!postId || postId === '' || postId === 'Post id') {
    return { success: false, skipped: true, reason: 'No post ID' };
  }
  
  if (!dateISO) {
    console.warn(`⚠ Skipping ${postId} - invalid date: ${postData.date}`);
    return { success: false, skipped: true, reason: 'Invalid date' };
  }
  
  const updatePayload = {
    postId: postId,
    datePosted: dateISO,
    views: postData.impressions,
    likes: postData.likes,
    reposts: postData.reposts,
    replies: postData.replies,
    engagements: postData.engagements,
    bookmarks: postData.bookmarks,
    shares: postData.shares,
  };
  
  // Remove undefined values to avoid sending null
  Object.keys(updatePayload).forEach(key => {
    if (updatePayload[key] === undefined) {
      delete updatePayload[key];
    }
  });
  
  try {
    const endpoint = API_ENDPOINT.includes('update-post-data') 
      ? API_ENDPOINT 
      : 'https://noteworthynews.co/.netlify/functions/update-post-data';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✓ Updated post ${postId}`);
    return { success: true, postId };
  } catch (error) {
    console.error(`✗ Error updating post ${postId}:`, error.message);
    return { success: false, postId, error: error.message };
  }
}

// Parse CSV data
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  const posts = [];
  let isFirstLine = true;
  
  for (const line of lines) {
    // Skip header row
    if (isFirstLine) {
      isFirstLine = false;
      if (line.toLowerCase().includes('post id') || line.toLowerCase().includes('date')) {
        console.log('📋 Skipping header row');
        continue;
      }
    }
    
    // Parse CSV line (handle quoted fields with commas)
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim()); // Add last part
    
    if (parts.length < 4) {
      console.warn(`⚠ Skipping malformed line: ${line.substring(0, 50)}...`);
      continue;
    }
    
    const postId = parts[0].trim();
    const date = parts[1].trim();
    
    // Skip if postId is "Post id" (header row got through)
    if (postId.toLowerCase() === 'post id' || date.toLowerCase() === 'date' || !postId) {
      continue;
    }
    
    const post = {
      id: postId,
      date: date,
      text: parts[2] ? parts[2].trim() : '',
      link: parts[3] ? parts[3].trim() : '',
      impressions: parseNumber(parts[4]),
      likes: parseNumber(parts[5]),
      engagements: parseNumber(parts[6]),
      bookmarks: parseNumber(parts[7]),
      shares: parseNumber(parts[8]),
      newFollows: parseNumber(parts[9]),
      replies: parseNumber(parts[10]),
      reposts: parseNumber(parts[11]),
    };
    
    if (post.id && post.date && post.id !== 'Post id' && post.date !== 'Date') {
      posts.push(post);
    }
  }
  
  return posts;
}

async function main() {
  // Read data from command line argument or default file
  const dataFile = process.argv[2] || 'account_analytics_content_2025-11-02_2025-11-09.csv';
  const dataPath = path.resolve(dataFile);
  
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Error: Data file not found at ${dataPath}`);
    console.log('\nUsage: node scripts/update-posts-from-csv.js [data-file.csv]');
    console.log('\nThe CSV file should have columns:');
    console.log('  Post id, Date, Post text, Post Link, Impressions, Likes, Engagements, Bookmarks, Shares, New follows, Replies, Reposts');
    process.exit(1);
  }
  
  console.log(`📖 Reading post data from ${dataPath}...\n`);
  const csvContent = fs.readFileSync(dataPath, 'utf8');
  const posts = parseCSV(csvContent);
  
  if (posts.length === 0) {
    console.error('❌ No valid posts found in data file');
    process.exit(1);
  }
  
  console.log(`📊 Found ${posts.length} posts to update\n`);
  console.log('🚀 Starting batch update...\n');
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };
  
  // Update posts one by one (with delay to avoid rate limiting)
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const result = await updatePost(post);
    
    if (result.success) {
      results.success++;
    } else if (result.skipped) {
      results.skipped++;
    } else {
      results.failed++;
    }
    
    // Small delay between requests (except for last one)
    if (i < posts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`\n📈 Progress: ${i + 1}/${posts.length} (${results.success} success, ${results.failed} failed, ${results.skipped} skipped)\n`);
    }
  }
  
  console.log('\n✅ Batch update complete!\n');
  console.log(`📊 Results:`);
  console.log(`   ✅ Success: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⚠ Skipped: ${results.skipped}`);
  console.log(`\n💡 Refresh your website to see the updated dates and stats!`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { updatePost, parseDate, parseNumber, parseCSV };

