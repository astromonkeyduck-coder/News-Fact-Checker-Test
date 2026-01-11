#!/usr/bin/env node
/**
 * Manual trigger for ingest-all function
 * Usage: node trigger-ingest-all.js
 */

const siteUrl = process.env.URL || 'https://noteworthynews.co';
const ingestUrl = `${siteUrl}/.netlify/functions/ingest-all`;

console.log(`Triggering ingest-all at: ${ingestUrl}`);
console.log('This will fetch RSS feeds and populate live_events table...\n');

fetch(ingestUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
})
  .then(async (response) => {
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { raw: text };
    }
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(json, null, 2));
    
    if (json.rss_ingestion) {
      console.log('\n📊 RSS Ingestion Results:');
      console.log(`  Success: ${json.rss_ingestion.success}`);
      if (json.rss_ingestion.inserted) {
        console.log(`  Inserted: ${json.rss_ingestion.inserted}`);
      }
      if (json.rss_ingestion.updated) {
        console.log(`  Updated: ${json.rss_ingestion.updated}`);
      }
      if (json.rss_ingestion.skipped) {
        console.log(`  Skipped: ${json.rss_ingestion.skipped}`);
      }
      if (json.rss_ingestion.reason) {
        console.log(`  Reason: ${json.rss_ingestion.reason}`);
      }
    }
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
