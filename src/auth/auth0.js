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
// For production: Set AUTH0_DOMAIN and AUTH0_CLIENT_ID in Netlify Environment Variables
// These will be injected at build time via scripts/inject-auth0.js
// For local development: Falls back to development credentials (not recommended for production)
const auth0Config = {
  domain: window.AUTH0_DOMAIN || 'dev-u7a2ovr5jdmdwryp.us.auth0.com',
  clientId: window.AUTH0_CLIENT_ID || 'LTAU4cZtZFsG8DqK2SbPoAKiYt14bCER',
  authorizationParams: {
    redirect_uri: window.location.origin + window.location.pathname,
  },
  cacheLocation: 'localstorage',
  useRefreshTokens: false, // Disable refresh tokens for SPA
};

// Warn if using development credentials in production
if (!window.AUTH0_DOMAIN || !window.AUTH0_CLIENT_ID) {
  console.warn('[Auth0] ⚠️ Using development credentials. Set AUTH0_DOMAIN and AUTH0_CLIENT_ID environment variables in Netlify for production.');
  console.warn('[Auth0] This warning will disappear once production credentials are configured.');
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
      showAuthNotification('Auth0 SDK failed to load. Please refresh the page.', 'error');
      return;
    }
    
    console.log('[Auth0] SDK loaded, creating client...');

    // Create Auth0 client - createAuth0Client is available globally from the SDK
    auth0Client = await createClient(auth0Config);
    console.log('[Auth0] Client created successfully');

    // Handle callback from Auth0 redirect
    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      try {
        console.log('[Auth0] Handling redirect callback...');
        console.log('[Auth0] Current URL:', window.location.href);
        console.log('[Auth0] Origin:', window.location.origin);
        await auth0Client.handleRedirectCallback();
        console.log('[Auth0] Redirect callback handled successfully');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('[Auth0] Redirect callback error:', error);
        console.error('[Auth0] This usually means:');
        console.error('[Auth0] 1. Callback URL in Auth0 Dashboard doesn\'t match:', window.location.origin);
        console.error('[Auth0] 2. Client ID might be wrong');
        console.error('[Auth0] 3. Application type must be "Single Page Application"');
        console.error('[Auth0] Please check your Auth0 Dashboard settings');
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
    showAuthNotification('Auth0 initialization failed. Check console for details.', 'error');
  }
}

// Store button handlers so we can remove them before adding new ones
let signinHandler = null;
let signupHandler = null;
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
  
  if (signupBtn && signupHandler) {
    signupBtn.removeEventListener('click', signupHandler);
  }
  
  // Create new handlers based on actual auth state
  if (currentAuthState) {
    // Both buttons do logout when authenticated
    signinHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Auth0] Logout button clicked');
      await logout();
    };
    signupHandler = signinHandler; // Same handler for both
  } else {
    // Different handlers for login/signup when not authenticated
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
    
    signupHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Auth0] Sign Up button clicked');
      try {
        await signup();
      } catch (error) {
        console.error('[Auth0] Signup error in handler:', error);
      }
    };
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
  
  if (signupBtn) {
    // Clear existing handlers
    signupBtn.replaceWith(signupBtn.cloneNode(true));
    const freshSignupBtn = document.getElementById('signupBtn');
    
    if (freshSignupBtn) {
      freshSignupBtn.onclick = signupHandler;
      freshSignupBtn.addEventListener('click', signupHandler);
      
      // Test that the handler works
      freshSignupBtn.addEventListener('click', () => {
        console.log('[Auth0] Sign Up button click detected!');
      }, { once: true });
      
      console.log('[Auth0] Sign Up button bound successfully');
    }
  } else {
    console.error('[Auth0] Sign Up button not found in DOM!');
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
    showAuthNotification(errorMsg, 'error');
    alert('Unable to initialize authentication. Please refresh the page and try again.');
    return;
  }
  
  try {
    console.log('[Auth0] Redirecting to login...');
    console.log('[Auth0] Client state:', { 
      clientExists: !!auth0Client,
      hasLoginMethod: typeof auth0Client.loginWithRedirect === 'function'
    });
    
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
    showAuthNotification(errorMsg, 'error');
    alert(`Login error: ${errorMsg}`);
  }
}

/**
 * Signup with Auth0
 */
async function signup() {
  console.log('[Auth0] Signup function called');
  if (!auth0Client) {
    console.log('[Auth0] Client not initialized, initializing now...');
    await initAuth0();
  }
  
  if (!auth0Client) {
    console.error('[Auth0] Failed to initialize client');
    showAuthNotification('Authentication service not available. Please refresh the page.', 'error');
    return;
  }
  
  try {
    console.log('[Auth0] Redirecting to signup...');
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
        ui_locales: 'en',
        appState: {
          returnTo: window.location.href,
        },
      },
    });
  } catch (error) {
    console.error('[Auth0] Signup error:', error);
    showAuthNotification('Signup failed. Please try again.', 'error');
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
    showAuthNotification('Logout failed. Please try again.', 'error');
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
  const signupBtn = document.getElementById('signupBtn');
  const authButtons = document.querySelectorAll('.auth-btn');

  // Update authentication state
  isAuthenticated = !!user;

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
    
    if (signupBtn) {
      // Update text while preserving event handlers
      const firstChild = signupBtn.firstChild;
      if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
        firstChild.textContent = 'Sign Out';
      } else {
        signupBtn.textContent = 'Sign Out';
      }
      signupBtn.style.background = 'rgba(231, 76, 60, 0.1)';
      signupBtn.style.borderColor = 'rgba(231, 76, 60, 0.5)';
      signupBtn.style.color = '#e74c3c';
    }
    
    // Add logged-in indicator to header
    document.body.setAttribute('data-user-logged-in', 'true');
    document.body.setAttribute('data-user-name', firstName);
    document.body.setAttribute('data-user-email', userEmail);
    
    // Auto-fill forms with user info
    autoFillUserForms(userName, userEmail);

    // Update any auth buttons
    authButtons.forEach(btn => {
      if (btn.dataset.action === 'logout') {
        btn.style.display = 'inline-block';
      } else if (btn.dataset.action === 'login' || btn.dataset.action === 'signup') {
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
    
    if (signupBtn) {
      // Update text while preserving event handlers
      const firstChild = signupBtn.firstChild;
      if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
        firstChild.textContent = 'Sign Up';
      } else {
        signupBtn.textContent = 'Sign Up';
      }
      signupBtn.style.background = '';
      signupBtn.style.borderColor = '';
      signupBtn.style.color = '';
    }
    
    // Remove logged-in indicator
    document.body.removeAttribute('data-user-logged-in');
    document.body.removeAttribute('data-user-name');

    // Update any auth buttons
    authButtons.forEach(btn => {
      if (btn.dataset.action === 'logout') {
        btn.style.display = 'none';
      } else if (btn.dataset.action === 'login' || btn.dataset.action === 'signup') {
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
 * Show notification
 */
function showAuthNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  if (type === 'success') {
    notification.style.background = 'linear-gradient(45deg, #2ecc71, #27ae60)';
  } else if (type === 'error') {
    notification.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)';
  } else {
    notification.style.background = 'linear-gradient(45deg, #3498db, #2980b9)';
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
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
    const signupBtn = document.getElementById('signupBtn');
    if ((signinBtn || signupBtn) && !signinHandler && !signupHandler) {
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
  const signupBtn = document.getElementById('signupBtn');
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
window.auth0Signup = signup;
window.auth0Logout = logout;

// Also expose directly for inline handlers
window.login = login;
window.signup = signup;
window.logout = logout;

