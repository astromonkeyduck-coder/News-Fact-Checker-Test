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
    const { subject, preheader, promptText, attachments: rawAttachments, styleReference } = body;
    
    // Ensure attachments is always an array
    const attachments = Array.isArray(rawAttachments) ? rawAttachments : (rawAttachments ? [rawAttachments] : []);

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

    // Validate attachments have titles (not empty and not default "Untitled Image X")
    // Only validate if there are attachments
    if (attachments.length > 0) {
      const untitledImages = attachments.filter(a => {
        const title = (a.title || '').trim();
        return !title || title === '' || /^untitled\s+image\s+\d+$/i.test(title);
      });
      if (untitledImages.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'All image attachments must have descriptive titles (not "Untitled Image X")',
            untitledCount: untitledImages.length,
          }),
        };
      }
      
      // Validate attachments have dataUrls
      const imagesWithoutData = attachments.filter(a => !a.dataUrl || !a.dataUrl.startsWith('data:'));
      if (imagesWithoutData.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'All image attachments must have valid image data',
            invalidCount: imagesWithoutData.length,
          }),
        };
      }
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
    let houseTemplate;
    try {
      houseTemplate = getHouseStyleTemplate();
      if (!houseTemplate || typeof houseTemplate !== 'string') {
        throw new Error('House style template is invalid or empty');
      }
    } catch (templateError) {
      console.error('[Generate Newsletter] Failed to load house style template:', templateError);
      throw new Error(`Failed to load template: ${templateError.message}`);
    }
    
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
    const systemPrompt = `You are generating an email newsletter HTML for Noteworthy News. This is a CRITICAL PRODUCTION SYSTEM serving real subscribers. Style fidelity is NON-NEGOTIABLE. Content quality is NON-NEGOTIABLE. You MUST write about REAL, ACTUAL breaking news events - not generic scenarios, not hypotheticals, not examples.

⚠️ WARNING: Any deviation from the style guide or use of generic/fictional content will result in rejection. This is production content for a real news organization.

═══════════════════════════════════════════════════════════════
CRITICAL STYLE REQUIREMENTS (MUST FOLLOW EXACTLY):
═══════════════════════════════════════════════════════════════
1. PRESERVE EXACT HTML STRUCTURE - Use the house style template structure provided. DO NOT modify table structure, cell padding, or layout.
2. USE ONLY THESE COLORS - No exceptions:
   - Background: #0b1020 (outer), #141b2b (content card), #050814 (header/footer)
   - Text: #f9fafb (primary), #9ca3af (secondary dates), #3b82f6 (accent/section labels)
   - Links: #60a5fa
3. TYPOGRAPHY - Exact sizes and styles:
   - Section labels: 11px, uppercase, letter-spacing 0.14em, color #3b82f6, font-weight 600
   - Body text: 15px, line-height 1.6, color #f9fafb
   - Date: 14px, color #9ca3af, margin: 0 0 30px 0
   - Greeting: 16px, line-height 1.5, color #f9fafb, margin: 0 0 30px 0
4. SPACING - Exact measurements:
   - 50px between major sections
   - 20px between paragraphs
   - 30px margin on date and greeting paragraphs
   - 12px margin on section label paragraphs
5. BULLET LISTS - Use this EXACT structure:
   <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
     <li style="margin:6px 0;display:flex;align-items:flex-start">
       <span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span>
       <span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">[text]</span>
     </li>
   </ul>
6. IMAGES - Exact style:
   style="display:block;width:100%;max-width:100%;border-radius:8px;margin:10px 0"
7. RETURN ONLY VALID HTML - No markdown, no explanations, no code blocks, no backticks
8. TABLE-BASED LAYOUT - All content must use table structure with inline styles (email-client safe)

═══════════════════════════════════════════════════════════════
CONTENT QUALITY REQUIREMENTS (CRITICAL - ZERO TOLERANCE):
═══════════════════════════════════════════════════════════════
1. REAL BREAKING NEWS ONLY - MANDATORY:
   ✅ You MUST write about ACTUAL, SPECIFIC breaking news events that have occurred
   ✅ Use your knowledge to reference REAL events with REAL details
   ✅ Include REAL names, REAL locations, REAL dates, REAL sources
   ❌ DO NOT write generic scenarios like "a shooting happened somewhere"
   ❌ DO NOT write hypothetical content like "imagine if..."
   ❌ DO NOT write example content or placeholder text
   ❌ DO NOT make up events that didn't happen
   
   EXAMPLES OF WHAT TO WRITE:
   ✅ "President Trump delivered a live statement blaming the Washington, D.C. shooting on the Biden administration's security failures..."
   ✅ "Governor Morrisey announced earlier today that both Guardsmen have reportedly died..."
   ✅ "Authorities have identified the suspect as Rahmanullah Lakanwal, a 29-year-old Afghan national..."
   
   EXAMPLES OF WHAT NOT TO WRITE:
   ❌ "A shooting occurred in a major city..."
   ❌ "Officials are investigating an incident..."
   ❌ "Breaking news: Something important happened..."

2. FACTUAL ACCURACY - MANDATORY:
   - All information must be factually correct based on your training data
   - Include proper attribution and sources (e.g., "@AP", "— WTAE4", "according to officials")
   - If you're unsure about a detail, either omit it or clearly state uncertainty
   - Never fabricate quotes, names, or details

3. JOURNALISTIC TONE - MANDATORY:
   - Professional, clear, objective
   - Avoid sensationalism, speculation, or opinion
   - Use active voice and specific verbs
   - Write with authority but remain factual

4. SECTION STRUCTURE - MANDATORY:
   - BREAKING: For urgent, developing stories (use sparingly, only for truly breaking news)
   - UPDATE: For follow-ups to breaking news
   - Snapshot: For summary sections with bullet points (use exact format specified)
   - [Topic]: For specific subject sections (e.g., "Governor's statement", "Scene documentation", "Suspect & emerging details")
   - "What we're watching next": Forward-looking section with specific, actionable items

5. CONTEXT & ATTRIBUTION - MANDATORY FOR EVERY CLAIM:
   - Who: Specific names, titles, organizations
   - What: Specific actions, statements, events
   - When: Specific times, dates, or relative timeframes
   - Where: Specific locations (cities, states, countries)
   - Why: Context and background when relevant
   - Source: Attribution for all claims (e.g., "@AP", "— WTAE4", "according to officials")

6. FORWARD-LOOKING SECTIONS - MANDATORY:
   - Include "What we're watching next" with SPECIFIC, ACTIONABLE items
   - Each item should be concrete and verifiable
   - Use format: <strong>Topic:</strong> Specific detail about what to watch
   - NO generic items like "We'll continue to monitor the situation"

7. NO FILLER CONTENT - ZERO TOLERANCE:
   - Every paragraph must add value
   - No fluff, no generic statements, no padding
   - If you can't write about real events, don't write at all

═══════════════════════════════════════════════════════════════
STYLE VIOLATIONS (DO NOT DO):
═══════════════════════════════════════════════════════════════
❌ DO NOT use different colors than specified
❌ DO NOT use different font sizes than specified
❌ DO NOT use different spacing than specified
❌ DO NOT use markdown formatting
❌ DO NOT write generic or hypothetical content
❌ DO NOT skip section labels when appropriate
❌ DO NOT use incorrect HTML structure
❌ DO NOT add extra styling beyond what's specified
❌ DO NOT write about events that didn't happen
❌ DO NOT use placeholder or vague content

IMAGES:
${imageReferences.length > 0 ? imageReferences.map(img => `- [[Image: ${img.title}]] (${img.placementHint})`).join('\n') : 'No images provided.'}

${imageReferences.length > 0 ? `IMPORTANT: When you see [[Image: Title]] in the prompt, you MUST use the EXACT token format [[Image: Title]] in your HTML output. DO NOT replace it with a placeholder URL. The system will automatically replace [[Image: Title]] tokens with the actual uploaded image.` : ''}

═══════════════════════════════════════════════════════════════
REQUIRED OUTPUT FORMAT:
═══════════════════════════════════════════════════════════════
Your response MUST start with these EXACT elements in this order:

1. DATE (REQUIRED - Use current date, not a placeholder):
   <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">[Current Date - format: "Weekday, Month Day, Year"]</p>

2. GREETING (REQUIRED):
   <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>

3. OPENING CONTEXT (Optional but recommended):
   A brief 1-2 sentence introduction to the newsletter's main story

4. CONTENT SECTIONS:
   - Use appropriate section labels (BREAKING, UPDATE, Snapshot, etc.)
   - Include real, specific breaking news events
   - Add proper attribution and context
   - Use bullet lists for summaries (exact format specified above)

5. FORWARD-LOOKING SECTION (Recommended):
   "What we're watching next" with specific, actionable items

6. CLOSING (Recommended):
   Thank you message and sign-off

═══════════════════════════════════════════════════════════════
FINAL INSTRUCTIONS:
═══════════════════════════════════════════════════════════════
- Return ONLY the HTML content that goes inside: <td style="padding:50px 40px;background-color:#141b2b!important">
- Do NOT include the outer table structure
- Do NOT include DOCTYPE, html, head, or body tags
- Do NOT use markdown or code blocks
- Write about REAL, ACTUAL breaking news events
- Match the gold standard style EXACTLY
- Quality is non-negotiable - this is production content`;

    const userPrompt = `⚠️ CRITICAL: Generate newsletter content based on this prompt. This is PRODUCTION CONTENT for REAL SUBSCRIBERS.

⚠️ MANDATORY REQUIREMENTS:
1. You MUST write about REAL, ACTUAL breaking news events that have occurred
2. You MUST use specific details: real names, real locations, real dates, real sources
3. You MUST match the gold standard style EXACTLY (see style guide above)
4. You MUST include proper attribution for all claims
5. You MUST write with journalistic authority and factual accuracy

❌ FORBIDDEN:
- Generic scenarios ("a shooting happened somewhere")
- Hypothetical content ("imagine if...")
- Placeholder text ("officials said something")
- Made-up events or details
- Style deviations (wrong colors, sizes, spacing)
- Missing attribution

USER PROMPT:
${promptText}

⚠️ FINAL REMINDER:
- This is PRODUCTION CONTENT - quality is non-negotiable
- Write about REAL events with REAL details
- Match the style guide EXACTLY - zero tolerance for deviations
- Every claim must have attribution
- Every paragraph must add value
- This newsletter will be sent to real subscribers - make it perfect

Subject: ${subject || 'Weekly Newsletter'}
${preheader ? `Preheader: ${preheader}` : ''}

${attachments.length > 0 ? `\nImages to include:\n${attachments.map(a => `- ${a.title}${a.placementHint ? ` (${a.placementHint})` : ''}`).join('\n')}` : ''}

Reference the house style template structure and fill in the content section with the newsletter content. Use the exact styling patterns from the template.`;

    // Call OpenAI API using fetch (available in Node 18+)
    console.log('[Generate Newsletter] Calling OpenAI with prompt length:', promptText.length);
    console.log('[Generate Newsletter] Attachments count:', attachments.length);
    console.log('[Generate Newsletter] System prompt length:', systemPrompt.length);
    console.log('[Generate Newsletter] User prompt length:', userPrompt.length);
    
    let openaiResponse;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
    } catch (fetchError) {
      console.error('[Generate Newsletter] Fetch error:', fetchError);
      throw new Error(`Network error calling OpenAI API: ${fetchError.message}`);
    }

    if (!openaiResponse.ok) {
      let errorText = '';
      try {
        errorText = await openaiResponse.text();
        console.error('[Generate Newsletter] OpenAI API error response:', {
          status: openaiResponse.status,
          statusText: openaiResponse.statusText,
          body: errorText.substring(0, 500)
        });
      } catch (textError) {
        console.error('[Generate Newsletter] Failed to read error response:', textError);
      }
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${errorText || openaiResponse.statusText}`);
    }

    let completion;
    try {
      completion = await openaiResponse.json();
      console.log('[Generate Newsletter] OpenAI response received, choices:', completion?.choices?.length || 0);
    } catch (jsonError) {
      console.error('[Generate Newsletter] Failed to parse OpenAI response as JSON:', jsonError);
      throw new Error(`Invalid response format from OpenAI API: ${jsonError.message}`);
    }
    
    const generatedContent = completion?.choices?.[0]?.message?.content || '';
    console.log('[Generate Newsletter] Generated content length:', generatedContent.length);
    
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
    attachments.forEach(att => {
      if (!att.title || !att.dataUrl) {
        console.warn('[Generate Newsletter] Skipping attachment with missing title or dataUrl:', att);
        return;
      }
      const imageToken = `[[Image: ${att.title}]]`;
      const safeTitle = (att.title || '').replace(/"/g, '&quot;');
      const imageTag = `<img src="${att.dataUrl}" alt="${safeTitle}" style="${STYLE_GUIDE.imageStyle};margin:${STYLE_GUIDE.imageMargin}" />`;
      
      // Replace token format [[Image: Title]]
      htmlContent = htmlContent.replace(new RegExp(imageToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imageTag);
      
      // Also replace any placeholder URLs the AI might have generated (fallback)
      const titleSlug = att.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const placeholderPattern = new RegExp(`https://noteworthynews\\.co/placeholder-${titleSlug}\\.jpg`, 'gi');
      if (placeholderPattern.test(htmlContent)) {
        htmlContent = htmlContent.replace(placeholderPattern, att.dataUrl);
        console.log('[Generate Newsletter] Replaced placeholder URL with data URL for:', att.title);
      }
    });

    // Insert generated content into house template
    // The AI generates content that includes date and greeting - we trust it to do so correctly
    let finalContent = htmlContent.trim();
    
    // Always use current date - replace any date patterns or placeholders
    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Replace date placeholder if it exists
    finalContent = finalContent.replace(/\{\{DATE_PLACEHOLDER\}\}/g, currentDate);
    
    // Replace ANY date patterns in the AI-generated content with current date
    // Match various formats:
    // - "Wednesday, November 26, 2025" (with weekday)
    // - "October 24, 2023" (without weekday)
    // - "Nov 26, 2025" (abbreviated month)
    // - "10/24/2023" (numeric)
    // - Any year that's not the current year
    const currentYear = new Date().getFullYear().toString();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Pattern 1: Full date with weekday "Wednesday, November 26, 2025"
    const pattern1 = new RegExp(`(${weekdays.join('|')}),\\s*(${months.join('|')})\\s+\\d{1,2},\\s*\\d{4}`, 'gi');
    finalContent = finalContent.replace(pattern1, currentDate);
    
    // Pattern 2: Full date without weekday "October 24, 2023"
    const pattern2 = new RegExp(`(${months.join('|')})\\s+\\d{1,2},\\s*\\d{4}`, 'gi');
    finalContent = finalContent.replace(pattern2, currentDate);
    
    // Pattern 3: Abbreviated month "Oct 24, 2023" or "Nov 26, 2025"
    const pattern3 = new RegExp(`(${monthAbbr.join('|')})\\.?\\s+\\d{1,2},\\s*\\d{4}`, 'gi');
    finalContent = finalContent.replace(pattern3, currentDate);
    
    // Pattern 4: Any date with wrong year (not current year) - more aggressive
    const wrongYearPattern = new RegExp(`(${months.join('|')}|${monthAbbr.join('|')})\\.?\\s+\\d{1,2},\\s*(?!${currentYear})\\d{4}`, 'gi');
    if (wrongYearPattern.test(finalContent)) {
      finalContent = finalContent.replace(wrongYearPattern, currentDate);
      console.log('[Generate Newsletter] Replaced date with wrong year with current date:', currentDate);
    }
    
    console.log('[Generate Newsletter] Final date replacement complete. Current date:', currentDate);
    
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
    console.error('[Generate Newsletter] ========== ERROR CAUGHT ==========');
    console.error('[Generate Newsletter] Error type:', typeof error);
    console.error('[Generate Newsletter] Error:', error);
    console.error('[Generate Newsletter] Error name:', error.name);
    console.error('[Generate Newsletter] Error message:', error.message);
    console.error('[Generate Newsletter] Error stack:', error.stack);
    console.error('[Generate Newsletter] Error toString:', error.toString());
    console.error('[Generate Newsletter] ===================================');
    
    // Always provide detailed error information
    const errorDetails = {
      error: 'Failed to generate newsletter HTML',
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
    };
    
    // Always include the error message
    if (error.message) {
      errorDetails.message = error.message;
      errorDetails.error = error.message; // Also set as main error field
    }
    
    // Include additional context
    if (error.cause) {
      errorDetails.cause = error.cause.toString();
    }
    
    // Include stack trace in dev mode or if explicitly requested
    const isDev = process.env.NETLIFY_DEV || process.env.DEBUG;
    if (isDev) {
      errorDetails.details = error.stack;
      errorDetails.fullError = error.toString();
      errorDetails.stack = error.stack;
    } else {
      // In production, still include error message as details
      errorDetails.details = error.message || 'No additional details available';
    }
    
    console.error('[Generate Newsletter] Returning error response:', JSON.stringify(errorDetails, null, 2));
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorDetails),
    };
  }
};
