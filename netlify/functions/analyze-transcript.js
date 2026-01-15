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

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { lecture_transcript } = body;

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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Use GPT-4o for high-quality educational analysis
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Analyze this AP European History lecture transcript:\n\n${lecture_transcript}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000, // Allow for comprehensive analysis
    });

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
