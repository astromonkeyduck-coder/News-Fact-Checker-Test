/**
 * Reading Time Utility
 * Calculates reading time for articles and posts
 * 
 * Usage:
 *   const time = calculateReadingTime(text);
 *   // Returns: { minutes: 5, text: "5 min read" }
 */

/**
 * Calculate reading time from text
 * @param {string} text - The text to calculate reading time for
 * @param {number} wordsPerMinute - Average reading speed (default: 200)
 * @returns {object} - { minutes: number, text: string }
 */
export function calculateReadingTime(text, wordsPerMinute = 200) {
  if (!text || typeof text !== 'string') {
    return { minutes: 1, text: '1 min read' };
  }

  // Remove HTML tags if present
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Count words
  const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;
  
  // Calculate minutes (always round up, minimum 1)
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  
  // Format text
  const textFormatted = minutes === 1 ? '1 min read' : `${minutes} min read`;
  
  return { minutes, text: textFormatted };
}

/**
 * Calculate reading time from HTML element
 * @param {HTMLElement|string} element - Element or selector
 * @returns {object} - { minutes: number, text: string }
 */
export function calculateReadingTimeFromElement(element) {
  if (typeof element === 'string') {
    element = document.querySelector(element);
  }
  
  if (!element) {
    return { minutes: 1, text: '1 min read' };
  }
  
  // Get all text content from the element
  const text = element.innerText || element.textContent || '';
  return calculateReadingTime(text);
}

// Make available globally for non-module usage
if (typeof window !== 'undefined') {
  window.calculateReadingTime = calculateReadingTime;
  window.calculateReadingTimeFromElement = calculateReadingTimeFromElement;
}

