/**
 * Submit Fact-Check API
 * POST /.netlify/functions/submit-fact-check
 * Allows users to submit claims for fact-checking
 */

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { claim, source, context, category, email } = body;

    // Validate required fields
    if (!claim || claim.trim().length < 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: "Claim must be at least 10 characters",
          success: false 
        }),
      };
    }

    // Initialize store
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Storage not configured",
          success: false 
        }),
      };
    }

    const store = getStore({
      name: "fact-check-submissions",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Create submission
    const submission = {
      id: `submission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      claim: claim.trim(),
      source: source?.trim() || null,
      context: context?.trim() || null,
      category: category || 'other',
      email: email?.trim() || null,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
    };

    // Save submission
    const submissionKey = `submission-${submission.id}`;
    await store.setJSON(submissionKey, submission);

    // Add to queue
    const queueKey = 'submissions-queue';
    let queue = [];
    try {
      const existing = await store.get(queueKey, { type: "json" });
      queue = existing || [];
    } catch (e) {
      queue = [];
    }
    
    queue.unshift(submission.id);
    await store.setJSON(queueKey, queue);

    // TODO: Send email notification to admin
    // TODO: Send confirmation email to user (if email provided)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        submissionId: submission.id,
        message: "Submission received. Our team will review it."
      }),
    };
  } catch (error) {
    console.error("Error submitting fact-check:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to submit. Please try again.",
        success: false
      }),
    };
  }
};

