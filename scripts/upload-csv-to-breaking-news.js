#!/usr/bin/env node
/**
 * Upload CSV file to process-csv-posts function to update breaking news cards
 * Usage: node scripts/upload-csv-to-breaking-news.js
 */

const fs = require('fs');
const path = require('path');

// Use node-fetch if available, otherwise try global fetch (Node 18+)
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    if (typeof globalThis.fetch === 'function') {
        fetch = globalThis.fetch;
    } else {
        throw new Error('fetch is not available. Please install node-fetch: npm install node-fetch');
    }
}

async function uploadCSV() {
    const csvPath = path.join(__dirname, '../account_analytics_content_2026-01-15_2026-02-01.csv');
    
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found: ${csvPath}`);
        process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('📤 Uploading CSV to process-csv-posts function...');
    console.log(`📄 File: ${csvPath}`);
    console.log(`📊 Size: ${(csvContent.length / 1024).toFixed(2)} KB`);
    
    // Create multipart form data manually
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const filename = 'account_analytics_content_2026-01-15_2026-02-01.csv';
    
    const formData = `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="csv"; filename="${filename}"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        csvContent +
        `\r\n--${boundary}--\r\n`;
    
    // Determine endpoint
    const endpoint = process.env.NETLIFY_FUNCTION_URL 
        ? `${process.env.NETLIFY_FUNCTION_URL}/.netlify/functions/process-csv-posts`
        : 'https://noteworthynews.co/.netlify/functions/process-csv-posts';
    
    console.log(`🌐 Endpoint: ${endpoint}`);
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('\n✅ Success!');
            console.log(`📊 Results:`);
            console.log(`   - Added: ${result.added || 0}`);
            console.log(`   - Updated: ${result.updated || 0}`);
            console.log(`   - Failed: ${result.failed || 0}`);
            console.log(`   - Skipped: ${result.skipped || 0}`);
            console.log(`   - Processed: ${result.processed || 0}`);
            
            if (result.message) {
                console.log(`\n💬 ${result.message}`);
            }
            
            if (result.remaining) {
                console.log(`\n⚠️  ${result.remaining} posts remaining. Run this script again to process the next batch.`);
            }
        } else {
            console.error('\n❌ Error:', result.error || 'Unknown error');
            if (result.details) {
                console.error('   Details:', result.details);
            }
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Failed to upload:', error.message);
        console.error('\n💡 Alternative: You can manually upload the CSV file using:');
        console.error('   1. Go to https://noteworthynews.co/.netlify/functions/process-csv-posts');
        console.error('   2. Use a tool like Postman or curl to POST the CSV file');
        console.error('   3. Or use the admin panel if available');
        process.exit(1);
    }
}

// Check if fetch is available
try {
    if (!fetch) {
        require('node-fetch');
    }
} catch (e) {
    console.error('❌ Missing dependencies. Please install:');
    console.error('   npm install node-fetch');
    console.error('\n💡 Or use Node.js 18+ which includes fetch natively');
    process.exit(1);
}

if (require.main === module) {
    uploadCSV();
}

module.exports = { uploadCSV };
