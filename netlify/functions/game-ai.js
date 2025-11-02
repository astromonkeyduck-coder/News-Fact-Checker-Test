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

        userPrompt = `A player in our fact-checking game just answered a question. Please provide an enhanced explanation:

Headline: "${headline}"
Source: "${source}"
Correct Answer: ${isFactual ? 'FACTUAL' : 'MISLEADING'}
Player's Answer: ${userAnswer === isFactual ? 'CORRECT ✅' : 'INCORRECT ❌'}

Current explanation: "${explanation}"

Please provide a more detailed, educational explanation that:
1. Explains WHY this is ${isFactual ? 'factual' : 'misleading'}
2. Teaches the player specific fact-checking techniques they could use
3. Highlights any red flags (if misleading) or verification methods (if factual)
4. Is encouraging and educational

Format your response as a concise explanation (2-3 sentences).`;

        break;

      case 'personalized_feedback':
        // Provide personalized feedback based on player performance
        const accuracy = playerStats.totalAnswers > 0 
          ? (playerStats.correctAnswers / playerStats.totalAnswers * 100).toFixed(1)
          : 0;
        
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

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Supported: enhance_explanation, personalized_feedback, educational_insight' }),
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: data.choices[0]?.message?.content || 'No response generated',
        usage: data.usage,
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

