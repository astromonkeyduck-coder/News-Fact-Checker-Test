#!/usr/bin/env node
/**
 * Batch Add Posts to Netlify Blobs
 * 
 * This script processes multiple tweet URLs in batches with rate limiting.
 * 
 * Usage:
 *   node scripts/batch-add-posts.js <tweet-urls-file.txt>
 * 
 * Or use the interactive version:
 *   node scripts/batch-add-posts.js
 * 
 * The tweet URLs file should have one URL per line:
 *   https://x.com/newsnoteworthy/status/1234567890
 *   https://x.com/newsnoteworthy/status/0987654321
 *   ...
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const API_ENDPOINT = process.env.NETLIFY_FUNCTION_URL || 'https://your-site.netlify.app/.netlify/functions/fetch-profile-tweets';
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const DELAY_ON_429 = 60000; // 60 seconds if rate limited
const BATCH_SIZE = 10; // Process in batches of 10
const PROGRESS_FILE = path.join(__dirname, '../.batch-progress.json');

/**
 * Load progress from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (err) {
    console.log('No existing progress file, starting fresh');
  }
  return { completed: [], failed: [], lastIndex: -1 };
}

/**
 * Save progress to file
 */
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Add a single post via API
 */
async function addPost(tweetUrl, index, total) {
  console.log(`[${index + 1}/${total}] Adding: ${tweetUrl}`);
  
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tweetUrl }),
    });

    if (response.status === 429) {
      console.warn(`  ⚠️  Rate limited (429). Waiting ${DELAY_ON_429 / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_ON_429));
      // Retry once after waiting
      const retryResponse = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweetUrl }),
      });
      
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(`HTTP ${retryResponse.status}: ${errorText}`);
      }
      
      const data = await retryResponse.json();
      console.log(`  ✓ Success (after retry)`);
      return { success: true, tweetUrl, data };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`  ✓ Success`);
    return { success: true, tweetUrl, data };
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return { success: false, tweetUrl, error: error.message };
  }
}

/**
 * Process all posts
 */
async function processPosts(tweetUrls) {
  const progress = loadProgress();
  const completedArray = Array.isArray(progress.completed) ? progress.completed : [];
  const alreadyCompleted = new Set(completedArray);
  
  // Filter out already completed URLs
  const toProcess = tweetUrls.filter(url => !alreadyCompleted.has(url));
  
  if (toProcess.length === 0) {
    console.log('All posts have already been processed!');
    return;
  }

  console.log(`\n📊 Processing ${toProcess.length} posts (${completedArray.length} already completed)`);
  console.log(`⏱️  Estimated time: ~${Math.ceil((toProcess.length * DELAY_BETWEEN_REQUESTS) / 60000)} minutes\n`);

  let completed = [...completedArray];
  let failed = Array.isArray(progress.failed) ? [...progress.failed] : [];
  let lastIndex = progress.lastIndex || -1;

  // Process in batches
  for (let i = 0; i < toProcess.length; i++) {
    const tweetUrl = toProcess[i];
    const globalIndex = tweetUrls.indexOf(tweetUrl);
    
    // Skip if we already processed up to this point
    if (globalIndex <= lastIndex) {
      continue;
    }

    const result = await addPost(tweetUrl, i, toProcess.length);
    
    if (result.success) {
      completed.push(tweetUrl);
    } else {
      failed.push({ url: tweetUrl, error: result.error });
    }

    // Save progress after each post
    saveProgress({
      completed,
      failed,
      lastIndex: globalIndex,
      total: tweetUrls.length,
      processed: completed.length + failed.length
    });

    // Delay before next request (except for last one)
    if (i < toProcess.length - 1) {
      process.stdout.write(`  ⏳ Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s before next post...\r`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
      process.stdout.write('                                    \r'); // Clear line
    }

    // Show progress every 10 posts
    if ((i + 1) % 10 === 0) {
      console.log(`\n📈 Progress: ${completed.length + failed.length}/${toProcess.length} (${completed.length} succeeded, ${failed.length} failed)\n`);
    }
  }

  console.log(`\n✅ Batch complete!`);
  console.log(`   ✓ Succeeded: ${completed.length}`);
  console.log(`   ✗ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed URLs saved to: ${PROGRESS_FILE}`);
  }
}

/**
 * Read URLs from file
 */
function readUrlsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('http') && line.includes('/status/'));
}

/**
 * Interactive mode: enter URLs one by one
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const urls = [];
  
  console.log('📝 Interactive Mode - Enter tweet URLs (one per line)');
  console.log('   Type "done" when finished, or "quit" to exit\n');

  return new Promise((resolve) => {
    rl.on('line', (input) => {
      const trimmed = input.trim();
      
      if (trimmed.toLowerCase() === 'done') {
        rl.close();
        resolve(urls);
        return;
      }
      
      if (trimmed.toLowerCase() === 'quit') {
        process.exit(0);
      }
      
      if (trimmed && trimmed.startsWith('http') && trimmed.includes('/status/')) {
        urls.push(trimmed);
        console.log(`  ✓ Added (${urls.length} total)`);
      } else if (trimmed) {
        console.log('  ⚠️  Invalid URL. Must start with http and contain /status/');
      }
    });
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  let tweetUrls = [];
  
  if (args.length > 0) {
    // Read from file
    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    tweetUrls = readUrlsFromFile(filePath);
    console.log(`📄 Loaded ${tweetUrls.length} URLs from file`);
  } else {
    // Interactive mode
    tweetUrls = await interactiveMode();
    
    if (tweetUrls.length === 0) {
      console.log('No URLs provided. Exiting.');
      process.exit(0);
    }
  }

  if (tweetUrls.length === 0) {
    console.error('❌ No valid tweet URLs found');
    process.exit(1);
  }

  // Check if we need to configure the endpoint
  if (API_ENDPOINT.includes('your-site.netlify.app')) {
    console.error('⚠️  Please set NETLIFY_FUNCTION_URL environment variable');
    console.error('   Example: export NETLIFY_FUNCTION_URL=https://your-site.netlify.app/.netlify/functions/fetch-profile-tweets');
    process.exit(1);
  }

  await processPosts(tweetUrls);
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

