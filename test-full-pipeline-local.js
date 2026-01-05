/**
 * Comprehensive Local Test Script
 * Tests the full earthquake image and video generation pipeline locally
 * Run with: node test-full-pipeline-local.js
 * 
 * Requires Supabase credentials in .env.local file:
 * SUPABASE_URL=your_url
 * SUPABASE_SERVICE_ROLE_KEY=your_key
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Copy of scrapeUSGSImagesFromPage function (to avoid Supabase dependency)
async function scrapeUSGSImagesFromPage(eventPageUrl) {
  if (!eventPageUrl) return [];
  
  try {
    console.log(`🌐 Scraping images from USGS event page: ${eventPageUrl}`);
    
    const response = await fetch(eventPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://earthquake.usgs.gov/'
      }
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch USGS event page (status: ${response.status})`);
      return [];
    }
    
    const html = await response.text();
    const images = [];
    const usedUrls = new Set();
    
    // Helper function to check if URL is definitely an image
    const isDefinitelyImageUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      const lowerUrl = url.toLowerCase();
      
      // MUST have image file extension
      if (!/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url)) {
        return false;
      }
      
      // Exclude known non-image file patterns
      if (lowerUrl.includes('.xml') || lowerUrl.includes('.json') || 
          lowerUrl.includes('.txt') || lowerUrl.includes('/contents') ||
          lowerUrl.includes('/metadata') || lowerUrl.includes('/attenuation') ||
          lowerUrl.includes('contents.xml') || lowerUrl.includes('attenuation_curves')) {
        return false;
      }
      
      return true;
    };
    
    // Pattern 1: <img src="..."> - MOST COMMON (IMPROVED: More aggressive)
    const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let imgCount = 0;
    while ((match = imgTagPattern.exec(html)) !== null && images.length < 10) { // Check more images
      const url = match[1];
      if (url && !usedUrls.has(url)) {
        // More flexible: Accept any image URL that could be from USGS
        const isUSGSImage = url.includes('usgs.gov') || url.includes('earthquake.usgs.gov') || 
                           url.includes('shakemap') || url.includes('intensity') || 
                           url.includes('realtime') || url.includes('product');
        const isImageFile = isDefinitelyImageUrl(url);
        
        if (isUSGSImage && isImageFile) {
          const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
          images.push({
            url: absoluteUrl,
            type: 'scraped-html-img',
            filename: `img-${++imgCount}`,
            scraped: true
          });
          usedUrls.add(absoluteUrl);
          console.log(`  ✅ Found image: ${absoluteUrl.substring(0, 100)}`);
        }
      }
    }
    
    // Pattern 2: Look for shakemap URLs in HTML (IMPROVED: More comprehensive)
    const shakemapUrlPattern = /https?:\/\/[^"'\s<>]+(?:usgs\.gov|earthquake\.usgs\.gov)[^"'\s<>]*(?:\/realtime\/product\/shakemap\/|shakemap|intensity|mmi|pga|pgv)[^"'\s<>]*/gi;
    while ((match = shakemapUrlPattern.exec(html)) !== null && images.length < 10) {
      const baseUrl = match[0].replace(/\/$/, ''); // Remove trailing slash
      // EXPANDED: More image types and variations
      const imageExtensions = [
        'intensity.jpg', 'pga.jpg', 'pgv.jpg', 'mmi.jpg', 'psa03.jpg', 'psa10.jpg', 'psa30.jpg',
        'intensity.png', 'pga.png', 'pgv.png', 'mmi.png', 'psa03.png', 'psa10.png', 'psa30.png',
        'intensity_km.jpg', 'pga_km.jpg', 'pgv_km.jpg',
        'download/intensity.jpg', 'download/pga.jpg', 'download/pgv.jpg', 'download/mmi.jpg',
        'download/intensity.png', 'download/pga.png', 'download/pgv.png', 'download/mmi.png'
      ];
      for (const ext of imageExtensions) {
        // Try multiple URL patterns
        const urlPatterns = [
          baseUrl + '/' + ext,
          baseUrl + '/download/' + ext,
          baseUrl.replace(/\/product\/shakemap\/[^\/]+$/, '/product/shakemap/' + ext),
          baseUrl + ext
        ];
        for (const url of urlPatterns) {
          if (!usedUrls.has(url) && isDefinitelyImageUrl(url)) {
            images.push({
              url: url,
              type: 'scraped-shakemap-constructed',
              filename: ext,
              scraped: true,
              constructed: true
            });
            usedUrls.add(url);
            console.log(`  ✅ Found constructed shakemap image: ${url.substring(0, 100)}`);
            if (images.length >= 10) break;
          }
        }
        if (images.length >= 10) break;
      }
      if (images.length >= 10) break;
    }
    
    // Pattern 3: Look for ANY USGS image URLs in the HTML (very permissive)
    const usgsImagePattern = /https?:\/\/[^"'\s<>]+(?:usgs\.gov|earthquake\.usgs\.gov)[^"'\s<>]*(?:shakemap|intensity|pga|pgv|mmi|map|plot|image|download)[^"'\s<>]*\.(png|jpg|jpeg|gif|webp)/gi;
    while ((match = usgsImagePattern.exec(html)) !== null && images.length < 10) {
      const url = match[0];
      if (url && !usedUrls.has(url) && isDefinitelyImageUrl(url)) {
        images.push({
          url: url,
          type: 'scraped-pattern-match',
          filename: 'scraped-pattern',
          scraped: true
        });
        usedUrls.add(url);
        console.log(`  ✅ Found image via pattern match: ${url.substring(0, 100)}`);
      }
    }
    
    // Pattern 4: Look for data-src, data-lazy-src (lazy-loaded images)
    const lazyPatterns = [
      /data-src=["']([^"']+\.(png|jpg|jpeg|gif|webp))["']/gi,
      /data-lazy-src=["']([^"']+\.(png|jpg|jpeg|gif|webp))["']/gi,
      /data-url=["']([^"']+\.(png|jpg|jpeg|gif|webp))["']/gi
    ];
    for (const pattern of lazyPatterns) {
      while ((match = pattern.exec(html)) !== null && images.length < 10) {
        const url = match[1];
        if (url && !usedUrls.has(url) && (url.includes('usgs.gov') || url.includes('earthquake.usgs.gov'))) {
          const absoluteUrl = url.startsWith('http') ? url : `https://earthquake.usgs.gov${url.startsWith('/') ? url : '/' + url}`;
          if (isDefinitelyImageUrl(absoluteUrl)) {
            images.push({
              url: absoluteUrl,
              type: 'scraped-lazy',
              filename: 'scraped-lazy',
              scraped: true
            });
            usedUrls.add(absoluteUrl);
            console.log(`  ✅ Found lazy-loaded image: ${absoluteUrl.substring(0, 100)}`);
          }
        }
      }
    }
    
    // Return up to 10 images (we'll validate and pick the best 2 later)
    console.log(`  📊 Total images found: ${images.length}`);
    if (images.length === 0) {
      console.log(`  ⚠️  No images found. This could mean:`);
      console.log(`     - Images aren't available yet (can take 5-10 minutes after earthquake)`);
      console.log(`     - The HTML structure changed`);
      console.log(`     - The earthquake is too small to have shakemaps`);
    }
    return images.slice(0, 10);
  } catch (error) {
    console.error(`❌ Error scraping USGS event page: ${error.message}`);
    return [];
  }
}

// Main test function
async function testFullPipeline() {
  console.log('🧪 Testing Full Earthquake Pipeline Locally\n');
  console.log('=' .repeat(60));
  
  // PHASE 7: Two test modes
  const TEST_MODE = process.env.TEST_MODE || 'A'; // A = known event with products, B = recent event without products
  
  let testData = {
    magnitude: 6.8,
    location: 'Los Angeles, California',
    eventId: null,
    detailUrl: null,
    coordinates: [-118.2437, 34.0522] // [lon, lat] - ALWAYS provide coordinates so location map is added
  };
  
  if (TEST_MODE === 'A') {
    // TEST MODE A: Known event with products
    console.log('\n📥 TEST MODE A: Using known event with products...');
    console.log('  🔍 Scanning recent events to find one with shakemap/dyfi products...');
    
    try {
      const usgsResponse = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/5.0_day.geojson');
      if (usgsResponse.ok) {
        const usgsData = await usgsResponse.json();
        if (usgsData.features && usgsData.features.length > 0) {
          // Scan events until we find one with products
          for (const feature of usgsData.features) {
            const props = feature.properties;
            const detailUrl = props.detail;
            
            if (detailUrl) {
              // Fetch detail to check for products
              const detailResponse = await fetch(detailUrl);
              if (detailResponse.ok) {
                const detailJson = await detailResponse.json();
                if (detailJson.properties && detailJson.properties.products) {
                  const products = detailJson.properties.products;
                  const hasShakemap = products.shakemap && products.shakemap.length > 0;
                  const hasDyfi = products.dyfi && products.dyfi.length > 0;
                  
                  if (hasShakemap || hasDyfi) {
                    let eventId = null;
                    if (props.ids) {
                      const idsArray = props.ids.split(',').filter(id => id && id.trim());
                      if (idsArray.length > 0) {
                        const fullEventId = idsArray[0].trim();
                        eventId = fullEventId.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/i, '');
                      }
                    }
                    
                    if (eventId) {
                      testData.magnitude = props.mag;
                      testData.location = props.place;
                      testData.eventId = eventId;
                      testData.detailUrl = detailUrl;
                      if (feature.geometry && feature.geometry.coordinates) {
                        testData.coordinates = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
                      }
                      
                      console.log(`  ✅ Found event with products: M${props.mag} near ${props.place}`);
                      console.log(`  Event ID: ${eventId}`);
                      console.log(`  Products: shakemap=${hasShakemap}, dyfi=${hasDyfi}`);
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Error scanning events: ${error.message}`);
    }
    
    if (!testData.eventId) {
      console.log('  ⚠️  No event with products found, using test data');
      console.log('  ⚠️  Testing coordinate validation: using event with MISMATCHED coordinates');
      // Use a known event ID but with LA coordinates to test validation
      testData.eventId = 'us7000rmhe'; // This event is NOT in Los Angeles
      testData.detailUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${testData.eventId}.geojson`;
      // Keep LA coordinates - validation should reject USGS images and use fallback maps
      console.log('  ⚠️  Event ID:', testData.eventId);
      console.log('  ⚠️  Test coordinates (LA):', testData.coordinates);
      console.log('  ⚠️  Validation should REJECT USGS images and use fallback maps');
    }
  } else {
    // TEST MODE B: Recent event without products
    console.log('\n📥 TEST MODE B: Using recent event (may not have products yet)...');
    
    try {
      const usgsResponse = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
      if (usgsResponse.ok) {
        const usgsData = await usgsResponse.json();
        if (usgsData.features && usgsData.features.length > 0) {
          const recentEarthquake = usgsData.features[0];
          const props = recentEarthquake.properties;
          
          let eventId = null;
          if (props.ids) {
            const idsArray = props.ids.split(',').filter(id => id && id.trim());
            if (idsArray.length > 0) {
              const fullEventId = idsArray[0].trim();
              eventId = fullEventId.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/i, '');
            }
          }
          
          if (eventId) {
            testData.magnitude = props.mag;
            testData.location = props.place;
            testData.eventId = eventId;
            testData.detailUrl = props.detail || null;
            if (recentEarthquake.geometry && recentEarthquake.geometry.coordinates) {
              testData.coordinates = [recentEarthquake.geometry.coordinates[0], recentEarthquake.geometry.coordinates[1]];
            }
            
            console.log(`  ✅ Found: M${props.mag} near ${props.place}`);
            console.log(`  Event ID: ${eventId}`);
            console.log(`  💡 This event may not have products yet (will test fallback maps)`);
          }
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Error fetching earthquake data: ${error.message}`);
    }
  }
  
  console.log('\n📊 Test Parameters:');
  console.log(`  Test Mode: ${TEST_MODE}`);
  console.log(`  Magnitude: ${testData.magnitude}`);
  console.log(`  Location: ${testData.location}`);
  console.log(`  Event ID: ${testData.eventId}`);
  console.log(`  Detail URL: ${testData.detailUrl || 'will be constructed from eventId'}`);
  console.log(`  Coordinates: [${testData.coordinates[0]}, ${testData.coordinates[1]}]`);
  
  // Step 3: Generate static image
  console.log('\n🖼️  Step 3: Generating static image...');
  try {
    const { generateImage } = require('./netlify/functions/generate-earthquake-image');
    
    // PHASE 7: Use new signature - pass eventId/detailUrl instead of usgsImages
    const detailUrl = testData.detailUrl || `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${testData.eventId}.geojson`;
    console.log(`  📡 Using eventId: ${testData.eventId}, detailUrl: ${detailUrl || 'auto'}`);
    const imageBuffer = await generateImage(
      testData.magnitude,
      testData.location,
      testData.eventId,
      'standard',
      testData.coordinates,
      detailUrl
    );
    
    const imagePath = path.join(__dirname, 'test-output-image.png');
    fs.writeFileSync(imagePath, imageBuffer);
    console.log(`  ✅ Static image saved: ${imagePath}`);
    console.log(`  Size: ${Math.round(imageBuffer.length / 1024)}KB`);
    
    // Open image automatically
    const platform = process.platform;
    const openCommand = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCommand} "${imagePath}"`, () => {});
    
  } catch (error) {
    console.error(`  ❌ Error generating static image: ${error.message}`);
    console.error(error.stack);
    return;
  }
  
  // Step 4: Generate video preview
  console.log('\n🎬 Step 4: Generating video preview (animated GIF)...');
  try {
    const videoModule = require('./netlify/functions/generate-earthquake-video');
    const generateVideoFrames = videoModule.generateVideoFrames;
    const framesToAnimatedGIF = videoModule.framesToAnimatedGIF;
    
    if (!generateVideoFrames || !framesToAnimatedGIF) {
      console.error('  ❌ Video generation functions not found in exports');
      console.error('  Available exports:', Object.keys(videoModule));
      throw new Error('Video generation functions not exported');
    }
    
    console.log('  🎬 Generating video frames...');
    console.log('  📍 Passing coordinates to video generation:', { 
      lat: testData.coordinates[1], 
      lon: testData.coordinates[0],
      coordinates: testData.coordinates 
    });
    // PHASE 7: Use new signature - pass eventId/detailUrl instead of usgsImages
    const videoDetailUrl = testData.detailUrl || `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${testData.eventId}.geojson`;
    const { frames, width, height } = await generateVideoFrames(
      testData.magnitude,
      testData.location,
      testData.eventId,
      testData.coordinates, // Pass as [lon, lat] array directly
      videoDetailUrl
    );
    
    console.log(`  ✅ Generated ${frames.length} frames (${width}x${height})`);
    
    console.log('  🎬 Converting frames to animated GIF...');
    const gifBuffer = await framesToAnimatedGIF(frames, width, height);
    
    const gifPath = path.join(__dirname, 'test-output-video.gif');
    fs.writeFileSync(gifPath, gifBuffer);
    console.log(`  ✅ Video preview (GIF) saved: ${gifPath}`);
    console.log(`  Size: ${Math.round(gifBuffer.length / 1024)}KB`);
    console.log(`  Duration: ${(frames.length / 15).toFixed(1)}s at ~15fps`);
    
    // Open GIF automatically
    const platform = process.platform;
    const openCommand = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCommand} "${gifPath}"`, () => {});
    
  } catch (error) {
    console.error(`  ❌ Error generating video preview: ${error.message}`);
    console.error(error.stack);
    console.log('\n  ⚠️  Video generation failed, but static image was successful');
    console.log('  💡 Note: GIF generation requires gifencoder library. Install with: npm install gifencoder canvas');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Complete!');
  console.log('\n📁 Output Files:');
  console.log('  - test-output-image.png (static image)');
  console.log('  - test-output-video.gif (animated preview)');
  console.log('\n💡 These files should automatically open in your default viewer.');
}

// Run the test
testFullPipeline().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});

