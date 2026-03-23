/**
 * Noteworthy News V2 — Auth Module
 *
 * Thin Auth0 SPA integration. SDK is loaded lazily — only fetched when
 * needed (auth callback in URL, or user clicks Sign In/Sign Up).
 *
 * If Auth0 config is absent (dev without env vars), degrades silently.
 */

const SDK_URL = 'https://cdn.auth0.com/js/auth0-spa-js/2.4/auth0-spa-js.production.js';

let client = null;
let currentUser = null;
let onAuthChangeFn = null;
let sdkPromise = null;

function getAuth0Factory() {
  if (typeof createAuth0Client === 'function') return createAuth0Client;
  if (window.auth0 && typeof window.auth0.createAuth0Client === 'function') return window.auth0.createAuth0Client;
  if (typeof auth0 !== 'undefined' && typeof auth0.createAuth0Client === 'function') return auth0.createAuth0Client;
  return null;
}

function loadSDK() {
  if (getAuth0Factory()) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Auth0 SDK failed to load'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

async function createClient() {
  if (client) return client;
  const domain = window.AUTH0_DOMAIN;
  const clientId = window.AUTH0_CLIENT_ID;
  if (!domain || !clientId) return null;

  await loadSDK();
  const factory = getAuth0Factory();
  if (!factory) throw new Error('Auth0 SDK loaded but createAuth0Client not found');
  client = await factory({
    domain,
    clientId,
    authorizationParams: {
      redirect_uri: window.location.origin + window.location.pathname,
    },
    cacheLocation: 'memory',
  });
  return client;
}

/**
 * Initialize Auth0. Call once after DOM is ready.
 *
 * Render path:
 *  1. Immediately fire onAuthChange(null) so the UI doesn't wait.
 *  2. If this is an Auth0 redirect callback, handle it (loads SDK).
 *  3. Otherwise, check for an existing session in the background
 *     so returning authenticated users see their logged-in state.
 */
export async function initAuth(onAuthChange) {
  onAuthChangeFn = onAuthChange;
  const domain = window.AUTH0_DOMAIN;
  const clientId = window.AUTH0_CLIENT_ID;

  if (!domain || !clientId) {
    onAuthChange(null);
    return;
  }

  const isCallback = window.location.search.includes('code=') &&
                     window.location.search.includes('state=');

  if (isCallback) {
    try {
      const c = await createClient();
      if (!c) { onAuthChange(null); return; }

      await c.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);

      const isAuth = await c.isAuthenticated();
      currentUser = isAuth ? await c.getUser() : null;
      onAuthChange(currentUser);
    } catch (err) {
      console.error('[Auth] Callback error:', err);
      onAuthChange(null);
    }
    return;
  }

  // Non-callback visit: show logged-out state immediately, then
  // check for an existing session in the background.
  onAuthChange(null);
  checkSession();
}

async function checkSession() {
  try {
    const c = await createClient();
    if (!c) return;

    const isAuth = await c.isAuthenticated();
    if (isAuth) {
      currentUser = await c.getUser();
      if (onAuthChangeFn) onAuthChangeFn(currentUser);
    }
  } catch {
    // Silent failure — user stays in logged-out state
  }
}

export async function login() {
  try {
    const c = await createClient();
    if (!c) return;
    await c.loginWithRedirect({
      authorizationParams: { screen_hint: 'login' },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
  }
}

export async function signup() {
  try {
    const c = await createClient();
    if (!c) return;
    await c.loginWithRedirect({
      authorizationParams: { screen_hint: 'signup' },
    });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
  }
}

export async function logout() {
  if (!client) return;
  currentUser = null;
  if (onAuthChangeFn) onAuthChangeFn(null);
  await client.logout({ logoutParams: { returnTo: window.location.origin + '/' } });
}

export function getUser() {
  return currentUser;
}

export async function getToken() {
  if (!client) return null;
  try {
    return await client.getTokenSilently();
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!currentUser;
}
