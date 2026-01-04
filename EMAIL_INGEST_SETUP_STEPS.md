# Step-by-Step Setup: Email to Trigger Ingest-All

Follow these steps to set up email-triggered ingest-all functionality.

## Method 1: Simple Token-Based Setup (Easiest - 5 minutes)

This method lets you trigger ingest-all via a simple URL. Perfect for testing and quick access.

### Step 1: Set Environment Variable in Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site (`noteworthynews.co`)
3. Go to **Site settings** → **Environment variables**
4. Click **Add variable**
5. Set:
   - **Key:** `INGEST_EMAIL_TOKEN`
   - **Value:** (create a random secret, e.g., `ingest_2024_secret_abc123xyz`)
6. Click **Save**

### Step 2: Test It

Open your browser or use curl:

```
https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_SECRET_TOKEN
```

Replace `YOUR_SECRET_TOKEN` with the value you set in Step 1.

**Example:**
```
https://noteworthynews.co/.netlify/functions/inbound-email?token=ingest_2024_secret_abc123xyz
```

### Step 3: Verify It Worked

1. Go to Netlify Dashboard → **Functions** → `inbound-email`
2. Check the **Logs** tab - you should see "Ingest-all triggered successfully"
3. Go to **Functions** → `ingest-all`
4. Check the **Logs** tab - you should see the ingestion run starting

✅ **Done!** You can now trigger ingest-all by visiting that URL.

---

## Method 2: Full Email Setup (For actual email-to-ingest)

This method lets you send an email to `richard@noteworthynews.co` with "ingest" in it.

### Step 1: Choose Your Email Service

You have a few options:

**Option A: Use Gmail with Zapier (Free tier available)**
- Easiest if you already use Gmail
- Free Zapier plan allows 100 tasks/month

**Option B: Use Mailgun (Free tier: 5,000 emails/month)**
- Professional email service
- Built-in inbound email webhooks

**Option C: Use CloudMailin (Free tier available)**
- Specialized for inbound email
- Simple setup

### Step 2A: Setup with Gmail + Zapier

1. **Create Zapier Account**
   - Go to [zapier.com](https://zapier.com) and sign up (free tier works)

2. **Create a New Zap**
   - Click **Create Zap**
   - Name it: "Email to Ingest All"

3. **Set Up Trigger (Gmail)**
   - **Trigger App:** Gmail
   - **Trigger Event:** "New Email"
   - Click **Continue**
   - Connect your Gmail account
   - **Search String:** `to:richard@noteworthynews.co`
   - **Subject Contains:** `ingest` (optional, but recommended)
   - Click **Test trigger** to verify it works

4. **Add Filter (Optional but Recommended)**
   - Click **+** to add a step
   - Choose **Filter by Zapier**
   - **Condition:** Text contains
   - **Text:** `{{Trigger - Subject}}` or `{{Trigger - Body}}`
   - **Contains:** `ingest`
   - This ensures only emails with "ingest" trigger the action

5. **Set Up Action (Webhook)**
   - **Action App:** Webhooks by Zapier
   - **Action Event:** "POST"
   - **URL:** `https://noteworthynews.co/.netlify/functions/inbound-email`
   - **Method:** GET (simpler)
   - **URL (for GET):** `https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_SECRET_TOKEN`
     - Replace `YOUR_SECRET_TOKEN` with the token from Method 1, Step 1
   - OR use POST with this payload:
     ```json
     {
       "type": "email.received",
       "data": {
         "from": "{{Trigger - From Email}}",
         "to": "richard@noteworthynews.co",
         "subject": "{{Trigger - Subject}}",
         "text": "{{Trigger - Body Plain}}"
       }
     }
     ```
   - Click **Test action**

6. **Turn On Zap**
   - Click the toggle to enable the Zap
   - It's now active!

7. **Test It**
   - Send an email to `richard@noteworthynews.co` with subject "ingest"
   - Check Netlify logs to verify it triggered

### Step 2B: Setup with Mailgun

1. **Create Mailgun Account**
   - Go to [mailgun.com](https://www.mailgun.com) and sign up
   - Verify your domain (`noteworthynews.co`)

2. **Set Up Inbound Route**
   - Go to **Sending** → **Inbound Routes**
   - Click **Create Route**
   - **Expression Type:** Catch All
   - **Priority:** 0
   - **Actions:** 
     - Check "Store and notify"
     - **Webhook URL:** `https://noteworthynews.co/.netlify/functions/inbound-email`
   - Click **Create Route**

3. **Configure DNS**
   - Mailgun will provide MX records
   - Add them to your domain's DNS settings
   - Wait for DNS propagation (can take up to 48 hours)

4. **Test It**
   - Send an email to `richard@noteworthynews.co` with subject "ingest"
   - Check Netlify logs

### Step 2C: Setup with CloudMailin

1. **Create CloudMailin Account**
   - Go to [cloudmailin.com](https://www.cloudmailin.com) and sign up

2. **Add Your Domain**
   - Go to **Addresses**
   - Add `richard@noteworthynews.co`
   - CloudMailin will provide MX records

3. **Configure DNS**
   - Add the MX records to your domain's DNS
   - Wait for DNS propagation

4. **Set Up Webhook**
   - Go to **Addresses** → `richard@noteworthynews.co`
   - **Target URL:** `https://noteworthynews.co/.netlify/functions/inbound-email`
   - **Format:** JSON
   - Save

5. **Test It**
   - Send an email to `richard@noteworthynews.co` with subject "ingest"
   - Check Netlify logs

---

## Verification Checklist

After setup, verify everything works:

- [ ] Environment variable `INGEST_EMAIL_TOKEN` is set in Netlify
- [ ] Function `inbound-email` exists and is deployed
- [ ] Can access: `https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_TOKEN`
- [ ] Test email/webhook triggers the function
- [ ] Check `inbound-email` logs show successful trigger
- [ ] Check `ingest-all` logs show ingestion starting
- [ ] Email with "ingest" successfully triggers ingest-all

---

## Quick Test Commands

### Test Token-Based Trigger:
```bash
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_SECRET_TOKEN"
```

### Test Webhook Payload:
```bash
curl -X POST https://noteworthynews.co/.netlify/functions/inbound-email \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.received",
    "data": {
      "from": "test@example.com",
      "to": "richard@noteworthynews.co",
      "subject": "ingest",
      "text": "Please run ingest all"
    }
  }'
```

---

## Troubleshooting

### "Unauthorized" error
- Check that `INGEST_EMAIL_TOKEN` is set correctly in Netlify
- Make sure the token in the URL matches exactly

### Function not triggering
- Check Netlify function logs: Dashboard → Functions → `inbound-email` → Logs
- Verify the webhook URL is correct
- Check that email contains "ingest" (case-insensitive)
- Verify email is sent to `richard@noteworthynews.co`

### Ingest-all not running
- Check `ingest-all` function logs
- Verify the function can make HTTP requests to itself
- Check that `URL` or `DEPLOY_PRIME_URL` environment variable is set

---

## Need Help?

Check the logs:
1. Netlify Dashboard → Functions → `inbound-email` → Logs
2. Netlify Dashboard → Functions → `ingest-all` → Logs

The logs will show exactly what's happening at each step.

