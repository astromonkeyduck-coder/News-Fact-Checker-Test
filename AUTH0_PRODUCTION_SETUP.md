# Auth0 Production Setup Guide

## Understanding the Warning

The warning "One or more of your connections are currently using Auth0 development keys" means you're using a free Auth0 development tenant in production. This is **not a security issue** for Single Page Applications (SPAs), but you should create a production application for:

- Better performance and reliability
- Production-grade support
- Compliance requirements
- Higher rate limits

## Option 1: Create a Production Auth0 Application (Recommended)

### Step 1: Create a New Application in Auth0

1. Go to https://manage.auth0.com/dashboard
2. Navigate to **Applications** → **Create Application**
3. Name it **"Noteworthy News Production"**
4. Select **Single Page Application**
5. Click **Create**

### Step 2: Get Production Credentials

1. Go to **Applications** → **Noteworthy News Production** → **Settings**
2. Copy your **Domain** (should be different from dev domain)
3. Copy your **Client ID**

### Step 3: Configure Production Application

1. Scroll to **Application URIs**
2. Add **Allowed Callback URLs**:
   ```
   https://noteworthynews.co/, https://noteworthynews.co/index.html
   ```
3. Add **Allowed Logout URLs**:
   ```
   https://noteworthynews.co/
   ```
4. Add **Allowed Web Origins** (no trailing slash):
   ```
   https://noteworthynews.co
   ```
5. Click **Save Changes**

### Step 4: Set Up Environment Variables in Netlify

1. Go to your Netlify dashboard: https://app.netlify.com
2. Navigate to your site → **Site Settings** → **Environment Variables**
3. Click **Add a variable**
4. Add these variables:
   - **Key**: `AUTH0_DOMAIN`
     **Value**: `your-production-domain.auth0.com`
   - **Key**: `AUTH0_CLIENT_ID`
     **Value**: `your-production-client-id`
5. Click **Save**

### Step 5: Update Netlify Build Settings

1. Go to **Site Settings** → **Build & deploy** → **Build settings**
2. In your `netlify.toml` or build command, add a step to inject environment variables

Create or update `netlify.toml`:

```toml
[build]
  publish = "."
  
[build.environment]
  # Netlify will inject these at build time

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Step 6: Update Build Process to Inject Variables

Since this is a static site, we need to inject the environment variables into the HTML at build time.

**Option A: Use a build script**

Create `scripts/inject-auth0.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Read index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Inject environment variables
const auth0Domain = process.env.AUTH0_DOMAIN || '';
const auth0ClientId = process.env.AUTH0_CLIENT_ID || '';

const scriptTag = `
    <script>
      window.AUTH0_DOMAIN = ${auth0Domain ? `'${auth0Domain}'` : 'null'};
      window.AUTH0_CLIENT_ID = ${auth0ClientId ? `'${auth0ClientId}'` : 'null'};
    </script>
`;

// Replace the placeholder or inject before Auth0 SDK
html = html.replace(
  '<!-- Auth0 Configuration - Inject environment variables for production -->',
  `<!-- Auth0 Configuration - Inject environment variables for production -->${scriptTag}`
);

fs.writeFileSync(indexPath, html);
console.log('✅ Auth0 environment variables injected');
```

Update `package.json`:

```json
{
  "scripts": {
    "build": "node scripts/inject-auth0.js",
    "prebuild": "node scripts/inject-auth0.js"
  }
}
```

**Option B: Use Netlify's Build Environment Variables**

For a simpler approach, you can use Netlify's serverless functions or edge functions, but for a static site, Option A is recommended.

## Option 2: Keep Development Credentials (Quick Fix)

If you want to keep using development credentials temporarily:

1. The warning won't affect functionality
2. For SPAs, credentials are always visible in the browser (this is expected)
3. Upgrade to a paid Auth0 plan for production features

## Verification

After setting up production credentials:

1. Deploy your site
2. Check browser console - should see `[Auth0] Initialized successfully`
3. Test login/signup
4. The warning should disappear once production credentials are detected

## Notes

- **For SPAs**: It's normal and expected that Auth0 credentials are visible in the browser JavaScript. This is not a security risk.
- **Rate Limits**: Production applications have higher rate limits
- **Support**: Production applications get priority support from Auth0
- **Development vs Production**: You can use different applications for dev (localhost) and production (live site)

## Troubleshooting

If environment variables aren't being injected:

1. Check Netlify build logs - do you see the variables?
2. Verify the build script runs during deployment
3. Check that the HTML is being modified correctly
4. Test locally with: `AUTH0_DOMAIN=test npm run build`

