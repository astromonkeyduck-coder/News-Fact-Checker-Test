/**
 * Re-extract media for posts from the CSV file
 * This will call fetch-tweets-simple for each post to extract media
 */

const fs = require('fs');
const path = require('path');

// Parse CSV to get post links
function parseCSV(csvPath) {
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvText.split('\n').filter(l => l.trim());
  const posts = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '') continue;
    
    // Parse CSV line (handle quoted fields)
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
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
    const postLink = parts[3] ? parts[3].trim() : '';
    
    // Skip invalid rows
    if (!postId || postId === 'Post id' || !postLink || postLink.includes('undefined')) {
      continue;
    }
    
    // Only process if it's a valid tweet URL
    if (postLink.includes('x.com') || postLink.includes('twitter.com')) {
      posts.push({
        id: postId,
        link: postLink
      });
    }
  }
  
  return posts;
}

async function reExtractMedia() {
  const csvPath = path.join(__dirname, '../account_analytics_content_2026-01-15_2026-02-01.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath);
    process.exit(1);
  }
  
  console.log('📊 Parsing CSV file...');
  const posts = parseCSV(csvPath);
  console.log(`✅ Found ${posts.length} posts to process\n`);
  
  const fetchUrl = process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co/.netlify/functions/fetch-tweets-simple';
  
  const results = {
    processed: 0,
    success: 0,
    failed: 0,
    errors: []
  };
  
  // Process each post
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`[${i + 1}/${posts.length}] Processing ${post.id}...`);
    console.log(`   URL: ${post.link}`);
    
    try {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl: post.link }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ Failed: ${response.status} ${errorText.substring(0, 100)}`);
        results.failed++;
        results.errors.push({ postId: post.id, error: `HTTP ${response.status}` });
      } else {
        const result = await response.json();
        console.log(`   ✅ Success - Media extraction triggered`);
        results.success++;
      }
      
      results.processed++;
      
      // Rate limit: wait 500ms between requests
      if (i < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ postId: post.id, error: error.message });
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Processed: ${results.processed}`);
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.postId}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Done! Posts should now have media extracted.');
  console.log('Note: It may take a few minutes for media to appear on the site.');
}

// Run if called directly
if (require.main === module) {
  reExtractMedia().catch(console.error);
}

module.exports = { reExtractMedia, parseCSV };
