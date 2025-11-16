/**
 * Image Optimization Utilities
 * Handles lazy loading, responsive images, and WebP support
 */

/**
 * Initialize lazy loading for all images
 * Adds loading="lazy" and Intersection Observer for older browsers
 */
export function initLazyLoading() {
  // Modern browsers support native lazy loading
  const images = document.querySelectorAll('img:not([loading])');
  
  images.forEach((img) => {
    // Skip if already has loading attribute
    if (img.hasAttribute('loading')) return;
    
    // Skip if image is already in viewport (above the fold)
    if (isAboveFold(img)) {
      return;
    }
    
    // Use native lazy loading if supported
    if ('loading' in HTMLImageElement.prototype) {
      img.loading = 'lazy';
    } else {
      // Fallback to Intersection Observer for older browsers
      useIntersectionObserver(img);
    }
  });
}

/**
 * Check if element is above the fold (visible without scrolling)
 */
function isAboveFold(element) {
  const rect = element.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/**
 * Use Intersection Observer for lazy loading (fallback)
 */
function useIntersectionObserver(img) {
  if (!window.IntersectionObserver) {
    // Very old browser - just load the image
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const image = entry.target;
        if (image.dataset.src) {
          image.src = image.dataset.src;
          image.removeAttribute('data-src');
        }
        observer.unobserve(image);
      }
    });
  }, {
    rootMargin: '50px' // Start loading 50px before image enters viewport
  });

  // Store original src in data-src
  if (img.src && !img.dataset.src) {
    img.dataset.src = img.src;
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E'; // 1x1 transparent placeholder
  }

  observer.observe(img);
}

/**
 * Convert image to WebP format if supported
 * @param {string} imageUrl - Original image URL
 * @returns {string} - WebP URL or original if not supported
 */
export function getWebPImage(imageUrl) {
  if (!imageUrl) return imageUrl;
  
  // Check if browser supports WebP
  if (!supportsWebP()) {
    return imageUrl;
  }
  
  // If already WebP, return as is
  if (imageUrl.endsWith('.webp')) {
    return imageUrl;
  }
  
  // For now, return original (you'd need server-side conversion)
  // In production, you'd replace extension or use a CDN that converts
  return imageUrl;
}

/**
 * Check if browser supports WebP
 */
function supportsWebP() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Create responsive image srcset
 * @param {string} baseUrl - Base image URL
 * @param {number[]} widths - Array of widths (e.g., [400, 800, 1200])
 * @returns {string} - srcset string
 */
export function createSrcSet(baseUrl, widths = [400, 800, 1200, 1600]) {
  return widths
    .map((width) => `${baseUrl}?w=${width} ${width}w`)
    .join(', ');
}

/**
 * Optimize image element with responsive attributes
 * @param {HTMLImageElement} img - Image element
 * @param {Object} options - Options object
 */
export function optimizeImage(img, options = {}) {
  const {
    srcset,
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    loading = 'lazy',
    decoding = 'async'
  } = options;

  if (srcset) {
    img.srcset = srcset;
    img.sizes = sizes;
  }

  if ('loading' in HTMLImageElement.prototype) {
    img.loading = loading;
  }

  if ('decoding' in HTMLImageElement.prototype) {
    img.decoding = decoding;
  }
}

/**
 * Preload critical images
 * @param {string[]} imageUrls - Array of image URLs to preload
 */
export function preloadImages(imageUrls) {
  imageUrls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoading);
  } else {
    initLazyLoading();
  }
}

