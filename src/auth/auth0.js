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
 */

// Auth0 Configuration
const auth0Config = {
  domain: 'dev-u7a2ovr5jdmdwryp.us.auth0.com',
  clientId: 'LTAU4cZtZFsG8DqK2SbPoAKiYt14bCER',
  authorizationParams: {
    redirect_uri: window.location.origin,
  },
  cacheLocation: 'localstorage',
};

let auth0Client = null;

/**
 * Initialize Auth0
 */
async function initAuth0() {
  try {
    // Wait for Auth0 SDK to load
    let retries = 10;
    while (typeof auth0 === 'undefined' && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }
    
    if (typeof auth0 === 'undefined') {
      console.error('[Auth0] Auth0 SDK not loaded. Make sure the script tag is included before this file.');
      return;
    }

    // Create Auth0 client using the global auth0 object
    auth0Client = await auth0.createAuth0Client(auth0Config);

    // Handle callback from Auth0 redirect
    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      await auth0Client.handleRedirectCallback();
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if user is authenticated
    const isAuthenticated = await auth0Client.isAuthenticated();
    
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
  } catch (error) {
    console.error('[Auth0] Initialization error:', error);
    console.warn('[Auth0] Make sure you have:');
    console.warn('[Auth0] 1. Updated auth0Config with your domain and clientId');
    console.warn('[Auth0] 2. Added allowed callback URLs in Auth0 Dashboard');
    console.warn('[Auth0] 3. Added allowed logout URLs in Auth0 Dashboard');
  }
}

/**
 * Login with Auth0
 */
async function login() {
  if (!auth0Client) {
    await initAuth0();
  }
  try {
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'login',
      },
    });
  } catch (error) {
    console.error('[Auth0] Login error:', error);
    showAuthNotification('Login failed. Please try again.', 'error');
  }
}

/**
 * Signup with Auth0
 */
async function signup() {
  if (!auth0Client) {
    await initAuth0();
  }
  try {
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
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

  if (user) {
    // User is authenticated
    const displayName = user.name || user.nickname || user.email || 'User';
    
    if (signinBtn) {
      signinBtn.textContent = `Hi, ${displayName.split(' ')[0]}`;
      signinBtn.onclick = logout;
    }
    
    if (signupBtn) {
      signupBtn.textContent = 'Sign Out';
      signupBtn.onclick = logout;
    }

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
      signinBtn.textContent = 'Sign In';
      signinBtn.onclick = login;
    }
    
    if (signupBtn) {
      signupBtn.textContent = 'Sign Up';
      signupBtn.onclick = signup;
    }

    // Update any auth buttons
    authButtons.forEach(btn => {
      if (btn.dataset.action === 'logout') {
        btn.style.display = 'none';
      } else if (btn.dataset.action === 'login' || btn.dataset.action === 'signup') {
        btn.style.display = 'inline-block';
      }
    });
  }
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth0);
} else {
  initAuth0();
}

// Export for use
window.initAuth0 = initAuth0;
window.auth0Login = login;
window.auth0Signup = signup;
window.auth0Logout = logout;

