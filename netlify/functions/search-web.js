// Web search function for real-time breaking news
// Uses DuckDuckGo Instant Answer API (free, no API key needed)
// Falls back to DuckDuckGo HTML search if needed
// NOTE: For production, consider using a proper search API like SerpAPI, Google Custom Search, or Tavily

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
      // Try multiple DuckDuckGo endpoints for better results
      const searchUrls = [
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
      ];
      
      for (const searchUrl of searchUrls) {
        try {
          const htmlResponse = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5'
            }
          });

          if (htmlResponse.ok) {
            const html = await htmlResponse.text();
            console.log('[Web Search] HTML response length:', html.length);
            
            const results = [];
            
            // Try multiple regex patterns for different DuckDuckGo layouts
            const patterns = [
              // Modern DuckDuckGo format
              {
                title: /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g,
                snippet: /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/a>/g
              },
              // Alternative format
              {
                title: /<a[^>]*href="([^"]+)"[^>]*class="[^"]*result[^"]*"[^>]*>([^<]+)<\/a>/g,
                snippet: /<span[^>]*class="[^"]*snippet[^"]*"[^>]*>([^<]+)<\/span>/g
              },
              // Lite format
              {
                title: /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g,
                snippet: /<td[^>]*class="[^"]*snippet[^"]*"[^>]*>([^<]+)<\/td>/g
              },
              // Generic link extraction
              {
                title: /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,100})<\/a>/g,
                snippet: /<p[^>]*>([^<]{20,200})<\/p>/g
              }
            ];
            
            for (const pattern of patterns) {
              const titles = [];
              const snippets = [];
              
              let match;
              while ((match = pattern.title.exec(html)) !== null && titles.length < 10) {
                const url = match[1];
                const title = match[2].trim();
                // Filter out navigation and non-result links
                if (url && !url.includes('duckduckgo.com') && title.length > 10 && title.length < 200) {
                  titles.push({ url, title });
                }
              }
              
              while ((match = pattern.snippet.exec(html)) !== null && snippets.length < 10) {
                const snippet = match[1].trim();
                if (snippet.length > 20 && snippet.length < 500) {
                  snippets.push(snippet);
                }
              }
              
              // Combine titles and snippets
              for (let i = 0; i < Math.min(titles.length, 5); i++) {
                results.push({
                  title: titles[i].title,
                  snippet: snippets[i] || titles[i].title,
                  url: titles[i].url
                });
              }
              
              if (results.length > 0) {
                console.log('[Web Search] ✅ Found', results.length, 'results using pattern');
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
          }
        } catch (urlError) {
          console.log('[Web Search] URL attempt failed:', urlError.message);
          continue; // Try next URL
        }
      }
    } catch (htmlError) {
      console.error('[Web Search] HTML search failed:', htmlError);
    }

    // If both fail, try one more approach: Use DuckDuckGo's autocomplete API for suggestions
    try {
      const autocompleteUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
      const autocompleteResponse = await fetch(autocompleteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (autocompleteResponse.ok) {
        const suggestions = await autocompleteResponse.json();
        if (suggestions && suggestions.length > 0) {
          // Return suggestions as results (better than nothing)
          const results = suggestions.slice(0, 3).map((suggestion, index) => ({
            title: suggestion.phrase || query,
            snippet: `Search suggestion for: ${suggestion.phrase || query}`,
            url: `https://duckduckgo.com/?q=${encodeURIComponent(suggestion.phrase || query)}`
          }));
          
          console.log('[Web Search] ⚠️ Returning autocomplete suggestions as fallback');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              results: results,
              query: query,
              note: 'Using search suggestions - direct results unavailable'
            }),
          };
        }
      }
    } catch (autocompleteError) {
      console.log('[Web Search] Autocomplete fallback failed:', autocompleteError.message);
    }

    // If all methods fail, return a helpful error with search link
    console.error('[Web Search] ❌ All search methods failed for query:', query);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: [{
          title: `Search: ${query}`,
          snippet: `Unable to fetch real-time results for "${query}". The search service may be temporarily unavailable. Please try rephrasing your query or check direct news sources.`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
        }],
        query: query,
        note: 'Search service temporarily unavailable - all methods failed'
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
