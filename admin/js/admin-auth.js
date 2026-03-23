/**
 * Admin Auth — Noteworthy News
 *
 * Initializes Auth0, enforces admin role, provides token for API calls.
 * The server is the authority for admin identity — the client probes
 * an admin endpoint to confirm access rather than relying on client-side
 * claim parsing alone.
 */

import { setTokenProvider } from './lib/api.js';

const AUTH0_SDK_URL = 'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js';
let _auth0Client = null;

function getConfig() {
  const domain = window.AUTH0_DOMAIN;
  const clientId = window.AUTH0_CLIENT_ID;
  if (!domain || !clientId) return null;
  return { domain, clientId };
}

async function loadSDK() {
  if (typeof window.createAuth0Client === 'function') return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = AUTH0_SDK_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Auth0 SDK'));
    document.head.appendChild(s);
  });
}

/**
 * Server-authoritative admin check.
 * Calls a lightweight admin-only GET endpoint and interprets the status code.
 * 403 → not admin. 401 → token invalid. Anything else → admin.
 */
async function verifyAdminOnServer(token) {
  try {
    const res = await fetch('/.netlify/functions/cams-token', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status !== 403 && res.status !== 401;
  } catch {
    return false;
  }
}

/**
 * Initialize admin auth. Returns { user, getToken } on success.
 * Shows status messages in #admin-auth-status during the flow.
 */
export async function initAdminAuth() {
  const statusEl = document.getElementById('admin-auth-status');
  const setStatus = (msg, isError) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = isError ? 'auth-status auth-error' : 'auth-status';
  };

  setStatus('Initializing\u2026', false);

  const config = getConfig();
  if (!config) {
    setStatus('Auth0 configuration missing. Set AUTH0_DOMAIN and AUTH0_CLIENT_ID.', true);
    return null;
  }

  try {
    await loadSDK();
  } catch {
    setStatus('Failed to load authentication library.', true);
    return null;
  }

  let client;
  try {
    client = await window.createAuth0Client({
      domain: config.domain,
      clientId: config.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin + '/admin/',
      },
      cacheLocation: 'memory',
      useRefreshTokens: false,
    });
  } catch (err) {
    setStatus('Auth0 initialization failed.', true);
    console.error('[AdminAuth]', err);
    return null;
  }
  _auth0Client = client;

  // Handle Auth0 callback
  if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
    try {
      await client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } catch (err) {
      console.error('[AdminAuth] Callback error:', err);
      setStatus('Login callback failed. Try again.', true);
      return null;
    }
  }

  const authenticated = await client.isAuthenticated();
  if (!authenticated) {
    setStatus('Redirecting to login\u2026', false);
    await client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: window.location.origin + '/admin/',
      },
    });
    return null; // page will redirect
  }

  setStatus('Verifying admin access\u2026', false);

  const user = await client.getUser();
  const getToken = () => client.getTokenSilently();

  let token;
  try {
    token = await getToken();
  } catch {
    setStatus('Failed to obtain access token. Try logging in again.', true);
    return null;
  }

  const serverConfirmed = await verifyAdminOnServer(token);
  if (!serverConfirmed) {
    const identity = user.email || user.nickname || user.sub;
    setStatus(`Access denied. ${identity} does not have admin privileges.`, true);
    return null;
  }

  setTokenProvider(getToken);
  setStatus('', false);

  return { user, getToken };
}

export async function logout() {
  if (!_auth0Client) {
    window.location.href = '/';
    return;
  }
  try {
    await _auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
  } catch (err) {
    console.error('[AdminAuth] Logout error:', err);
    window.location.href = '/';
  }
}
