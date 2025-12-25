# Current Earthquake Pipeline Configuration

## How It Works

The earthquake pipeline runs automatically and processes **every earthquake** detected by USGS.

### Schedule
- **Function:** `earthquake-poller.js`
- **Runs:** Every 3 minutes (configured in Netlify Dashboard → Scheduled Functions)
- **Feed:** USGS `all_hour` feed (earthquakes from the last hour)

### What Happens for Each Earthquake

1. **Detection** - Polls USGS feed every 3 minutes
2. **Deduplication** - Checks if earthquake already processed (by `event_id`)
3. **Image Generation** - **ALWAYS** generates a branded 4K image with:
   - Template base layer
   - Dynamic text (magnitude, headline, location)
   - Two different USGS images (if available)
4. **Website Post** - **ALWAYS** creates a post on the website with the image
5. **Email Alert** - **ALWAYS** sends email alert with image attached

### Email Configuration

**Environment Variables Required:**
- `AI_NOTIFICATION_EMAILS` - Comma-separated list or JSON array of email addresses
- OR `ALERT_TO_EMAIL` - Single email address (fallback)
- `RESEND_API_KEY` - Resend API key for sending emails
- `RESEND_FROM_EMAIL` - From email address (defaults to richard@noteworthynews.co)

**Email Content:**
- Subject: "BREAKING: [Severity] Earthquake Near [Location] (M[X.X])"
- Body: Human-readable message with earthquake details
- Attachment: Branded 4K image

### Image Quality

- **Resolution:** 2577x2160 (4K, maintains aspect ratio)
- **Quality:** Maximum (lanczos3 resampling, no compression)
- **Text:** Optimized rendering with crisp fonts
- **USGS Images:** Two different images composited

### Current Settings

✅ **Image Generation:** Enabled for ALL earthquakes  
✅ **Website Posting:** Enabled for ALL earthquakes  
✅ **Email Alerts:** Enabled for ALL earthquakes (temporary for testing)

### To Change Email Alert Threshold

Edit `netlify/functions/earthquake-poller.js` line ~576:
```javascript
// Current: Send for ALL earthquakes
if (!testMode) {

// To only send for magnitude >= 7.0:
if (magnitude >= 7.0 && !testMode) {
```

### Monitoring

Check Netlify Function logs to see:
- How many earthquakes processed
- How many posts created
- How many alerts sent
- Any errors

### Next Steps

1. Monitor email volume (you'll get an email for EVERY earthquake)
2. Adjust threshold if needed (see above)
3. The pipeline runs automatically - no manual intervention needed

