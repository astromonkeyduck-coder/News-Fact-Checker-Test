/**
 * Generate Newsletter HTML using AI
 * 
 * POST /.netlify/functions/generate-newsletter-html
 * 
 * Body:
 * {
 *   "subject": "...",
 *   "preheader": "...",
 *   "promptText": "...",
 *   "attachments": [
 *     { "id": "...", "title": "...", "mimeType": "image/png", "dataUrl": "data:image/png;base64,..." }
 *   ],
 *   "styleReference": { "name": "...", "sentAt": "..." }
 * }
 * 
 * Returns:
 * {
 *   "html": "<!doctype html>...",
 *   "warnings": [],
 *   "sections": []
 * }
 */

const { getHouseStyleTemplate, STYLE_GUIDE } = require('./house-style-template');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
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

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body',
          message: parseError.message,
        }),
      };
    }
    const { subject, preheader, promptText, attachments = [], styleReference } = body;

    // Validate required fields
    if (!promptText || promptText.trim().length < 20) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Prompt text is required and must be at least 20 characters',
        }),
      };
    }

    // Validate attachments have titles
    const untitledImages = attachments.filter(a => !a.title || a.title.trim() === '');
    if (untitledImages.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'All image attachments must have titles',
          untitledCount: untitledImages.length,
        }),
      };
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'AI generation service not configured',
        }),
      };
    }

    // Get house style template
    const houseTemplate = getHouseStyleTemplate();
    
    // Prepare image data for OpenAI (convert base64 to URLs or keep as base64)
    // For now, we'll include image titles and let GPT reference them
    const imageReferences = attachments.map(att => ({
      title: att.title,
      placementHint: att.placementHint || 'inline',
      mimeType: att.mimeType,
      // Include a small base64 thumbnail for context (first 1000 chars)
      thumbnail: att.dataUrl ? att.dataUrl.substring(0, 1000) + '...' : null,
    }));

    // Build the AI prompt
    const systemPrompt = `You are generating an email newsletter HTML for Noteworthy News. Your task is to create professional, fact-checked journalism content in the exact house style.

CRITICAL REQUIREMENTS:
1. Preserve the exact HTML structure and styling from the house style template provided
2. Use ONLY the colors, fonts, spacing, and layout patterns from the style guide
3. Return ONLY valid HTML - no markdown, no explanations, no code blocks
4. Use table-based layout with inline styles (email-client safe)
5. Max width: 650px
6. Images must be inserted where referenced by title tokens like [[Image: Title]]
7. Use alt text = image title
8. Do not invent subscriber-specific personalization beyond "Hey {{FULL_NAME}},"
9. Maintain dark theme: background #0b1020, card #141b2b, header #050814
10. Use section labels: 11px, uppercase, letter-spacing 0.14em, color #3b82f6
11. Body text: 15px, line-height 1.6, color #f9fafb
12. Bullet lists: use ★ star bullets with flex layout
13. Images: width 100%, border-radius 8px, proper margins

STYLE GUIDE:
- Background colors: #0b1020 (outer), #141b2b (content card), #050814 (header/footer)
- Text colors: #f9fafb (primary), #9ca3af (secondary), #3b82f6 (accent)
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
- Section spacing: 50px between major sections
- Paragraph spacing: 20px
- Image style: display:block;width:100%;max-width:100%;border-radius:8px;margin:10px 0

CONTENT REQUIREMENTS:
- Write in a professional, journalistic tone
- Use clear section labels (BREAKING, UPDATE, Snapshot, etc.)
- Include proper context and attribution
- Maintain factual accuracy
- Use bullet points for lists (★ format)
- Include "What we're watching next" or similar forward-looking sections when appropriate

IMAGES:
${imageReferences.map(img => `- [[Image: ${img.title}]] (${img.placementHint})`).join('\n')}

When you see [[Image: Title]], insert an <img> tag with:
- src: Use a placeholder URL like "https://noteworthynews.co/placeholder-${img.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg"
- alt: The image title
- style: "${STYLE_GUIDE.imageStyle};margin:${STYLE_GUIDE.imageMargin}"

IMPORTANT: Your response must start with:
1. A date paragraph: <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">[Current Date]</p>
2. A greeting: <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
3. Then the newsletter content

Return ONLY the HTML content that goes inside the <td style="padding:50px 40px;background-color:#141b2b!important"> tag. Do not include the outer structure.`;

    const userPrompt = `Generate newsletter content based on this prompt:

${promptText}

Subject: ${subject || 'Weekly Newsletter'}
${preheader ? `Preheader: ${preheader}` : ''}

${attachments.length > 0 ? `\nImages to include:\n${attachments.map(a => `- ${a.title}${a.placementHint ? ` (${a.placementHint})` : ''}`).join('\n')}` : ''}

Reference the house style template structure and fill in the content section with the newsletter content. Use the exact styling patterns from the template.`;

    // Call OpenAI API using fetch (available in Node 18+)
    console.log('[Generate Newsletter] Calling OpenAI with prompt length:', promptText.length);
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use latest model for best HTML generation
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[Generate Newsletter] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText}`);
    }

    let completion;
    try {
      completion = await openaiResponse.json();
    } catch (jsonError) {
      console.error('[Generate Newsletter] Failed to parse OpenAI response as JSON');
      throw new Error('Invalid response format from OpenAI API');
    }
    
    const generatedContent = completion?.choices?.[0]?.message?.content || '';
    
    if (!generatedContent || generatedContent.trim() === '') {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'AI generation returned empty content',
        }),
      };
    }

    // Extract HTML from response (remove markdown code blocks if present)
    let htmlContent = generatedContent.trim();
    
    // Remove markdown code blocks if present
    if (htmlContent.startsWith('```html')) {
      htmlContent = htmlContent.replace(/^```html\s*/, '').replace(/\s*```$/, '');
    } else if (htmlContent.startsWith('```')) {
      htmlContent = htmlContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Replace image placeholders with actual image data URLs
    // For now, we'll keep placeholders and let the frontend handle image uploads
    // But we can replace [[Image: Title]] with proper img tags
    attachments.forEach(att => {
      if (!att.title || !att.dataUrl) {
        console.warn('[Generate Newsletter] Skipping attachment with missing title or dataUrl:', att);
        return;
      }
      const imageToken = `[[Image: ${att.title}]]`;
      const safeTitle = (att.title || '').replace(/"/g, '&quot;');
      const imageTag = `<img src="${att.dataUrl}" alt="${safeTitle}" style="${STYLE_GUIDE.imageStyle};margin:${STYLE_GUIDE.imageMargin}" />`;
      htmlContent = htmlContent.replace(new RegExp(imageToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imageTag);
    });

    // Insert generated content into house template
    // The AI should generate content that includes date and greeting
    // If it doesn't, we'll add them
    const datePlaceholder = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Ensure the generated content includes date and greeting if missing
    let finalContent = htmlContent.trim();
    
    // Check if date is already present (check for date placeholder or actual date text)
    const dateCheck = datePlaceholder && datePlaceholder.length >= 10 
                      ? datePlaceholder.toLowerCase().substring(0, 10) 
                      : '';
    const hasDate = finalContent.includes('{{DATE_PLACEHOLDER}}') || 
                    (dateCheck && finalContent.toLowerCase().includes(dateCheck)) ||
                    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday).*\d{4}/i.test(finalContent);
    
    if (!hasDate) {
      // Add date and greeting if missing
      finalContent = `<p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">${datePlaceholder}</p>\n<p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>\n${finalContent}`;
    } else {
      // Replace date placeholder if present
      finalContent = finalContent.replace(/\{\{DATE_PLACEHOLDER\}\}/g, datePlaceholder);
    }
    
    // Verify template has placeholder before replacing
    if (!houseTemplate.includes('<!-- CONTENT_PLACEHOLDER -->')) {
      console.error('[Generate Newsletter] Template missing CONTENT_PLACEHOLDER!');
      throw new Error('Template structure error: CONTENT_PLACEHOLDER not found');
    }
    
    const fullHtml = houseTemplate.replace('<!-- CONTENT_PLACEHOLDER -->', finalContent);

    // Validate HTML structure
    const warnings = [];
    if (!fullHtml.includes('<table role="presentation"')) {
      warnings.push('Missing table structure - may not render correctly in email clients');
    }
    if (fullHtml.length > 200000) {
      warnings.push('HTML is very large - may cause email client issues');
    }

    // Extract sections for metadata (use finalContent to include date/greeting if added)
    const sections = [];
    const sectionMatches = finalContent.match(/<p[^>]*style="[^"]*font-size:11px[^"]*letter-spacing:0\.14em[^"]*"[^>]*>([^<]+)<\/p>/g);
    if (sectionMatches) {
      sections.push(...sectionMatches.map(m => {
        const textMatch = m.match(/>([^<]+)</);
        return textMatch ? textMatch[1].trim() : '';
      }).filter(Boolean));
    }

    // Final validation - ensure we have valid HTML
    if (!fullHtml || fullHtml.trim().length === 0) {
      console.error('[Generate Newsletter] Generated HTML is empty after template insertion');
      throw new Error('Generated HTML is empty');
    }

    console.log('[Generate Newsletter] Successfully generated HTML, length:', fullHtml.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        html: fullHtml,
        warnings,
        sections,
        generatedAt: new Date().toISOString(),
      }),
    };

  } catch (error) {
    console.error('[Generate Newsletter] Error:', error);
    console.error('[Generate Newsletter] Stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate newsletter HTML',
        message: error.message,
        details: process.env.NETLIFY_DEV ? error.stack : undefined,
      }),
    };
  }
};
