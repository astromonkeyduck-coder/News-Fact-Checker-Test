# Resend Email-to-Ingest Setup Guide

Step-by-step instructions to set up email-triggered ingest-all using Resend.

## Prerequisites

- Resend account with `noteworthynews.co` domain verified
- Netlify site deployed with the `inbound-email` function

---

## Step 1: Set Up Inbound Email in Resend

### Option A: Use Your Custom Domain (Recommended)

1. **Go to Resend Dashboard**
   - Visit https://resend.com/inbound
   - Or go to: Dashboard → **Receiving** → **Inbound**

2. **Add Your Domain**
   - Click **Add Domain** or **Configure Domain**
   - Select `noteworthynews.co` (must be verified in Resend)
   - If domain not verified, go to **Domains** first and verify it

3. **Configure DNS Records**
   - Resend will show you MX records to add
   - Example:
     ```
     Type: MX
     Name: @ (or your subdomain)
     Value: inbound.resend.com
     Priority: 10
     ```
   - Add these records to your domain's DNS (wherever you manage DNS)
   - Wait for DNS propagation (usually 5-30 minutes, can take up to 48 hours)

4. **Verify DNS**
   - Resend will automatically verify when DNS propagates
   - You'll see a green checkmark when ready

### Option B: Use Resend's Default Domain (For Testing)

1. **Get Your Resend Email Address**
   - Go to https://resend.com/inbound
   - Click the three dots (⋯) next to "Receiving address"
   - Select **"Receiving address"**
   - Copy your assigned email (e.g., `yourname@resend.app`)
   - **Note:** You'll need to use this email instead of `richard@noteworthynews.co` for testing

---

## Step 2: Configure Webhook in Resend

1. **Go to Webhooks**
   - Visit https://resend.com/webhooks
   - Or: Dashboard → **Webhooks**

2. **Create New Webhook**
   - Click **Add Webhook** or **Create Webhook**

3. **Configure Webhook**
   - **Endpoint URL:** 
     ```
     https://noteworthynews.co/.netlify/functions/inbound-email
     ```
   - **Events:** Select `email.received`
   - **Description:** "Trigger ingest-all on email"
   - Click **Add** or **Create**

4. **Copy Webhook Secret**
   - After creating, Resend will show you a **Signing Secret**
   - **IMPORTANT:** Copy this secret immediately (you won't see it again)
   - It looks like: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 3: Set Environment Variables in Netlify

1. **Go to Netlify Dashboard**
   - Visit https://app.netlify.com
   - Select your site (`noteworthynews.co`)

2. **Add Environment Variables**
   - Go to **Site settings** → **Environment variables**
   - Click **Add variable**

3. **Add Webhook Secret** (Recommended for Security)
   - **Key:** `RESEND_WEBHOOK_SECRET`
   - **Value:** Paste the signing secret from Step 2
   - Click **Save**

4. **Add Token for GET Requests** (Optional but Useful)
   - Click **Add variable** again
   - **Key:** `INGEST_EMAIL_TOKEN`
   - **Value:** Create a random secret (e.g., `ingest_secret_2024_xyz123`)
   - Click **Save**

5. **Redeploy Site** (Important!)
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This ensures the new environment variables are available

---

## Step 4: Test the Setup

### Test 1: Quick Token Test (Easiest)

Test the function directly with a token:

```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_INGEST_EMAIL_TOKEN"
```

Replace `YOUR_INGEST_EMAIL_TOKEN` with the value you set in Step 3.

**Expected Result:**
- Should return: `{"success":true,"message":"Ingest-all triggered successfully via token"}`
- Check `ingest-all` logs to see it running

### Test 2: Send Test Email

1. **Send Email**
   - Send an email to `richard@noteworthynews.co` (or your Resend test address)
   - **Subject:** `ingest` (or include "ingest" in the body)
   - **From:** Any email address

2. **Check Logs**
   - Go to Netlify Dashboard → **Functions** → `inbound-email` → **Logs**
   - You should see:
     ```
     [Inbound Email] Received webhook: ...
     [Inbound Email] Email contains "ingest" command, triggering ingest-all...
     [Inbound Email] ingest-all triggered successfully
     ```

3. **Verify Ingest-All Ran**
   - Go to **Functions** → `ingest-all` → **Logs**
   - You should see the ingestion starting

---

## Step 5: Verify Everything Works

✅ **Checklist:**

- [ ] DNS MX records added and verified in Resend
- [ ] Webhook created in Resend with correct URL
- [ ] `RESEND_WEBHOOK_SECRET` set in Netlify (optional but recommended)
- [ ] `INGEST_EMAIL_TOKEN` set in Netlify (for GET requests)
- [ ] Site redeployed after adding environment variables
- [ ] Test email sent to `richard@noteworthynews.co` with "ingest"
- [ ] `inbound-email` logs show webhook received
- [ ] `ingest-all` logs show ingestion running

---

## How It Works

1. **You send email** to `richard@noteworthynews.co` with "ingest" in subject/body
2. **Resend receives** the email via MX records
3. **Resend sends webhook** to your Netlify function
4. **Function checks:**
   - Email is to `richard@noteworthynews.co` ✓
   - Email contains "ingest" ✓
5. **Function triggers** `ingest-all` automatically
6. **Ingest-all runs** all enabled engines

---

## Troubleshooting

### Email Not Received by Resend

**Problem:** Emails sent to `richard@noteworthynews.co` aren't being received

**Solutions:**
- Check DNS MX records are correct and propagated (use `dig MX noteworthynews.co`)
- Verify domain is verified in Resend Dashboard → Domains
- Wait up to 48 hours for DNS propagation
- Check spam folder
- Try using Resend's test domain first to verify webhook works

### Webhook Not Triggering

**Problem:** Resend receives email but webhook doesn't fire

**Solutions:**
- Check webhook URL is correct: `https://noteworthynews.co/.netlify/functions/inbound-email`
- Verify webhook is enabled in Resend Dashboard
- Check webhook events include `email.received`
- Check Netlify function logs for errors
- Test webhook manually with curl (see Test 1 above)

### Function Not Triggering Ingest-All

**Problem:** Webhook received but ingest-all doesn't run

**Solutions:**
- Check `inbound-email` logs for errors
- Verify email contains "ingest" (case-insensitive)
- Verify email is to `richard@noteworthynews.co`
- Check `ingest-all` function exists and is deployed
- Verify site URL environment variable is set

### Signature Verification Failing

**Problem:** Getting "Invalid signature" errors

**Solutions:**
- Verify `RESEND_WEBHOOK_SECRET` matches the secret from Resend
- Make sure secret doesn't have extra spaces
- Redeploy site after setting environment variable
- Check Resend webhook shows correct signing secret

---

## Security Notes

- **Webhook Secret:** Always set `RESEND_WEBHOOK_SECRET` in production to verify webhooks are from Resend
- **Token:** The `INGEST_EMAIL_TOKEN` adds an extra layer for GET requests
- **Email Filtering:** Function only processes emails to `richard@noteworthynews.co` with "ingest"
- **Logs:** Monitor Netlify function logs for suspicious activity

---

## Quick Reference

**Webhook URL:**
```
https://noteworthynews.co/.netlify/functions/inbound-email
```

**Resend Dashboard:**
- Inbound: https://resend.com/inbound
- Webhooks: https://resend.com/webhooks
- Domains: https://resend.com/domains

**Netlify Dashboard:**
- Environment Variables: Site settings → Environment variables
- Function Logs: Functions → `inbound-email` → Logs

**Test Command:**
```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_TOKEN"
```

---

## Next Steps

Once setup is complete:
- Send an email to `richard@noteworthynews.co` with subject "ingest"
- The `ingest-all` function will run automatically
- Check logs to verify it's working
- You can now trigger ingest-all from anywhere by sending an email!

