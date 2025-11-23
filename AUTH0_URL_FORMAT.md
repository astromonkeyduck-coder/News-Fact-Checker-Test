# ✅ Correct Auth0 URL Format

## The Error: "callbacks must be a valid uri"

This happens when Auth0 doesn't recognize your URL format. Here's how to fix it:

## ✅ Correct Format Examples

### For Callback URLs (one per line):
```
https://noteworthynews.co
https://noteworthynews.co/
https://noteworthynews.co/index.html
http://localhost:8888
http://localhost:8888/
http://localhost:8888/index.html
```

### For Logout URLs (same format):
```
https://noteworthynews.co
https://noteworthynews.co/
https://noteworthynews.co/index.html
http://localhost:8888
http://localhost:8888/
http://localhost:8888/index.html
```

### For Web Origins (no trailing slash):
```
https://noteworthynews.co
http://localhost:8888
```

## ❌ Common Mistakes

### DON'T include:
- ❌ Trailing spaces
- ❌ Extra characters
- ❌ `http://` missing (for localhost)
- ❌ `https://` missing (for production)
- ❌ Wildcards like `*` (unless specifically allowed)
- ❌ Query parameters like `?code=...`

### DO include:
- ✅ Full protocol: `http://` or `https://`
- ✅ Full domain: `noteworthynews.co` or `localhost:8888`
- ✅ One URL per line
- ✅ No trailing spaces

## Step-by-Step Fix

1. **Go to Auth0 Dashboard** → Your Application → Settings

2. **Allowed Callback URLs** - Paste these EXACTLY (one per line, no extra spaces):
   ```
   https://noteworthynews.co
   https://noteworthynews.co/
   http://localhost:8888
   http://localhost:8888/
   ```

3. **Allowed Logout URLs** - Same as above

4. **Allowed Web Origins** - Paste these (NO trailing slash):
   ```
   https://noteworthynews.co
   http://localhost:8888
   ```

5. **Click "Save Changes"**

## If You Have a Netlify Subdomain Too

If your site also has a `your-site.netlify.app` URL, add that too:

**Allowed Callback URLs:**
```
https://noteworthynews.co
https://noteworthynews.co/
https://your-site.netlify.app
https://your-site.netlify.app/
http://localhost:8888
http://localhost:8888/
```

**Allowed Web Origins:**
```
https://noteworthynews.co
https://your-site.netlify.app
http://localhost:8888
```

## Quick Copy-Paste Template

Replace `your-site.netlify.app` with your actual Netlify subdomain if you have one:

**Callback URLs:**
```
https://noteworthynews.co
https://noteworthynews.co/
http://localhost:8888
http://localhost:8888/
```

**Logout URLs:**
```
https://noteworthynews.co
https://noteworthynews.co/
http://localhost:8888
http://localhost:8888/
```

**Web Origins:**
```
https://noteworthynews.co
http://localhost:8888
```

## Still Getting Errors?

1. Make sure there are NO spaces before or after URLs
2. Make sure each URL is on its own line
3. Make sure you're using `http://` for localhost (not `https://`)
4. Make sure you're using `https://` for production (not `http://`)
5. Don't include any query parameters or fragments

## Test Your URLs

After saving, test by:
1. Visiting your site
2. Clicking "Sign Up"
3. If it redirects to Auth0 login, your URLs are correct! ✅

