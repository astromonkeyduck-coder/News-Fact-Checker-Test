/**
 * Severity and Category Classification
 * Determines importance and type of events for map display
 */

/**
 * Category keyword dictionaries
 */
const CATEGORY_KEYWORDS = {
  conflict: [
    'war', 'conflict', 'invasion', 'invade', 'attack', 'strike', 'airstrike', 'drone strike',
    'military', 'defense', 'weapon', 'weapons', 'casualty', 'casualties', 'ceasefire', 'truce',
    'battle', 'combat', 'offensive', 'defensive', 'troops', 'soldiers', 'army', 'navy', 'air force',
    'missile', 'missiles', 'artillery', 'bombardment', 'shelling', 'siege', 'blockade',
    'rebel', 'rebellion', 'insurgent', 'insurgency', 'guerrilla', 'militia', 'paramilitary',
    'genocide', 'ethnic cleansing', 'massacre', 'atrocity', 'war crime', 'war crimes'
  ],
  
  terror: [
    'terror', 'terrorist', 'terrorism', 'terror attack', 'terrorist attack', 'bombing', 'bomb',
    'explosion', 'explosive', 'suicide bomber', 'suicide attack', 'car bomb', 'roadside bomb',
    'ied', 'improvised explosive device', 'hostage', 'hostages', 'kidnap', 'kidnapping',
    'mass shooting', 'shooting', 'gunman', 'gunmen', 'assassination', 'assassinate',
    'isis', 'isil', 'al-qaeda', 'al qaeda', 'taliban', 'boko haram', 'al-shabaab',
    'extremist', 'extremism', 'radical', 'radicalization'
  ],
  
  crime: [
    'murder', 'homicide', 'killing', 'killed', 'death', 'deaths', 'dead', 'fatality', 'fatalities',
    'shooting', 'gun violence', 'gang', 'gangs', 'cartel', 'cartels', 'drug trafficking',
    'human trafficking', 'smuggling', 'corruption', 'bribery', 'fraud', 'scam', 'scams',
    'robbery', 'theft', 'burglary', 'arson', 'riot', 'riots', 'looting', 'vandalism',
    'mass casualty', 'mass casualties', 'casualties', 'injured', 'wounded'
  ],
  
  disaster: [
    'earthquake', 'earthquakes', 'tsunami', 'tsunamis', 'volcano', 'volcanic', 'eruption',
    'wildfire', 'wildfires', 'forest fire', 'bushfire', 'flood', 'floods', 'flooding',
    'hurricane', 'hurricanes', 'typhoon', 'typhoons', 'cyclone', 'cyclones', 'tornado', 'tornadoes',
    'drought', 'famine', 'starvation', 'landslide', 'landslides', 'avalanche', 'avalanches',
    'blizzard', 'blizzards', 'snowstorm', 'ice storm', 'hailstorm', 'heat wave', 'heatwave',
    'cold snap', 'freeze', 'freezing', 'evacuation', 'evacuate', 'evacuated'
  ],
  
  weather: [
    'weather', 'storm', 'storms', 'rain', 'rainfall', 'snow', 'snowfall', 'wind', 'winds',
    'temperature', 'temperatures', 'heat', 'cold', 'freeze', 'frost', 'ice', 'hail',
    'thunderstorm', 'thunderstorms', 'lightning', 'tornado warning', 'hurricane warning',
    'flood warning', 'severe weather', 'extreme weather', 'weather alert', 'weather warning'
  ],
  
  cyber: [
    'cyber', 'cyberattack', 'cyber attack', 'hack', 'hacked', 'hacking', 'hacker', 'hackers',
    'ransomware', 'malware', 'virus', 'trojan', 'phishing', 'ddos', 'data breach', 'breach',
    'leak', 'leaked', 'leaking', 'vulnerability', 'vulnerabilities', 'exploit', 'exploited',
    'apt', 'advanced persistent threat', 'apt group', 'nation-state', 'state-sponsored',
    'critical infrastructure', 'power grid', 'water system', 'hospital system'
  ],
  
  health: [
    'outbreak', 'outbreaks', 'virus', 'viruses', 'pandemic', 'epidemic', 'disease', 'diseases',
    'ebola', 'covid', 'coronavirus', 'flu', 'influenza', 'bird flu', 'avian flu', 'swine flu',
    'quarantine', 'quarantined', 'isolation', 'vaccine', 'vaccination', 'vaccinated',
    'hospital', 'hospitals', 'medical', 'healthcare', 'health care', 'public health',
    'contagious', 'contagion', 'spread', 'spreading', 'infected', 'infection', 'infections'
  ],
  
  economy: [
    'crash', 'crashed', 'market crash', 'stock crash', 'economic crash', 'recession', 'depression',
    'default', 'defaulted', 'sanctions', 'sanction', 'sanctioned', 'embargo', 'embargoes',
    'oil spike', 'oil price', 'gas price', 'fuel price', 'energy crisis', 'power crisis',
    'bank run', 'bank runs', 'bank failure', 'bank failures', 'financial crisis',
    'inflation', 'hyperinflation', 'deflation', 'currency collapse', 'currency crisis',
    'trade war', 'trade dispute', 'tariff', 'tariffs', 'gdp', 'unemployment', 'layoffs'
  ],
  
  politics: [
    'coup', 'coup attempt', 'coup d\'état', 'military coup', 'government overthrow',
    'impeachment', 'impeach', 'impeached', 'election violence', 'election fraud', 'voter fraud',
    'protest', 'protests', 'demonstration', 'demonstrations', 'rally', 'rallies', 'march', 'marches',
    'riot', 'riots', 'unrest', 'civil unrest', 'civil war', 'revolution', 'rebellion',
    'dictator', 'dictatorship', 'authoritarian', 'authoritarianism', 'oppression', 'repression',
    'human rights', 'human rights violation', 'human rights violations', 'genocide', 'ethnic cleansing'
  ],
  
  nuclear: [
    'nuclear', 'nuke', 'nukes', 'atomic', 'atom bomb', 'atomic bomb', 'nuclear weapon',
    'nuclear weapons', 'icbm', 'intercontinental ballistic missile', 'ballistic missile',
    'nuclear facility', 'nuclear plant', 'nuclear power plant', 'nuclear reactor',
    'nuclear test', 'nuclear testing', 'radiation', 'radioactive', 'fallout',
    'nuclear accident', 'nuclear disaster', 'chernobyl', 'fukushima', 'three mile island'
  ]
};

/**
 * Severity 5 (CRITICAL) keywords
 */
const SEVERITY_5_KEYWORDS = [
  'nuclear', 'nuke', 'icbm', 'intercontinental ballistic missile', 'atomic bomb',
  'mass casualties', 'mass casualty', 'terror attack', 'terrorist attack', 'terrorism',
  'invasion', 'invade', 'war', 'genocide', 'ethnic cleansing', 'massacre', 'atrocity',
  'war crime', 'war crimes', 'coup', 'coup attempt', 'military coup', 'government overthrow',
  'hostage', 'hostages', 'nuclear accident', 'nuclear disaster', 'radiation leak',
  'pandemic', 'outbreak', 'epidemic', 'contagious', 'spreading rapidly'
];

/**
 * Severity 4 (HIGH) keywords
 */
const SEVERITY_4_KEYWORDS = [
  'attack', 'strike', 'airstrike', 'drone strike', 'missile', 'missiles', 'artillery',
  'bombing', 'bomb', 'explosion', 'explosive', 'casualty', 'casualties', 'killed', 'deaths',
  'conflict', 'battle', 'combat', 'offensive', 'defensive', 'troops', 'soldiers',
  'hurricane', 'typhoon', 'cyclone', 'tsunami', 'earthquake', 'volcanic eruption',
  'wildfire', 'flood', 'floods', 'evacuation', 'evacuate', 'evacuated',
  'cyberattack', 'cyber attack', 'data breach', 'critical infrastructure',
  'economic crash', 'market crash', 'recession', 'default', 'sanctions'
];

/**
 * Severity 3 (ELEVATED) keywords
 */
const SEVERITY_3_KEYWORDS = [
  'protest', 'protests', 'demonstration', 'demonstrations', 'rally', 'rallies',
  'unrest', 'civil unrest', 'riot', 'riots', 'looting', 'vandalism',
  'shooting', 'gun violence', 'murder', 'homicide', 'killing',
  'storm', 'storms', 'severe weather', 'extreme weather', 'weather warning',
  'hack', 'hacked', 'hacking', 'ransomware', 'malware', 'vulnerability',
  'outbreak', 'virus', 'disease', 'hospital', 'medical emergency'
];

/**
 * Calculate severity score (1-5) for a headline
 */
export function calculateSeverity(headline) {
  const text = `${headline.title || ''} ${headline.description || ''}`.toLowerCase();
  
  // Check for severity 5 keywords
  for (const keyword of SEVERITY_5_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return 5;
    }
  }
  
  // Check for severity 4 keywords
  for (const keyword of SEVERITY_4_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return 4;
    }
  }
  
  // Check for severity 3 keywords
  for (const keyword of SEVERITY_3_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return 3;
    }
  }
  
  // Check for multiple category keywords (indicates elevated importance)
  let categoryCount = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        categoryCount++;
        break; // Count each category only once
      }
    }
  }
  
  if (categoryCount >= 2) {
    return 3; // Multiple categories = elevated
  }
  
  if (categoryCount === 1) {
    return 2; // Single category = low
  }
  
  // Default: severity 1 (ignore on map by default)
  return 1;
}

/**
 * Classify category for a headline
 */
export function classifyCategory(headline) {
  const text = `${headline.title || ''} ${headline.description || ''}`.toLowerCase();
  
  // Check each category (order matters - more specific first)
  const categoryOrder = ['nuclear', 'terror', 'conflict', 'crime', 'disaster', 'cyber', 'health', 'economy', 'politics', 'weather'];
  
  for (const category of categoryOrder) {
    const keywords = CATEGORY_KEYWORDS[category] || [];
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return 'other';
}

/**
 * Extract topic tags from headline
 */
export function extractTopicTags(headline) {
  const tags = [];
  const text = `${headline.title || ''} ${headline.description || ''}`.toLowerCase();
  
  // Check for specific topic indicators
  if (text.includes('nuclear') || text.includes('nuke') || text.includes('atomic')) {
    tags.push('NUCLEAR');
  }
  
  if (text.includes('cyber') || text.includes('hack') || text.includes('breach')) {
    tags.push('CYBER');
  }
  
  if (text.includes('terror') || text.includes('terrorist') || text.includes('terrorism')) {
    tags.push('TERROR');
  }
  
  if (text.includes('conflict') || text.includes('war') || text.includes('battle')) {
    tags.push('CONFLICT');
  }
  
  if (text.includes('disaster') || text.includes('earthquake') || text.includes('hurricane') || text.includes('flood')) {
    tags.push('DISASTER');
  }
  
  if (text.includes('health') || text.includes('pandemic') || text.includes('outbreak')) {
    tags.push('HEALTH');
  }
  
  if (text.includes('economy') || text.includes('market') || text.includes('crash') || text.includes('recession')) {
    tags.push('ECONOMY');
  }
  
  if (text.includes('politics') || text.includes('election') || text.includes('coup')) {
    tags.push('POLITICS');
  }
  
  return tags;
}

/**
 * Extract region tags from headline
 */
export function extractRegionTags(headline, location = null) {
  const tags = [];
  const text = `${headline.title || ''} ${headline.description || ''}`.toLowerCase();
  
  // Region keywords
  const regions = {
    'EUROPE': ['europe', 'european', 'eu', 'european union', 'nato', 'eastern europe', 'western europe'],
    'MENA': ['middle east', 'mena', 'arab', 'arabic', 'gulf', 'persian gulf', 'levant', 'maghreb'],
    'ASIA': ['asia', 'asian', 'pacific', 'asia-pacific', 'east asia', 'south asia', 'southeast asia'],
    'AFRICA': ['africa', 'african', 'sub-saharan', 'north africa', 'west africa', 'east africa'],
    'AMERICAS': ['america', 'american', 'north america', 'south america', 'latin america', 'caribbean'],
    'OCEANIA': ['oceania', 'pacific islands', 'australasia', 'melanesia', 'polynesia', 'micronesia']
  };
  
  for (const [region, keywords] of Object.entries(regions)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        tags.push(region);
        break;
      }
    }
  }
  
  // Also check location if provided
  if (location && location.label) {
    const locationLower = location.label.toLowerCase();
    for (const [region, keywords] of Object.entries(regions)) {
      for (const keyword of keywords) {
        if (locationLower.includes(keyword.toLowerCase())) {
          if (!tags.includes(region)) {
            tags.push(region);
          }
          break;
        }
      }
    }
  }
  
  return tags;
}

/**
 * Check if multiple sources mention same topic (severity boost)
 */
export function checkMultiSourceMention(headlines, currentHeadline, timeWindow = 30 * 60 * 1000) {
  const currentTime = new Date(currentHeadline.timestamp || currentHeadline.pubDate || Date.now()).getTime();
  const currentText = `${currentHeadline.title || ''} ${currentHeadline.description || ''}`.toLowerCase();
  
  // Extract key terms from current headline
  const keyTerms = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (currentText.includes(keyword.toLowerCase())) {
        keyTerms.push(keyword.toLowerCase());
        break;
      }
    }
  }
  
  if (keyTerms.length === 0) return false;
  
  // Count matching headlines in time window
  let matchCount = 0;
  for (const headline of headlines) {
    if (headline === currentHeadline) continue;
    
    const headlineTime = new Date(headline.timestamp || headline.pubDate || Date.now()).getTime();
    const timeDiff = Math.abs(currentTime - headlineTime);
    
    if (timeDiff <= timeWindow) {
      const headlineText = `${headline.title || ''} ${headline.description || ''}`.toLowerCase();
      for (const term of keyTerms) {
        if (headlineText.includes(term)) {
          matchCount++;
          break;
        }
      }
    }
  }
  
  // If 3+ sources mention same topic within 30 minutes, boost severity
  return matchCount >= 3;
}
