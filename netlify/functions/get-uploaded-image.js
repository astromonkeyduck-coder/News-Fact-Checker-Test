/**
 * Retrieve and serve uploaded images and videos stored in Netlify Blobs
 * GET /.netlify/functions/get-uploaded-image?key=upload-1234567890-abc123.png
 * Supports both "post-media" and "uploaded-images" stores
 * Uses Netlify Blobs REST API directly (no SDK to avoid ES module issues)
 */

const sharp = require('sharp');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Method Not Allowed",
          receivedMethod: event.httpMethod,
          expectedMethod: "GET"
        }),
      };
    }

    const imageKey = event.queryStringParameters?.key;
    
    if (!imageKey) {
      return {
        statusCode: 400,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Missing 'key' query parameter",
          usage: "GET /.netlify/functions/get-uploaded-image?key=upload-1234567890-abc123.png"
        }),
      };
    }

    // Get siteID and token from environment
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    // Early validation - return 500 if credentials are missing (prevents 502 timeout)
    if (!siteID || !token) {
      console.error('[get-uploaded-image] Missing credentials', { hasSiteID: !!siteID, hasToken: !!token });
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Storage configuration error",
          message: "Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN"
        }),
      };
    }
    
    // Try multiple stores: post-media (new), newsletter-images, uploaded-images (legacy)
    const storeNames = ["post-media", "newsletter-images", "uploaded-images"];
    let imageData = null;
    let foundStore = null;
    
    console.log(`[get-uploaded-image] Looking for image: ${imageKey}`);
    console.log(`[get-uploaded-image] Site ID: ${siteID ? siteID.substring(0, 8) + '...' : 'MISSING'}, Token: ${token ? 'PRESENT' : 'MISSING'}`);
    
    // Generate key variants for backward compatibility
    // New format: earthquake-{eventId}-{templateType}-{timestamp}.png
    // Old format: earthquake-{eventId}-{timestamp}.png
    const keyVariants = [imageKey];
    
    const hasTemplateType = imageKey.includes('-standard-') || imageKey.includes('-square-') || imageKey.includes('-wide-');
    
    if (hasTemplateType) {
      // Key has template type (new format) - also try old format
      const oldFormat = imageKey.replace(/-standard-|-square-|-wide-/, '-');
      keyVariants.push(oldFormat);
      console.log(`[get-uploaded-image] Will also try old format: ${oldFormat}`);
    } else {
      // Key doesn't have template type - try adding -standard- (new format)
      // Pattern: earthquake-{eventId}-{timestamp}.png
      // Extract eventId (everything before last -{digits}.png) and timestamp
      const match = imageKey.match(/^earthquake-(.+)-(\d+)\.png$/);
      if (match) {
        const eventId = match[1];
        const timestamp = match[2];
        // Only add new format if eventId doesn't already contain a template type keyword
        // (to avoid double-adding)
        if (!eventId.includes('standard') && !eventId.includes('square') && !eventId.includes('wide')) {
          keyVariants.push(`earthquake-${eventId}-standard-${timestamp}.png`);
          console.log(`[get-uploaded-image] Will also try new format: earthquake-${eventId}-standard-${timestamp}.png`);
        }
      }
    }
    
    // Try to find the media in any of the stores using REST API
    // Note: siteID and token are guaranteed to exist after early validation above
    outerLoop: for (const storeName of storeNames) {
      for (const keyVariant of keyVariants) {
        try {
          const encodedKey = encodeURIComponent(keyVariant);
          const apiUrl = `https://api.netlify.com/api/v1/sites/${siteID}/blobs/${storeName}/${encodedKey}`;
          console.log(`[get-uploaded-image] Trying store: ${storeName}, key: ${keyVariant}`);
          console.log(`[get-uploaded-image] Encoded key: ${encodedKey}`);
          console.log(`[get-uploaded-image] Full API URL: ${apiUrl}`);
        
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          console.log(`[get-uploaded-image] Response from ${storeName}: ${response.status} ${response.statusText}`);
          const contentType = response.headers.get('content-type') || '';
          console.log(`[get-uploaded-image] Content-Type: ${contentType}`);
          
          // Log response body for non-200 responses to debug
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.log(`[get-uploaded-image] Error response body: ${errorText.substring(0, 500)}`);
            
            // Special handling for 401 Unauthorized
            if (response.status === 401) {
              console.error(`[get-uploaded-image] ❌ 401 Unauthorized - Netlify Blobs authentication failed`, {
                storeName,
                keyVariant,
                hasToken: !!token,
                tokenLength: token ? token.length : 0,
                siteID: siteID ? siteID.substring(0, 8) + '...' : 'MISSING',
                error: errorText.substring(0, 200)
              });
              // Continue to next store/key variant instead of failing immediately
            }
          }
          
          if (response.ok) {
          // Check if response is JSON (Netlify Blobs might return JSON with a URL)
          if (contentType.includes('application/json')) {
            const jsonData = await response.json().catch(() => null);
            if (jsonData && jsonData.url) {
              console.log(`[get-uploaded-image] ⚠️ Blobs API returned JSON with URL, fetching from: ${jsonData.url}`);
              // Follow the URL to get the actual image
              try {
                const imageResponse = await fetch(jsonData.url);
                if (imageResponse.ok) {
                  const arrayBuffer = await imageResponse.arrayBuffer();
                  if (arrayBuffer && arrayBuffer.byteLength > 0) {
                    // Verify it's actually an image (not more JSON)
                    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
                    const isPNG = firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47;
                    const isJPEG = firstBytes[0] === 0xFF && firstBytes[1] === 0xD8;
                    if (isPNG || isJPEG) {
                      imageData = arrayBuffer;
                      foundStore = storeName;
                      console.log(`[get-uploaded-image] ✅ Found image via redirect URL: ${Math.round(arrayBuffer.byteLength / 1024)}KB (${isPNG ? 'PNG' : 'JPEG'})`);
                      break outerLoop; // Break out of both loops
                    } else {
                      console.warn(`[get-uploaded-image] ⚠️ Redirect URL did not return valid image (magic bytes: ${Array.from(firstBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')})`);
                    }
                  }
                } else {
                  console.warn(`[get-uploaded-image] ⚠️ Failed to fetch from redirect URL: ${imageResponse.status} ${imageResponse.statusText}`);
                }
              } catch (redirectErr) {
                console.warn(`[get-uploaded-image] ⚠️ Error fetching from redirect URL:`, redirectErr.message);
              }
            } else {
              console.warn(`[get-uploaded-image] ⚠️ JSON response but no URL field:`, JSON.stringify(jsonData).substring(0, 200));
            }
          } else {
            // Binary response - get as arrayBuffer
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer && arrayBuffer.byteLength > 0) {
              // Check if it's actually JSON (starts with {)
              const firstBytes = new Uint8Array(arrayBuffer.slice(0, 10));
              const startsWithJson = firstBytes[0] === 0x7b; // '{' character
              
              if (startsWithJson) {
                // It's JSON, try to parse and get URL
                const text = new TextDecoder().decode(arrayBuffer);
                try {
                  const jsonData = JSON.parse(text);
                  if (jsonData.url) {
                    console.log(`[get-uploaded-image] ⚠️ Response is JSON (despite content-type), fetching from: ${jsonData.url}`);
                    try {
                      const imageResponse = await fetch(jsonData.url);
                      if (imageResponse.ok) {
                        const imageArrayBuffer = await imageResponse.arrayBuffer();
                        if (imageArrayBuffer && imageArrayBuffer.byteLength > 0) {
                          // Verify it's actually an image (not more JSON)
                          const firstBytes = new Uint8Array(imageArrayBuffer.slice(0, 4));
                          const isPNG = firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47;
                          const isJPEG = firstBytes[0] === 0xFF && firstBytes[1] === 0xD8;
                          if (isPNG || isJPEG) {
                            imageData = imageArrayBuffer;
                            foundStore = storeName;
                            console.log(`[get-uploaded-image] ✅ Found image via JSON URL: ${Math.round(imageArrayBuffer.byteLength / 1024)}KB (${isPNG ? 'PNG' : 'JPEG'})`);
                            break outerLoop; // Break out of both loops
                          } else {
                            console.warn(`[get-uploaded-image] ⚠️ Redirect URL did not return valid image (magic bytes: ${Array.from(firstBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')})`);
                          }
                        }
                      } else {
                        console.warn(`[get-uploaded-image] ⚠️ Failed to fetch from redirect URL: ${imageResponse.status} ${imageResponse.statusText}`);
                      }
                    } catch (redirectErr) {
                      console.warn(`[get-uploaded-image] ⚠️ Error fetching from redirect URL:`, redirectErr.message);
                    }
                  }
                } catch (parseErr) {
                  console.warn(`[get-uploaded-image] ⚠️ Failed to parse JSON response:`, parseErr.message);
                }
              } else {
                // It's actual binary image data
                imageData = arrayBuffer;
                foundStore = storeName;
                console.log(`[get-uploaded-image] ✅ Found image in ${storeName}: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);
                break outerLoop; // Break out of both loops
              }
            } else {
              console.warn(`[get-uploaded-image] ⚠️ Empty response from ${storeName}`);
            }
          }
          } else if (response.status === 404) {
            console.log(`[get-uploaded-image] Image not found in ${storeName} with key ${keyVariant} (404)`);
            // Continue to next key variant
          } else {
            // Log non-404 errors but continue trying other key variants
            const errorText = await response.text().catch(() => '');
            console.warn(`[get-uploaded-image] Error fetching from ${storeName} with key ${keyVariant}:`, response.status, response.statusText, errorText.substring(0, 200));
          }
        } catch (fetchErr) {
          // Network error, try next key variant
          console.warn(`[get-uploaded-image] Network error fetching from ${storeName} with key ${keyVariant}:`, fetchErr.message);
        }
      }
    }

    // Check if requesting metadata
    if (imageKey.startsWith('metadata-')) {
      if (imageData) {
      try {
          const metadata = JSON.parse(Buffer.from(imageData).toString('utf-8'));
          return {
            statusCode: 200,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(metadata),
          };
        } catch (parseErr) {
          console.error('[get-uploaded-image] Error parsing metadata:', parseErr);
        }
      }
      return {
        statusCode: 404,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Metadata not found" }),
      };
    }

    // If REST API failed, try SDK as fallback (for images stored via SDK)
    if (!imageData) {
      console.log('[get-uploaded-image] REST API failed, trying SDK fallback...');
      try {
        const { getStore } = require("@netlify/blobs");
        
        sdkFallbackLoop: for (const storeName of storeNames) {
          for (const keyVariant of keyVariants) {
            try {
              const store = getStore({
                name: storeName,
                siteID: siteID,
                token: token,
              });
              
              const sdkImage = await store.get(keyVariant, { type: "arrayBuffer" });
              if (sdkImage && sdkImage.byteLength > 0) {
                imageData = sdkImage;
                foundStore = storeName;
                console.log(`[get-uploaded-image] ✅ Found image via SDK fallback in ${storeName}: ${Math.round(sdkImage.byteLength / 1024)}KB`);
                break sdkFallbackLoop;
              }
            } catch (sdkErr) {
              // Continue to next variant
              console.log(`[get-uploaded-image] SDK fallback failed for ${storeName}/${keyVariant}:`, sdkErr.message);
            }
          }
        }
      } catch (sdkFallbackErr) {
        console.warn('[get-uploaded-image] SDK fallback error:', sdkFallbackErr.message);
      }
    }

    // Retrieve image from Blobs (already fetched above via REST API or SDK)
    try {
      if (!imageData) {
        // Extract event ID from key for better error message
        const eventIdMatch = imageKey.match(/earthquake-([^-]+)/);
        const eventId = eventIdMatch ? eventIdMatch[1] : 'unknown';
        
        console.error('[get-uploaded-image] ❌ Image not found in any store', { 
          imageKey,
          eventId,
          triedStores: storeNames,
          triedKeyVariants: keyVariants,
          siteID: siteID ? siteID.substring(0, 8) + '...' : 'MISSING',
          hasToken: !!token
        });
        return {
          statusCode: 404,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            error: "Media not found", 
            key: imageKey,
            eventId: eventId,
            triedStores: storeNames,
            triedKeyVariants: keyVariants,
            message: "Image not found in post-media, newsletter-images, or uploaded-images stores. The image may not have been stored, may have expired, or may need to be regenerated.",
            suggestion: eventId !== 'unknown' ? `You may need to regenerate the image for event ${eventId}` : "You may need to regenerate this image"
          }),
        };
      }
      
      console.log(`[get-uploaded-image] ✅ Image found in ${foundStore}, size: ${Math.round(imageData.byteLength / 1024)}KB`);

      // Determine content type from key extension
      let contentType = "image/png";
      if (imageKey.endsWith('.jpg') || imageKey.endsWith('.jpeg')) {
        contentType = "image/jpeg";
      } else if (imageKey.endsWith('.gif')) {
        contentType = "image/gif";
      } else if (imageKey.endsWith('.webp')) {
        contentType = "image/webp";
      } else if (imageKey.endsWith('.svg')) {
        contentType = "image/svg+xml";
      } else if (imageKey.endsWith('.mp4')) {
        contentType = "video/mp4";
      } else if (imageKey.endsWith('.webm')) {
        contentType = "video/webm";
      } else if (imageKey.endsWith('.mov')) {
        contentType = "video/quicktime";
      }

      // Convert ArrayBuffer to Buffer for response (REST API returns ArrayBuffer)
      let imageBuffer = Buffer.from(imageData);

      // Check buffer size to prevent timeout (Netlify has 10s timeout for free tier, 26s for pro)
      // Base64 encoding increases size by ~33%, so we check the raw buffer size
      // Netlify response limit is ~6MB for base64, so ~4.5MB raw buffer max
      const maxSize = 4.5 * 1024 * 1024; // 4.5MB raw buffer (becomes ~6MB base64)
      
      // If image is too large, compress it on-the-fly (for old images generated before compression)
      if (imageBuffer.length > maxSize) {
        const originalSize = imageBuffer.length;
        console.warn('[get-uploaded-image] Image too large, compressing on-the-fly', { 
          originalSize, 
          key: imageKey 
        });
        
        try {
          // Compress the image using sharp
          const compressedBuffer = await sharp(imageBuffer)
            .png({
              compressionLevel: 9, // Maximum compression
              quality: 90, // Slight quality reduction for size
              effort: 10
            })
            .toBuffer();
          
          // If still too large after compression, try resizing
          if (compressedBuffer.length > maxSize) {
            const metadata = await sharp(imageBuffer).metadata();
            const scaleFactor = Math.sqrt(maxSize / compressedBuffer.length) * 0.9; // 90% to be safe
            
            const resizedBuffer = await sharp(imageBuffer)
              .resize(Math.round(metadata.width * scaleFactor), Math.round(metadata.height * scaleFactor), {
                kernel: 'lanczos3',
                withoutEnlargement: true
              })
              .png({
                compressionLevel: 9,
                quality: 90,
                effort: 10
              })
              .toBuffer();
            
            if (resizedBuffer.length <= maxSize) {
              imageBuffer = resizedBuffer;
              console.log('[get-uploaded-image] Image resized and compressed', { 
                originalSize,
                finalSize: resizedBuffer.length,
                key: imageKey 
              });
            } else {
              // Still too large even after resizing - return error
              console.error('[get-uploaded-image] Image still too large after compression and resize', { 
                originalSize,
                compressedSize: compressedBuffer.length,
                resizedSize: resizedBuffer.length,
                key: imageKey 
              });
              return {
                statusCode: 413,
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Image too large even after compression" }),
              };
            }
          } else {
            imageBuffer = compressedBuffer;
            console.log('[get-uploaded-image] Image compressed successfully', { 
              originalSize,
              compressedSize: compressedBuffer.length,
              key: imageKey 
            });
          }
        } catch (compressError) {
          console.error('[get-uploaded-image] Compression failed', compressError, { key: imageKey });
          // If compression fails, return error
          return {
            statusCode: 413,
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Image too large and compression failed" }),
          };
        }
      }

      // Log image size for debugging
      console.log('[get-uploaded-image] Serving image', { 
        key: imageKey, 
        size: imageBuffer.length, 
        contentType,
        foundStore 
      });
      
      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
          "Content-Length": imageBuffer.length.toString(),
        },
        body: imageBuffer.toString('base64'),
        isBase64Encoded: true,
      };
    } catch (err) {
      console.error('[get-uploaded-image] Error retrieving image:', err, { imageKey, foundStore });
      return {
        statusCode: 500,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Failed to retrieve image",
          message: err.message,
          key: imageKey
        }),
      };
    }
  } catch (e) {
    console.error("get-uploaded-image function error:", e);
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Internal server error",
        message: e.message || "An unexpected error occurred"
      }),
    };
  }
};

