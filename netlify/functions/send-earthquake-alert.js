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
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://noteworthynews.co';
      fullUrl = `${baseUrl}${imageUrl}`;
    }
    
    console.log('[send-earthquake-alert] Downloading image from URL', { original: imageUrl, fullUrl });
    
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('[send-earthquake-alert] ✅ Image downloaded successfully', { 
      size: buffer.length, 
      contentType: response.headers.get('content-type') 
    });
    
    return {
      buffer: buffer,
      contentType: response.headers.get('content-type') || 'image/png',
    };
  } catch (error) {
    console.error('[send-earthquake-alert] ❌ Error downloading image:', error.message, { imageUrl });
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
    
    // Download and attach image if available
    let imageAttachment = null;
    if (imageUrl) {
      console.log('[send-earthquake-alert] Attempting to download image for attachment', { imageUrl });
      const imageData = await downloadImageForEmail(imageUrl);
      if (imageData) {
        imageAttachment = {
          filename: `earthquake-m${earthquake.magnitude.toFixed(1)}-${earthquake.event_id}.png`,
          content: imageData.buffer.toString('base64'),
          content_type: imageData.contentType,
        };
        console.log('[send-earthquake-alert] ✅ Image prepared for email attachment', { 
          filename: imageAttachment.filename,
          size: imageData.buffer.length,
          contentType: imageData.contentType
        });
      } else {
        console.warn('[send-earthquake-alert] ⚠️ Failed to download image - email will be sent without image', { imageUrl });
      }
    } else {
      console.warn('[send-earthquake-alert] ⚠️ No imageUrl provided - email will be sent without image');
    }
    
    // Send email to all notification emails
    const emailResults = await Promise.allSettled(
      notificationEmails.map(async (email) => {
        const emailContent = {
          ...baseEmailContent,
          to: email,
        };
        
        if (imageAttachment) {
          emailContent.attachments = [imageAttachment];
        }
        
        return await resend.emails.send(emailContent);
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
    
    console.log(`[send-earthquake-alert] Alert sent successfully for M${earthquake.magnitude} earthquake to ${successful.length} recipient(s)`);
    
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

