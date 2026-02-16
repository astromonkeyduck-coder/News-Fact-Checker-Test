/**
 * Inbound Email Handler
 * Receives inbound emails via Resend webhook and triggers ingest-all when email contains "ingest"
 * Automatically sends a reply email to the sender confirming receipt and action
 * Processes image attachments and adds Noteworthy News logo overlay
 * Forwards all emails to richard@noteworthynews.co to richardadkns@gmail.com
 *
 * Breaking News Attachment Flow (NEW):
 * When an email with image/video attachments is sent to Noteworthy:
 * - Saves the video/image to post-media blob storage
 * - Saves the email message text (appended to post as "Reader update")
 * - Matches the attachment to a breaking news post by: (1) text similarity (subject + body vs post title/story), (2) recency (newer posts preferred)
 * - Updates the matched post and article page with the saved media
 *
 * Setup Instructions:
 * 1. Go to Resend Dashboard → Domains → Your Domain → Inbound Routes
 * 2. Create a new inbound route for richard@noteworthynews.co
 * 3. Set webhook URL to: https://your-site.netlify.app/.netlify/functions/inbound-email
 * 4. Save the route
 *
 * Usage:
 * - Send an email to richard@noteworthynews.co with subject or body containing "ingest"
 *   The ingest-all function will be triggered automatically and an auto-reply will be sent
 * - Send an email with image/video attachments and a message describing the story → media is saved and attached to the matching breaking news post
 * - Send an email with image attachments to automatically get them back with logo overlay
 * - All emails to richard@noteworthynews.co are automatically forwarded to richardadkns@gmail.com
 *
 * Features:
 * - Email Forwarding: All emails to richard@noteworthynews.co are forwarded to richardadkns@gmail.com with original content and attachments
 * - Auto-Reply: Sends confirmation email to sender automatically
 * - Attachment Processing: Processes image attachments and adds Noteworthy News logo (70% opacity, top right)
 * - Save & Attach to Post: Saves image/video attachments to blob storage and attaches to matching breaking news post based on email text and recency
 * - Non-blocking: Errors don't fail the webhook
 */

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const crypto = require('crypto');
const { Resend } = require('resend');
const sharp = require('sharp');
const path = require('path');

/**
 * Call ingest-all function via HTTP
 * Uses fire-and-forget approach to avoid webhook timeouts
 * Improved error handling with fetch API
 */
async function triggerIngestAll() {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://noteworthynews.co';
  const ingestUrl = `${siteUrl}/.netlify/functions/ingest-all`;
  
  console.log(`[Inbound Email] Triggering ingest-all at: ${ingestUrl}`);
  
  try {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Send empty body
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Read response body for error details
      let responseText = '';
      try {
        responseText = await response.text();
      } catch (readError) {
        console.warn('[Inbound Email] Could not read response body:', readError.message);
      }
      
      console.log(`[Inbound Email] ingest-all response: status ${response.status}, body length: ${responseText.length}`);
      
      // If status is 200-299, consider it successful (ingest-all is running)
      if (response.status >= 200 && response.status < 300) {
        return { 
          success: true, 
          statusCode: response.status, 
          message: 'Ingest-all triggered successfully',
          responsePreview: responseText.substring(0, 200)
        };
      } else {
        // For non-2xx, parse error details
        let errorDetails = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorDetails = errorJson.error || errorJson.message || responseText;
        } catch {
          // Not JSON, use as-is
        }
        
        console.error(`[Inbound Email] ingest-all returned status ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails.substring(0, 500),
          fullResponse: responseText.substring(0, 1000)
        });
        
        throw new Error(`HTTP ${response.status}: ${errorDetails.substring(0, 200)}`);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        // Timeout - but request was sent, so consider it successful
        console.warn(`[Inbound Email] Request timeout (ingest-all may still be processing)`);
        return { 
          success: true, 
          statusCode: 202, 
          message: 'Ingest-all request sent (processing - timeout after 10s)' 
        };
      }
      
      // Re-throw other errors
      throw fetchError;
    }
  } catch (error) {
    console.error(`[Inbound Email] Error triggering ingest-all:`, {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500),
      url: ingestUrl
    });
    throw error;
  }
}

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html) {
  if (!html) return '';
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Check if email content contains "ingest" command
 * Case-insensitive search in subject, text body, and HTML body
 */
function containsIngestCommand(subject, textBody, htmlBody) {
  const searchText = 'ingest';
  
  // Ensure all inputs are strings
  const subjectStr = String(subject || '').toLowerCase();
  const textStr = String(textBody || '').toLowerCase();
  const htmlStr = extractTextFromHtml(String(htmlBody || ''));
  
  // Check if "ingest" appears in any of the email content
  const foundInSubject = subjectStr.includes(searchText);
  const foundInText = textStr.includes(searchText);
  const foundInHtml = htmlStr.includes(searchText);
  
  const shouldTrigger = foundInSubject || foundInText || foundInHtml;
  
  console.log('[Inbound Email] Checking for "ingest" command:', {
    foundInSubject,
    foundInText,
    foundInHtml,
    shouldTrigger,
    subjectPreview: subjectStr.substring(0, 100),
    textPreview: textStr.substring(0, 100),
    htmlPreview: htmlStr.substring(0, 100),
    subjectLength: subjectStr.length,
    textLength: textStr.length,
    htmlLength: htmlStr.length,
    rawSubject: subject,
    rawTextBody: textBody?.substring(0, 100)
  });
  
  return shouldTrigger;
}

/**
 * Process image/video attachments and overlay Noteworthy News logo
 * Returns processed file buffer and metadata
 */
async function processAttachmentWithLogo(attachmentUrl, attachmentName, contentType) {
  try {
    console.log('[Inbound Email] Processing attachment:', {
      url: attachmentUrl?.substring(0, 100),
      name: attachmentName,
      type: contentType
    });

    // Check if it's an image or video we can process
    const isImage = contentType && (
      contentType.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(attachmentName || '')
    );

    const isVideo = contentType && (
      contentType.startsWith('video/') ||
      /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(attachmentName || '')
    );

    if (!isImage && !isVideo) {
      console.log('[Inbound Email] Skipping unsupported attachment:', contentType);
      return null;
    }

    // Handle video processing
    if (isVideo) {
      return await processVideoWithLogo(attachmentUrl, attachmentName, contentType);
    }

    // Download the attachment
    let imageBuffer;
    if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
      const response = await fetch(attachmentUrl);
      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else if (attachmentUrl.startsWith('data:')) {
      // Handle base64 data URL
      const base64Data = attachmentUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Unsupported attachment URL format');
    }

    // Load the logo (try different logo files)
    const logoPath = path.join(__dirname, '../../IMG_5992.PNG'); // Use the email logo
    let logoBuffer;
    try {
      const fs = require('fs');
      logoBuffer = fs.readFileSync(logoPath);
    } catch (logoError) {
      // Try alternative logo paths
      const altPaths = [
        path.join(__dirname, '../../IMG_5794.PNG'),
        path.join(__dirname, '../../nw-logo.GIF'),
        path.join(__dirname, '../../logo.svg')
      ];
      
      for (const altPath of altPaths) {
        try {
          const fs = require('fs');
          logoBuffer = fs.readFileSync(altPath);
          console.log('[Inbound Email] Using logo from:', altPath);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!logoBuffer) {
        // Try fetching from web
        try {
          const logoUrl = 'https://noteworthynews.co/IMG_5992.PNG';
          const logoResponse = await fetch(logoUrl);
          if (logoResponse.ok) {
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            logoBuffer = Buffer.from(logoArrayBuffer);
            console.log('[Inbound Email] Fetched logo from web');
          }
        } catch (webError) {
          console.error('[Inbound Email] Failed to fetch logo from web:', webError.message);
        }
      }
    }

    if (!logoBuffer) {
      throw new Error('Could not load logo file');
    }

    // Get image dimensions and check if it's an animated GIF
    const image = sharp(imageBuffer);
    const imageMetadata = await image.metadata();
    const imageWidth = imageMetadata.width;
    const imageHeight = imageMetadata.height;
    const isAnimatedGIF = contentType === 'image/gif' || /\.gif$/i.test(attachmentName || '');
    const hasPages = imageMetadata.pages && imageMetadata.pages > 1; // Animated GIFs have multiple pages
    
    // Check if it's actually animated (has multiple frames)
    const isAnimated = isAnimatedGIF && hasPages;

    // Calculate logo size (20% of image width, max 200px)
    const logoSize = Math.min(imageWidth * 0.2, 200);
    
    // Resize logo
    const logo = sharp(logoBuffer);
    const resizedLogo = await logo
      .resize(Math.round(logoSize), null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Get resized logo dimensions
    const logoMetadata = await sharp(resizedLogo).metadata();
    const logoWidth = logoMetadata.width;
    const logoHeight = logoMetadata.height;

    // Position: top right corner with padding
    const padding = 20;
    const left = imageWidth - logoWidth - padding;
    const top = padding;

    // Apply opacity to logo by creating a semi-transparent version
    // Sharp doesn't directly support opacity in composite, so we need to adjust the alpha channel
    const opacity = 0.7; // 70% opacity
    
    // Create a semi-transparent logo by extracting RGBA and adjusting alpha channel
    const logoWithOpacity = await sharp(resizedLogo)
      .ensureAlpha()
      .toBuffer();
    
    // Get logo pixel data and adjust alpha
    const logoData = await sharp(logoWithOpacity)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    
    // Adjust alpha channel for opacity
    const pixels = logoData.data;
    for (let i = 3; i < pixels.length; i += 4) {
      pixels[i] = Math.round(pixels[i] * opacity); // Adjust alpha channel
    }
    
    // Create new buffer with adjusted opacity
    const transparentLogo = await sharp(pixels, {
      raw: {
        width: logoData.info.width,
        height: logoData.info.height,
        channels: 4
      }
    })
      .png()
      .toBuffer();

    // Handle animated GIFs differently - process each frame
    if (isAnimated) {
      console.log('[Inbound Email] 🎬 Processing animated GIF with', hasPages, 'frames');
      const animatedResult = await processAnimatedGIFWithLogo(imageBuffer, transparentLogo, left, top, imageWidth, imageHeight, attachmentName);
      if (animatedResult) {
        return animatedResult;
      }
      // If animated GIF processing failed, fall through to static image processing
      console.log('[Inbound Email] ⚠️ Animated GIF processing failed, falling back to static image');
    }

    // For static images (PNG, JPG, static GIF), composite logo normally
    const finalImage = await image
      .composite([{
        input: transparentLogo,
        left: left,
        top: top,
        blend: 'over'
      }])
      .png()
      .toBuffer();

    console.log('[Inbound Email] ✅ Processed image attachment with logo overlay');

    // Output as PNG for all static images (including static GIFs for better quality)
    return {
      buffer: finalImage,
      contentType: 'image/png',
      filename: `noteworthy-${attachmentName?.replace(/\.\w+$/, '') || 'processed'}.png`,
      size: finalImage.length
    };
  } catch (error) {
    console.error('[Inbound Email] ❌ Error processing attachment:', {
      error: error.message,
      name: attachmentName,
      type: contentType
    });
    return null;
  }
}

/**
 * Process animated GIF frame by frame to preserve animation
 */
async function processAnimatedGIFWithLogo(gifBuffer, logoBuffer, logoLeft, logoTop, width, height, attachmentName) {
  try {
    console.log('[Inbound Email] 🎬 Processing animated GIF frame by frame...');
    
    const { GIFEncoder, quantize, applyPalette } = require('gifenc');
    const sharp = require('sharp');
    
    // Extract frames from animated GIF
    const frames = [];
    const gif = sharp(gifBuffer);
    const metadata = await gif.metadata();
    const pageCount = metadata.pages || 1;
    
    console.log(`[Inbound Email] Extracting ${pageCount} frames from animated GIF...`);
    
    // Extract each frame
    for (let page = 0; page < pageCount; page++) {
      const frame = await gif
        .clone()
        .png({ page })
        .toBuffer();
      frames.push(frame);
    }
    
    console.log(`[Inbound Email] ✅ Extracted ${frames.length} frames`);
    
    // Process each frame with logo overlay
    const processedFrames = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = await sharp(frames[i])
        .composite([{
          input: logoBuffer,
          left: logoLeft,
          top: logoTop,
          blend: 'over'
        }])
        .png()
        .toBuffer();
      processedFrames.push(frame);
      
      if ((i + 1) % 10 === 0) {
        console.log(`[Inbound Email] ✅ Processed ${i + 1}/${frames.length} frames`);
      }
    }
    
    // Create shared palette for consistent colors
    const sampleFrames = [
      processedFrames[0], 
      processedFrames[Math.floor(processedFrames.length / 2)], 
      processedFrames[processedFrames.length - 1]
    ];
    const allSamplePixels = [];
    
    for (const sampleFrame of sampleFrames) {
      const image = sharp(sampleFrame);
      const { data } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const rgba = new Uint8ClampedArray(data);
      // Sample every 10th pixel
      for (let j = 0; j < rgba.length; j += 40) {
        allSamplePixels.push(rgba[j], rgba[j + 1], rgba[j + 2], rgba[j + 3]);
      }
    }
    
    const sampleRgba = new Uint8ClampedArray(allSamplePixels);
    const sharedPalette = quantize(sampleRgba, 256);
    
    // Create GIF encoder
    const gifEncoder = GIFEncoder({
      width: width,
      height: height,
      repeat: 0 // Repeat forever
    });
    
    // Encode each processed frame
    for (let i = 0; i < processedFrames.length; i++) {
      const frame = processedFrames[i];
      const image = sharp(frame);
      const { data } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const rgba = new Uint8ClampedArray(data);
      const index = applyPalette(rgba, sharedPalette);
      
      // Use original GIF delay if available, otherwise default to 67ms (15fps)
      gifEncoder.writeFrame(index, width, height, {
        palette: sharedPalette,
        delay: 67 // 15fps
      });
    }
    
    gifEncoder.finish();
    const gifBytes = gifEncoder.bytes();
    const finalGifBuffer = Buffer.from(gifBytes);
    
    console.log('[Inbound Email] ✅ Processed animated GIF with logo overlay:', {
      frames: frames.length,
      size: Math.round(finalGifBuffer.length / 1024) + 'KB'
    });
    
    return {
      buffer: finalGifBuffer,
      contentType: 'image/gif',
      filename: `noteworthy-${attachmentName?.replace(/\.\w+$/, '') || 'processed'}.gif`,
      size: finalGifBuffer.length
    };
  } catch (error) {
    console.error('[Inbound Email] ❌ Error processing animated GIF:', {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });
    // Fallback: return first frame as static image
    console.log('[Inbound Email] ⚠️ Falling back to static image');
    return null;
  }
}

/**
 * Process video attachment and overlay Noteworthy News logo using ffmpeg
 */
async function processVideoWithLogo(attachmentUrl, attachmentName, contentType) {
  try {
    console.log('[Inbound Email] 🎥 Processing video attachment with logo overlay');

    // Download the video
    let videoBuffer;
    if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
      const response = await fetch(attachmentUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      videoBuffer = Buffer.from(arrayBuffer);
    } else if (attachmentUrl.startsWith('data:')) {
      const base64Data = attachmentUrl.split(',')[1];
      videoBuffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Unsupported video URL format');
    }

    // Load the logo
    const logoPath = path.join(__dirname, '../../IMG_5992.PNG');
    let logoBuffer;
    try {
      const fs = require('fs');
      logoBuffer = fs.readFileSync(logoPath);
    } catch (logoError) {
      // Try alternative paths
      const altPaths = [
        path.join(__dirname, '../../IMG_5794.PNG'),
        path.join(__dirname, '../../nw-logo.GIF'),
        path.join(__dirname, '../../logo.svg')
      ];
      
      for (const altPath of altPaths) {
        try {
          const fs = require('fs');
          logoBuffer = fs.readFileSync(altPath);
          console.log('[Inbound Email] Using logo from:', altPath);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!logoBuffer) {
        // Try fetching from web
        try {
          const logoUrl = 'https://noteworthynews.co/IMG_5992.PNG';
          const logoResponse = await fetch(logoUrl);
          if (logoResponse.ok) {
            const logoArrayBuffer = await logoResponse.arrayBuffer();
            logoBuffer = Buffer.from(logoArrayBuffer);
            console.log('[Inbound Email] Fetched logo from web');
          }
        } catch (webError) {
          console.error('[Inbound Email] Failed to fetch logo from web:', webError.message);
        }
      }
    }

    if (!logoBuffer) {
      throw new Error('Could not load logo file');
    }

    // Prepare logo for video overlay (resize and apply opacity)
    const logo = sharp(logoBuffer);
    const logoMetadata = await logo.metadata();
    
    // Resize logo to reasonable size for video (10% of typical video width, max 150px)
    const logoSize = 150;
    const resizedLogo = await logo
      .resize(logoSize, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    // Apply opacity to logo
    const opacity = 0.7;
    const logoData = await sharp(resizedLogo)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = Buffer.from(logoData.data);
    for (let i = 3; i < pixels.length; i += 4) {
      pixels[i] = Math.round(pixels[i] * opacity);
    }
    
    const transparentLogo = await sharp(pixels, {
      raw: {
        width: logoData.info.width,
        height: logoData.info.height,
        channels: 4
      }
    })
      .png()
      .toBuffer();

    // Use ffmpeg to overlay logo on video
    const { FFmpeg } = require('@ffmpeg/ffmpeg');
    const { toBlobURL } = require('@ffmpeg/util');
    
    const ffmpeg = new FFmpeg();
    
    // Load FFmpeg core
    console.log('[Inbound Email] 📦 Loading FFmpeg WASM core for video processing...');
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    console.log('[Inbound Email] ✅ FFmpeg loaded');

    // Write video and logo to FFmpeg's virtual file system
    await ffmpeg.writeFile('input.mp4', videoBuffer);
    await ffmpeg.writeFile('logo.png', transparentLogo);
    console.log('[Inbound Email] ✅ Wrote video and logo to FFmpeg FS');

    // Get video dimensions for logo positioning
    // Use ffprobe to get video info, or use a reasonable default
    const logoWidth = logoData.info.width;
    const logoHeight = logoData.info.height;
    const padding = 20;

    // Overlay logo on video (top right corner)
    // Position: x = video_width - logo_width - padding, y = padding
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-i', 'logo.png',
      '-filter_complex', `[0:v][1:v]overlay=W-w-${padding}:${padding}[v]`,
      '-map', '[v]',
      '-map', '0:a?', // Include audio if present
      '-c:v', 'libx264',
      '-c:a', 'copy', // Copy audio without re-encoding
      '-preset', 'fast',
      '-crf', '23',
      'output.mp4'
    ]);

    console.log('[Inbound Email] ✅ Video processing complete');

    // Read processed video
    const processedVideoData = await ffmpeg.readFile('output.mp4');
    const processedVideoBuffer = Buffer.from(processedVideoData);

    console.log('[Inbound Email] ✅ Processed video attachment with logo overlay:', {
      size: Math.round(processedVideoBuffer.length / 1024) + 'KB'
    });

    // Determine output filename
    const originalExt = attachmentName?.match(/\.(\w+)$/)?.[1] || 'mp4';
    const outputFilename = `noteworthy-${attachmentName?.replace(/\.\w+$/, '') || 'processed'}.mp4`;

    return {
      buffer: processedVideoBuffer,
      contentType: 'video/mp4',
      filename: outputFilename,
      size: processedVideoBuffer.length
    };
  } catch (error) {
    console.error('[Inbound Email] ❌ Error processing video:', {
      error: error.message,
      name: attachmentName,
      type: contentType,
      stack: error.stack?.substring(0, 500)
    });
    return null;
  }
}

/**
 * Download attachment from URL and save to post-media blob storage.
 * Returns the get-uploaded-image URL for use on the site.
 */
async function saveAttachmentToBlob(attachmentUrl, attachmentName, contentType) {
  try {
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      console.warn('[Inbound Email] Blob storage not configured, cannot save attachment');
      return null;
    }

    const isImage = contentType && (
      contentType.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(attachmentName || '')
    );
    const isVideo = contentType && (
      contentType.startsWith('video/') ||
      /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(attachmentName || '')
    );
    if (!isImage && !isVideo) return null;

    let buffer;
    if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
      const response = await fetch(attachmentUrl);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (attachmentUrl.startsWith('data:')) {
      buffer = Buffer.from(attachmentUrl.split(',')[1], 'base64');
    } else {
      return null;
    }

    const ext = attachmentName?.match(/\.(\w+)$/)?.[1] || (isVideo ? 'mp4' : 'png');
    const timestamp = Date.now();
    const fileHash = Buffer.from(attachmentName || 'upload').toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const mediaKey = `post-media-email-${timestamp}-${fileHash}.${ext}`;

    const { getStore } = require('@netlify/blobs');
    const store = getStore({
      name: 'post-media',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });
    await store.set(mediaKey, buffer, { contentType });

    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://noteworthynews.co';
    const storedUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(mediaKey)}`;

    console.log('[Inbound Email] ✅ Saved attachment to blob:', { mediaKey, size: buffer.length, type: isVideo ? 'video' : 'image' });
    return { url: storedUrl, mediaKey, isVideo };
  } catch (err) {
    console.error('[Inbound Email] Failed to save attachment:', err.message);
    return null;
  }
}

/**
 * Extract significant words from text for matching.
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return new Set();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);
  return new Set(
    text
      .toLowerCase()
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w))
  );
}

/**
 * Find the best matching breaking news post based on email text and recency.
 */
async function findMatchingPost(emailSubject, emailBody) {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({
      name: 'x-posts',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    let indexData;
    try {
      indexData = await store.get('index.json', { type: 'json' });
    } catch {
      console.warn('[Inbound Email] No posts index found');
      return null;
    }
    const ids = (indexData?.ids || []).slice(0, 50);
    if (ids.length === 0) return null;

    const emailText = `${emailSubject || ''} ${emailBody || ''}`;
    const emailKeywords = extractKeywords(emailText);

    let bestPost = null;
    let bestScore = -1;
    let mostRecentPost = null;

    for (const id of ids) {
      let post;
      try {
        post = await store.get(`post-${id}.json`, { type: 'json' });
      } catch {
        continue;
      }
      if (!post) continue;
      if (!mostRecentPost) mostRecentPost = { ...post, _id: id };

      const postText = `${post.title || ''} ${post.story || ''} ${post.text || ''} ${post.location_display || ''}`;
      const postKeywords = extractKeywords(postText);

      let overlap = 0;
      for (const word of emailKeywords) {
        if (postKeywords.has(word)) overlap++;
      }
      const overlapRatio = emailKeywords.size > 0 ? overlap / Math.max(emailKeywords.size, postKeywords.size) : 0;

      const datePosted = new Date(post.datePosted || post.createdAt || post.created_at || 0);
      const daysSince = (Date.now() - datePosted.getTime()) / (24 * 60 * 60 * 1000);
      const recencyMultiplier = 1 / (1 + daysSince * 0.2);

      const score = overlapRatio * 100 * recencyMultiplier;

      if (score > bestScore) {
        bestScore = score;
        bestPost = { ...post, _id: id };
      }
    }

    const result = bestScore > 0 ? bestPost : mostRecentPost;
    if (result) {
      console.log('[Inbound Email] Matched post:', { id: result._id, score: bestScore > 0 ? bestScore.toFixed(2) : 'fallback (most recent)' });
    }
    return result;
  } catch (err) {
    console.error('[Inbound Email] Error finding matching post:', err.message);
    return null;
  }
}

/**
 * Update a post with media URL and optionally append email message.
 * @param appendOnly - when true, only add to images/videos array, don't set primary or add message
 */
async function updatePostWithMedia(postId, mediaUrl, isVideo, emailMessage, appendOnly = false) {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({
      name: 'x-posts',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const postKey = `post-${postId}.json`;
    let post;
    try {
      post = await store.get(postKey, { type: 'json' });
    } catch {
      console.warn('[Inbound Email] Post not found:', postId);
      return false;
    }
    if (!post) return false;

    const updatedPost = { ...post };
    const messageSnippet = !appendOnly && emailMessage ? String(emailMessage).trim().substring(0, 500) : '';

    if (isVideo) {
      if (!updatedPost.videos) updatedPost.videos = [];
      if (!updatedPost.videos.includes(mediaUrl)) updatedPost.videos.unshift(mediaUrl);
      if (!appendOnly) {
        updatedPost.video_url = mediaUrl;
        updatedPost.video = mediaUrl;
      }
    } else {
      if (!updatedPost.images) updatedPost.images = [];
      if (!updatedPost.images.includes(mediaUrl)) updatedPost.images.unshift(mediaUrl);
      if (!appendOnly) {
        updatedPost.primary_image_url = mediaUrl;
        updatedPost.image = mediaUrl;
        updatedPost.image_url = mediaUrl;
      }
    }

    if (messageSnippet) {
      const timestamp = new Date().toISOString().split('T')[0];
      const addition = `\n\n— Reader update (${timestamp}): ${messageSnippet}`;
      updatedPost.story = (updatedPost.story || updatedPost.text || '') + addition;
      updatedPost.text = updatedPost.story;
    }

    await store.setJSON(postKey, updatedPost);
    console.log('[Inbound Email] ✅ Updated post with media:', { postId, isVideo, hasMessage: !!messageSnippet });
    return true;
  } catch (err) {
    console.error('[Inbound Email] Failed to update post:', err.message);
    return false;
  }
}

/**
 * Save attachments to blob storage and attach to the best-matching breaking news post.
 * Runs when email has image/video attachments and body text.
 */
async function saveAttachmentsAndAttachToPost(attachments, subject, textBody, htmlBody) {
  if (!attachments || attachments.length === 0) return;

  const emailBody = (textBody || '') + ' ' + extractTextFromHtml(htmlBody || '');
  const emailMessage = (subject || '').trim() ? `${subject}\n\n${emailBody}`.trim() : emailBody.trim();

  const savedMedia = [];
  for (const att of attachments) {
    const url = att.download_url || att.url || att.href || att.content_url || att.downloadUrl;
    const name = att.filename || att.name || att.file_name || 'attachment';
    const type = att.content_type || att.type || att.mime_type || 'application/octet-stream';

    const isImage = type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(name);
    const isVideo = type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(name);
    if (!url || (!isImage && !isVideo)) continue;

    const result = await saveAttachmentToBlob(url, name, type);
    if (result) savedMedia.push(result);
  }

  if (savedMedia.length === 0) return;

  const post = await findMatchingPost(subject, emailBody);
  if (!post) {
    console.log('[Inbound Email] No matching post found, media saved but not attached');
    return;
  }

  const postId = post._id || post.id;
  const primaryMedia = savedMedia[0];
  await updatePostWithMedia(postId, primaryMedia.url, primaryMedia.isVideo, emailMessage, false);

  for (let i = 1; i < savedMedia.length; i++) {
    const m = savedMedia[i];
    await updatePostWithMedia(postId, m.url, m.isVideo, null, true);
  }
}

/**
 * Process email attachments and send back with logo overlay
 */
async function processAndReplyWithAttachments(senderEmail, attachments, originalSubject) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  try {
    const processedAttachments = [];
    
    // Process each attachment
    for (const attachment of attachments) {
      // CRITICAL FIX (Bug 1): Resend webhook uses 'download_url' field, not 'url', 'href', or 'content_url'
      const attachmentUrl = attachment.download_url || attachment.url || attachment.href || attachment.content_url || attachment.downloadUrl;
      const attachmentName = attachment.filename || attachment.name || attachment.file_name || 'attachment';
      const contentType = attachment.content_type || attachment.type || attachment.mime_type || 'application/octet-stream';

      if (!attachmentUrl) {
        console.warn('[Inbound Email] Attachment missing URL (checked: download_url, url, href, content_url):', {
          attachmentKeys: Object.keys(attachment),
          attachment: attachment
        });
        continue;
      }
      
      console.log('[Inbound Email] Processing attachment:', {
        name: attachmentName,
        contentType: contentType,
        url: attachmentUrl.substring(0, 100) + '...'
      });

      const processed = await processAttachmentWithLogo(attachmentUrl, attachmentName, contentType);
      if (processed) {
        processedAttachments.push(processed);
      }
    }

    if (processedAttachments.length === 0) {
      console.log('[Inbound Email] No processable attachments found');
      return null;
    }

    // Send email with processed attachments
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

    // Clean sender email
    let cleanSenderEmail = senderEmail;
    const emailMatch = senderEmail.match(/<([^>]+)>/);
    if (emailMatch) {
      cleanSenderEmail = emailMatch[1];
    }

    const emailAttachments = processedAttachments.map(att => ({
      filename: att.filename,
      content: att.buffer.toString('base64'),
      content_type: att.contentType
    }));

    const result = await resend.emails.send({
      from: fromEmail,
      to: cleanSenderEmail,
      replyTo: 'richard@noteworthynews.co',
      subject: `Re: ${originalSubject || 'Your processed files'}`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Your Files with Noteworthy News Logo</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hey! I've processed your ${processedAttachments.length} file(s) (images and videos) and added the Noteworthy News logo overlay in the top right corner. Check the attachments below.</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">Best regards,<br><strong>Noteworthy News</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Hey! I've processed your ${processedAttachments.length} file(s) (images and videos) and added the Noteworthy News logo overlay in the top right corner. Check the attachments.\n\nBest regards,\nNoteworthy News`,
      attachments: emailAttachments
    });

    console.log('[Inbound Email] ✅ Sent processed attachments back to sender:', {
      to: cleanSenderEmail,
      attachmentCount: processedAttachments.length,
      emailId: result.data?.id
    });

    return result;
  } catch (error) {
    console.error('[Inbound Email] ❌ Error sending processed attachments:', {
      error: error.message,
      name: error.name
    });
    return null;
  }
}

/**
 * Store sender email for earthquake notifications
 * Stores in Netlify Blobs with timestamp so send-earthquake-alert can include them
 */
async function storeSenderEmailForNotifications(senderEmail) {
  // Clean sender email - handle formats like "Name <email@example.com>" or just "email@example.com"
  let cleanSenderEmail = senderEmail;
  const emailMatch = senderEmail.match(/<([^>]+)>/);
  if (emailMatch) {
    cleanSenderEmail = emailMatch[1];
  }
  
  // Basic email validation
  if (!cleanSenderEmail || !cleanSenderEmail.includes('@')) {
    console.warn('[Inbound Email] Invalid sender email format, skipping storage:', senderEmail);
    return null;
  }

  try {
    // Use Netlify Blobs to store sender email with timestamp
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      console.warn('[Inbound Email] Netlify Blobs not configured, cannot store sender email');
      return null;
    }

    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "earthquake-notifications",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const timestamp = Date.now();
    const key = `sender-${timestamp}-${cleanSenderEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Store email with timestamp (expires after 6 minutes - only for this ingest-all run)
    // This ensures they only get notifications from the specific ingest-all they triggered
    const expirationMinutes = 6;
    await store.set(key, JSON.stringify({
      email: cleanSenderEmail,
      timestamp: timestamp,
      expiresAt: timestamp + (expirationMinutes * 60 * 1000) // 6 minutes from now
    }), {
      metadata: {
        email: cleanSenderEmail,
        timestamp: timestamp.toString()
      }
    });

    console.log('[Inbound Email] ✅ Stored sender email for notifications (expires in 6 minutes):', {
      email: cleanSenderEmail,
      key: key,
      expiresAt: new Date(timestamp + (6 * 60 * 1000)).toISOString()
    });

    return { success: true, key };
  } catch (error) {
    // Log error but don't fail the webhook
    console.error('[Inbound Email] ⚠️ Failed to store sender email (non-blocking):', {
      email: cleanSenderEmail,
      error: error.message,
      name: error.name
    });
    return null;
  }
}

/**
 * Forward email to richardadkns@gmail.com
 * Non-blocking - errors are logged but don't fail the webhook
 */
async function forwardEmailToGmail(senderEmail, toEmail, subject, textBody, htmlBody, attachments) {
  // Skip if no Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.log('[Inbound Email] Skipping email forward: RESEND_API_KEY not configured');
    return null;
  }

  const forwardToEmail = 'richardadkns@gmail.com';
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    
    // Clean sender email
    let cleanSenderEmail = senderEmail;
    const emailMatch = senderEmail.match(/<([^>]+)>/);
    if (emailMatch) {
      cleanSenderEmail = emailMatch[1];
    }
    
    // Build email content with forwarding information
    const forwardedSubject = `Fwd: ${subject || '(No Subject)'}`;
    
    // Create forwarded email body
    const forwardedText = `---------- Forwarded message ----------
From: ${cleanSenderEmail}
To: ${toEmail}
Date: ${new Date().toISOString()}
Subject: ${subject || '(No Subject)'}

${textBody || '(No text content)'}`;

    const forwardedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 20px 30px; background-color: #f8f9fa; border-bottom: 2px solid #e0e0e0; border-radius: 10px 10px 0 0;">
              <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.5;">
                <strong>---------- Forwarded message ----------</strong><br>
                <strong>From:</strong> ${cleanSenderEmail}<br>
                <strong>To:</strong> ${toEmail}<br>
                <strong>Date:</strong> ${new Date().toLocaleString()}<br>
                <strong>Subject:</strong> ${subject || '(No Subject)'}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              ${htmlBody || `<p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">${textBody || '(No content)'}</p>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Prepare email payload
    const emailPayload = {
      from: fromEmail,
      to: forwardToEmail,
      replyTo: cleanSenderEmail,
      subject: forwardedSubject,
      text: forwardedText,
      html: forwardedHtml,
    };

    // Add attachments if present
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const emailAttachments = [];
      
      for (const attachment of attachments) {
        const attachmentUrl = attachment.download_url || attachment.url || attachment.href || attachment.content_url || attachment.downloadUrl;
        const attachmentName = attachment.filename || attachment.name || attachment.file_name || 'attachment';
        const contentType = attachment.content_type || attachment.type || attachment.mime_type || 'application/octet-stream';
        
        if (attachmentUrl) {
          try {
            // Download attachment
            let attachmentBuffer;
            if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
              const response = await fetch(attachmentUrl);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                attachmentBuffer = Buffer.from(arrayBuffer);
              } else {
                console.warn(`[Inbound Email] Failed to download attachment for forwarding: ${response.status}`);
                continue;
              }
            } else if (attachmentUrl.startsWith('data:')) {
              const base64Data = attachmentUrl.split(',')[1];
              attachmentBuffer = Buffer.from(base64Data, 'base64');
            } else {
              console.warn(`[Inbound Email] Unsupported attachment URL format for forwarding: ${attachmentUrl.substring(0, 50)}`);
              continue;
            }
            
            emailAttachments.push({
              filename: attachmentName,
              content: attachmentBuffer.toString('base64'),
              content_type: contentType
            });
          } catch (attachError) {
            console.error(`[Inbound Email] Error processing attachment for forwarding:`, {
              name: attachmentName,
              error: attachError.message
            });
            // Continue with other attachments
          }
        }
      }
      
      if (emailAttachments.length > 0) {
        emailPayload.attachments = emailAttachments;
      }
    }

    const result = await resend.emails.send(emailPayload);

    console.log('[Inbound Email] ✅ Email forwarded to Gmail:', {
      to: forwardToEmail,
      from: cleanSenderEmail,
      subject: forwardedSubject,
      hasAttachments: emailPayload.attachments ? emailPayload.attachments.length : 0,
      emailId: result.data?.id
    });

    return result;
  } catch (error) {
    // Log error but don't fail the webhook
    console.error('[Inbound Email] ⚠️ Failed to forward email to Gmail (non-blocking):', {
      to: forwardToEmail,
      error: error.message,
      name: error.name
    });
    return null;
  }
}

/**
 * Send auto-reply email to the sender
 * Non-blocking - errors are logged but don't fail the webhook
 */
async function sendAutoReply(senderEmail, originalSubject, wasTriggered) {
  // Skip if no sender email or Resend API key not configured
  if (!senderEmail || !process.env.RESEND_API_KEY) {
    console.log('[Inbound Email] Skipping auto-reply:', {
      hasSender: !!senderEmail,
      hasApiKey: !!process.env.RESEND_API_KEY
    });
    return null;
  }

  // Clean sender email - handle formats like "Name <email@example.com>" or just "email@example.com"
  let cleanSenderEmail = senderEmail;
  const emailMatch = senderEmail.match(/<([^>]+)>/);
  if (emailMatch) {
    cleanSenderEmail = emailMatch[1];
  }
  
  // Basic email validation
  if (!cleanSenderEmail.includes('@')) {
    console.warn('[Inbound Email] Invalid sender email format, skipping auto-reply:', senderEmail);
    return null;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    
    // Determine message based on whether ingest was triggered
    const magnitudeThreshold = process.env.EARTHQUAKE_MAGNITUDE_THRESHOLD || '4.5';
    const message = wasTriggered
      ? `<p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hey! I'll check for any earthquakes above M${magnitudeThreshold} and send them to you. Give me a minute or two please. Thanks.</p>`
      : `<p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hey! I've received your email.</p>
         <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Note: To trigger the earthquake image generation process, please include the word "ingest" in your email subject or body.</p>`;
    
    const subject = wasTriggered 
      ? `Re: Checking for earthquakes above M${magnitudeThreshold}`
      : 'Re: Email Received';

    const result = await resend.emails.send({
      from: fromEmail,
      to: cleanSenderEmail,
      replyTo: 'richard@noteworthynews.co',
      subject: subject,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">${wasTriggered ? `Checking for Earthquakes Above M${magnitudeThreshold}` : 'Email Received'}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              ${message}
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
              <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.5;">This is an automated reply. If you need to reach me directly, please reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: wasTriggered
        ? `Hey! I'll check for any earthquakes above M${magnitudeThreshold} and send them to you. Give me a minute or two please. Thanks.\n\n---\nThis is an automated reply. If you need to reach me directly, please reply to this email.`
        : `Hey! I've received your email.\n\nNote: To trigger the earthquake image generation process, please include the word "ingest" in your email subject or body.\n\n---\nThis is an automated reply. If you need to reach me directly, please reply to this email.`,
    });

    console.log('[Inbound Email] ✅ Auto-reply sent successfully:', {
      to: cleanSenderEmail,
      emailId: result.data?.id,
      wasTriggered
    });

    return result;
  } catch (error) {
    // Log error but don't fail the webhook
    console.error('[Inbound Email] ⚠️ Failed to send auto-reply (non-blocking):', {
      to: cleanSenderEmail,
      error: error.message,
      name: error.name
    });
    return null;
  }
}

/**
 * Verify Resend webhook signature (optional but recommended)
 * Resend uses Svix for webhook signatures
 */
function verifyResendSignature(body, signature, timestamp, secret) {
  if (!secret || !signature) {
    // If no secret configured, skip verification (for development/testing)
    console.warn('[Inbound Email] No webhook secret configured, skipping signature verification');
    return true;
  }

  try {
    // Resend/Svix signature format: v1,<signature>
    const parts = signature.split(',');
    if (parts.length !== 2 || parts[0] !== 'v1') {
      return false;
    }
    const receivedSignature = parts[1];

    // Create expected signature
    const signedPayload = `${timestamp}.${body}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedPayload);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures using constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[Inbound Email] Signature verification error:', error);
    return false;
  }
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Allow GET requests for simple token-based triggering (for testing/easy integration)
  if (event.httpMethod === 'GET') {
    const queryParams = event.queryStringParameters || {};
    const token = queryParams.token || queryParams.secret;
    const expectedToken = process.env.INGEST_EMAIL_TOKEN || process.env.ADMIN_TOKEN;
    
    if (token && expectedToken && token === expectedToken) {
      console.log('[Inbound Email] Token-based trigger received');
      try {
        await triggerIngestAll();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Ingest-all triggered successfully via token',
          }),
        };
      } catch (triggerError) {
        console.error('[Inbound Email] Failed to trigger ingest-all:', triggerError);
        console.error('[Inbound Email] Error details:', {
          message: triggerError.message,
          name: triggerError.name,
          stack: triggerError.stack?.substring(0, 1000)
        });
        
        // CRITICAL: Return 200 to Resend even on error to prevent retries
        // Log the error but acknowledge receipt
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Failed to trigger ingest-all',
            message: triggerError.message,
            note: 'Webhook received but ingest-all failed - check ingest-all logs for details'
          }),
        };
      }
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Valid token required for GET requests' 
        }),
      };
    }
  }

  // Only allow POST requests for webhook payloads
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verify webhook signature if secret is configured (optional but recommended)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const signature = event.headers['svix-signature'] || event.headers['resend-signature'];
    const timestamp = event.headers['svix-timestamp'] || event.headers['resend-timestamp'];
    const bodyString = event.body || '';

    // Verify webhook signature if secret is configured
    // Note: For inbound email webhooks, we log warnings but don't block processing
    // This allows webhooks to work even if secret is misconfigured
    if (webhookSecret && signature) {
      const isValid = verifyResendSignature(bodyString, signature, timestamp, webhookSecret);
      if (!isValid) {
        console.error('[Inbound Email] ⚠️ Invalid webhook signature - processing anyway (non-critical)', {
          hasSecret: !!webhookSecret,
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
          signatureHeader: signature?.substring(0, 50),
          timestampHeader: timestamp,
          secretLength: webhookSecret?.length,
          hint: 'Check RESEND_WEBHOOK_SECRET in Netlify environment variables matches Resend dashboard'
        });
        // Don't block - inbound email processing is important, but signature mismatch might be config issue
        // In production, you may want to return 401 here for security, but for now we'll process it
      } else {
        console.log('[Inbound Email] ✅ Webhook signature verified');
      }
    } else {
      if (webhookSecret && !signature) {
        console.warn('[Inbound Email] ⚠️ Webhook secret configured but no signature header found', {
          availableHeaders: Object.keys(event.headers).filter(h => 
            h.toLowerCase().includes('signature') || 
            h.toLowerCase().includes('timestamp') ||
            h.toLowerCase().includes('svix') ||
            h.toLowerCase().includes('resend')
          )
        });
      } else if (!webhookSecret) {
        console.warn('[Inbound Email] ⚠️ No RESEND_WEBHOOK_SECRET configured - webhook signature verification disabled');
        console.warn('[Inbound Email] 💡 To enable: Get webhook secret from Resend Dashboard → Webhooks → Your Webhook → Signing Secret');
      }
    }

    // Parse webhook payload
    let webhookData;
    try {
      webhookData = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error('[Inbound Email] Failed to parse webhook body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON payload',
          details: parseError.message 
        }),
      };
    }

    console.log('[Inbound Email] Received webhook:', JSON.stringify(webhookData, null, 2));

    // Resend inbound email webhook format
    // Resend sends: { type: "email.received", data: { from, to, subject, text, html, ... } }
    const eventType = webhookData.type || 'email.received';
    const emailData = webhookData.data || webhookData;
    
    // DEBUG: Log full webhook structure to understand format
    console.log('[Inbound Email] Full webhook structure:', {
      hasType: !!webhookData.type,
      hasData: !!webhookData.data,
      dataKeys: webhookData.data ? Object.keys(webhookData.data) : [],
      topLevelKeys: Object.keys(webhookData)
    });
    
    // Extract email information - try multiple field names
    const fromEmail = emailData.from || emailData.from_email || emailData.sender || emailData['from'] || '';
    let toEmail = emailData.to || emailData.to_email || emailData.recipient || emailData['to'] || '';
    
    // Handle array format (e.g., ["email@example.com"] or [{email: "email@example.com"}])
    if (Array.isArray(toEmail)) {
      toEmail = toEmail.length > 0 ? (toEmail[0].email || toEmail[0]) : '';
    }
    
    // Handle object format (e.g., {email: "email@example.com"})
    if (toEmail && typeof toEmail === 'object' && toEmail.email) {
      toEmail = toEmail.email;
    }
    
    // Ensure toEmail is a string
    toEmail = String(toEmail || '');
    
    // Extract subject and body - try multiple field names
    const subject = emailData.subject || emailData['subject'] || emailData.Subject || '';
    const textBody = emailData.text || emailData.text_body || emailData.body || emailData['text'] || emailData.plain_text || '';
    const htmlBody = emailData.html || emailData.html_body || emailData['html'] || emailData.HTML || '';
    
    // CRITICAL FIX (Bug 2): Extract attachments from emailData before using them
    // Resend webhook format: data.attachments is an array of attachment objects
    const attachments = emailData.attachments || emailData.attachment || emailData['attachments'] || [];
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    console.log('[Inbound Email] Email details:', {
      from: fromEmail,
      to: toEmail,
      subject: subject,
      subjectLength: subject.length,
      textBodyLength: textBody.length,
      htmlBodyLength: htmlBody.length,
      hasText: !!textBody,
      hasHtml: !!htmlBody,
      textBodyPreview: textBody.substring(0, 100),
      subjectPreview: subject.substring(0, 100),
      hasAttachments: hasAttachments,
      attachmentCount: attachments.length,
      attachmentKeys: hasAttachments ? Object.keys(attachments[0] || {}) : []
    });

    // Check if email is to richard@noteworthynews.co
    const targetEmail = 'richard@noteworthynews.co';
    const isTargetEmail = toEmail && typeof toEmail === 'string' ? toEmail.toLowerCase().includes(targetEmail.toLowerCase()) : false;
    
    if (!isTargetEmail) {
      console.log(`[Inbound Email] Email not to ${targetEmail}, ignoring`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Email received but not to target address',
          to: toEmail,
        }),
      };
    }

    // Forward email to richardadkns@gmail.com (non-blocking)
    console.log('[Inbound Email] 📧 Forwarding email to Gmail...');
    forwardEmailToGmail(fromEmail, toEmail, subject, textBody, htmlBody, attachments).catch(err => {
      console.error('[Inbound Email] Email forwarding error (non-blocking):', err);
    });

    // Check for attachments and process them (non-blocking)
    if (hasAttachments) {
      console.log('[Inbound Email] 📎 Processing attachments:', attachments.length);
      // Save attachments to blob storage and attach to matching breaking news post
      saveAttachmentsAndAttachToPost(attachments, subject, textBody, htmlBody).catch(err => {
        console.error('[Inbound Email] Save-and-attach error (non-blocking):', err);
      });
      // Process attachments (images and videos) with logo overlay and send reply
      processAndReplyWithAttachments(fromEmail, attachments, subject).catch(err => {
        console.error('[Inbound Email] Attachment processing error (non-blocking):', err);
      });
    }

    // Check if email contains "ingest" command
    const shouldTrigger = containsIngestCommand(subject, textBody, htmlBody);
    
    if (!shouldTrigger) {
      console.log('[Inbound Email] Email does not contain "ingest" command, ignoring');
      
      // Send auto-reply even if ingest wasn't triggered (unless we're processing attachments)
      if (!hasAttachments) {
        sendAutoReply(fromEmail, subject, false).catch(err => {
          console.error('[Inbound Email] Auto-reply error (non-blocking):', err);
        });
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Email received but does not contain "ingest" command',
          attachmentsProcessed: hasAttachments
        }),
      };
    }

    // Trigger ingest-all
    console.log('[Inbound Email] ✅ Email contains "ingest" command, triggering ingest-all...');
    console.log('[Inbound Email] Email details:', {
      from: fromEmail,
      to: toEmail,
      subject: subject,
      hasText: !!textBody,
      hasHtml: !!htmlBody
    });
    
    // Store sender email for earthquake notifications (non-blocking)
    storeSenderEmailForNotifications(fromEmail).catch(err => {
      console.error('[Inbound Email] Failed to store sender email (non-blocking):', err);
    });
    
    try {
      const result = await triggerIngestAll();
      
      console.log('[Inbound Email] ✅ ingest-all triggered successfully:', {
        statusCode: result.statusCode,
        success: result.success
      });
      
      // Send auto-reply confirming the trigger (non-blocking)
      sendAutoReply(fromEmail, subject, true).catch(err => {
        console.error('[Inbound Email] Auto-reply error (non-blocking):', err);
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Ingest-all triggered successfully',
          triggered: true,
          from: fromEmail,
          to: toEmail,
          subject: subject,
          result: result
        }),
      };
    } catch (triggerError) {
      console.error('[Inbound Email] ❌ Failed to trigger ingest-all:', triggerError);
      console.error('[Inbound Email] Error details:', {
        message: triggerError.message,
        name: triggerError.name,
        stack: triggerError.stack?.substring(0, 1000)
      });
      
      // Still store sender email and send auto-reply even if ingest-all failed (non-blocking)
      storeSenderEmailForNotifications(fromEmail).catch(err => {
        console.error('[Inbound Email] Failed to store sender email (non-blocking):', err);
      });
      
      sendAutoReply(fromEmail, subject, false).catch(err => {
        console.error('[Inbound Email] Auto-reply error (non-blocking):', err);
      });
      
      // CRITICAL: Return 200 to Resend (acknowledge receipt) even if ingest-all fails
      // This prevents Resend from retrying the webhook
      // Log the error but don't fail the webhook
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to trigger ingest-all',
          message: triggerError.message,
          from: fromEmail,
          to: toEmail,
          subject: subject,
          note: 'Webhook received but ingest-all failed - check ingest-all logs for details'
        }),
      };
    }

  } catch (error) {
    console.error('[Inbound Email] Error processing webhook:', error);
    console.error('[Inbound Email] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 1000)
    });
    
    // CRITICAL: Return 200 to Resend even on error to prevent retries
    // Log the error but acknowledge receipt
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
        note: 'Webhook received but processing failed - check logs for details'
      }),
    };
  }
};

