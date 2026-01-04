# Resend Email-to-Ingest Setup (Correct Steps)

## Step 1: Enable Receiving on Your Domain

1. **Go to Domains in Resend**
   - Visit: https://resend.com/domains
   - Or: Dashboard → **Domains**

2. **Click on Your Domain** (`noteworthynews.co`)

3. **Find the "Receiving" Section**
   - Scroll down in the domain details page
   - Look for a **"Receiving"** section or toggle
   - **Enable receiving** (there should be a toggle or button)

4. **Add MX Record**
   - Resend will show you the MX record to add
   - It will be something like:
     ```
     Type: MX
     Name: @ (or blank for root domain)
     Value: inbound.resend.com
     Priority: 10
     ```
   - Add this to your DNS provider (wherever you manage DNS)
   - Click **"I've added the record"** or **"Verify"** in Resend

5. **Wait for Verification**
   - Resend will verify the MX record
   - Usually takes 5-30 minutes
   - You'll see a green checkmark when ready

## Step 2: Create Webhook

1. **Go to Webhooks**
   - Visit: https://resend.com/webhooks
   - Or: Dashboard → **Webhooks**

2. **Click "Add Webhook"**

3. **Configure:**
   - **Endpoint URL:** 
     ```
     https://noteworthynews.co/.netlify/functions/inbound-email
     ```
   - **Events:** Select `email.received` (check the box)
   - **Description:** "Trigger ingest-all"
   - Click **Add**

4. **Copy the Signing Secret**
   - After creating, you'll see a **Signing Secret**
   - It starts with `whsec_...`
   - **Copy this immediately** - you'll need it for Step 3

## Step 3: Add Environment Variables in Netlify

1. **Netlify Dashboard**
   - Go to your site → **Site settings** → **Environment variables**

2. **Add Webhook Secret:**
   - Click **Add variable**
   - **Key:** `RESEND_WEBHOOK_SECRET`
   - **Value:** Paste the signing secret from Step 2
   - Click **Save**

3. **Add Token (Optional but Recommended):**
   - Click **Add variable** again
   - **Key:** `INGEST_EMAIL_TOKEN`
   - **Value:** Create a secret (e.g., `ingest_2024_secret_xyz123`)
   - Click **Save**

4. **Redeploy Site:**
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - This makes the new environment variables available

## Step 4: Test It

### Quick Test (Before DNS Propagates):
```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_INGEST_EMAIL_TOKEN"
```

### Full Test (After DNS Propagates):
1. Send an email to `richard@noteworthynews.co`
2. **Subject:** `ingest` (or include "ingest" in the body)
3. Check Netlify logs:
   - **Functions** → `inbound-email` → **Logs**
   - **Functions** → `ingest-all` → **Logs**

## Important Notes

- **If you already have MX records** for email (like Gmail, Outlook, etc.), you might need to use a subdomain instead:
  - Set up `inbound.noteworthynews.co` for Resend
  - Then send emails to `richard@inbound.noteworthynews.co`
  - Or configure email forwarding from your main email to the subdomain

- **The "Receiving" section** is in the **Domains** page, not a separate "Receiving" page

## Troubleshooting

**Can't find "Receiving" section?**
- Make sure you clicked on your specific domain (not just the domains list)
- Scroll down in the domain details page
- It might be labeled as "Inbound Email" or "Email Receiving"

**MX record conflict?**
- If you already have MX records, use a subdomain:
  - Create `inbound.noteworthynews.co` in Resend
  - Add MX record for `inbound` subdomain
  - Send emails to `richard@inbound.noteworthynews.co`

**Still not working?**
- Check DNS propagation: `dig MX noteworthynews.co`
- Verify webhook is enabled and URL is correct
- Check Netlify function logs for errors

