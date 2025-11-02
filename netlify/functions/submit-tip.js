// Load environment variables from .env file for local development
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
    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error: RESEND_API_KEY not found'
        }),
      };
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Parse request body safely
    let bodyData;
    try {
      bodyData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid request body. Expected JSON format.',
          details: parseError.message
        }),
      };
    }

    const { name = '', email = '', tip = '', isAnonymous = false } = bodyData;

    // Validate required fields
    if (!tip || tip.trim().length < 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Tip content is required and must be at least 10 characters long' }),
      };
    }

    // Use verified domain email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    const notificationTo = 'richard@noteworthynews.co';

    // Prepare tip information
    const tipName = isAnonymous ? 'Anonymous' : (name || 'Not provided');
    const tipEmail = isAnonymous ? 'Anonymous submission' : (email || 'Not provided');
    const anonymityStatus = isAnonymous ? 'Yes - Anonymous' : 'No - Contact info provided';
    
    // Format tip content for email (escape HTML and handle newlines)
    const tipContent = String(tip)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');
    
    // Escape other user inputs for HTML
    const safeName = String(name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeEmail = String(email || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Send notification email to admin
    const notificationResult = await resend.emails.send({
      from: fromEmail,
      to: notificationTo,
      subject: `💡 New Tip Submission${isAnonymous ? ' (Anonymous)' : ''}`,
      clickTracking: false,
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
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">💡 New Tip Submission${isAnonymous ? '<br><span style="font-size: 16px; color: #666;">(Anonymous)</span>' : ''}</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4a90e2; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">👤 Name:</strong><br><span style="color: #666666;">${safeName || tipName}</span></p>
                    <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">📧 Email:</strong><br><span style="color: #666666;">${safeEmail || tipEmail}</span></p>
                    <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">🔒 Anonymous:</strong><br><span style="color: #666666;">${anonymityStatus}</span></p>
                    <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">📅 Submitted:</strong><br><span style="color: #666666;">${new Date().toLocaleString()}</span></p>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 25px; padding: 20px; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border-left: 4px solid #4a90e2; border-radius: 4px;">
                <p style="color: #4a90e2; font-size: 17px; font-weight: bold; margin: 0 0 15px 0;">💬 Tip Content:</p>
                <p style="color: #333333; font-size: 16px; line-height: 1.8; margin: 0; white-space: pre-wrap;">${tipContent}</p>
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
      text: `New Tip Submission${isAnonymous ? ' (Anonymous)' : ''}

Name: ${tipName}
Email: ${tipEmail}
Anonymous: ${anonymityStatus}
Submitted: ${new Date().toLocaleString()}

Tip Content:
${tip}

---
This is an automated notification from your website.`,
    });

    // Send confirmation email to submitter (whenever email is provided, regardless of anonymous status)
    let autoReplyResult = null;
    if (email && email.includes('@')) {
      // For anonymous submissions, use generic greeting; otherwise use their name
      const greeting = isAnonymous ? 'Hi there,' : `Hi ${safeName || 'there'},`;
      const greetingText = isAnonymous ? 'Hi there,' : `Hi ${safeName || 'there'},`;
      const anonymousNote = isAnonymous 
        ? '<p style="color: #666666; font-size: 14px; font-style: italic; margin: 0 0 20px 0;">Note: Your submission was marked as anonymous. Your identity remains protected.</p>'
        : '';
      const anonymousNoteText = isAnonymous 
        ? '\n\nNote: Your submission was marked as anonymous. Your identity remains protected.\n'
        : '';
      
      autoReplyResult = await resend.emails.send({
        from: fromEmail,
        to: email,
        replyTo: 'richard@noteworthynews.co',
        subject: 'Thank you for your tip! 🙏',
        clickTracking: false,
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
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Thank you for your tip! 🙏</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">${greeting}</p>
              ${anonymousNote}
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Thank you for submitting a tip to Noteworthy News! Your contribution helps us in our mission to provide fact-checked journalism and promote media literacy.</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Our team will review your tip and get back to you if we need additional information or if we decide to pursue the story.</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;"><strong>We appreciate your trust in our platform!</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
              <p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; line-height: 1.5;"><strong>The Noteworthy News Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        text: `Thank you for your tip!

${greetingText}${anonymousNoteText}

Thank you for submitting a tip to Noteworthy News! Your contribution helps us in our mission to provide fact-checked journalism and promote media literacy.

Our team will review your tip and get back to you if we need additional information or if we decide to pursue the story.

We appreciate your trust in our platform!

The Noteworthy News Team`,
      });
    }

    // Check if notification email was sent successfully
    if (notificationResult.error) {
      console.error('Resend error:', notificationResult.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to send tip notification',
          details: notificationResult.error,
        }),
      };
    }

    // Determine success message based on whether confirmation email was sent
    const confirmationSent = autoReplyResult && !autoReplyResult.error;
    const successMessage = confirmationSent
      ? 'Tip submitted successfully! Check your email for a confirmation.'
      : (email && email.includes('@'))
        ? 'Tip submitted successfully! Thank you for your contribution. (Note: Confirmation email could not be sent)'
        : 'Tip submitted successfully! Thank you for your contribution.';
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: successMessage,
        notificationId: notificationResult.data?.id,
        autoReplyId: autoReplyResult?.data?.id,
        confirmationSent: confirmationSent,
      }),
    };

  } catch (error) {
    console.error('Tip submission error:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always return valid JSON
    try {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
          message: error.message || 'An unexpected error occurred',
        }),
      };
    } catch (jsonError) {
      // If JSON.stringify fails, return a simple string response
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
        }),
      };
    }
  }
};

