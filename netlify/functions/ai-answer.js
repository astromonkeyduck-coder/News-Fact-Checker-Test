/**
 * Netlify Function: AI Answer with Live Awareness
 * 
 * Provides up-to-date AI answers using:
 * 1. PRIMARY: Our database (live_events) - last 24-72 hours
 * 2. FALLBACK: OpenAI web search when DB insufficient
 * 
 * Stores web search results back to database for future use.
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

if (!openaiApiKey) {
  throw new Error('Missing OpenAI API key');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

/**
 * Search database for relevant events
 */
async function searchDatabase(query, hoursBack = 72) {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    // Full-text search on title and summary
    const { data, error } = await supabase
      .from('live_events')
      .select('*')
      .gte('fetched_at', cutoffTime.toISOString())
      .order('fetched_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[AI Answer] Database search error:', error);
      return [];
    }

    // Simple keyword matching (in production, use proper full-text search)
    const queryLower = query.toLowerCase();
    const relevant = (data || []).filter(event => {
      const titleMatch = event.title?.toLowerCase().includes(queryLower);
      const summaryMatch = event.summary?.toLowerCase().includes(queryLower);
      const tagsMatch = event.tags?.some(tag => tag.toLowerCase().includes(queryLower));
      return titleMatch || summaryMatch || tagsMatch;
    });

    return relevant.slice(0, 10); // Top 10 most relevant
  } catch (error) {
    console.error('[AI Answer] Database search error:', error);
    return [];
  }
}

/**
 * Store web search results to database
 */
async function storeWebSearchResults(results, query) {
  if (!results || results.length === 0) return;

  const events = [];
  const crypto = require('crypto');

  for (const result of results) {
    if (!result.url || !result.title) continue;

    const canonicalId = crypto
      .createHash('sha256')
      .update(`openai_web_search:${result.url}`)
      .digest('hex')
      .substring(0, 32);

    const event = {
      canonical_id: canonicalId,
      title: result.title,
      summary: result.snippet || result.content || null,
      source_name: result.source || 'Web Search',
      source_url: result.url,
      published_at: result.published_at || new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      tags: ['web_search', query.toLowerCase().substring(0, 20)],
      reliability: 'unknown',
      raw_json: result
    };

    events.push(event);
  }

  // Insert with conflict handling (ignore duplicates)
  if (events.length > 0) {
    const { error } = await supabase
      .from('live_events')
      .upsert(events, { onConflict: 'canonical_id', ignoreDuplicates: true });

    if (error) {
      console.error('[AI Answer] Error storing web search results:', error);
    } else {
      console.log(`[AI Answer] Stored ${events.length} web search results to database`);
    }
  }
}

/**
 * Use OpenAI with web search fallback
 */
async function getOpenAIAnswer(query, dbContext = '') {
  try {
    const systemPrompt = `You are a helpful AI assistant for Noteworthy News, a fact-checked journalism platform.

Your goal is to provide accurate, up-to-date information with proper citations.

${dbContext ? `CONTEXT FROM DATABASE (most recent sources):\n${dbContext}\n\n` : ''}

IMPORTANT RULES:
1. If you have information from the database context above, prioritize it and cite those sources.
2. Use web search ONLY for information not in the database context.
3. Always include citations with URLs and timestamps when available.
4. If information is unconfirmed or you cannot find reliable sources, say: "I don't have confirmed information on that yet."
5. Never hallucinate or make up information.
6. Always indicate the recency of information (e.g., "as of [date]" or "last updated [time]").`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      tools: [
        {
          type: 'function',
          function: {
            name: 'search_web',
            description: 'Search the web for current information. Use this when database context is insufficient.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                }
              },
              required: ['query']
            }
          }
        }
      ],
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    });

    const message = completion.choices[0].message;
    let answer = message.content || '';
    let sources = [];
    let usedWebSearch = false;

    // Handle tool calls (web search)
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'search_web') {
          usedWebSearch = true;
          const searchQuery = JSON.parse(toolCall.function.arguments).query;

          // Call our web search function
          const searchResponse = await fetch(`${process.env.URL || 'https://noteworthynews.co'}/.netlify/functions/search-web`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery })
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const searchResults = searchData.results || [];

            // Store results to database
            await storeWebSearchResults(searchResults, searchQuery);

            // Format results for AI
            const resultsContext = searchResults
              .slice(0, 5)
              .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet || ''}\n   Source: ${r.url}`)
              .join('\n\n');

            // Get final answer with web search results
            const finalCompletion = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                ...messages,
                message,
                {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Web search results for "${searchQuery}":\n\n${resultsContext}`
                }
              ],
              temperature: 0.7,
              max_tokens: 1000
            });

            answer = finalCompletion.choices[0].message.content || answer;

            // Extract sources from web search results
            sources = searchResults.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              published_at: r.published_at || null,
              fetched_at: new Date().toISOString()
            }));
          }
        }
      }
    }

    return { answer, sources, usedWebSearch };
  } catch (error) {
    console.error('[AI Answer] OpenAI error:', error);
    throw error;
  }
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { question } = JSON.parse(event.body || '{}');

    if (!question || typeof question !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Question is required' })
      };
    }

    console.log(`[AI Answer] Processing question: "${question.substring(0, 100)}"`);

    // STEP 1: Search database first
    const dbEvents = await searchDatabase(question, 72); // Last 72 hours
    console.log(`[AI Answer] Found ${dbEvents.length} relevant events in database`);

    let answer;
    let sources = [];
    let usedWebSearch = false;
    let lastUpdated = null;

    if (dbEvents.length >= 3) {
      // Database has sufficient information - use only DB
      console.log('[AI Answer] Using database-only answer (sufficient data)');

      const dbContext = dbEvents
        .slice(0, 10)
        .map((e, i) => `${i + 1}. ${e.title}\n   ${e.summary || ''}\n   Source: ${e.source_name} - ${e.source_url || 'N/A'}\n   Published: ${e.published_at || e.fetched_at}`)
        .join('\n\n');

      const result = await getOpenAIAnswer(question, dbContext);
      answer = result.answer;
      sources = dbEvents.map(e => ({
        title: e.title,
        url: e.source_url,
        snippet: e.summary,
        published_at: e.published_at,
        fetched_at: e.fetched_at,
        source_name: e.source_name,
        reliability: e.reliability
      }));
      usedWebSearch = result.usedWebSearch;
      lastUpdated = dbEvents[0]?.fetched_at || new Date().toISOString();
    } else {
      // Database insufficient - use OpenAI with web search fallback
      console.log('[AI Answer] Database insufficient, using OpenAI with web search fallback');

      const dbContext = dbEvents.length > 0
        ? dbEvents.map((e, i) => `${i + 1}. ${e.title}\n   ${e.summary || ''}\n   Source: ${e.source_name}`).join('\n\n')
        : '';

      const result = await getOpenAIAnswer(question, dbContext);
      answer = result.answer;
      sources = result.sources;
      usedWebSearch = result.usedWebSearch;

      // Combine DB sources with web search sources
      const dbSources = dbEvents.map(e => ({
        title: e.title,
        url: e.source_url,
        snippet: e.summary,
        published_at: e.published_at,
        fetched_at: e.fetched_at,
        source_name: e.source_name,
        reliability: e.reliability
      }));

      sources = [...dbSources, ...sources];
      lastUpdated = sources.length > 0
        ? sources.map(s => s.fetched_at || s.published_at).filter(Boolean).sort().reverse()[0]
        : new Date().toISOString();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        answer,
        sources,
        last_updated: lastUpdated,
        used_web_search: usedWebSearch,
        db_events_count: dbEvents.length
      })
    };
  } catch (error) {
    console.error('[AI Answer] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate answer',
        message: error.message
      })
    };
  }
};





