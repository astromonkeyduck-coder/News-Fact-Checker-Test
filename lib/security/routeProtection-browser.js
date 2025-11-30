/**
 * Route Protection Utility (Browser-Compatible)
 * Handles security check redirects and verification
 * 
 * Usage: Include this script in protected pages before other content loads
 */

(function() {
  'use strict';
  
  // Protected routes configuration
  const PROTECTED_ROUTES = [
    "/game",
    "/game.html",
    "/geography-game.html",
    "/admin",
    "/admin-analytics.html",
    "/admin-newsletter.html",
    "/admin-add-tweets.html",
    "/dashboard",
    "/profile.html"
  ];
  
  /**
   * Check if a route is protected
   */
  function isProtectedRoute(pathname) {
    // Normalize pathname (remove leading/trailing slashes, query params, hash)
    const normalized = pathname.split('?')[0].split('#')[0].replace(/^\/|\/$/g, '');
    
    return PROTECTED_ROUTES.some(function(route) {
      const normalizedRoute = route.replace(/^\/|\/$/g, '').replace('.html', '');
      return normalized === normalizedRoute || normalized === normalizedRoute.replace('.html', '');
    });
  }
  
  /**
   * Check if user has been verified recently (within last 30 minutes)
   */
  function isVerified() {
    if (typeof sessionStorage === 'undefined') {
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
   * Get the redirect URL for security check
   */
  function getSecurityCheckUrl(originalPath) {
    const returnPath = encodeURIComponent(originalPath);
    return '/security-check.html?return=' + returnPath;
  }
  
  /**
   * Protect a route - redirect to security check if needed
   */
  function protectRoute() {
    const pathname = window.location.pathname;
    
    // Don't protect the security check page itself
    if (pathname.includes('security-check')) {
      return;
    }
    
    // Check if this route is protected
    if (!isProtectedRoute(pathname)) {
      return;
    }
    
    // Check if user is already verified
    if (isVerified()) {
      return;
    }
    
    // Redirect to security check
    const securityCheckUrl = getSecurityCheckUrl(pathname);
    window.location.href = securityCheckUrl;
  }
  
  // Initialize route protection
  // Run immediately if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', protectRoute);
  } else {
    // DOM already ready, run immediately
    protectRoute();
  }
  
  // Also expose functions globally for manual use if needed
  window.SecurityCheck = {
    protectRoute: protectRoute,
    isVerified: isVerified,
    isProtectedRoute: isProtectedRoute
  };
})();

