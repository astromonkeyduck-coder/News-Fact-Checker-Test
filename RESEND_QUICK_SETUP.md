# Quick Setup: Resend Email-to-Ingest (Domain Already Verified)

Since your domain is already verified, here's the streamlined setup:

## Step 1: Set Up Inbound Email Routing (2 minutes)

1. **Go to Resend Inbound**
   - Visit: https://resend.com/inbound
   - Or: Dashboard → **Receiving** → **Inbound**

2. **Add MX Record to Your DNS**
   - Resend will show you the MX record to add
   - It should be something like:
     ```
     Type: MX
     Name: @ (or leave blank for root domain)
     Value: inbound.resend.com
     Priority: 10
     ```
   - Add this to wherever you manage DNS (Cloudflare, Namecheap, etc.)
   - **Note:** This is different from the sending MX records - this is specifically for receiving emails

3. **Wait for DNS Propagation**
   - Usually takes 5-30 minutes
   - Resend will automatically detect when it's ready
   - You'll see a green checkmark when verified

## Step 2: Create Webhook (1 minute)

1. **Go to Resend Webhooks**
   - Visit: https://resend.com/webhooks
   - Or: Dashboard → **Webhooks**

2. **Click "Add Webhook"**

3. **Configure:**
   - **Endpoint URL:** 
     ```
     https://noteworthynews.co/.netlify/functions/inbound-email
     ```
   - **Events:** Check `email.received`
   - **Description:** "Trigger ingest-all"
   - Click **Add**

4. **Copy the Signing Secret**
   - It will show: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Copy this immediately** (you won't see it again)

## Step 3: Add Environment Variables in Netlify (2 minutes)

1. **Netlify Dashboard** → Your site → **Site settings** → **Environment variables**

2. **Add Webhook Secret:**
   - Click **Add variable**
   - **Key:** `RESEND_WEBHOOK_SECRET`
   - **Value:** Paste the signing secret from Step 2
   - Click **Save**

3. **Add Token (Optional but Recommended for Testing):**
   - Click **Add variable** again
   - **Key:** `INGEST_EMAIL_TOKEN`
   - **Value:** Create a secret (e.g., `ingest_2024_secret_xyz123`)
   - Click **Save**

4. **Redeploy Site:**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This makes the new environment variables available

## Step 4: Test It (30 seconds)

### Quick Test (Token Method):
```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_INGEST_EMAIL_TOKEN"
```
Replace `YOUR_INGEST_EMAIL_TOKEN` with what you set in Step 3.

### Full Test (Send Email):
1. Send an email to `richard@noteworthynews.co`
2. **Subject:** `ingest` (or include "ingest" in the body)
3. Check Netlify logs:
   - **Functions** → `inbound-email` → **Logs** (should show webhook received)
   - **Functions** → `ingest-all` → **Logs** (should show ingestion starting)

## That's It! ✅

Once DNS propagates (Step 1), you can:
- Send email to `richard@noteworthynews.co` with "ingest" in subject/body
- It will automatically trigger `ingest-all`

## Troubleshooting

**MX record not working?**
- Check DNS propagation: `dig MX noteworthynews.co` (should show `inbound.resend.com`)
- Make sure you added the **inbound** MX record (different from sending records)
- Wait up to 48 hours for full propagation

**Webhook not firing?**
- Verify webhook URL is correct
- Check webhook is enabled in Resend
- Check Netlify function logs for errors

**Function not triggering?**
- Make sure email contains "ingest" (case-insensitive)
- Verify email is to `richard@noteworthynews.co`
- Check both `inbound-email` and `ingest-all` logs

