#!/usr/bin/env node
/**
 * Upload CSV file to process-csv-posts function to update breaking news cards
 *
 * Auth (one required):
 *   - ADMIN_ANALYTICS_TOKEN - same secret as Netlify env; sent as X-Admin-Token
 *   - NETLIFY_ADMIN_JWT - Auth0 access token (admin user), sent as Authorization: Bearer
 *
 * Loads .env from repo root when present (via dotenv).
 *
 * Usage:
 *   node scripts/upload-csv-to-breaking-news.js [path-to.csv]
 *   NETLIFY_FUNCTION_URL=http://localhost:8888 node scripts/upload-csv-to-breaking-news.js ./export.csv
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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
    const csvArg = process.argv[2];
    const csvFile = csvArg || 'account_analytics_content_2026-02-22_2026-03-23.csv';
    const csvPath = path.isAbsolute(csvFile) ? csvFile : path.join(__dirname, '..', csvFile);
    
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found: ${csvPath}`);
        console.error(`\n💡 Usage: node scripts/upload-csv-to-breaking-news.js [csv-filename]`);
        console.error(`   Example: node scripts/upload-csv-to-breaking-news.js account_analytics_content_2025-02-16_2026-02-16.csv`);
        process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('📤 Uploading CSV to process-csv-posts function...');
    console.log(`📄 File: ${csvPath}`);
    console.log(`📊 Size: ${(csvContent.length / 1024).toFixed(2)} KB`);
    
    // Create multipart form data manually
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    const filename = path.basename(csvFile);
    
    const formData = `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="csv"; filename="${filename}"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        csvContent +
        `\r\n--${boundary}--\r\n`;
    
    // Determine endpoint (NETLIFY_FUNCTION_URL = origin only, e.g. https://noteworthynews.co or http://localhost:8888)
    const base = (process.env.NETLIFY_FUNCTION_URL || 'https://noteworthynews.co').replace(/\/$/, '');
    const endpoint = `${base}/.netlify/functions/process-csv-posts`;

    const adminToken = process.env.ADMIN_ANALYTICS_TOKEN;
    let bearer = process.env.NETLIFY_ADMIN_JWT || process.env.AUTH0_ACCESS_TOKEN;
    if (bearer && /^Bearer\s+/i.test(bearer)) {
        bearer = bearer.replace(/^Bearer\s+/i, '');
    }

    if (!adminToken && !bearer) {
        console.error('❌ Missing auth: set ADMIN_ANALYTICS_TOKEN or NETLIFY_ADMIN_JWT in .env or the environment.');
        console.error('   (Netlify dashboard → Site settings → Environment variables → ADMIN_ANALYTICS_TOKEN)');
        process.exit(1);
    }

    const reqHeaders = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (bearer) {
        reqHeaders.Authorization = `Bearer ${bearer}`;
    }
    if (adminToken) {
        reqHeaders['X-Admin-Token'] = adminToken;
    }

    console.log(`🌐 Endpoint: ${endpoint}`);
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            headers: reqHeaders,
        });
        
        const text = await response.text();
        let result = {};
        try {
            result = text ? JSON.parse(text) : {};
        } catch (_) {
            console.error('\n❌ Non-JSON response:', text.slice(0, 500));
            process.exit(1);
        }
        
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
