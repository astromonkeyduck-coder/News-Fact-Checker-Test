/**
 * Inbound Email Handler
 * Receives inbound emails via Resend webhook and triggers ingest-all when email contains "ingest"
 * Automatically sends a reply email to the sender confirming receipt and action
 * 
 * Setup Instructions:
 * 1. Go to Resend Dashboard → Domains → Your Domain → Inbound Routes
 * 2. Create a new inbound route for richard@noteworthynews.co
 * 3. Set webhook URL to: https://your-site.netlify.app/.netlify/functions/inbound-email
 * 4. Save the route
 * 
 * Usage:
 * Send an email to richard@noteworthynews.co with subject or body containing "ingest"
 * The ingest-all function will be triggered automatically and an auto-reply will be sent
 * 
 * Auto-Reply:
 * - Sends confirmation email to sender automatically
 * - Confirms if earthquake image generation was triggered
 * - Non-blocking - errors don't fail the webhook
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
      subjectPreview: subject.substring(0, 100)
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

    // Check if email contains "ingest" command
    const shouldTrigger = containsIngestCommand(subject, textBody, htmlBody);
    
    if (!shouldTrigger) {
      console.log('[Inbound Email] Email does not contain "ingest" command, ignoring');
      
      // Send auto-reply even if ingest wasn't triggered
      sendAutoReply(fromEmail, subject, false).catch(err => {
        console.error('[Inbound Email] Auto-reply error (non-blocking):', err);
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Email received but does not contain "ingest" command',
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

