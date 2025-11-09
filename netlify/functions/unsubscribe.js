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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'You have been successfully unsubscribed from the newsletter.',
        email: email,
        removedFromAudience,
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

