// Load environment variables from .env file for local development
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const { Resend } = require('resend');

// Resend Audience ID for newsletter subscribers
const NEWSLETTER_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || null;

// Smart name inference from email addresses
const { getFirstNameFromEmail } = require('./lib/name-inference.js');

// Helper function to get name from email
function getNameFromEmail(email) {
  return getFirstNameFromEmail(email);
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Allow both GET and POST
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
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

    // Get email from query string (GET) or body (POST)
    let email;
    if (event.httpMethod === 'GET') {
      const params = new URLSearchParams(event.queryStringParameters || {});
      const encodedEmail = params.get('email');
      if (!encodedEmail) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email parameter is required' }),
        };
      }
      try {
        email = Buffer.from(encodedEmail, 'base64').toString('utf-8');
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid email parameter' }),
        };
      }
    } else {
      const body = JSON.parse(event.body || '{}');
      email = body.email;
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email is required' }),
      };
    }

    console.log('Processing unsubscribe request for:', email);

    // Remove from Resend Audience if configured
    let removedFromAudience = false;
    if (NEWSLETTER_AUDIENCE_ID) {
      try {
        // List contacts in the audience to find the one to remove
        const contactsResponse = await resend.contacts.list({
          audienceId: NEWSLETTER_AUDIENCE_ID,
        });

        // Find the contact by email
        const contacts = contactsResponse.data?.data || [];
        const contact = contacts.find(c => c.email === email);
        
        // Get name for personalization
        let firstName = null;
        if (contact) {
          firstName = contact.firstName || 
                     contact.first_name || 
                     (contact.name ? contact.name.split(' ')[0] : null);
        }
        // Fallback to email mapping
        if (!firstName) {
          const mappedName = getNameFromEmail(email);
          if (mappedName) {
            firstName = mappedName.split(' ')[0] || mappedName;
          }
        }
        
        if (contact && contact.id) {
          // Remove the contact from the audience using the contact ID
          await resend.contacts.remove({
            audienceId: NEWSLETTER_AUDIENCE_ID,
            id: contact.id,
          });
          removedFromAudience = true;
          console.log('Successfully removed from audience:', contact.id);
        } else {
          console.log('Contact not found in audience, may have already been removed');
          // Still mark as success since they're not in the list
          removedFromAudience = true;
        }
      } catch (audienceError) {
        console.error('Error removing from audience:', audienceError);
        // Check if error is because contact doesn't exist (already removed)
        if (audienceError.message && audienceError.message.includes('not found')) {
          removedFromAudience = true;
          console.log('Contact already removed or not in audience');
        }
        // Continue even if audience removal fails - still return success
      }
    } else {
      console.warn('RESEND_AUDIENCE_ID not configured. Cannot remove from audience.');
    }

    // Get name for personalization (if not already got from contact)
    let firstName = null;
    if (NEWSLETTER_AUDIENCE_ID) {
      try {
        const contactsResponse = await resend.contacts.list({
          audienceId: NEWSLETTER_AUDIENCE_ID,
        });
        const contacts = contactsResponse.data?.data || [];
        const contact = contacts.find(c => c.email === email);
        if (contact) {
          firstName = contact.firstName || 
                     contact.first_name || 
                     (contact.name ? contact.name.split(' ')[0] : null);
        }
      } catch (e) {
        // Ignore errors, will use email mapping
      }
    }
    // Fallback to email mapping
    if (!firstName) {
      const mappedName = getNameFromEmail(email);
      if (mappedName) {
        firstName = mappedName.split(' ')[0] || mappedName;
      }
    }
    
    // Send survey email after successful unsubscribe
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    const encodedEmail = Buffer.from(email).toString('base64');
    const surveyUrl = `https://noteworthynews.co/unsubscribe-survey.html?email=${encodeURIComponent(encodedEmail)}`;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    
    let surveyEmailSent = false;
    try {
      console.log('Sending unsubscribe survey email to:', email, 'with firstName:', firstName);
      const surveyResult = await resend.emails.send({
        from: fromEmail,
        to: email,
        replyTo: 'richard@noteworthynews.co',
        subject: 'Quick Question: Why did you unsubscribe?',
        clickTracking: false,
        text: `${greeting}

Thanks for being part of Noteworthy News!

We're sorry to see you go!

Before you leave, we'd love to know why you're unsubscribing. It only takes 30 seconds and helps us improve!

Take our quick survey: ${surveyUrl}

Thanks for your feedback!

The Noteworthy News Team`,
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
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Thanks for being part of Noteworthy News!</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">${greeting}</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">We're sorry to see you go!</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Before you leave, we'd love to know why you're unsubscribing. It only takes 30 seconds and helps us improve!</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${surveyUrl}" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #4A90E2 0%, #2A60B0 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px;">Take Our Quick Survey</a>
              </div>
              <p style="color: #999999; font-size: 14px; margin: 20px 0 0 0; text-align: center;">Thanks for your feedback!</p>
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
      });
      
      if (!surveyResult.error) {
        surveyEmailSent = true;
        console.log('Survey email sent successfully');
      } else {
        console.error('Error sending survey email:', surveyResult.error);
      }
    } catch (surveyError) {
      console.error('Exception sending survey email:', surveyError);
      // Don't fail unsubscribe if survey email fails
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: firstName 
          ? `${firstName}, you have been successfully unsubscribed from the newsletter.`
          : 'You have been successfully unsubscribed from the newsletter.',
        email: email,
        firstName: firstName,
        removedFromAudience,
        surveyEmailSent,
      }),
    };

  } catch (error) {
    console.error('Unsubscribe error:', error);
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

