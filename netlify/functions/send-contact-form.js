// Contact form handler - sends form submissions to admin via Resend
// Expects: { name, email, subject, message }

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

const { Resend } = require('resend');

const SUBJECT_LABELS = {
  general: 'General Inquiry',
  tip: 'News Tip',
  correction: 'Correction Request',
  partnership: 'Partnership Inquiry',
  media: 'Media Inquiry',
  other: 'Other',
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Server configuration error: RESEND_API_KEY not found',
          hint: 'Add RESEND_API_KEY to Netlify environment variables',
        }),
      };
    }

    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const { name, email, subject, message, website } = body;

    // Honeypot: bots fill hidden fields; respond OK without sending mail.
    if (website && String(website).trim()) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Message sent successfully' }),
      };
    }

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email is required' }),
      };
    }

    if (!message || !String(message).trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co';
    const subjectLabel = SUBJECT_LABELS[subject] || subject || 'Contact Form Submission';

    const html = `
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
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Contact Form Submission</h2>
              <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">${subjectLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #333; font-size: 16px; margin: 0 0 12px 0;"><strong style="color: #4a90e2;">Name:</strong><br>${(name || 'Not provided').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                    <p style="color: #333; font-size: 16px; margin: 0 0 12px 0;"><strong style="color: #4a90e2;">Email:</strong><br><a href="mailto:${email.replace(/"/g, '&quot;')}">${email.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a></p>
                    <p style="color: #333; font-size: 16px; margin: 0 0 12px 0;"><strong style="color: #4a90e2;">Subject:</strong><br>${subjectLabel}</p>
                    <p style="color: #333; font-size: 16px; margin: 0 0 12px 0;"><strong style="color: #4a90e2;">Date:</strong><br>${new Date().toLocaleString()}</p>
                  </td>
                </tr>
              </table>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 24px 0 8px 0;">Message:</p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #4a90e2; white-space: pre-wrap; color: #333; font-size: 16px; line-height: 1.6;">${String(message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #f8f9fa; border-radius: 0 0 10px 10px;">
              <p style="color: #999; font-size: 12px; margin: 0;">This message was sent from the Noteworthy News contact form.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      replyTo: email,
      subject: `[Noteworthy News] ${subjectLabel} from ${(name || email).substring(0, 50)}`,
      html,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: result.error.message || 'Failed to send message',
        }),
      };
    }

    console.log('Contact form email sent:', result.data?.id);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Message sent successfully',
      }),
    };
  } catch (error) {
    console.error('Contact form error:', error);
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
