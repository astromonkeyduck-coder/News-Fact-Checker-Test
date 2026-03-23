/**
 * Server-side authentication and authorization middleware.
 *
 * Uses jose to verify Auth0 JWTs against the JWKS endpoint.
 * FAIL-CLOSED: missing configuration always denies access.
 *
 * Exports:
 *   verifyToken(event)      – returns { payload } or null
 *   requireAuth(event)      – returns { user } or a response object (4xx/5xx)
 *   requireAdminAuth(event) – returns { user } or a response object (4xx/5xx)
 *   isAdminSecretValid(event) – checks legacy shared-secret headers/params
 *   requireAdminAuthOrSecret(event) – accepts JWT admin OR legacy shared secret
 */

const { createRemoteJWKSet, jwtVerify } = require("jose");

// ---------------------------------------------------------------------------
// Configuration — all derived from env vars, fail-closed when missing
// ---------------------------------------------------------------------------

function getAuthConfig() {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE || process.env.AUTH0_CLIENT_ID;

  if (!domain) return null;

  return {
    domain,
    audience,
    issuer: `https://${domain}/`,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
  };
}

let _jwks = null;
function getJWKS(jwksUri) {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return _jwks;
}

// ---------------------------------------------------------------------------
// Admin identity helpers
// ---------------------------------------------------------------------------

const ADMIN_ROLE_CLAIM_PATHS = [
  "https://noteworthynews.co/roles",
  "roles",
  "https://noteworthynews.co/permissions",
  "permissions",
];

function hasAdminRole(payload) {
  for (const path of ADMIN_ROLE_CLAIM_PATHS) {
    const claim = payload[path];
    if (Array.isArray(claim) && claim.includes("admin")) return true;
    if (claim === "admin") return true;
  }
  return false;
}

function isAdminEmail(email) {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails || !email) return false;
  const allowlist = adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

function isAdmin(payload) {
  if (hasAdminRole(payload)) return true;
  const email =
    payload.email ||
    payload["https://noteworthynews.co/email"] ||
    payload.sub;
  return isAdminEmail(email);
}

// ---------------------------------------------------------------------------
// CORS headers shared by auth responses
// ---------------------------------------------------------------------------

const AUTH_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Admin-Token, X-Clems-Token",
  "Content-Type": "application/json",
};

function authResponse(statusCode, error, detail) {
  return {
    statusCode,
    headers: AUTH_HEADERS,
    body: JSON.stringify({ error, ...(detail ? { detail } : {}) }),
  };
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

/**
 * Verify the JWT from the Authorization header.
 * Returns { payload } on success, null on failure.
 */
async function verifyToken(event) {
  const config = getAuthConfig();
  if (!config) return null;

  const authHeader =
    event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const jwks = getJWKS(config.jwksUri);

    const verifyOptions = {
      issuer: config.issuer,
    };
    if (config.audience) {
      verifyOptions.audience = config.audience;
    }

    const { payload } = await jwtVerify(token, jwks, verifyOptions);
    return { payload };
  } catch (err) {
    console.error("[requireAuth] JWT verification failed:", err.code || err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// requireAuth — any authenticated user
// ---------------------------------------------------------------------------

/**
 * Require a valid Auth0 JWT.
 * Returns { user: payload } or a response object to return from the handler.
 */
async function requireAuth(event) {
  const config = getAuthConfig();
  if (!config) {
    console.error("[requireAuth] AUTH0_DOMAIN is not configured — denying access (fail-closed).");
    return authResponse(500, "Authentication service not configured");
  }

  const result = await verifyToken(event);
  if (!result) {
    return authResponse(401, "Unauthorized — valid Bearer token required");
  }

  return { user: result.payload };
}

// ---------------------------------------------------------------------------
// requireAdminAuth — verified admin only
// ---------------------------------------------------------------------------

/**
 * Require a valid Auth0 JWT with admin privileges.
 * Returns { user: payload } or a response object.
 */
async function requireAdminAuth(event) {
  const authResult = await requireAuth(event);
  if (authResult.statusCode) return authResult; // pass through error

  if (!isAdmin(authResult.user)) {
    console.warn(
      "[requireAuth] Non-admin access attempt:",
      authResult.user.sub || authResult.user.email || "unknown"
    );
    return authResponse(403, "Forbidden — admin privileges required");
  }

  return authResult;
}

// ---------------------------------------------------------------------------
// Legacy shared-secret compatibility
// ---------------------------------------------------------------------------

/**
 * Check if the request carries a valid legacy admin secret.
 * Supports: NEWSLETTER_KEY, ADMIN_ANALYTICS_TOKEN, ADMIN_TOKEN.
 * Returns true/false. FAIL-CLOSED: returns false when the env var is missing.
 */
function isAdminSecretValid(event, envVarName) {
  const secret = process.env[envVarName];
  if (!secret) return false; // fail-closed

  const provided =
    event.queryStringParameters?.token ||
    event.headers["x-admin-token"] ||
    event.headers["x-clems-token"] ||
    (() => {
      try {
        const body = JSON.parse(event.body || "{}");
        return body.token || body.admin_password;
      } catch {
        return null;
      }
    })();

  if (!provided) return false;
  return timingSafeEqual(secret, provided);
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Combined: JWT admin OR legacy secret
// ---------------------------------------------------------------------------

/**
 * Accept EITHER a verified admin JWT OR a valid legacy shared secret.
 * This allows gradual migration from shared secrets to JWT.
 * FAIL-CLOSED when both mechanisms fail.
 *
 * @param {object} event - Netlify function event
 * @param {string} secretEnvVarName - e.g. "NEWSLETTER_KEY"
 * @returns {{ user: object, authMethod: string } | { statusCode, headers, body }}
 */
async function requireAdminAuthOrSecret(event, secretEnvVarName) {
  // Try JWT first
  const jwtResult = await verifyToken(event);
  if (jwtResult && isAdmin(jwtResult.payload)) {
    return { user: jwtResult.payload, authMethod: "jwt" };
  }

  // Try legacy secret
  if (secretEnvVarName && isAdminSecretValid(event, secretEnvVarName)) {
    return { user: { sub: "legacy-secret", role: "admin" }, authMethod: "secret" };
  }

  // If JWT was valid but not admin, return 403
  if (jwtResult) {
    return authResponse(403, "Forbidden — admin privileges required");
  }

  // Check if auth infrastructure is configured at all
  const config = getAuthConfig();
  const secretExists = secretEnvVarName && process.env[secretEnvVarName];
  if (!config && !secretExists) {
    console.error(
      `[requireAuth] Neither AUTH0_DOMAIN nor ${secretEnvVarName} is configured — denying access (fail-closed).`
    );
    return authResponse(500, "Security configuration error");
  }

  return authResponse(401, "Unauthorized — admin authentication required");
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  verifyToken,
  requireAuth,
  requireAdminAuth,
  isAdminSecretValid,
  requireAdminAuthOrSecret,
  AUTH_HEADERS,
};
