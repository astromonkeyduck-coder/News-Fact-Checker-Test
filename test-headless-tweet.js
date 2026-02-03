#!/usr/bin/env node
/**
 * Test headless browser extraction on specific tweet
 */

const tweetUrl = 'https://x.com/newsnoteworthy/status/2017987199195623775';

async function test() {
    console.log('🧪 Testing headless browser extraction');
    console.log('Tweet:', tweetUrl);
    console.log('');
    
    try {
        // Import Puppeteer directly
        const puppeteer = require('puppeteer');
        
        console.log('🚀 Launching headless browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });
        
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            
            console.log('📡 Navigating to tweet...');
            await page.goto(tweetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 10000,
            });
            
            console.log('⏳ Waiting for JavaScript to execute...');
            await page.waitForTimeout(3000);
            
            console.log('🔍 Extracting media from rendered DOM...');
            const media = await page.evaluate(() => {
                const images = [];
                const videos = [];
                const seen = new Set();
                
                // Find all img elements
                const imgs = Array.from(document.querySelectorAll('img'));
                for (const img of imgs) {
                    const src = img.src || img.getAttribute('src');
                    if (src && src.includes('pbs.twimg.com/media')) {
                        const match = src.match(/pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)/);
                        if (match) {
                            const mediaId = match[1];
                            const fullUrl = `https://pbs.twimg.com/media/${mediaId}?format=jpg&name=large`;
                            if (!seen.has(fullUrl)) {
                                images.push(fullUrl);
                                seen.add(fullUrl);
                            }
                        } else if (!seen.has(src)) {
                            images.push(src);
                            seen.add(src);
                        }
                    }
                }
                
                // Find video elements
                const videosEl = Array.from(document.querySelectorAll('video'));
                for (const video of videosEl) {
                    const src = video.src || video.getAttribute('src');
                    if (src && !seen.has(src)) {
                        videos.push(src);
                        seen.add(src);
                    }
                }
                
                return { images, videos };
            });
            
            console.log('\n📊 Results:');
            console.log(JSON.stringify(media, null, 2));
            console.log('');
            
            if (media.images.length > 0) {
                console.log('✅ SUCCESS! Found', media.images.length, 'images:');
                media.images.forEach((img, i) => console.log(`  ${i+1}. ${img}`));
            } else {
                console.log('❌ No images found');
                console.log('   This tweet may not have media, or media is loaded differently');
            }
            
            if (media.videos.length > 0) {
                console.log('✅ Found', media.videos.length, 'videos:');
                media.videos.forEach((vid, i) => console.log(`  ${i+1}. ${vid}`));
            }
            
        } finally {
            await browser.close();
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

test();
