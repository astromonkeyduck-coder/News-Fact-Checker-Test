/**
 * Noteworthy News V2 — Auth Module
 *
 * Thin Auth0 SPA integration. SDK is loaded lazily — only fetched when
 * needed (auth callback in URL, or user clicks Sign In/ Sign Up).
 *
 * If Auth0 config is absent (dev without env vars), degrades silently.
 *
 * --- If browser shows 403 on .../authorize?client_id=... ---
 * That response comes from Auth0, not this app. Typical fixes:
 * 1. Auth0 Dashboard → Applications → your app → Settings:
 *    - Application type must be "Single Page Application" (PKCE).
 *    - Allowed Callback URLs: include https://noteworthynews.co/ (with slash).
 *      This app always uses origin + "/" as redirect_uri so it matches the
 *      Netlify "/" → v2 rewrite even if you opened /v2/index.html directly.
 *    - Netlify Deploy Previews: add each preview origin too, e.g.
 *      https://deploy-preview-123--yoursite.netlify.app/
 *    - Allowed Logout URLs: https://noteworthynews.co/
 *    - Allowed Web Origins: https://noteworthynews.co  (no path)
 * 2. Ensure the Client ID matches this application (not a M2M app).
 * 3. Tenant Attack Protection / bot rules: try another network or disable
 *    for testing.
 */

const SDK_URL = 'https://cdn.auth0.com/js/auth0-spa-js/2.4/auth0-spa-js.production.js';

const AUTH0_CONFIG_URL = '/.netlify/functions/get-auth0-config';

let client = null;
let currentUser = null;
let onAuthChangeFn = null;
let sdkPromise = null;
let configMergeAttempted = false;

/**
 * Prefer Netlify env (get-auth0-config) once per page load so V2 works even
 * when HTML still has build placeholders, and local dev can use netlify dev.
 */
async function mergeAuth0ConfigFromServer() {
  if (configMergeAttempted) return;
  configMergeAttempted = true;
  try {
    const res = await fetch(AUTH0_CONFIG_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (data.domain && data.clientId && !data.error) {
      window.AUTH0_DOMAIN = data.domain;
      window.AUTH0_CLIENT_ID = data.clientId;
    }
  } catch (_) {
    // Offline or function missing — keep inline/build values
  }
}

/**
 * Callback URL must match Auth0 "Allowed Callback URLs" exactly.
 * Always use site root so one allowlist entry works with Netlify’s "/" rewrite
 * to V2 and avoids 403 when users land on /v2/index.html vs /.
 */
function getRedirectUri() {
  return `${window.location.origin}/`;
}

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
  await mergeAuth0ConfigFromServer();
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
      redirect_uri: getRedirectUri(),
      // offline_access is required to receive a refresh token.
      scope: 'openid profile email offline_access',
    },
    // Persist the session across navigations/reloads and use refresh tokens
    // instead of hidden-iframe silent auth, which iOS Safari ITP blocks.
    // Previously 'memory' + no refresh tokens -> session lost ("guest") on
    // every page load, especially on iOS Safari.
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    useRefreshTokensFallback: true,
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
  await mergeAuth0ConfigFromServer();
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
      authorizationParams: {
        screen_hint: 'login',
        redirect_uri: getRedirectUri(),
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    console.info(
      '[Auth] If Auth0 returned 403, verify Dashboard: SPA app type, Callback URLs include',
      getRedirectUri()
    );
  }
}

export async function signup() {
  try {
    const c = await createClient();
    if (!c) return;
    await c.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
        redirect_uri: getRedirectUri(),
      },
    });
  } catch (err) {
    console.error('[Auth] Signup error:', err);
    console.info(
      '[Auth] If Auth0 returned 403, verify Dashboard: SPA app type, Callback URLs include',
      getRedirectUri()
    );
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
