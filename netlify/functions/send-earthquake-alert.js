/**
 * Send email alert for all earthquakes
 * 
 * POST /.netlify/functions/send-earthquake-alert
 * Body: { earthquake: {...}, imageUrl: "..." }
 */

const { Resend } = require('resend');

/**
 * Format time for human-readable display
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Download image for email attachment
 */
async function downloadImageForEmail(imageUrl) {
  try {
    // If it's a relative URL, make it absolute
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.URL || 'https://noteworthynews.co';
      fullUrl = `${baseUrl}${imageUrl}`;
    }
    
    console.log(`[send-earthquake-alert] 📥 Fetching image from: ${fullUrl}`);
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[send-earthquake-alert] ❌ Image download failed: ${response.status} ${response.statusText}`, errorText.substring(0, 200));
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    console.log(`[send-earthquake-alert] 📥 Image response: ${response.status}, Content-Type: ${contentType}`);
    
    // Get the response as arrayBuffer (binary data)
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[send-earthquake-alert] ✅ Image downloaded: ${Math.round(buffer.length / 1024)}KB, type: ${contentType}`);
    console.log(`[send-earthquake-alert] 📊 Buffer details: length=${buffer.length}, first 8 bytes:`, Array.from(buffer.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    
    if (buffer.length === 0) {
      console.error('[send-earthquake-alert] ❌ Image buffer is empty!');
      return null;
    }
    
    // Validate it's actually a valid image by checking magic bytes
    // But be more lenient - if it's close, still accept it
    const magicBytes = buffer.slice(0, 8);
    const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
    
    if (!isPNG && !isJPEG) {
      // Log warning but don't reject - might be valid but with different encoding
      // Some images might have different headers or be encoded differently
      console.warn('[send-earthquake-alert] ⚠️ Magic bytes don\'t match PNG/JPEG, but proceeding anyway');
      console.warn('[send-earthquake-alert] ⚠️ Magic bytes:', Array.from(magicBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.warn('[send-earthquake-alert] ⚠️ Will attempt to attach anyway - email service may handle it');
    } else {
      console.log(`[send-earthquake-alert] ✅ Image format validated: ${isPNG ? 'PNG' : 'JPEG'}`);
    }
    
    // Always return the buffer - let the email service handle validation
    // Even if magic bytes don't match, the image might still be valid
    return {
      buffer: buffer,
      contentType: contentType,
    };
  } catch (error) {
    console.error('[send-earthquake-alert] ❌ Error downloading image:', error.message);
    return null;
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  
  // Handle OPTIONS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }
  
  try {
    // Get notification emails from AI_NOTIFICATION_EMAILS (same as other functions)
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
    
    // Fallback to ALERT_TO_EMAIL if AI_NOTIFICATION_EMAILS not set (for backwards compatibility)
    if (notificationEmails.length === 0 && process.env.ALERT_TO_EMAIL) {
      notificationEmails = [process.env.ALERT_TO_EMAIL];
    }
    
    // Filter out test emails
    notificationEmails = notificationEmails.filter(email => 
      email.toLowerCase() !== 'mr.pangolinman@example.com' && 
      email.toLowerCase() !== 'pangolinman@example.com'
    );
    
    if (notificationEmails.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "AI_NOTIFICATION_EMAILS or ALERT_TO_EMAIL not configured",
        }),
      };
    }
    
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "RESEND_API_KEY not configured",
        }),
      };
    }
    
    const body = JSON.parse(event.body || "{}");
    const { earthquake, imageUrl } = body;
    
    if (!earthquake || !earthquake.magnitude || !earthquake.location_display) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required earthquake data",
        }),
      };
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Format time
    const eventTime = formatTime(earthquake.time_ms || earthquake.time);
    
    // Build subject (works for all magnitudes)
    const magnitude = earthquake.magnitude.toFixed(1);
    const severity = magnitude >= 7.0 ? "Strong" : magnitude >= 5.0 ? "Moderate" : "Earthquake";
    const subject = `BREAKING: ${severity} Earthquake Near ${earthquake.location_display} (M${magnitude})`;
    
    // Build message (common-person wording, no jargon)
    const message = `BREAKING: A magnitude ${magnitude} earthquake was detected by the U.S. Geological Survey near ${earthquake.location_display} at ${eventTime}.\n\nSee attached image.`;
    
    // Build email content (same for all recipients)
    const baseEmailContent = {
      from: process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>',
      subject: subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d32f2f; margin-bottom: 20px;">BREAKING: Earthquake Detected</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            A magnitude <strong>${earthquake.magnitude.toFixed(1)}</strong> earthquake was detected by the U.S. Geological Survey near <strong>${earthquake.location_display}</strong> at ${eventTime}.
          </p>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            See attached image for details.
          </p>
          <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            <a href="${earthquake.usgs_event_url}" style="color: #4a90e2;">View on USGS website</a>
          </p>
        </div>
      `,
    };
    
    // Download and attach image if available (as inline CID attachment)
    let imageAttachment = null;
    let htmlWithImage = baseEmailContent.html;
    
    if (imageUrl) {
      console.log(`[send-earthquake-alert] 📸 Downloading image from: ${imageUrl}`);
      const imageData = await downloadImageForEmail(imageUrl);
      if (imageData && imageData.buffer) {
        // Validate buffer
        if (!Buffer.isBuffer(imageData.buffer)) {
          console.error('[send-earthquake-alert] ❌ Image buffer is not a Buffer object!', typeof imageData.buffer);
          imageData.buffer = Buffer.from(imageData.buffer);
        }
        
        if (imageData.buffer.length === 0) {
          console.error('[send-earthquake-alert] ❌ Image buffer is empty!');
        } else {
          console.log(`[send-earthquake-alert] ✅ Image downloaded successfully (${Math.round(imageData.buffer.length / 1024)}KB, ${imageData.contentType})`);
          
          // Validate it's actually a valid image by checking magic bytes
          const magicBytes = imageData.buffer.slice(0, 4);
          const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
          const isJPEG = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
          
          if (!isPNG && !isJPEG) {
            console.warn('[send-earthquake-alert] ⚠️ Image magic bytes don\'t match PNG or JPEG - may be corrupted, but will try anyway');
            console.warn('[send-earthquake-alert] ⚠️ Magic bytes:', Array.from(magicBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
          } else {
            console.log(`[send-earthquake-alert] ✅ Image format validated: ${isPNG ? 'PNG' : 'JPEG'}`);
          }
        }
        
        // Convert buffer to base64 - ensure it's a proper Buffer first
        let base64Content;
        try {
          if (Buffer.isBuffer(imageData.buffer)) {
            base64Content = imageData.buffer.toString('base64');
          } else if (imageData.buffer instanceof ArrayBuffer) {
            base64Content = Buffer.from(imageData.buffer).toString('base64');
          } else {
            // Try to convert whatever it is to a Buffer
            base64Content = Buffer.from(imageData.buffer).toString('base64');
          }
          
          // Validate base64 encoding - try to decode it back to verify it's valid
          try {
            const testDecode = Buffer.from(base64Content, 'base64');
            if (testDecode.length !== imageData.buffer.length) {
              console.warn(`[send-earthquake-alert] ⚠️ Base64 validation warning: decoded length (${testDecode.length}) doesn't match original (${imageData.buffer.length}), but will proceed`);
            } else {
              console.log(`[send-earthquake-alert] ✅ Base64 validated: ${Math.round(base64Content.length / 1024)}KB, decodes to ${Math.round(testDecode.length / 1024)}KB`);
            }
          } catch (base64Error) {
            console.warn('[send-earthquake-alert] ⚠️ Base64 validation error, but will proceed:', base64Error.message);
          }
        } catch (encodeError) {
          console.error('[send-earthquake-alert] ❌ Failed to encode image to base64:', encodeError.message);
          imageAttachment = null;
        }
        
        // Create attachment if we have valid base64 content
        if (base64Content && base64Content.length > 0) {
          // Create CID (Content-ID) for inline image embedding
          // IMPORTANT: CID in content_id must match what's used in HTML cid: reference
          const cidIdentifier = `earthquake-image-${earthquake.event_id || Date.now()}`;
          
          imageAttachment = {
            filename: `earthquake-m${earthquake.magnitude.toFixed(1)}-${earthquake.event_id || 'unknown'}.png`,
            content: base64Content,
            content_type: imageData.contentType || 'image/png',
            // Use same identifier - Resend will handle the Content-ID header format
            // HTML will reference it as cid:identifier
            content_id: cidIdentifier,
          };
          
          // Add <img> tag in HTML that references the CID
          // MUST match the content_id exactly (without cid: prefix)
          const imageHtml = `
            <div style="margin: 20px 0; text-align: center;">
              <img src="cid:${cidIdentifier}" alt="Earthquake visualization" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
            </div>
          `;
          
          // Insert image after "See attached image for details" paragraph
          // Use a more reliable replacement that finds the paragraph and inserts after it
          const seeAttachedRegex = /(<p style="font-size: 14px; color: #666; margin-top: 20px;">\s*See attached image for details\.\s*<\/p>)/i;
          if (seeAttachedRegex.test(baseEmailContent.html)) {
            htmlWithImage = baseEmailContent.html.replace(
              seeAttachedRegex,
              `$1${imageHtml}`
            );
          } else {
            // Fallback: insert before the USGS link paragraph
            htmlWithImage = baseEmailContent.html.replace(
              /(<p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">)/,
              `${imageHtml}$1`
            );
          }
          
          console.log(`[send-earthquake-alert] ✅ Image HTML inserted into email`);
          console.log(`[send-earthquake-alert] 📝 HTML contains CID reference: ${htmlWithImage.includes(`cid:${cidIdentifier}`)}`);
          
          console.log(`[send-earthquake-alert] ✅ Image prepared for inline email embedding`);
          console.log(`[send-earthquake-alert] 📎 CID: content_id="${cidIdentifier}", HTML uses "cid:${cidIdentifier}"`);
          console.log(`[send-earthquake-alert] 📎 Attachment: filename="${imageAttachment.filename}", size=${Math.round(imageData.buffer.length / 1024)}KB, type=${imageAttachment.content_type}, base64_length=${imageAttachment.content.length}`);
        }
      } else {
        console.warn('[send-earthquake-alert] ⚠️ Failed to download image or image data is invalid, email will be sent without image');
        if (imageData === null) {
          console.warn('[send-earthquake-alert] ⚠️ downloadImageForEmail returned null');
        } else if (!imageData.buffer) {
          console.warn('[send-earthquake-alert] ⚠️ Image data missing buffer property');
        }
      }
    } else {
      console.log('[send-earthquake-alert] ℹ️ No imageUrl provided, email will be sent without image');
    }
    
    // Final safety check: if we have an attachment but no CID in HTML, add it
    if (imageAttachment && !htmlWithImage.includes(`cid:${imageAttachment.content_id}`)) {
      console.warn(`[send-earthquake-alert] ⚠️ CID not found in HTML, forcing insertion`);
      const imageHtml = `
        <div style="margin: 20px 0; text-align: center;">
          <img src="cid:${imageAttachment.content_id}" alt="Earthquake visualization" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
        </div>
      `;
      // Insert before the USGS link
      htmlWithImage = htmlWithImage.replace(
        /(<p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">)/,
        `${imageHtml}$1`
      );
      console.log(`[send-earthquake-alert] ✅ Image HTML force-inserted`);
    }
    
    // Send email to all notification emails
    const emailResults = await Promise.allSettled(
      notificationEmails.map(async (email) => {
        const emailContent = {
          ...baseEmailContent,
          html: htmlWithImage, // Use HTML with embedded image
          to: email,
        };
        
        if (imageAttachment) {
          emailContent.attachments = [imageAttachment];
          console.log(`[send-earthquake-alert] 📎 Adding image attachment to email for ${email}`);
          console.log(`[send-earthquake-alert] 📎 Attachment details:`, {
            filename: imageAttachment.filename,
            content_id: imageAttachment.content_id,
            content_type: imageAttachment.content_type,
            content_length: imageAttachment.content.length,
            content_preview: imageAttachment.content.substring(0, 50) + '...',
            has_cid_in_html: htmlWithImage.includes(`cid:${imageAttachment.content_id}`),
            cid_in_html_count: (htmlWithImage.match(new RegExp(`cid:${imageAttachment.content_id}`, 'g')) || []).length
          });
          
          // Verify the CID format
          if (!htmlWithImage.includes(`cid:${imageAttachment.content_id}`)) {
            console.error(`[send-earthquake-alert] ❌ CRITICAL: CID "${imageAttachment.content_id}" still not found in HTML after force-insert!`);
          } else {
            console.log(`[send-earthquake-alert] ✅ CID verified in HTML`);
          }
        } else {
          console.log(`[send-earthquake-alert] ⚠️ No image attachment for ${email} - imageAttachment is null`);
        }
        
        const result = await resend.emails.send(emailContent);
        console.log(`[send-earthquake-alert] 📧 Email sent to ${email}:`, result.data?.id || 'unknown');
        return result;
      })
    );
    
    // Check results
    const successful = emailResults.filter(r => r.status === 'fulfilled' && !r.value.error);
    const failed = emailResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
    
    if (failed.length > 0) {
      console.error('[send-earthquake-alert] Some emails failed:', failed);
    }
    
    if (successful.length === 0) {
      const error = failed[0]?.reason || failed[0]?.value?.error || 'All emails failed';
      throw new Error(`Failed to send emails: ${error.message || error}`);
    }
    
    const result = successful[0].value;
    
    const hasImage = imageAttachment !== null;
    console.log(`[send-earthquake-alert] ✅ Alert sent successfully for M${earthquake.magnitude} earthquake to ${successful.length} recipient(s)${hasImage ? ' with image' : ' (no image)'}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Alert sent successfully to ${successful.length} recipient(s)`,
        emailId: result.data?.id,
        recipients: notificationEmails,
        successful: successful.length,
        failed: failed.length,
        hasImage: hasImage,
      }),
    };
    
  } catch (error) {
    console.error('[send-earthquake-alert] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};

