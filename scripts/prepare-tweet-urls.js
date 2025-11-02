#!/usr/bin/env node
/**
 * Helper script to convert tweet IDs or mixed content into proper tweet URLs
 * 
 * Usage:
 *   node scripts/prepare-tweet-urls.js <input-file> <output-file>
 * 
 * The input file can contain:
 * - Full URLs: https://x.com/newsnoteworthy/status/1234567890
 * - Just IDs: 1234567890
 * - Mixed content (will extract IDs and convert to URLs)
 */

const fs = require('fs');
const path = require('path');

function extractTweetId(line) {
  // Try to extract ID from URL
  const urlMatch = line.match(/\/status\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // Try to find standalone numeric ID (17-19 digits, typical tweet ID length)
  const idMatch = line.match(/\b(\d{17,19})\b/);
  if (idMatch) {
    return idMatch[1];
  }
  
  return null;
}

function processFile(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, 'utf8');
  const lines = content.split('\n');
  
  const tweetIds = new Set();
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    const tweetId = extractTweetId(trimmed);
    if (tweetId) {
      tweetIds.add(tweetId);
    }
  }
  
  // Convert to URLs
  const urls = Array.from(tweetIds)
    .map(id => `https://x.com/newsnoteworthy/status/${id}`)
    .sort();
  
  // Write to output file
  fs.writeFileSync(outputPath, urls.join('\n') + '\n');
  
  console.log(`✅ Processed ${lines.length} lines`);
  console.log(`✅ Found ${tweetIds.size} unique tweet IDs`);
  console.log(`✅ Created ${outputPath} with ${urls.length} URLs`);
  console.log(`\nFirst 5 URLs:`);
  urls.slice(0, 5).forEach(url => console.log(`  ${url}`));
  
  if (urls.length > 5) {
    console.log(`  ... and ${urls.length - 5} more`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node scripts/prepare-tweet-urls.js <input-file> [output-file]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/prepare-tweet-urls.js my-tweets.txt tweet-urls.txt');
  console.log('  node scripts/prepare-tweet-urls.js raw-content.txt');
  console.log('');
  process.exit(1);
}

const inputFile = path.resolve(args[0]);
const outputFile = args[1] 
  ? path.resolve(args[1])
  : path.join(path.dirname(inputFile), 'tweet-urls.txt');

processFile(inputFile, outputFile);

