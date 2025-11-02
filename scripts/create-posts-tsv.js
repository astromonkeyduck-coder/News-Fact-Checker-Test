#!/usr/bin/env node
// Script to help create posts-data.tsv from user-provided data
// User can paste their data table and this will convert it to TSV format

console.log(`
📝 Create posts-data.tsv

Instructions:
1. Save your post data table (with tabs or spaces) to a file called 'raw-posts-data.txt'
2. Or paste it here and this script will format it

The data should have columns in this order:
Post id, Date, Post text, Post Link, Impressions, Likes, Engagements, Bookmarks, Shares, New follows, Replies, Reposts

Example format:
1923928821088108804	Sun, May 18, 2025	NEW: Video shows...	https://x.com/...	8,213,281	25,166	207,345	8,939	13,868	371	1,603	5,221
`);

const fs = require('fs');
const inputFile = process.argv[2] || 'raw-posts-data.txt';
const outputFile = 'posts-data.tsv';

if (fs.existsSync(inputFile)) {
  const content = fs.readFileSync(inputFile, 'utf8');
  // If already tab-separated, just use it
  if (content.includes('\t')) {
    fs.writeFileSync(outputFile, content);
    console.log(`✅ Created ${outputFile} from ${inputFile}`);
  } else {
    console.log('⚠️  Input file does not appear to be tab-separated');
  }
} else {
  console.log(`❌ Input file not found: ${inputFile}`);
  console.log(`💡 Create ${inputFile} with your post data, then run this script again`);
}
