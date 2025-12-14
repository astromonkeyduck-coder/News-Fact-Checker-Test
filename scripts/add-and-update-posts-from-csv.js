#!/usr/bin/env node
/**
 * Add new posts and update existing posts from CSV file
 * First adds posts via fetch-tweets-simple, then updates stats via update-post-data
 */

const fs = require('fs');
const path = require('path');

// Parse date string like "Sat, Dec 13, 2025" to ISO
function parseDate(dateStr) {
  try {
    if (!dateStr || dateStr.trim() === '') {
      return null;
    }
    
    // Handle format: "Sat, Dec 13, 2025" or "Sun, Nov 9, 2025"
    const dateMatch = dateStr.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d+)/);
    if (dateMatch) {
      const [, dayOfWeek, monthName, day, year] = dateMatch;
      
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = monthMap[monthName];
      if (month === undefined) {
        console.warn(`Invalid month name: ${monthName} in date ${dateStr}`);
        return null;
      }
      
      // Create date at noon UTC to avoid timezone issues
      const date = new Date(Date.UTC(parseInt(year), month, parseInt(day), 12, 0, 0));
      
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date: ${dateStr}`);
        return null;
      }
      
      return date.toISOString();
    }
    
    // Fallback to standard Date parsing
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

// Parse number string with commas
function parseNumber(str) {
  if (!str || str.trim() === '' || str === '-' || str === 'undefined' || str === '0') return undefined;
  return parseInt(str.replace(/,/g, ''), 10);
}

const ADD_POST_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/fetch-tweets-simple';
const UPDATE_POST_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/update-post-data';

async function addPost(tweetUrl) {
  try {
    const response = await fetch(ADD_POST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tweetUrl }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      // If post already exists, that's okay
      if (response.status === 200) {
        const result = await response.json();
        if (result.message && result.message.includes('already exists')) {
          return { success: true, alreadyExists: true };
        }
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    return { success: true, alreadyExists: false };
  } catch (error) {
    console.error(`✗ Error adding post ${tweetUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

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
    story: postData.text, // Add post text
    text: postData.text, // Add post text
    link: postData.link, // Add post link
    url: postData.link, // Add post URL
  };
  
  // Remove undefined values
  Object.keys(updatePayload).forEach(key => {
    if (updatePayload[key] === undefined) {
      delete updatePayload[key];
    }
  });
  
  try {
    const response = await fetch(UPDATE_POST_ENDPOINT, {
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
    
    // Skip if postId is "Post id" (header row got through) or empty
    if (postId.toLowerCase() === 'post id' || date.toLowerCase() === 'date' || !postId || !date) {
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
    
    if (post.id && post.date && post.link) {
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
    console.log('\nUsage: node scripts/add-and-update-posts-from-csv.js [data-file.csv]');
    process.exit(1);
  }
  
  console.log(`📖 Reading post data from ${dataPath}...\n`);
  const csvContent = fs.readFileSync(dataPath, 'utf8');
  const posts = parseCSV(csvContent);
  
  if (posts.length === 0) {
    console.error('❌ No valid posts found in data file');
    process.exit(1);
  }
  
  console.log(`📊 Found ${posts.length} posts to process\n`);
  console.log('🚀 Starting add/update process...\n');
  
  const results = {
    added: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
  };
  
  // Process posts one by one
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n[${i + 1}/${posts.length}] Processing post ${post.id}...`);
    
    // Step 1: Add post (if it doesn't exist)
    const addResult = await addPost(post.link);
    if (addResult.success) {
      if (addResult.alreadyExists) {
        console.log(`  ✓ Post already exists in storage`);
      } else {
        console.log(`  ✓ Added new post to storage`);
        results.added++;
      }
    } else {
      console.log(`  ⚠ Failed to add post: ${addResult.error}`);
      // Continue anyway - might still be able to update
    }
    
    // Small delay between add and update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 2: Update post stats
    const updateResult = await updatePost(post);
    if (updateResult.success) {
      console.log(`  ✓ Updated post stats`);
      results.updated++;
    } else if (updateResult.skipped) {
      console.log(`  ⚠ Skipped: ${updateResult.reason}`);
      results.skipped++;
    } else {
      console.log(`  ✗ Failed to update: ${updateResult.error}`);
      results.failed++;
    }
    
    // Small delay between requests (except for last one)
    if (i < posts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Progress indicator
    if ((i + 1) % 5 === 0) {
      console.log(`\n📈 Progress: ${i + 1}/${posts.length} (${results.added} added, ${results.updated} updated, ${results.failed} failed, ${results.skipped} skipped)\n`);
    }
  }
  
  console.log('\n✅ Batch process complete!\n');
  console.log(`📊 Results:`);
  console.log(`   ➕ Added: ${results.added}`);
  console.log(`   ✏️  Updated: ${results.updated}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⚠ Skipped: ${results.skipped}`);
  console.log(`\n💡 Refresh your website to see the new/updated posts!`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { addPost, updatePost, parseDate, parseNumber, parseCSV };

