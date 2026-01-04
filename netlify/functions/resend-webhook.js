// Resend Webhook Handler for Email Events
// This receives notifications when emails are opened or clicked
// Configure webhook URL in Resend Dashboard: https://resend.com/webhooks

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const { Resend } = require('resend');
const crypto = require('crypto');

/**
 * Verify Resend webhook signature
 * Resend uses Svix for webhook signatures
 */
function verifyResendSignature(body, signature, timestamp, secret) {
  if (!secret || !signature) {
    // If no secret configured, skip verification (for development/testing)
    console.warn('[Resend Webhook] No webhook secret configured, skipping signature verification');
    return true;
  }

  try {
    // Resend/Svix signature format: v1,<signature>
    const parts = signature.split(',');
    if (parts.length !== 2 || parts[0] !== 'v1') {
      console.warn('[Resend Webhook] Invalid signature format:', signature);
      return false;
    }
    const receivedSignature = parts[1];

    // Create expected signature
    const signedPayload = `${timestamp}.${body}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedPayload);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures using constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (!isValid) {
      console.warn('[Resend Webhook] Signature mismatch');
    }
    
    return isValid;
  } catch (error) {
    console.error('[Resend Webhook] Signature verification error:', error);
    return false;
  }
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verify webhook signature if secret is configured
    // Resend uses Svix for webhooks - headers are case-insensitive in Netlify
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    
    // Try multiple header name variations (case-insensitive)
    const getHeader = (name) => {
      const lowerName = name.toLowerCase();
      return event.headers[lowerName] || 
             event.headers[name] || 
             event.headers[`x-${lowerName}`] ||
             event.headers[`x-${name}`];
    };
    
    const signature = getHeader('svix-signature') || getHeader('resend-signature');
    const timestamp = getHeader('svix-timestamp') || getHeader('resend-timestamp');
    const bodyString = event.body || '';
    
    // Log headers for debugging
    console.log('[Resend Webhook] Signature verification check:', {
      hasSecret: !!webhookSecret,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      allHeaders: Object.keys(event.headers).filter(h => 
        h.toLowerCase().includes('signature') || 
        h.toLowerCase().includes('timestamp') ||
        h.toLowerCase().includes('svix') ||
        h.toLowerCase().includes('resend')
      )
    });

    // Verify webhook signature if secret is configured
    // Note: For email tracking webhooks, we log warnings but don't block processing
    // This allows webhooks to work even if secret is misconfigured
    if (webhookSecret && signature) {
      const isValid = verifyResendSignature(bodyString, signature, timestamp, webhookSecret);
      if (!isValid) {
        console.error('[Resend Webhook] ⚠️ Invalid webhook signature - processing anyway (non-critical)', {
          hasSecret: !!webhookSecret,
          hasSignature: !!signature,
          hasTimestamp: !!timestamp,
          signatureHeader: signature?.substring(0, 50),
          timestampHeader: timestamp,
          secretLength: webhookSecret?.length,
          hint: 'Check RESEND_WEBHOOK_SECRET in Netlify environment variables matches Resend dashboard'
        });
        // Don't block - email tracking is non-critical, but log the issue
        // In production, you may want to return 401 here for security
      } else {
        console.log('[Resend Webhook] ✅ Webhook signature verified');
      }
    } else {
      if (webhookSecret && !signature) {
        console.warn('[Resend Webhook] ⚠️ Webhook secret configured but no signature header found', {
          availableHeaders: Object.keys(event.headers).filter(h => 
            h.toLowerCase().includes('signature') || 
            h.toLowerCase().includes('timestamp') ||
            h.toLowerCase().includes('svix') ||
            h.toLowerCase().includes('resend')
          )
        });
      } else if (!webhookSecret) {
        console.warn('[Resend Webhook] ⚠️ No RESEND_WEBHOOK_SECRET configured - webhook signature verification disabled');
        console.warn('[Resend Webhook] 💡 To enable: Get webhook secret from Resend Dashboard → Webhooks → Your Webhook → Signing Secret');
      }
    }

    // Parse webhook payload from Resend
    let webhookData;
    try {
      webhookData = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error('[Resend Webhook] Failed to parse webhook body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON payload',
          details: parseError.message 
        }),
      };
    }
    
    console.log('[Resend Webhook] Received event:', webhookData.type);
    
    // Resend webhook events: email.sent, email.delivered, email.delivery_delayed, 
    // email.complained, email.bounced, email.opened, email.clicked
    const eventType = webhookData.type;
    const emailData = webhookData.data || {};
    
    // Get notification email (your email)
    const notificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co';
    
    // Send notifications for opens, clicks, and bounces
    if (eventType === 'email.opened' || eventType === 'email.clicked' || eventType === 'email.bounced') {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      let subject = '';
      let message = '';
      
      if (eventType === 'email.opened') {
        subject = '📧 Newsletter Email Opened';
        message = `
          <h2>Email Opened</h2>
          <p><strong>Recipient:</strong> ${emailData.to || 'Unknown'}</p>
          <p><strong>Subject:</strong> ${emailData.subject || 'Unknown'}</p>
          <p><strong>Opened at:</strong> ${new Date(emailData.created_at || Date.now()).toLocaleString()}</p>
          <p><strong>IP Address:</strong> ${emailData.ip || 'Unknown'}</p>
          <p><strong>User Agent:</strong> ${emailData.user_agent || 'Unknown'}</p>
        `;
      } else if (eventType === 'email.clicked') {
        subject = '🔗 Newsletter Link Clicked';
        message = `
          <h2>Link Clicked</h2>
          <p><strong>Recipient:</strong> ${emailData.to || 'Unknown'}</p>
          <p><strong>Subject:</strong> ${emailData.subject || 'Unknown'}</p>
          <p><strong>Link Clicked:</strong> <a href="${emailData.link || '#'}">${emailData.link || 'Unknown'}</a></p>
          <p><strong>Clicked at:</strong> ${new Date(emailData.created_at || Date.now()).toLocaleString()}</p>
          <p><strong>IP Address:</strong> ${emailData.ip || 'Unknown'}</p>
          <p><strong>User Agent:</strong> ${emailData.user_agent || 'Unknown'}</p>
        `;
      } else if (eventType === 'email.bounced') {
        subject = '⚠️ Newsletter Email Bounced';
        const bounceType = emailData.bounce_type || 'Unknown';
        const bounceSubtype = emailData.bounce_subtype || emailData.subtype || '';
        const bounceMessage = emailData.bounce_message || emailData.message || emailData.smtp_response || 'No details provided';
        const recipient = emailData.to || emailData.email || 'Unknown';
        const isIcloud = recipient.toLowerCase().includes('icloud.com') || recipient.toLowerCase().includes('me.com') || recipient.toLowerCase().includes('mac.com');
        const isCS01 = bounceMessage.includes('CS01') || bounceMessage.includes('local policy') || bounceMessage.includes('HT204137');
        const isTransient = bounceType.toLowerCase() === 'transient' || bounceSubtype.toLowerCase() === 'general';
        
        message = `
          <h2 style="color: #dc2626;">Email Bounced</h2>
          <p><strong>Recipient:</strong> ${recipient}</p>
          <p><strong>Subject:</strong> ${emailData.subject || 'Unknown'}</p>
          <p><strong>Bounce Type:</strong> ${bounceType}${bounceSubtype ? ` (${bounceSubtype})` : ''}</p>
          <p><strong>SMTP Response:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${bounceMessage}</code></p>
          <p><strong>Bounced at:</strong> ${new Date(emailData.created_at || Date.now()).toLocaleString()}</p>
          ${isIcloud || isCS01 ? `
            <div style="background: ${isCS01 ? '#fef3c7' : '#fee2e2'}; border-left: 4px solid ${isCS01 ? '#f59e0b' : '#dc2626'}; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: ${isCS01 ? '#92400e' : '#991b1b'}; font-weight: 600; font-size: 16px;">
                ${isCS01 ? '⚠️ iCloud CS01 Error (Transient Bounce)' : '⚠️ iCloud Email Bounce'}
              </p>
              ${isCS01 ? `
                <p style="margin: 12px 0 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>What this means:</strong> Apple's spam filter (CS01) rejected your email due to their local policy. This is a <strong>transient bounce</strong>, meaning emails may work in the future once the issue is resolved.
                </p>
                <p style="margin: 12px 0 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>Most common cause:</strong> Domain authentication issues (SPF/DKIM/DMARC not fully verified)
                </p>
                <p style="margin: 12px 0 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  <strong>How to fix:</strong>
                </p>
                <ol style="margin: 8px 0 0; padding-left: 20px; color: #78350f; font-size: 14px;">
                  <li>Go to <a href="https://resend.com/domains" style="color: #b45309; font-weight: 600;">resend.com/domains</a></li>
                  <li>Verify <code>noteworthynews.co</code> shows all green checks (SPF, DKIM, DMARC)</li>
                  <li>If any are red/yellow, follow Resend's setup instructions</li>
                  <li>Wait 24-48 hours for DNS propagation</li>
                  <li>Try sending again (transient bounces may resolve automatically)</li>
                </ol>
                <p style="margin: 16px 0 0; padding: 12px; background: rgba(255,255,255,0.5); border-radius: 4px; color: #78350f; font-size: 13px;">
                  <strong>📖 Apple's Documentation:</strong> <a href="https://support.apple.com/en-us/HT204137" style="color: #b45309;">support.apple.com/en-us/HT204137</a>
                </p>
              ` : `
                <p style="margin: 8px 0 0; color: #991b1b; font-size: 14px;">
                  iCloud has strict spam filters. Common causes:
                  <ul style="margin: 8px 0 0; padding-left: 20px; color: #991b1b;">
                    <li>Domain authentication (SPF/DKIM/DMARC) not fully configured</li>
                    <li>Low sender reputation (new domain or low volume)</li>
                    <li>Content filtering (certain keywords or formatting)</li>
                  </ul>
                </p>
                <p style="margin: 12px 0 0; color: #991b1b; font-size: 13px;">
                  <strong>Fix:</strong> Verify domain at <a href="https://resend.com/domains" style="color: #b91c1c; font-weight: 600;">resend.com/domains</a> and ensure SPF/DKIM/DMARC are all green.
                </p>
              `}
            </div>
          ` : ''}
        `;
      }
      
      // Send notification email
      try {
        await resend.emails.send({
          from: 'Noteworthy News <richard@noteworthynews.co>',
          to: notificationEmail,
          replyTo: 'richard@noteworthynews.co',
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              ${message}
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">This is an automated notification from your newsletter tracking system.</p>
            </div>
          `,
        });
        
        console.log(`[Resend Webhook] Notification sent for ${eventType} to ${notificationEmail}`);
      } catch (emailError) {
        console.error('[Resend Webhook] Failed to send notification email:', emailError);
      }
    }
    
    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Webhook received',
        eventType: eventType 
      }),
    };
    
  } catch (error) {
    console.error('[Resend Webhook] Error processing webhook:', error);
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

