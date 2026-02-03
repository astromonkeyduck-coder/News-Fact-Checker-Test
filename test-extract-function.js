#!/usr/bin/env node
/**
 * Test the actual extraction function
 */

// Import the extraction function (simplified version for testing)
async function extractTwitterMedia(tweetUrl) {
    const media = {
        images: [],
        videos: [],
    };

    try {
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
            console.warn(`Failed to fetch: ${response.status}`);
            return media;
        }

        const html = await response.text();
        console.log(`✅ Fetched HTML (${html.length} chars)\n`);
        
        // Try multiple extraction methods
        const results = {
            ogImage: null,
            twitterImage: null,
            pbsImages: [],
            videoUrls: [],
            jsonLdImages: [],
        };

        // Open Graph
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
        if (ogMatch) {
            results.ogImage = ogMatch[1];
        }

        // Twitter Card
        const twMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i);
        if (twMatch) {
            results.twitterImage = twMatch[1];
        }

        // pbs.twimg.com
        const pbsMatches = html.match(/https?:\/\/pbs\.twimg\.com\/media\/[^\s"']+/gi) || [];
        results.pbsImages = pbsMatches.filter(url => 
            !url.includes('profile_images') && 
            !url.includes('ext_tw_video_thumb')
        );

        // video.twimg.com
        results.videoUrls = html.match(/https?:\/\/video\.twimg\.com\/[^\s"']+/gi) || [];

        // JSON-LD
        const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["']>(.*?)<\/script>/gis);
        for (const match of jsonLdMatches) {
            try {
                const json = JSON.parse(match[1]);
                if (json.image) {
                    const img = Array.isArray(json.image) ? json.image[0] : json.image;
                    if (img && typeof img === 'string') {
                        results.jsonLdImages.push(img);
                    }
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }

        // Combine all images
        const allImages = [
            results.ogImage,
            results.twitterImage,
            ...results.pbsImages,
            ...results.jsonLdImages,
        ].filter(Boolean);

        media.images = [...new Set(allImages)];
        media.videos = [...new Set(results.videoUrls)];
        media.primary_image_url = media.images[0];
        media.video_url = media.videos[0];

        return media;
    } catch (error) {
        console.error('Error:', error.message);
        return media;
    }
}

// Test
const tweetUrl = 'https://x.com/newsnoteworthy/status/2017449907313930440';

console.log('🧪 Testing extraction function on:', tweetUrl, '\n');

if (typeof fetch === 'undefined') {
    try {
        global.fetch = require('node-fetch');
    } catch (e) {
        console.error('❌ Need node-fetch');
        process.exit(1);
    }
}

extractTwitterMedia(tweetUrl).then(result => {
    console.log('\n📊 Results:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.images.length > 0) {
        console.log('\n✅ Found images!');
    } else {
        console.log('\n⚠️  No images found');
        console.log('   This tweet may not have media, or Twitter is blocking extraction');
    }
});
