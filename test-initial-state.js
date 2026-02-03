#!/usr/bin/env node
/**
 * Test extracting media from __INITIAL_STATE__
 */

const fs = require('fs');
const html = fs.readFileSync('tweet-page-html.html', 'utf-8');

console.log('🔍 Extracting from __INITIAL_STATE__...\n');

// Extract __INITIAL_STATE__
const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
if (!match) {
    console.log('❌ No __INITIAL_STATE__ found');
    process.exit(1);
}

try {
    const state = JSON.parse(match[1]);
    const images = [];
    const videos = [];
    
    // Recursive search function
    function findMedia(obj, depth = 0) {
        if (depth > 15) return; // Prevent infinite recursion
        if (!obj || typeof obj !== 'object') return;
        
        if (Array.isArray(obj)) {
            obj.forEach(item => findMedia(item, depth + 1));
            return;
        }
        
        // Check for media_url_https
        if (obj.media_url_https && typeof obj.media_url_https === 'string') {
            const url = obj.media_url_https;
            if (url.includes('pbs.twimg.com') && !url.includes('profile_images')) {
                if (!images.includes(url)) {
                    images.push(url);
                    console.log('🖼️  Found image:', url);
                }
            }
        }
        
        // Check for video_info
        if (obj.video_info && obj.video_info.variants) {
            obj.video_info.variants.forEach(variant => {
                if (variant.url && !videos.includes(variant.url)) {
                    videos.push(variant.url);
                    console.log('🎥 Found video:', variant.url);
                }
            });
        }
        
        // Recursively search
        for (const key in obj) {
            if (key.includes('media') || key.includes('video') || key.includes('entities') || 
                key.includes('tweet') || key.includes('status')) {
                findMedia(obj[key], depth + 1);
            }
        }
    }
    
    findMedia(state);
    
    console.log(`\n✅ Found ${images.length} images and ${videos.length} videos`);
    
} catch (e) {
    console.error('❌ Error:', e.message);
    console.log('Trying to extract with regex instead...');
    
    // Fallback: regex extraction
    const mediaMatches = html.matchAll(/"media_url_https"\s*:\s*"([^"]+)"/g);
    for (const match of mediaMatches) {
        const url = match[1];
        if (url.includes('pbs.twimg.com') && !url.includes('profile_images')) {
            console.log('🖼️  Found (regex):', url);
        }
    }
}
