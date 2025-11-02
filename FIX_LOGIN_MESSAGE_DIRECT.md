# Fix "Log in to dev-u7a2ovr5jdmdwryp" Message - Direct Template Edit

This message appears on the Auth0 login page. Here's how to change it completely by editing the Universal Login template directly.

## Step 1: Access Auth0 Universal Login Template

1. Go to https://manage.auth0.com/dashboard
2. Navigate to **Branding** → **Universal Login**
3. Click **Login** tab (or the dropdown if you see it)
4. Click **Customize** button (or the template you want to edit)

## Step 2: Edit the Login Template HTML

You'll see an HTML template editor. Find the section that shows the login message.

### Look for this code (around line 30-60):
```html
<h1>{{trans "Welcome"}}</h1>
<p>{{trans "Log in to {clientName} to continue to {appName}."}}</p>
```

### Replace it with one of these options:

**Option A: Simple Welcome (No tenant name)**
```html
<h1>{{trans "Welcome to Noteworthy News"}}</h1>
<p>{{trans "Sign in to access fact-checked news and media literacy tools."}}</p>
```

**Option B: Just App Name**
```html
<h1>{{trans "Noteworthy News"}}</h1>
<p>{{trans "Sign in to continue."}}</p>
```

**Option C: Complete Custom Message**
```html
<h1>{{trans "Welcome to Noteworthy News"}}</h1>
<p>{{trans "Your trusted source for fact-checked journalism and digital literacy education."}}</p>
```

## Step 3: Also Fix Sign Up Page

1. Still in **Branding** → **Universal Login**
2. Click the **Sign Up** tab (or switch template view)
3. Find similar code:
```html
<h1>{{trans "Sign Up"}}</h1>
<p>{{trans "Sign up to {clientName} to continue to {appName}."}}</p>
```

### Replace with:
```html
<h1>{{trans "Join Noteworthy News"}}</h1>
<p>{{trans "Create your account to access fact-checked news and media literacy tools."}}</p>
```

## Step 4: Save Changes

1. Click **Save** button at the bottom
2. Wait for Auth0 to deploy the changes (usually 10-30 seconds)
3. The changes will appear immediately on your login page

## Step 5: Test

1. Click "Sign In" on your website
2. You should now see your custom message instead of "Log in to dev-u7a2ovr5jdmdwryp"
3. The tenant domain name will be completely gone from the message

## Quick Template Search

If you can't find the exact code, search the template for:
- `{clientName}` - This is what shows "dev-u7a2ovr5jdmdwryp"
- `{appName}` - This is what shows "Noteworthy News"
- `Log in to` - The exact text you're seeing

Just remove `{clientName}` from anywhere it appears and replace the whole message with your custom text.

## Alternative: Hide Client Name Completely

If you want to remove the client name from ALL messages, you can:

1. In the template, find ALL instances of `{clientName}`
2. Replace them with empty string or remove them entirely
3. This will remove the tenant domain from all messages site-wide

## Troubleshooting

**Can't find "Branding" menu?**
- Make sure you're logged in as an admin/user with permissions
- Some Auth0 plans have limited branding options
- Contact Auth0 support if you don't see the Branding menu

**Changes not showing?**
- Wait 30 seconds for Auth0 to deploy changes
- Clear your browser cache
- Try incognito/private browsing mode
- Check that you saved the changes (there's usually a "Save" button)

**Template editor not loading?**
- Try a different browser
- Disable browser extensions
- Check Auth0 status page if there's a service issue

