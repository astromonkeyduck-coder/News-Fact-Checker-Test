// ChatGPT integration for the Breaking News Fact Checker game
// Provides AI-enhanced explanations, personalized feedback, and educational insights

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

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

  try {
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'AI features are not configured. Please add OPENAI_API_KEY to environment variables.' 
        }),
      };
    }

    const body = JSON.parse(event.body);
    const { action, headline, source, isFactual, userAnswer, explanation, playerStats } = body;

    // Validate required fields based on action
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Action is required' }),
      };
    }

    // Calculate accuracy once for all actions
    const accuracy = playerStats && playerStats.totalAnswers > 0 
      ? (playerStats.correctAnswers / playerStats.totalAnswers * 100).toFixed(1)
      : 0;
    const context = body.context || {};

    let systemPrompt = '';
    let userPrompt = '';

    switch (action) {
      case 'enhance_explanation':
        // Enhance the explanation with more context and educational value
        systemPrompt = `You are an expert media literacy educator for Noteworthy News, a fact-checking and media literacy platform. Your role is to help users understand why news is factual or misleading, teaching critical thinking skills.

Your explanations should:
- Be educational and help users learn to identify misinformation
- Be concise but informative (2-3 sentences)
- Point out specific red flags or verification methods
- Use clear, accessible language
- Encourage critical thinking without being preachy`;

        userPrompt = `A player in our fact-checking game just answered a question. Please provide an enhanced explanation with full context:

GAME CONTEXT:
- Player's Current Score: ${context.currentScore || 0}
- Current Level: ${context.currentLevel || 1}
- Player's Accuracy: ${accuracy}%
- Difficulty: ${context.difficulty || 'medium'}
- Time Bonus: ${context.timeBonus || 0} points

HEADLINE DETAILS:
- Headline: "${headline}"
- Source: "${source}"
- Correct Answer: ${isFactual ? 'FACTUAL' : 'MISLEADING'}
- Player's Answer: ${userAnswer === isFactual ? 'CORRECT ✅' : 'INCORRECT ❌'}
- Category: ${body.category || 'general'}
- Level: ${body.level || 1}

Current explanation: "${explanation}"
Tips: "${body.tips || 'N/A'}"

Please provide a more detailed, educational explanation that:
1. Explains WHY this is ${isFactual ? 'factual' : 'misleading'} with specific reasoning
2. Analyzes the source "${source}" and why it's ${isFactual ? 'credible' : 'not credible'}
3. Teaches the player specific fact-checking techniques they could use
4. Highlights any red flags (if misleading) or verification methods (if factual)
5. Is encouraging and educational

Format your response as a concise but informative explanation (2-3 sentences).`;

        break;

      case 'personalized_feedback':
        // Provide personalized feedback based on player performance
        systemPrompt = `You are an encouraging and educational AI assistant for Noteworthy News' fact-checking game. You help players improve their media literacy skills with personalized, constructive feedback.

Be:
- Encouraging and positive
- Specific about areas for improvement
- Educational about fact-checking techniques
- Concise (2-3 sentences maximum)`;

        userPrompt = `Provide personalized feedback for a player:

Current Stats:
- Score: ${playerStats.score || 0}
- Current Streak: ${playerStats.streak || 0}
- Accuracy: ${accuracy}%
- Level: ${playerStats.level || 1}
- Total Questions Answered: ${playerStats.totalAnswers || 0}

Recent Answer: ${userAnswer === isFactual ? 'CORRECT ✅' : 'INCORRECT ❌'}

Headline: "${headline}"
Correct Answer: ${isFactual ? 'FACTUAL' : 'MISLEADING'}

Provide:
1. Brief acknowledgment of their answer (correct/incorrect)
2. One specific tip for improving their fact-checking skills
3. Encouragement to keep learning

Keep it very concise (2-3 sentences total).`;

        break;

      case 'educational_insight':
        // Provide additional educational context about the topic
        systemPrompt = `You are a media literacy expert providing educational insights about news verification and fact-checking. Your insights help players learn critical thinking skills.`;

        userPrompt = `Provide a brief educational insight about this headline:

Headline: "${headline}"
Source: "${source}"
Type: ${isFactual ? 'Factual News' : 'Misleading Information'}
Category: ${body.category || 'general'}

Give a 1-2 sentence educational insight that teaches:
- What makes this ${isFactual ? 'reliable' : 'problematic'}
- A quick lesson about verifying similar claims

Keep it very brief and educational.`;

        break;

      case 'detailed_explanation':
        // Provide a comprehensive AI explanation with full context
        systemPrompt = `You are an expert media literacy educator and fact-checker for Noteworthy News. You provide detailed, comprehensive explanations that help users understand why news is factual or misleading. You have access to the full context of the game, the headline, source, and all relevant information.

Your explanations should:
- Be comprehensive and detailed (3-5 sentences)
- Explain WHY the headline is ${isFactual ? 'factual' : 'misleading'} with specific reasoning
- Point out specific red flags, verification methods, or credibility indicators
- Reference the source credibility and why it matters
- Explain the category and level of difficulty
- Provide actionable fact-checking techniques
- Be educational and help users learn critical thinking skills
- Use clear, accessible language`;

        userPrompt = `Provide a detailed, comprehensive explanation for this news story in the fact-checking game:

CONTEXT:
- Game Type: ${context.gameType || 'fact-checker'}
- Player's Current Score: ${context.currentScore || 0}
- Current Level: ${context.currentLevel || 1}
- Player's Accuracy: ${accuracy}%
- Difficulty Setting: ${context.difficulty || 'medium'}

HEADLINE DETAILS:
- Headline: "${headline}"
- Source: "${source}"
- Is Factual: ${isFactual ? 'YES (Factual)' : 'NO (Misleading)'}
- Category: ${body.category || 'general'}
- Difficulty Level: ${body.level || 1}

EXPLANATION PROVIDED:
"${explanation}"

TIPS PROVIDED:
"${body.tips || 'N/A'}"

Please provide a comprehensive, detailed explanation (3-5 sentences) that:
1. Clearly explains WHY this headline is ${isFactual ? 'factual and reliable' : 'misleading and unreliable'}
2. Analyzes the SOURCE credibility - why "${source}" is ${isFactual ? 'a trustworthy source' : 'not a credible source'}
3. Points out SPECIFIC indicators that make this ${isFactual ? 'factual' : 'misleading'} (e.g., language patterns, source reputation, evidence quality)
4. Explains what FACT-CHECKING TECHNIQUES a person could use to verify this type of claim
5. Provides educational context about why this type of ${isFactual ? 'reliable' : 'misleading'} information ${isFactual ? 'can be trusted' : 'should be questioned'}

Make your explanation detailed, educational, and comprehensive. Help the player understand not just WHAT the answer is, but WHY and HOW to identify similar stories in the future.`;

        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Supported: enhance_explanation, personalized_feedback, educational_insight, detailed_explanation' }),
        };
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cost-effective model
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200, // Keep responses concise
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: data.error?.message || 'Failed to get AI response',
          details: data.error 
        }),
      };
    }

    const aiResponse = data.choices[0]?.message?.content || 'No response generated';
    const usage = data.usage;

    // Log game AI interaction (non-blocking - don't wait for it)
    const { logData } = require("./log-data");
    logData("ai-chat", {
      action: action,
      userMessage: userPrompt || message || `Game AI: ${action}`,
      aiResponse: aiResponse,
      usage: usage,
      model: "gpt-4o",
      gameContext: {
        headline: headline,
        source: source,
        isFactual: isFactual,
        userAnswer: userAnswer,
        playerStats: playerStats,
        accuracy: accuracy,
      },
      endpoint: "game-ai",
    }, event).catch(err => {
      console.error("[Game AI] Failed to log data:", err);
      // Don't fail the request if logging fails
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: aiResponse,
        usage: usage,
      }),
    };

  } catch (error) {
    console.error('Game AI function error:', error);
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

