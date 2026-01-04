/**
 * Shared user validation utilities for Netlify functions
 * Used by leaderboard.js and comments-api.js
 */

/**
 * Validate user name with profanity and spam filtering
 * Returns { valid: boolean, error?: string, cleaned?: string }
 */
function validateUserName(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { 
      valid: false, 
      error: "Name cannot be empty. Please enter a valid name." 
    };
  }

  // Normalize text (lowercase, remove special characters for checking)
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");

  // List of inappropriate words/phrases (common profanity and offensive terms)
  const inappropriateWords = [
    "fuck", "shit", "damn", "bitch", "asshole", "bastard", "cunt", "dick",
    "piss", "crap", "hell", "slut", "whore", "retard", "nigger", "nigga",
    "fag", "faggot", "kike", "spic", "chink", "gook", "towelhead", "terrorist",
    "nazi", "hitler", "kill", "murder", "death", "suicide", "rape", "sex",
    "porn", "xxx", "adult", "nsfw", "penis", "vagina", "boob", "tits",
    "cock", "pussy", "cum", "jizz", "orgasm", "masturbat", "ejaculat",
    "scam", "spam", "hack", "virus", "malware", "phishing", "fraud",
    "admin", "moderator", "owner", "founder", "official", "noteworthy",
    "breakingnews", "breaking", "news", "noteworthynews",
    // Additional slurs and offensive terms
    "tranny", "shemale", "dyke", "lesbo", "queer", "homo", "fudgepacker",
    "coon", "spook", "wetback", "beaner", "gyp", "jap", "chink", "gook",
    "towelhead", "sandnigger", "raghead", "paki", "zipperhead", "slant",
    "mongoloid", "spaz", "cripple", "gimp", "midget", "retard"
  ];

  // Check for inappropriate words
  for (const word of inappropriateWords) {
    if (normalized.includes(word)) {
      return { 
        valid: false, 
        error: "Name contains inappropriate content. Please choose a different name." 
      };
    }
  }

  // Check for excessive special characters or numbers (likely spam)
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  const numberCount = (text.match(/[0-9]/g) || []).length;
  if (specialCharCount > text.length * 0.3 || numberCount > text.length * 0.5) {
    return { 
      valid: false, 
      error: "Name contains too many special characters or numbers. Please use a more appropriate name." 
    };
  }

  // Trim and limit length
  let cleaned = text.trim();
  if (cleaned.length > 30) {
    return { 
      valid: false, 
      error: "Name is too long. Please use a name with 30 characters or less." 
    };
  }
  
  if (cleaned.length === 0) {
    return { 
      valid: false, 
      error: "Name cannot be empty. Please enter a valid name." 
    };
  }

  return { valid: true, cleaned: cleaned };
}

module.exports = {
  validateUserName
};


























