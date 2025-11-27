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
async function fetchRecentPosts(limit = 10, startDate = null, endDate = null) {
  try {
    const siteUrl = process.env.URL || 'https://noteworthynews.co';
    // Fetch more posts if filtering by date to ensure we have enough
    const fetchLimit = startDate && endDate ? Math.max(limit * 5, 50) : limit;
    const url = `${siteUrl}/.netlify/functions/posts-read?limit=${fetchLimit}`;
    
    console.log(`[fetchRecentPosts] Fetching from: ${url}${startDate && endDate ? ` (filtering to ${startDate} - ${endDate})` : ''}`);
    
    // Use fetch if available (Node 18+), otherwise fall back to http/https
    if (typeof fetch !== 'undefined') {
      const response = await fetch(url);
      console.log(`[fetchRecentPosts] Response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const posts = await response.json();
      console.log(`[fetchRecentPosts] Received ${Array.isArray(posts) ? posts.length : 0} posts`);
      
      // Sort posts by date (newest first) and optionally filter by date range
      if (Array.isArray(posts) && posts.length > 0) {
        let filteredPosts = posts;
        
        // Filter by date range if provided
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          filteredPosts = posts.filter(post => {
            const dateValue = post.datePosted || post.createdAt || post.created_at || post.Date || '';
            const dateStr = String(dateValue);
            
            // Check if date string contains Nov 25 or Nov 26 (for CSV format like "Sun, Nov 25, 2025")
            if (dateStr.includes('Nov 25') || dateStr.includes('Nov 26') || 
                dateStr.includes('11/25') || dateStr.includes('11/26') ||
                dateStr.includes('2025-11-25') || dateStr.includes('2025-11-26')) {
              return true;
            }
            
            // Try parsing as Date object
            const postDate = new Date(dateValue);
            if (!isNaN(postDate.getTime())) {
              // Check if date falls within range (accounting for timezone)
              const postDateUTC = new Date(postDate.getUTCFullYear(), postDate.getUTCMonth(), postDate.getUTCDate());
              const startUTC = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
              const endUTC = new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
              return postDateUTC >= startUTC && postDateUTC <= endUTC;
            }
            
            return false;
          });
          console.log(`[fetchRecentPosts] Filtered ${filteredPosts.length} posts from Nov 25-26, 2025 out of ${posts.length} total posts`);
        }
        
        // Sort by date (newest first)
        const sortedPosts = filteredPosts.sort((a, b) => {
          const dateA = new Date(a.datePosted || a.createdAt || a.created_at || 0);
          const dateB = new Date(b.datePosted || b.createdAt || b.created_at || 0);
          return dateB - dateA; // Newest first
        });
        
        // Take only the most recent posts (up to limit)
        const recentPosts = sortedPosts.slice(0, limit);
        console.log(`[fetchRecentPosts] Returning ${recentPosts.length} posts${startDate && endDate ? ' from Nov 25-26, 2025' : ''}`);
        if (recentPosts.length > 0) {
          console.log(`[fetchRecentPosts] First post (newest):`, JSON.stringify({
            id: recentPosts[0].id,
            date: recentPosts[0].datePosted || recentPosts[0].createdAt,
            text: (recentPosts[0].story || recentPosts[0].text || '').substring(0, 100)
          }));
        }
        return recentPosts;
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
    return '<div style="text-align: center; padding: 60px 40px; background: rgba(96, 165, 250, 0.05); border-radius: 16px; border: 1px solid rgba(96, 165, 250, 0.2);"><p style="color: #888; font-size: 16px; margin: 0; line-height: 1.6;">No posts found for the selected date range. Check back soon for new stories!</p></div>';
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
    
    // Check if it's a BREAKING news story - check BEFORE escaping HTML
    const isBreaking = text.toUpperCase().includes('BREAKING');
    
    console.log(`[formatPostsForNewsletter] Post ${index + 1}: id=${post.id}, text="${text.substring(0, 50)}...", textLength=${text.length}, isBreaking=${isBreaking}, hasImage=${!!image}, link=${link.substring(0, 50)}...`);
    
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
    
    // Get engagement stats if available (handle both camelCase and lowercase)
    const impressions = post.Impressions || post.impressions || post.views || 0;
    const likes = post.Likes || post.likes || 0;
    const engagements = post.Engagements || post.engagements || 0;
    
    html += `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 50px; background-color: transparent !important;" class="post-card">
        <tr>
          <td style="background: linear-gradient(135deg, rgba(96, 165, 250, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%) !important; background-color: rgba(15, 15, 35, 0.8) !important; border-radius: 16px; padding: 30px; border: 1px solid rgba(255,255,255,0.08);">
            ${isBreaking ? `
              <div style="display: inline-block; margin-bottom: 16px; padding: 6px 12px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important; background-color: #ef4444 !important; border-radius: 20px;">
                <span style="color: #ffffff !important; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; background-color: transparent !important;" class="breaking-badge">⚡ BREAKING</span>
              </div>
            ` : ''}
            ${safeImage ? `
              <a href="${safeLink}" style="display: block; margin-bottom: 24px; text-decoration: none; border-radius: 12px; overflow: hidden; background-color: transparent !important;">
                <img src="${safeImage}" alt="Post image" style="width: 100%; max-width: 100%; height: auto; border-radius: 12px; display: block; border: none; box-shadow: 0 8px 24px rgba(0,0,0,0.4); transition: transform 0.3s ease;" />
              </a>
            ` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: transparent !important;">
              <tr>
                <td style="padding: 0; background-color: transparent !important;">
                  ${dateStr ? `
                    <p style="margin: 0 0 12px 0; color: #888 !important; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; background-color: transparent !important;">${dateStr}</p>
                  ` : ''}
                  <h2 style="margin: 0 0 20px 0; color: #ffffff !important; font-size: 24px; line-height: 1.5; font-weight: 700; letter-spacing: -0.3px; background-color: transparent !important;">
                    <a href="${safeLink}" class="post-link" style="color: #ffffff !important; text-decoration: none; display: block; background-color: transparent !important;">${safeText}</a>
                  </h2>
                  ${impressions > 0 || likes > 0 ? `
                    <div style="display: flex; gap: 20px; margin-bottom: 20px; color: #888 !important; font-size: 12px; background-color: transparent !important;">
                      ${impressions > 0 ? `<span style="background-color: transparent !important;">👁️ ${formatNumber(impressions)} views</span>` : ''}
                      ${likes > 0 ? `<span style="background-color: transparent !important;">❤️ ${formatNumber(likes)} likes</span>` : ''}
                    </div>
                  ` : ''}
                  <a href="${safeLink}" class="cta-button" style="display: inline-block; color: #60a5fa !important; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 24px; background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.05) 100%) !important; background-color: rgba(96, 165, 250, 0.1) !important; border-radius: 8px; border: 1px solid rgba(96, 165, 250, 0.3); transition: all 0.2s ease;">Read Story →</a>
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
    // SECURITY: Require admin token for sending newsletters (protects email addresses)
    const adminToken = process.env.ADMIN_ANALYTICS_TOKEN;
    const providedToken = event.queryStringParameters?.token || 
                         event.headers['x-admin-token'] || 
                         (event.body ? (() => {
                           try {
                             return JSON.parse(event.body || '{}').token;
                           } catch {
                             return null;
                           }
                         })() : null);
    
    if (adminToken && providedToken !== adminToken) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Unauthorized - Admin token required',
          message: 'This endpoint requires admin authentication. Please provide a valid admin token.'
        }),
      };
    }
    
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

    // Get newsletter content from request body (if POST) or use defaults
    let newsletterData = {};
    if (event.httpMethod === 'POST' && event.body) {
      try {
        const bodyData = JSON.parse(event.body);
        // Remove token from newsletterData (don't pass it through)
        const { token, ...rest } = bodyData;
        newsletterData = rest;
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    const testEmail = newsletterData.testEmail; // Check early if this is a test
    const sendToEmails = newsletterData.sendToEmails; // Check if sending to specific emails
    
    // Check if audience ID is configured (only required for mass audience sends)
    // sendToEmails and testEmail don't need audience ID
    if (!NEWSLETTER_AUDIENCE_ID && !testEmail && !sendToEmails) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'RESEND_AUDIENCE_ID not configured. Please set it in Netlify environment variables.',
          hint: 'Get your Audience ID from https://resend.com/audiences',
          note: 'Test emails (with testEmail or sendToEmails parameter) can be sent without RESEND_AUDIENCE_ID'
        }),
      };
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    const subject = newsletterData.subject || 'Noteworthy News - Latest Stories';
    let htmlContent = newsletterData.html;
    let textContent = newsletterData.text;
    // testEmail already declared above
    const includeRecentPosts = newsletterData.includeRecentPosts !== false; // Default to true
    
    // Always fetch posts if includeRecentPosts is true (even if custom HTML provided)
    let recentPosts = [];
    if (includeRecentPosts) {
      console.log('📰 Fetching recent posts for newsletter...');
      // Filter to Nov 25-26, 2025 (if no posts found, fall back to most recent)
      const startDate = '2025-11-25T00:00:00.000Z';
      const endDate = '2025-11-26T23:59:59.999Z';
      recentPosts = await fetchRecentPosts(10, startDate, endDate); // Get 10 posts from Nov 25-26
      console.log(`✅ Found ${recentPosts.length} posts from Nov 25-26, 2025`);
      
      // If no posts found in date range, get most recent posts instead
      if (recentPosts.length === 0) {
        console.log('⚠️ No posts found for Nov 25-26, fetching most recent posts instead');
        recentPosts = await fetchRecentPosts(10); // Get 10 most recent posts without date filter
        console.log(`✅ Found ${recentPosts.length} most recent posts (fallback)`);
      }
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

    // If testEmail or sendToEmails is provided, send only to those emails and STOP HERE
    // sendToEmails can be an array of emails to send to specific recipients
    const emailsToSend = newsletterData.sendToEmails || (testEmail ? [testEmail] : null);
    
    if (emailsToSend && emailsToSend.length > 0) {
      console.log(`📧 SENDING TO SPECIFIC EMAILS: ${emailsToSend.length} email(s) - WILL NOT SEND TO AUDIENCE`);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const email of emailsToSend) {
        try {
          const unsubscribeUrl = `https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(Buffer.from(email).toString('base64'))}`;
          let personalizedHtml = htmlContent.replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, unsubscribeUrl).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
          let personalizedText = textContent.replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, unsubscribeUrl).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
          
          // Get custom data for this email (if provided as array or object)
          let customData = {};
          if (newsletterData.customData) {
            if (Array.isArray(newsletterData.customData)) {
              // Find matching email in array
              const match = newsletterData.customData.find(d => d.email === email);
              if (match) customData = match;
            } else if (newsletterData.customData.email === email) {
              customData = newsletterData.customData;
            }
          }
          
          const firstName = customData.firstName || email.split('@')[0];
          const fullName = customData.fullName || firstName;
          const emailUsername = email.split('@')[0];
          
          // For sendToEmails, use full name in greeting
          personalizedHtml = personalizedHtml
            .replace(/\{\{FIRST_NAME\}\}/g, firstName)
            .replace(/\{\{LAST_NAME\}\}/g, '')
            .replace(/\{\{FULL_NAME\}\}/g, fullName)
            .replace(/\{\{EMAIL\}\}/g, email)
            .replace(/\{\{EMAIL_USERNAME\}\}/g, emailUsername);
          
          personalizedText = personalizedText
            .replace(/\{\{FIRST_NAME\}\}/g, firstName)
            .replace(/\{\{LAST_NAME\}\}/g, '')
            .replace(/\{\{FULL_NAME\}\}/g, fullName)
            .replace(/\{\{EMAIL\}\}/g, email)
            .replace(/\{\{EMAIL_USERNAME\}\}/g, emailUsername);
          
          const result = await resend.emails.send({
            from: fromEmail,
            to: email,
            replyTo: 'richard@noteworthynews.co',
            subject: subject, // Same subject as mass email
            html: personalizedHtml,
            text: personalizedText,
            clickTracking: true,
            openTracking: true,
          });

          if (result.error) {
            throw new Error(result.error.message || 'Unknown error');
          }

          console.log(`✅ Email sent successfully to ${email}`);
          successCount++;
          results.push({ email, success: true, id: result.data?.id });
        } catch (error) {
          console.error(`❌ Failed to send to ${email}:`, error.message);
          errorCount++;
          results.push({ email, success: false, error: error.message });
        }
      }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Sent to ${successCount} of ${emailsToSend.length} specific email(s) (not sent to audience)`,
            emailsSent: successCount,
            errors: errorCount,
            results: results,
          }),
        };
      }
    
    // SAFETY CHECK: If we get here, testEmail was NOT provided, so we're sending to audience
    console.log('📧 PRODUCTION MODE: Sending to full audience (testEmail was not provided)');

    // SAFETY: Check for recent send to prevent spam (but allow override)
    const { getStore } = require("@netlify/blobs");
    let lastSendTime = null;
    const COOLDOWN_HOURS = 24; // Minimum 24 hours between sends
    const forceSend = newsletterData.forceSend === true; // Allow bypassing cooldown
    
    if (!forceSend) {
      try {
        const store = getStore({
          name: "newsletter-data",
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        });
        
        const lastSendData = await store.get("last-send-time", { type: "json" });
        if (lastSendData && lastSendData.timestamp) {
          lastSendTime = new Date(lastSendData.timestamp);
          const hoursSinceLastSend = (Date.now() - lastSendTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceLastSend < COOLDOWN_HOURS) {
            const remainingHours = Math.ceil(COOLDOWN_HOURS - hoursSinceLastSend);
            return {
              statusCode: 429,
              headers,
              body: JSON.stringify({
                error: 'Cooldown period active',
                message: `Cannot send newsletter yet. Last send was ${Math.floor(hoursSinceLastSend)} hours ago. Please wait ${remainingHours} more hour(s) before sending again. Add "forceSend: true" to bypass.`,
                lastSendTime: lastSendTime.toISOString(),
                hoursSinceLastSend: Math.floor(hoursSinceLastSend),
                remainingHours: remainingHours,
              }),
            };
          }
          
          console.log(`⏰ Last newsletter was sent ${Math.floor(hoursSinceLastSend)} hours ago (cooldown: ${COOLDOWN_HOURS} hours)`);
        }
      } catch (cooldownError) {
        console.warn('⚠️ Could not check last send time (continuing anyway):', cooldownError.message);
        // Don't block sending if we can't check - might be first time
      }
    } else {
      console.log('⚠️ FORCE SEND enabled - bypassing cooldown check');
    }
    
    // Get list of emails to skip (those who already received it)
    const skipEmails = newsletterData.skipEmails || [];
    const alwaysIncludeEmails = newsletterData.alwaysIncludeEmails || [];
    console.log(`📋 Skipping ${skipEmails.length} emails that already received it`);
    if (skipEmails.length > 0) {
      console.log(`📋 Skip list contains ${skipEmails.length} email(s)`);
    }
    console.log(`📋 Always including ${alwaysIncludeEmails.length} emails`);
    if (alwaysIncludeEmails.length > 0) {
      console.log(`📋 Always-include list contains ${alwaysIncludeEmails.length} email(s)`);
    }

    console.log('Fetching contacts from audience:', NEWSLETTER_AUDIENCE_ID);

    // Get all contacts from the audience
    let allContacts = [];
    let page = 1;
    let hasMore = true;
    let totalContactsFound = 0;
    let totalUnsubscribed = 0;

    while (hasMore) {
      try {
        const contactsResponse = await resend.contacts.list({
          audienceId: NEWSLETTER_AUDIENCE_ID,
          page: page,
        });

        const contacts = contactsResponse.data?.data || [];
        const pagination = contactsResponse.data || {};
        const responseData = contactsResponse.data || {};
        totalContactsFound += contacts.length;
        
        // Debug: Log full response structure for first page
        if (page === 1) {
          console.log('📋 First page response structure:', JSON.stringify({
            hasData: !!contactsResponse.data,
            dataKeys: contactsResponse.data ? Object.keys(contactsResponse.data) : [],
            contactsCount: contacts.length,
            paginationKeys: Object.keys(pagination),
            fullResponseKeys: Object.keys(contactsResponse),
            pagination: pagination,
            responseData: responseData
          }, null, 2));
        }

        // Filter out unsubscribed contacts
        const subscribedContacts = contacts.filter(contact => {
          if (contact.unsubscribed === true) {
            totalUnsubscribed++;
            return false;
          }
          return true;
        });

        allContacts = allContacts.concat(subscribedContacts);
        console.log(`Page ${page}: Found ${subscribedContacts.length} subscribed contacts (${contacts.length} total on this page, ${totalUnsubscribed} unsubscribed so far)`);
        
        // Log count only (don't expose email addresses in logs)
        if (subscribedContacts.length > 0) {
          console.log(`  Found ${subscribedContacts.length} subscribed contact(s) on page ${page}`);
        }

        // Check if there are more pages - Resend API pagination
        // The response might have has_more, hasMore, or we need to check if we got fewer contacts than expected
        // Also check the response structure - sometimes pagination info is at the top level
        const hasMoreFlag = 
          pagination.has_more === true || 
          pagination.hasMore === true ||
          responseData.has_more === true ||
          responseData.hasMore === true ||
          contactsResponse.has_more === true ||
          contactsResponse.hasMore === true;
        
        // If we got contacts on this page, continue to next page
        // Only stop if we got 0 contacts AND no has_more flag
        hasMore = contacts.length > 0 || hasMoreFlag;
        
        console.log(`  Pagination info: has_more=${pagination.has_more}, hasMore=${pagination.hasMore}, responseData.has_more=${responseData.has_more}, contacts.length=${contacts.length}, willContinue=${hasMore}`);
        
        // If we got 0 contacts and no has_more flag, definitely stop
        if (contacts.length === 0 && !hasMoreFlag) {
          hasMore = false;
          console.log('  No more contacts and no has_more flag, stopping pagination');
        } else if (contacts.length > 0) {
          // If we got contacts, always try the next page (Resend might not set has_more correctly)
          // We'll stop when we get 0 contacts
          console.log(`  Got ${contacts.length} contacts, will try next page...`);
        }
        
        page++;
        
        // Safety limit to prevent infinite loops
        if (page > 100) {
          console.warn('⚠️ Reached page limit (100), stopping pagination');
          hasMore = false;
        }
      } catch (error) {
        console.error(`Error fetching contacts on page ${page}:`, error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        // Don't stop on error - try to continue, but log it
        if (page === 1) {
          // If first page fails, that's a real problem
          hasMore = false;
        } else {
          // If later page fails, we might have gotten all contacts
          console.log('  Error on later page, assuming we got all contacts');
          hasMore = false;
        }
      }
    }

    console.log(`\n📊 Contact Summary:`);
    console.log(`  Total contacts in audience: ${totalContactsFound}`);
    console.log(`  Unsubscribed: ${totalUnsubscribed}`);
    console.log(`  Subscribed (will receive email): ${allContacts.length}`);

    if (allContacts.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No subscribed contacts found in audience',
          contactsCount: 0,
          totalContactsFound: totalContactsFound,
          unsubscribedCount: totalUnsubscribed,
          emailsSent: 0,
        }),
      };
    }

    // Validate email addresses before sending and filter out skipped emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const skipEmailsLower = skipEmails.map(e => e.toLowerCase().trim());
    const alwaysIncludeEmailsLower = alwaysIncludeEmails.map(e => e.toLowerCase().trim());
    
    const validContacts = allContacts.filter(contact => {
      if (!contact.email) {
        console.warn(`⚠️ Contact missing email:`, contact);
        return false;
      }
      if (!emailRegex.test(contact.email)) {
        console.warn(`⚠️ Invalid email format: ${contact.email}`);
        return false;
      }
      
      const emailLower = contact.email.toLowerCase().trim();
      
      // Always include emails in the alwaysIncludeEmails list
      if (alwaysIncludeEmailsLower.includes(emailLower)) {
        console.log(`✅ Always including 1 contact (email in always-include list)`);
        return true;
      }
      
      // Skip emails that already received it
      if (skipEmailsLower.includes(emailLower)) {
        console.log(`⏭️  Skipping 1 contact (already received)`);
        return false;
      }
      
      return true;
    });

    if (validContacts.length < allContacts.length) {
      const filtered = allContacts.length - validContacts.length;
      console.warn(`⚠️ Filtered out ${filtered} contacts (invalid emails or already sent)`);
    }

    console.log(`\n📧 Sending to ${validContacts.length} valid email addresses (skipped ${skipEmails.length} that already received it)`);

    // Send newsletter to all valid contacts
    // Resend allows sending to multiple recipients, but we'll send individually
    // to ensure proper unsubscribe handling and avoid rate limits
    const emailAddresses = validContacts.map(contact => contact.email).filter(Boolean);
    
    // Generate personalized emails for each contact
    const emailsWithPersonalization = validContacts.map(contact => {
      const email = contact.email;
      if (!email) return null;
      
      const encodedEmail = Buffer.from(email).toString('base64');
      const unsubscribeUrl = `https://noteworthynews.co/unsubscribe.html?email=${encodeURIComponent(encodedEmail)}`;
      
      // Get contact data for personalization
      const firstName = contact.firstName || contact.first_name || '';
      const lastName = contact.lastName || contact.last_name || '';
      const fullName = contact.name || `${firstName} ${lastName}`.trim() || email.split('@')[0];
      const emailUsername = email.split('@')[0];
      
      // Replace personalization placeholders
      // Use fullName in greeting (template uses {{FULL_NAME}})
      let personalizedHtml = htmlContent
        .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, unsubscribeUrl)
        .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl)
        .replace(/\{\{FIRST_NAME\}\}/g, firstName || emailUsername)
        .replace(/\{\{LAST_NAME\}\}/g, lastName || '')
        .replace(/\{\{FULL_NAME\}\}/g, fullName)
        .replace(/\{\{EMAIL\}\}/g, email)
        .replace(/\{\{EMAIL_USERNAME\}\}/g, emailUsername);
      
      let personalizedText = textContent
        .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, unsubscribeUrl)
        .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl)
        .replace(/\{\{FIRST_NAME\}\}/g, firstName || emailUsername)
        .replace(/\{\{LAST_NAME\}\}/g, lastName || '')
        .replace(/\{\{FULL_NAME\}\}/g, fullName)
        .replace(/\{\{EMAIL\}\}/g, email)
        .replace(/\{\{EMAIL_USERNAME\}\}/g, emailUsername);
      
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
    const successfulEmails = [];

    console.log(`\n📤 Starting to send ${emailsWithPersonalization.length} emails in batches of ${batchSize}...\n`);

    for (let i = 0; i < emailsWithPersonalization.length; i += batchSize) {
      const batch = emailsWithPersonalization.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`📦 Batch ${batchNumber}/${Math.ceil(emailsWithPersonalization.length / batchSize)}: Sending to ${batch.length} recipients...`);
      
      // Send emails in parallel within each batch with retry logic
      const batchPromises = batch.map(async ({ email, html, text }, index) => {
        const maxRetries = 2;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`  [${batchNumber}-${index + 1}] Attempt ${attempt}/${maxRetries}: Sending email...`);
            
            const result = await resend.emails.send({
              from: fromEmail,
              to: email,
              replyTo: 'richard@noteworthynews.co',
              subject: subject,
              html: html,
              text: text,
              clickTracking: true, // Track link clicks
              openTracking: true, // Track email opens
            });

            if (result.error) {
              throw new Error(result.error.message || 'Unknown error');
            }

            console.log(`  ✅ [${batchNumber}-${index + 1}] Successfully sent (ID: ${result.data?.id})`);
            return { success: true, email, id: result.data?.id };
          } catch (error) {
            lastError = error;
            const errorMsg = error.message || String(error);
            
            // Check if it's a bounce/suppression error
            const isBounce = errorMsg.toLowerCase().includes('bounce') || 
                           errorMsg.toLowerCase().includes('suppressed') ||
                           errorMsg.toLowerCase().includes('invalid') ||
                           errorMsg.toLowerCase().includes('rejected');
            
            if (isBounce && attempt === 1) {
              // Don't retry bounces - they're permanent failures
              console.log(`  ❌ [${batchNumber}-${index + 1}] BOUNCE/SUPPRESSION: ${errorMsg}`);
              break;
            }
            
            if (attempt < maxRetries) {
              console.log(`  ⚠️  [${batchNumber}-${index + 1}] Attempt ${attempt} failed, retrying... (${errorMsg.substring(0, 50)})`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
            } else {
              console.log(`  ❌ [${batchNumber}-${index + 1}] Failed after ${maxRetries} attempts: ${errorMsg.substring(0, 50)}`);
            }
          }
        }
        
        return { success: false, email, error: lastError?.message || 'Unknown error' };
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          successCount++;
          successfulEmails.push(result.email);
        } else {
          errorCount++;
          errors.push({ email: result.email, error: result.error });
        }
      });

      console.log(`\n📊 Batch ${batchNumber} Summary: ${successCount} sent, ${errorCount} errors (Total progress: ${successCount + errorCount}/${emailsWithPersonalization.length})\n`);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < emailsWithPersonalization.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    console.log(`\n✅ FINAL SUMMARY:`);
    console.log(`  Total contacts in audience: ${totalContactsFound}`);
    console.log(`  Subscribed contacts: ${validContacts.length}`);
    console.log(`  Successfully sent: ${successCount}`);
    console.log(`  Failed: ${errorCount}`);
    // Don't log email addresses in summary
    if (successfulEmails.length > 0) {
      console.log(`  ✅ Successfully sent to ${successfulEmails.length} email(s)`);
    }
    if (errors.length > 0) {
      console.log(`  ❌ Failed: ${errors.length} email(s)`);
      // Only log error types, not email addresses
      const errorTypes = {};
      errors.forEach(e => {
        const errorType = e.error?.substring(0, 50) || 'Unknown error';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`     - ${count} error(s): ${type}`);
      });
    }

    // SAFETY: Store the send time to prevent spam
    if (successCount > 0) {
      try {
        const { getStore } = require("@netlify/blobs");
        const store = getStore({
          name: "newsletter-data",
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
        });
        
        await store.set("last-send-time", JSON.stringify({
          timestamp: new Date().toISOString(),
          emailsSent: successCount,
          totalContacts: validContacts.length,
          subject: subject,
        }));
        console.log('💾 Saved send time to prevent duplicate sends');
      } catch (saveError) {
        console.warn('⚠️ Could not save send time:', saveError.message);
        // Don't fail the request if we can't save
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Newsletter sent to ${successCount} of ${validContacts.length} subscribers`,
        contactsCount: validContacts.length,
        totalContactsFound: totalContactsFound,
        unsubscribedCount: totalUnsubscribed,
        emailsSent: successCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors.slice(0, 20) : [], // Show more error details
        bouncedEmails: errors.filter(e => {
          const err = e.error?.toLowerCase() || '';
          return err.includes('bounce') || err.includes('suppressed') || err.includes('invalid');
        }).map(e => e.email),
        successfulEmails: successfulEmails,
        failedEmails: errors.map(e => e.email),
        sendTime: new Date().toISOString(),
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

// Newsletter HTML template - Professional Briefing Format
function getNewsletterHTMLWithPosts(posts) {
  console.log(`[getNewsletterHTMLWithPosts] Received ${posts ? posts.length : 0} posts`);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <style>
    body,html{background-color:#0b1020!important;color:#f9fafb!important;margin:0;padding:0}
    table,td,tr,div,p,h1,h2,h3,a,span{background-color:inherit!important;color:inherit!important}
    table[role="presentation"]{background-color:#0b1020!important}
    u+.body .gmail-blend-screen,u+.body .gmail-blend-difference,.gmail-blend-screen,.gmail-blend-difference{background-color:#0b1020!important}
    .ii a[href]{color:#60a5fa!important}
    [data-ogsc] body,[data-ogsc] table{background-color:#0b1020!important}
    @media (prefers-color-scheme:light){body,html,table,td{background-color:#0b1020!important;color:#f9fafb!important}}
  </style>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0b1020!important;color-scheme:dark only">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1020!important">
    <tr>
      <td style="padding:40px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
          <tr>
            <td style="padding:30px 40px;background-color:#050814!important;border-bottom:1px solid rgba(96,165,250,0.2)">
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News" style="max-width:60px;height:auto;display:block;margin:0 0 16px 0" />
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff!important">Noteworthy News</h1>
              <p style="margin:4px 0 0;color:#9ca3af!important;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">Weekly Briefing</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#141b2b!important">
          <tr>
            <td style="padding:50px 40px;background-color:#141b2b!important">
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">Wednesday, November 26, 2025</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Today there was a shooting downtown in Washington DC. Below is a summary of our coverage.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600"><strong>BREAKING:</strong></p>
              <p style="margin:0 0 20px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">President Trump has delivered a live statement blaming the Washington, D.C. shooting on the Biden administration's security failures and on what he described as "refugee mismanagement," specifically referencing Somali immigrant communities in Minnesota.</p>
              <p style="margin:0 0 20px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">According to Trump, the suspected shooter entered the United States from Afghanistan in 2021.</p>
              <p style="margin:0 0 20px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">Trump also announced he is ordering 500 additional National Guard soldiers to be deployed to Washington, D.C.</p>
              <img src="https://noteworthynews.co/trumpspeech.png" alt="President Trump delivering a statement regarding the Washington, D.C. shooting and announcing additional National Guard deployment" width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:14px 0 30px 0" />
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600"><strong>UPDATE:</strong></p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">WASHINGTON (@AP) — Trump calls for reinvestigation of all Afghan refugees who entered under Biden admin after National Guard shooting.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Snapshot</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Key developments</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Two members of the West Virginia National Guard were ambushed and shot in downtown Washington, D.C. while on duty.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Governor Morrisey announced earlier today that both Guardsmen have reportedly died, but quickly made another announcement saying that there is conflicting information and federal officials have not confirmed this.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">The suspect was shot by responding personnel and is hospitalized with serious but non–life-threatening injuries.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Conflicting statements from state and federal officials have created uncertainty about the soldiers' current status.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Motive is unknown; investigators have not released a timeline.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Information remains fluid.</span></li>
              </ul>
              
              <p style="margin:50px 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Governor's statement</p>
              <img src="https://noteworthynews.co/G6tYeskW8AIyhTl.jpeg" alt="Statement by West Virginia Governor Patrick Morrisey regarding the shooting in Washington, D.C." width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:10px 0" />
              <p style="margin:20px 0 8px 0;color:#3b82f6!important;font-size:13px;font-weight:600">What this shows</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">Governor Morrisey's statement reflects the information as he understands it, but federal officials have not confirmed his claim about the soldiers' deaths. His messaging focuses on grief and service, not investigative detail.</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">Notably, no operational timeline or warning-sign discussion has been released yet, which leaves major gaps in understanding what actually unfolded.</p>
              <p style="margin:50px 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">President Trump's statement</p>
              <img src="https://noteworthynews.co/G6tTciHXcAApR3V.jpeg" alt="Statement by President Donald Trump responding to the shooting of two National Guardsmen" width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:10px 0 50px 0" />
              <p style="margin:50px 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Scene documentation</p>
              <div style="margin:18px 0 10px 0;padding:10px 12px;border-radius:6px;background:rgba(220,38,38,0.12)!important;border:1px solid rgba(248,113,113,0.5)">
                <p style="margin:0;font-size:12px;color:#fecaca!important;font-weight:600;text-transform:uppercase;letter-spacing:0.13em">Graphic content</p>
                <p style="margin:4px 0 0;font-size:13px;color:#f9fafb!important;line-height:1.5">The image below shows a wounded National Guard soldier receiving medical aid at the scene. Viewer discretion is advised.</p>
              </div>
              <img src="https://noteworthynews.co/G6tam5dX0AAZELx.jpeg" alt="Wounded National Guard soldier receiving medical aid after the shooting in Washington, D.C." width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:10px 0 50px 0" />
              <p style="margin:50px 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Suspect & emerging details</p>
              <img src="https://noteworthynews.co/G6uOL1PaUAASlxA.jpeg" alt="Photo of the alleged suspect in the Washington, D.C. National Guard shooting." width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:10px 0" />
              <p style="margin:20px 0 50px 0;color:#f9fafb!important;font-size:15px;line-height:1.6">Authorities have identified the suspect as Rahmanullah Lakanwal, a 29-year-old Afghan national. Early reporting from U.S. outlets indicates he was in the United States without legal status and is now hospitalized after being shot by responding personnel. Investigators have not yet publicly released a full timeline of his movements, prior contacts with law enforcement, or any manifesto or formal statement of motive.</p>
              <img src="https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg" alt="Preview image" width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:50px 0 20px 0" />
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">What we're watching next</p>
              <ul style="list-style:none;margin:8px 0 50px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6"><strong>Timeline reconstruction:</strong> When and how the suspect first appeared on law-enforcement radar, and whether any red flags were missed.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6"><strong>Force-protection changes:</strong> Whether the attack leads to new rules of engagement, armor, or posture for Guard deployments in D.C. and other cities.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6"><strong>Federal–state friction:</strong> How federal agencies, D.C. officials, and state leaders like Governor Morrisey coordinate—or clash—over messaging and next steps.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6"><strong>Political framing:</strong> Whether this incident is used primarily to argue for changes in immigration policy, urban security, or both.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6"><strong>Motive and affiliation:</strong> Any evidence that clarifies whether this was a lone-actor attack or connected to a broader network or ideology.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Thank you for reading Noteworthy News.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
          <tr>
            <td style="padding:30px 20px;text-align:center;background-color:#050814!important;width:100%">
              <img src="https://noteworthynews.co/nw-logo.GIF" alt="Noteworthy News Logo" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto 30px;opacity:0.95" />
              <p style="margin:0 0 6px 0;font-size:11px;color:#6b7280!important;line-height:1.5">You're receiving this email because you subscribed to Noteworthy News.</p>
              <p style="margin:0;font-size:11px;color:#6b7280!important;line-height:1.5"><a href="{{{UNSUBSCRIBE_URL}}}" style="color:#3b82f6!important;text-decoration:underline;font-weight:500">Unsubscribe</a> · noteworthynews.co</p>
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

