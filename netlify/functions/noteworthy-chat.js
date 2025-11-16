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
    
    console.log("API key found:", apiKey.substring(0, 7) + "...");

    // Auto-detect if message is requesting image generation
    function isImageRequest(msg) {
      const lowerMsg = msg.toLowerCase().trim();
      const imagePatterns = [
        /^(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(show\s+me|i\s+want)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(can\s+you\s+)?(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(an?|the)\s+(image|picture|photo|visual|illustration|drawing)\s+of\s+/i,
        /\b(picture|image|photo|visual|illustration|drawing)\s+of\s+/i,
        /^(generate|create|make|draw)\s+/i
      ];
      
      for (const pattern of imagePatterns) {
        if (pattern.test(lowerMsg)) {
          return true;
        }
      }
      return false;
    }
    
    // Extract the actual prompt from an image request
    function extractImagePrompt(msg) {
      let prompt = msg.trim();
      const prefixes = [
        /^(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(show\s+me|i\s+want)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(can\s+you\s+)?(generate|create|make|draw)\s+(an?\s+)?(image|picture|photo|visual|illustration|drawing)(\s+of)?\s+/i,
        /^(an?|the)\s+(image|picture|photo|visual|illustration|drawing)\s+of\s+/i,
        /\b(picture|image|photo|visual|illustration|drawing)\s+of\s+/i,
        /^(generate|create|make|draw)\s+/i
      ];
      
      for (const prefix of prefixes) {
        const match = prompt.match(prefix);
        if (match) {
          prompt = prompt.substring(match[0].length).trim();
          break;
        }
      }
      
      return prompt || msg;
    }

    // Check if this is an image request
    const needsImage = isImageRequest(message);
    let imageData = null;
    
    // Generate image if needed (before GPT call so GPT can reference it)
    if (needsImage) {
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
          console.log("Image generated successfully");
        } else {
          console.error("Image generation failed:", imageResponse.status);
          // Continue with chat response even if image generation fails
        }
      } catch (imageError) {
        console.error("Error generating image:", imageError);
        // Continue with chat response even if image generation fails
      }
    }

    // Build messages array with chat history and current message
    let messages;
    let storedUploadedImages = [];
    
    try {
      messages = [
        {
          role: "system",
          content: `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You are designed to help users with fact-checking, media literacy, and staying informed with verified news.

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
       - Be concise, neutral, and always Truth-Seeking
- When discussing news, emphasize the importance of multiple sources and verification
- If you don't know something, say so rather than speculate
- When an image has been generated for the user, acknowledge it naturally in your response
- When analyzing uploaded images or documents, provide detailed observations and insights

RESPONSE STYLE:
- Keep responses concise but informative (target: 2-4 sentences per point)
- Use clear, accessible language
- Cite principles of fact-checking when relevant
- Maintain a professional but approachable tone
- Do NOT include any attribution text like "generated by Noteworthy AI" or similar disclaimers in your responses
- Do NOT add footers, signatures, or attribution statements to your answers`,
        },
      ];
      
      // Store uploaded images in Netlify Blobs
      if (files && files.length > 0) {
        try {
          const { getStore } = require("@netlify/blobs");
          const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
          const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
          
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
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
                console.log(`[Noteworthy Chat] Storing uploaded image: ${file.name}, size: ${imageBuffer.length} bytes`);
                
                // Store image in Netlify Blobs
                await store.set(imageKey, imageBuffer, {
                  contentType: file.type,
                });
                
                // Generate URL to retrieve the stored image
                const storedImageUrl = `/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(imageKey)}`;
                
                storedUploadedImages.push({
                  originalName: file.name,
                  type: file.type,
                  size: file.size,
                  storedImageKey: imageKey,
                  storedImageUrl: storedImageUrl,
                  uploadedAt: new Date().toISOString(),
                });
                
                console.log(`[Noteworthy Chat] ✅ Uploaded image stored with key: ${imageKey}`);
                
                // Store metadata
                const metadataKey = `metadata-${imageKey}.json`;
                await store.set(metadataKey, JSON.stringify({
                  originalName: file.name,
                  type: file.type,
                  size: file.size,
                  uploadedAt: new Date().toISOString(),
                  imageKey: imageKey,
                }), {
                  contentType: "application/json",
                });
                
              } catch (fileErr) {
                console.error(`[Noteworthy Chat] Error storing uploaded image ${file.name}:`, fileErr);
                // Continue with other files even if one fails
              }
            }
          }
        } catch (blobErr) {
          console.error("[Noteworthy Chat] Error setting up blob storage for uploaded images:", blobErr);
          // Continue even if blob storage fails - we'll still use the base64 data for OpenAI
        }
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
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.4,
          max_tokens: 450,
          messages: messages,
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
    let reply = data?.choices?.[0]?.message?.content?.trim() || "No response generated.";
    const usage = data?.usage || null;
    
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
    const uploadedFilesInfo = files && files.length > 0 ? files.map((file) => {
      const isImage = file.type && file.type.startsWith('image/');
      const storedImage = isImage ? storedUploadedImages[storedImageIndex++] : null;
      return {
        name: file.name || 'unknown',
        type: file.type || 'unknown',
        size: file.size || 0,
        isImage: isImage,
        storedImageKey: storedImage?.storedImageKey || null,
        storedImageUrl: storedImage?.storedImageUrl || null,
        uploadedAt: storedImage?.uploadedAt || null,
      };
    }) : [];
    
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
    }, event).catch(err => {
      console.error("[Noteworthy Chat] Failed to log data:", err);
      // Don't fail the request if logging fails
    });

    // Send email notification (non-blocking - don't wait for it)
    try {
      // Validate API key exists
      if (!process.env.RESEND_API_KEY) {
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
        
        // Only send if AI_NOTIFICATION_EMAILS is configured
        if (notificationEmails.length === 0) {
          console.log(`[Noteworthy Chat] AI_NOTIFICATION_EMAILS not configured, skipping email notification`);
        } else {
          console.log(`[Noteworthy Chat] Sending email notification to: ${notificationEmails.join(', ')}`);
        
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
        
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
        
        // Send to all notification emails
        const emailResults = await Promise.allSettled(notificationEmails.map(email => 
        resend.emails.send({
          from: fromEmail,
          to: email,
          subject: '💬 New AI Chat Interaction',
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); background-attachment: fixed;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); min-height: 100vh;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1); overflow: hidden;">
          <!-- Header with gradient -->
          <tr>
            <td style="padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); position: relative;">
              <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"><defs><pattern id=\"grid\" width=\"20\" height=\"20\" patternUnits=\"userSpaceOnUse\"><path d=\"M 20 0 L 0 0 0 20\" fill=\"none\" stroke=\"rgba(255,255,255,0.1)\" stroke-width=\"1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grid)\"/></svg>'); opacity: 0.3;"></div>
              <div style="padding: 50px 40px; text-align: center; position: relative; z-index: 1;">
                <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
                  <div style="font-size: 48px; margin: 0;">✨</div>
                </div>
                <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px; font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.2); letter-spacing: -0.5px;">New AI Chat</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 500;">Noteworthy AI Interaction</p>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- User Info Card -->
              ${userEmail ? `
              <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(102, 126, 234, 0.15);">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">👤</div>
                  <div>
                    <p style="color: #667eea; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Chat User</p>
                    <p style="color: #1a202c; font-size: 18px; font-weight: 600; margin: 0;">${userEmail}</p>
                  </div>
                </div>
              </div>
              ` : `
              <div style="background: linear-gradient(135deg, rgba(160, 160, 160, 0.1) 0%, rgba(140, 140, 140, 0.1) 100%); border: 2px solid rgba(160, 160, 160, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #a0a0a0 0%, #8c8c8c 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">👤</div>
                  <div>
                    <p style="color: #8c8c8c; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Chat User</p>
                    <p style="color: #1a202c; font-size: 18px; font-weight: 600; margin: 0;">Unknown User</p>
                  </div>
                </div>
              </div>
              `}
              
              <!-- User Message Card -->
              <div style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.08) 0%, rgba(39, 174, 96, 0.12) 100%); border-left: 5px solid #2ecc71; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(46, 204, 113, 0.15); position: relative; overflow: hidden;">
                <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(46, 204, 113, 0.1) 0%, transparent 70%); border-radius: 50%;"></div>
                <div style="position: relative; z-index: 1;">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3);">💬</div>
                    <p style="color: #27ae60; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin: 0;">User Message</p>
                  </div>
                  <div style="background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border-radius: 12px; padding: 18px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                    <p style="color: #1a202c; font-size: 16px; line-height: 1.7; margin: 0; white-space: pre-wrap; font-weight: 500;">${safeMessage}</p>
                  </div>
                </div>
              </div>
              
              <!-- AI Response Card -->
              <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.12) 100%); border-left: 5px solid #667eea; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15); position: relative; overflow: hidden;">
                <div style="position: absolute; top: -50px; left: -50px; width: 150px; height: 150px; background: radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%); border-radius: 50%;"></div>
                <div style="position: relative; z-index: 1;">
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">🤖</div>
                    <p style="color: #667eea; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin: 0;">AI Response</p>
                  </div>
                  <div style="background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); border-radius: 12px; padding: 18px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);">
                    <p style="color: #1a202c; font-size: 16px; line-height: 1.7; margin: 0; white-space: pre-wrap; font-weight: 500;">${safeReply}</p>
                  </div>
                </div>
              </div>
              
              ${recentChatHistory.length > 0 ? `
              <!-- Chat History Card -->
              <div style="background: linear-gradient(135deg, rgba(155, 89, 182, 0.08) 0%, rgba(142, 68, 173, 0.12) 100%); border: 2px solid rgba(155, 89, 182, 0.3); border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(155, 89, 182, 0.15);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                  <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(155, 89, 182, 0.3);">💬</div>
                  <p style="color: #9b59b6; font-size: 16px; font-weight: 700; margin: 0;">Recent Chat History</p>
                  <span style="background: rgba(155, 89, 182, 0.2); color: #9b59b6; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: auto;">${recentChatHistory.length} conversations</span>
                </div>
                ${recentChatHistory.map((chat, idx) => {
                  const chatTime = new Date(chat.timestamp).toLocaleString();
                  const safeUserMsg = String(chat.userMessage || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 300);
                  const safeAiResp = String(chat.aiResponse || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 400);
                  return `
                  <div style="margin-bottom: ${idx < recentChatHistory.length - 1 ? '24px' : '0'}; padding-bottom: ${idx < recentChatHistory.length - 1 ? '24px' : '0'}; border-bottom: ${idx < recentChatHistory.length - 1 ? '2px solid rgba(155, 89, 182, 0.15)' : 'none'};">
                    <p style="color: #9b59b6; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; opacity: 0.7;">${chatTime}</p>
                    <div style="background: rgba(46, 204, 113, 0.06); border-left: 4px solid #2ecc71; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(46, 204, 113, 0.1);">
                      <p style="color: #27ae60; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">👤 User</p>
                      <p style="color: #1a202c; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 500;">${safeUserMsg}${chat.userMessage && chat.userMessage.length > 300 ? '...' : ''}</p>
                    </div>
                    <div style="background: rgba(102, 126, 234, 0.06); border-left: 4px solid #667eea; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);">
                      <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">🤖 AI</p>
                      <p style="color: #1a202c; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 500;">${safeAiResp}${chat.aiResponse && chat.aiResponse.length > 400 ? '...' : ''}</p>
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
              ` : ''}
              
              <!-- Stats Card -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid rgba(102, 126, 234, 0.2); border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                  <div style="text-align: center;">
                    <div style="font-size: 28px; margin-bottom: 8px;">🧠</div>
                    <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Model</p>
                    <p style="color: #1a202c; font-size: 16px; font-weight: 700; margin: 0;">gpt-4o</p>
                  </div>
                  ${usage ? `
                  <div style="text-align: center;">
                    <div style="font-size: 28px; margin-bottom: 8px;">💬</div>
                    <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Tokens</p>
                    <p style="color: #1a202c; font-size: 16px; font-weight: 700; margin: 0;">${usage.total_tokens || 0}</p>
                  </div>
                  ` : ''}
                  <div style="text-align: center;">
                    <div style="font-size: 28px; margin-bottom: 8px;">📅</div>
                    <p style="color: #667eea; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Time</p>
                    <p style="color: #1a202c; font-size: 14px; font-weight: 700; margin: 0;">${new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 1px solid rgba(0,0,0,0.05);">
              <p style="color: #a0aec0; font-size: 12px; margin: 0; text-align: center; line-height: 1.6;">
                <span style="color: #667eea; font-weight: 600;">Noteworthy News</span> • Automated Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        text: `New AI Chat Interaction

${userEmail ? `Chat User: ${userEmail}\n` : 'Chat User: Unknown User\n'}

NEW USER MESSAGE:
${message.substring(0, 500)}

AI RESPONSE:
${reply.substring(0, 1000)}

${recentChatHistory.length > 0 ? `\nRecent Chat History (Last ${recentChatHistory.length} conversations):\n${recentChatHistory.map((chat, idx) => {
  return `\n[${new Date(chat.timestamp).toLocaleString()}]\nUser: ${(chat.userMessage || '').substring(0, 300)}\nAI: ${(chat.aiResponse || '').substring(0, 400)}\n`;
}).join('\n---\n')}\n` : ''}

Model: gpt-4o
${usage ? `Tokens: ${usage.prompt_tokens || 0} input + ${usage.completion_tokens || 0} output = ${usage.total_tokens || 0} total\n` : ''}
Time: ${new Date().toLocaleString()}

---
This is an automated notification from your website.`,
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        reply, 
        usage,
        image: imageData // Include image data if generated
      }),
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

