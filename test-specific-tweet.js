#!/usr/bin/env node
/**
 * Test media extraction on a specific tweet
 */

const tweetUrl = 'https://x.com/newsnoteworthy/status/2017987199195623775';

async function testTweet() {
    console.log('🧪 Testing media extraction for:', tweetUrl);
    console.log('');
    
    try {
        // Fetch the tweet page
        const response = await fetch(tweetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        
        if (!response.ok) {
            console.log('❌ Failed to fetch tweet page:', response.status);
            return;
        }
        
        const html = await response.text();
        console.log(`✅ Fetched HTML (${html.length} chars)`);
        console.log('');
        
        // Look for media IDs
        console.log('🔍 Searching for media IDs...');
        
        // Pattern 1: Full pbs.twimg.com/media/{ID} URLs
        const pbsPattern = /pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)/gi;
        const pbsMatches = [...html.matchAll(pbsPattern)];
        if (pbsMatches.length > 0) {
            console.log(`✅ Found ${pbsMatches.length} pbs.twimg.com/media/ URLs:`);
            const uniqueIds = [...new Set(pbsMatches.map(m => m[1]))];
            uniqueIds.forEach((id, i) => {
                const url = `https://pbs.twimg.com/media/${id}?format=jpg&name=large`;
                console.log(`  ${i+1}. Media ID: ${id}`);
                console.log(`     URL: ${url}`);
            });
        } else {
            console.log('❌ No pbs.twimg.com/media/ URLs found');
        }
        
        // Pattern 2: Standalone media IDs (G_9r_6VWcAAess7 format)
        const mediaIdPattern = /\b([A-Z]_[A-Za-z0-9_-]{10,})\b/g;
        const idMatches = [...html.matchAll(mediaIdPattern)];
        if (idMatches.length > 0) {
            console.log(`\n✅ Found ${idMatches.length} potential media IDs:`);
            const uniqueIds = [...new Set(idMatches.map(m => m[1]))].slice(0, 10);
            uniqueIds.forEach((id, i) => {
                const url = `https://pbs.twimg.com/media/${id}?format=jpg&name=large`;
                console.log(`  ${i+1}. ID: ${id}`);
                console.log(`     URL: ${url}`);
            });
        } else {
            console.log('\n❌ No standalone media IDs found');
        }
        
        // Pattern 3: Look for pic.twitter.com links
        const picMatches = html.match(/pic\.twitter\.com\/([A-Za-z0-9]+)/gi);
        if (picMatches) {
            console.log(`\n✅ Found ${picMatches.length} pic.twitter.com links:`);
            picMatches.forEach((pic, i) => {
                console.log(`  ${i+1}. https://${pic}`);
            });
        }
        
        // Pattern 4: Look for t.co links
        const tcoMatches = html.match(/https?:\/\/t\.co\/[A-Za-z0-9]+/gi);
        if (tcoMatches) {
            console.log(`\n✅ Found ${tcoMatches.length} t.co links:`);
            [...new Set(tcoMatches)].slice(0, 5).forEach((tco, i) => {
                console.log(`  ${i+1}. ${tco}`);
            });
        }
        
        console.log('\n✅ Test complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

testTweet();
