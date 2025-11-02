# Customize Auth0 Login/Signup Page

## Change the Application Name

The message "Sign Up to dev-u7a2ovr5jdmdwryp to continue to My App" appears because Auth0 uses default branding. Here's how to customize it:

### Step 1: Update Application Name in Auth0 Dashboard

1. Go to https://manage.auth0.com/dashboard
2. Navigate to **Applications** → Your app (e.g., "Noteworthy News")
3. Go to **Settings** tab
4. Find **Application Name** field (usually at the top)
5. Change it from default to: **"Noteworthy News"** (or your preferred name)
6. Click **Save Changes**

### Step 2: Configure Application Display Name

The login page will now show:
- "Sign Up to **Noteworthy News**" instead of "Sign Up to dev-u7a2ovr5jdmdwryp"
- "Continue to **Noteworthy News**" instead of "Continue to My App"

### Step 3: (Optional) Customize Branding Further

For more customization (logo, colors, etc.):

1. Go to **Branding** → **Universal Login**
2. Click **Customize** button
3. Upload your logo
4. Customize colors
5. Edit the login page HTML/CSS if needed

### Step 4: Update Login Page Text (Advanced)

To change specific text like "Create Your Account":

1. Go to **Branding** → **Universal Login**
2. Click **Customize** → **Login**
3. You can edit the template HTML to change:
   - Page titles
   - Button text
   - Headings
   - Any text on the login/signup pages

**Quick Template Text Changes:**

In the login template, look for:
```html
<h1>{{trans "Create Your Account"}}</h1>
<p>{{trans "Sign Up to {clientName} to continue to {appName}."}}</p>
```

Change to:
```html
<h1>{{trans "Join Noteworthy News"}}</h1>
<p>{{trans "Create your account to access fact-checked news and media literacy tools."}}</p>
```

### Step 5: Update Application Login URL (Optional)

1. Go to **Applications** → Your app → **Settings**
2. Find **Application Login URI** field
3. Set it to: `https://noteworthynews.co/`
4. This makes the redirect message more specific

### Result

After these changes, users will see:
- **"Sign Up to Noteworthy News"** (instead of dev domain name)
- **"Continue to Noteworthy News"** (instead of "My App")
- Custom messaging if you edit the template

## Quick Fix (Minimal Steps)

**Just do Step 1** - Change the Application Name in Settings. That alone will fix the main issue you mentioned.

