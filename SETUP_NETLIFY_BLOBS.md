# How to Set Up Netlify Blobs Token

## Step 1: Create a Netlify Personal Access Token

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click on your **profile icon** (top right corner)
3. Select **User settings**
4. Scroll down to **Applications** section
5. Click **New access token**
6. Give it a descriptive name like: `Blobs Token for Comments`
7. Set an expiration (or leave it as "No expiration" for production)
8. Click **Generate token**
9. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

## Step 2: Get Your Site ID

1. In Netlify Dashboard, go to your site
2. Click **Site settings** (or gear icon)
3. Scroll to **General** section
4. Find **Project information**
5. Copy the **Project ID** (this is your Site ID)

## Step 3: Set Environment Variables in Netlify

1. In your site dashboard, go to **Site settings**
2. Click **Environment variables** (under Build & deploy)
3. Click **Add a variable**
4. Add these two variables:

   **Variable 1:**
   - Key: `NETLIFY_SITE_ID`
   - Value: (paste your Project ID from Step 2)
   - **Check "Encrypted" checkbox** (mark as secret)
   - Scopes: All scopes

   **Variable 2:**
   - Key: `NETLIFY_BLOB_READ_WRITE_TOKEN`
   - Value: (paste your Personal Access Token from Step 1)
   - **Check "Encrypted" checkbox** (mark as secret - **REQUIRED for security**)
   - Scopes: All scopes

5. Click **Save**

## Step 4: Redeploy Your Site

1. After setting the environment variables, go to **Deploys**
2. Click **Trigger deploy** → **Deploy site**
3. Or just wait for the next automatic deploy from GitHub

## Alternative: Quick Token Creation Link

You can also create a token directly by visiting:
https://app.netlify.com/user/applications#personal-access-tokens

## Verification

After deploying, try posting a comment. If it works, you should see:
- Comments saved successfully in the browser console
- Comments visible across all devices
- No "MissingBlobsEnvironmentError" in the logs

## Troubleshooting

If you still see errors:

1. **Check the function logs:**
   - Go to **Functions** in your Netlify dashboard
   - Click on `comments-api`
   - Check the **Logs** tab for any errors

2. **Verify environment variables are set:**
   - Go to **Site settings** → **Environment variables**
   - Make sure both `NETLIFY_SITE_ID` and `NETLIFY_BLOB_READ_WRITE_TOKEN` are listed
   - Make sure they're set for the correct scopes (production, deploy previews, branch deploys)

3. **Check token permissions:**
   - Go back to **User settings** → **Applications**
   - Make sure your token hasn't expired or been revoked

4. **Redeploy:**
   - Sometimes you need to trigger a new deploy after adding environment variables
   - Go to **Deploys** → **Trigger deploy** → **Deploy site**

