/**
 * Analytics Engine
 * Main Character, Correlation, Narrative Tracking
 */

/**
 * Extract entities from text (simple regex-based)
 */
const ENTITY_PATTERNS = {
  countries: /\b(United States|USA|US|China|Russia|India|Japan|Germany|UK|United Kingdom|France|Italy|Brazil|Canada|Australia|South Korea|Mexico|Indonesia|Turkey|Saudi Arabia|Spain|Netherlands|Switzerland|Poland|Belgium|Sweden|Argentina|Norway|Israel|Ireland|Singapore|Malaysia|Philippines|Thailand|Vietnam|Egypt|Pakistan|Bangladesh|Nigeria|South Africa|Kenya|Ethiopia|Ghana|Tanzania|Uganda|Morocco|Algeria|Tunisia|Libya|Sudan|Iraq|Iran|Afghanistan|Syria|Yemen|Lebanon|Jordan|Kuwait|Qatar|UAE|Oman|Bahrain|Oman|Cyprus|Greece|Portugal|Romania|Bulgaria|Hungary|Czech|Slovakia|Austria|Denmark|Finland|Estonia|Latvia|Lithuania|Croatia|Serbia|Bosnia|Macedonia|Albania|Montenegro|Kosovo|Moldova|Belarus|Ukraine|Georgia|Armenia|Azerbaijan|Kazakhstan|Uzbekistan|Kyrgyzstan|Tajikistan|Turkmenistan|Mongolia|North Korea|Myanmar|Laos|Cambodia|Sri Lanka|Nepal|Bhutan|Maldives|Fiji|Papua New Guinea|New Zealand|Fiji|Samoa|Tonga|Vanuatu|Solomon Islands|Marshall Islands|Micronesia|Palau|Nauru|Kiribati|Tuvalu)\b/gi,
  
  leaders: /\b(Putin|Xi Jinping|Biden|Trump|Modi|Sunak|Scholz|Macron|Meloni|Trudeau|Albanese|Kishida|Yoon|Lula|AMLO|Erdogan|MBS|Netanyahu|Zelensky|Kim Jong-un|Orban|Duda|Rutte|Scholz|Stoltenberg|Von der Leyen|Michel)\b/gi,
  
  organizations: /\b(NATO|EU|UN|United Nations|WHO|WTO|IMF|World Bank|G7|G20|OPEC|ASEAN|African Union|Arab League|OSCE|OECD|Red Cross|Amnesty International|Human Rights Watch|Greenpeace|WWF|UNESCO|UNICEF|WHO|WTO|IMF|World Bank|Federal Reserve|ECB|Bank of England|Bank of Japan|People's Bank of China|Pentagon|Kremlin|White House|Downing Street|Elysée|Bundestag|Congress|Parliament|Supreme Court|International Court|ICC|ICJ)\b/gi,
  
  companies: /\b(Apple|Google|Microsoft|Amazon|Meta|Facebook|Tesla|NVIDIA|OpenAI|X|Twitter|TikTok|ByteDance|Alibaba|Tencent|Samsung|Sony|Intel|AMD|Qualcomm|TSMC|ASML|TSMC|Samsung|LG|Huawei|ZTE|Boeing|Airbus|Lockheed|Raytheon|Northrop|General Dynamics|BAE Systems|Thales|Rheinmetall|Rostec|Rosatom|Gazprom|Rosneft|Exxon|Shell|BP|Chevron|Total|Saudi Aramco|ADNOC|PetroChina|Sinopec)\b/gi,
  
  currencies: /\b(USD|EUR|GBP|JPY|CNY|RMB|RUB|INR|AUD|CAD|CHF|SGD|HKD|KRW|MXN|BRL|ZAR|NOK|SEK|DKK|PLN|CZK|HUF|RON|BGN|HRK|TRY|ILS|AED|SAR|QAR|KWD|BHD|OMR|JOD|LBP|EGP|NGN|KES|ETB|GHS|TZS|UGX|MAD|DZD|TND|LYD|SDG|IQD|IRR|AFN|PKR|BDT|LKR|NPR|BTN|MMK|THB|VND|LAK|KHR|IDR|MYR|PHP|BND|XOF|XAF|CFA|Bitcoin|BTC|Ethereum|ETH|Solana|SOL|Dogecoin|DOGE|Cardano|ADA|Polkadot|DOT|Chainlink|LINK|Litecoin|LTC|XRP|Ripple)\b/gi
};

/**
 * Extract main characters (top mentioned entities)
 */
export function extractMainCharacters(headlines, limit = 10) {
  const entityCounts = new Map();

  headlines.forEach(headline => {
    const text = `${headline.title} ${headline.description || ''}`.toLowerCase();
    
    // Check each entity type
    Object.entries(ENTITY_PATTERNS).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalized = match.trim();
          const count = entityCounts.get(normalized) || { count: 0, type, mentions: [] };
          count.count++;
          if (!count.mentions.includes(headline.id || headline.guid)) {
            count.mentions.push(headline.id || headline.guid);
          }
          entityCounts.set(normalized, count);
        });
      }
    });
  });

  // Sort by count and return top N
  return Array.from(entityCounts.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      type: data.type,
      mentions: data.mentions.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Detect correlations (topics spiking across categories)
 */
export function detectCorrelations(headlines, timeWindow = 3600000) {
  const now = Date.now();
  const recent = headlines.filter(h => {
    const time = h.timestamp || parseTimestamp(h.pubDate);
    return now - time < timeWindow;
  });

  // Group by topic keywords
  const topicGroups = new Map();
  
  const topicKeywords = {
    'conflict': ['war', 'conflict', 'attack', 'strike', 'military', 'defense', 'weapon', 'casualty', 'ceasefire', 'truce'],
    'economy': ['economy', 'market', 'trade', 'inflation', 'recession', 'GDP', 'unemployment', 'growth', 'decline', 'crisis'],
    'technology': ['AI', 'artificial intelligence', 'tech', 'innovation', 'cyber', 'hack', 'data', 'privacy', 'algorithm', 'quantum'],
    'climate': ['climate', 'weather', 'temperature', 'flood', 'drought', 'hurricane', 'typhoon', 'wildfire', 'emission', 'carbon'],
    'health': ['health', 'disease', 'pandemic', 'vaccine', 'hospital', 'medical', 'treatment', 'outbreak', 'epidemic'],
    'politics': ['election', 'vote', 'government', 'policy', 'law', 'legislation', 'senate', 'congress', 'parliament', 'diplomacy']
  };

  recent.forEach(headline => {
    const text = `${headline.title} ${headline.description || ''}`.toLowerCase();
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const matches = keywords.filter(kw => text.includes(kw.toLowerCase()));
      if (matches.length > 0) {
        if (!topicGroups.has(topic)) {
          topicGroups.set(topic, []);
        }
        topicGroups.get(topic).push({
          headline,
          matchedKeywords: matches
        });
      }
    });
  });

  // Find topics with high activity
  const correlations = Array.from(topicGroups.entries())
    .map(([topic, items]) => ({
      topic,
      count: items.length,
      momentum: items.length / (timeWindow / 3600000), // per hour
      items: items.slice(0, 5) // Top 5 items
    }))
    .filter(c => c.count >= 3) // At least 3 mentions
    .sort((a, b) => b.count - a.count);

  return correlations;
}

/**
 * Track narratives (fringe vs mainstream)
 */
const MAINSTREAM_DOMAINS = [
  'bbc.com', 'bbc.co.uk', 'reuters.com', 'ap.org', 'apnews.com',
  'npr.org', 'theguardian.com', 'nytimes.com', 'washingtonpost.com',
  'wsj.com', 'ft.com', 'economist.com', 'cnn.com', 'abcnews.go.com',
  'cbsnews.com', 'nbcnews.com', 'usatoday.com', 'time.com', 'newsweek.com',
  'theatlantic.com', 'newyorker.com', 'foreignaffairs.com', 'foreignpolicy.com'
];

const FRINGE_KEYWORDS = [
  'conspiracy', 'cover-up', 'they don\'t want you to know', 'mainstream media',
  'deep state', 'false flag', 'hoax', 'fake news', 'wake up', 'sheeple',
  'illuminati', 'new world order', 'agenda', 'narrative', 'propaganda'
];

export function trackNarratives(headlines) {
  const narratives = {
    mainstream: [],
    fringe: [],
    crossings: [] // Fringe topics mentioned in mainstream
  };

  headlines.forEach(headline => {
    const url = headline.link || '';
    const domain = extractDomain(url);
    const text = `${headline.title} ${headline.description || ''}`.toLowerCase();
    
    const isMainstream = domain && MAINSTREAM_DOMAINS.some(md => domain.includes(md));
    const hasFringeKeywords = FRINGE_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));

    if (isMainstream && hasFringeKeywords) {
      narratives.crossings.push({
        headline,
        domain,
        matchedKeywords: FRINGE_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()))
      });
    } else if (hasFringeKeywords) {
      narratives.fringe.push({
        headline,
        domain,
        matchedKeywords: FRINGE_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()))
      });
    } else if (isMainstream) {
      narratives.mainstream.push(headline);
    }
  });

  return {
    mainstream: narratives.mainstream.length,
    fringe: narratives.fringe.length,
    crossings: narratives.crossings.slice(0, 10), // Top 10 crossings
    fringeSignals: narratives.fringe.slice(0, 10) // Top 10 fringe signals
  };
}

/**
 * Helper: Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Helper: Parse timestamp
 */
function parseTimestamp(dateString) {
  if (!dateString) return Date.now();
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
}
