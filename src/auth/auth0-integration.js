/**
 * Auth0 Integration for Noteworthy News
 * 
 * Replace the mock authentication system with real Auth0 authentication
 * 
 * Setup:
 * 1. Create Auth0 account at https://auth0.com
 * 2. Create a Single Page Application
 * 3. Get your Domain, Client ID, and Client Secret
 * 4. Add these to your environment variables or config
 * 5. Add allowed callback URLs: https://noteworthynews.co/, http://localhost:8888/
 * 6. Add allowed logout URLs: https://noteworthynews.co/, http://localhost:8888/
 * 7. Update the config object below with your Auth0 credentials
 */

import { createAuth0Client } from '@auth0/auth0-spa-js';

// Auth0 Configuration
// Replace these with your actual Auth0 credentials from the Auth0 Dashboard
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || 'your-domain.auth0.com',
  clientId: process.env.AUTH0_CLIENT_ID || 'your-client-id',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: process.env.AUTH0_AUDIENCE || '', // Optional: if using API
  },
  cacheLocation: 'localstorage',
};

class Auth0Integration {
  constructor() {
    this.auth0Client = null;
    this.isAuthenticated = false;
    this.user = null;
    this.init();
  }

  async init() {
    try {
      // Initialize Auth0 client
      this.auth0Client = await createAuth0Client(auth0Config);

      // Check if we're returning from callback
      if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
        await this.auth0Client.handleRedirectCallback();
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Check authentication status
      this.isAuthenticated = await this.auth0Client.isAuthenticated();
      
      if (this.isAuthenticated) {
        this.user = await this.auth0Client.getUser();
        console.log('[Auth0] User authenticated:', this.user);
      }

      // Update UI
      this.updateAuthUI();

      // Bind events
      this.bindAuthEvents();
    } catch (error) {
      console.error('[Auth0] Initialization error:', error);
    }
  }

  bindAuthEvents() {
    // Find auth buttons (may need to be updated based on your HTML structure)
    const signinBtn = document.getElementById('signinBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (signinBtn) {
      signinBtn.addEventListener('click', () => this.login());
    }

    if (signupBtn && !this.isAuthenticated) {
      signupBtn.addEventListener('click', () => this.loginWithSignup());
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  }

  async login() {
    try {
      await this.auth0Client.loginWithRedirect({
        authorizationParams: {
          screen_hint: 'login',
        },
      });
    } catch (error) {
      console.error('[Auth0] Login error:', error);
      this.showNotification('Login failed. Please try again.', 'error');
    }
  }

  async loginWithSignup() {
    try {
      await this.auth0Client.loginWithRedirect({
        authorizationParams: {
          screen_hint: 'signup',
        },
      });
    } catch (error) {
      console.error('[Auth0] Signup error:', error);
      this.showNotification('Signup failed. Please try again.', 'error');
    }
  }

  async logout() {
    try {
      await this.auth0Client.logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });
    } catch (error) {
      console.error('[Auth0] Logout error:', error);
      this.showNotification('Logout failed. Please try again.', 'error');
    }
  }

  async getAccessToken() {
    try {
      return await this.auth0Client.getTokenSilently();
    } catch (error) {
      console.error('[Auth0] Token error:', error);
      return null;
    }
  }

  updateAuthUI() {
    const signinBtn = document.getElementById('signinBtn');
    const signupBtn = document.getElementById('signupBtn');

    if (this.isAuthenticated && this.user) {
      if (signinBtn) {
        signinBtn.textContent = `Hi, ${this.user.name || this.user.email || 'User'}`;
      }
      if (signupBtn) {
        signupBtn.textContent = 'Sign Out';
        signupBtn.onclick = () => this.logout();
      }
    } else {
      if (signinBtn) {
        signinBtn.textContent = 'Sign In';
      }
      if (signupBtn) {
        signupBtn.textContent = 'Sign Up';
        signupBtn.onclick = () => this.loginWithSignup();
      }
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Getters
  getIsAuthenticated() {
    return this.isAuthenticated;
  }

  getUser() {
    return this.user;
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.Auth0Integration = Auth0Integration;
}

export default Auth0Integration;

