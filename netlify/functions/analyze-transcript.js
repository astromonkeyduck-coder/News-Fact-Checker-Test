/**
 * Netlify Function: Analyze Transcript (Clemens Converter - AP Euro AI Teacher)
 * 
 * Analyzes transcribed AP European History lectures using AI to provide
 * comprehensive educational content aligned with AP exam requirements.
 * 
 * Security: Requires CLEMS_TOKEN if configured.
 */

const OpenAI = require("openai");

/**
 * Check if token authentication is required and valid
 */
function checkToken(event) {
  const requiredToken = process.env.CLEMS_TOKEN;
  if (!requiredToken) {
    return true;
  }

  const headerToken = event.headers["x-clems-token"] || event.headers["X-Clems-Token"];
  if (headerToken === requiredToken) {
    return true;
  }

  const body = event.body ? JSON.parse(event.body) : {};
  if (body.token === requiredToken) {
    return true;
  }

  return false;
}

/**
 * AP Euro AI Teacher System Prompt
 */
const SYSTEM_PROMPT = `ROLE

You are an AP European History expert historian, curriculum specialist, and exam strategist.

You are embedded inside an educational site.
Your job triggers automatically whenever a user submits a transcribed AP Euro lecture.

TRUSTED REFERENCE DOCUMENTS (ALWAYS USE)

You must treat the following as authoritative background sources for verification, expansion, and exam alignment:

Viault – Modern European History

Key Works of European History

AP European History Review Packet (College Board aligned)

Use these to:

Verify facts, dates, and definitions

Supply missing historical context

Align explanations with AP Euro skills and themes

Model DBQ/LEQ expectations

Do not quote long passages.
Use them to guide accuracy and structure.

CORE OBJECTIVE

Convert the transcript into a complete AP Euro mastery output that:

Corrects vague or incorrect lecture content

Adds historical depth and cause–effect clarity

Explicitly aligns with AP Euro themes and essay rubrics

Prepares students for DBQs, SAQs, and LEQs

Accuracy > completeness > style.

Light humor is allowed only when it improves clarity.

REQUIRED OUTPUT PIPELINE

YOU MUST FOLLOW THIS ORDER EXACTLY

1️⃣ Topic Identification

AP Euro unit

Time period covered (with justification)

Where this topic fits in European history

30-second plain-English overview

2️⃣ High-Yield Timeline

Chronological events

Key dates + significance

Mark DBQ/LEQ favorites ⭐

3️⃣ Key Actors, Ideas, and Movements

For each:

Who / what

Goals or beliefs

Methods

Short- and long-term impact

Why College Board tests it

4️⃣ Core Vocabulary & Concepts

Definition

Significance

Common misconceptions

5️⃣ Cause → Effect Chains

Minimum 3

Clear, exam-ready logic

Include long-term consequences

6️⃣ AP Euro Thematic Connections

Explicitly connect to:

State power and authority

Religion and belief

Economic systems and class

Intellectual movements

Social hierarchy and gender

Continuity and change over time

7️⃣ Lecture Correction & Expansion

Flag unclear, incomplete, or misleading points

Correct them using reference documents

Add assumed background knowledge

8️⃣ "Smart but Tired" Explanation

Clear narrative

Simple but accurate language

2–3 modern analogies max

Minimal, intelligent humor

✍️ EXAM PREP MODE (MANDATORY)
DBQ Preparation

Contextualization paragraph

3 realistic DBQ prompts

Thesis templates

6+ pieces of outside evidence

Sourcing strategies (POV, purpose, audience, context)

5+ complexity moves

SAQ Practice

2 AP-style SAQs

Bullet-point answer keys

LEQ Practice

2 LEQ prompts

Structured outlines with complexity

Mastery Check

10 review questions

5 common misconceptions

3-day study plan (30–45 min/day)

OUTPUT FORMAT

Structured educational content in clear sections using headings and bullet points.
No markdown tables.
No emojis.
No references to being an AI.

FAILURE CONDITIONS

Do NOT summarize without analysis

Do NOT invent facts

Do NOT ignore AP exam skills

Do NOT skip DBQ/LEQ prep

SUCCESS CONDITION

A student using this output could:

Explain the topic confidently

Write a strong thesis immediately

Score highly on DBQs, SAQs, and LEQs`;

// Note: Background functions are configured in netlify.toml
// However, for now we'll keep it as a regular function with increased timeout
// If it consistently times out, we can convert to a true background function with job polling

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Clems-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Check token if configured
    if (!checkToken(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized: Invalid or missing token" }),
      };
    }

    // Handle FormData (multipart/form-data) or JSON
    let lecture_transcript;
    let contextFiles = [];
    
    // Single JSON parsing attempt with proper error handling
    // The previous code had duplicate parsing logic that would fail the same way
    try {
      const body = JSON.parse(event.body || "{}");
      lecture_transcript = body.lecture_transcript;
      
      // Extract context files if provided
      if (body.context_files && Array.isArray(body.context_files)) {
        contextFiles = body.context_files;
      }
    } catch (parseError) {
      // JSON parsing failed - return error response
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Invalid request body: unable to parse JSON',
          details: parseError.message
        }),
      };
    }

    if (!lecture_transcript || typeof lecture_transcript !== 'string' || lecture_transcript.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing or invalid lecture_transcript parameter" }),
      };
    }

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('[analyze-transcript] OpenAI API key not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "AI analysis service not configured" }),
      };
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    console.log(`[analyze-transcript] Analyzing transcript (${lecture_transcript.length} characters)`);
    
    // Process context files: decode base64 and extract text content
    let contextTexts = [];
    if (contextFiles.length > 0) {
      console.log(`[analyze-transcript] Processing ${contextFiles.length} context file(s)`);
      
      for (const file of contextFiles) {
        try {
          if (!file.data || !file.type) {
            console.warn(`[analyze-transcript] Skipping file ${file.name || 'unknown'}: missing data or type`);
            continue;
          }
          
          // Decode base64 data
          const fileBuffer = Buffer.from(file.data, 'base64');
          const fileType = file.type.toLowerCase();
          const fileName = file.name || 'unknown';
          
          // Extract text based on file type
          if (fileType.includes('text/') || 
              fileName.endsWith('.txt') || 
              fileName.endsWith('.md') || 
              fileName.endsWith('.json') ||
              fileName.endsWith('.csv')) {
            // Text-based files: decode as UTF-8
            const textContent = fileBuffer.toString('utf-8');
            contextTexts.push({
              name: fileName,
              type: fileType,
              content: textContent
            });
            console.log(`[analyze-transcript] Extracted text from ${fileName} (${textContent.length} characters)`);
          } else if (fileType.includes('application/pdf') || fileName.endsWith('.pdf')) {
            // PDF files: For now, we'll note that PDF content extraction requires additional libraries
            // In a production environment, you would use a library like pdf-parse or pdfjs-dist
            // For now, we'll include a note that the PDF was provided but content extraction is not yet implemented
            console.warn(`[analyze-transcript] PDF file ${fileName} provided but text extraction not yet implemented. Consider converting to text first.`);
            contextTexts.push({
              name: fileName,
              type: 'application/pdf',
              content: `[PDF file "${fileName}" was provided but text extraction is not yet implemented. The file contains ${file.size || 'unknown'} bytes. Please note that the actual PDF content is not included in this analysis.]`
            });
          } else {
            // Other file types: try to decode as text, but log a warning
            console.warn(`[analyze-transcript] Unsupported file type ${fileType} for ${fileName}, attempting text extraction`);
            try {
              const textContent = fileBuffer.toString('utf-8');
              contextTexts.push({
                name: fileName,
                type: fileType,
                content: textContent
              });
            } catch (err) {
              console.error(`[analyze-transcript] Failed to extract text from ${fileName}:`, err.message);
            }
          }
        } catch (error) {
          console.error(`[analyze-transcript] Error processing context file ${file.name || 'unknown'}:`, error.message);
        }
      }
      
      console.log(`[analyze-transcript] Successfully processed ${contextTexts.length} context file(s) out of ${contextFiles.length}`);
    }

    // Limit context file content size to prevent timeout
    // Truncate very large context files to keep total content manageable
    const MAX_CONTEXT_LENGTH = 50000; // ~50k characters per file
    if (contextTexts.length > 0) {
      contextTexts = contextTexts.map(file => {
        if (file.content.length > MAX_CONTEXT_LENGTH) {
          console.warn(`[analyze-transcript] Truncating large context file ${file.name} from ${file.content.length} to ${MAX_CONTEXT_LENGTH} characters`);
          return {
            ...file,
            content: file.content.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[... content truncated due to size ...]'
          };
        }
        return file;
      });
    }

    // Build user message with actual context file content
    let userContent = `Analyze this AP European History lecture transcript:\n\n${lecture_transcript}`;
    
    if (contextTexts.length > 0) {
      userContent += `\n\n=== REFERENCE DOCUMENTS PROVIDED ===\n\n`;
      userContent += `The user has provided ${contextTexts.length} reference document(s) to help with analysis. Use these documents to verify facts, provide historical context, and align with AP Euro curriculum standards.\n\n`;
      
      for (const contextFile of contextTexts) {
        userContent += `--- Document: ${contextFile.name} (${contextFile.type}) ---\n`;
        userContent += `${contextFile.content}\n\n`;
      }
      
      userContent += `=== END OF REFERENCE DOCUMENTS ===\n\n`;
      userContent += `When analyzing the transcript above, cross-reference it with the reference documents provided. Use the documents to:\n`;
      userContent += `- Verify facts, dates, and definitions mentioned in the transcript\n`;
      userContent += `- Supply missing historical context\n`;
      userContent += `- Align explanations with AP Euro skills and themes\n`;
      userContent += `- Correct any inaccuracies in the transcript using the reference documents as authoritative sources\n`;
    }

    // Call OpenAI API with timeout protection
    // Use a timeout to ensure we respond before Netlify's function timeout
    const openaiTimeout = 20000; // 20 seconds max for OpenAI call (leaves 6 seconds for processing)
    
    const completionPromise = openai.chat.completions.create({
      model: 'gpt-4o', // Use GPT-4o for high-quality educational analysis
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000, // Allow for comprehensive analysis
    });
    
    // Add timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI API call timed out after 20 seconds')), openaiTimeout);
    });
    
    const completion = await Promise.race([completionPromise, timeoutPromise]);

    const analysis = completion.choices[0]?.message?.content || 'No analysis generated';
    const usage = completion.usage;

    console.log(`[analyze-transcript] ✅ Analysis complete (tokens: ${usage?.total_tokens || 'unknown'})`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        usage: usage,
      }),
    };
  } catch (error) {
    console.error("[analyze-transcript] Error:", error.message);
    console.error("[analyze-transcript] Stack:", error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to analyze transcript",
        message: error.message,
      }),
    };
  }
};
