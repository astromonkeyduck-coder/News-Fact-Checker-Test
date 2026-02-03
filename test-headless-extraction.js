#!/usr/bin/env node
/**
 * Test headless browser extraction
 */

const tweetUrl = 'https://x.com/newsnoteworthy/status/2017987199195623775';

async function testHeadless() {
    console.log('🧪 Testing headless browser extraction for:', tweetUrl);
    console.log('');
    
    try {
        // Import the headless extraction function
        // Note: In production, Netlify compiles TypeScript automatically
        // For local testing, we need to use ts-node or compile first
        let extractTwitterMediaHeadless;
        try {
            // Try compiled version first
            extractTwitterMediaHeadless = require('./src/lib/posts/twitter-media-extract-headless.js').extractTwitterMediaHeadless;
        } catch (e) {
            // Try TypeScript with ts-node
            require('ts-node/register');
            const module = require('./src/lib/posts/twitter-media-extract-headless.ts');
            extractTwitterMediaHeadless = module.extractTwitterMediaHeadless;
        }
        
        console.log('🚀 Launching headless browser...');
        const media = await extractTwitterMediaHeadless(tweetUrl);
        
        console.log('\n📊 Results:');
        console.log(JSON.stringify(media, null, 2));
        console.log('');
        
        if (media.images.length > 0) {
            console.log('✅ SUCCESS! Found', media.images.length, 'images:');
            media.images.forEach((img, i) => console.log(`  ${i+1}. ${img}`));
        } else {
            console.log('❌ No images found');
        }
        
        if (media.videos.length > 0) {
            console.log('✅ Found', media.videos.length, 'videos:');
            media.videos.forEach((vid, i) => console.log(`  ${i+1}. ${vid}`));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('Cannot find module')) {
            console.log('\n💡 Tip: Run "npm install puppeteer" to install Puppeteer');
        }
    }
}

testHeadless();
