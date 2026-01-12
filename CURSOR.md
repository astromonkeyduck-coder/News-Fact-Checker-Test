# Cursor AI Project Guidelines - Noteworthy News

## Security Rules (CRITICAL)

1. **Never put secrets in client code**
   - API keys, tokens, and credentials must ONLY exist in server-side Netlify Functions
   - Use `process.env.*` in functions, never in HTML/JS that runs in browser
   - Never log API keys or sensitive tokens

2. **Serverless functions for external APIs**
   - All OpenAI, Supabase, and other API calls must go through Netlify Functions
   - Client-side code calls `/api/*` endpoints, not external APIs directly

## Hidden Pages & Tools

1. **Clemens Converter (`/clemensconverter`)**
   - Must NOT appear in navigation, sitemap, RSS feeds, or any internal links
   - Must include `<meta name="robots" content="noindex, nofollow, noarchive" />` in HTML
   - Must have `X-Robots-Tag: noindex, nofollow` header in netlify.toml
   - Accessible only by direct URL

2. **Other hidden tools**
   - Follow same pattern: noindex meta + header, no links, not in sitemap

## Code Style & Structure

1. **Minimal changes**
   - Keep changes focused and consistent with existing project structure
   - Follow existing patterns for Netlify Functions (see `netlify/functions/` examples)
   - Use existing asset structure (`assets/js/`, `assets/css/`)

2. **Netlify Functions**
   - Place in `netlify/functions/`
   - Use standard handler pattern: `exports.handler = async (event, context) => { ... }`
   - Include CORS headers for browser requests
   - Handle OPTIONS requests for CORS preflight

3. **Error Handling**
   - Always return proper HTTP status codes
   - Log errors server-side (without sensitive data)
   - Show user-friendly error messages in UI

## Dependencies

- Prefer existing dependencies when possible
- If adding new packages, document why in implementation
- Check `package.json` before adding dependencies
