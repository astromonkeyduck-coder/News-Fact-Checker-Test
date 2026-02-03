#!/usr/bin/env node
/**
 * Test the Xiri-style media extraction method
 * This replicates how Discord bots extract Twitter media
 */

const tweetUrl = 'https://x.com/newsnoteworthy/status/2017449907313930440';

async function testXiriMethod() {
    console.log('🔍 Testing Xiri-style media extraction for:', tweetUrl);
    console.log('\n📡 Fetching tweet page HTML (like Discord bots do)...\n');
    
    try {
        // Fetch the tweet page with proper browser headers
        const response = await fetch(tweetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://x.com/',
            },
            redirect: 'follow',
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`✅ Fetched HTML (${html.length} characters)\n`);
        
        // Save HTML to file for inspection
        const fs = require('fs');
        fs.writeFileSync('tweet-page-html.html', html);
        console.log('💾 Saved HTML to tweet-page-html.html for inspection\n');
        
        // Extract Open Graph image (multiple patterns)
        const ogImagePatterns = [
            /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
        ];
        for (const pattern of ogImagePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                console.log('🖼️  Open Graph Image:', match[1]);
                break;
            }
        }
        
        // Extract Twitter Card image (multiple patterns)
        const twitterImagePatterns = [
            /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
            /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
        ];
        for (const pattern of twitterImagePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                console.log('🖼️  Twitter Card Image:', match[1]);
                break;
            }
        }
        
        // Extract pbs.twimg.com URLs
        const pbsMatches = html.match(/https?:\/\/pbs\.twimg\.com\/media\/[^\s"']+/gi);
        if (pbsMatches) {
            console.log('\n📸 Found pbs.twimg.com images:');
            pbsMatches.forEach((url, i) => {
                if (!url.includes('profile_images') && !url.includes('ext_tw_video_thumb')) {
                    console.log(`   ${i + 1}. ${url}`);
                }
            });
        }
        
        // Extract video URLs
        const videoMatches = html.match(/https?:\/\/video\.twimg\.com\/[^\s"']+/gi);
        if (videoMatches) {
            console.log('\n🎥 Found video.twimg.com videos:');
            videoMatches.forEach((url, i) => {
                console.log(`   ${i + 1}. ${url}`);
            });
        }
        
        // Check for JSON-LD data
        const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["']>(.*?)<\/script>/gis);
        for (const match of jsonLdMatches) {
            try {
                const jsonData = JSON.parse(match[1]);
                if (jsonData.image) {
                    console.log('\n📦 JSON-LD Image:', jsonData.image);
                }
            } catch (e) {
                // Invalid JSON
            }
        }
        
        console.log('\n✅ Extraction complete!');
        
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

testXiriMethod();
