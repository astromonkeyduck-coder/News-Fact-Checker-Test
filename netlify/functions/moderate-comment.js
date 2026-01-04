/**
 * AI Content Moderation for Comments
 * Uses OpenAI to check for inappropriate content, profanity, slurs, and harmful language
 */

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { text, author } = JSON.parse(event.body || "{}");

    if (!text) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Text is required" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[moderate-comment] OPENAI_API_KEY not configured, skipping AI moderation');
      // If no API key, do basic profanity check only
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          approved: checkBasicProfanity(text),
          reason: 'AI moderation unavailable, using basic filter'
        }),
      };
    }

    // Call OpenAI for content moderation
    const moderationResponse = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text + (author ? ` Author: ${author}` : ''),
        // model parameter is optional - API uses latest by default
      }),
    });

    if (!moderationResponse.ok) {
      const errorText = await moderationResponse.text();
      console.error('[moderate-comment] OpenAI moderation API error:', errorText);
      // Fallback to basic profanity check
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          approved: checkBasicProfanity(text),
          reason: 'AI moderation failed, using basic filter'
        }),
      };
    }

    const moderationData = await moderationResponse.json();
    const result = moderationData.results?.[0];

    if (!result) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          approved: checkBasicProfanity(text),
          reason: 'No moderation result, using basic filter'
        }),
      };
    }

    // Check if content is flagged
    const isFlagged = result.flagged;
    const categories = result.categories || {};
    const categoryScores = result.category_scores || {};

    // Get reasons for flagging
    const flaggedCategories = Object.keys(categories).filter(cat => categories[cat]);
    const reasons = flaggedCategories.length > 0 
      ? flaggedCategories.map(cat => `${cat} (${(categoryScores[cat] * 100).toFixed(1)}%)`).join(', ')
      : null;

    // Also do basic profanity check as backup
    const basicCheck = checkBasicProfanity(text);
    
    // Content is approved if: not flagged by AI AND passes basic check
    const approved = !isFlagged && basicCheck;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        approved: approved,
        flagged: isFlagged,
        categories: flaggedCategories,
        reasons: reasons,
        scores: categoryScores
      }),
    };

  } catch (error) {
    console.error('[moderate-comment] Error:', error);
    // Fallback to basic profanity check on error
    try {
      const { text } = JSON.parse(event.body || "{}");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          approved: checkBasicProfanity(text || ''),
          reason: 'Error in AI moderation, using basic filter'
        }),
      };
    } catch {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Internal server error" }),
      };
    }
  }
};

/**
 * Basic profanity filter (fallback when AI is unavailable)
 */
function checkBasicProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  
  const normalized = text.toLowerCase();
  
  // Common profanity and slurs (comprehensive list)
  const profanityList = [
    'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'cunt', 'dick',
    'piss', 'crap', 'hell', 'slut', 'whore', 'retard', 'nigger', 'nigga',
    'fag', 'faggot', 'kike', 'spic', 'chink', 'gook', 'towelhead',
    'nazi', 'hitler', 'kill yourself', 'suicide', 'rape', 'porn', 'xxx', 
    'nsfw', 'penis', 'vagina', 'cock', 'pussy', 'tranny', 'shemale', 'dyke',
    'lesbo', 'queer', 'homo', 'coon', 'spook', 'wetback', 'beaner', 'gyp',
    'jap', 'sandnigger', 'raghead', 'paki', 'zipperhead', 'slant', 'mongoloid',
    'spaz', 'cripple', 'gimp', 'midget'
  ];
  
  // Check for profanity
  for (const word of profanityList) {
    if (normalized.includes(word)) {
      return false;
    }
  }
  
  return true;
}

