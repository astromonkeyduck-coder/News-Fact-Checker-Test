# Inbound Email Setup - Trigger Ingest-All via Email

This feature allows you to trigger the `ingest-all` function by sending an email to `richard@noteworthynews.co` with the word "ingest" in the subject or body.

## How It Works

1. Send an email to `richard@noteworthynews.co` with "ingest" in the subject or body
2. The inbound email webhook receives the email
3. If the email contains "ingest", it automatically triggers the `ingest-all` function
4. You'll get a response indicating whether the trigger was successful

## Setup Instructions

### Option 1: Using Resend Inbound Email (Recommended if available)

1. **Go to Resend Dashboard**
   - Visit https://resend.com/domains
   - Select your domain (`noteworthynews.co`)

2. **Set Up Inbound Route**
   - Navigate to "Inbound Routes" or "Inbound Email" section
   - Create a new inbound route for `richard@noteworthynews.co`
   - Set the webhook URL to:
     ```
     https://noteworthynews.co/.netlify/functions/inbound-email
     ```
   - Save the route

3. **Test It**
   - Send an email to `richard@noteworthynews.co` with subject "ingest"
   - Check the Netlify function logs to see if it was triggered
   - The `ingest-all` function should run automatically

### Option 2: Using Email Forwarding Service

If Resend doesn't support inbound emails, you can use a service like:

- **Mailgun** (has inbound email webhooks)
- **SendGrid** (has inbound email parsing)
- **Postmark** (has inbound email webhooks)
- **CloudMailin** (specialized inbound email service)

For any of these services:
1. Set up an inbound email route pointing to `richard@noteworthynews.co`
2. Configure the webhook URL to point to:
   ```
   https://noteworthynews.co/.netlify/functions/inbound-email
   ```
3. The function will parse the webhook payload and trigger ingest-all

### Option 3: Using Zapier/IFTTT (No-code Alternative)

1. **Set up Zapier/IFTTT**
   - Create a new Zap/Applet
   - Trigger: New email in Gmail/Outlook/etc. to `richard@noteworthynews.co`
   - Filter: Email subject or body contains "ingest"
   - Action: Webhook GET to (simplest):
     ```
     https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_SECRET_TOKEN
     ```
   - OR Webhook POST with JSON payload matching the expected format
   - Set `INGEST_EMAIL_TOKEN` in Netlify environment variables for token-based auth

## Function Details

**Function:** `netlify/functions/inbound-email.js`

**Webhook URL:** `https://noteworthynews.co/.netlify/functions/inbound-email`

**Expected Payload Format:**
```json
{
  "type": "email.received",
  "data": {
    "from": "sender@example.com",
    "to": "richard@noteworthynews.co",
    "subject": "ingest",
    "text": "Please run ingest",
    "html": "<p>Please run ingest</p>"
  }
}
```

The function will:
- Check if email is to `richard@noteworthynews.co`
- Check if subject or body contains "ingest" (case-insensitive)
- If both conditions are met, trigger `ingest-all` function
- Return success/failure status

## Testing

### Option 1: Simple Token-Based Trigger (Easiest)

You can trigger ingest-all directly with a secret token:

```bash
# Set INGEST_EMAIL_TOKEN in Netlify environment variables first
curl "https://noteworthynews.co/.netlify/functions/inbound-email?token=YOUR_SECRET_TOKEN"
```

This is useful for:
- Quick testing
- Integration with services that can make HTTP GET requests
- Email forwarding services that can trigger webhooks

### Option 2: Webhook Payload Test

You can test the function with a full webhook payload:

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

### Check Logs

1. Go to Netlify Dashboard → Functions → `inbound-email`
2. Check the logs to see if the webhook was received
3. Check `ingest-all` logs to see if it was triggered

## Security Considerations

- The function only processes emails sent TO `richard@noteworthynews.co`
- The email must contain "ingest" in the subject or body
- Consider adding additional authentication if needed (e.g., webhook secret verification)
- Monitor the function logs for any suspicious activity

## Troubleshooting

### Function not receiving emails
- Check that the inbound route is configured correctly in your email service
- Verify the webhook URL is correct and accessible
- Check Netlify function logs for errors

### Ingest-all not triggering
- Check that the email contains "ingest" (case-insensitive)
- Verify the email is sent to `richard@noteworthynews.co`
- Check `ingest-all` function logs for errors
- Verify the site URL environment variable is set correctly

### Webhook format issues
- Different email services may send different webhook formats
- Check the function logs to see the actual payload structure
- You may need to adjust the parsing logic in `inbound-email.js` to match your service's format

