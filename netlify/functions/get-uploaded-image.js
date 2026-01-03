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
    
    // Try to find the media in any of the stores using REST API
    // Note: siteID and token are guaranteed to exist after early validation above
    for (const storeName of storeNames) {
      try {
        const apiUrl = `https://api.netlify.com/api/v1/sites/${siteID}/blobs/${storeName}/${encodeURIComponent(imageKey)}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength > 0) {
            imageData = arrayBuffer;
            foundStore = storeName;
            break;
          }
        } else if (response.status !== 404) {
          // Log non-404 errors but continue trying other stores
          console.warn(`[get-uploaded-image] Error fetching from ${storeName}:`, response.status, response.statusText);
        }
      } catch (fetchErr) {
        // Network error, try next store
        console.warn(`[get-uploaded-image] Network error fetching from ${storeName}:`, fetchErr.message);
        continue;
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

    // Retrieve image from Blobs (already fetched above via REST API)
    try {
      if (!imageData) {
      
      if (!imageData) {
        console.warn('[get-uploaded-image] Image not found', { imageKey, foundStore });
        return {
          statusCode: 404,
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Media not found", key: imageKey }),
        };
      }

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

      // Convert ArrayBuffer to Buffer for response
      // Handle both ArrayBuffer and Buffer types
      let imageBuffer;
      if (imageData instanceof ArrayBuffer) {
        imageBuffer = Buffer.from(imageData);
      } else if (Buffer.isBuffer(imageData)) {
        imageBuffer = imageData;
      } else {
        // Try to convert whatever we got
        imageBuffer = Buffer.from(imageData);
      }

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

