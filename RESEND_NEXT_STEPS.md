# Next Steps: Your Receiving is Already Set Up! ✅

Great news! Your domain receiving is enabled and the MX record is verified. Now you just need to:

## Step 1: Create Webhook (2 minutes)

1. **Go to Webhooks**
   - Visit: https://resend.com/webhooks
   - Or: Dashboard → **Webhooks**

2. **Click "Add Webhook"**

3. **Configure:**
   - **Endpoint URL:** 
     ```
     https://noteworthynews.co/.netlify/functions/inbound-email
     ```
   - **Events:** Check `email.received` (make sure it's selected)
   - **Description:** "Trigger ingest-all"
   - Click **Add** or **Create**

4. **Copy the Signing Secret**
   - After creating, you'll see a **Signing Secret**
   - It starts with `whsec_...`
   - **Copy this immediately** - you'll need it for the next step

## Step 2: Add Environment Variables in Netlify (2 minutes)

1. **Go to Netlify Dashboard**
   - Visit: https://app.netlify.com
   - Select your site (`noteworthynews.co`)

2. **Add Environment Variables**
   - Go to: **Site settings** → **Environment variables**
   - Click **Add variable**

3. **Add Webhook Secret:**
   - **Key:** `RESEND_WEBHOOK_SECRET`
   - **Value:** Paste the signing secret from Step 1
   - Click **Save**

4. **Add Token (Optional but Recommended for Testing):**
   - Click **Add variable** again
   - **Key:** `INGEST_EMAIL_TOKEN`
   - **Value:** Create a secret (e.g., `ingest_2024_secret_xyz123`)
   - Click **Save**

5. **Redeploy Site** (Important!)
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This makes the new environment variables available to your functions

## Step 3: Test It! (30 seconds)

### Quick Test (Token Method - Works Immediately):
```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_INGEST_EMAIL_TOKEN"
```
Replace `YOUR_INGEST_EMAIL_TOKEN` with the value you set in Step 2.

**Expected Response:**
```json
{"success":true,"message":"Ingest-all triggered successfully via token"}
```

### Full Test (Email Method):
1. Send an email to `richard@noteworthynews.co`
2. **Subject:** `ingest` (or include "ingest" anywhere in the email)
3. Check Netlify logs:
   - **Functions** → `inbound-email` → **Logs** (should show webhook received)
   - **Functions** → `ingest-all` → **Logs** (should show ingestion starting)

## That's It! 🎉

Once you complete Steps 1 and 2, you can:
- Send an email to `richard@noteworthynews.co` with "ingest" in subject/body
- It will automatically trigger `ingest-all`

## Quick Reference

**Webhook URL to use:**
```
https://noteworthynews.co/.netlify/functions/inbound-email
```

**Resend Webhooks:**
https://resend.com/webhooks

**Netlify Environment Variables:**
Site settings → Environment variables

**Test Command:**
```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_TOKEN"
```

