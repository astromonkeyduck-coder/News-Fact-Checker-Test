/**
 * HTML Sanitization Utility
 * Prevents XSS attacks when inserting user-generated content
 */

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for innerHTML
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize HTML string by removing dangerous tags and attributes
 * @param {string} html - HTML string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html, options = {}) {
  if (typeof html !== 'string') {
    return '';
  }
  
  const {
    allowedTags = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote'],
    allowedAttributes = {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title']
    }
  } = options;
  
  // Create a temporary container
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove script tags and event handlers
  const scripts = temp.querySelectorAll('script, style, iframe, object, embed, form, input');
  scripts.forEach(el => el.remove());
  
  // Remove dangerous attributes
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove all attributes
    Array.from(el.attributes).forEach(attr => {
      const tagName = el.tagName.toLowerCase();
      const allowed = allowedAttributes[tagName] || [];
      
      // Remove if not in allowed list or if it's an event handler
      if (!allowed.includes(attr.name.toLowerCase()) || 
          attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
    
    // Ensure href is safe (no javascript:)
    if (el.tagName.toLowerCase() === 'a' && el.href) {
      const href = el.getAttribute('href');
      if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
        el.removeAttribute('href');
      }
    }
  });
  
  return temp.innerHTML;
}

/**
 * Create a text node safely (preferred over innerHTML)
 * @param {string} text - Text content
 * @returns {Text} Text node
 */
export function createTextNode(text) {
  return document.createTextNode(String(text || ''));
}

/**
 * Set text content safely (preferred over innerHTML)
 * @param {HTMLElement} element - Element to set text on
 * @param {string} text - Text content
 */
export function setTextContent(element, text) {
  if (element && typeof text === 'string') {
    element.textContent = text;
  }
}

/**
 * Create element with text content (safe alternative to innerHTML)
 * @param {string} tagName - HTML tag name
 * @param {string} textContent - Text content
 * @param {Object} attributes - Attributes to set
 * @returns {HTMLElement} Created element
 */
export function createElement(tagName, textContent = '', attributes = {}) {
  const element = document.createElement(tagName);
  
  if (textContent) {
    element.textContent = textContent;
  }
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key.startsWith('on')) {
      // Skip event handlers for security
      return;
    }
    element.setAttribute(key, String(value));
  });
  
  return element;
}

