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
      
      // Validate chat history format
      if (Array.isArray(chatHistory)) {
        // Filter out invalid entries and ensure proper format
        chatHistory = chatHistory.filter(msg => 
          msg && 
          typeof msg === 'object' && 
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string'
        );
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
    const messages = [
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
    const storedUploadedImages = [];
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
        messages.push(...chatHistory);
      }
      
      messages.push({ role: "user", content: message });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
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
    let userEmail = null;
    let chatHistory = [];
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
            
            // Get recent chat history for this user/IP (last 10 chats, most recent first)
            const recentChats = existing
              .filter(log => 
                log.dataType === 'ai-chat' && 
                log.ip === ip &&
                log.data &&
                log.data.userMessage
              )
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, 10)
              .map(log => ({
                timestamp: log.timestamp,
                userMessage: log.data.userMessage,
                aiResponse: log.data.aiResponse,
              }));
            
            chatHistory = recentChats;
          }
        } catch (e) {
          // Continue without email/history
        }
      }
    } catch (e) {
      // Continue without email/history
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
        
        // Get notification emails from environment variable (comma-separated or JSON array)
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
        
        // Fallback to default if no emails configured
        if (notificationEmails.length === 0) {
          notificationEmails = [process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co'];
        }
        
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
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #4A90E2; margin: 0; font-size: 24px; font-weight: bold;">💬 New AI Chat Interaction</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              ${userEmail ? `
              <div style="padding: 15px; background: rgba(74, 144, 226, 0.15); border-left: 4px solid #4A90E2; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;"><strong style="color: #4A90E2;">👤 Chat User:</strong> <span style="color: #666666; font-weight: 600;">${userEmail}</span></p>
              </div>
              ` : `
              <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); border-left: 4px solid #666666; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;"><strong style="color: #666666;">👤 Chat User:</strong> <span style="color: #666666;">Unknown User</span></p>
              </div>
              `}
              
              <div style="padding: 20px; background: rgba(46, 204, 113, 0.1); border-left: 4px solid #2ecc71; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #2ecc71; font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">👤 NEW USER MESSAGE:</p>
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${safeMessage}</p>
              </div>
              <div style="padding: 20px; background: rgba(74, 144, 226, 0.1); border-left: 4px solid #4A90E2; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #4A90E2; font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">🤖 AI RESPONSE:</p>
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${safeReply}</p>
              </div>
              
              ${chatHistory.length > 0 ? `
              <div style="padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #9b59b6; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #9b59b6; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">💬 Recent Chat History (Last ${chatHistory.length} conversations):</p>
                ${chatHistory.map((chat, idx) => {
                  const chatTime = new Date(chat.timestamp).toLocaleString();
                  const safeUserMsg = String(chat.userMessage || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 300);
                  const safeAiResp = String(chat.aiResponse || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 400);
                  return `
                  <div style="margin-bottom: ${idx < chatHistory.length - 1 ? '20px' : '0'}; padding-bottom: ${idx < chatHistory.length - 1 ? '20px' : '0'}; border-bottom: ${idx < chatHistory.length - 1 ? '1px solid rgba(155, 89, 182, 0.2)' : 'none'};">
                    <p style="color: #666666; font-size: 12px; margin: 0 0 8px 0;">${chatTime}</p>
                    <div style="padding: 12px; background: rgba(46, 204, 113, 0.05); border-left: 3px solid #2ecc71; border-radius: 4px; margin-bottom: 8px;">
                      <p style="color: #2ecc71; font-size: 12px; font-weight: bold; margin: 0 0 5px 0;">User:</p>
                      <p style="color: #333333; font-size: 14px; line-height: 1.5; margin: 0;">${safeUserMsg}${chat.userMessage && chat.userMessage.length > 300 ? '...' : ''}</p>
                    </div>
                    <div style="padding: 12px; background: rgba(74, 144, 226, 0.05); border-left: 3px solid #4A90E2; border-radius: 4px;">
                      <p style="color: #4A90E2; font-size: 12px; font-weight: bold; margin: 0 0 5px 0;">AI:</p>
                      <p style="color: #333333; font-size: 14px; line-height: 1.5; margin: 0;">${safeAiResp}${chat.aiResponse && chat.aiResponse.length > 400 ? '...' : ''}</p>
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
              ` : ''}
              
              <div style="padding: 15px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4A90E2; border-radius: 8px;">
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">🧠 Model:</strong> <span style="color: #666666;">gpt-4o</span></p>
                ${usage ? `<p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">💬 Tokens:</strong> <span style="color: #666666;">${usage.prompt_tokens || 0} input + ${usage.completion_tokens || 0} output = ${usage.total_tokens || 0} total</span></p>` : ''}
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">📅 Time:</strong> <span style="color: #666666;">${new Date().toLocaleString()}</span></p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px 30px; background-color: #ffffff; border-radius: 0 0 10px 10px;">
              <p style="color: #999999; font-size: 13px; margin: 0; line-height: 1.5; text-align: center;">This is an automated notification from your website.</p>
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

${chatHistory.length > 0 ? `\nRecent Chat History (Last ${chatHistory.length} conversations):\n${chatHistory.map((chat, idx) => {
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: e.message || "An unexpected error occurred"
      }),
    };
  }
};

