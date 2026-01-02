/**
 * Test Earthquake Image Generation with Last Real Earthquake
 * 
 * Fetches the most recent earthquake from Supabase verified_events table and generates an image for it
 * 
 * Usage:
 *   1. Make sure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or environment
 *   2. Run this script: node test-last-earthquake.js
 *   3. Check the test-output/ directory for generated image
 * 
 * Options:
 *   --usgs    Fetch from USGS instead of Supabase
 *   --local   Test against local dev server
 */

const fs = require('fs');
const path = require('path');

// Use node-fetch if available, otherwise use global fetch (Node 18+)
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  fetch = globalThis.fetch;
  if (!fetch) {
    console.error('❌ Error: fetch is not available. Install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config();

// Import production functions to match exact production flow
const { cleanLocation } = require('./netlify/functions/lib/normalize');

/**
 * Fetch the latest earthquake from Supabase verified_events table
 */
async function fetchLatestEarthquakeFromSupabase() {
  console.log('📡 Fetching latest earthquake from Supabase verified_events table...\n');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or environment variables.');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query for the most recent earthquake (engine = 'usgs', event_type = 'earthquake')
    const { data, error } = await supabase
      .from('verified_events')
      .select('*')
      .eq('engine', 'usgs')
      .eq('event_type', 'earthquake')
      .order('published_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('No earthquakes found in verified_events table');
      }
      throw error;
    }
    
    if (!data) {
      throw new Error('No earthquake data returned from Supabase');
    }
    
    console.log('✅ Found earthquake in Supabase:', {
      id: data.id,
      magnitude: data.title,
      location: data.location_display,
      published_at: data.published_at
    });
    
    return data;
    
  } catch (error) {
    console.error('❌ Error fetching from Supabase:', error.message);
    throw error;
  }
}

/**
 * Fetch the latest earthquake from USGS (fallback)
 */
async function fetchLatestEarthquakeFromUSGS() {
  console.log('📡 Fetching latest earthquake from USGS...\n');
  
  try {
    // Fetch the last hour feed (most recent earthquakes)
    const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
    
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      console.log('⚠️  No earthquakes found in the last hour. Trying last day...\n');
      // Try last day if no earthquakes in last hour
      const dayResponse = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
      if (!dayResponse.ok) {
        throw new Error(`USGS API error: ${dayResponse.status} ${dayResponse.statusText}`);
      }
      const dayData = await dayResponse.json();
      
      if (!dayData.features || dayData.features.length === 0) {
        throw new Error('No earthquakes found in the last day');
      }
      
      // Get the most recent one (first in array is usually most recent)
      const latest = dayData.features[0];
      return latest;
    }
    
    // Get the most recent one (first in array is usually most recent)
    const latest = data.features[0];
    return latest;
    
  } catch (error) {
    console.error('❌ Error fetching earthquake data:', error.message);
    throw error;
  }
}

/**
 * Extract USGS images using the EXACT production function
 * This matches production exactly - same logic, same priority, same deduplication
 */
function extractUSGSImages(eventDetail) {
  // Use the exact same function from production
  // Copy the production extractUSGSImages function logic
  const images = [];
  const usedProductTypes = new Set();
  const usedFilenames = new Set();
  
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
            if (images.length === 0 || !usedProductTypes.has(productType)) {
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
  
  // Third pass: If we still don't have 2, look in other products
  if (images.length < 2) {
    for (const productType of otherProductTypes) {
      if (images.length >= 2) break;
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
  
  return images.slice(0, 2); // Return max 2 images (same as production)
}

/**
 * Fetch event detail from USGS
 */
async function fetchEventDetail(detailUrl) {
  try {
    const response = await fetch(detailUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch event detail: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching event detail:', error.message);
    return null;
  }
}

/**
 * Test image generation with last earthquake
 */
async function testLastEarthquake() {
  console.log('🧪 Testing Earthquake Image Generation with Last Real Earthquake\n');
  console.log('='.repeat(70));
  
  const useUSGS = process.argv.includes('--usgs');
  
  try {
    let magnitude;
    let location;
    let eventId;
    let time;
    let detailUrl;
    let usgsImages = [];
    let supabaseEvent = null;
    
    if (useUSGS) {
      // Fetch from USGS directly
      const earthquake = await fetchLatestEarthquakeFromUSGS();
      
      const props = earthquake.properties;
      magnitude = props.mag || 0;
      const place = props.place || 'Unknown Location';
      location = cleanLocation(place); // Use production cleanLocation function
      eventId = earthquake.id;
      time = new Date(props.time);
      detailUrl = props.detail;
      
      console.log('\n📊 Latest Earthquake Data (from USGS):');
      console.log(`   Magnitude: M${magnitude.toFixed(1)}`);
      console.log(`   Raw Location: ${place}`);
      console.log(`   Cleaned Location: ${location}`);
      console.log(`   Event ID: ${eventId}`);
      console.log(`   Time: ${time.toLocaleString()}`);
      console.log(`   Detail URL: ${detailUrl || 'N/A'}\n`);
      
      // Fetch event detail to get USGS images (same as production)
      if (detailUrl) {
        console.log('📡 Fetching event detail for USGS images...');
        const eventDetail = await fetchEventDetail(detailUrl);
        
        if (eventDetail) {
          usgsImages = extractUSGSImages(eventDetail); // Use production function
          console.log(`   Found ${usgsImages.length} USGS image(s)`);
          if (usgsImages.length > 0) {
            usgsImages.forEach((img, i) => {
              console.log(`   - Image ${i + 1}: ${img.type} (${img.filename})`);
            });
          } else {
            console.log('   ⚠️  No images found (will use template images)');
          }
        } else {
          console.log('   ⚠️  Could not fetch event detail');
        }
      } else {
        console.log('   ⚠️  No detail URL available');
      }
    } else {
      // Fetch from Supabase
      supabaseEvent = await fetchLatestEarthquakeFromSupabase();
      
      // Extract magnitude from title (format: "M6.5" or "M 6.5" or "6.5")
      const title = supabaseEvent.title || '';
      const magMatch = title.match(/M\s*(\d+\.?\d*)/i) || title.match(/(\d+\.?\d*)/);
      magnitude = magMatch ? parseFloat(magMatch[1]) : null;
      
      if (!magnitude) {
        // Try to get from raw JSON
        try {
          const raw = typeof supabaseEvent.raw === 'string' 
            ? JSON.parse(supabaseEvent.raw) 
            : supabaseEvent.raw;
          if (raw && raw.properties && raw.properties.mag) {
            magnitude = raw.properties.mag;
          }
        } catch (e) {
          // Ignore
        }
      }
      
      if (!magnitude) {
        throw new Error('Could not extract magnitude from Supabase event');
      }
      
      // Get location from Supabase (already cleaned in production)
      location = supabaseEvent.location_display || 'Unknown Location';
      eventId = supabaseEvent.canonical_id || supabaseEvent.id;
      
      // Try to get event ID from assets or raw data (production stores it there)
      try {
        const assets = typeof supabaseEvent.assets === 'string' 
          ? JSON.parse(supabaseEvent.assets) 
          : supabaseEvent.assets;
        if (assets && assets.event_id) {
          eventId = assets.event_id;
        }
      } catch (e) {
        // Ignore
      }
      
      // If still no event ID, try to extract from raw data
      if (!eventId || eventId.startsWith('usgs:')) {
        try {
          const raw = typeof supabaseEvent.raw === 'string' 
            ? JSON.parse(supabaseEvent.raw) 
            : supabaseEvent.raw;
          if (raw && raw.id) {
            eventId = raw.id;
          }
        } catch (e) {
          // Ignore
        }
      }
      
      time = supabaseEvent.published_at ? new Date(supabaseEvent.published_at) : new Date();
      detailUrl = supabaseEvent.source_url;
      
      console.log('\n📊 Latest Earthquake Data (from Supabase):');
      console.log(`   Magnitude: M${magnitude.toFixed(1)}`);
      console.log(`   Location: ${location}`);
      console.log(`   Event ID: ${eventId}`);
      console.log(`   Published: ${time.toLocaleString()}`);
      console.log(`   Source URL: ${detailUrl || 'N/A'}`);
      console.log(`   Image URL: ${supabaseEvent.image_url || 'N/A'}\n`);
      
      // Try to get USGS images from assets first (production stores them there)
      try {
        const assets = typeof supabaseEvent.assets === 'string' 
          ? JSON.parse(supabaseEvent.assets) 
          : supabaseEvent.assets;
        if (assets && assets.usgs_images && Array.isArray(assets.usgs_images) && assets.usgs_images.length > 0) {
          usgsImages = assets.usgs_images;
          console.log(`   Found ${usgsImages.length} USGS image(s) from Supabase assets`);
          usgsImages.forEach((img, i) => {
            console.log(`   - Image ${i + 1}: ${img.type || 'unknown'} (${img.filename || 'image'})`);
          });
        }
      } catch (e) {
        console.log('   Could not parse assets from Supabase event');
      }
      
      // If no images in assets, fetch from detail URL (same as production)
      if (usgsImages.length === 0 && detailUrl) {
        console.log('📡 Fetching event detail for USGS images...');
        const eventDetail = await fetchEventDetail(detailUrl);
        
        if (eventDetail) {
          usgsImages = extractUSGSImages(eventDetail); // Use production function
          console.log(`   Found ${usgsImages.length} USGS image(s) from event detail`);
          if (usgsImages.length > 0) {
            usgsImages.forEach((img, i) => {
              console.log(`   - Image ${i + 1}: ${img.type} (${img.filename})`);
            });
          } else {
            console.log('   ⚠️  No images found (will use template images)');
          }
        } else {
          console.log('   ⚠️  Could not fetch event detail');
        }
      } else if (usgsImages.length === 0) {
        console.log('   ⚠️  No USGS images available (will use template images)');
      }
    }
    
    console.log('\n🎨 Generating earthquake image...\n');
    
    // Determine endpoint (local dev or production)
    const useLocal = process.argv.includes('--local') || process.env.NETLIFY_DEV;
    const baseUrl = useLocal ? 'http://localhost:8888' : 'https://noteworthynews.co';
    const endpoint = `${baseUrl}/.netlify/functions/generate-earthquake-image`;
    
    console.log(`📡 Calling: ${endpoint}`);
    
    // Call the image generation function
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        magnitude: magnitude, // Exact same format as production
        location: location, // Already cleaned by cleanLocation, don't uppercase
        eventId: eventId, // Exact same format
        usgsImages: usgsImages, // Exact same format (array of {url, type, filename})
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.url) {
      throw new Error(`Image generation returned error: ${JSON.stringify(result, null, 2)}`);
    }
    
    console.log('✅ Image generated successfully!');
    console.log(`\n📸 Image URL: ${result.url}`);
    console.log(`   Event ID: ${result.eventId}`);
    
    // Try to download and save the image locally
    try {
      console.log('\n💾 Downloading image to save locally...');
      const imageResponse = await fetch(result.url);
      
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(imageBuffer);
        
        // Create output directory
        const outputDir = path.join(__dirname, 'test-output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Save image
        const filename = `last-earthquake-m${magnitude}-${eventId}.png`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, buffer);
        
        const fileSize = (buffer.length / 1024 / 1024).toFixed(2);
        console.log(`✅ Image saved: ${filepath}`);
        console.log(`   Size: ${fileSize} MB`);
      } else {
        console.log(`⚠️  Could not download image: ${imageResponse.status}`);
        console.log(`   But you can view it at: ${result.url}`);
      }
    } catch (downloadError) {
      console.log(`⚠️  Could not save image locally: ${downloadError.message}`);
      console.log(`   But you can view it at: ${result.url}`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('\n✨ Test complete!');
    console.log(`\n🔗 View the image: ${result.url}`);
    console.log(`📂 Local file: test-output/last-earthquake-m${magnitude}-${eventId}.png`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testLastEarthquake().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

