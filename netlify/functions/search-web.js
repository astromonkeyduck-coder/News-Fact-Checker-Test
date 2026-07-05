// Web search function for real-time breaking news
// Provider order (all free, no API key needed):
//   1. Google News RSS  - best for news/current-events queries (our main case)
//   2. DuckDuckGo Instant Answer - good for factual/encyclopedic queries
//   3. DuckDuckGo HTML scrape - generic fallback
// Returns { results: [{ title, snippet, url, source?, publishedAt? }], query, provider }

const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Google News RSS - reliable, keyless, and news-focused.
 */
async function searchGoogleNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NoteworthyNews/1.0)' },
  });
  if (!res.ok) throw new Error(`Google News RSS returned ${res.status}`);
  const xml = await res.text();

  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    if (items.length >= 6) break;
    const title = decodeEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = decodeEntities((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const pubDate = decodeEntities((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
    const source = decodeEntities((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '');
    const description = decodeEntities((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!title || !link) continue;

    // Google News titles end with " - Source Name"; keep the clean headline
    const cleanTitle = source && title.endsWith(` - ${source}`)
      ? title.slice(0, -(source.length + 3))
      : title;

    const when = pubDate ? new Date(pubDate) : null;
    const whenStr = when && !isNaN(when) ? when.toISOString() : null;

    items.push({
      title: cleanTitle,
      snippet: `${source ? `${source}` : 'News result'}${whenStr ? `, ${when.toUTCString()}` : ''}${description && description !== cleanTitle ? ` - ${description.substring(0, 220)}` : ''}`,
      url: link,
      source: source || undefined,
      publishedAt: whenStr || undefined,
    });
  }
  return items;
}

/**
 * DuckDuckGo Instant Answer - good for factual/encyclopedic queries.
 */
async function searchDuckDuckGoInstant(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'NoteworthyNews/1.0 (contact@noteworthynews.co)' },
  });
  if (!res.ok) throw new Error(`DDG instant returned ${res.status}`);
  const data = await res.json();

  const results = [];
  if (data.AbstractText || data.Answer) {
    results.push({
      title: data.Heading || query,
      snippet: data.AbstractText || data.Answer,
      url: data.AbstractURL || '',
    });
  }
  (data.RelatedTopics || []).slice(0, 4).forEach((topic) => {
    if (topic.Text && topic.FirstURL) {
      results.push({
        title: topic.Text.split(' - ')[0] || topic.Text,
        snippet: topic.Text,
        url: topic.FirstURL,
      });
    }
  });
  return results;
}

/**
 * DuckDuckGo HTML scrape - generic last-resort fallback.
 */
async function searchDuckDuckGoHtml(query) {
  const searchUrls = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
  ];

  for (const searchUrl of searchUrls) {
    try {
      const res = await fetchWithTimeout(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      const results = [];
      const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

      const titles = [];
      let m;
      while ((m = linkRe.exec(html)) !== null && titles.length < 8) {
        let href = m[1];
        // DDG wraps results in a redirect: //duckduckgo.com/l/?uddg=<encoded>
        const uddg = href.match(/[?&]uddg=([^&]+)/);
        if (uddg) {
          try { href = decodeURIComponent(uddg[1]); } catch (_) {}
        }
        const title = decodeEntities(m[2].replace(/<[^>]+>/g, ''));
        if (href.startsWith('http') && !href.includes('duckduckgo.com') && title.length > 5) {
          titles.push({ url: href, title });
        }
      }
      const snippets = [];
      while ((m = snippetRe.exec(html)) !== null && snippets.length < 8) {
        snippets.push(decodeEntities(m[1].replace(/<[^>]+>/g, '')));
      }
      for (let i = 0; i < Math.min(titles.length, 5); i++) {
        results.push({
          title: titles[i].title,
          snippet: snippets[i] || titles[i].title,
          url: titles[i].url,
        });
      }
      if (results.length > 0) return results;
    } catch (err) {
      console.log('[Web Search] DDG HTML attempt failed:', err.message);
    }
  }
  return [];
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
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

    // 1. Google News RSS - primary for a news product
    try {
      const newsResults = await searchGoogleNews(query);
      if (newsResults.length > 0) {
        console.log(`[Web Search] ✅ Google News returned ${newsResults.length} results`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ results: newsResults.slice(0, 5), query, provider: 'google-news' }),
        };
      }
    } catch (err) {
      console.log('[Web Search] Google News failed:', err.message);
    }

    // 2. DuckDuckGo Instant Answer - factual queries
    try {
      const instantResults = await searchDuckDuckGoInstant(query);
      if (instantResults.length > 0) {
        console.log(`[Web Search] ✅ DDG instant returned ${instantResults.length} results`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ results: instantResults.slice(0, 5), query, provider: 'ddg-instant' }),
        };
      }
    } catch (err) {
      console.log('[Web Search] DDG instant failed:', err.message);
    }

    // 3. DuckDuckGo HTML scrape - generic fallback
    const htmlResults = await searchDuckDuckGoHtml(query);
    if (htmlResults.length > 0) {
      console.log(`[Web Search] ✅ DDG HTML returned ${htmlResults.length} results`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ results: htmlResults.slice(0, 5), query, provider: 'ddg-html' }),
      };
    }

    // Nothing found - return an empty result set (NOT fake suggestions) so the
    // model can honestly say it found nothing.
    console.error('[Web Search] ❌ All providers returned no results for:', query);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: [],
        query,
        provider: 'none',
        note: 'No results from any search provider',
      }),
    };
  } catch (error) {
    console.error('[Web Search] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Search failed", message: error.message }),
    };
  }
};
