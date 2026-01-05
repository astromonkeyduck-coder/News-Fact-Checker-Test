/**
 * Local test script for generate-earthquake-image function
 * Run with: node test-image-generation-local.js
 */

const path = require('path');

// Copy of extractUSGSImages function (to avoid Supabase dependency)
// STRICT VERSION: Only extracts actual image files (PNG/JPG/etc), excludes XML/JSON
function extractUSGSImages(eventDetail) {
  const images = [];
  const usedUrls = new Set();
  
  if (!eventDetail || !eventDetail.properties || !eventDetail.properties.products) {
    return images;
  }
  
  const products = eventDetail.properties.products;
  
  // STRICT: Must have actual image file extension
  const isImageKey = (key) => {
    const lowerKey = key.toLowerCase();
    // MUST have image extension - no exceptions
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(key)) {
      return false;
    }
    // Exclude known non-image files even if they have image-like extensions
    if (lowerKey.includes('.xml') || lowerKey.includes('.json') || 
        lowerKey.includes('.txt') || lowerKey.includes('contents') ||
        lowerKey.includes('metadata') || lowerKey.includes('attenuation')) {
      return false;
    }
    return true;
  };
  
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
  
  // Helper to construct shakemap image URLs
  const constructShakemapImageUrls = (product) => {
    const constructedUrls = [];
    if (!product || !product.id || !product.updateTime) return constructedUrls;
    
    const eventIdMatch = product.id.match(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)\d+/);
    if (!eventIdMatch) return constructedUrls;
    
    const eventId = eventIdMatch[0];
    const timestamp = product.updateTime;
    
    const imageTypes = ['intensity.jpg', 'pga.jpg', 'pgv.jpg', 'mmi.jpg', 
                        'intensity.png', 'pga.png', 'pgv.png', 'mmi.png'];
    const baseUrl = `https://earthquake.usgs.gov/realtime/product/shakemap/${eventId}/us/${timestamp}/download/`;
    
    for (const imageType of imageTypes) {
      const url = baseUrl + imageType;
      if (!usedUrls.has(url)) {
        constructedUrls.push({ url: url, type: 'shakemap-constructed', filename: imageType, constructed: true });
      }
    }
    return constructedUrls;
  };
  
  const extractFromProduct = (product, productType) => {
    if (!product) return false;
    let foundAny = false;
    
    if (product.contents && typeof product.contents === 'object') {
      for (const [key, content] of Object.entries(product.contents)) {
        if (!content || !content.url) continue;
        const url = content.url;
        if (usedUrls.has(url)) continue;
        
        // STRICT: Must be a real image file - check both URL and key
        const isImageUrl = isDefinitelyImageUrl(url) && isImageKey(key);
        
        if (isImageUrl) {
          images.push({ url: url, type: productType, filename: key });
          usedUrls.add(url);
          foundAny = true;
          if (images.length >= 2) return true;
        }
      }
    }
    return foundAny;
  };
  
  // Priority 1: Shakemap products
  const shakemapProducts = products.shakemap || [];
  for (const product of shakemapProducts) {
    if (extractFromProduct(product, 'shakemap')) {
      if (images.length >= 2) break;
    }
    
    // Try constructing shakemap URLs if we still need images
    if (images.length < 2) {
      const constructedUrls = constructShakemapImageUrls(product);
      for (const constructedImage of constructedUrls) {
        if (images.length >= 2) break;
        images.push(constructedImage);
        usedUrls.add(constructedImage.url);
      }
      if (images.length >= 2) break;
    }
  }
  
  // Priority 2: Other products
  if (images.length < 2) {
    for (const productType of Object.keys(products)) {
      if (images.length >= 2) break;
      if (productType === 'shakemap') continue;
      const productList = products[productType] || [];
      for (const product of productList) {
        if (extractFromProduct(product, productType)) break;
      }
    }
  }
  
  return images;
}

// Mock Netlify function handler
async function testImageGeneration() {
  console.log('🧪 Testing earthquake image generation locally...\n');
  
  // Import the generateImage function directly
  const { generateImage, storeImage } = require('./netlify/functions/generate-earthquake-image');
  
  // Test parameters
  let testData = {
    magnitude: 6.8,
    location: 'Los Angeles, California',
    eventId: 'test-local-' + Date.now(),
    usgsImages: [],
    coordinates: [-118.2437, 34.0522] // [lon, lat]
  };
  
  // Try to fetch real USGS images from a recent earthquake
  console.log('🔍 Attempting to fetch real USGS images from a recent earthquake...');
  let foundRealImages = false;
  try {
    // Fetch a recent significant earthquake (M5.0+ more likely to have shakemap images)
    const usgsResponse = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/5.0_day.geojson');
    if (usgsResponse.ok) {
      const usgsData = await usgsResponse.json();
      if (usgsData.features && usgsData.features.length > 0) {
        const recentEarthquake = usgsData.features[0];
        const props = recentEarthquake.properties;
        
        // Extract event ID from the ids field (format: ",us7000rmhe," or "us7000rmhe")
        let eventId = null;
        let fullEventId = null;
        if (props.ids) {
          const idsArray = props.ids.split(',').filter(id => id && id.trim());
          if (idsArray.length > 0) {
            fullEventId = idsArray[0].trim();
            // Remove prefix for detail endpoint (e.g., "us7000rmhe" -> "7000rmhe")
            eventId = fullEventId.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw)/i, '');
          }
        }
        if (!eventId && props.code) {
          fullEventId = props.code;
          eventId = props.code.replace(/^(us|ak|ci|nc|nn|pr|tx|hv|mb|se|uw):/i, '');
        }
        
        if (!eventId) {
          console.log(`⚠️  Could not extract event ID, using empty USGS images array`);
        } else {
          console.log(`📥 Found recent earthquake: M${props.mag} near ${props.place}`);
          console.log(`   Event ID: ${eventId} (full: ${fullEventId})`);
          
          // Try detail endpoint with just the ID (without prefix)
          let detailUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${eventId}.geojson`;
          console.log(`   Fetching detail from: ${detailUrl}`);
          let detailResponse = await fetch(detailUrl);
          
          // If that fails, try with the full ID
          if (!detailResponse.ok && fullEventId) {
            detailUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${fullEventId}.geojson`;
            console.log(`   Retrying with full ID: ${detailUrl}`);
            detailResponse = await fetch(detailUrl);
          }
          
          // If still fails, try using the detail URL from the feature itself
          if (!detailResponse.ok && props.detail) {
            detailUrl = props.detail;
            console.log(`   Retrying with detail URL from feature: ${detailUrl}`);
            detailResponse = await fetch(detailUrl);
          }
          
          if (detailResponse.ok) {
            const eventDetail = await detailResponse.json();
            const usgsImages = extractUSGSImages(eventDetail);
            
            if (usgsImages.length > 0) {
              console.log(`✅ Found ${usgsImages.length} USGS image(s) to use!`);
              testData.magnitude = props.mag;
              testData.location = props.place;
              testData.eventId = eventId || fullEventId;
              testData.usgsImages = usgsImages;
              foundRealImages = true;
              if (recentEarthquake.geometry && recentEarthquake.geometry.coordinates) {
                testData.coordinates = [recentEarthquake.geometry.coordinates[0], recentEarthquake.geometry.coordinates[1]];
              }
            } else {
              console.log(`⚠️  No USGS images found for this event`);
            }
          } else {
            const errorText = await detailResponse.text().catch(() => '');
            console.log(`⚠️  Could not fetch event detail (status: ${detailResponse.status}), using empty USGS images array`);
            if (errorText) {
              console.log(`   Error: ${errorText.substring(0, 200)}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(`⚠️  Error fetching USGS data: ${error.message}`);
  }
  
  // If no real images found, use test USGS image URLs to verify compositing works
  if (!foundRealImages) {
    console.log(`\n🧪 No real USGS images found. Using test USGS image URLs to verify compositing...`);
    // Use a known earthquake event ID that should have images, or construct test URLs
    // For testing, we'll use constructed shakemap URLs for a recent large earthquake
    const testEventId = 'us7000rmhe'; // Recent M5.4 earthquake
    const testTimestamp = '1767570926733'; // Approximate timestamp
    
    testData.usgsImages = [
      {
        url: `https://earthquake.usgs.gov/realtime/product/shakemap/${testEventId}/us/${testTimestamp}/download/intensity.jpg`,
        type: 'shakemap-constructed',
        filename: 'intensity.jpg',
        constructed: true
      },
      {
        url: `https://earthquake.usgs.gov/realtime/product/shakemap/${testEventId}/us/${testTimestamp}/download/pga.jpg`,
        type: 'shakemap-constructed',
        filename: 'pga.jpg',
        constructed: true
      }
    ];
    
    console.log(`   Using test URLs (these may not exist, but will test the download/compositing logic):`);
    testData.usgsImages.forEach((img, i) => {
      console.log(`   ${i + 1}. ${img.url}`);
    });
    console.log(`\n   Note: If these URLs don't exist, the test will show how the function handles missing images.\n`);
  }
  
  console.log('\n📥 Test parameters:', {
    ...testData,
    usgsImages: testData.usgsImages.map(img => ({ type: img.type, url: img.url?.substring(0, 80) + '...' }))
  });
  console.log('\n');
  
  try {
    console.log('🖼️  Generating image...');
    const imageBuffer = await generateImage(
      testData.magnitude,
      testData.location,
      testData.usgsImages,
      testData.eventId,
      'standard',
      testData.coordinates
    );
    
    console.log(`✅ Image generated successfully!`);
    console.log(`   Buffer size: ${Math.round(imageBuffer.length / 1024)}KB`);
    
    // Save to local file for inspection
    const fs = require('fs');
    const outputPath = path.join(__dirname, 'test-output-image.png');
    fs.writeFileSync(outputPath, imageBuffer);
    console.log(`💾 Image saved to: ${outputPath}`);
    
    // Automatically open the image file
    const { exec } = require('child_process');
    const platform = process.platform;
    let openCommand;
    
    if (platform === 'darwin') {
      openCommand = 'open';
    } else if (platform === 'win32') {
      openCommand = 'start';
    } else {
      openCommand = 'xdg-open';
    }
    
    exec(`${openCommand} "${outputPath}"`, (error) => {
      if (error) {
        console.log(`⚠️  Could not auto-open image: ${error.message}`);
        console.log(`   Please open manually: ${outputPath}`);
      } else {
        console.log(`🖼️  Image opened automatically!`);
      }
    });
    
    // Optionally try to store (will fail if env vars not set, but that's ok for local testing)
    try {
      const imageUrl = await storeImage(imageBuffer, testData.eventId, 'standard');
      console.log(`📤 Image URL: ${imageUrl}`);
    } catch (storeError) {
      console.log(`⚠️  Could not store image (expected in local env): ${storeError.message}`);
      console.log(`   Image saved locally instead at: ${outputPath}`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testImageGeneration();

