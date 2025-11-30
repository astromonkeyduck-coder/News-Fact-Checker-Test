/**
 * Security Check Configuration
 * Customize the security check screen appearance and behavior
 */

export const securityConfig = {
  // Main title
  title: "Checking your browser before accessing Noteworthy News",
  
  // Subtitle/description
  subtitle: "For security reasons, we're making sure this request is coming from a real person and not an automated system.",
  
  // Loading message shown below spinner
  loadingMessage: "This process usually takes just a few seconds.",
  
  // Estimated verification time in seconds (used for simulated verification)
  estimatedTime: 3,
  
  // Logo URL (relative to root or absolute)
  logoUrl: "/nw-logo.GIF", // Alternative: "/logo.svg" or "/NWSIGGG.png"
  
  // Whether to show "Contact us if this persists" link
  showContactLink: true,
  
  // Custom verification timeout (milliseconds)
  // Set to null to use estimatedTime
  customTimeout: null,
};

/**
 * Protected Routes Configuration
 * List of paths that require security check
 */
export const PROTECTED_ROUTES = [
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
 * @param {string} pathname - The pathname to check
 * @returns {boolean} - Whether the route is protected
 */
export function isProtectedRoute(pathname) {
  // Normalize pathname (remove leading/trailing slashes, query params, hash)
  const normalized = pathname.split('?')[0].split('#')[0].replace(/^\/|\/$/g, '');
  
  return PROTECTED_ROUTES.some(route => {
    const normalizedRoute = route.replace(/^\/|\/$/g, '').replace('.html', '');
    return normalized === normalizedRoute || normalized === normalizedRoute.replace('.html', '');
  });
}

/**
 * Get the redirect URL for security check
 * @param {string} originalPath - The original path the user was trying to access
 * @returns {string} - The security check URL with return path
 */
export function getSecurityCheckUrl(originalPath = '/') {
  const returnPath = encodeURIComponent(originalPath);
  return `/security-check.html?return=${returnPath}`;
}

