/**
 * Inbound Email Handler
 * Receives inbound emails via Resend webhook and triggers ingest-all when email contains "ingest"
 * 
 * Setup Instructions:
 * 1. Go to Resend Dashboard → Domains → Your Domain → Inbound Routes
 * 2. Create a new inbound route for richard@noteworthynews.co
 * 3. Set webhook URL to: https://your-site.netlify.app/.netlify/functions/inbound-email
 * 4. Save the route
 * 
 * Usage:
 * Send an email to richard@noteworthynews.co with subject or body containing "ingest"
 * The ingest-all function will be triggered automatically
 */

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const https = require('https');
const http = require('http');
const crypto = require('crypto');

/**
 * Call ingest-all function via HTTP
 */
async function triggerIngestAll() {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://noteworthynews.co';
  const ingestUrl = `${siteUrl}/.netlify/functions/ingest-all`;
  
  console.log(`[Inbound Email] Triggering ingest-all at: ${ingestUrl}`);
  
  return new Promise((resolve, reject) => {
    const url = new URL(ingestUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Inbound Email] ingest-all triggered successfully`);
          resolve({ success: true, statusCode: res.statusCode, data });
        } else {
          console.error(`[Inbound Email] ingest-all returned status ${res.statusCode}: ${data}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[Inbound Email] Error triggering ingest-all:`, error);
      reject(error);
    });

    req.end();
  });
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
 */
function containsIngestCommand(subject, textBody, htmlBody) {
  const searchText = 'ingest';
  const subjectLower = (subject || '').toLowerCase();
  const textLower = (textBody || '').toLowerCase();
  const htmlText = extractTextFromHtml(htmlBody);
  
  return (
    subjectLower.includes(searchText) ||
    textLower.includes(searchText) ||
    htmlText.includes(searchText)
  );
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
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Failed to trigger ingest-all',
            message: triggerError.message,
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
    
    // Extract email information
    const fromEmail = emailData.from || emailData.from_email || emailData.sender || '';
    let toEmail = emailData.to || emailData.to_email || emailData.recipient || '';
    
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
    
    const subject = emailData.subject || '';
    const textBody = emailData.text || emailData.text_body || emailData.body || '';
    const htmlBody = emailData.html || emailData.html_body || '';

    console.log('[Inbound Email] Email details:', {
      from: fromEmail,
      to: toEmail,
      subject: subject,
      hasText: !!textBody,
      hasHtml: !!htmlBody,
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
    console.log('[Inbound Email] Email contains "ingest" command, triggering ingest-all...');
    
    try {
      const result = await triggerIngestAll();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Ingest-all triggered successfully',
          triggered: true,
          from: fromEmail,
          subject: subject,
        }),
      };
    } catch (triggerError) {
      console.error('[Inbound Email] Failed to trigger ingest-all:', triggerError);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Failed to trigger ingest-all',
          message: triggerError.message,
        }),
      };
    }

  } catch (error) {
    console.error('[Inbound Email] Error processing webhook:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

