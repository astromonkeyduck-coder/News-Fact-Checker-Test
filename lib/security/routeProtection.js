/**
 * Route Protection Utility
 * Handles security check redirects and verification
 */

import { isProtectedRoute, getSecurityCheckUrl } from './securityConfig.js';

/**
 * Check if user has been verified recently (within last 30 minutes)
 * @returns {boolean} - Whether the user is verified
 */
export function isVerified() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return false;
  }
  
  const verified = sessionStorage.getItem('security-check-verified');
  const timestamp = sessionStorage.getItem('security-check-timestamp');
  
  if (!verified || verified !== 'true' || !timestamp) {
    return false;
  }
  
  // Check if verification is still valid (30 minutes)
  const verificationAge = Date.now() - parseInt(timestamp, 10);
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  if (verificationAge > maxAge) {
    // Expired, clear it
    sessionStorage.removeItem('security-check-verified');
    sessionStorage.removeItem('security-check-timestamp');
    return false;
  }
  
  return true;
}

/**
 * Protect a route - redirect to security check if needed
 * Call this at the start of protected pages
 * 
 * @param {string} currentPath - Current pathname (defaults to window.location.pathname)
 * @returns {boolean} - true if protected and should redirect, false otherwise
 */
export function protectRoute(currentPath = null) {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const pathname = currentPath || window.location.pathname;
  
  // Check if this route is protected
  if (!isProtectedRoute(pathname)) {
    return false;
  }
  
  // Check if user is already verified
  if (isVerified()) {
    return false;
  }
  
  // Redirect to security check
  const securityCheckUrl = getSecurityCheckUrl(pathname);
  window.location.href = securityCheckUrl;
  return true;
}

/**
 * Initialize route protection on page load
 * Call this in a script tag at the top of protected pages
 */
export function initRouteProtection() {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      protectRoute();
    });
  } else {
    protectRoute();
  }
}

// Auto-initialize if this is a protected route (when loaded as a module)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Only auto-init if we're not already on the security check page
  if (!window.location.pathname.includes('security-check')) {
    initRouteProtection();
  }
}

