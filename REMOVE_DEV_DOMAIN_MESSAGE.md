# Remove "dev-u7a2ovr5jdmdwryp" from Login Message - Exact Steps

## The Problem
The login page shows: **"Log in to dev-u7a2ovr5jdmdwryp to continue to Noteworthy News"**

This message comes from Auth0's Universal Login template and **must be edited in the Auth0 Dashboard** - it cannot be changed via code.

## Solution: Edit the Template Directly

### Step 1: Go to Universal Login Template

1. **Open Auth0 Dashboard**: https://manage.auth0.com/dashboard
2. Click **Branding** in the left sidebar
3. Click **Universal Login**
4. You'll see tabs: **Login** and **Sign Up** (or a template selector)
5. Click **Login** tab

### Step 2: Find the Message Code

In the template editor, you need to find this code. It's usually around lines 30-80. Look for:

```html
<p>{% raw %}{{trans "Log in to {clientName} to continue to {appName}."}}{% endraw %}</p>
```

OR it might be:

```html
<p>{% raw %}{{trans "Sign in to {clientName}"}}{% endraw %}</p>
```

OR:

```html
<h2>{% raw %}{{trans "Log in to {clientName} to continue to {appName}."}}{% endraw %}</h2>
```

### Step 3: Replace It

**Option 1: Remove clientName completely (RECOMMENDED)**
```html
<p>{% raw %}{{trans "Welcome to Noteworthy News"}}{% endraw %}</p>
```

**Option 2: Just show app name**
```html
<p>{% raw %}{{trans "Log in to Noteworthy News"}}{% endraw %}</p>
```

**Option 3: Custom message**
```html
<p>{% raw %}{{trans "Sign in to access fact-checked news"}}{% endraw %}</p>
```

### Step 4: Search and Replace in Template

The easiest way is to:
1. In the template editor, press **Ctrl+F** (or Cmd+F on Mac)
2. Search for: `{clientName}`
3. You'll find all instances of it
4. Replace each one:
   - Remove `{clientName}` from the text
   - Or replace the whole paragraph with your custom message

### Step 5: Also Fix Sign Up Page

1. Still in **Branding** → **Universal Login**
2. Click **Sign Up** tab
3. Search for `{clientName}` again
4. Replace it the same way

### Step 6: Save and Test

1. Click **Save** button (usually at bottom right)
2. Wait 10-30 seconds for Auth0 to deploy
3. Test by clicking "Sign In" on your website
4. The message should now be gone!

## Common Template Locations

The message might be in these sections of the template:
- Inside `<div class="auth0-lock-header">` 
- Inside `<div class="auth0-lock-widget">`
- Near `<h1>` or `<h2>` tags
- In the subtitle/description area

## Quick Template Fix (Copy-Paste Ready)

If you want a simple replacement, find this pattern:

**Find:**
```html
{% raw %}{{trans "Log in to {clientName} to continue to {appName}."}}{% endraw %}
```

**Replace with:**
```html
{% raw %}{{trans "Welcome to Noteworthy News"}}{% endraw %}
```

## If You Can't Find Branding Menu

If you don't see the **Branding** menu:
1. You might need admin permissions - contact your Auth0 account owner
2. Some free tiers have limited branding options
3. Try going directly to: https://manage.auth0.com/dashboard/us/YOUR_TENANT/branding
   (Replace YOUR_TENANT with your tenant name)

## Alternative: Use Lock.js Customization (Advanced)

If template editing isn't available, you can try using Lock.js customization, but this is more complex and may not completely hide the message.

## Troubleshooting

**Changes not appearing?**
- Clear browser cache
- Wait 30 seconds - Auth0 needs time to deploy
- Try incognito/private window
- Check that you clicked "Save" in the template editor

**Can't edit template?**
- Your Auth0 plan might not allow template editing
- You may need to upgrade your Auth0 plan
- Contact Auth0 support for help

**Still seeing old message?**
- Make sure you edited BOTH Login AND Sign Up templates
- Check for typos in your replacements
- Verify the template saved (there should be a "Saved" confirmation)

