/**
 * Test Full Earthquake Pipeline
 * 
 * This script simulates processing a real earthquake >= 7.0
 * It will:
 * 1. Fetch a recent large earthquake from USGS
 * 2. Generate the branded image
 * 3. Create a post on the website
 * 4. Send an email alert
 * 
 * Usage:
 *   node test-full-earthquake-pipeline.js
 * 
 * Make sure Netlify dev is running: npm run dev
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

const BASE_URL = process.env.NETLIFY_DEV ? 'http://localhost:8888' : 'https://noteworthynews.co';

async function fetchRecentLargeEarthquake() {
  console.log('🔍 Fetching recent earthquakes from USGS...\n');
  
  // Fetch last 7 days of significant earthquakes (>= 7.0)
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USGS API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.features || data.features.length === 0) {
    console.log('⚠️  No significant earthquakes found in the last week.');
    console.log('   Using a test earthquake instead...\n');
    
    // Return a test earthquake
    return {
      id: 'test-large-001',
      properties: {
        mag: 7.5,
        place: 'Southern California',
        time: Date.now(),
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test',
        detail: null,
      },
      geometry: {
        coordinates: [-118.2437, 34.0522, 10],
      },
    };
  }
  
  // Find the most recent one >= 7.0
  const largeQuakes = data.features
    .filter(f => f.properties.mag >= 7.0)
    .sort((a, b) => b.properties.time - a.properties.time);
  
  if (largeQuakes.length === 0) {
    console.log('⚠️  No earthquakes >= 7.0 found in the last week.');
    console.log('   Using the largest recent earthquake instead...\n');
    
    // Get the largest one
    const largest = data.features.sort((a, b) => b.properties.mag - a.properties.mag)[0];
    return largest;
  }
  
  const earthquake = largeQuakes[0];
  console.log(`✅ Found earthquake: M${earthquake.properties.mag} near ${earthquake.properties.place}`);
  console.log(`   Time: ${new Date(earthquake.properties.time).toLocaleString()}\n`);
  
  return earthquake;
}

async function fetchEventDetail(detailUrl) {
  if (!detailUrl) return null;
  
  try {
    const response = await fetch(detailUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn(`⚠️  Could not fetch event detail: ${error.message}`);
    return null;
  }
}

function extractUSGSImages(eventDetail) {
  const images = [];
  
  if (!eventDetail || !eventDetail.properties || !eventDetail.properties.products) {
    return images;
  }
  
  const products = eventDetail.properties.products;
  const shakemapProducts = products.shakemap || [];
  
  for (const product of shakemapProducts) {
    if (product.contents && typeof product.contents === 'object') {
      for (const [key, content] of Object.entries(product.contents)) {
        if (content.url && /\.(png|jpg|jpeg|gif)$/i.test(key)) {
          if (!images.find(img => img.url === content.url)) {
            images.push({
              url: content.url,
              type: 'shakemap',
              filename: key,
            });
            if (images.length >= 2) break;
          }
        }
      }
    }
    if (images.length >= 2) break;
  }
  
  return images.slice(0, 2);
}

function cleanLocation(place) {
  if (!place) return "Unknown Location";
  
  // Remove distance/direction prefixes like "20 km SE of"
  let cleaned = place.replace(/^\d+\s*(km|mi|miles?)\s*[NESW]+\s+of\s+/i, "");
  cleaned = cleaned.replace(/^\d+\s*(km|mi|miles?)\s+/i, "");
  
  // Split by comma to get city and country
  const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
  
  if (parts.length > 1) {
    // Return city and country: "CITY, COUNTRY"
    // Take last 2 parts (city, country) or just last part if only one
    const cityCountry = parts.slice(-2).join(', ');
    return cityCountry.toUpperCase();
  }
  
  // For single-part locations, capitalize and return
  return cleaned.toUpperCase();
}

async function generateImage(magnitude, location, usgsImages, eventId) {
  console.log(`📸 Generating branded image...`);
  console.log(`   Magnitude: M${magnitude}`);
  console.log(`   Location: ${location}`);
  
  const response = await fetch(`${BASE_URL}/.netlify/functions/generate-earthquake-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      magnitude: magnitude,
      location: location,
      eventId: eventId,
      usgsImages: usgsImages,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  console.log(`   ✅ Image generated: ${result.url}\n`);
  return result.url;
}

async function createPost(earthquakeData, imageUrl) {
  console.log(`📝 Creating post on website...`);
  
  const eventTime = new Date(earthquakeData.time_ms).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const postData = {
    postId: `eq-${earthquakeData.event_id}`,
    story: `A magnitude ${earthquakeData.magnitude} earthquake was detected by the U.S. Geological Survey near ${earthquakeData.location_display} at ${eventTime}.`,
    text: `A magnitude ${earthquakeData.magnitude} earthquake was detected by the U.S. Geological Survey near ${earthquakeData.location_display} at ${eventTime}.`,
    image: imageUrl,
    images: [imageUrl],
    link: earthquakeData.usgs_event_url,
    url: earthquakeData.usgs_event_url,
    datePosted: new Date(earthquakeData.time_ms).toISOString(),
  };
  
  const response = await fetch(`${BASE_URL}/.netlify/functions/update-post-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postData),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Post creation failed: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  console.log(`   ✅ Post created: ${postData.postId}\n`);
  return result;
}

async function sendAlert(earthquakeData, imageUrl) {
  console.log(`📧 Sending email alert...`);
  
  const response = await fetch(`${BASE_URL}/.netlify/functions/send-earthquake-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      earthquake: earthquakeData,
      imageUrl: imageUrl,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email alert failed: ${response.status} ${errorText}`);
  }
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  console.log(`   ✅ Email alert sent: ${result.emailId || 'success'}\n`);
  return result;
}

async function main() {
  console.log('🚀 Testing Full Earthquake Pipeline\n');
  console.log('=' .repeat(50));
  console.log('');
  
  try {
    // Step 1: Fetch earthquake
    const earthquake = await fetchRecentLargeEarthquake();
    
    const eventId = earthquake.id;
    const magnitude = earthquake.properties.mag;
    const place = earthquake.properties.place;
    const time = earthquake.properties.time;
    const detailUrl = earthquake.properties.detail;
    
    // Step 2: Fetch event detail for images
    let eventDetail = null;
    let usgsImages = [];
    
    if (detailUrl) {
      console.log('🔍 Fetching event details for USGS images...\n');
      eventDetail = await fetchEventDetail(detailUrl);
      if (eventDetail) {
        usgsImages = extractUSGSImages(eventDetail);
        console.log(`   Found ${usgsImages.length} USGS image(s)\n`);
      }
    }
    
    // Step 3: Prepare earthquake data
    const locationDisplay = cleanLocation(place);
    const earthquakeData = {
      event_id: eventId,
      magnitude: magnitude,
      place_raw: place,
      location_display: locationDisplay,
      time_ms: time,
      time: new Date(time).toISOString(),
      usgs_event_url: earthquake.properties.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${eventId}`,
      detail_url: detailUrl,
      usgs_images: usgsImages,
      alert_sent: false,
      created_at: new Date().toISOString(),
    };
    
    // Step 4: Generate image
    const imageUrl = await generateImage(magnitude, locationDisplay, usgsImages, eventId);
    
    // Step 5: Create post
    await createPost(earthquakeData, imageUrl);
    
    // Step 6: Send alert (only if >= 7.0)
    if (magnitude >= 7.0) {
      await sendAlert(earthquakeData, imageUrl);
    } else {
      console.log(`ℹ️  Magnitude ${magnitude} < 7.0, skipping email alert\n`);
    }
    
    const postId = `eq-${eventId}`;
    
    console.log('=' .repeat(50));
    console.log('✅ Pipeline test complete!\n');
    console.log('Summary:');
    console.log(`   Earthquake: M${magnitude} near ${locationDisplay}`);
    console.log(`   Event ID: ${eventId}`);
    console.log(`   Post ID: ${postId} ⬅️ USE THIS TO DELETE LATER`);
    console.log(`   Image: ${imageUrl}`);
    console.log(`   Post: Created on website`);
    if (magnitude >= 7.0) {
      console.log(`   Email: Alert sent`);
    }
    console.log('');
    console.log('🗑️  To delete this test post later, run:');
    console.log(`   curl -X POST "${BASE_URL}/.netlify/functions/remove-post" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"postId": "${postId}"}'`);
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };

