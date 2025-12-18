// Send custom email with optional image attachment
// Used by AI assistant to send emails on behalf of users

const { Resend } = require('resend');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

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

    // Parse request body
    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
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

    const { recipient_email, subject, message, image_url, image_prompt } = body;

    // Validate required fields
    if (!recipient_email || !recipient_email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid recipient email is required' }),
      };
    }

    if (!subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Subject and message are required' }),
      };
    }

    // Use verified domain email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

    // Build email content
    let emailContent = {
      from: fromEmail,
      to: recipient_email,
      subject: subject,
      text: message,
      html: `
        <!DOCTYPE html>
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
                    <td style="padding: 30px; background-color: #ffffff;">
                      <div style="color: #333333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</div>
                      ${image_url ? `
                        <div style="margin-top: 30px; padding-top: 30px; border-top: 2px solid #4a90e2;">
                          <p style="color: #4a90e2; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">Generated Image:</p>
                          <img src="${image_url}" alt="${image_prompt || 'Generated image'}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                          ${image_prompt ? `<p style="color: #666666; font-size: 14px; margin-top: 10px; font-style: italic;">"${image_prompt}"</p>` : ''}
                        </div>
                      ` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
                      <p style="color: #999999; font-size: 12px; margin: 0; line-height: 1.5; text-align: center;">Sent via Noteworthy News AI Assistant</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    // Add image attachment if provided
    if (image_url) {
      try {
        // Fetch the image to attach it
        const imageResponse = await fetch(image_url);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          emailContent.attachments = [{
            filename: 'generated-image.png',
            content: Buffer.from(imageBuffer),
          }];
        }
      } catch (imageError) {
        console.warn('Could not attach image, sending email without attachment:', imageError);
        // Continue without attachment - image will still be in HTML
      }
    }

    // Send email
    const result = await resend.emails.send(emailContent);

    if (result.error) {
      console.error('Resend API error:', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to send email',
          details: result.error.message || 'Unknown error',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        emailId: result.data?.id,
      }),
    };

  } catch (error) {
    console.error('Email sending error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
      }),
    };
  }
};




