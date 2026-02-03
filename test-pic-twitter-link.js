#!/usr/bin/env node
/**
 * Test fetching media from pic.twitter.com link
 */

const tweetUrl = 'https://x.com/newsnoteworthy/status/2017987199195623775';
const picLink = 'https://t.co/QcCKIK9CUa'; // From the tweet

async function testPicTwitterLink() {
    console.log('🔍 Testing pic.twitter.com link resolution...\n');
    
    try {
        // Try to fetch the pic.twitter.com link to see if it redirects to the actual image
        console.log('📡 Fetching:', picLink);
        const response = await fetch(picLink, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Response status:', response.status);
        console.log('📍 Final URL:', response.url);
        console.log('📄 Content-Type:', response.headers.get('content-type'));
        
        // Check if it's an image
        const contentType = response.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
            console.log('\n✅ Found image! URL:', response.url);
        } else {
            const html = await response.text();
            console.log('\n📄 HTML (first 500 chars):');
            console.log(html.substring(0, 500));
            
            // Try to find image URLs in the HTML
            const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            const images = [];
            let match;
            while ((match = imgRegex.exec(html)) !== null) {
                const url = match[1];
                if (url && (url.includes('pbs.twimg.com') || url.includes('media'))) {
                    images.push(url);
                }
            }
            
            if (images.length > 0) {
                console.log('\n🖼️  Images found in HTML:');
                images.forEach((img, i) => console.log(`   ${i + 1}. ${img}`));
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
    try {
        global.fetch = require('node-fetch');
    } catch (e) {
        console.error('❌ fetch is not available. Please install: npm install node-fetch');
        process.exit(1);
    }
}

testPicTwitterLink();
