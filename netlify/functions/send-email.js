// Load environment variables from .env file for local development
// Netlify dev should auto-load .env, but this ensures it works
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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    // Debug: Log all environment variables (remove in production)
    console.log('Environment check:', {
      hasResendKey: !!process.env.RESEND_API_KEY,
      keyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 10) + '...' : 'NOT SET',
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('RESEND')),
      netlifyDev: process.env.NETLIFY_DEV
    });

    // Check if API key is configured BEFORE initializing Resend
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables');
      console.error('Available env vars with RESEND:', Object.keys(process.env).filter(k => k.includes('RESEND')));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error: RESEND_API_KEY not found',
          hint: 'For local testing: Make sure you are running "netlify dev" (not just opening HTML). Check that .env file exists in project root with RESEND_API_KEY=your_key. You may need to restart netlify dev after creating .env',
          debug: {
            envFileExists: 'Check manually',
            runningNetlifyDev: 'Make sure you run "netlify dev" command',
            tryRestart: 'Try stopping and restarting netlify dev'
          }
        }),
      };
    }

    // Initialize Resend with API key from environment variable (only after checking it exists)
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { email } = JSON.parse(event.body);

    // Validate email
    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email is required' }),
      };
    }

    // Use verified domain email (since domain is verified in Resend)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    console.log('Using from email:', fromEmail);

    // Send notification email to admin (domain is verified)
    const notificationTo = 'richard@noteworthynews.co';
    
    const notificationResult = await resend.emails.send({
      from: fromEmail,
      to: notificationTo,
      subject: 'New Newsletter Subscription',
      clickTracking: false, // Disable click tracking for better deliverability
      text: `New Newsletter Subscription

A new subscriber has signed up for the Noteworthy News newsletter:

Email: ${email}
Date: ${new Date().toLocaleString()}

This is an automated notification from your website.`,
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
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News Logo" style="max-width: 150px; height: auto; border-radius: 50%; display: block; margin: 0 auto 20px; border: 3px solid #4a90e2; box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);" />
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">New Newsletter Subscription</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">A new subscriber has signed up for the Noteworthy News newsletter:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4a90e2; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2; font-size: 17px;">📧 Email:</strong><br><span style="color: #666666;">${email}</span></p>
                    <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2; font-size: 17px;">📅 Date:</strong><br><span style="color: #666666;">${new Date().toLocaleString()}</span></p>
                  </td>
                </tr>
              </table>
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
    });

    // Send auto-reply to the subscriber
    const autoReplyResult = await resend.emails.send({
      from: fromEmail,
      to: email,
      replyTo: 'richard@noteworthynews.co',
      subject: 'Welcome to Noteworthy News! 🎉',
      clickTracking: false, // Disable click tracking for better deliverability
      text: `Welcome to Noteworthy News!

Hi there,

Thank you for subscribing to Noteworthy News! We're thrilled to have you join our community of fact-checkers and critical thinkers.

You'll now receive:
• Weekly fact-checked news stories
• Media literacy tips and insights
• Updates about our interactive fact-checking games
• Critical thinking resources

Stay informed and stay curious!

Best regards,
The Noteworthy News Team

---
If you didn't subscribe to this newsletter, you can safely ignore this email.`,
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
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News Logo" style="max-width: 150px; height: auto; border-radius: 50%; display: block; margin: 0 auto 20px; border: 3px solid #4a90e2; box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);" />
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Thanks for subscribing! 🎉</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">Hi there,</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for subscribing to Noteworthy News! We're thrilled to have you join our community of fact-checkers and critical thinkers.</p>
              <p style="color: #4a90e2; font-size: 17px; font-weight: bold; margin: 0 0 15px 0;">You'll now receive:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 8px 0;">
                    <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;">📰 Weekly fact-checked news stories</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;">🔍 Media literacy tips and insights</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;">🎮 Updates about our interactive fact-checking games</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <p style="color: #333333; font-size: 16px; margin: 0; line-height: 1.6;">💡 Critical thinking resources</p>
                  </td>
                </tr>
              </table>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0 0;"><strong>Stay informed and stay curious!</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
              <p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; line-height: 1.5;"><strong>The Noteworthy News Team</strong></p>
              <p style="color: #999999; font-size: 12px; margin: 15px 0 0 0; line-height: 1.4;">If you didn't subscribe to this newsletter, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    // Check if both emails were sent successfully
    // Note: Using onboarding@resend.dev is fine for development - no domain verification needed
    if (notificationResult.error || autoReplyResult.error) {
      const errorDetails = {
        notificationError: notificationResult.error,
        autoReplyError: autoReplyResult.error,
      };
      
      console.error('Resend errors:', JSON.stringify(errorDetails, null, 2));
      
      // Provide helpful error messages
      let errorMessage = 'Failed to send email';
      if (notificationResult.error) {
        if (notificationResult.error.message?.includes('domain')) {
          errorMessage = 'Domain verification issue in Resend. Please check your domain settings at resend.com/domains';
        } else if (notificationResult.error.message?.includes('API')) {
          errorMessage = 'Invalid Resend API key. Please check your RESEND_API_KEY in Netlify';
        } else {
          errorMessage = notificationResult.error.message || 'Failed to send notification email';
        }
      } else if (autoReplyResult.error) {
        if (autoReplyResult.error.message?.includes('domain')) {
          errorMessage = 'Domain verification issue in Resend. Please check your domain settings at resend.com/domains';
        } else if (autoReplyResult.error.message?.includes('API')) {
          errorMessage = 'Invalid Resend API key. Please check your RESEND_API_KEY in Netlify';
        } else {
          errorMessage = autoReplyResult.error.message || 'Failed to send auto-reply email';
        }
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          hint: 'Check Netlify function logs for more details',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Subscription successful! Check your email for a welcome message.',
        notificationId: notificationResult.data?.id,
        autoReplyId: autoReplyResult.data?.id,
      }),
    };

  } catch (error) {
    console.error('Email sending error:', error);
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
