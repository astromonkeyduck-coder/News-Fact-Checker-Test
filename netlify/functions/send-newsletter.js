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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // Only allow POST and GET requests
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
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

    // Check if audience ID is configured
    if (!NEWSLETTER_AUDIENCE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'RESEND_AUDIENCE_ID not configured. Please set it in Netlify environment variables.',
          hint: 'Get your Audience ID from https://resend.com/audiences'
        }),
      };
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Get newsletter content from request body (if POST) or use defaults
    let newsletterData = {};
    if (event.httpMethod === 'POST' && event.body) {
      try {
        newsletterData = JSON.parse(event.body);
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    const subject = newsletterData.subject || 'Weekly Newsletter - Noteworthy News';
    const htmlContent = newsletterData.html || getDefaultNewsletterHTML();
    const textContent = newsletterData.text || getDefaultNewsletterText();

    // Use verified domain email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    console.log('Fetching contacts from audience:', NEWSLETTER_AUDIENCE_ID);

    // Get all contacts from the audience
    let allContacts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const contactsResponse = await resend.contacts.list({
          audienceId: NEWSLETTER_AUDIENCE_ID,
          page: page,
        });

        const contacts = contactsResponse.data?.data || [];
        const pagination = contactsResponse.data || {};

        // Filter out unsubscribed contacts
        const subscribedContacts = contacts.filter(contact => 
          contact.unsubscribed !== true
        );

        allContacts = allContacts.concat(subscribedContacts);
        console.log(`Page ${page}: Found ${subscribedContacts.length} subscribed contacts (${contacts.length} total)`);

        // Check if there are more pages
        hasMore = pagination.has_more === true && contacts.length > 0;
        page++;
      } catch (error) {
        console.error('Error fetching contacts:', error);
        hasMore = false;
      }
    }

    if (allContacts.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No subscribed contacts found in audience',
          contactsCount: 0,
          emailsSent: 0,
        }),
      };
    }

    console.log(`Total subscribed contacts: ${allContacts.length}`);

    // Send newsletter to all contacts
    // Resend allows sending to multiple recipients, but we'll send individually
    // to ensure proper unsubscribe handling and avoid rate limits
    const emailAddresses = allContacts.map(contact => contact.email).filter(Boolean);
    
    // Generate unsubscribe URLs for each email
    const emailsWithUnsubscribe = emailAddresses.map(email => {
      const encodedEmail = Buffer.from(email).toString('base64');
      const unsubscribeUrl = `https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(encodedEmail)}`;
      
      // Replace unsubscribe placeholder in HTML
      const personalizedHtml = htmlContent.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
      const personalizedText = textContent.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
      
      return {
        email,
        html: personalizedHtml,
        text: personalizedText,
      };
    });

    // Send emails in batches to avoid rate limits
    const batchSize = 10; // Send 10 emails at a time
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < emailsWithUnsubscribe.length; i += batchSize) {
      const batch = emailsWithUnsubscribe.slice(i, i + batchSize);
      
      // Send emails in parallel within each batch
      const batchPromises = batch.map(async ({ email, html, text }) => {
        try {
          const result = await resend.emails.send({
            from: fromEmail,
            to: email,
            replyTo: 'richard@noteworthynews.co',
            subject: subject,
            html: html,
            text: text,
            clickTracking: false,
          });

          if (result.error) {
            throw new Error(result.error.message || 'Unknown error');
          }

          return { success: true, email, id: result.data?.id };
        } catch (error) {
          return { success: false, email, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push({ email: result.email, error: result.error });
        }
      });

      console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${successCount} sent, ${errorCount} errors`);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < emailsWithUnsubscribe.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Newsletter sent to ${successCount} subscribers`,
        contactsCount: allContacts.length,
        emailsSent: successCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors.slice(0, 10) : [], // Limit error details
      }),
    };

  } catch (error) {
    console.error('Newsletter sending error:', error);
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

// Default newsletter HTML template
function getDefaultNewsletterHTML() {
  return `<!DOCTYPE html>
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
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">Weekly Newsletter</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Welcome to your weekly Noteworthy News newsletter! Here's what's happening this week:</p>
              
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-left: 4px solid #4a90e2; padding: 20px; margin: 20px 0; border-radius: 5px;">
                <h3 style="color: #4a90e2; margin: 0 0 15px 0; font-size: 20px;">📰 This Week's Highlights</h3>
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">Stay tuned for fact-checked news stories, media literacy tips, and updates from Noteworthy News!</p>
              </div>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0 0;"><strong>Stay informed and stay curious!</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
              <p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; line-height: 1.5;"><strong>The Noteworthy News Team</strong></p>
              <p style="text-align: center; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #999999; font-size: 12px; text-decoration: underline;">Unsubscribe from this newsletter</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Default newsletter text template
function getDefaultNewsletterText() {
  return `Weekly Newsletter - Noteworthy News

Hi there,

Welcome to your weekly Noteworthy News newsletter! Here's what's happening this week:

📰 This Week's Highlights
Stay tuned for fact-checked news stories, media literacy tips, and updates from Noteworthy News!

Stay informed and stay curious!

The Noteworthy News Team

---
To unsubscribe from future emails, visit: {{{UNSUBSCRIBE_URL}}}`;
}

