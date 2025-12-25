/**
 * Earthquake Pipeline - USGS Poller
 * Scheduled function that polls USGS for new earthquakes and creates posts
 * 
 * Schedule: Every 3 minutes (configure in Netlify dashboard)
 * 
 * Environment Variables Required:
 * - ALERT_TO_EMAIL: Email address to receive alerts for magnitude >= 7.0
 * - RESEND_API_KEY: Resend API key for sending emails
 * - NETLIFY_SITE_ID: Netlify site ID (auto-set in Netlify)
 * - NETLIFY_BLOB_READ_WRITE_TOKEN: Netlify Blob token (auto-set in Netlify)
 */

const { getStore } = require("@netlify/blobs");

// USGS GeoJSON feed URLs
const USGS_FEEDS = {
  all_hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  all_day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
};

// Test mode flag (set via query param or env var)
const isTestMode = process.env.EARTHQUAKE_TEST_MODE === "true";

/**
 * Fetch USGS earthquake data
 */
async function fetchUSGSFeed(feedType = "all_hour") {
  const url = USGS_FEEDS[feedType] || USGS_FEEDS.all_hour;
  console.log(`[earthquake-poller] Fetching ${feedType} feed from USGS...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`USGS API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Fetch detailed event data from USGS
 */
async function fetchEventDetail(detailUrl) {
  try {
    const response = await fetch(detailUrl);
    if (!response.ok) {
      console.warn(`[earthquake-poller] Failed to fetch detail for ${detailUrl}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`[earthquake-poller] Error fetching event detail:`, error);
    return null;
  }
}

/**
 * Extract two DISTINCT USGS images from event detail
 * Ensures images are from different product types when possible
 * Priority order (for immediate availability):
 * 1. Immediate products (DYFI, basic maps) - available within 0-3 minutes
 * 2. Shakemap products - available within 5-10 minutes (best quality)
 * 3. Other products - fallback
 */
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
              // This helps avoid getting similar images like "ciim.jpg" and "ciim_geo.jpg"
              let baseFilename = key
                .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')  // Remove _geo before extension
                .replace(/_geo_/gi, '_')                       // Remove _geo_ in middle
                .replace(/_(geo|map|plot|image)\./gi, '.')     // Remove common variant suffixes
                .toLowerCase();
              
              // Also check if any existing image has a similar base name
              const isSimilar = images.some(img => {
                const existingBase = img.filename
                  .replace(/_geo\.(jpg|png|jpeg|gif)$/i, '.$1')
                  .replace(/_geo_/gi, '_')
                  .replace(/_(geo|map|plot|image)\./gi, '.')
                  .toLowerCase();
                // Check if base names are very similar (same core name)
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

/**
 * Clean location text for display
 * Includes city and country when available
 */
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

/**
 * Check if earthquake already exists in storage
 */
async function earthquakeExists(store, eventId) {
  try {
    const key = `earthquake-${eventId}.json`;
    const existing = await store.get(key);
    return !!existing;
  } catch (err) {
    return false;
  }
}

/**
 * Store earthquake data
 */
async function storeEarthquake(store, earthquakeData) {
  const key = `earthquake-${earthquakeData.event_id}.json`;
  await store.set(key, JSON.stringify(earthquakeData), {
    contentType: "application/json",
  });
  console.log(`[earthquake-poller] Stored earthquake: ${earthquakeData.event_id}`);
}

/**
 * Create earthquake post on website
 */
async function createEarthquakePost(earthquakeData, imageUrl) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  
  // Use the same store as regular posts
  const store = getStore({
    name: "x-posts",
    siteID: siteID,
    token: token,
  });
  
  const postId = `eq-${earthquakeData.event_id}`;
  const postKey = `post-${postId}.json`;
  
  // Check if post already exists
  try {
    const existing = await store.get(postKey);
    if (existing) {
      console.log(`[earthquake-poller] Post ${postId} already exists, skipping`);
      return { exists: true, postId };
    }
  } catch (err) {
    // Post doesn't exist, continue
  }
  
  // Format time for display
  const eventTime = new Date(earthquakeData.time);
  const localTime = eventTime.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  // Create post object matching the site's post structure
  const post = {
    id: postId,
    title: `M${earthquakeData.magnitude} Earthquake Near ${earthquakeData.location_display}`,
    story: `A magnitude ${earthquakeData.magnitude} earthquake was detected by the U.S. Geological Survey near ${earthquakeData.location_display} at ${localTime}.`,
    text: `A magnitude ${earthquakeData.magnitude} earthquake was detected by the U.S. Geological Survey near ${earthquakeData.location_display} at ${localTime}.`,
    image: imageUrl,
    images: [imageUrl],
    link: earthquakeData.usgs_event_url,
    url: earthquakeData.usgs_event_url,
    datePosted: earthquakeData.time,
    createdAt: earthquakeData.time,
    created_at: earthquakeData.time,
    category: "Earthquake",
    source: "USGS",
    magnitude: earthquakeData.magnitude,
    location: earthquakeData.location_display,
    eventId: earthquakeData.event_id,
  };
  
  // Store post
  await store.set(postKey, JSON.stringify(post), {
    contentType: "application/json",
  });
  
  // Add to index
  let indexData = { ids: [], urls: [] };
  try {
    const indexBlob = await store.get("index.json", { type: "json" });
    if (indexBlob) {
      indexData = indexBlob;
    }
  } catch (err) {
    // Index doesn't exist yet
  }
  
  // Remove duplicates and prepend new post
  const existingIds = (indexData.ids || []).filter(id => id !== postId);
  const existingUrls = (indexData.urls || []).filter((url, idx) => (indexData.ids || [])[idx] !== postId);
  
  const newIds = [postId, ...existingIds].slice(0, 200);
  const newUrls = [post.url || post.link, ...existingUrls].slice(0, 200);
  
  await store.set("index.json", JSON.stringify({ ids: newIds, urls: newUrls }), {
    contentType: "application/json",
  });
  
  console.log(`[earthquake-poller] Created post: ${postId}`);
  return { exists: false, postId, post };
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  
  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  // Check for test mode
  const testMode = event.queryStringParameters?.test === "true" || isTestMode;
  
  try {
    console.log(`[earthquake-poller] Starting ${testMode ? "TEST MODE" : "LIVE MODE"}...`);
    
    // Get blob store for tracking processed earthquakes
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let earthquakeStore;
    try {
      if (siteID && token) {
        earthquakeStore = getStore({
          name: "earthquakes",
          siteID: siteID,
          token: token,
        });
      } else {
        earthquakeStore = getStore({ name: "earthquakes" });
      }
    } catch (storeErr) {
      console.error('[earthquake-poller] Failed to create store:', storeErr);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          error: "Storage configuration error",
          message: storeErr.message,
        }),
      };
    }
    
    // Fetch USGS feed
    const feedData = await fetchUSGSFeed("all_hour");
    
    if (!feedData || !feedData.features || !Array.isArray(feedData.features)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "No earthquakes found in feed",
          processed: 0,
          testMode,
        }),
      };
    }
    
    console.log(`[earthquake-poller] Found ${feedData.features.length} earthquakes in feed`);
    
    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      alerts: 0,
      errors: [],
    };
    
    // Process each earthquake
    for (const feature of feedData.features) {
      try {
        const eventId = feature.id;
        if (!eventId) continue;
        
        // Check if already processed
        const exists = await earthquakeExists(earthquakeStore, eventId);
        if (exists) {
          results.skipped++;
          continue;
        }
        
        // Get event details
        const detailUrl = feature.properties.detail;
        let eventDetail = null;
        let usgsImages = [];
        
        if (detailUrl) {
          eventDetail = await fetchEventDetail(detailUrl);
          if (eventDetail) {
            usgsImages = extractUSGSImages(eventDetail);
          }
        }
        
        // Extract earthquake data
        const magnitude = feature.properties.mag || 0;
        const place = feature.properties.place || "Unknown Location";
        const time = feature.properties.time || Date.now();
        const locationDisplay = cleanLocation(place);
        
        const earthquakeData = {
          event_id: eventId,
          magnitude: magnitude,
          place_raw: place,
          location_display: locationDisplay,
          time_ms: time,
          time: new Date(time).toISOString(),
          usgs_event_url: feature.properties.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${eventId}`,
          detail_url: detailUrl,
          usgs_images: usgsImages,
          alert_sent: false,
          created_at: new Date().toISOString(),
        };
        
        // Generate branded image
        let imageUrl = null;
        try {
          // Call image generation function
          const imageGenUrl = process.env.URL || "https://noteworthynews.co";
          const imageResponse = await fetch(`${imageGenUrl}/.netlify/functions/generate-earthquake-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              magnitude: magnitude,
              location: locationDisplay,
              usgsImages: usgsImages,
              eventId: eventId,
            }),
          });
          
          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            imageUrl = imageData.url;
            console.log(`[earthquake-poller] Generated image: ${imageUrl}`);
          } else {
            console.warn(`[earthquake-poller] Image generation failed: ${imageResponse.status}`);
          }
        } catch (imgError) {
          console.error(`[earthquake-poller] Image generation error:`, imgError);
        }
        
        // Store earthquake data
        await storeEarthquake(earthquakeStore, earthquakeData);
        
        // Create post (always create, even if image generation failed)
        const postResult = await createEarthquakePost(earthquakeData, imageUrl);
        if (!postResult.exists) {
          results.created++;
          if (!imageUrl) {
            console.warn(`[earthquake-poller] Post created without image for ${eventId}`);
          }
        }
        
        // Send email alert for magnitude >= 7.0
        if (magnitude >= 7.0 && !testMode) {
          try {
            // Check if AI_NOTIFICATION_EMAILS or ALERT_TO_EMAIL is configured
            const hasEmailConfig = process.env.AI_NOTIFICATION_EMAILS || process.env.ALERT_TO_EMAIL;
            if (hasEmailConfig) {
              const alertUrl = process.env.URL || "https://noteworthynews.co";
              const alertResponse = await fetch(`${alertUrl}/.netlify/functions/send-earthquake-alert`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  earthquake: earthquakeData,
                  imageUrl: imageUrl,
                }),
              });
              
              if (alertResponse.ok) {
                // Mark alert as sent
                earthquakeData.alert_sent = true;
                await storeEarthquake(earthquakeStore, earthquakeData);
                results.alerts++;
                console.log(`[earthquake-poller] Alert sent for M${magnitude} earthquake`);
              } else {
                const errorText = await alertResponse.text();
                console.warn(`[earthquake-poller] Alert response not OK: ${alertResponse.status} ${errorText}`);
              }
            } else {
              console.warn(`[earthquake-poller] No email configuration found (AI_NOTIFICATION_EMAILS or ALERT_TO_EMAIL)`);
            }
          } catch (alertError) {
            console.error(`[earthquake-poller] Alert error:`, alertError);
            results.errors.push(`Alert failed: ${alertError.message}`);
          }
        }
        
        results.processed++;
        
      } catch (error) {
        console.error(`[earthquake-poller] Error processing earthquake:`, error);
        results.errors.push(error.message);
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Earthquake poll completed",
        ...results,
        testMode,
      }),
    };
    
  } catch (error) {
    console.error('[earthquake-poller] Fatal error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
        testMode,
      }),
    };
  }
};

