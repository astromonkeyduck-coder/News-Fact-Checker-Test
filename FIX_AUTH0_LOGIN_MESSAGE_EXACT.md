# Fix Auth0 Login Message - Exact Changes Needed

## The Problem
Your login page shows: "Log in to dev-u7a2ovr5jdmdwryp to continue to Noteworthy News"

This comes from the `description` field in your Auth0 Universal Login template.

## What to Change

In the JSON file you showed me, change these fields:

### 1. Main Description (Most Important) ✅

**Change this:**
```json
"description": "Log in to continue to ${clientName}.",
```

**To one of these:**

**Option A (Recommended)**: Simple welcome
```json
"description": "Welcome to Noteworthy News",
```

**Option B**: Remove client name
```json
"description": "Log in to continue",
```

**Option C**: Custom message
```json
"description": "Sign in to access fact-checked news",
```

### 2. Page Title (Optional but Recommended)

**Change this:**
```json
"pageTitle": "Log in | ${clientName}",
```

**To:**
```json
"pageTitle": "Log in | Noteworthy News",
```

### 3. Invitation Description (Optional)

If you use invitations, change:
```json
"invitationDescription": "Log in to accept ${inviterName}'s invitation to join ${companyName} on ${clientName}.",
```

**To:**
```json
"invitationDescription": "Log in to accept ${inviterName}'s invitation to join ${companyName} on Noteworthy News.",
```

## Where to Make These Changes

### Method 1: Auth0 Dashboard (Recommended)

1. Go to https://manage.auth0.com/dashboard
2. Click **Branding** → **Universal Login**
3. Click **Customize Login Experience** tab
4. Click **Languages** → Select **English** (or your language)
5. Find the fields above and update them
6. Click **Save**

### Method 2: HTML Template

If you're using a custom HTML template:

1. Go to **Branding** → **Universal Login** → **Login** tab
2. Find the template HTML
3. Look for code like:
   ```html
   <p>{{trans "Log in to continue to ${clientName}."}}</p>
   ```
4. Replace with:
   ```html
   <p>{{trans "Welcome to Noteworthy News"}}</p>
   ```

### Method 3: API Configuration

If you're using the Management API, you can update the translations via:
- `PUT /api/v2/branding/templates/universal-login`
- Update the `translations` object with your custom values

## Quick Fix Summary

**Minimum change needed** (just fix the description):
```json
"description": "Welcome to Noteworthy News",
```

**Complete fix** (recommended):
```json
"description": "Welcome to Noteworthy News",
"pageTitle": "Log in | Noteworthy News",
```

After making changes:
1. Click **Save** in Auth0 Dashboard
2. Wait 1-2 minutes for changes to propagate
3. Clear browser cache or try incognito mode
4. Test the login page

The message should now show "Welcome to Noteworthy News" instead of the dev domain name!

