# Auth0 Environment Variables: Secret or Not?

## Short Answer

**No, they are NOT secret variables.** You can mark them as "sensitive" in Netlify if you want (which just hides them from the UI), but they're **safe to expose** in client-side code.

## Why They're Not Secret

### Auth0 Single Page Applications (SPAs)

Your app is a **Single Page Application**, which means:
- ✅ **Client ID** = PUBLIC (safe in browser)
- ✅ **Domain** = PUBLIC (safe in browser)
- ❌ **Client Secret** = NEVER used in SPAs (don't set this!)

### How Auth0 Security Works

Auth0 SPAs use **public credentials** because:
1. The Client ID is public (anyone can see it in your HTML/JS)
2. Security comes from:
   - **Callback URL restrictions** (only your domain can use it)
   - **Web Origin restrictions** (CORS protection)
   - **User authentication** (users must log in)
   - **PKCE flow** (code exchange security)

The Client ID alone cannot access user data - users must authenticate first.

## Netlify Variable Settings

When adding variables in Netlify:

**AUTH0_DOMAIN:**
- ✅ Can mark as "sensitive" (hides from UI)
- ✅ Safe to expose in built HTML/JS
- ⚠️ Will appear in client-side code (this is expected and safe)

**AUTH0_CLIENT_ID:**
- ✅ Can mark as "sensitive" (hides from UI)
- ✅ Safe to expose in built HTML/JS
- ⚠️ Will appear in client-side code (this is expected and safe)

## What You Should NEVER Do

❌ **Never set AUTH0_CLIENT_SECRET** - SPAs don't use this
❌ **Never put Client Secret in client-side code** - This would be a security risk
❌ **Never worry about Client ID being public** - This is by design

## Comparison: SPA vs Server-Side App

| App Type | Client ID | Client Secret | Domain |
|----------|-----------|---------------|--------|
| **SPA** (yours) | ✅ Public | ❌ Not used | ✅ Public |
| **Server-side** | ✅ Public | 🔒 Secret | ✅ Public |

Your app is a **SPA**, so only Client ID and Domain are needed, and both are public.

## Netlify Configuration

Your `netlify.toml` already has:
```toml
[build.environment]
  SECRETS_SCAN_OMIT_KEYS = "AUTH0_DOMAIN,AUTH0_CLIENT_ID"
```

This tells Netlify's secrets scanner to ignore these keys because they're meant to be public in SPAs.

## Summary

✅ **AUTH0_DOMAIN**: Public, can mark as "sensitive" in Netlify (optional)
✅ **AUTH0_CLIENT_ID**: Public, can mark as "sensitive" in Netlify (optional)
❌ **AUTH0_CLIENT_SECRET**: Not needed for SPAs, don't set it

**Bottom line**: Mark them as "sensitive" if you want to hide them from the Netlify UI, but don't worry about them being exposed in your website's code - that's how SPAs work!

