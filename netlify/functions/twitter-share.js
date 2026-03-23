/**
 * Dynamic Twitter Share URL Generator
 * Calculates relative time when the share button is clicked (not when email is sent)
 * 
 * GET /.netlify/functions/twitter-share?magnitude=X&location=Y&eventId=Z&timestamp=ISO
 * Redirects to Twitter with current relative time
 */

const { getPostStore, readPost } = require("./lib/postStore");

/**
 * Format relative time like "2 minutes and 36 seconds ago"
 */
function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 0) {
    return 'just now';
  }
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    const remainingMinutes = Math.floor((diffMs % 3600000) / 60000);
    if (remainingMinutes > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    const remainingSeconds = Math.floor((diffMs % 60000) / 1000);
    if (remainingSeconds > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} ago`;
    }
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''} ago`;
  }
}

/**
 * Get earthquake hashtags based on location
 * (Matches implementation in send-earthquake-alert.js)
 */
function getEarthquakeHashtags(location, locationDetails = null) {
  if (!location) return '#terremoto #地震 #earthquake';
  
  const locationLower = location.toLowerCase();
  const hashtags = [];
  
  // Language mapping based on location
  const languageMap = {
    // Spanish-speaking countries/regions
    'mexico': '#terremoto', 'méxico': '#terremoto', 'spain': '#terremoto', 'españa': '#terremoto',
    'chile': '#terremoto', 'peru': '#terremoto', 'perú': '#terremoto', 'colombia': '#terremoto',
    'argentina': '#terremoto', 'ecuador': '#terremoto', 'guatemala': '#terremoto', 'honduras': '#terremoto',
    'nicaragua': '#terremoto', 'el salvador': '#terremoto', 'costa rica': '#terremoto', 'panama': '#terremoto',
    'panamá': '#terremoto', 'venezuela': '#terremoto', 'bolivia': '#terremoto', 'paraguay': '#terremoto',
    'uruguay': '#terremoto', 'dominican republic': '#terremoto', 'puerto rico': '#terremoto', 'california': '#terremoto',
    // Japanese regions
    'japan': '#地震', 'tokyo': '#地震', 'osaka': '#地震', 'kyoto': '#地震', 'hokkaido': '#地震', 'okinawa': '#地震',
    // Chinese-speaking regions
    'china': '#地震', 'taiwan': '#地震', 'hong kong': '#地震', 'beijing': '#地震', 'shanghai': '#地震',
    // French-speaking regions
    'france': '#séisme', 'haiti': '#séisme', 'quebec': '#séisme',
    // Portuguese-speaking regions
    'brazil': '#terremoto', 'brasil': '#terremoto', 'portugal': '#terremoto',
    // Italian
    'italy': '#terremoto', 'italia': '#terremoto',
    // Turkish
    'turkey': '#deprem', 'türkiye': '#deprem',
    // Greek
    'greece': '#σεισμός',
    // Indonesian
    'indonesia': '#gempa', 'jakarta': '#gempa',
    // Filipino
    'philippines': '#lindol', 'manila': '#lindol',
    // Arabic
    'saudi arabia': '#زلزال', 'uae': '#زلزال', 'egypt': '#زلزال',
    // Russian
    'russia': '#землетрясение', 'moscow': '#землетрясение',
    // Korean
    'south korea': '#지진', 'korea': '#지진', 'seoul': '#지진',
    // Hindi/Urdu
    'india': '#भूकंप', 'pakistan': '#زلزلہ',
    // Vietnamese
    'vietnam': '#độngđất',
    // Thai
    'thailand': '#แผ่นดินไหว', 'bangkok': '#แผ่นดินไหว'
  };
  
  // Find matching language
  let relevantTag = null;
  for (const [key, tag] of Object.entries(languageMap)) {
    if (locationLower.includes(key)) {
      relevantTag = tag;
      break;
    }
  }
  
  // Always include universal tags
  hashtags.push('#terremoto', '#地震');
  
  // Add location-specific tag if found
  if (relevantTag && !hashtags.includes(relevantTag)) {
    hashtags.push(relevantTag);
  } else if (!relevantTag) {
    hashtags.push('#earthquake');
  }
  
  // Add location-specific hashtags (city, state, country)
  if (locationDetails) {
    // City hashtag (if available and not too long)
    if (locationDetails.city && locationDetails.city.length < 20) {
      const cityTag = `#${locationDetails.city.replace(/\s+/g, '')}`;
      if (!hashtags.includes(cityTag)) {
        hashtags.push(cityTag);
      }
    }
    
    // State/region hashtag
    if (locationDetails.state && locationDetails.state.length < 25) {
      const stateTag = `#${locationDetails.state.replace(/\s+/g, '')}`;
      if (!hashtags.includes(stateTag)) {
        hashtags.push(stateTag);
      }
    }
  }
  
  return hashtags.join(' ');
}

/**
 * Build share text with hashtags
 */
function getShareTextWithHashtags(magnitude, location, earthquake = {}, relativeTime = null) {
  const magnitudeFormatted = typeof magnitude === 'number' ? magnitude.toFixed(1) : magnitude;
  const locationDetails = earthquake.locationDetails || null;
  
  let message;
  if (relativeTime) {
    message = `BREAKING: M${magnitudeFormatted} Earthquake Near ${location}, ${relativeTime}.`;
  } else {
    message = `BREAKING: M${magnitudeFormatted} Earthquake Near ${location}.`;
  }
  
  const hashtags = getEarthquakeHashtags(location, locationDetails);
  message += `\n\n${hashtags}`;
  
  // Trim if too long
  const estimatedLength = message.length + 23;
  if (estimatedLength > 250) {
    const hashtagArray = hashtags.split(' ').slice(0, 4);
    const trimmedHashtags = hashtagArray.join(' ');
    message = message.replace(hashtags, trimmedHashtags);
  }
  
  return message;
}

exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};
  
  // Required parameters
  const magnitude = parseFloat(params.magnitude);
  const location = params.location;
  const timestamp = params.timestamp; // ISO timestamp of earthquake
  const eventId = params.eventId;
  
  if (!magnitude || !location || !timestamp) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Missing required parameters: magnitude, location, timestamp'
    };
  }
  
  try {
    // Calculate relative time NOW (when share button is clicked)
    const relativeTime = formatRelativeTime(timestamp);
    
    // Get location details from post if eventId provided
    let locationDetails = null;
    if (eventId) {
      try {
        const store = getPostStore();
        const post = await readPost(store, `usgs-${eventId}`);
        if (post) {
          locationDetails = post.locationDetails || null;
        }
      } catch (error) {
        console.warn('[twitter-share] Could not fetch location details:', error.message);
      }
    }
    
    // Build share text with CURRENT relative time
    const shareText = getShareTextWithHashtags(magnitude, location, { locationDetails }, relativeTime);
    
    // Build article URL
    const articleUrl = `https://noteworthynews.co/article.html?id=post-usgs-${eventId || 'unknown'}&utm_source=email&utm_medium=share&utm_campaign=earthquake_alert`;
    
    // Build Twitter share URL
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(articleUrl)}`;
    
    // Redirect to Twitter
    return {
      statusCode: 302,
      headers: {
        'Location': twitterUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: ''
    };
    
  } catch (error) {
    console.error('[twitter-share] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Internal server error'
    };
  }
};
