// Load environment variables from .env file for local development
// Netlify dev should auto-load .env, but this ensures it works
try {
  if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
    try {
      require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
    } catch (e) {
      // dotenv not needed in production
    }
  }
} catch (e) {
  console.warn('Error loading dotenv:', e.message);
}

// Load Resend module
const { Resend } = require('resend');

// Resend Audience ID for newsletter subscribers
// Get this from: https://resend.com/audiences
// Create an audience called "Newsletter Subscribers" and copy the Audience ID
const NEWSLETTER_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || null;

exports.handler = async (event, context) => {
  // Enable CORS - define headers first
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Wrap everything in try-catch to ensure we always return JSON
  try {
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
    
    // Log that we received the request
    console.log('Received POST request to send-email');

    // Main handler logic
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
    let resend;
    try {
      resend = new Resend(process.env.RESEND_API_KEY);
    } catch (resendError) {
      console.error('Error initializing Resend:', resendError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to initialize email service',
          message: resendError.message || 'Unknown error',
        }),
      };
    }

    // Parse request body safely
    let email;
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      email = body.email;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid request body. Expected JSON format.',
          details: parseError.message 
        }),
      };
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email is required' }),
      };
    }

    // Use verified domain email - IMPORTANT: Domain must be verified in Resend
    // If domain is not verified, Resend will bounce emails
    // Use your domain email by default, but allow override via environment variable
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    const isUsingTestDomain = fromEmail.includes('onboarding@resend.dev') || fromEmail.includes('resend.dev');
    
    console.log('Using from email:', fromEmail);
    console.log('Is using test domain:', isUsingTestDomain);
    
    // Warn if domain might not be verified
    if (fromEmail.includes('noteworthynews.co') && !process.env.RESEND_FROM_EMAIL) {
      console.warn('WARNING: Using noteworthynews.co domain. Make sure this domain is verified in Resend at https://resend.com/domains');
      console.warn('If emails are bouncing, verify the domain in Resend or set RESEND_FROM_EMAIL=onboarding@resend.dev in Netlify');
    }

    // Send notification email to admin
    // Try to use environment variable first, fallback to default
    const notificationTo = process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co';
    
    // If using test domain (onboarding@resend.dev), skip notification email
    // because Resend only allows sending to account owner's email with test domain
    let notificationResult = { data: { id: 'skipped' } };
    
    if (isUsingTestDomain) {
      console.warn('Skipping notification email - using test domain which only allows sending to account owner');
      console.warn('Notification would have been sent to:', notificationTo);
    } else {
      console.log('Sending notification email to admin:', notificationTo);
      console.log('Using from email:', fromEmail);
      console.log('Subscriber email:', email);
      
      notificationResult = await resend.emails.send({
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

    // Log notification result before sending auto-reply
    console.log('Notification email result:', {
      success: !notificationResult.error,
      error: notificationResult.error,
      emailId: notificationResult.data?.id,
    });
    
    // Generate unsubscribe link
    // Base64 encode email for security (prevents tampering)
    const encodedEmail = Buffer.from(email).toString('base64');
    const unsubscribeUrl = `https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(encodedEmail)}`;
    
    // Send auto-reply to the subscriber
    console.log('Sending welcome email to subscriber:', email);
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
If you didn't subscribe to this newsletter, you can safely ignore this email.

To unsubscribe from future emails, visit: ${unsubscribeUrl}`,
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
              <p style="text-align: center; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <a href="${unsubscribeUrl}" style="color: #999999; font-size: 12px; text-decoration: underline;">Unsubscribe from this newsletter</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    // Log auto-reply result
    console.log('Auto-reply email result:', {
      success: !autoReplyResult.error,
      error: autoReplyResult.error,
      emailId: autoReplyResult.data?.id,
    });
    
    // Add subscriber to Resend Audience for mass emailing
    // Wrap in try-catch to prevent failures from breaking the subscription
    let audienceResult = null;
    let audienceError = null;
    
    if (NEWSLETTER_AUDIENCE_ID) {
      try {
        console.log('Attempting to add subscriber to audience:', {
          audienceId: NEWSLETTER_AUDIENCE_ID,
          email: email,
          hasResendInstance: !!resend,
        });
        
        // Helper function to add contact with retry logic for rate limits
        const addContactWithRetry = async (retries = 3, delay = 1000) => {
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              const result = await resend.contacts.create({
                audienceId: NEWSLETTER_AUDIENCE_ID,
                email: email,
                unsubscribed: false, // Explicitly set as subscribed
              });
              
              // Check if it's a rate limit error
              if (result?.error?.name === 'rate_limit_exceeded' || 
                  result?.error?.statusCode === 429 ||
                  (result?.error?.message && result.error.message.includes('rate limit'))) {
                if (attempt < retries) {
                  const waitTime = delay * attempt; // Exponential backoff
                  console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                  continue; // Retry
                } else {
                  console.warn('Rate limit exceeded after all retries');
                  return result; // Return the error after all retries
                }
              }
              
              return result; // Success or non-rate-limit error
            } catch (createError) {
              // Check if it's a rate limit exception
              if (createError.message && createError.message.includes('rate limit') && attempt < retries) {
                const waitTime = delay * attempt;
                console.log(`Rate limit exception, waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }
              throw createError; // Re-throw if not rate limit or out of retries
            }
          }
        };
        
        // Try to create the contact with retry logic
        try {
          audienceResult = await addContactWithRetry();
          
          console.log('Resend contacts.create response:', {
            hasError: !!audienceResult?.error,
            hasData: !!audienceResult?.data,
            error: audienceResult?.error,
            data: audienceResult?.data,
          });
        } catch (createError) {
          console.error('Exception during resend.contacts.create:', {
            error: createError,
            message: createError.message,
            stack: createError.stack,
            name: createError.name,
          });
          audienceError = createError;
          audienceResult = { error: { message: createError.message, name: createError.name } };
        }
        
        // Check for errors in the response
        if (audienceResult && audienceResult.error) {
          audienceError = audienceResult.error;
          console.error('Resend API error when adding to audience:', {
            error: audienceResult.error,
            message: audienceResult.error.message,
            name: audienceResult.error.name,
            code: audienceResult.error.code,
            statusCode: audienceResult.error.statusCode,
          });
          
          // If error is "already exists", that's actually okay
          const errorMsg = audienceResult.error.message || '';
          const errorName = audienceResult.error.name || '';
          
          if (errorMsg.includes('already exists') || 
              errorMsg.includes('duplicate') ||
              errorMsg.includes('already in') ||
              errorMsg.toLowerCase().includes('conflict')) {
            console.log('Contact already exists in audience (this is okay)');
            audienceError = null; // Don't treat as error
            // Mark as success since they're already in the audience
            audienceResult = { data: { id: 'existing', email: email } };
          } else if (errorName === 'rate_limit_exceeded' || audienceResult.error.statusCode === 429) {
            console.warn('Rate limit exceeded when adding to audience. Contact will be added on next subscription attempt.');
            // Don't treat as fatal error - subscription email was sent successfully
            audienceError = null; // Don't fail the subscription
          }
        } else if (audienceResult && audienceResult.data) {
          console.log('✓ Subscriber successfully added to audience:', {
            contactId: audienceResult.data.id,
            email: audienceResult.data.email || email,
            audienceId: NEWSLETTER_AUDIENCE_ID,
          });
        } else {
          console.warn('Unexpected audience result format:', audienceResult);
        }
      } catch (audienceException) {
        audienceError = audienceException;
        console.error('Exception when adding to audience:', {
          error: audienceException,
          message: audienceException.message,
          stack: audienceException.stack,
          audienceId: NEWSLETTER_AUDIENCE_ID,
          email: email,
        });
        // Don't fail the subscription if audience add fails
        // The email was already sent successfully
      }
    } else {
      console.warn('RESEND_AUDIENCE_ID not set. Subscriber not added to audience.');
      console.warn('To enable audience management:');
      console.warn('1. Go to https://resend.com/audiences');
      console.warn('2. Create an audience called "Newsletter Subscribers"');
      console.warn('3. Copy the Audience ID (looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)');
      console.warn('4. Set RESEND_AUDIENCE_ID in Netlify environment variables');
      console.warn('5. Redeploy your site after adding the environment variable');
    }
    
    // Check if both emails were sent successfully
    if (notificationResult.error || autoReplyResult.error) {
      const errorDetails = {
        notificationError: notificationResult.error,
        autoReplyError: autoReplyResult.error,
      };
      
      console.error('Resend errors:', JSON.stringify(errorDetails, null, 2));
      
      // Provide helpful error messages
      let errorMessage = 'Failed to send email';
      let isDomainError = false;
      
      if (notificationResult.error) {
        const errorMsg = notificationResult.error.message || '';
        if (errorMsg.includes('domain') || errorMsg.includes('not verified') || errorMsg.includes('bounce')) {
          errorMessage = 'Domain not verified in Resend. Please verify noteworthynews.co at https://resend.com/domains or use onboarding@resend.dev for testing';
          isDomainError = true;
        } else if (errorMsg.includes('API') || errorMsg.includes('unauthorized')) {
          errorMessage = 'Invalid Resend API key. Please check your RESEND_API_KEY in Netlify environment variables';
        } else if (errorMsg.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again later';
        } else {
          errorMessage = errorMsg || 'Failed to send notification email';
        }
      } else if (autoReplyResult.error) {
        const errorMsg = autoReplyResult.error.message || '';
        if (errorMsg.includes('domain') || errorMsg.includes('not verified') || errorMsg.includes('bounce')) {
          errorMessage = 'Domain not verified in Resend. Please verify noteworthynews.co at https://resend.com/domains or use onboarding@resend.dev for testing';
          isDomainError = true;
        } else if (errorMsg.includes('API') || errorMsg.includes('unauthorized')) {
          errorMessage = 'Invalid Resend API key. Please check your RESEND_API_KEY in Netlify environment variables';
        } else if (errorMsg.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again later';
        } else {
          errorMessage = errorMsg || 'Failed to send auto-reply email';
        }
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          hint: isDomainError 
            ? 'To fix: 1) Go to https://resend.com/domains and verify noteworthynews.co domain, OR 2) Set RESEND_FROM_EMAIL=onboarding@resend.dev in Netlify environment variables'
            : 'Check Netlify function logs for more details',
        }),
      };
    }

    // Check if notification email actually succeeded (even if no error)
    if (!notificationResult.data?.id) {
      console.warn('WARNING: Notification email may not have been sent. No email ID returned.');
      console.warn('Notification result:', JSON.stringify(notificationResult, null, 2));
    }

    // Return success, but log if notification failed silently
    const notificationSent = !!notificationResult.data?.id;
    const autoReplySent = !!autoReplyResult.data?.id;
    
    console.log('Final email status:', {
      notificationSent,
      autoReplySent,
      notificationId: notificationResult.data?.id,
      autoReplyId: autoReplyResult.data?.id,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Subscription successful! Check your email for a welcome message.',
        notificationId: notificationResult.data?.id,
        autoReplyId: autoReplyResult.data?.id,
        notificationSent,
        autoReplySent,
        audienceAdded: !!(audienceResult && !audienceError && audienceResult.data?.id),
        audienceError: audienceError ? {
          message: audienceError.message || 'Unknown error',
          name: audienceError.name,
        } : null,
        // Include warning if notification didn't send
        ...(notificationSent ? {} : { warning: 'Admin notification email may not have been sent. Check Netlify logs.' }),
        // Include warning if audience not configured
        ...(NEWSLETTER_AUDIENCE_ID ? {} : { audienceWarning: 'RESEND_AUDIENCE_ID not configured. Subscriber not added to mailing list.' }),
        // Include warning if audience add failed
        ...(NEWSLETTER_AUDIENCE_ID && audienceResult?.error ? { 
          audienceAddWarning: `Failed to add to audience: ${audienceResult.error.message || 'Unknown error'}. Check Netlify logs for details.` 
        } : {}),
      }),
    };

    } catch (error) {
      console.error('Email sending error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
      });
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message || 'An unexpected error occurred',
          details: process.env.NETLIFY_DEV ? {
            stack: error.stack,
            name: error.name,
          } : undefined,
        }),
      };
    }
  } catch (outerError) {
    // Catch any errors that occur outside the main try block
    console.error('Outer error handler - unexpected error:', outerError);
    console.error('Outer error stack:', outerError.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: outerError.message || 'An unexpected error occurred',
        type: 'outer_error',
      }),
    };
  }
};
