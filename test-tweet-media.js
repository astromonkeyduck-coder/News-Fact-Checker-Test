#!/usr/bin/env node
/**
 * Test fetching media from a specific Twitter/X post
 */

const tweetUrl = 'https://x.com/newsnoteworthy/status/2017987199195623775';

async function fetchTweetMedia() {
    console.log('🔍 Fetching media for tweet:', tweetUrl);
    console.log('\n📡 Fetching oEmbed data from Twitter...\n');
    
    try {
        // Use Twitter oEmbed API
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
        console.log('🌐 oEmbed URL:', oembedUrl);
        
        const response = await fetch(oembedUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const oembed = await response.json();
        
        console.log('✅ oEmbed data received');
        console.log('\n📦 Full oEmbed response:');
        console.log(JSON.stringify(oembed, null, 2));
        
        console.log('\n📄 oEmbed HTML (first 500 chars):');
        console.log(oembed.html?.substring(0, 500) || 'No HTML');
        
        // Extract images from HTML
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const images = [];
        let match;
        
        while ((match = imgRegex.exec(oembed.html || '')) !== null) {
            const url = match[1];
            // Filter out Twitter's own images (logos, icons, etc.)
            if (url && !url.includes('twitter.com/images') && !url.includes('abs.twimg.com/')) {
                // Only include actual media images
                if (url.includes('pbs.twimg.com') || url.includes('media')) {
                    images.push(url);
                }
            }
        }
        
        // Extract videos
        const videoRegex = /<video[^>]+src=["']([^"']+)["']/gi;
        const videos = [];
        while ((match = videoRegex.exec(oembed.html || '')) !== null) {
            videos.push(match[1]);
        }
        
        // Check for iframe embeds (X/Twitter video embeds)
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        while ((match = iframeRegex.exec(oembed.html || '')) !== null) {
            const url = match[1];
            if (url && url.includes('video')) {
                videos.push(url);
            }
        }
        
        console.log('\n🖼️  Images found:', images.length);
        images.forEach((img, i) => {
            console.log(`   ${i + 1}. ${img}`);
        });
        
        console.log('\n🎥 Videos found:', videos.length);
        videos.forEach((vid, i) => {
            console.log(`   ${i + 1}. ${vid}`);
        });
        
        if (images.length === 0 && videos.length === 0) {
            console.log('\n⚠️  No media found in oEmbed HTML');
            console.log('   This could mean:');
            console.log('   - The tweet has no media');
            console.log('   - Media is in a different format');
            console.log('   - Twitter oEmbed doesn\'t include media for this tweet');
        } else {
            console.log('\n✅ Media extraction successful!');
            console.log('\n📦 Post data structure:');
            const postData = {
                id: '2017987199195623775',
                text: oembed.html?.match(/<p[^>]*>(.*?)<\/p>/s)?.[1]?.replace(/<[^>]+>/g, '') || '',
                link: tweetUrl,
                images: images.length > 0 ? images : undefined,
                videos: videos.length > 0 ? videos : undefined,
                primary_image_url: images[0] || undefined
            };
            console.log(JSON.stringify(postData, null, 2));
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n💡 Alternative: The tweet might require authentication or have privacy restrictions');
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

fetchTweetMedia();
