# Account System Setup Guide

This guide explains how to set up and use the account system with Auth0 authentication.

## What's Been Implemented

✅ **Sign In & Sign Up Buttons** - Added to the header
✅ **Auth0 Integration** - Complete authentication flow
✅ **User Profile Page** - View user stats and account info
✅ **Backend API** - Netlify function to store/retrieve user data
✅ **Profile Navigation** - Profile link appears when logged in

## Setup Instructions

### 1. Configure Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/dashboard)
2. Create a new **Single Page Application**
3. Get your credentials:
   - **Domain** (e.g., `your-app.auth0.com`)
   - **Client ID**

### 2. Set Environment Variables in Netlify

In your Netlify dashboard, go to **Site settings → Environment variables** and add:

```
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
```

### 3. Configure Auth0 Application Settings

In your Auth0 Dashboard, go to **Applications → Your App → Settings**:

1. **Allowed Callback URLs**: Add these URLs:
   ```
   https://your-site.netlify.app/
   https://your-site.netlify.app/index.html
   http://localhost:8888/
   http://localhost:8888/index.html
   ```

2. **Allowed Logout URLs**: Add the same URLs as above

3. **Allowed Web Origins**: Add:
   ```
   https://your-site.netlify.app
   http://localhost:8888
   ```

4. **Application Name**: Change to "Noteworthy News" (optional, for branding)

### 4. Update Auth0 Configuration (Optional)

If you want to use environment variables instead of hardcoded values, update `src/auth/auth0.js`:

```javascript
const auth0Config = {
  domain: window.AUTH0_DOMAIN || 'your-domain.auth0.com',
  clientId: window.AUTH0_CLIENT_ID || 'your-client-id',
  // ...
};
```

For production, these will be injected via `scripts/inject-auth0.js` if you have that script set up.

### 5. Test the System

1. **Sign Up**: Click "Sign Up" button → Create account with Auth0
2. **Sign In**: Click "Sign In" button → Login with your credentials
3. **Profile**: Once logged in, click "Profile" in navigation to see your profile page
4. **Sign Out**: Click the sign-in button (which changes to show your name) to logout

## Features

### Sign In / Sign Up
- Buttons appear in the header
- Sign Up button redirects to Auth0 signup flow
- Sign In button redirects to Auth0 login flow
- When logged in, button shows user's first name with checkmark

### User Profile Page
- Accessible at `/profile.html`
- Shows user avatar (initials)
- Displays user stats:
  - Games Played
  - High Score
  - Comments
  - Tips Submitted
- Sign out functionality

### Backend API

**Endpoint**: `/.netlify/functions/user-data`

**GET** - Retrieve user data:
```javascript
fetch('/.netlify/functions/user-data?email=user@example.com', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**POST** - Update user data:
```javascript
fetch('/.netlify/functions/user-data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    data: {
      stats: {
        gamesPlayed: 10,
        highScore: 1000
      }
    }
  })
})
```

## Files Modified/Created

### Modified Files
- `index.html` - Added auth buttons, Auth0 scripts, profile link
- `src/auth/auth0.js` - Added signup function, improved button handling

### New Files
- `profile.html` - User profile page
- `netlify/functions/user-data.js` - Backend API for user data
- `ACCOUNT_SYSTEM_SETUP.md` - This guide

## Security Notes

1. **Never Hardcode Credentials**: The Auth0 domain and client ID should NEVER be hardcoded in your code. Always use environment variables.

2. **Token Verification**: The `user-data.js` function currently accepts any Bearer token. For production, you should verify tokens with Auth0's Management API.

3. **CORS**: Currently allows all origins. Consider restricting in production.

4. **Data Storage**: User data is stored in Netlify Blobs. Make sure `NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN` are set in environment variables.

5. **Redirect URI**: Always use `window.location.origin` for redirect_uri to ensure it matches your actual domain.

6. **Allowed Web Origins**: CRITICAL - Make sure your Auth0 application has the correct "Allowed Web Origins" configured. Without this, silent authentication (staying logged in on refresh) will fail.

## Troubleshooting

### Buttons not working?
- Check browser console for errors
- Verify Auth0 SDK is loading (check Network tab)
- Ensure Auth0 credentials are correct

### Redirect errors?
- Verify callback URLs in Auth0 Dashboard match your site URL
- Check that application type is "Single Page Application"

### Profile page shows "Please Sign In"?
- Make sure you're logged in
- Check that Auth0 is initialized (check console)
- Verify token is being retrieved correctly

## Next Steps (Optional Enhancements)

1. **Token Verification**: Implement proper Auth0 token verification in `user-data.js`
2. **User Preferences**: Add settings page for user preferences
3. **Game Stats Integration**: Connect game scores to user profile
4. **Comments Integration**: Link comments to user accounts
5. **Email Verification**: Configure Auth0 email verification
6. **Social Logins**: Enable Google, Twitter, etc. in Auth0

## Support

For Auth0-specific issues, check:
- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Community](https://community.auth0.com/)

