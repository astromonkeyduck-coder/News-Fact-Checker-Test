exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    const { prompt, size = "1024x1024", quality = "standard", style = "vivid" } = requestBody;

    if (!prompt || !prompt.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing prompt" }),
      };
    }

    // Get API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
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
    
    console.log("Generating image with prompt:", prompt.substring(0, 100) + "...");

    // Call OpenAI DALL-E API
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.trim(),
        size: size,
        quality: quality,
        style: style,
        n: 1,
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
      
      console.error("OpenAI DALL-E API error:", r.status, errorData);
      return {
        statusCode: r.status,
        headers,
        body: JSON.stringify({ 
          error: errorData.error?.message || errorData.message || `OpenAI API error (${r.status})`,
          details: errorData
        }),
      };
    }

    const data = await r.json();
    const imageUrl = data?.data?.[0]?.url || null;
    const revisedPrompt = data?.data?.[0]?.revised_prompt || null;

    if (!imageUrl) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "No image URL returned from API"
        }),
      };
    }

    // Download and store image in Netlify Blobs
    let storedImageKey = null;
    let storedImageUrl = null;
    try {
      const { getStore } = require("@netlify/blobs");
      
      const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
      const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
      
      let store;
      if (siteID && token) {
        store = getStore({
          name: "dalle-images",
          siteID: siteID,
          token: token,
        });
      } else {
        store = getStore({ name: "dalle-images" });
      }

      // Generate unique key for the image (using timestamp + hash of prompt)
      const timestamp = Date.now();
      const promptHash = Buffer.from(prompt.trim()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      const imageKey = `image-${timestamp}-${promptHash}.png`;
      
      console.log("[Generate Image] Downloading image from DALL-E URL...");
      
      // Download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      
      // Get image as array buffer
      const imageBuffer = await imageResponse.arrayBuffer();
      console.log("[Generate Image] Image downloaded, size:", imageBuffer.byteLength, "bytes");
      
      // Store image in Netlify Blobs
      await store.set(imageKey, imageBuffer, {
        contentType: "image/png",
      });
      
      storedImageKey = imageKey;
      // Generate URL to retrieve the stored image
      storedImageUrl = `/.netlify/functions/get-dalle-image?key=${encodeURIComponent(imageKey)}`;
      console.log("[Generate Image] ✅ Image stored in Netlify Blobs with key:", imageKey);
      console.log("[Generate Image] ✅ Stored image URL:", storedImageUrl);
      
      // Store metadata about the image
      const metadataKey = `metadata-${imageKey}.json`;
      await store.set(metadataKey, JSON.stringify({
        originalUrl: imageUrl,
        prompt: prompt.trim(),
        revisedPrompt: revisedPrompt,
        size: size,
        quality: quality,
        style: style,
        model: "dall-e-3",
        storedAt: new Date().toISOString(),
        imageKey: imageKey,
      }), {
        contentType: "application/json",
      });
      
      console.log("[Generate Image] ✅ Metadata stored with key:", metadataKey);
      
    } catch (blobErr) {
      console.error("[Generate Image] ❌ Error storing image in Netlify Blobs:", blobErr);
      console.error("[Generate Image] Error details:", blobErr.message);
      console.error("[Generate Image] Error stack:", blobErr.stack);
      console.error("[Generate Image] Blob storage config:", {
        hasSiteID: !!process.env.NETLIFY_SITE_ID,
        hasToken: !!process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        hasEventHeaders: !!(event.headers['x-nf-site-id'] && event.headers['x-nf-token'])
      });
      // Don't fail the request if blob storage fails - we still have the original URL
    }

    // Get user email from event (if available)
    // NOTE: We don't do IP-based lookup for image generation to avoid cross-device mismatches
    // The logData function will handle email extraction from the data itself
    let userEmail = null;
    // Only extract email if it's explicitly provided in the request
    // Don't do IP-based lookup for image generation

    // Log image generation (non-blocking - don't wait for it)
    try {
      const { logData } = require("./log-data");
      console.log("[Generate Image] Attempting to log image generation...");
      console.log("[Generate Image] Image URL:", imageUrl);
      console.log("[Generate Image] Prompt:", prompt.trim());
      
      const logResult = await logData("image-generation", {
        userPrompt: prompt.trim(),
        revisedPrompt: revisedPrompt,
        imageUrl: imageUrl,
        storedImageKey: storedImageKey,
        storedImageUrl: storedImageUrl,
        size: size,
        quality: quality,
        style: style,
        model: "dall-e-3",
      }, event);
      
      if (logResult && logResult.success) {
        console.log("[Generate Image] ✅ Successfully logged image generation:", logResult.id);
        console.log("[Generate Image] Log entry ID:", logResult.id);
      } else {
        console.error("[Generate Image] ❌ Logging failed:", logResult ? logResult.error : "No result returned");
        console.error("[Generate Image] Full result:", JSON.stringify(logResult, null, 2));
        // If logging was skipped (not an error), that's okay
        if (logResult && logResult.skipped) {
          console.log("[Generate Image] ⚠️ Logging was skipped (this is okay):", logResult.reason);
        }
      }
    } catch (err) {
      console.error("[Generate Image] ❌ Error logging data:", err);
      console.error("[Generate Image] Error stack:", err.stack);
      console.error("[Generate Image] Error name:", err.name);
      // Don't fail the request if logging fails
    }

    // Send email notification (non-blocking - don't wait for it)
    try {
      // Validate API key exists
      if (!process.env.RESEND_API_KEY) {
        console.error("[Generate Image] RESEND_API_KEY environment variable is missing!");
        throw new Error("RESEND_API_KEY is not configured");
      }
      
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
      
      console.log(`[Generate Image] Sending email notification to: ${notificationEmails.join(', ')}`);
      
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
      
      const safePrompt = String(prompt.trim())
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .substring(0, 500);
      
      // Send to all notification emails
      const emailResults = await Promise.allSettled(notificationEmails.map(email =>
        resend.emails.send({
          from: fromEmail,
          to: email,
          subject: '🎨 New AI Image Generated',
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
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(74, 144, 226, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #ffc107; margin: 0; font-size: 24px; font-weight: bold;">🎨 New AI Image Generated</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <div style="margin-bottom: 25px; text-align: center; padding: 20px; background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(74, 144, 226, 0.1) 100%); border-radius: 12px; border: 3px solid #ffc107;">
                <h3 style="color: #ffc107; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">🎨 Generated Image</h3>
                <img src="${imageUrl}" alt="Generated Image" style="max-width: 100%; max-height: 500px; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border: 2px solid #fff;">
                <p style="margin-top: 15px; color: #666666; font-size: 14px;">
                  <a href="${imageUrl}" style="color: #4A90E2; text-decoration: none;">🔗 View Full Size Image</a>
                </p>
              </div>
              <div style="padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #ffc107; border-radius: 8px; margin-bottom: 20px;">
                ${userEmail ? `
                <div style="padding: 15px; background: rgba(74, 144, 226, 0.1); border-left: 4px solid #4A90E2; border-radius: 6px; margin-bottom: 15px;">
                  <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;"><strong style="color: #4A90E2;">👤 Generated By:</strong> <span style="color: #666666; font-weight: 600;">${userEmail}</span></p>
                </div>
                ` : `
                <div style="padding: 15px; background: rgba(100, 100, 100, 0.1); border-left: 4px solid #666666; border-radius: 6px; margin-bottom: 15px;">
                  <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;"><strong style="color: #666666;">👤 Generated By:</strong> <span style="color: #666666;">Unknown User</span></p>
                </div>
                `}
                <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #ffc107;">💬 Prompt:</strong><br><span style="color: #666666; font-size: 15px;">${safePrompt}</span></p>
                ${revisedPrompt && revisedPrompt !== prompt.trim() ? `<p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #ffc107;">✨ Revised Prompt:</strong><br><span style="color: #666666; font-size: 15px;">${String(revisedPrompt).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 500)}</span></p>` : ''}
              </div>
              <div style="padding: 15px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4A90E2; border-radius: 8px;">
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">📐 Size:</strong> <span style="color: #666666;">${size}</span></p>
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">✨ Quality:</strong> <span style="color: #666666;">${quality}</span></p>
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">🎨 Style:</strong> <span style="color: #666666;">${style}</span></p>
                <p style="color: #333333; font-size: 14px; margin: 5px 0;"><strong style="color: #4A90E2;">📅 Generated:</strong> <span style="color: #666666;">${new Date().toLocaleString()}</span></p>
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
        text: `New AI Image Generated

Prompt: ${prompt.trim()}
${revisedPrompt && revisedPrompt !== prompt.trim() ? `Revised Prompt: ${revisedPrompt}\n` : ''}
Size: ${size}
Quality: ${quality}
Style: ${style}
${userEmail ? `User: ${userEmail}\n` : ''}
Generated: ${new Date().toLocaleString()}

Image URL: ${imageUrl}

---
This is an automated notification from your website.`,
        })
      )));
      
      // Log results
      emailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            console.error(`[Generate Image] Email API error for ${notificationEmails[index]}:`, result.value.error);
          } else {
            console.log(`[Generate Image] Email sent successfully to ${notificationEmails[index]}:`, result.value.data?.id);
          }
        } else {
          console.error(`[Generate Image] Failed to send email to ${notificationEmails[index]}:`, result.reason);
        }
      });
    } catch (emailErr) {
      console.error("[Generate Image] Error sending email notification:", emailErr);
      console.error("[Generate Image] Error stack:", emailErr.stack);
      // Don't fail the request if email fails
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        imageUrl,
        revisedPrompt,
        prompt: prompt.trim(),
        storedImageKey: storedImageKey,
        storedImageUrl: storedImageUrl,
        stored: !!storedImageKey
      }),
    };
  } catch (e) {
    console.error("Image generation function error:", e);
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
    if (e.message && e.message.includes('fetch')) {
      errorDetails.hint = "Network error - check internet connection or API endpoint";
    } else if (e.message && e.message.includes('require')) {
      errorDetails.hint = "Module loading error - check dependencies";
    } else if (e.message && e.message.includes('Blob')) {
      errorDetails.hint = "Blob storage error - check NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN";
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorDetails),
    };
  }
};

