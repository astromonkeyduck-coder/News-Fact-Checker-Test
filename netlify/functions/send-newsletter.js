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

/**
 * Fetch recent posts from the posts-read API
 */
async function fetchRecentPosts(limit = 10) {
  try {
    const siteUrl = process.env.URL || 'https://noteworthynews.co';
    const url = `${siteUrl}/.netlify/functions/posts-read?limit=${limit}`;
    
    console.log(`[fetchRecentPosts] Fetching from: ${url}`);
    
    // Use fetch if available (Node 18+), otherwise fall back to http/https
    if (typeof fetch !== 'undefined') {
      const response = await fetch(url);
      console.log(`[fetchRecentPosts] Response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const posts = await response.json();
      console.log(`[fetchRecentPosts] Received ${Array.isArray(posts) ? posts.length : 0} posts`);
      if (Array.isArray(posts) && posts.length > 0) {
        console.log(`[fetchRecentPosts] First post sample:`, JSON.stringify(posts[0]).substring(0, 200));
      }
      return Array.isArray(posts) ? posts : [];
    } else {
      // Fallback for older Node versions
      const https = require('https');
      const http = require('http');
      const protocol = url.startsWith('https') ? https : http;
      
      return new Promise((resolve) => {
        protocol.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const posts = JSON.parse(data);
              console.log(`[fetchRecentPosts] Received ${Array.isArray(posts) ? posts.length : 0} posts (via http/https)`);
              resolve(Array.isArray(posts) ? posts : []);
            } catch (e) {
              console.error('[fetchRecentPosts] Error parsing posts:', e);
              console.error('[fetchRecentPosts] Response data:', data.substring(0, 500));
              resolve([]);
            }
          });
        }).on('error', (err) => {
          console.error('[fetchRecentPosts] Error fetching posts:', err);
          resolve([]);
        });
      });
    }
  } catch (error) {
    console.error('[fetchRecentPosts] Error fetching recent posts:', error);
    return []; // Return empty array on error, don't fail newsletter
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format numbers with K/M suffixes for readability
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format posts into HTML for newsletter - dark theme, no white background
 */
function formatPostsForNewsletter(posts) {
  if (!posts || posts.length === 0) {
    console.log('[formatPostsForNewsletter] No posts to format');
    return '<p style="color: #888; font-style: italic; text-align: center; padding: 40px 0;">No recent posts to display.</p>';
  }
  
  console.log(`[formatPostsForNewsletter] Formatting ${posts.length} posts`);
  
  let html = '';
  
  posts.forEach((post, index) => {
    // Try multiple field names to get the text - prioritize story (most common in API)
    const text = (post.story && String(post.story).trim()) || 
                 (post.text && String(post.text).trim()) || 
                 (post['Post text'] && String(post['Post text']).trim()) ||
                 (post.title && String(post.title).trim()) || 
                 '';
    
    // Try multiple field names to get the link
    const link = (post.link && String(post.link).trim()) || 
                 (post['Post Link'] && String(post['Post Link']).trim()) ||
                 (post.url && String(post.url).trim()) || 
                 `https://x.com/newsnoteworthy/status/${post.id || post['Post id'] || ''}`;
    
    // Try multiple field names to get the date
    const datePosted = post.datePosted || 
                       post.Date || 
                       post.createdAt || 
                       post.created_at || 
                       '';
    
    // Try multiple field names to get the image
    let image = null;
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      image = post.images[0];
    } else if (post.image && post.image !== 'null' && post.image !== null) {
      image = post.image;
    }
    
    console.log(`[formatPostsForNewsletter] Post ${index + 1}: id=${post.id}, text="${text.substring(0, 50)}...", textLength=${text.length}, hasImage=${!!image}, link=${link.substring(0, 50)}...`);
    
    if (!text || text.length === 0) {
      console.warn(`[formatPostsForNewsletter] Post ${index + 1} (id: ${post.id}) has no text content. Available fields:`, Object.keys(post));
      return; // Skip posts with no text
    }
    
    // Escape HTML in text and links
    const safeText = escapeHtml(text);
    const safeLink = escapeHtml(link);
    const safeImage = image ? escapeHtml(image) : null;
    
    // Format date
    let dateStr = '';
    if (datePosted) {
      try {
        const date = new Date(datePosted);
        dateStr = escapeHtml(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } catch (e) {
        dateStr = escapeHtml(String(datePosted));
      }
    }
    
    // Check if it's a BREAKING news story
    const isBreaking = safeText.toUpperCase().includes('BREAKING');
    
    // Get engagement stats if available (handle both camelCase and lowercase)
    const impressions = post.Impressions || post.impressions || post.views || 0;
    const likes = post.Likes || post.likes || 0;
    const engagements = post.Engagements || post.engagements || 0;
    
    html += `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 50px;" class="post-card">
        <tr>
          <td style="background: linear-gradient(135deg, rgba(96, 165, 250, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%); border-radius: 16px; padding: 30px; border: 1px solid rgba(255,255,255,0.08);">
            ${isBreaking ? `
              <div style="display: inline-block; margin-bottom: 16px; padding: 6px 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 20px;">
                <span style="color: #ffffff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;" class="breaking-badge">⚡ BREAKING</span>
              </div>
            ` : ''}
            ${safeImage ? `
              <a href="${safeLink}" style="display: block; margin-bottom: 24px; text-decoration: none; border-radius: 12px; overflow: hidden;">
                <img src="${safeImage}" alt="Post image" style="width: 100%; max-width: 100%; height: auto; border-radius: 12px; display: block; border: none; box-shadow: 0 8px 24px rgba(0,0,0,0.4); transition: transform 0.3s ease;" />
              </a>
            ` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding: 0;">
                  ${dateStr ? `
                    <p style="margin: 0 0 12px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">${dateStr}</p>
                  ` : ''}
                  <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; line-height: 1.5; font-weight: 700; letter-spacing: -0.3px;">
                    <a href="${safeLink}" class="post-link" style="color: #ffffff; text-decoration: none; display: block;">${safeText}</a>
                  </h2>
                  ${impressions > 0 || likes > 0 ? `
                    <div style="display: flex; gap: 20px; margin-bottom: 20px; color: #888; font-size: 12px;">
                      ${impressions > 0 ? `<span>👁️ ${formatNumber(impressions)} views</span>` : ''}
                      ${likes > 0 ? `<span>❤️ ${formatNumber(likes)} likes</span>` : ''}
                    </div>
                  ` : ''}
                  <a href="${safeLink}" class="cta-button" style="display: inline-block; color: #60a5fa; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%); border-radius: 8px; border: 1px solid rgba(96, 165, 250, 0.3); transition: all 0.2s ease;">Read Story →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  });
  
  console.log(`[formatPostsForNewsletter] Generated HTML length: ${html.length} characters`);
  return html;
}

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

    const subject = newsletterData.subject || 'Noteworthy News - Latest Stories';
    let htmlContent = newsletterData.html;
    let textContent = newsletterData.text;
    const testEmail = newsletterData.testEmail; // Optional: send to single email for testing
    const includeRecentPosts = newsletterData.includeRecentPosts !== false; // Default to true
    
    // Always fetch posts if includeRecentPosts is true (even if custom HTML provided)
    let recentPosts = [];
    if (includeRecentPosts) {
      console.log('📰 Fetching recent posts for newsletter...');
      recentPosts = await fetchRecentPosts(10); // Get 10 most recent posts
      console.log(`✅ Found ${recentPosts.length} recent posts`);
      if (recentPosts.length > 0) {
        console.log(`📝 First post sample:`, JSON.stringify({
          id: recentPosts[0].id,
          hasStory: !!recentPosts[0].story,
          hasText: !!recentPosts[0].text,
          hasTitle: !!recentPosts[0].title,
          hasImage: !!recentPosts[0].image,
          hasImages: !!recentPosts[0].images,
          hasLink: !!recentPosts[0].link,
          hasUrl: !!recentPosts[0].url
        }));
      }
    }
    
    // If no custom HTML provided, ALWAYS use dark theme template with posts
    if (!htmlContent || htmlContent.trim() === '') {
      console.log(`📧 No custom HTML provided, using dark theme template with ${recentPosts.length} posts`);
      if (recentPosts.length === 0) {
        console.warn('⚠️ WARNING: No posts found! This might be why posts aren\'t showing.');
      }
      htmlContent = getNewsletterHTMLWithPosts(recentPosts);
      textContent = getNewsletterTextWithPosts(recentPosts);
      console.log(`📧 Generated HTML length: ${htmlContent.length} characters`);
    } else if (includeRecentPosts && htmlContent.includes('{{RECENT_POSTS}}')) {
      // If custom HTML has {{RECENT_POSTS}} placeholder, replace it
      console.log(`📧 Replacing {{RECENT_POSTS}} placeholder in custom HTML with ${recentPosts.length} posts`);
      const postsHTML = formatPostsForNewsletter(recentPosts);
      console.log(`📧 Posts HTML length: ${postsHTML.length} characters`);
      htmlContent = htmlContent.replace('{{RECENT_POSTS}}', postsHTML);
    } else if (includeRecentPosts) {
      // Custom HTML provided but no placeholder - append posts at the end
      console.log(`📧 Custom HTML provided, appending ${recentPosts.length} posts`);
      const postsHTML = formatPostsForNewsletter(recentPosts);
      // Find a good place to insert posts (before footer/unsubscribe)
      if (htmlContent.includes('{{{UNSUBSCRIBE_URL}}}')) {
        htmlContent = htmlContent.replace('{{{UNSUBSCRIBE_URL}}}', postsHTML + '{{{UNSUBSCRIBE_URL}}}');
      } else {
        htmlContent = htmlContent + postsHTML;
      }
    }

    // Use verified domain email - prioritize richard@noteworthynews.co
    // If RESEND_FROM_EMAIL is set but contains onboarding/resend.dev, use richard@noteworthynews.co instead
    let fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
    if (fromEmail.includes('onboarding@resend.dev') || fromEmail.includes('resend.dev')) {
      console.log('⚠️ RESEND_FROM_EMAIL contains test domain, using richard@noteworthynews.co instead');
      fromEmail = 'Noteworthy News <richard@noteworthynews.co>';
    }
    console.log(`📧 Using from email: ${fromEmail}`);

    // If testEmail is provided, send only to that email and STOP HERE
    if (testEmail) {
      console.log(`🧪 TEST MODE: Sending to ${testEmail} only - WILL NOT SEND TO AUDIENCE`);
      
      const unsubscribeUrl = `https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(Buffer.from(testEmail).toString('base64'))}`;
      const personalizedHtml = htmlContent.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
      const personalizedText = textContent.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
      
      try {
        // Replace personalization placeholders with default values for test email
        // This makes it look exactly like what subscribers will receive
        const testHtml = personalizedHtml
          .replace(/\{\{FIRST_NAME\}\}/g, 'there')
          .replace(/\{\{LAST_NAME\}\}/g, '')
          .replace(/\{\{FULL_NAME\}\}/g, testEmail.split('@')[0])
          .replace(/\{\{EMAIL\}\}/g, testEmail);
        
        const testText = personalizedText
          .replace(/\{\{FIRST_NAME\}\}/g, 'there')
          .replace(/\{\{LAST_NAME\}\}/g, '')
          .replace(/\{\{FULL_NAME\}\}/g, testEmail.split('@')[0])
          .replace(/\{\{EMAIL\}\}/g, testEmail);
        
        const result = await resend.emails.send({
          from: fromEmail,
          to: testEmail,
          replyTo: 'richard@noteworthynews.co',
          subject: subject, // No [TEST] prefix - looks exactly like mass email
          html: testHtml,
          text: testText,
          clickTracking: false,
        });

        if (result.error) {
          throw new Error(result.error.message || 'Unknown error');
        }

        console.log(`✅ TEST MODE: Email sent successfully to ${testEmail} only`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Test email sent successfully to ${testEmail} only (not sent to audience)`,
            emailId: result.data?.id,
            testMode: true,
          }),
        };
      } catch (error) {
        console.error('❌ TEST MODE ERROR: Failed to send test email:', error);
        // IMPORTANT: Return error and DO NOT continue to audience sending
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to send test email',
            message: error.message,
            testMode: true,
            note: 'No emails were sent to the audience',
          }),
        };
      }
    }
    
    // SAFETY CHECK: If we get here, testEmail was NOT provided, so we're sending to audience
    console.log('📧 PRODUCTION MODE: Sending to full audience (testEmail was not provided)');

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
    
    // Generate personalized emails for each contact
    const emailsWithPersonalization = allContacts.map(contact => {
      const email = contact.email;
      if (!email) return null;
      
      const encodedEmail = Buffer.from(email).toString('base64');
      const unsubscribeUrl = `https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(encodedEmail)}`;
      
      // Get contact data for personalization
      const firstName = contact.firstName || contact.first_name || '';
      const lastName = contact.lastName || contact.last_name || '';
      const fullName = contact.name || `${firstName} ${lastName}`.trim() || email.split('@')[0];
      
      // Replace personalization placeholders
      let personalizedHtml = htmlContent
        .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl)
        .replace(/\{\{FIRST_NAME\}\}/g, firstName || 'there')
        .replace(/\{\{LAST_NAME\}\}/g, lastName || '')
        .replace(/\{\{FULL_NAME\}\}/g, fullName)
        .replace(/\{\{EMAIL\}\}/g, email);
      
      let personalizedText = textContent
        .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl)
        .replace(/\{\{FIRST_NAME\}\}/g, firstName || 'there')
        .replace(/\{\{LAST_NAME\}\}/g, lastName || '')
        .replace(/\{\{FULL_NAME\}\}/g, fullName)
        .replace(/\{\{EMAIL\}\}/g, email);
      
      return {
        email,
        html: personalizedHtml,
        text: personalizedText,
      };
    }).filter(Boolean);

    // Send emails in batches to avoid rate limits
    const batchSize = 10; // Send 10 emails at a time
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < emailsWithPersonalization.length; i += batchSize) {
      const batch = emailsWithPersonalization.slice(i, i + batchSize);
      
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
      if (i + batchSize < emailsWithPersonalization.length) {
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

Hi {{FIRST_NAME}},

Welcome to your weekly Noteworthy News newsletter! Here's what's happening this week:

📰 This Week's Highlights
Stay tuned for fact-checked news stories, media literacy tips, and updates from Noteworthy News!

Stay informed and stay curious!

The Noteworthy News Team

---
To unsubscribe from future emails, visit: {{{UNSUBSCRIBE_URL}}}`;
}

// Newsletter HTML template with recent posts - ADVANCED DARK THEME with professional features
function getNewsletterHTMLWithPosts(posts) {
  console.log(`[getNewsletterHTMLWithPosts] Received ${posts ? posts.length : 0} posts`);
  const postsHTML = formatPostsForNewsletter(posts);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <style>
    /* Advanced CSS for email clients that support it */
    @media (prefers-color-scheme: dark) {
      .dark-mode-bg { background-color: #0a0a0a !important; }
      .dark-mode-text { color: #e0e0e0 !important; }
    }
    
    /* Smooth transitions for supported clients */
    .post-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    /* Hover effects for desktop email clients */
    @media (hover: hover) {
      .post-link:hover {
        opacity: 0.8;
        transform: translateX(4px);
      }
      .cta-button:hover {
        background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%) !important;
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(96, 165, 250, 0.3) !important;
      }
    }
    
    /* Animation for breaking news badge */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .breaking-badge {
      animation: pulse 2s ease-in-out infinite;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0a0a0a;">
    <tr>
      <td style="padding: 0;">
        <!-- Header with gradient and glow effect -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); position: relative;">
          <tr>
            <td style="padding: 60px 40px; text-align: center; position: relative;">
              <!-- Glow effect behind logo -->
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 120px; height: 120px; background: radial-gradient(circle, rgba(96, 165, 250, 0.2) 0%, transparent 70%); border-radius: 50%;"></div>
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News" style="max-width: 90px; height: auto; border-radius: 50%; display: block; margin: 0 auto 24px; border: 3px solid rgba(96, 165, 250, 0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 40px rgba(96, 165, 250, 0.1); position: relative; z-index: 1;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 800; letter-spacing: -1px; text-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(96, 165, 250, 0.2); position: relative; z-index: 1;">Noteworthy News</h1>
              <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.7); font-size: 15px; font-weight: 400; letter-spacing: 0.3px; position: relative; z-index: 1;">Fact-checked stories you need to know</p>
            </td>
          </tr>
        </table>
        
        <!-- Main Content - DARK BACKGROUND with subtle texture -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0f0f23; background-image: radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.03) 0%, transparent 50%);">
          <tr>
            <td style="padding: 60px 40px;">
              <p style="margin: 0 0 50px 0; color: #e0e0e0; font-size: 18px; line-height: 1.7; font-weight: 400;">Hi {{FIRST_NAME}},</p>
              <p style="margin: 0 0 60px 0; color: #b0b0b0; font-size: 16px; line-height: 1.8;">Here's what's happening in the world of fact-checked news:</p>
              
              ${postsHTML}
              
            </td>
          </tr>
        </table>
        
        <!-- Footer - DARK BACKGROUND with seal -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #0f0f23;">
          <tr>
            <td style="padding: 0 40px 60px 40px; border-top: 1px solid rgba(255,255,255,0.1);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 50px 0 30px 0;">
                    <img src="https://noteworthynews.co/sealofapp.png" alt="Seal" style="max-width: 80px; height: auto; display: block; margin: 0 auto; opacity: 0.9; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));" />
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 24px 0; color: #ffffff; font-size: 17px; font-weight: 600; letter-spacing: 0.2px;">Stay informed, stay curious.</p>
                    <p style="margin: 0 0 40px 0; color: #888; font-size: 14px; line-height: 1.6;">— The Noteworthy News Team</p>
                    <p style="margin: 0; text-align: center;">
                      <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #666; font-size: 12px; text-decoration: underline;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Bottom Spacer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding: 40px 20px; text-align: center; background-color: #0a0a0a;">
              <p style="margin: 0; color: #555; font-size: 12px;">Noteworthy News · <a href="https://noteworthynews.co" style="color: #60a5fa; text-decoration: none;">noteworthynews.co</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Newsletter text template with recent posts
function getNewsletterTextWithPosts(posts) {
  let postsText = '';
  
  if (posts && posts.length > 0) {
    posts.forEach((post, index) => {
      const text = post.story || post.text || post.title || '';
      const link = post.link || post.url || `https://x.com/newsnoteworthy/status/${post.id}`;
      const datePosted = post.datePosted || post.createdAt || post.created_at || '';
      
      let dateStr = '';
      if (datePosted) {
        try {
          const date = new Date(datePosted);
          dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {
          dateStr = datePosted;
        }
      }
      
      postsText += `\n\n${index + 1}. ${text}`;
      if (dateStr) postsText += `\n   ${dateStr}`;
      postsText += `\n   ${link}`;
    });
  } else {
    postsText = '\n\nNo recent posts to display.';
  }
  
  return `Noteworthy News
Fact-checked stories you need to know

Hi {{FIRST_NAME}},

Here's what's happening in the world of fact-checked news:${postsText}

Stay informed, stay curious.

— The Noteworthy News Team

---
Unsubscribe: {{{UNSUBSCRIBE_URL}}}`;
}

