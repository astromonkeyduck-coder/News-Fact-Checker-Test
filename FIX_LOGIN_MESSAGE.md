# Fix "Log in to dev-u7a2ovr5jdmdwryp" Message

The login page shows "Log in to dev-u7a2ovr5jdmdwryp to continue to Noteworthy News" because the Auth0 Application Name is not set.

## Quick Fix (2 minutes):

1. **Go to Auth0 Dashboard**: https://manage.auth0.com/dashboard
2. **Navigate to**: Applications → Select your app → **Settings** tab
3. **Find**: "Application Name" field (at the top of the settings page)
4. **Change it to**: `Noteworthy News`
5. **Click**: "Save Changes"

## Result:

The message will change from:
- ❌ "Log in to **dev-u7a2ovr5jdmdwryp** to continue to Noteworthy News"
- ✅ "Log in to **Noteworthy News** to continue to Noteworthy News"

Or even better, it will just say:
- ✅ "Welcome to **Noteworthy News**"

## Additional Customization (Optional):

For even more control over the login page:

1. Go to **Branding** → **Universal Login** → **Customize**
2. Upload your Noteworthy News logo
3. Customize colors to match your brand
4. Edit the login template HTML to change any text

## For Developers:

If you want to change this programmatically or need to test different application names, you can:
- Use the Auth0 Management API to update the application name
- Configure custom login pages with full control over the messaging

But the easiest solution is just updating the Application Name in the Dashboard (step 1-5 above).

