// Send custom email with optional image attachment
// Used by AI assistant to send emails on behalf of users

const { Resend } = require('resend');

/**
 * Extract images from HTML and prepare them as CID attachments
 * Returns: { html: modifiedHtml, attachments: array of attachment objects }
 */
async function processImagesForEmail(htmlContent, baseUrl = 'https://noteworthynews.co') {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return { html: htmlContent, attachments: [] };
  }

  const attachments = [];
  const imageMap = new Map(); // Map original URLs to CID values
  const processedUrls = new Set(); // Track processed URLs to avoid duplicates
  
  // Find all img tags with src attributes
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches = [...htmlContent.matchAll(imgRegex)];
  
  console.log(`[processImagesForEmail] Found ${matches.length} images in HTML`);
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const originalSrc = match[1];
    const fullMatch = match[0];
    
    // Skip if already processed (has cid:)
    if (originalSrc.startsWith('cid:')) {
      continue;
    }
    
    // Skip if we've already processed this URL (avoid duplicate attachments)
    if (processedUrls.has(originalSrc)) {
      // Just replace the URL with the existing CID
      const existingCid = imageMap.get(originalSrc);
      if (existingCid) {
        const cidIdentifier = existingCid.split('@')[0];
        const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const imgSrcRegex = new RegExp(`(<img[^>]+src=["'])${escapedSrc}(["'][^>]*>)`, 'gi');
        htmlContent = htmlContent.replace(imgSrcRegex, `$1cid:${cidIdentifier}$2`);
      }
      continue;
    }
    
    // Skip external URLs that aren't from our domain (keep them as-is)
    if (originalSrc.startsWith('http') && !originalSrc.includes('noteworthynews.co') && !originalSrc.includes('get-uploaded-image')) {
      console.log(`[processImagesForEmail] Skipping external image: ${originalSrc.substring(0, 50)}...`);
      continue;
    }
    
    try {
      let imageUrl = originalSrc;
      let imageBuffer = null;
      let contentType = 'image/png';
      let filename = `image-${i + 1}.png`;
      
      // Handle data URLs
      if (originalSrc.startsWith('data:image/')) {
        const dataMatch = originalSrc.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (dataMatch) {
          contentType = `image/${dataMatch[1]}`;
          const extension = dataMatch[1] === 'jpeg' ? 'jpg' : dataMatch[1];
          filename = `image-${i + 1}.${extension}`;
          imageBuffer = Buffer.from(dataMatch[2], 'base64');
          console.log(`[processImagesForEmail] Processing data URL image: ${filename}`);
        }
      }
      // Handle get-uploaded-image URLs
      else if (originalSrc.includes('get-uploaded-image')) {
        // Extract key from URL
        const keyMatch = originalSrc.match(/[?&]key=([^&]+)/);
        if (keyMatch) {
          const imageKey = decodeURIComponent(keyMatch[1]);
          // Construct full URL if relative
          const fullImageUrl = originalSrc.startsWith('http') 
            ? originalSrc 
            : `${baseUrl}${originalSrc.startsWith('/') ? '' : '/'}${originalSrc}`;
          
          console.log(`[processImagesForEmail] Fetching uploaded image: ${imageKey}`);
          
          // Fetch the image
          const imageResponse = await fetch(fullImageUrl);
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            contentType = imageResponse.headers.get('content-type') || 'image/png';
            
            // Determine filename from key
            const keyParts = imageKey.split('.');
            if (keyParts.length > 1) {
              filename = `image-${i + 1}.${keyParts[keyParts.length - 1]}`;
            }
            console.log(`[processImagesForEmail] Successfully fetched image: ${filename} (${imageBuffer.length} bytes)`);
          } else {
            console.warn(`[processImagesForEmail] Failed to fetch image from ${fullImageUrl}: ${imageResponse.status}`);
            continue;
          }
        }
      }
      // Handle relative URLs that might be uploaded images
      else if (originalSrc.startsWith('/.netlify/functions/get-uploaded-image')) {
        const fullImageUrl = `${baseUrl}${originalSrc}`;
        console.log(`[processImagesForEmail] Fetching relative image URL: ${fullImageUrl}`);
        
        const imageResponse = await fetch(fullImageUrl);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
          contentType = imageResponse.headers.get('content-type') || 'image/png';
          filename = `image-${i + 1}.png`;
          console.log(`[processImagesForEmail] Successfully fetched relative image: ${filename} (${imageBuffer.length} bytes)`);
        } else {
          console.warn(`[processImagesForEmail] Failed to fetch relative image: ${imageResponse.status}`);
          continue;
        }
      }
      // Handle absolute HTTP/HTTPS URLs from our domain
      else if (originalSrc.startsWith('http') && originalSrc.includes('noteworthynews.co')) {
        console.log(`[processImagesForEmail] Fetching image from our domain: ${originalSrc}`);
        
        const imageResponse = await fetch(originalSrc);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
          contentType = imageResponse.headers.get('content-type') || 'image/png';
          filename = `image-${i + 1}.png`;
          console.log(`[processImagesForEmail] Successfully fetched domain image: ${filename} (${imageBuffer.length} bytes)`);
        } else {
          console.warn(`[processImagesForEmail] Failed to fetch domain image: ${imageResponse.status}`);
          continue;
        }
      }
      // Skip if we couldn't process it
      else {
        console.log(`[processImagesForEmail] Skipping unprocessable image URL: ${originalSrc.substring(0, 50)}...`);
        continue;
      }
      
      if (!imageBuffer) {
        continue;
      }
      
      // Generate unique CID (Content-ID for inline images)
      // Format: unique identifier, will be referenced as cid:identifier in HTML
      const cidIdentifier = `image-${i + 1}-${Date.now()}`;
      const fullCid = `${cidIdentifier}@noteworthynews.co`;
      
      // Create attachment with CID for inline embedding
      // Resend API format: content_id (snake_case) and content should be base64 string
      attachments.push({
        filename: filename,
        content: imageBuffer.toString('base64'), // Resend expects base64 string, not Buffer
        content_id: cidIdentifier, // Resend uses snake_case: content_id
        content_type: contentType, // Also use snake_case for consistency
      });
      
      // Mark this URL as processed
      processedUrls.add(originalSrc);
      
      // Map original src to CID
      imageMap.set(originalSrc, fullCid);
      
      // Replace src in HTML with CID reference (email standard format)
      // Use global replace to handle all instances of this image URL
      const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imgSrcRegex = new RegExp(`(<img[^>]+src=["'])${escapedSrc}(["'][^>]*>)`, 'gi');
      htmlContent = htmlContent.replace(imgSrcRegex, `$1cid:${cidIdentifier}$2`);
      
      console.log(`[processImagesForEmail] Replaced image ${i + 1} with CID: ${cidIdentifier}`);
    } catch (error) {
      console.error(`[processImagesForEmail] Error processing image ${i + 1}:`, error.message);
      // Continue with other images even if one fails
    }
  }
  
  console.log(`[processImagesForEmail] Processed ${attachments.length} images as CID attachments`);
  return { html: htmlContent, attachments };
}

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

    // Build email HTML content
    let htmlContent = `
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
    `;

    // Process images in HTML and embed as CID attachments
    const siteUrl = process.env.URL || 'https://noteworthynews.co';
    const { html: htmlWithCid, attachments: imageAttachments } = await processImagesForEmail(htmlContent, siteUrl);

    // Build email content
    let emailContent = {
      from: fromEmail,
      to: recipient_email,
      subject: subject,
      text: message,
      html: htmlWithCid,
    };

    // Add image attachments if any were processed
    if (imageAttachments && imageAttachments.length > 0) {
      emailContent.attachments = imageAttachments;
      console.log(`[send-custom-email] Added ${imageAttachments.length} image attachment(s) from HTML`);
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




