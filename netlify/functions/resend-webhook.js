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
    // Parse webhook payload from Resend
    const webhookData = JSON.parse(event.body);
    
    console.log('[Resend Webhook] Received event:', webhookData.type);
    
    // Resend webhook events: email.sent, email.delivered, email.delivery_delayed, 
    // email.complained, email.bounced, email.opened, email.clicked
    const eventType = webhookData.type;
    const emailData = webhookData.data || {};
    
    // Get notification email (your email)
    const notificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co';
    
    // Only send notifications for opens and clicks
    if (eventType === 'email.opened' || eventType === 'email.clicked') {
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

