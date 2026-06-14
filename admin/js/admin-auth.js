/**
 * Admin Auth — Noteworthy News
 *
 * Initializes Auth0, enforces admin role, provides token for API calls.
 * The server is the authority for admin identity — the client probes
 * an admin endpoint to confirm access rather than relying on client-side
 * claim parsing alone.
 */

import { setTokenProvider } from './lib/api.js';

const AUTH0_SDK_URL = 'https://cdn.auth0.com/js/auth0-spa-js/2.4/auth0-spa-js.production.js';
let _auth0Client = null;

function getConfig() {
  const domain = window.AUTH0_DOMAIN;
  const clientId = window.AUTH0_CLIENT_ID;
  if (!domain || !clientId) return null;
  return { domain, clientId };
}

/** SDK v2.4 exposes createAuth0Client on window.auth0, not as a bare global. */
function getAuth0Factory() {
  if (typeof createAuth0Client === 'function') return createAuth0Client;
  if (window.auth0 && typeof window.auth0.createAuth0Client === 'function') {
    return window.auth0.createAuth0Client;
  }
  if (typeof auth0 !== 'undefined' && typeof auth0.createAuth0Client === 'function') {
    return auth0.createAuth0Client;
  }
  return null;
}

async function loadSDK() {
  if (getAuth0Factory()) return;
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

  const factory = getAuth0Factory();
  if (!factory) {
    setStatus('Auth0 SDK loaded but createAuth0Client not found.', true);
    console.error('[AdminAuth] createAuth0Client missing after SDK load');
    return null;
  }

  let client;
  try {
    client = await factory({
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
  // The SPA requests no API audience, so the access token is opaque and
  // cannot be verified server-side. Use the ID token (a signed JWT with
  // email + sub, aud = client_id) for all admin API calls instead.
  const getToken = async () => {
    try {
      await client.getTokenSilently();
    } catch {
      // Silent refresh may fail without refresh tokens; the cached ID token
      // is still usable below.
    }
    const claims = await client.getIdTokenClaims();
    return claims && claims.__raw ? claims.__raw : null;
  };

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
