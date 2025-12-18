/**
 * AI Personalization Context
 * Retrieves and manages user-specific context for AI personalization
 * Stores: name, preferences, interests, communication style, past topics, etc.
 */

const { getStore } = require("@netlify/blobs");

/**
 * Get AI personalization context for a user
 * @param {string} userEmail - User's email (or IP if no email)
 * @param {string} userIP - User's IP address (for fallback identification)
 * @returns {Promise<Object>} Personalization context
 */
async function getAIPersonalization(userEmail, userIP = null) {
  try {
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return getDefaultContext();
    }

    const store = getStore({
      name: "analytics-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Try to get by email first
    let personalizationKey = null;
    if (userEmail && userEmail.includes('@')) {
      const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      personalizationKey = `${userKey}-ai-personalization`;
    } else if (userIP && userIP !== 'unknown' && !userIP.startsWith('127.') && !userIP.startsWith('192.168.')) {
      // Fallback to IP-based identification (less reliable, but better than nothing)
      const ipKey = `ip-${userIP.replace(/[^a-z0-9]/g, '-')}`;
      personalizationKey = `${ipKey}-ai-personalization`;
    }

    if (!personalizationKey) {
      return getDefaultContext();
    }

    try {
      const context = await store.get(personalizationKey, { type: "json" });
      if (context) {
        return {
          ...getDefaultContext(),
          ...context,
          lastUpdated: context.lastUpdated || new Date().toISOString(),
        };
      }
    } catch (e) {
      // No existing context, return default
    }

    return getDefaultContext();
  } catch (error) {
    console.error('[AI Personalization] Error getting context:', error);
    return getDefaultContext();
  }
}

/**
 * Update AI personalization context
 * @param {string} userEmail - User's email (or IP if no email)
 * @param {string} userIP - User's IP address
 * @param {Object} updates - Partial context updates
 */
async function updateAIPersonalization(userEmail, userIP, updates) {
  try {
    if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
      return { success: false, error: 'Storage not configured' };
    }

    const store = getStore({
      name: "analytics-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Determine key
    let personalizationKey = null;
    if (userEmail && userEmail.includes('@')) {
      const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      personalizationKey = `${userKey}-ai-personalization`;
    } else if (userIP && userIP !== 'unknown' && !userIP.startsWith('127.') && !userIP.startsWith('192.168.')) {
      const ipKey = `ip-${userIP.replace(/[^a-z0-9]/g, '-')}`;
      personalizationKey = `${ipKey}-ai-personalization`;
    }

    if (!personalizationKey) {
      return { success: false, error: 'Cannot determine user identifier' };
    }

    // Get existing context
    let context = await getAIPersonalization(userEmail, userIP);
    
    // Merge updates
    context = {
      ...context,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    // Save updated context
    await store.set(personalizationKey, JSON.stringify(context), {
      contentType: "application/json",
    });

    return { success: true, context };
  } catch (error) {
    console.error('[AI Personalization] Error updating context:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract personal information from conversation
 * This is called after AI responses to learn about the user
 */
async function learnFromConversation(userEmail, userIP, userMessage, aiResponse) {
  try {
    // Simple extraction patterns (in production, you might use NLP)
    const namePatterns = [
      /(?:my name is|i'm|i am|call me|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+here|$)/,
    ];
    
    const locationPatterns = [
      /(?:i (?:live|am) in|from|located in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    ];

    const interestPatterns = [
      /(?:i (?:like|love|enjoy|am interested in|am into)|interested in|passion for)\s+([^.!?]+)/i,
      /(?:my (?:hobby|interest|passion) is|hobbies are)\s+([^.!?]+)/i,
    ];

    let updates = {};

    // Extract name
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 1 && name.length < 50) {
          updates.name = name;
          break;
        }
      }
    }

    // Extract location
    for (const pattern of locationPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        if (location.length > 2 && location.length < 100) {
          if (!updates.locations) updates.locations = [];
          if (!updates.locations.includes(location)) {
            updates.locations.push(location);
          }
        }
      }
    }

    // Extract interests
    for (const pattern of interestPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        const interest = match[1].trim().replace(/[.!?]$/, '');
        if (interest.length > 2 && interest.length < 100) {
          if (!updates.interests) updates.interests = [];
          if (!updates.interests.includes(interest)) {
            updates.interests.push(interest);
          }
        }
      }
    }

    // Track conversation topics (simple keyword extraction)
    const topicKeywords = extractTopics(userMessage);
    if (topicKeywords.length > 0) {
      if (!updates.recentTopics) updates.recentTopics = [];
      updates.recentTopics = [...updates.recentTopics, ...topicKeywords].slice(-20); // Keep last 20 topics
    }

    // If we found any updates, save them
    if (Object.keys(updates).length > 0) {
      await updateAIPersonalization(userEmail, userIP, updates);
    }

    return { success: true, updates };
  } catch (error) {
    console.error('[AI Personalization] Error learning from conversation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract topic keywords from message
 */
function extractTopics(message) {
  // Simple keyword extraction (in production, use NLP)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  
  const words = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word))
    .slice(0, 5); // Top 5 keywords
  
  return words;
}

/**
 * Get default personalization context
 */
function getDefaultContext() {
  return {
    name: null,
    preferredName: null,
    locations: [],
    interests: [],
    recentTopics: [],
    communicationStyle: 'friendly', // friendly, formal, casual, professional
    preferences: {
      responseLength: 'medium', // short, medium, long
      detailLevel: 'medium', // basic, medium, detailed
      useExamples: true,
      useEmojis: true,
    },
    conversationCount: 0,
    firstInteraction: null,
    lastInteraction: null,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Build personalization system message for AI
 */
function buildPersonalizationSystemMessage(context) {
  if (!context || context.conversationCount === 0) {
    return `You are a helpful AI assistant. Be friendly, conversational, and helpful. If the user shares personal information (name, location, interests), remember it and use it naturally in future conversations.`;
  }

  let systemMessage = `You are a helpful AI assistant having a conversation with a user. `;

  // Add name if known
  if (context.name || context.preferredName) {
    const name = context.preferredName || context.name;
    systemMessage += `The user's name is ${name}. `;
  }

  // Add location if known
  if (context.locations && context.locations.length > 0) {
    const location = context.locations[context.locations.length - 1]; // Most recent
    systemMessage += `The user is from ${location}. `;
  }

  // Add interests if known
  if (context.interests && context.interests.length > 0) {
    systemMessage += `The user is interested in: ${context.interests.slice(0, 5).join(', ')}. `;
  }

  // Add recent topics
  if (context.recentTopics && context.recentTopics.length > 0) {
    const uniqueTopics = [...new Set(context.recentTopics)].slice(-5);
    systemMessage += `Recent conversation topics have included: ${uniqueTopics.join(', ')}. `;
  }

  // Add communication style
  systemMessage += `Match the user's communication style: ${context.communicationStyle || 'friendly'}. `;

  // Add preferences
  if (context.preferences) {
    if (context.preferences.responseLength) {
      systemMessage += `Keep responses ${context.preferences.responseLength}. `;
    }
    if (context.preferences.useEmojis === false) {
      systemMessage += `Avoid using emojis. `;
    }
  }

  systemMessage += `This is conversation #${context.conversationCount || 1}. Use the personal information naturally and conversationally - don't over-reference it. Be helpful, accurate, and engaging.`;

  return systemMessage;
}

exports.getAIPersonalization = getAIPersonalization;
exports.updateAIPersonalization = updateAIPersonalization;
exports.learnFromConversation = learnFromConversation;
exports.buildPersonalizationSystemMessage = buildPersonalizationSystemMessage;
exports.getDefaultContext = getDefaultContext;

