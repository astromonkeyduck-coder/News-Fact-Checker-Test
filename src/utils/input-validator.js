/**
 * Input Validation Utility
 * Provides comprehensive input validation and sanitization
 * 
 * Usage:
 *   import { validateEmail, sanitizeInput } from './input-validator';
 *   const email = validateEmail(userInput);
 *   const safe = sanitizeInput(userInput);
 */

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long (max 254 characters)' };
  }

  // RFC 5322 compliant regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {Object} - { valid: boolean, error?: string, value?: string }
 */
export function validateURL(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'URL cannot be empty' };
  }

  try {
    const urlObj = new URL(trimmed);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }

    return { valid: true, value: trimmed };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitize HTML input to prevent XSS
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const {
    allowHTML = false,
    maxLength = 10000,
    trim = true
  } = options;

  let sanitized = input;

  // Trim if requested
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // If HTML is not allowed, escape HTML entities
  if (!allowHTML) {
    const div = document.createElement('div');
    div.textContent = sanitized;
    sanitized = div.innerHTML;
  }

  return sanitized;
}

/**
 * Validate and sanitize text input
 * @param {string} text - Text to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { valid: boolean, error?: string, value?: string }
 */
export function validateText(text, options = {}) {
  const {
    required = true,
    minLength = 0,
    maxLength = 10000,
    pattern = null,
    trim = true
  } = options;

  if (!text || typeof text !== 'string') {
    if (required) {
      return { valid: false, error: 'This field is required' };
    }
    return { valid: true, value: '' };
  }

  let processed = text;
  if (trim) {
    processed = processed.trim();
  }

  if (required && processed.length === 0) {
    return { valid: false, error: 'This field is required' };
  }

  if (processed.length < minLength) {
    return { valid: false, error: `Must be at least ${minLength} characters` };
  }

  if (processed.length > maxLength) {
    return { valid: false, error: `Must be no more than ${maxLength} characters` };
  }

  if (pattern && !pattern.test(processed)) {
    return { valid: false, error: 'Invalid format' };
  }

  return { valid: true, value: processed };
}

/**
 * Validate chat message input
 * @param {string} message - Chat message
 * @returns {Object} - { valid: boolean, error?: string, value?: string }
 */
export function validateChatMessage(message) {
  return validateText(message, {
    required: true,
    minLength: 1,
    maxLength: 2000,
    trim: true
  });
}

/**
 * Validate search query
 * @param {string} query - Search query
 * @returns {Object} - { valid: boolean, error?: string, value?: string }
 */
export function validateSearchQuery(query) {
  return validateText(query, {
    required: false,
    minLength: 0,
    maxLength: 200,
    trim: true
  });
}

/**
 * Validate image generation prompt
 * @param {string} prompt - Image generation prompt
 * @returns {Object} - { valid: boolean, error?: string, value?: string }
 */
export function validateImagePrompt(prompt) {
  const result = validateText(prompt, {
    required: true,
    minLength: 3,
    maxLength: 500,
    trim: true
  });

  if (!result.valid) {
    return result;
  }

  // Check for potentially harmful content
  const blockedPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(result.value)) {
      return { valid: false, error: 'Invalid characters in prompt' };
    }
  }

  return result;
}

/**
 * Validate API request body
 * @param {Object} body - Request body
 * @param {Object} schema - Validation schema
 * @returns {Object} - { valid: boolean, errors?: Object, data?: Object }
 */
export function validateRequestBody(body, schema) {
  const errors = {};
  const data = {};

  for (const [key, validator] of Object.entries(schema)) {
    const value = body[key];
    const result = validator(value);

    if (!result.valid) {
      errors[key] = result.error;
    } else {
      data[key] = result.value;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data };
}

/**
 * Sanitize URL for safe insertion into HTML attributes (href, src)
 * Validates URL and escapes special characters
 * @param {string} url - URL to sanitize
 * @returns {string|null} - Sanitized URL or null if invalid
 */
export function sanitizeURLForHTML(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const urlObj = new URL(trimmed);
    
    // Only allow http and https protocols (prevent javascript:, data:, etc.)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    // Escape special characters for HTML attribute insertion
    // This prevents breaking out of attributes with quotes or other characters
    return trimmed
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  } catch (e) {
    // Invalid URL format
    return null;
  }
}

/**
 * Rate limit validation (client-side check)
 * @param {string} action - Action identifier
 * @param {number} maxAttempts - Maximum attempts
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} - { allowed: boolean, retryAfter?: number }
 */
export function checkClientRateLimit(action, maxAttempts = 5, windowMs = 60000) {
  const key = `rateLimit_${action}`;
  const now = Date.now();
  
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify({
      count: 1,
      resetTime: now + windowMs
    }));
    return { allowed: true };
  }

  const data = JSON.parse(stored);
  
  if (now > data.resetTime) {
    // Window expired, reset
    localStorage.setItem(key, JSON.stringify({
      count: 1,
      resetTime: now + windowMs
    }));
    return { allowed: true };
  }

  if (data.count >= maxAttempts) {
    const retryAfter = Math.ceil((data.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  data.count++;
  localStorage.setItem(key, JSON.stringify(data));
  
  return { allowed: true };
}

// Export all validators
export default {
  validateEmail,
  validateURL,
  sanitizeURLForHTML,
  sanitizeInput,
  validateText,
  validateChatMessage,
  validateSearchQuery,
  validateImagePrompt,
  validateRequestBody,
  checkClientRateLimit
};

