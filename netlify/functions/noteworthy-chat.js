// Rate limiting: 10 messages per 30 minutes
const RATE_LIMIT_MESSAGES = 10;
const RATE_LIMIT_WINDOW = 30 * 60 * 1000; // 30 minutes in milliseconds

// Import Netlify Blobs for rate limit tracking
let getStore;
try {
  getStore = require('@netlify/blobs').getStore;
} catch (e) {
  console.warn('@netlify/blobs not available, rate limiting will be disabled');
}

/**
 * Fetch recent posts from blob storage for AI context
 */
async function fetchRecentPosts(event, limit = 10) {
  try {
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let store;
    if (siteID && token) {
      store = getStore({
        name: "x-posts",
        siteID: siteID,
        token: token,
      });
    } else {
      store = getStore({ name: "x-posts" });
    }

    // Read index
    let indexData = { ids: [] };
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob && Array.isArray(indexBlob.ids)) {
        indexData = indexBlob;
      }
    } catch (err) {
      console.log('[Noteworthy Chat] No posts index found');
      return [];
    }

    if (!indexData.ids || indexData.ids.length === 0) {
      return [];
    }

    // Get most recent posts (first N from index, which should be sorted by date)
    const postIds = indexData.ids.slice(0, Math.min(limit, indexData.ids.length));
    
    // Fetch posts in parallel
    const postPromises = postIds.map(async (id) => {
      try {
        const post = await store.get(id, { type: "json" });
        return post;
      } catch (err) {
        console.error(`[Noteworthy Chat] Error fetching post ${id}:`, err);
        return null;
      }
    });

    const posts = await Promise.all(postPromises);
    // Filter out nulls and sort by timestamp (newest first)
    const validPosts = posts
      .filter(p => p !== null)
      .sort((a, b) => {
        const timeA = a.timestamp || a.createdAt || 0;
        const timeB = b.timestamp || b.createdAt || 0;
        return timeB - timeA;
      })
      .slice(0, limit);

    return validPosts;
  } catch (error) {
    console.error('[Noteworthy Chat] Error fetching recent posts:', error);
    return [];
  }
}

/**
 * Get user identifier (IP address)
 */
function getUserIdentifier(event) {
  // Try various headers for IP (handles proxies, Cloudflare, etc.)
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         event.headers['x-real-ip'] ||
         event.headers['cf-connecting-ip'] ||
         event.requestContext?.identity?.sourceIp ||
         'unknown';
}

/**
 * Check if user has exceeded rate limit
 */
async function checkRateLimit(userId) {
  if (!getStore) {
    // Blobs not available, allow request (for local dev)
    return { allowed: true };
  }

  try {
    const store = getStore({ name: 'ai-rate-limits' });
    const key = `user-${userId}`;
    
    // Get existing timestamps
    let timestamps = [];
    try {
      const data = await store.get(key, { type: 'json' });
      if (Array.isArray(data)) {
        timestamps = data;
      }
    } catch (e) {
      // No existing data
    }

    const now = Date.now();
    // Filter out timestamps older than 30 minutes
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

    // Check if limit exceeded
    if (recentTimestamps.length >= RATE_LIMIT_MESSAGES) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const timeUntilReset = RATE_LIMIT_WINDOW - (now - oldestTimestamp);
      const minutesUntilReset = Math.ceil(timeUntilReset / 60000);
      
      return {
        allowed: false,
        remaining: 0,
        resetIn: minutesUntilReset,
      };
    }

    // Add current timestamp
    recentTimestamps.push(now);
    
    // Store updated timestamps (with expiry after 30 minutes)
    await store.set(key, JSON.stringify(recentTimestamps), {
      contentType: 'application/json',
      expiry: Math.floor((now + RATE_LIMIT_WINDOW) / 1000), // TTL in seconds
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MESSAGES - recentTimestamps.length,
      resetIn: null,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open)
    return { allowed: true };
  }
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Content-Type": "application/json",
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
    // Rate limiting check (only for POST requests)
    if (event.httpMethod === "POST") {
      const userId = getUserIdentifier(event);
      const rateLimit = await checkRateLimit(userId);
      
      if (!rateLimit.allowed) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: "Rate limit exceeded",
            message: `You've reached the limit of ${RATE_LIMIT_MESSAGES} messages per 30 minutes. Please try again in ${rateLimit.resetIn} minute(s).`,
            resetIn: rateLimit.resetIn,
          }),
        };
      }
      
      // Add rate limit info to response headers (optional)
      if (rateLimit.remaining !== undefined) {
        headers['X-RateLimit-Remaining'] = rateLimit.remaining.toString();
        headers['X-RateLimit-Limit'] = RATE_LIMIT_MESSAGES.toString();
      }
    }
    // Debug: Log the method we received
    console.log("Received request:", {
      method: event.httpMethod,
      path: event.path,
      hasBody: !!event.body
    });
    
    if (event.httpMethod !== "POST" && event.httpMethod !== "OPTIONS") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ 
          error: "Method Not Allowed",
          receivedMethod: event.httpMethod,
          expectedMethod: "POST"
        }),
      };
    }

    let requestBody;
    let message = "";
    let files = [];
    let chatHistory = [];
    
    // Parse request body as JSON (files are sent as base64 in JSON)
    try {
      let bodyStr = event.body || "{}";
      
      // Handle base64 encoded body
      if (event.isBase64Encoded) {
        bodyStr = Buffer.from(bodyStr, 'base64').toString('utf-8');
      }
      
      requestBody = JSON.parse(bodyStr);
      message = requestBody.message || "";
      files = requestBody.files || [];
      chatHistory = requestBody.chatHistory || [];
      
      // Log incoming files for debugging
      if (files && files.length > 0) {
        console.log("[Noteworthy Chat] Received files:", files.length, "files");
        files.forEach((file, idx) => {
          console.log(`[Noteworthy Chat] File ${idx + 1}:`, {
            name: file.name || 'unnamed',
            type: file.type || 'unknown',
            size: file.size || 0,
            hasData: !!file.data,
            dataLength: file.data ? file.data.length : 0,
          });
        });
      }
      
      // Validate chat history format and limit size
      if (Array.isArray(chatHistory)) {
        // Filter out invalid entries and ensure proper format
        chatHistory = chatHistory.filter(msg => {
          if (!msg || typeof msg !== 'object') return false;
          if (msg.role !== 'user' && msg.role !== 'assistant') return false;
          // Content can be string or array (for multimodal), but we'll normalize to string for history
          if (typeof msg.content === 'string' && msg.content.trim().length > 0) {
            // Limit individual message content size (max 2000 chars)
            if (msg.content.length > 2000) {
              msg.content = msg.content.substring(0, 2000) + '...';
            }
            return true;
          }
          // If content is an array, convert to string (for text parts only)
          if (Array.isArray(msg.content)) {
            const textParts = msg.content.filter(item => item.type === 'text').map(item => item.text).join(' ');
            if (textParts.trim().length > 0) {
              msg.content = textParts.length > 2000 ? textParts.substring(0, 2000) + '...' : textParts; // Normalize to string
              return true;
            }
          }
          return false;
        });
        
        // Limit total chat history to last 10 messages (5 exchanges) to prevent timeout and token limit issues
        if (chatHistory.length > 10) {
          chatHistory = chatHistory.slice(-10);
          console.log(`[Noteworthy Chat] Chat history limited to last 10 messages`);
        }
      } else {
        chatHistory = [];
      }
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    // Allow empty message if files are provided
    if ((!message || !message.trim()) && (!files || files.length === 0)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing message or files" }),
      };
    }

    // Convert unsupported file formats to supported formats
    // OpenAI GPT-4 Vision only supports: PNG, JPEG, WEBP, and non-animated GIF
    const SUPPORTED_IMAGE_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const SUPPORTED_EXTENSIONS = ['.png', '.jpeg', '.jpg', '.webp', '.gif'];
    
    /**
     * Convert unsupported file formats to PNG/JPEG
     */
    async function convertFileToSupportedFormat(file) {
      const fileType = (file.type || '').toLowerCase();
      const fileName = file.name || 'file';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      const base64Data = file.data.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      
      // Check if already supported
      const mimeTypeSupported = SUPPORTED_IMAGE_FORMATS.includes(fileType);
      const extensionSupported = SUPPORTED_EXTENSIONS.includes('.' + fileExtension);
      
      if (mimeTypeSupported || extensionSupported) {
        return file; // Already supported, return as-is
      }
      
      console.log(`[File Conversion] Converting ${fileName} (${fileType}) to supported format...`);
      
      try {
        // Handle PDF files
        // Note: PDF conversion temporarily disabled due to serverless compatibility issues
        // Users can convert PDFs to images manually or we'll add a better solution later
        if (fileType === 'application/pdf' || fileExtension === 'pdf') {
          console.log(`[File Conversion] ⚠️ PDF conversion not yet available in serverless environment`);
          // Return the file as-is - it will be rejected with a helpful error message
          return file;
        }
        
        // Handle HEIC/HEIF images
        if (fileType.includes('heic') || fileType.includes('heif') || fileExtension === 'heic' || fileExtension === 'heif') {
          const convert = require('heic-convert');
          const outputBuffer = await convert({
            buffer: fileBuffer,
            format: 'JPEG',
            quality: 0.92
          });
          
          const convertedBase64 = outputBuffer.toString('base64');
          console.log(`[File Conversion] ✅ HEIC converted to JPEG`);
          
          return {
            name: fileName.replace(/\.(heic|heif)$/i, '.jpg'),
            type: 'image/jpeg',
            data: convertedBase64,
            size: convertedBase64.length,
            converted: true,
            originalFormat: 'heic'
          };
        }
        
        // Handle other image formats (TIFF, BMP, SVG, ICO, etc.) using sharp
        if (fileType.startsWith('image/')) {
          const sharp = require('sharp');
          
          // Convert to PNG (most compatible)
          const convertedBuffer = await sharp(fileBuffer)
            .png({ quality: 90, compressionLevel: 6 })
            .toBuffer();
          
          const convertedBase64 = convertedBuffer.toString('base64');
          console.log(`[File Conversion] ✅ ${fileType} converted to PNG`);
          
          return {
            name: fileName.replace(/\.[^.]+$/, '.png'),
            type: 'image/png',
            data: convertedBase64,
            size: convertedBase64.length,
            converted: true,
            originalFormat: fileType
          };
        }
        
        // If we can't convert it, return original (will be rejected later)
        console.warn(`[File Conversion] ⚠️ Cannot convert ${fileType} - format not recognized`);
        return file;
        
      } catch (conversionError) {
        console.error(`[File Conversion] ❌ Error converting ${fileName}:`, conversionError);
        // Return original file - it will be rejected with a clear error message
        return file;
      }
    }
    
    // Process and convert files if needed
    if (files && files.length > 0) {
      const convertedFiles = [];
      const conversionErrors = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          const convertedFile = await convertFileToSupportedFormat(file);
          
          // Check if conversion was successful (file is now supported)
          const isSupported = SUPPORTED_IMAGE_FORMATS.includes(convertedFile.type?.toLowerCase()) ||
                             (convertedFile.name && SUPPORTED_EXTENSIONS.includes('.' + convertedFile.name.split('.').pop()?.toLowerCase()));
          
          if (isSupported) {
            // Handle multi-page PDFs - add all pages
            if (convertedFile._isMultiPage && convertedFile._allPages) {
              convertedFiles.push(...convertedFile._allPages);
              console.log(`[File Conversion] ✅ Successfully converted PDF: ${file.name} → ${convertedFile._allPages.length} page(s)`);
            } else {
              convertedFiles.push(convertedFile);
              if (convertedFile.converted) {
                console.log(`[File Conversion] ✅ Successfully converted: ${file.name} → ${convertedFile.name}`);
              }
            }
          } else {
            // Still unsupported after conversion attempt
            conversionErrors.push({
              name: file.name || 'unnamed file',
              type: file.type || 'unknown',
              error: 'Format not supported and conversion failed'
            });
          }
        } catch (error) {
          console.error(`[File Conversion] Error processing file ${file.name}:`, error);
          conversionErrors.push({
            name: file.name || 'unnamed file',
            type: file.type || 'unknown',
            error: error.message || 'Conversion failed'
          });
        }
      }
      
      // If we have conversion errors, return helpful error message
      if (conversionErrors.length > 0 && convertedFiles.length === 0) {
        const fileList = conversionErrors.map(f => `"${f.name}" (${f.type})`).join(', ');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: `Unable to process the uploaded files. Files are automatically converted when possible. Please ensure your files are images (PNG, JPEG, WEBP, GIF, HEIC, TIFF, BMP, SVG).`,
            details: `Files that couldn't be processed: ${fileList}. Note: Unsupported image formats (HEIC, TIFF, BMP, SVG) are automatically converted to PNG/JPEG. PDF conversion is not yet available - please convert PDFs to images first.`,
            supportedFormats: ['png', 'jpeg', 'gif', 'webp', 'heic', 'tiff', 'bmp', 'svg'],
            unsupportedFiles: conversionErrors
          }),
        };
      }
      
      // Replace files array with converted files
      if (convertedFiles.length > 0) {
        files = convertedFiles;
        console.log(`[File Conversion] Processed ${files.length} file(s), ${files.filter(f => f.converted).length} were converted`);
      }
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Debug info for local development
      const debugInfo = process.env.NETLIFY_DEV ? {
        availableEnvVars: Object.keys(process.env).filter(k => 
          k.toUpperCase().includes('OPENAI') || 
          k.toUpperCase().includes('CHATGPT') ||
          k.toUpperCase().includes('API')
        ),
        netlifyDev: process.env.NETLIFY_DEV
      } : undefined;
      
      console.error("OPENAI_API_KEY is not configured", debugInfo);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "API key not configured. Please set OPENAI_API_KEY in Netlify environment variables or .env file for local development.",
          debug: debugInfo
        }),
      };
    }
    
    // Don't log API key, even partially (security best practice)
    console.log("API key configured");

    // Auto-detect if message is requesting image generation
    function isImageRequest(msg) {
      const lowerMsg = msg.toLowerCase().trim();
      const imagePatterns = [
        /^(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(show\s+me|i\s+want)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(can\s+you\s+)?(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(an?|the)\s+(image|picture|photo|visual|illustration|drawing)\s+of\s+/i,
        /\b(picture|image|photo|visual|illustration|drawing)\s+of\s+/i,
        /^(generate|create|make|draw)\s+/i,
        // Catch simple requests like "now a dog", "a cat", "show me a dog"
        /^(now\s+)?(an?\s+)?(dog|cat|bird|car|house|person|tree|flower|sun|moon|star|animal|object|thing)\s*$/i,
        /^(show\s+me|give\s+me|i\s+want|i\s+need)\s+(an?\s+)?(dog|cat|bird|car|house|person|tree|flower|sun|moon|star|animal|object|thing)/i,
        // Catch requests with "now" followed by object
        /^now\s+(an?\s+)?[a-z]+/i
      ];
      
      for (const pattern of imagePatterns) {
        if (pattern.test(lowerMsg)) {
          console.log(`[Image Detection] Matched pattern for: "${msg}"`);
          return true;
        }
      }
      console.log(`[Image Detection] No pattern matched for: "${msg}"`);
      return false;
    }
    
    // Extract the actual prompt from an image request
    function extractImagePrompt(msg) {
      let prompt = msg.trim();
      const prefixes = [
        /^(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(show\s+me|i\s+want|give\s+me|i\s+need)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(can\s+you\s+)?(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(an?|the)\s+(image|picture|photo|visual|illustration|drawing)\s+of\s+/i,
        /\b(picture|image|photo|visual|illustration|drawing)\s+of\s+/i,
        /^(generate|create|make|draw)\s+/i,
        /^now\s+/i,
        /^(show\s+me|give\s+me|i\s+want|i\s+need)\s+/i
      ];
      
      for (const prefix of prefixes) {
        const match = prompt.match(prefix);
        if (match) {
          prompt = prompt.substring(match[0].length).trim();
          break;
        }
      }
      
      // If prompt is very short, add "a" if missing
      if (prompt && prompt.length < 20 && !prompt.match(/^(a|an|the)\s+/i)) {
        prompt = `a ${prompt}`;
      }
      
      return prompt || msg;
    }

    // Check if this is an image editing request (user uploaded image + edit instruction)
    function isImageEditRequest(msg, uploadedFiles) {
      if (!uploadedFiles || uploadedFiles.length === 0) return false;
      
      // Check if any uploaded file is an image
      const hasImage = uploadedFiles.some(file => file.type && file.type.startsWith('image/'));
      if (!hasImage) return false;
      
      const lowerMsg = (msg || '').toLowerCase().trim();
      const editPatterns = [
        /^(make|change|edit|modify|transform|convert|turn|paint|color|recolor)\s+(this|it|the\s+image|the\s+picture|the\s+photo)/i,
        /^(make|change|edit|modify|transform|convert|turn|paint|color|recolor)\s+.*\s+(this|it|the\s+image|the\s+picture|the\s+photo)/i,
        /(make|change|edit|modify|transform|convert|turn|paint|color|recolor)\s+(this|it|the\s+image|the\s+picture|the\s+photo)\s+/i,
        /^(add|remove|replace|swap|switch)\s+.*\s+(to|in|on|from)\s+(this|it|the\s+image|the\s+picture|the\s+photo)/i,
        /(blue|red|green|yellow|black|white|color|colors?|hue|shade|tone)\s+(this|it|the\s+image|the\s+picture|the\s+photo)/i,
        /^(this|it|the\s+image|the\s+picture|the\s+photo)\s+(but|with|in|as|to)\s+/i,
      ];
      
      for (const pattern of editPatterns) {
        if (pattern.test(lowerMsg)) {
          console.log(`[Image Edit Detection] Matched pattern for: "${msg}"`);
          return true;
        }
      }
      
      return false;
    }
    
    // Check if this is an image request
    const needsImage = isImageRequest(message);
    const needsImageEdit = isImageEditRequest(message, files);
    let imageData = null;
    
    // Handle image editing (user uploaded image + wants to edit it)
    if (needsImageEdit && files && files.length > 0) {
      try {
        // Find the first image file
        const imageFile = files.find(file => file.type && file.type.startsWith('image/'));
        if (imageFile && imageFile.data) {
          console.log("[Image Edit] Detected image edit request, calling generate-image function...");
          
          // Extract base64 data (remove data URL prefix if present)
          let imageBase64 = imageFile.data;
          if (imageBase64.includes(',')) {
            imageBase64 = imageBase64.split(',')[1];
          }
          
          // Call generate-image function for image-to-image editing
          // Construct absolute URL for fetch call
          const protocol = event.headers['x-forwarded-proto'] || 'https';
          const host = event.headers.host || event.headers['x-forwarded-host'] || 'noteworthynews.co';
          const baseUrl = `${protocol}://${host}`;
          const generateImageEndpoint = `${baseUrl}/.netlify/functions/generate-image`;
          const imageEditResponse = await fetch(generateImageEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: message, // User's edit instruction (e.g., "make this blue")
              image: imageBase64,
              imageType: imageFile.type || 'image/png',
              size: '1024x1024',
              quality: 'hd', // Use HD quality for better fidelity when editing
              style: 'vivid', // Vivid style preserves colors better
            }),
          });
          
          if (imageEditResponse.ok) {
            const imageEditData = await imageEditResponse.json();
            imageData = {
              imageUrl: imageEditData.imageUrl,
              revisedPrompt: imageEditData.revisedPrompt || message,
              prompt: imageEditData.prompt || message,
              isEdit: true,
            };
            console.log("[Image Edit] ✅ Image edited successfully:", {
              hasUrl: !!imageData.imageUrl,
              urlPreview: imageData.imageUrl ? imageData.imageUrl.substring(0, 50) + '...' : 'none',
            });
          } else {
            const errorData = await imageEditResponse.json().catch(() => ({}));
            console.error("[Image Edit] Image editing failed:", imageEditResponse.status, errorData);
            // Continue with regular chat response even if image editing fails
          }
        }
      } catch (imageEditError) {
        console.error("[Image Edit] Error editing image:", imageEditError);
        // Continue with regular chat response even if image editing fails
      }
    }
    
    // Generate new image if needed (before GPT call so GPT can reference it)
    if (needsImage && !needsImageEdit) {
      try {
        const imagePrompt = extractImagePrompt(message);
        console.log("Generating image with prompt:", imagePrompt.substring(0, 100) + "...");
        
        const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: imagePrompt.trim(),
            size: "1024x1024",
            quality: "standard",
            style: "vivid",
            n: 1,
          }),
        });

        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          imageData = {
            imageUrl: imageResult?.data?.[0]?.url || null,
            revisedPrompt: imageResult?.data?.[0]?.revised_prompt || imagePrompt,
            prompt: imagePrompt
          };
          console.log("Image generated successfully:", {
            hasUrl: !!imageData.imageUrl,
            urlPreview: imageData.imageUrl ? imageData.imageUrl.substring(0, 50) + '...' : 'none',
            revisedPrompt: imageData.revisedPrompt,
            fullImageUrl: imageData.imageUrl // Log full URL for debugging
          });
          
          if (!imageData.imageUrl) {
            console.error("Image generation returned no URL in response:", JSON.stringify(imageResult, null, 2));
          }
        } else {
          const errorText = await imageResponse.text().catch(() => 'Unknown error');
          console.error("Image generation failed:", imageResponse.status, errorText);
          // Continue with chat response even if image generation fails
        }
      } catch (imageError) {
        console.error("Error generating image:", imageError);
        // Continue with chat response even if image generation fails
      }
    }

    // Fetch recent posts for AI context (current events)
    let recentPosts = [];
    try {
      recentPosts = await fetchRecentPosts(event, 10); // Get 10 most recent posts
      console.log(`[Noteworthy Chat] Fetched ${recentPosts.length} recent posts for context`);
    } catch (error) {
      console.error('[Noteworthy Chat] Error fetching recent posts:', error);
      // Continue without posts - AI will still work
    }

    // Build messages array with chat history and current message
    let messages;
    let storedUploadedImages = [];
    
    // Build current events context from recent posts
    let currentEventsContext = '';
    if (recentPosts.length > 0) {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7); // Include posts from last 7 days
      
      const recentEvents = recentPosts
        .filter(post => {
          const postDate = post.timestamp || post.createdAt || 0;
          if (!postDate) return false;
          const postDateObj = new Date(postDate);
          // Include posts from the last 7 days (more inclusive for current events)
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return postDateObj >= weekAgo;
        })
        .map(post => {
          const title = post.title || post.story || post.text || 'Untitled';
          const date = post.timestamp || post.createdAt;
          const dateStr = date ? new Date(date).toLocaleDateString() : 'Recent';
          const category = post.category || 'News';
          const summary = post.summary || post.text?.substring(0, 200) || '';
          return `- ${dateStr}: ${title} (${category})${summary ? ` - ${summary}` : ''}`;
        })
        .slice(0, 5); // Limit to 5 most recent
      
      if (recentEvents.length > 0) {
        currentEventsContext = `\n\nCURRENT EVENTS FROM NOTEWORTHY NEWS (Verified Articles):
The following are REAL, VERIFIED news articles published on Noteworthy News. Use this information when answering questions about current events:

${recentEvents.join('\n')}

CRITICAL INSTRUCTIONS:
- You MUST use the information above when answering questions about current events
- You CAN discuss these verified articles and provide details from them
- If asked about events NOT listed above, you MUST say: "I don't have information about that specific event. For the latest verified news, please check Noteworthy News' articles or other trusted news sources."
- NEVER make up or fabricate events that are not in the list above`;
        console.log(`[Noteworthy Chat] ✅ Built current events context with ${recentEvents.length} events`);
        console.log(`[Noteworthy Chat] 📰 Sample events:`, recentEvents.slice(0, 2));
      } else {
        console.log('[Noteworthy Chat] ⚠️ No recent events found (all posts are older than 7 days)');
      }
    }
    
    try {
      // Build system prompt with current events context
      const systemPrompt = `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You are designed to help users with fact-checking, media literacy, and staying informed with verified news.

ABOUT NOTEWORTHY NEWS:
- Noteworthy News is committed to delivering accurate, fact-checked journalism in an era of information overload
- Mission: Reliable news is the foundation of an informed democracy
- Approach: Combines traditional journalistic standards with modern fact-checking tools
- Focus Areas: Breaking news, in-depth analysis, media literacy education, fact-checking games
- Tagline: "Trusted Journalism & Media Literacy"
       - Values: Fast, factual, Truth-Seeking

WHAT NOTEWORTHY NEWS OFFERS:
- Interactive fact-checking games to test media literacy skills
- Verified, trustworthy journalism and news stories
- Educational content on media literacy and digital literacy
- Fact-checking tools and verification resources
- Breaking news coverage with fact-checking
- Critical thinking skills development

YOUR ROLE:
- Help users understand current news stories and headlines
- Provide fact-checking assistance and verification tips
- Answer questions about media literacy and critical thinking
- Explain Noteworthy News' mission and services
- Generate images when users request them (you have access to DALL-E image generation)
- Analyze images and documents when users upload them
- Edit images when users upload an image and request modifications (e.g., "make this blue", "change the color", "edit this")
       - Be concise, neutral, and always Truth-Seeking
- When discussing news, emphasize the importance of multiple sources and verification

CRITICAL: BREAKING NEWS AND CURRENT EVENTS
${currentEventsContext ? '- You have access to REAL, VERIFIED current events from Noteworthy News articles (see below)' : '- You do NOT have access to real-time breaking news or current events'}
- You can discuss and provide details about the verified articles listed below
- You have access to OpenAI's native web_search tool that provides REAL-TIME, DEEP web research for breaking news and current events
- This is OpenAI's built-in, top-tier web search - it automatically searches the web when you need current information
- When asked about breaking news, recent events, or current developments NOT in the verified articles, the web_search tool will AUTOMATICALLY be used
- The web_search tool performs deep research across multiple sources and provides comprehensive, up-to-date information
- After web search completes, provide accurate, detailed, factual information from the search results
- Include specific details: dates, locations, names, sources, and context
- NEVER make up, invent, or fabricate breaking news events
- If web search doesn't find information, say: "I searched for current information but couldn't find verified details about that specific event. For the latest breaking news, please check direct news sources."
- Always prioritize accuracy and cite information when possible
${currentEventsContext}
- When an image has been generated for the user, acknowledge it naturally in your response
- When analyzing uploaded images or documents, provide detailed observations and insights

RESPONSE STYLE:
- Keep responses concise but informative (target: 2-4 sentences per point)
- Use clear, accessible language
- Cite principles of fact-checking when relevant
- Maintain a professional but approachable tone
- Do NOT include any attribution text like "generated by Noteworthy AI" or similar disclaimers in your responses
- Do NOT add footers, signatures, or attribution statements to your answers${currentEventsContext}`;

      messages = [
          {
            role: "system",
            content: systemPrompt,
          },
      ];
      
      // Store uploaded images in Netlify Blobs
      if (files && files.length > 0) {
        console.log(`[Noteworthy Chat] Processing ${files.length} file(s) for storage`);
        try {
          const { getStore } = require("@netlify/blobs");
          const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
          const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
          
          console.log(`[Noteworthy Chat] Blob storage config:`, {
            hasSiteID: !!siteID,
            hasToken: !!token,
            siteID: siteID ? siteID.substring(0, 10) + '...' : 'none',
          });
          
          let store;
          if (siteID && token) {
            store = getStore({
              name: "uploaded-images",
              siteID: siteID,
              token: token,
            });
          } else {
            store = getStore({ name: "uploaded-images" });
          }
          
          console.log(`[Noteworthy Chat] Blob store initialized successfully`);
          
          // Process each uploaded file
          for (const file of files) {
            if (file.type && file.type.startsWith("image/") && file.data) {
              try {
                // Generate unique key for the image
                const timestamp = Date.now();
                const fileHash = Buffer.from(file.name || 'upload').toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
                const fileExtension = file.name ? file.name.split('.').pop() : 'png';
                const imageKey = `upload-${timestamp}-${fileHash}.${fileExtension}`;
                
                // Convert base64 to buffer
                const base64Data = file.data.replace(/^data:image\/\w+;base64,/, '');
                if (!base64Data || base64Data.length === 0) {
                  console.error(`[Noteworthy Chat] Invalid base64 data for file: ${file.name}`);
                  continue;
                }
                
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
                console.log(`[Noteworthy Chat] Storing uploaded image: ${file.name}, size: ${imageBuffer.length} bytes, key: ${imageKey}`);
                
                // Store image in Netlify Blobs
                await store.set(imageKey, imageBuffer, {
                  contentType: file.type,
                });
                
                console.log(`[Noteworthy Chat] ✅ Image stored successfully: ${imageKey}`);
                
                // Generate URL to retrieve the stored image
                const storedImageUrl = `/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
                
                storedUploadedImages.push({
                  originalName: file.name,
                  type: file.type,
                  size: file.size || imageBuffer.length,
                  storedImageKey: imageKey,
                  storedImageUrl: storedImageUrl,
                  uploadedAt: new Date().toISOString(),
                });
                
                console.log(`[Noteworthy Chat] ✅ Uploaded image info added to array: ${imageKey}`);
                
                // Store metadata
                const metadataKey = `metadata-${imageKey}.json`;
                const metadata = {
                  originalName: file.name,
                  type: file.type,
                  size: file.size || imageBuffer.length,
                  uploadedAt: new Date().toISOString(),
                  imageKey: imageKey,
                };
                
                await store.set(metadataKey, JSON.stringify(metadata), {
                  contentType: "application/json",
                });
                
                console.log(`[Noteworthy Chat] ✅ Metadata stored: ${metadataKey}`);
                
                // Verify the image was actually stored by trying to retrieve it
                try {
                  const verifyImage = await store.get(imageKey);
                  if (verifyImage) {
                    console.log(`[Noteworthy Chat] ✅ Verification: Image ${imageKey} confirmed in storage (${verifyImage.length || 'unknown'} bytes)`);
                  } else {
                    console.error(`[Noteworthy Chat] ⚠️ Verification failed: Image ${imageKey} not found in storage after save`);
                  }
                } catch (verifyErr) {
                  console.error(`[Noteworthy Chat] ⚠️ Verification error for ${imageKey}:`, verifyErr);
                }
                
              } catch (fileErr) {
                console.error(`[Noteworthy Chat] ❌ Error storing uploaded image ${file.name}:`, fileErr);
                console.error(`[Noteworthy Chat] Error stack:`, fileErr.stack);
                // Continue with other files even if one fails
              }
            } else {
              console.log(`[Noteworthy Chat] Skipping file (not an image or no data): ${file.name}, type: ${file.type}, hasData: ${!!file.data}`);
            }
          }
          
          console.log(`[Noteworthy Chat] Finished processing files. Stored ${storedUploadedImages.length} image(s)`);
        } catch (blobErr) {
          console.error("[Noteworthy Chat] ❌ Error setting up blob storage for uploaded images:", blobErr);
          console.error("[Noteworthy Chat] Error stack:", blobErr.stack);
          console.error("[Noteworthy Chat] Error details:", {
            message: blobErr.message,
            name: blobErr.name,
            code: blobErr.code,
          });
          // Continue even if blob storage fails - we'll still use the base64 data for OpenAI
        }
      } else {
        console.log(`[Noteworthy Chat] No files to process for storage`);
      }
      
      // Build user message with files if provided
      if (files && files.length > 0) {
        const userContent = [];
        
        // Add text message if provided
        if (message && message.trim()) {
          userContent.push({
            type: "text",
            text: message,
          });
        }
        
        // Add image files - always use base64 for OpenAI (they can't access our internal URLs)
        // Images are stored separately in Blobs for our records
        files.forEach((file) => {
          if (file.type && file.type.startsWith("image/") && file.data) {
            // Always use base64 data URL for OpenAI API
            userContent.push({
              type: "image_url",
              image_url: {
                url: `data:${file.type};base64,${file.data}`,
              },
            });
          }
        });
        
        // Add chat history before current message
        if (chatHistory && chatHistory.length > 0) {
          console.log(`[Noteworthy Chat] Adding ${chatHistory.length} messages from chat history`);
          messages.push(...chatHistory);
        }
        
        messages.push({
          role: "user",
          content: userContent.length > 0 ? userContent : [{ type: "text", text: message || "Please analyze the uploaded files." }],
        });
      } else {
        // Regular text message
        // Add chat history before current message
        if (chatHistory && chatHistory.length > 0) {
          console.log(`[Noteworthy Chat] Adding ${chatHistory.length} messages from chat history`);
          messages.push(...chatHistory);
        }
        
        messages.push({ role: "user", content: message });
      }
      
      // Validate messages array before sending
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Invalid messages array");
      }
      
      // Limit total messages to prevent timeout (max 15 messages = system + 7 exchanges)
      if (messages.length > 15) {
        console.warn(`[Noteworthy Chat] Messages array too large (${messages.length}), limiting to 15`);
        // Keep system message and last 14 messages
        messages = [messages[0], ...messages.slice(-14)];
      }
      
      // Estimate token count (rough: 1 token ≈ 4 characters) and limit to ~8000 tokens
      const estimatedTokens = JSON.stringify(messages).length / 4;
      if (estimatedTokens > 8000) {
        console.warn(`[Noteworthy Chat] Estimated tokens too high (${Math.round(estimatedTokens)}), truncating messages`);
        // Keep system message and progressively remove older messages
        while (JSON.stringify(messages).length / 4 > 8000 && messages.length > 2) {
          // Remove oldest non-system message
          if (messages.length > 2) {
            messages.splice(1, 1);
          }
        }
      }
      
      console.log(`[Noteworthy Chat] Sending ${messages.length} messages to OpenAI (estimated ${Math.round(estimatedTokens)} tokens)`);
      
    } catch (messageBuildError) {
      console.error("[Noteworthy Chat] Error building messages array:", messageBuildError);
      console.error("[Noteworthy Chat] Error stack:", messageBuildError.stack);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to build message request",
          message: messageBuildError.message || "An error occurred while preparing the chat request",
        }),
      };
    }

    let r;
    try {
      // Use OpenAI Responses API with native web_search tool for real-time breaking news
      // This provides OpenAI's built-in, reliable web search - no scraping needed!
      r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.4,
          max_output_tokens: 2000, // Increased for country spotlight and detailed responses
          tools: [{ type: "web_search" }], // OpenAI's native web search - top of the line!
          input: messages.map(msg => ({
            role: msg.role,
            content: [{ type: "text", text: msg.content }]
          })),
        }),
      });
    } catch (fetchError) {
      console.error("[Noteworthy Chat] Error calling OpenAI API:", fetchError);
      console.error("[Noteworthy Chat] Error stack:", fetchError.stack);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to call OpenAI API",
          message: fetchError.message || "Network error while calling OpenAI",
        }),
      };
    }

    if (!r.ok) {
      let errorData;
      try {
        errorData = await r.json();
      } catch {
        const errorText = await r.text();
        errorData = { message: errorText || `HTTP ${r.status}` };
      }
      
      console.error("OpenAI API error:", r.status, errorData);
      return {
        statusCode: r.status,
        headers,
        body: JSON.stringify({ 
          error: errorData.error?.message || errorData.message || `OpenAI API error (${r.status})` 
        }),
      };
    }

    const data = await r.json();
    
    // Handle Responses API format (with native web_search)
    let reply = "No response generated.";
    const usage = data?.usage || null;
    
    // Responses API returns output as an array of content items
    if (data.output && Array.isArray(data.output)) {
      // Find text content in the output
      const textContent = data.output.find(item => item.type === 'text');
      if (textContent && textContent.text) {
        reply = textContent.text.trim();
        console.log('[Noteworthy Chat] ✅ Response from Responses API with web search:', reply.substring(0, 100) + '...');
      } else {
        // Fallback: try to extract any text from output
        const allText = data.output
          .filter(item => item.text || item.content)
          .map(item => item.text || item.content)
          .join(' ')
          .trim();
        if (allText) {
          reply = allText;
        }
      }
    } else if (data.choices && data.choices[0]?.message?.content) {
      // Fallback to Chat Completions format (shouldn't happen with Responses API)
      reply = data.choices[0].message.content.trim();
      console.log('[Noteworthy Chat] ⚠️ Unexpected Chat Completions format, using fallback');
    }
    
    // Log if web search was used (Responses API handles this automatically)
    if (data.output) {
      const hasWebSearch = data.output.some(item => 
        item.type === 'web_search' || 
        item.type === 'tool_use' ||
        item.citations
      );
      if (hasWebSearch) {
        console.log('[Noteworthy Chat] ✅ Web search was used by Responses API');
      }
    }
    
    // If an image was generated, include it in the response
    if (imageData && imageData.imageUrl) {
      // The reply already mentions the image, so we just need to return both
    }

    // Get user email and chat history from event (if available)
    // Note: This is done AFTER the OpenAI call to avoid timeout issues
    // We use a timeout to prevent this from blocking the response
    let userEmail = null;
    let recentChatHistory = [];
    try {
      // Add timeout protection - don't wait more than 1.5 seconds for history
      const historyPromise = (async () => {
    try {
      const { logData, getClientIP } = require("./log-data");
      const ip = getClientIP(event);
      
      // Try to get email and chat history from previous logs by IP
      if (ip && ip !== "unknown" && !ip.startsWith("127.") && !ip.startsWith("192.168.")) {
        const { getStore } = require("@netlify/blobs");
        const store = getStore({
          name: "analytics-data",
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        });
        
        const today = new Date().toISOString().split('T')[0];
        const logsKey = `logs-${today}`;
        try {
          const existing = await store.get(logsKey, { type: "json" });
          if (existing && Array.isArray(existing)) {
            // Find email from any log with same IP
            const matchingLog = existing.find(log => 
              log.ip === ip && 
              log.userEmail && 
              log.userEmail !== 'Unknown' &&
              log.userEmail.includes('@')
            );
            if (matchingLog) {
              userEmail = matchingLog.userEmail;
            }
            
                // Get recent chat history for this user/IP (reduced to 5 chats to prevent timeout)
            const recentChats = existing
              .filter(log => 
                log.dataType === 'ai-chat' && 
                log.ip === ip &&
                log.data &&
                log.data.userMessage
              )
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .slice(0, 5) // Reduced from 10 to 5 to prevent timeout
              .map(log => ({
                timestamp: log.timestamp,
                    userMessage: (log.data.userMessage || '').substring(0, 500), // Limit size
                    aiResponse: (log.data.aiResponse || '').substring(0, 500), // Limit size
              }));
            
                recentChatHistory = recentChats;
          }
            } catch (blobError) {
              console.error("[Noteworthy Chat] Error reading from Blob storage:", blobError);
          // Continue without email/history
        }
      }
    } catch (e) {
          console.error("[Noteworthy Chat] Error getting chat history:", e);
      // Continue without email/history
        }
      })();
      
      // Race between history fetch and timeout (1.5 seconds max)
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
      await Promise.race([historyPromise, timeoutPromise]);
    } catch (e) {
      console.error("[Noteworthy Chat] Error in chat history retrieval:", e);
      // Continue without email/history - don't fail the request
    }

    // Log AI interaction (non-blocking - don't wait for it)
    const { logData } = require("./log-data");
    
    // Extract file information for logging (include stored image info)
    let storedImageIndex = 0;
    const uploadedFilesInfo = files && files.length > 0 ? files.map((file, idx) => {
      const isImage = file.type && file.type.startsWith('image/');
      const storedImage = isImage ? storedUploadedImages[storedImageIndex++] : null;
      
      // Calculate size from base64 data if size is not provided
      let fileSize = file.size || 0;
      if (!fileSize && file.data) {
        // Approximate size: base64 is ~4/3 of original size
        const base64Length = file.data.replace(/^data:[^;]+;base64,/, '').length;
        fileSize = Math.round((base64Length * 3) / 4);
      }
      
      const fileInfo = {
        name: file.name || `file-${idx + 1}`,
        type: file.type || 'application/octet-stream',
        size: fileSize,
        isImage: isImage,
        storedImageKey: storedImage?.storedImageKey || null,
        storedImageUrl: storedImage?.storedImageUrl || null,
        uploadedAt: storedImage?.uploadedAt || null,
      };
      
      console.log(`[Noteworthy Chat] File info for logging ${idx + 1}:`, fileInfo);
      return fileInfo;
    }) : [];
    
    // Debug logging for files and images
    console.log("[Noteworthy Chat] File upload info:", {
      filesCount: files ? files.length : 0,
      uploadedFilesInfoCount: uploadedFilesInfo.length,
      imageCount: uploadedFilesInfo.filter(f => f.isImage).length,
      storedImagesCount: storedUploadedImages.length,
      hasGeneratedImage: !!(imageData && imageData.imageUrl),
      generatedImageUrl: imageData?.imageUrl ? imageData.imageUrl.substring(0, 50) + '...' : null,
    });
    
    logData("ai-chat", {
      userMessage: message,
      aiResponse: reply,
      usage: usage,
      model: "gpt-4o",
      temperature: 0.4,
      maxTokens: 450,
      uploadedFiles: uploadedFilesInfo.length > 0 ? uploadedFilesInfo : undefined,
      fileCount: uploadedFilesInfo.length,
      imageCount: uploadedFilesInfo.filter(f => f.isImage).length,
      storedImages: storedUploadedImages.length > 0 ? storedUploadedImages : undefined,
      // Add AI-generated image data if present
      generatedImage: imageData && imageData.imageUrl ? {
        imageUrl: imageData.imageUrl,
        prompt: imageData.prompt,
        revisedPrompt: imageData.revisedPrompt,
      } : undefined,
      hasGeneratedImage: !!(imageData && imageData.imageUrl),
    }, event).catch(err => {
      console.error("[Noteworthy Chat] Failed to log data:", err);
      // Don't fail the request if logging fails
    });

    // Check if this is a spotlight request (should not send emails)
    // Spotlight requests include:
    // 1. Text requests: "tell me about [country]" with "culture" and "fun facts"
    // 2. Image requests: "generate an image of the flag of [country]" or "culture of [country]"
    const lowerMessage = message ? message.toLowerCase() : '';
    const isSpotlightRequest = message && (
      // Text request pattern
      (lowerMessage.includes('tell me about') && 
       lowerMessage.includes('culture') &&
       lowerMessage.includes('fun facts')) ||
      // Image request patterns for spotlight
      (lowerMessage.includes('generate an image') && (
        lowerMessage.includes('flag of') ||
        (lowerMessage.includes('culture of') && (lowerMessage.includes('traditional') || lowerMessage.includes('customs'))) ||
        (lowerMessage.includes('cultural aspects') && (lowerMessage.includes('festivals') || lowerMessage.includes('food') || lowerMessage.includes('art'))) ||
        (lowerMessage.includes('showing the culture') && lowerMessage.includes('traditional'))
      ))
    );

    // Send email notification (non-blocking - don't wait for it)
    try {
      // Skip emails for spotlight requests
      if (isSpotlightRequest) {
        console.log("[Noteworthy Chat] Spotlight request detected - skipping email notification");
      } else if (!process.env.RESEND_API_KEY) {
        console.warn("[Noteworthy Chat] RESEND_API_KEY not configured. Skipping email notifications.");
      } else {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
        // Get notification emails from environment variable only (comma-separated or JSON array)
      let notificationEmails = [];
      if (process.env.AI_NOTIFICATION_EMAILS) {
        try {
          // Try parsing as JSON array first
          notificationEmails = JSON.parse(process.env.AI_NOTIFICATION_EMAILS);
          if (!Array.isArray(notificationEmails)) {
            throw new Error('Not an array');
          }
        } catch {
          // If not JSON, treat as comma-separated string
          notificationEmails = process.env.AI_NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e);
        }
      }
      
        // Filter out mr.pangolinman@example.com
        notificationEmails = notificationEmails.filter(email => 
          email.toLowerCase() !== 'mr.pangolinman@example.com' && 
          email.toLowerCase() !== 'pangolinman@example.com'
        );
        
        // Only send if AI_NOTIFICATION_EMAILS is configured and has valid emails
      if (notificationEmails.length === 0) {
          console.log(`[Noteworthy Chat] AI_NOTIFICATION_EMAILS not configured or all filtered out, skipping email notification`);
        } else {
          console.log(`[Noteworthy Chat] Sending email notification to: ${notificationEmails.join(', ')}`);
      
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
        
        // Determine if this is an image generation request
        const isImageGeneration = imageData && imageData.imageUrl;
      
      const safeMessage = String(message)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .substring(0, 500);
      
      const safeReply = String(reply)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .substring(0, 1000);
      
        // Create separate email templates for chat vs image generation
        let emailSubject, emailHtml, emailText;
        
        if (isImageGeneration) {
          // Image Generation Email
          const safeImagePrompt = (imageData.revisedPrompt || imageData.prompt || message)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          
          emailSubject = '🎨 New AI Image Generated';
          emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <div style="padding: 40px 30px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎨</div>
                <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">New AI Image Generated</h1>
                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 15px; font-weight: 500;">Noteworthy AI Image Creation</p>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              ${userEmail ? `
              <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Chat User</p>
                <p style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0;">${userEmail}</p>
              </div>
              ` : ''}
              
              <!-- Generated Image -->
              <div style="background-color: #ffffff; border: 3px solid #f093fb; border-radius: 16px; padding: 20px; margin-bottom: 24px; text-align: center; box-shadow: 0 4px 16px rgba(240, 147, 251, 0.2);">
                <p style="color: #f5576c; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin: 0 0 16px 0;">Generated Image</p>
                <img src="${imageData.imageUrl}" alt="${safeImagePrompt}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: block; margin: 0 auto;" />
                <div style="margin-top: 16px; padding: 12px; background-color: #f8f9fa; border-radius: 8px;">
                  <p style="color: #6c757d; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Prompt</p>
                  <p style="color: #1a202c; font-size: 14px; line-height: 1.5; margin: 0; font-weight: 500;">${safeImagePrompt}</p>
              </div>
              </div>
              
              <!-- User Request -->
              <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <p style="color: #2e7d32; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">User Request</p>
                <p style="color: #1a202c; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500;">${safeMessage}</p>
              </div>
              
              ${storedUploadedImages && storedUploadedImages.length > 0 ? `
              <!-- Uploaded Images -->
              <div style="background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="color: #e65100; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">📎 Uploaded Images (${storedUploadedImages.length})</p>
                ${storedUploadedImages.map((img, idx) => {
                  const safeName = (img.originalName || 'image').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  return `
                  <div style="margin-bottom: ${idx < storedUploadedImages.length - 1 ? '20px' : '0'}; padding-bottom: ${idx < storedUploadedImages.length - 1 ? '20px' : '0'}; border-bottom: ${idx < storedUploadedImages.length - 1 ? '1px solid #ffcc80' : 'none'};">
                    <p style="color: #e65100; font-size: 11px; font-weight: 600; margin: 0 0 12px 0;">${safeName}</p>
                    <img src="${img.storedImageUrl}" alt="${safeName}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: block; margin: 0 auto;" />
                    <p style="color: #6c757d; font-size: 10px; margin: 8px 0 0 0; text-align: center;">${img.type || 'image'} • ${((img.size || 0) / 1024).toFixed(1)}KB</p>
              </div>
                  `;
                }).join('')}
              </div>
              ` : ''}
              
              <!-- AI Response -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <p style="color: #1565c0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">AI Response</p>
                <p style="color: #1a202c; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500;">${safeReply}</p>
              </div>
              
              <!-- Stats -->
              <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 12px; padding: 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="text-align: center; padding: 8px;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🧠</div>
                      <p style="color: #667eea; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Model</p>
                      <p style="color: #1a202c; font-size: 14px; font-weight: 700; margin: 0;">gpt-4o</p>
                    </td>
                    <td style="text-align: center; padding: 8px;">
                      <div style="font-size: 24px; margin-bottom: 6px;">📅</div>
                      <p style="color: #667eea; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Time</p>
                      <p style="color: #1a202c; font-size: 12px; font-weight: 700; margin: 0;">${new Date().toLocaleString()}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; text-align: center; line-height: 1.6;">
                <span style="color: #667eea; font-weight: 600;">Noteworthy News</span> • Automated Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
          emailText = `New AI Image Generated

${userEmail ? `Chat User: ${userEmail}\n` : ''}

Generated Image: ${imageData.imageUrl}

Prompt: ${imageData.revisedPrompt || imageData.prompt || message}

${storedUploadedImages && storedUploadedImages.length > 0 ? `\nUploaded Images (${storedUploadedImages.length}):\n${storedUploadedImages.map(img => `- ${img.originalName || 'image'}: ${img.storedImageUrl} (${img.type || 'image'}, ${((img.size || 0) / 1024).toFixed(1)}KB)\n`).join('')}\n` : ''}

User Request: ${message.substring(0, 500)}

AI Response: ${reply.substring(0, 1000)}

Model: gpt-4o
Time: ${new Date().toLocaleString()}

---
This is an automated notification from your website.`;
        } else {
          // Regular Chat Email
          emailSubject = '💬 New AI Chat Interaction';
          emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <div style="padding: 40px 30px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
                <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.2);">New AI Chat</h1>
                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 15px; font-weight: 500;">Noteworthy AI Interaction</p>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              ${userEmail ? `
              <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Chat User</p>
                <p style="color: #1a202c; font-size: 16px; font-weight: 600; margin: 0;">${userEmail}</p>
              </div>
              ` : ''}
              
              <!-- User Message -->
              <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <p style="color: #2e7d32; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">User Message</p>
                <p style="color: #1a202c; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500; white-space: pre-wrap;">${safeMessage}</p>
              </div>
              
              ${storedUploadedImages && storedUploadedImages.length > 0 ? `
              <!-- Uploaded Images -->
              <div style="background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="color: #e65100; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">📎 Uploaded Images (${storedUploadedImages.length})</p>
                ${storedUploadedImages.map((img, idx) => {
                  const safeName = (img.originalName || 'image').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  return `
                  <div style="margin-bottom: ${idx < storedUploadedImages.length - 1 ? '20px' : '0'}; padding-bottom: ${idx < storedUploadedImages.length - 1 ? '20px' : '0'}; border-bottom: ${idx < storedUploadedImages.length - 1 ? '1px solid #ffcc80' : 'none'};">
                    <p style="color: #e65100; font-size: 11px; font-weight: 600; margin: 0 0 12px 0;">${safeName}</p>
                    <img src="${img.storedImageUrl}" alt="${safeName}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: block; margin: 0 auto;" />
                    <p style="color: #6c757d; font-size: 10px; margin: 8px 0 0 0; text-align: center;">${img.type || 'image'} • ${((img.size || 0) / 1024).toFixed(1)}KB</p>
                  </div>
                  `;
                }).join('')}
              </div>
              ` : ''}
              
              <!-- AI Response -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <p style="color: #1565c0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">AI Response</p>
                <p style="color: #1a202c; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500; white-space: pre-wrap;">${safeReply}</p>
              </div>
              
              ${recentChatHistory.length > 0 ? `
              <!-- Chat History -->
              <div style="background-color: #f3e5f5; border: 2px solid #ba68c8; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <p style="color: #7b1fa2; font-size: 14px; font-weight: 700; margin: 0 0 16px 0;">💬 Recent Chat History (${recentChatHistory.length} conversations)</p>
                ${recentChatHistory.map((chat, idx) => {
                  const chatTime = new Date(chat.timestamp).toLocaleString();
                  const safeUserMsg = String(chat.userMessage || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 300);
                  const safeAiResp = String(chat.aiResponse || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 400);
                  return `
                  <div style="margin-bottom: ${idx < recentChatHistory.length - 1 ? '20px' : '0'}; padding-bottom: ${idx < recentChatHistory.length - 1 ? '20px' : '0'}; border-bottom: ${idx < recentChatHistory.length - 1 ? '1px solid #ce93d8' : 'none'};">
                    <p style="color: #7b1fa2; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; opacity: 0.8;">${chatTime}</p>
                    <div style="background-color: #e8f5e9; border-left: 3px solid #4caf50; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                      <p style="color: #2e7d32; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">👤 User</p>
                      <p style="color: #1a202c; font-size: 13px; line-height: 1.5; margin: 0; font-weight: 500;">${safeUserMsg}${chat.userMessage && chat.userMessage.length > 300 ? '...' : ''}</p>
                    </div>
                    <div style="background-color: #e3f2fd; border-left: 3px solid #2196f3; border-radius: 8px; padding: 12px;">
                      <p style="color: #1565c0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">🤖 AI</p>
                      <p style="color: #1a202c; font-size: 13px; line-height: 1.5; margin: 0; font-weight: 500;">${safeAiResp}${chat.aiResponse && chat.aiResponse.length > 400 ? '...' : ''}</p>
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
              ` : ''}
              
              <!-- Stats -->
              <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 12px; padding: 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="text-align: center; padding: 8px;">
                      <div style="font-size: 24px; margin-bottom: 6px;">🧠</div>
                      <p style="color: #667eea; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Model</p>
                      <p style="color: #1a202c; font-size: 14px; font-weight: 700; margin: 0;">gpt-4o</p>
                    </td>
                    ${usage ? `
                    <td style="text-align: center; padding: 8px;">
                      <div style="font-size: 24px; margin-bottom: 6px;">💬</div>
                      <p style="color: #667eea; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Tokens</p>
                      <p style="color: #1a202c; font-size: 14px; font-weight: 700; margin: 0;">${usage.total_tokens || 0}</p>
                    </td>
                    ` : ''}
                    <td style="text-align: center; padding: 8px;">
                      <div style="font-size: 24px; margin-bottom: 6px;">📅</div>
                      <p style="color: #667eea; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Time</p>
                      <p style="color: #1a202c; font-size: 12px; font-weight: 700; margin: 0;">${new Date().toLocaleString()}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; text-align: center; line-height: 1.6;">
                <span style="color: #667eea; font-weight: 600;">Noteworthy News</span> • Automated Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
          emailText = `New AI Chat Interaction

${userEmail ? `Chat User: ${userEmail}\n` : 'Chat User: Unknown User\n'}

NEW USER MESSAGE:
${message.substring(0, 500)}

${storedUploadedImages && storedUploadedImages.length > 0 ? `\nUPLOADED IMAGES (${storedUploadedImages.length}):\n${storedUploadedImages.map(img => `- ${img.originalName || 'image'}: ${img.storedImageUrl} (${img.type || 'image'}, ${((img.size || 0) / 1024).toFixed(1)}KB)\n`).join('')}\n` : ''}

AI RESPONSE:
${reply.substring(0, 1000)}

${recentChatHistory.length > 0 ? `\nRecent Chat History (Last ${recentChatHistory.length} conversations):\n${recentChatHistory.map((chat, idx) => {
  return `\n[${new Date(chat.timestamp).toLocaleString()}]\nUser: ${(chat.userMessage || '').substring(0, 300)}\nAI: ${(chat.aiResponse || '').substring(0, 400)}\n`;
}).join('\n---\n')}\n` : ''}

Model: gpt-4o
${usage ? `Tokens: ${usage.prompt_tokens || 0} input + ${usage.completion_tokens || 0} output = ${usage.total_tokens || 0} total\n` : ''}
Time: ${new Date().toLocaleString()}

---
This is an automated notification from your website.`;
        }
        
      // Send to all notification emails
        const emailResults = await Promise.allSettled(notificationEmails.map(email => 
        resend.emails.send({
          from: fromEmail,
          to: email,
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        })
      ));
        
        // Log results and handle 403 errors specifically
        emailResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            if (result.value.error) {
              const error = result.value.error;
              console.error(`[Noteworthy Chat] Email API error for ${notificationEmails[index]}:`, error);
              
              // Check for 403 Forbidden errors
              if (error.statusCode === 403 || error.message?.includes('403') || error.message?.toLowerCase().includes('forbidden')) {
                console.error(`[Noteworthy Chat] 403 Forbidden error detected for ${notificationEmails[index]}`);
                console.error(`[Noteworthy Chat] Possible causes:`);
                console.error(`  - Invalid or expired RESEND_API_KEY`);
                console.error(`  - Domain not verified in Resend (verify at https://resend.com/domains)`);
                console.error(`  - API key doesn't have permission to send to this email`);
                console.error(`  - Rate limit exceeded`);
                console.error(`[Noteworthy Chat] Error details:`, JSON.stringify(error, null, 2));
              }
            } else {
              console.log(`[Noteworthy Chat] Email sent successfully to ${notificationEmails[index]}:`, result.value.data?.id);
            }
          } else {
            const error = result.reason;
            console.error(`[Noteworthy Chat] Failed to send email to ${notificationEmails[index]}:`, error);
            
            // Check for 403 in rejected promises
            if (error?.statusCode === 403 || error?.message?.includes('403') || error?.message?.toLowerCase().includes('forbidden')) {
              console.error(`[Noteworthy Chat] 403 Forbidden error in rejected promise for ${notificationEmails[index]}`);
              console.error(`[Noteworthy Chat] Error details:`, JSON.stringify(error, null, 2));
            }
          }
        });
        }
      }
    } catch (emailErr) {
      console.error("[Noteworthy Chat] Error sending email notification:", emailErr);
      console.error("[Noteworthy Chat] Error stack:", emailErr.stack);
      
      // Check for 403 in exception
      if (emailErr?.statusCode === 403 || emailErr?.message?.includes('403') || emailErr?.message?.toLowerCase().includes('forbidden')) {
        console.error(`[Noteworthy Chat] 403 Forbidden error in exception handler`);
        console.error(`[Noteworthy Chat] Check RESEND_API_KEY and domain verification at https://resend.com/domains`);
      }
      
      // Don't fail the request if email fails
    }

    const responseBody = { 
      reply, 
      usage,
    };
    
    // Include image data if generated
    if (imageData && imageData.imageUrl) {
      responseBody.image = imageData;
      console.log("[Noteworthy Chat] Including image in response:", {
        hasUrl: true,
        urlPreview: imageData.imageUrl.substring(0, 50) + '...',
        fullImageUrl: imageData.imageUrl,
        hasRevisedPrompt: !!imageData.revisedPrompt,
        hasPrompt: !!imageData.prompt
      });
      console.log("[Noteworthy Chat] Full image data being sent:", JSON.stringify(imageData, null, 2));
    } else {
      console.log("[Noteworthy Chat] No image data to include in response", {
        hasImageData: !!imageData,
        hasImageUrl: !!(imageData && imageData.imageUrl)
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseBody),
    };
  } catch (e) {
    console.error("Noteworthy chat function error:", e);
    console.error("Error stack:", e.stack);
    console.error("Error name:", e.name);
    console.error("Error message:", e.message);
    
    // Provide more detailed error information
    let errorDetails = {
      error: "Internal server error",
      message: e.message || "An unexpected error occurred",
    };
    
    // Add more context if available
    if (e.stack) {
      errorDetails.stack = e.stack.split('\n').slice(0, 5).join('\n'); // First 5 lines of stack
    }
    
    // Check for common issues
    if (e.message && e.message.includes('timeout')) {
      errorDetails.hint = "Request timed out - try again with a shorter message or less chat history";
    } else if (e.message && e.message.includes('fetch')) {
      errorDetails.hint = "Network error - check internet connection or API endpoint";
    } else if (e.message && e.message.includes('require')) {
      errorDetails.hint = "Module loading error - check dependencies";
    } else if (e.message && e.message.includes('Blob')) {
      errorDetails.hint = "Blob storage error - check NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN";
    } else if (e.message && e.message.includes('token')) {
      errorDetails.hint = "Token limit exceeded - try with less chat history or a shorter message";
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorDetails),
    };
  }
};

