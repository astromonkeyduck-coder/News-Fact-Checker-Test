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
    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
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

    // Parse request body
    let surveyData;
    try {
      surveyData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid request body. Expected JSON format.',
          details: parseError.message 
        }),
      };
    }

    const { email, reason, otherReason, comeback } = surveyData;

    // Validate required fields
    if (!reason || !comeback) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Please answer all required questions' }),
      };
    }

    console.log('Survey submission received:', {
      email: email || 'anonymous',
      reason,
      comeback,
      hasOtherReason: !!otherReason,
    });

    // Map reason values to friendly text
    const reasonMap = {
      'too-many-emails': 'Too many emails (drowning in newsletters!)',
      'not-relevant': 'Content wasn\'t relevant',
      'too-serious': 'Too serious (needs more fun!)',
      'not-factual': 'Didn\'t trust the fact-checking',
      'just-browsing': 'Just browsing, not really interested',
      'other': 'Other reason',
    };

    const comebackMap = {
      'definitely': 'Definitely! (Just need a break)',
      'maybe': 'Maybe (depends on improvements)',
      'probably-not': 'Probably not (but never say never!)',
      'never': 'Never (it\'s not you, it\'s me)',
    };

    // Use verified domain email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co';

    // Send survey results to admin
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      replyTo: email || 'noreply@noteworthynews.co',
      subject: 'Unsubscribe Survey Response 📝',
      clickTracking: false,
      text: `Unsubscribe Survey Response

Email: ${email || 'Anonymous'}
Reason: ${reasonMap[reason] || reason}
${otherReason ? `Other Reason: ${otherReason}` : ''}
Comeback Likelihood: ${comebackMap[comeback] || comeback}

Submitted: ${new Date().toLocaleString()}`,
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
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Unsubscribe Survey Response 📝</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #4a90e2;">📧 Email:</strong>
                    <p style="color: #333333; margin: 5px 0;">${email || 'Anonymous'}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #4a90e2;">🎯 Reason for Unsubscribing:</strong>
                    <p style="color: #333333; margin: 5px 0;">${reasonMap[reason] || reason}</p>
                  </td>
                </tr>
                ${otherReason ? `
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #4a90e2;">💬 Additional Comments:</strong>
                    <p style="color: #333333; margin: 5px 0;">${otherReason}</p>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #4a90e2;">🔮 Likelihood to Come Back:</strong>
                    <p style="color: #333333; margin: 5px 0;">${comebackMap[comeback] || comeback}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <strong style="color: #4a90e2;">📅 Submitted:</strong>
                    <p style="color: #333333; margin: 5px 0;">${new Date().toLocaleString()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    if (emailResult.error) {
      console.error('Error sending survey email:', emailResult.error);
      // Still return success to user even if email fails
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Thank you for your feedback!',
      }),
    };

  } catch (error) {
    console.error('Survey submission error:', error);
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

