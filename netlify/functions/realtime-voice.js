// OpenAI Realtime API integration for voice conversations
// Creates a session token for the client to connect directly to OpenAI's WebSocket

const { getStore } = require("@netlify/blobs");

/**
 * Fetch recent posts from blob storage for AI context
 */
async function fetchRecentPosts(event, limit = 5) {
  try {
    const siteID = process.env.NETLIFY_SITE_ID || event.headers['x-nf-site-id'];
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || event.headers['x-nf-token'];
    
    let store;
    if (siteID && token) {
      store = getStore({
        name: "x-posts",
        siteID: siteID,
        token: token,
      });
    } else {
      store = getStore({ name: "x-posts" });
    }

    // Read index
    let indexData = { ids: [] };
    try {
      const indexBlob = await store.get("index.json", { type: "json" });
      if (indexBlob && Array.isArray(indexBlob.ids)) {
        indexData = indexBlob;
      }
    } catch (err) {
      return [];
    }

    if (!indexData.ids || indexData.ids.length === 0) {
      return [];
    }

    // Get most recent posts
    const postIds = indexData.ids.slice(0, Math.min(limit, indexData.ids.length));
    
    // Fetch posts in parallel
    const postPromises = postIds.map(async (id) => {
      try {
        const post = await store.get(id, { type: "json" });
        return post;
      } catch (err) {
        return null;
      }
    });

    const posts = await Promise.all(postPromises);
    // Filter out nulls and sort by timestamp (newest first)
    const validPosts = posts
      .filter(p => p !== null)
      .sort((a, b) => {
        const timeA = a.timestamp || a.createdAt || 0;
        const timeB = b.timestamp || b.createdAt || 0;
        return timeB - timeA;
      })
      .slice(0, limit);

    return validPosts;
  } catch (error) {
    console.error('[Realtime Voice] Error fetching recent posts:', error);
    return [];
  }
}

/**
 * Build current events context from recent posts
 */
function buildCurrentEventsContext(posts) {
  if (!posts || posts.length === 0) {
    console.log('[Realtime Voice] No posts available for context');
    return '';
  }
  
  // Include posts from the last 7 days (more inclusive)
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const recentEvents = posts
    .filter(post => {
      const postDate = post.timestamp || post.createdAt || 0;
      if (!postDate) return false;
      const postDateObj = new Date(postDate);
      return postDateObj >= weekAgo;
    })
    .map(post => {
      const title = post.title || post.story || post.text || 'Untitled';
      const date = post.timestamp || post.createdAt;
      const dateStr = date ? new Date(date).toLocaleDateString() : 'Recent';
      const summary = post.summary || post.text?.substring(0, 150) || '';
      return `${dateStr}: ${title}${summary ? ` - ${summary}` : ''}`;
    })
    .slice(0, 5); // Limit to 5 for voice
  
  console.log(`[Realtime Voice] Built context with ${recentEvents.length} recent events`);
  
  if (recentEvents.length > 0) {
    return `\n\nCURRENT EVENTS (Verified Articles from Noteworthy News):
The following are REAL, VERIFIED news articles published on Noteworthy News. Use this information when answering questions about current events:

${recentEvents.join('\n')}

CRITICAL INSTRUCTIONS:
- You MUST use the information above when answering questions about current events
- You CAN discuss these verified articles and provide details from them
- If asked about events NOT listed above, you MUST say: "I don't have information about that specific event. For the latest verified news, please check Noteworthy News' articles or other trusted news sources."
- NEVER make up or fabricate events that are not in the list above`;
  }
  
  console.log('[Realtime Voice] No recent events found (all posts are older than 7 days)');
  return '';
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    // Log request details for debugging
    console.log('Realtime voice request:', {
      method: event.httpMethod,
      path: event.path,
      body: event.body,
      queryString: event.queryStringParameters
    });

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "API key not configured. Please set OPENAI_API_KEY in environment variables." 
        }),
      };
    }

    // Handle GET request - create a new session with ephemeral token (GA API)
    if (event.httpMethod === "GET") {
      let voice = event.queryStringParameters?.voice || 'alloy';
      
      // Validate voice is supported
      const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
      if (!SUPPORTED_VOICES.includes(voice)) {
        console.warn(`Unsupported voice "${voice}" requested, defaulting to "alloy"`);
        voice = 'alloy';
      }
      
      // Fetch recent posts for current events context
      let currentEventsContext = '';
      try {
        const recentPosts = await fetchRecentPosts(event, 5);
        currentEventsContext = buildCurrentEventsContext(recentPosts);
        console.log(`[Realtime Voice] Fetched ${recentPosts.length} posts for context`);
      } catch (error) {
        console.error('[Realtime Voice] Error fetching posts:', error);
      }
      
      console.log('🔄 [GET] Using GA endpoint: /v1/realtime/client_secrets');
      
      let ephemeralToken;
      let expiresAt;
      let sessionId;
      
      try {
        const instructions = `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.

CRITICAL: BREAKING NEWS AND CURRENT EVENTS
${currentEventsContext ? '- You have access to REAL, VERIFIED current events from Noteworthy News (see below)' : '- You do NOT have access to real-time breaking news'}
- You can discuss verified articles listed below
- You have access to a web search function (search_web) that can find REAL-TIME breaking news and current events
- When asked about breaking news, recent events, or current developments NOT in the verified articles, USE the search_web function to find real-time information
- After searching, provide accurate, factual information from the search results
- NEVER make up breaking news events
- If web search fails or returns no results, say: "I couldn't find current information about that. Check Noteworthy News' articles for verified news."
- If you don't know something and search doesn't help, say so clearly rather than speculate
${currentEventsContext}

IMAGE GENERATION:
- You CAN generate images when users ask for them
- Use the generate_image function when users request images, pictures, illustrations, or visuals
- Acknowledge the request and say you're generating the image

When a voice conversation starts, greet the user by saying "Hey, It's Noteworthy AI" in a friendly, welcoming tone.`;

        const clientSecretResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expires_after: {
              anchor: 'created_at',
              seconds: 600 // 10 minutes
            },
            session: {
              type: 'realtime',
              model: 'gpt-realtime', // GA API uses 'gpt-realtime', not 'gpt-4o-realtime-preview'
              instructions: instructions,
              tools: [
                {
                  type: 'function',
                  name: 'generate_image',
                  description: 'Generate an image using DALL-E based on a text description. Use this when the user asks for an image, picture, illustration, or visual.',
                  parameters: {
                    type: 'object',
                    properties: {
                      prompt: {
                        type: 'string',
                        description: 'A detailed description of the image to generate'
                      }
                    },
                    required: ['prompt']
                  }
                },
                {
                  type: 'function',
                  name: 'search_web',
                  description: 'Search the web for real-time breaking news, current events, or any information that happened recently. Use this when the user asks about current events, breaking news, recent developments, or anything that requires up-to-date information beyond your training data.',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'The search query to find current information about (e.g., "breaking news today", "latest developments in [topic]", "what happened in [location] today")'
                      }
                    },
                    required: ['query']
                  }
                }
              ],
              audio: {
                input: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  },
                  turn_detection: {
                    type: 'server_vad'
                  }
                },
                output: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  },
                  voice: voice, // Voice goes in audio.output.voice, NOT session.voice
                  speed: 1.0
                }
              }
            }
          }),
        });

        if (!clientSecretResponse.ok) {
          const errorData = await clientSecretResponse.json().catch(() => ({}));
          console.error('❌ [GET] client_secrets endpoint failed:', clientSecretResponse.status, errorData);
          return {
            statusCode: clientSecretResponse.status,
            headers,
            body: JSON.stringify({ 
              error: errorData.error?.message || 'Failed to create GA client secret',
              details: errorData,
              note: 'Using /v1/realtime/client_secrets endpoint for GA API compatibility'
            }),
          };
        }

        const clientSecretData = await clientSecretResponse.json();
        console.log('✅ [GET] GA client_secrets endpoint response received');
        
        // Extract token from client_secrets response
        if (clientSecretData.value) {
          ephemeralToken = clientSecretData.value;
          expiresAt = clientSecretData.expires_at;
          console.log('✅ [GET] Using ephemeral token from GA client_secrets endpoint');
          
          // Validate format
          if (!ephemeralToken.startsWith('ek_')) {
            console.error('❌ [GET] CRITICAL: Token from client_secrets does not start with "ek_"!');
            throw new Error('Invalid token format from GA client_secrets endpoint');
          } else {
            console.log('✅ [GET] Token format validated: starts with "ek_" (GA token)');
          }
          
          // Extract session ID from client_secrets response if available
          if (clientSecretData.session && clientSecretData.session.id) {
            sessionId = clientSecretData.session.id;
            console.log('📋 [GET] Session ID from client_secrets response:', sessionId);
          }
        } else {
          console.error('❌ [GET] client_secrets endpoint did not return token in "value" field');
          throw new Error('No token value in GA client_secrets response');
        }
      } catch (clientSecretError) {
        console.error('❌ [GET] Error calling GA client_secrets endpoint:', clientSecretError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to create GA client secret',
            message: clientSecretError.message,
            details: 'Using /v1/realtime/client_secrets for GA API compatibility'
          }),
        };
      }
      
      if (!ephemeralToken) {
        console.error('❌ [GET] No ephemeral token found after GA client_secrets call');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'No ephemeral token found from GA client_secrets endpoint',
            details: 'This should not happen - token extraction failed'
          }),
        };
      }
      
      // Return session details with ephemeral token
      // CRITICAL: Return format must be: { "ephemeralToken": "ek_...", "model": "...", "voice": "..." }
      // Return the string token value, not the whole object
      // Never return the real API key
      // This is a GA-compatible token that works with GA WebSocket endpoint
      const tokenPreview = ephemeralToken.substring(0, 8) + '...';
      console.log('✅ [GET] Returning GA session with token (redacted):', tokenPreview);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ephemeralToken: ephemeralToken, // GA-compatible token from client_secrets.value
          model: 'gpt-realtime', // GA API model name
          voice: voice,
          // Optional: include session_id for internal tracking/logging only
          session_id: sessionId, // From client_secrets response if available
          expires_at: expiresAt
        }),
      };
    }

    // Handle POST request - create session with custom voice
    if (event.httpMethod === "POST") {
      let body = {};
      
      // Handle different body formats from Netlify Functions
      if (event.body) {
        try {
          let bodyStr = event.body;
          
          // Handle base64 encoded body (Netlify Functions can send this)
          if (event.isBase64Encoded && typeof bodyStr === 'string') {
            bodyStr = Buffer.from(bodyStr, 'base64').toString('utf-8');
            console.log('Decoded base64 body:', bodyStr.substring(0, 100));
          }
          
          if (typeof bodyStr === 'string') {
            // Empty string or whitespace only
            if (bodyStr.trim() === '') {
              body = {};
            } else {
              body = JSON.parse(bodyStr);
            }
          } else if (typeof bodyStr === 'object') {
            // Already parsed (shouldn't happen in Netlify but handle it)
            body = bodyStr;
          }
          
          console.log('Parsed body:', body);
        } catch (e) {
          console.error('Error parsing request body:', e);
          console.error('Raw body type:', typeof event.body);
          console.error('Raw body value:', typeof event.body === 'string' ? event.body.substring(0, 200) : event.body);
          console.error('isBase64Encoded:', event.isBase64Encoded);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid JSON in request body', 
              details: e.message,
              receivedBodyType: typeof event.body,
              isBase64Encoded: event.isBase64Encoded,
              receivedBody: typeof event.body === 'string' ? event.body.substring(0, 200) : 'Not a string'
            }),
          };
        }
      }
      
      let voice = body.voice || 'alloy';
      
      // Validate voice is supported
      const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
      if (!SUPPORTED_VOICES.includes(voice)) {
        console.warn(`Unsupported voice "${voice}" requested, defaulting to "alloy"`);
        voice = 'alloy';
      }
      console.log('Creating session with voice:', voice, 'from body:', body);
      
      // Fetch recent posts for current events context
      let currentEventsContext = '';
      try {
        const recentPosts = await fetchRecentPosts(event, 5);
        currentEventsContext = buildCurrentEventsContext(recentPosts);
        console.log(`[Realtime Voice] Fetched ${recentPosts.length} posts for context`);
      } catch (error) {
        console.error('[Realtime Voice] Error fetching posts:', error);
      }
      
      // CRITICAL FIX: Use /v1/realtime/client_secrets endpoint (GA API)
      // The /v1/realtime/sessions endpoint creates BETA sessions which are incompatible with GA WebSocket
      // Error: "API version mismatch. You cannot start a Realtime GA session with a beta client secret."
      // Solution: Use /v1/realtime/client_secrets to create GA-compatible client secrets
      console.log('🔄 [POST] Using GA endpoint: /v1/realtime/client_secrets');
      
      let ephemeralToken;
      let expiresAt;
      let sessionId;
      
      try {
        const instructions = `You are Noteworthy AI, the intelligent assistant for Noteworthy News. You help users with fact-checking, media literacy, and staying informed with verified news. Be concise, helpful, and always truth-seeking.

You help users understand news, fact-check claims, and stay informed with accurate information.

CRITICAL: BREAKING NEWS AND CURRENT EVENTS
${currentEventsContext ? '- You have access to REAL, VERIFIED current events from Noteworthy News (see below)' : '- You do NOT have access to real-time breaking news'}
- You can discuss verified articles listed below
- You have access to a web search function (search_web) that can find REAL-TIME breaking news and current events
- When asked about breaking news, recent events, or current developments NOT in the verified articles, USE the search_web function to find real-time information
- After searching, provide accurate, factual information from the search results
- NEVER make up breaking news events
- If web search fails or returns no results, say: "I couldn't find current information about that. Check Noteworthy News' articles for verified news."
- If you don't know something and search doesn't help, say so clearly rather than speculate
${currentEventsContext}

IMAGE GENERATION:
- You CAN generate images when users ask for them
- Use the generate_image function when users request images, pictures, illustrations, or visuals
- Acknowledge the request and say you're generating the image

When a voice conversation starts, greet the user by saying "Hey, It's Noteworthy AI" in a friendly, welcoming tone.`;

        const clientSecretResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expires_after: {
              anchor: 'created_at',
              seconds: 600 // 10 minutes
            },
            session: {
              type: 'realtime',
              model: 'gpt-realtime', // GA API uses 'gpt-realtime', not 'gpt-4o-realtime-preview'
              instructions: instructions,
              tools: [
                {
                  type: 'function',
                  name: 'generate_image',
                  description: 'Generate an image using DALL-E based on a text description. Use this when the user asks for an image, picture, illustration, or visual.',
                  parameters: {
                    type: 'object',
                    properties: {
                      prompt: {
                        type: 'string',
                        description: 'A detailed description of the image to generate'
                      }
                    },
                    required: ['prompt']
                  }
                },
                {
                  type: 'function',
                  name: 'search_web',
                  description: 'Search the web for real-time breaking news, current events, or any information that happened recently. Use this when the user asks about current events, breaking news, recent developments, or anything that requires up-to-date information beyond your training data.',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'The search query to find current information about (e.g., "breaking news today", "latest developments in [topic]", "what happened in [location] today")'
                      }
                    },
                    required: ['query']
                  }
                }
              ],
              audio: {
                input: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  },
                  turn_detection: {
                    type: 'server_vad'
                  }
                },
                output: {
                  format: {
                    type: 'audio/pcm',
                    rate: 24000
                  },
                  voice: voice, // Voice goes in audio.output.voice, NOT session.voice
                  speed: 1.0
                }
              }
            }
          }),
        });

        if (!clientSecretResponse.ok) {
          const errorData = await clientSecretResponse.json().catch(() => ({}));
          console.error('❌ [POST] client_secrets endpoint failed:', clientSecretResponse.status, errorData);
          return {
            statusCode: clientSecretResponse.status,
            headers,
            body: JSON.stringify({ 
              error: errorData.error?.message || 'Failed to create GA client secret',
              details: errorData,
              note: 'Using /v1/realtime/client_secrets endpoint for GA API compatibility'
            }),
          };
        }

        const clientSecretData = await clientSecretResponse.json();
        console.log('✅ [POST] GA client_secrets endpoint response received');
        console.log('📋 [POST] Response keys:', Object.keys(clientSecretData));
        
        // Extract token from client_secrets response
        if (clientSecretData.value) {
          ephemeralToken = clientSecretData.value;
          expiresAt = clientSecretData.expires_at;
          console.log('✅ [POST] Using ephemeral token from GA client_secrets endpoint');
          console.log('📋 [POST] Token length:', ephemeralToken.length);
          console.log('📋 [POST] Token preview (first 30 chars):', ephemeralToken.substring(0, 30) + '...');
          
          // Validate format
          if (!ephemeralToken.startsWith('ek_')) {
            console.error('❌ [POST] CRITICAL: Token from client_secrets does not start with "ek_"!');
            console.error('❌ [POST] Full response:', JSON.stringify(clientSecretData, null, 2));
            throw new Error('Invalid token format from GA client_secrets endpoint');
          } else {
            console.log('✅ [POST] Token format validated: starts with "ek_" (GA token)');
          }
          
          // Extract session ID from client_secrets response if available
          if (clientSecretData.session && clientSecretData.session.id) {
            sessionId = clientSecretData.session.id;
            console.log('📋 [POST] Session ID from client_secrets response:', sessionId);
          } else {
            console.log('⚠️ [POST] No session ID in client_secrets response (optional)');
          }
        } else {
          console.error('❌ [POST] client_secrets endpoint did not return token in "value" field');
          console.error('❌ [POST] Response:', JSON.stringify(clientSecretData, null, 2));
          throw new Error('No token value in GA client_secrets response');
        }
      } catch (clientSecretError) {
        console.error('❌ [POST] Error calling GA client_secrets endpoint:', clientSecretError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to create GA client secret',
            message: clientSecretError.message,
            details: 'Using /v1/realtime/client_secrets for GA API compatibility'
          }),
        };
      }
      
      // Final validation - token should already be set from client_secrets endpoint
      if (!ephemeralToken) {
        console.error('❌ [POST] CRITICAL: No ephemeral token after GA client_secrets call');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'No ephemeral token found from GA client_secrets endpoint',
            details: 'This should not happen - token extraction failed'
          }),
        };
      }
      
      console.log('✅ [POST] Returning GA session with token to client');
      
      // Redact token in logs (show only first 8 chars)
      const tokenPreview = ephemeralToken.substring(0, 8) + '...';
      console.log('📋 [POST] Token being sent (redacted):', tokenPreview);
      console.log('📋 [POST] Token length:', ephemeralToken.length);
      
      // CRITICAL VALIDATION: Verify token format - MUST start with 'ek_' for ephemeral tokens
      if (!ephemeralToken.startsWith('ek_')) {
        console.error('❌ [POST] CRITICAL: Token does not start with "ek_" - INVALID FORMAT!');
        console.error('❌ [POST] Token preview:', tokenPreview);
        throw new Error('Invalid token format - token must start with "ek_"');
      }
      
      console.log('✅ [POST] Token format validated: starts with "ek_" (GA token format)');
      
      // Return response in required format: { "ephemeralToken": "ek_...", "model": "...", "voice": "..." }
      // Note: Return the string token value, not the whole object
      // Never return the real API key
      // This is a GA-compatible token that works with GA WebSocket endpoint
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ephemeralToken: ephemeralToken, // GA-compatible token from client_secrets.value
          model: 'gpt-realtime', // GA API model name
          voice: voice,
          // Optional: include session_id for internal tracking/logging only
          session_id: sessionId, // From client_secrets response if available
          expires_at: expiresAt
        }),
      };
    }

    // If we get here, the method is not GET or POST
    console.error('Unsupported HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: "Method not allowed",
        receivedMethod: event.httpMethod,
        allowedMethods: ["GET", "POST", "OPTIONS"]
      }),
    };

  } catch (error) {
    console.error('Realtime voice function error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};

