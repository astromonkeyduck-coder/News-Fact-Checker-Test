/**
 * Test USGS image extraction and compositing
 * Tests that USGS images are properly extracted and added to the generated image
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

// Use the same extraction logic as the poller (ensures different images)
function extractUSGSImages(eventDetail) {
  const images = [];
  const usedProductTypes = new Set(); // Track which product types we've used
  const usedFilenames = new Set(); // Track filenames to avoid duplicates
  
  if (!eventDetail || !eventDetail.properties || !eventDetail.properties.products) {
    return images;
  }
  
  const products = eventDetail.properties.products;
  
  // Priority 1: Immediate products (DYFI, basic maps) - available within 0-3 minutes
  const immediateProductTypes = ['dyfi', 'origin', 'location', 'moment-tensor'];
  
  // Priority 2: Shakemap products - available within 5-10 minutes (best quality)
  const shakemapProducts = products.shakemap || [];
  
  // Priority 3: All other products (fallback)
  const otherProductTypes = Object.keys(products)
    .filter(key => !immediateProductTypes.includes(key) && key !== 'shakemap');
  
  // Strategy: Try to get one image from each product type to ensure they're different
  // First pass: Get one image from each immediate product type
  for (const productType of immediateProductTypes) {
    if (images.length >= 2) break;
    
    const productList = products[productType] || [];
    for (const product of productList) {
      if (images.length >= 2) break;
      
      if (product.contents && typeof product.contents === 'object') {
        for (const [key, content] of Object.entries(product.contents)) {
          if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
              // Skip if we already have an image from this product type (unless we only have 1 image)
            if (images.length === 0 || !usedProductTypes.has(productType)) {
              // Extract base filename (remove common variants like _geo, _geo_, etc.)
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              
              // Also check if any existing image has a similar base name
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                return existingBase === baseFilename || 
                       (baseFilename.includes(existingBase.split('_')[0]) && 
                        existingBase.includes(baseFilename.split('_')[0]));
              });
              
              if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
                usedProductTypes.add(productType);
                usedFilenames.add(baseFilename);
                break; // Move to next product type
              }
            }
          }
        }
      }
    }
  }
  
  // Second pass: If we only have 1 image, try to get a shakemap (different type)
  if (images.length < 2) {
    for (const product of shakemapProducts) {
      if (images.length >= 2) break;
      
      if (product.contents && typeof product.contents === 'object') {
        for (const [key, content] of Object.entries(product.contents)) {
          if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
            let baseFilename = key
              .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
              .replace(/_geo_/gi, '_')
              .replace(/_(geo|map|plot|image)\./gi, '.')
              .toLowerCase();
            
            const isSimilar = images.some(img => {
              const existingBase = img.filename
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              return existingBase === baseFilename || 
                     (baseFilename.includes(existingBase.split('_')[0]) && 
                      existingBase.includes(baseFilename.split('_')[0]));
            });
            
            if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
              images.push({
                url: content.url,
                type: 'shakemap',
                filename: key,
              });
              usedProductTypes.add('shakemap');
              usedFilenames.add(baseFilename);
              if (images.length >= 2) break;
            }
          }
        }
      }
    }
  }
  
  // Third pass: If we still don't have 2, look in other products (ensuring different types)
  if (images.length < 2) {
    for (const productType of otherProductTypes) {
      if (images.length >= 2) break;
      
      // Skip if we already have an image from this product type
      if (usedProductTypes.has(productType)) continue;
      
      const productList = products[productType] || [];
      for (const product of productList) {
        if (images.length >= 2) break;
        
        if (product.contents && typeof product.contents === 'object') {
          for (const [key, content] of Object.entries(product.contents)) {
            if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                return existingBase === baseFilename || 
                       (baseFilename.includes(existingBase.split('_')[0]) && 
                        existingBase.includes(baseFilename.split('_')[0]));
              });
              
              if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
                usedProductTypes.add(productType);
                usedFilenames.add(baseFilename);
                break;
              }
            }
          }
        }
      }
    }
  }
  
  // Final fallback: If we still only have 1 image, get a second one even if from same type
  // (but still avoid duplicate filenames)
  if (images.length === 1) {
    for (const productType of immediateProductTypes) {
      const productList = products[productType] || [];
      for (const product of productList) {
        if (images.length >= 2) break;
        
        if (product.contents && typeof product.contents === 'object') {
          for (const [key, content] of Object.entries(product.contents)) {
            if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                .replace(/_geo_/gi, '_')
                .replace(/_(geo|map|plot|image)\./gi, '.')
                .toLowerCase();
              
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                return existingBase === baseFilename || 
                       (baseFilename.includes(existingBase.split('_')[0]) && 
                        existingBase.includes(baseFilename.split('_')[0]));
              });
              
              if (!isSimilar && !usedFilenames.has(baseFilename) && !images.find(img => img.url === content.url)) {
                images.push({
                  url: content.url,
                  type: productType,
                  filename: key,
                });
                usedFilenames.add(baseFilename);
                break;
              }
            }
          }
        }
      }
    }
  }
  
  return images.slice(0, 2); // Return max 2 images
}

async function fetchEventDetail(detailUrl) {
  try {
    const response = await fetch(detailUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch event detail: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching event detail:`, error);
    return null;
  }
}

async function fetchRecentLargeEarthquake() {
  // Try significant earthquakes first (more likely to have images)
  const feeds = [
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
  ];
  
  for (const feedUrl of feeds) {
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        // Find largest magnitude
        const sorted = data.features.sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0));
        return sorted[0];
      }
    } catch (error) {
      console.error(`Error fetching ${feedUrl}:`, error);
    }
  }
  
  throw new Error('No earthquakes found');
}

async function main() {
  console.log('🧪 Testing USGS Image Extraction & Compositing\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Fetch a real earthquake
    console.log('🔍 Fetching recent earthquake from USGS...\n');
    const earthquake = await fetchRecentLargeEarthquake();
    
    const eventId = earthquake.id;
    const magnitude = earthquake.properties.mag;
    const place = earthquake.properties.place;
    const detailUrl = earthquake.properties.detail;
    
    console.log(`   Event ID: ${eventId}`);
    console.log(`   Magnitude: M${magnitude}`);
    console.log(`   Location: ${place}\n`);
    
    // Step 2: Fetch event detail and extract USGS images
    let usgsImages = [];
    if (detailUrl) {
      console.log('🔍 Fetching event details for USGS images...\n');
      const eventDetail = await fetchEventDetail(detailUrl);
      if (eventDetail) {
        usgsImages = extractUSGSImages(eventDetail);
        console.log(`   Found ${usgsImages.length} USGS image(s)`);
        usgsImages.forEach((img, i) => {
          console.log(`   Image ${i + 1}: ${img.type} - ${img.filename}`);
          console.log(`              ${img.url.substring(0, 80)}...`);
        });
        console.log('');
      } else {
        console.log('   ⚠️  Could not fetch event detail\n');
      }
    } else {
      console.log('   ⚠️  No detail URL available\n');
    }
    
    // Step 3: Generate image with USGS images
    console.log('📸 Generating branded image with USGS images...\n');
    // Use same location cleaning as poller (includes city and country)
    let cleaned = place.replace(/^\d+\s*(km|mi|miles?)\s*[NESW]+\s+of\s+/i, "");
    cleaned = cleaned.replace(/^\d+\s*(km|mi|miles?)\s+/i, "");
    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
    const locationDisplay = parts.length > 1 
      ? parts.slice(-2).join(', ').toUpperCase()
      : cleaned.toUpperCase();
    
    const imageBuffer = await generateImage(magnitude, locationDisplay, usgsImages, eventId);
    
    // Save to file
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `usgs-test-m${magnitude}-${eventId}.png`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    
    const fileSize = (imageBuffer.length / 1024).toFixed(1);
    console.log(`✅ Image generated and saved!`);
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${fileSize}KB`);
    console.log(`   USGS Images: ${usgsImages.length} composited\n`);
    
    // Open the image
    const { exec } = require('child_process');
    exec(`open "${filepath}"`, (error) => {
      if (error) {
        console.log(`💡 Open manually: ${filepath}`);
      } else {
        console.log(`🖼️  Opened image for review\n`);
      }
    });
    
    console.log('='.repeat(60));
    console.log('\n✅ Test complete!');
    console.log('\n🔍 Verify in the generated image:');
    console.log('   - Template base layer is present');
    console.log('   - Dynamic text (magnitude, headline, location) is visible');
    if (usgsImages.length > 0) {
      console.log(`   - ${usgsImages.length} USGS image(s) are composited in lower section`);
    } else {
      console.log('   - No USGS images found (template static images may be visible)');
    }
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

