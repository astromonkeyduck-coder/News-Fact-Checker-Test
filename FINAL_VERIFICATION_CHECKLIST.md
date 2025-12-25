# Final Verification Checklist

## ✅ Code Verification

### 1. Force Email Logic
- ✅ `isMostRecent = i === 0` correctly identifies the first (most recent) earthquake
- ✅ `forceEmail` parameter is passed to `processEarthquake` for most recent earthquake
- ✅ Force email logic temporarily resets `alert_sent` to send email even if already sent
- ✅ Email is sent via `send-earthquake-alert` function which attaches the image

### 2. Email Sending
- ✅ `send-earthquake-alert.js` downloads image from URL
- ✅ Image is attached to email as base64 attachment
- ✅ Email uses `AI_NOTIFICATION_EMAILS` or falls back to `ALERT_TO_EMAIL`
- ✅ Email subject and body are human-readable (no jargon)

### 3. Image Generation
- ✅ `generateBrandedImage` creates image using `2ndUSGSTemp.png` template
- ✅ Two distinct USGS images are extracted and placed on template
- ✅ Dynamic text (magnitude, headline, location) is correctly positioned
- ✅ Image is saved to Netlify Blob storage and URL is returned

### 4. Database Storage
- ✅ Events are stored in `verified_events` table in Supabase
- ✅ `alert_sent` status is tracked to prevent duplicate emails
- ✅ `canonical_id` is used for deduplication
- ✅ Website posts are created via `createPostFromEvent`

### 5. Scheduled Function
- ✅ `ingest-all.js` has `exports.config = { schedule: '*/5 * * * *' }`
- ✅ Function runs all enabled engines sequentially
- ✅ USGS engine is enabled when `ENABLE_USGS=true`

## 🔧 Environment Variables Required

### Critical (Must Be Set)
1. **`SUPABASE_URL`** - Your Supabase project URL
   - Format: `https://xxxxx.supabase.co`
   - Location: Supabase Dashboard → Project Settings → API → Project URL

2. **`SUPABASE_SERVICE_ROLE_KEY`** - Service role key (NOT anon key)
   - Format: Long string starting with `eyJ...`
   - Location: Supabase Dashboard → Project Settings → API → service_role key
   - ⚠️ **CRITICAL**: Must use service_role key, not anon key

3. **`RESEND_API_KEY`** - Resend API key for sending emails
   - Location: Resend Dashboard → API Keys

4. **`AI_NOTIFICATION_EMAILS`** - Comma-separated list or JSON array of email addresses
   - Format: `email1@example.com,email2@example.com` OR `["email1@example.com","email2@example.com"]`
   - Fallback: `ALERT_TO_EMAIL` (single email)

5. **`ENABLE_USGS`** - Must be set to `true` to enable USGS engine
   - Format: `true` (string) or `1`

### Optional
- **`RESEND_FROM_EMAIL`** - From address for emails (defaults to `richard@noteworthynews.co`)
- **`DRY_RUN`** - Set to `true` to test without sending emails
- **`NETLIFY_BLOB_READ_WRITE_TOKEN`** - For storing images (auto-configured on Netlify)
- **`NETLIFY_SITE_ID`** - For Netlify Blob storage (auto-configured on Netlify)

## 📋 Pre-Deployment Checklist

Before committing and pushing, verify:

- [ ] Supabase tables created (`verified_events` and `engine_runs`)
- [ ] `SUPABASE_URL` added to Netlify environment variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` added to Netlify environment variables (service_role, not anon)
- [ ] `RESEND_API_KEY` added to Netlify environment variables
- [ ] `AI_NOTIFICATION_EMAILS` added to Netlify environment variables
- [ ] `ENABLE_USGS=true` added to Netlify environment variables
- [ ] All environment variables are set in Netlify Dashboard → Site Settings → Environment Variables

## 🚀 What Will Happen After Push

1. **Deployment**: Netlify will build and deploy the site
2. **Scheduled Function**: `ingest-all` will automatically be scheduled to run every 5 minutes
3. **First Run**: When `ingest-all` runs:
   - Fetches USGS earthquake feed
   - Processes the most recent earthquake (first in feed)
   - **Forces email** even if `alert_sent` is true (verification email)
   - Generates branded image
   - Creates website post
   - Sends email with image attachment
4. **Future Runs**: Every 5 minutes, processes new earthquakes and sends alerts

## 📧 Email Verification

After deployment, you should receive an email:
- **Subject**: `BREAKING: [Severity] Earthquake Near [Location] (M[Magnitude])`
- **Body**: Human-readable message with earthquake details
- **Attachment**: Branded image (PNG) with magnitude, location, and USGS images

## 🔍 Troubleshooting

If no email is received:

1. **Check Netlify Function Logs**:
   - Netlify Dashboard → Functions → `ingest-all` → View logs
   - Look for errors or warnings

2. **Check Environment Variables**:
   - Verify all required variables are set
   - Check for typos (especially `ENABLE_USGS=true` not `ENABLE_USGS="true"`)

3. **Check Supabase**:
   - Verify tables exist: `verified_events` and `engine_runs`
   - Check `engine_runs` table for recent runs
   - Check `verified_events` table for stored earthquakes

4. **Check Resend Dashboard**:
   - Resend Dashboard → Emails → View sent emails
   - Check for delivery failures

5. **Manually Trigger Function**:
   - Netlify Dashboard → Functions → `ingest-all` → Trigger function
   - This will force an immediate run

## ✅ Success Indicators

You'll know it's working when:
- ✅ Email arrives with earthquake alert and image attachment
- ✅ Website shows new earthquake post with branded image
- ✅ `verified_events` table in Supabase has earthquake records
- ✅ `engine_runs` table shows successful runs
- ✅ Resend Dashboard shows sent emails
