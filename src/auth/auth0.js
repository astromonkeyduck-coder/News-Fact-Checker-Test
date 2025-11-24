/**
 * Auth0 Integration for Noteworthy News
 * Simple integration script - add this to your HTML after Auth0 SDK
 * 
 * Configuration:
 * Replace the auth0Config object values with your Auth0 credentials:
 * - domain: Your Auth0 domain (e.g., 'your-app.auth0.com')
 * - clientId: Your Auth0 Client ID
 * 
 * Get these from: https://manage.auth0.com/dashboard
 * 
 * IMPORTANT: To change the login message from "Log in to dev-u7a2ovr5jdmdwryp...":
 * 1. Go to Auth0 Dashboard: https://manage.auth0.com/dashboard
 * 2. Navigate to Applications → Your app → Settings
 * 3. Change "Application Name" to "Noteworthy News"
 * 4. Click "Save Changes"
 * 
 * For more customization, see: AUTH0_CUSTOMIZE_BRANDING.md
 */

// Auth0 Configuration
// CRITICAL: Never hardcode credentials in production code
// For production: Set AUTH0_DOMAIN and AUTH0_CLIENT_ID in Netlify Environment Variables
// These will be injected at build time via scripts/inject-auth0.js
// For local development: Create a .env.local file or set window.AUTH0_DOMAIN and window.AUTH0_CLIENT_ID

// Validate and get Auth0 configuration
function getAuth0Config() {
  const domain = window.AUTH0_DOMAIN;
  const clientId = window.AUTH0_CLIENT_ID;

  // Validate configuration exists - fail silently instead of throwing
  if (!domain || !clientId) {
    // Configuration missing - return null to fail silently
    return null;
  }

  // Validate domain format
  if (!domain.includes('.auth0.com') && !domain.includes('.us.auth0.com') && !domain.includes('.eu.auth0.com') && !domain.includes('.au.auth0.com')) {
    console.warn('[Auth0] Domain format might be incorrect. Expected format: your-domain.auth0.com');
  }

  return {
    domain: domain,
    clientId: clientId,
    authorizationParams: {
      redirect_uri: window.location.origin + window.location.pathname,
    },
    cacheLocation: 'localstorage',
    useRefreshTokens: false, // Disable refresh tokens for SPA
  };
}

let auth0Client = null;

/**
 * Initialize Auth0
 */
async function initAuth0() {
  try {
    console.log('[Auth0] Starting initialization...');
    console.log('[Auth0] Checking for SDK...', { 
      createAuth0Client: typeof createAuth0Client,
      auth0: typeof auth0,
      windowAuth0: typeof window.auth0,
      auth0SpaJs: typeof window.auth0SpaJs
    });
    
    // Wait for Auth0 SDK to load - check for createAuth0Client function
    // The Auth0 SPA SDK exposes createAuth0Client globally
    let retries = 50; // Increased retries
    while (
      typeof createAuth0Client === 'undefined' && 
      !(window.auth0SpaJs && typeof window.auth0SpaJs.createAuth0Client === 'function') &&
      !(window.auth0 && typeof window.auth0.createAuth0Client === 'function') &&
      retries > 0
    ) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }
    
    // Try different ways to get createAuth0Client
    let createClient = null;
    
    // Check global createAuth0Client (most common from CDN)
    if (typeof createAuth0Client !== 'undefined') {
      createClient = createAuth0Client;
      console.log('[Auth0] Using global createAuth0Client');
    }
    // Check window.auth0SpaJs.createAuth0Client (alternative CDN exposure)
    else if (window.auth0SpaJs && typeof window.auth0SpaJs.createAuth0Client === 'function') {
      createClient = window.auth0SpaJs.createAuth0Client;
      console.log('[Auth0] Using window.auth0SpaJs.createAuth0Client');
    }
    // Check window.auth0.createAuth0Client (fallback)
    else if (window.auth0 && typeof window.auth0.createAuth0Client === 'function') {
      createClient = window.auth0.createAuth0Client;
      console.log('[Auth0] Using window.auth0.createAuth0Client');
    }
    
    if (!createClient) {
      console.error('[Auth0] Auth0 SDK not loaded. Check:');
      console.error('[Auth0] 1. Script tag is before auth0.js');
      console.error('[Auth0] 2. CDN URL is correct');
      console.error('[Auth0] 3. Network connection is working');
      console.error('[Auth0] Current globals:', {
        createAuth0Client: typeof createAuth0Client,
        'window.auth0': typeof window.auth0,
        'window.auth0SpaJs': typeof window.auth0SpaJs,
        'auth0': typeof auth0
      });
      // Error notification suppressed
      return;
    }
    
    console.log('[Auth0] SDK loaded, creating client...');

    // Get and validate Auth0 configuration
    const auth0Config = getAuth0Config();
    
    // If config is missing, fail silently
    if (!auth0Config) {
      console.log('[Auth0] Configuration not available, skipping initialization');
      return;
    }
    
    // Create Auth0 client - createAuth0Client is available globally from the SDK
    auth0Client = await createClient(auth0Config);
    console.log('[Auth0] Client created successfully');

    // CRITICAL: Handle callback from Auth0 redirect
    // This MUST be called when authentication parameters are present in the URL
    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      try {
        console.log('[Auth0] Handling redirect callback...');
        console.log('[Auth0] Current URL:', window.location.href);
        console.log('[Auth0] Origin:', window.location.origin);
        
        // Handle the redirect callback - this processes the authentication response
        await auth0Client.handleRedirectCallback();
        console.log('[Auth0] Redirect callback handled successfully');
        
        // Clean up the URL to remove query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('[Auth0] Redirect callback error:', error);
        console.error('[Auth0] This usually means:');
        console.error('[Auth0] 1. Callback URL in Auth0 Dashboard doesn\'t match:', window.location.origin);
        console.error('[Auth0] 2. Client ID might be wrong');
        console.error('[Auth0] 3. Application type must be "Single Page Application"');
        console.error('[Auth0] 4. Allowed Web Origins must include:', window.location.origin);
        console.error('[Auth0] Please check your Auth0 Dashboard settings');
        
        // Error notification suppressed
        
        // Clear the URL params to prevent retrying
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Check if user is authenticated
    isAuthenticated = await auth0Client.isAuthenticated();
    
    if (isAuthenticated) {
      const user = await auth0Client.getUser();
      console.log('[Auth0] User authenticated:', user);
      updateAuthUI(user);
    } else {
      updateAuthUI(null);
    }

    // Make auth functions globally available
    window.auth0 = {
      login: login,
      signup: signup,
      logout: logout,
      getUser: getUser,
      getToken: getToken,
      isAuthenticated: () => auth0Client?.isAuthenticated() || false,
    };

    console.log('[Auth0] Initialized successfully');
    
    // Bind button events after initialization and UI update
    // Wait a bit to ensure DOM is ready
    setTimeout(async () => {
      await bindAuthButtons();
    }, 100);
  } catch (error) {
    console.error('[Auth0] Initialization error:', error);
    console.warn('[Auth0] Make sure you have:');
    console.warn('[Auth0] 1. Updated auth0Config with your domain and clientId');
    console.warn('[Auth0] 2. Added allowed callback URLs in Auth0 Dashboard');
    console.warn('[Auth0] 3. Added allowed logout URLs in Auth0 Dashboard');
    // Error notification suppressed
  }
}

// Store button handlers so we can remove them before adding new ones
let signinHandler = null;
let isAuthenticated = false;

/**
 * Bind click events to auth buttons
 */
async function bindAuthButtons() {
  console.log('[Auth0] Binding button events...');
  const signinBtn = document.getElementById('signinBtn');
  const signupBtn = document.getElementById('signupBtn');
  
  console.log('[Auth0] Found buttons:', { signinBtn: !!signinBtn, signupBtn: !!signupBtn });
  
  if (!signinBtn || !signupBtn) {
    console.warn('[Auth0] Buttons not found in DOM yet, retrying...');
    // Retry after a delay if buttons aren't found
    setTimeout(() => bindAuthButtons(), 500);
    return;
  }
  
  // Check actual auth state
  let currentAuthState = false;
  try {
    if (auth0Client) {
      currentAuthState = await auth0Client.isAuthenticated();
    }
  } catch (e) {
    console.log('[Auth0] Could not check auth state:', e);
  }
  
  console.log('[Auth0] Current auth state:', currentAuthState);
  
  // Remove old listeners if they exist
  if (signinBtn && signinHandler) {
    signinBtn.removeEventListener('click', signinHandler);
  }
  
  // Create new handlers based on actual auth state
  if (currentAuthState) {
    // Button does logout when authenticated
    signinHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Auth0] Logout button clicked');
      await logout();
    };
    // Hide sign-up button when authenticated
    if (signupBtn) {
      signupBtn.style.display = 'none';
    }
  } else {
    // Handler for login when not authenticated
    signinHandler = async (e) => {
      console.log('[Auth0] Sign In button clicked - handler triggered');
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      console.log('[Auth0] Calling login function...');
      try {
        await login();
      } catch (error) {
        console.error('[Auth0] Login error in handler:', error);
        alert('Login failed: ' + (error.message || 'Unknown error'));
      }
    };
    
    // Handler for sign-up
    const signupHandler = async (e) => {
      console.log('[Auth0] Sign Up button clicked');
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        await signup();
      } catch (error) {
        console.error('[Auth0] Signup error in handler:', error);
        alert('Sign up failed: ' + (error.message || 'Unknown error'));
      }
    };
    
    // Bind sign-up button
    if (signupBtn) {
      signupBtn.onclick = signupHandler;
      signupBtn.addEventListener('click', signupHandler);
      signupBtn.style.display = 'inline-block';
    }
  }
  
  // Simple direct binding - remove any existing handlers first
  if (signinBtn) {
    // Clear existing handlers
    signinBtn.replaceWith(signinBtn.cloneNode(true));
    const freshSigninBtn = document.getElementById('signinBtn');
    
    if (freshSigninBtn) {
      freshSigninBtn.onclick = signinHandler;
      freshSigninBtn.addEventListener('click', signinHandler);
      
      // Test that the handler works
      freshSigninBtn.addEventListener('click', () => {
        console.log('[Auth0] Sign In button click detected!');
      }, { once: true });
      
      console.log('[Auth0] Sign In button bound successfully');
    }
  } else {
    console.error('[Auth0] Sign In button not found in DOM!');
  }
  
  console.log('[Auth0] Button events bound successfully');
  
  // Debug: Verify buttons exist and have handlers
  setTimeout(() => {
    const verifySignin = document.getElementById('signinBtn');
    const verifySignup = document.getElementById('signupBtn');
    console.log('[Auth0] Button verification:', {
      signinExists: !!verifySignin,
      signinHasOnclick: verifySignin && verifySignin.onclick !== null,
      signupExists: !!verifySignup,
      signupHasOnclick: verifySignup && verifySignup.onclick !== null
    });
  }, 200);
}

/**
 * Login with Auth0
 */
async function login() {
  console.log('[Auth0] Login function called');
  
  // Ensure Auth0 client is initialized
  if (!auth0Client) {
    console.log('[Auth0] Client not initialized, initializing now...');
    try {
      await initAuth0();
    } catch (initError) {
      console.error('[Auth0] Initialization failed:', initError);
    }
  }
  
  if (!auth0Client) {
    console.error('[Auth0] Failed to initialize client');
    const errorMsg = 'Authentication service not available. Please refresh the page.';
    console.error('[Auth0]', errorMsg);
    // Error notification suppressed
    // alert('Unable to initialize authentication. Please refresh the page and try again.');
    return;
  }
  
  try {
    console.log('[Auth0] Redirecting to login...');
    console.log('[Auth0] Client state:', { 
      clientExists: !!auth0Client,
      hasLoginMethod: typeof auth0Client.loginWithRedirect === 'function'
    });
    
    // CRITICAL: authorizationParams with redirect_uri is required
    // The SDK uses this to know where to redirect after authentication
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'login',
        ui_locales: 'en',
        appState: {
          returnTo: window.location.href,
        },
      },
    });
    
    console.log('[Auth0] Login redirect initiated successfully');
  } catch (error) {
    console.error('[Auth0] Login error:', error);
    console.error('[Auth0] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    const errorMsg = error.message || 'Login failed. Please try again.';
    // Error notification suppressed
  }
}

/**
 * Sign up with Auth0
 */
async function signup() {
  console.log('[Auth0] Sign up function called');
  
  // Ensure Auth0 client is initialized
  if (!auth0Client) {
    console.log('[Auth0] Client not initialized, initializing now...');
    try {
      await initAuth0();
    } catch (initError) {
      console.error('[Auth0] Initialization failed:', initError);
    }
  }
  
  if (!auth0Client) {
    console.error('[Auth0] Failed to initialize client');
    const errorMsg = 'Authentication service not available. Please refresh the page.';
    console.error('[Auth0]', errorMsg);
    // Error notification suppressed
    // alert('Unable to initialize authentication. Please refresh the page and try again.');
    return;
  }
  
  try {
    console.log('[Auth0] Redirecting to sign up...');
    
    // CRITICAL: authorizationParams with redirect_uri is required
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
        ui_locales: 'en',
        appState: {
          returnTo: window.location.href,
        },
      },
    });
    
    console.log('[Auth0] Sign up redirect initiated successfully');
  } catch (error) {
    console.error('[Auth0] Sign up error:', error);
    console.error('[Auth0] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    const errorMsg = error.message || 'Sign up failed. Please try again.';
    // Error notification suppressed
  }
}


/**
 * Logout
 */
async function logout() {
  if (!auth0Client) return;
  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  } catch (error) {
    console.error('[Auth0] Logout error:', error);
    // Error notification suppressed
  }
}

/**
 * Get current user
 */
async function getUser() {
  if (!auth0Client) return null;
  try {
    return await auth0Client.getUser();
  } catch (error) {
    console.error('[Auth0] Get user error:', error);
    return null;
  }
}

/**
 * Get access token (for API calls)
 */
async function getToken() {
  if (!auth0Client) return null;
  try {
    return await auth0Client.getTokenSilently();
  } catch (error) {
    console.error('[Auth0] Get token error:', error);
    return null;
  }
}

/**
 * Update UI based on auth state
 */
async function updateAuthUI(user) {
  // Find auth buttons - update these selectors to match your HTML
  const signinBtn = document.getElementById('signinBtn');
  const authButtons = document.querySelectorAll('.auth-btn');

  // Update authentication state
  isAuthenticated = !!user;

  const signupBtn = document.getElementById('signupBtn');
  
  if (user) {
    // User is authenticated
    const displayName = user.name || user.nickname || user.email || 'User';
    const firstName = displayName.split(' ')[0];
    const userEmail = user.email || '';
    const userName = user.name || user.nickname || firstName;
    
    if (signinBtn) {
      // Update text while preserving event handlers
      const firstChild = signinBtn.firstChild;
      if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
        firstChild.textContent = `✓ ${firstName}`;
      } else {
        signinBtn.textContent = `✓ ${firstName}`;
      }
      signinBtn.style.background = 'linear-gradient(45deg, rgba(46, 204, 113, 0.2), rgba(39, 174, 96, 0.2))';
      signinBtn.style.borderColor = 'rgba(46, 204, 113, 0.6)';
      signinBtn.style.color = '#2ecc71';
      signinBtn.title = `Signed in as ${displayName}`;
    }
    
    // Hide sign-up button when authenticated
    if (signupBtn) {
      signupBtn.style.display = 'none';
    }
    
    // Add logged-in indicator to header
    document.body.setAttribute('data-user-logged-in', 'true');
    document.body.setAttribute('data-user-name', firstName);
    document.body.setAttribute('data-user-email', userEmail);
    
    // Show profile link
    const profileLink = document.getElementById('profileLink');
    const mobileProfileLink = document.getElementById('mobileProfileLink');
    if (profileLink) profileLink.style.display = 'inline-block';
    if (mobileProfileLink) mobileProfileLink.style.display = 'block';
    
    // Auto-fill forms with user info
    autoFillUserForms(userName, userEmail);

    // Update any auth buttons
    authButtons.forEach(btn => {
      if (btn.dataset.action === 'logout') {
        btn.style.display = 'inline-block';
      } else if (btn.dataset.action === 'login') {
        btn.style.display = 'none';
      }
    });
  } else {
    // User is not authenticated
    if (signinBtn) {
      // Update text while preserving event handlers
      const firstChild = signinBtn.firstChild;
      if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
        firstChild.textContent = 'Sign In';
      } else {
        signinBtn.textContent = 'Sign In';
      }
      signinBtn.style.background = '';
      signinBtn.style.borderColor = '';
      signinBtn.style.color = '';
      signinBtn.title = '';
    }
    
    // Show sign-up button when not authenticated
    if (signupBtn) {
      signupBtn.style.display = 'inline-block';
    }
    
    // Remove logged-in indicator
    document.body.removeAttribute('data-user-logged-in');
    document.body.removeAttribute('data-user-name');
    
    // Hide profile link
    const profileLink = document.getElementById('profileLink');
    const mobileProfileLink = document.getElementById('mobileProfileLink');
    if (profileLink) profileLink.style.display = 'none';
    if (mobileProfileLink) mobileProfileLink.style.display = 'none';

    // Update any auth buttons
    authButtons.forEach(btn => {
      if (btn.dataset.action === 'logout') {
        btn.style.display = 'none';
      } else if (btn.dataset.action === 'login') {
        btn.style.display = 'inline-block';
      }
    });
  }
  
  // Rebind buttons after UI update
  setTimeout(async () => {
    await bindAuthButtons();
  }, 50);
}

/**
 * Auto-fill forms with user information when logged in
 */
function autoFillUserForms(userName, userEmail) {
  // Auto-fill tip form
  const tipNameInput = document.getElementById('tipName');
  const tipEmailInput = document.getElementById('tipEmail');
  if (tipNameInput && userName) {
    tipNameInput.value = userName;
  }
  if (tipEmailInput && userEmail) {
    tipEmailInput.value = userEmail;
  }
  
  // Auto-fill newsletter form
  const newsletterInputs = document.querySelectorAll('input[type="email"][placeholder*="newsletter"], input[type="email"][placeholder*="Email"], .newsletter-input[type="email"]');
  newsletterInputs.forEach(input => {
    if (userEmail && !input.value) {
      input.value = userEmail;
    }
  });
  
  // Store user info globally for later use
  window.currentUser = {
    name: userName,
    email: userEmail
  };
  
  console.log('[Auth0] Forms auto-filled with user info');
}

/**
 * Show notification - DISABLED
 */
function showAuthNotification(message, type = 'info') {
  // All notifications suppressed - do nothing
  return;
}

// Initialize when DOM is ready
function startAuth0() {
  // Wait a moment for all scripts to load, especially the Auth0 SDK
  setTimeout(async () => {
    await initAuth0();
    // Bind buttons after initialization
    setTimeout(async () => {
      await bindAuthButtons();
    }, 300);
  }, 300);
  
  // Also try binding buttons after a delay as fallback
  setTimeout(async () => {
    const signinBtn = document.getElementById('signinBtn');
    if (signinBtn && !signinHandler) {
      console.log('[Auth0] Fallback: Binding buttons again...');
      await bindAuthButtons();
    }
  }, 1500);
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAuth0);
} else {
  startAuth0();
}

// Also try on window load as a final fallback
window.addEventListener('load', async () => {
  const signinBtn = document.getElementById('signinBtn');
  if (signinBtn && !signinBtn.onclick && !signinHandler) {
    console.log('[Auth0] Window load fallback: Initializing...');
    if (!auth0Client) {
      await initAuth0();
    }
    await bindAuthButtons();
  }
});

// Export for use - make sure these are always available
window.initAuth0 = initAuth0;
window.auth0Login = login;
window.auth0Logout = logout;

// Also expose directly for inline handlers
window.login = login;
window.signup = signup;
window.logout = logout;

