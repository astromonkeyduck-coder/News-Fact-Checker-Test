#!/usr/bin/env node
/**
 * Add all posts from CSV to index, then rebuild index
 */

const fs = require('fs');
const path = require('path');

// Parse CSV to get all post IDs
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  const postIds = [];
  let isFirstLine = true;
  
  for (const line of lines) {
    if (isFirstLine) {
      isFirstLine = false;
      if (line.toLowerCase().includes('post id')) continue;
    }
    
    // Parse CSV line
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
    parts.push(current.trim());
    
    if (parts.length < 4) continue;
    
    const postId = parts[0].trim();
    if (postId && postId !== 'Post id' && postId !== '') {
      postIds.push(postId);
    }
  }
  
  return postIds;
}

async function addPostToIndex(postId) {
  try {
    const response = await fetch('https://noteworthynews.co/.netlify/functions/fetch-tweets-simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweetUrl: `https://x.com/newsnoteworthy/status/${postId}` })
    });
    const result = await response.json();
    return { success: response.ok, postId, result };
  } catch (error) {
    return { success: false, postId, error: error.message };
  }
}

async function main() {
  const csvFile = 'account_analytics_content_2025-11-02_2025-11-09.csv';
  const csvPath = path.resolve(csvFile);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  console.log('📖 Reading CSV file...\n');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const postIds = parseCSV(csvContent);
  
  // Also add the 8.2M post
  postIds.unshift('1923928821088108804');
  
  console.log(`📊 Found ${postIds.length} posts to add to index\n`);
  console.log('🚀 Adding posts to index...\n');
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < postIds.length; i++) {
    const postId = postIds[i];
    process.stdout.write(`[${i + 1}/${postIds.length}] Adding ${postId}... `);
    
    const result = await addPostToIndex(postId);
    if (result.success) {
      console.log('✓');
      success++;
    } else {
      console.log(`✗ (${result.error || 'failed'})`);
      failed++;
    }
    
    // Small delay
    if (i < postIds.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  console.log(`\n✅ Added ${success} posts, ${failed} failed\n`);
  console.log('🔄 Rebuilding index to prioritize high-performing posts...\n');
  
  // Rebuild index
  try {
    const rebuildResponse = await fetch('https://noteworthynews.co/.netlify/functions/rebuild-index', {
      method: 'POST'
    });
    const rebuildResult = await rebuildResponse.json();
    console.log('📊 Rebuild result:', rebuildResult);
  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
  }
  
  console.log('\n💡 All posts should now be in the index!');
}

main().catch(console.error);

