// Web search function for real-time breaking news
// Uses DuckDuckGo Instant Answer API (free, no API key needed)
// Falls back to DuckDuckGo HTML search if needed

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  try {
    const { query } = JSON.parse(event.body || '{}');
    
    if (!query || typeof query !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Query is required" }),
      };
    }

    console.log('[Web Search] Searching for:', query);

    // Try DuckDuckGo Instant Answer API first (fast, structured)
    try {
      const instantAnswerUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const instantResponse = await fetch(instantAnswerUrl, {
        headers: {
          'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)'
        }
      });

      if (instantResponse.ok) {
        const instantData = await instantResponse.json();
        
        // If we have a good instant answer, use it
        if (instantData.AbstractText || instantData.Answer) {
          const results = [{
            title: instantData.Heading || query,
            snippet: instantData.AbstractText || instantData.Answer,
            url: instantData.AbstractURL || instantData.AnswerType
          }];
          
          // Add related topics if available
          if (instantData.RelatedTopics && instantData.RelatedTopics.length > 0) {
            instantData.RelatedTopics.slice(0, 4).forEach(topic => {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0] || topic.Text,
                  snippet: topic.Text,
                  url: topic.FirstURL
                });
              }
            });
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              results: results.slice(0, 5),
              query: query
            }),
          };
        }
      }
    } catch (instantError) {
      console.log('[Web Search] Instant answer failed, trying HTML search:', instantError.message);
    }

    // Fallback: Use DuckDuckGo HTML search (scrape results)
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const htmlResponse = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        
        // Simple regex-based extraction (DuckDuckGo HTML structure)
        const results = [];
        const titleRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        const snippetRegex = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
        
        let match;
        const titles = [];
        while ((match = titleRegex.exec(html)) !== null && titles.length < 5) {
          titles.push({
            url: match[1],
            title: match[2].trim()
          });
        }

        const snippets = [];
        while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
          snippets.push(match[1].trim());
        }

        // Combine titles and snippets
        for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
          results.push({
            title: titles[i].title,
            snippet: snippets[i] || '',
            url: titles[i].url
          });
        }

        if (results.length > 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              results: results,
              query: query
            }),
          };
        }
      }
    } catch (htmlError) {
      console.error('[Web Search] HTML search failed:', htmlError);
    }

    // If both fail, return a helpful error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: [{
          title: `Search: ${query}`,
          snippet: `Unable to fetch real-time results for "${query}". Please try rephrasing your query or check back later.`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
        }],
        query: query,
        note: 'Search service temporarily unavailable'
      }),
    };

  } catch (error) {
    console.error('[Web Search] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Search failed",
        message: error.message
      }),
    };
  }
};
