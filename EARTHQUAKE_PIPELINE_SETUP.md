# Earthquake Pipeline Setup Guide

This document describes the automated earthquake pipeline that posts every earthquake to the website and sends email alerts for magnitude >= 7.0.

## Overview

The pipeline consists of three main functions:
1. **earthquake-poller.js** - Polls USGS for new earthquakes, creates posts, triggers alerts
2. **generate-earthquake-image.js** - Generates branded images using the template
3. **send-earthquake-alert.js** - Sends email alerts for magnitude >= 7.0 earthquakes

## Features

✅ **Auto-posts every earthquake** to the website with branded images  
✅ **Generates branded images** using `1stUSGSTemp.png` template  
✅ **Email alerts** for magnitude >= 7.0 with attached image  
✅ **Deduplication** - never creates duplicate posts or sends duplicate alerts  
✅ **Human-readable alerts** - no jargon, common-person wording  
✅ **Two USGS images** per branded graphic (when available)

## Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

### Required:
- `AI_NOTIFICATION_EMAILS` - Email address(es) to receive alerts for magnitude >= 7.0 (comma-separated or JSON array, same as other AI notifications)
- `RESEND_API_KEY` - Resend API key for sending emails
- `RESEND_FROM_EMAIL` - (Optional) From email address, defaults to `richard@noteworthynews.co`

**Note:** `AI_NOTIFICATION_EMAILS` can be:
- A comma-separated string: `"email1@example.com, email2@example.com"`
- A JSON array: `["email1@example.com", "email2@example.com"]`

**Backwards compatibility:** If `AI_NOTIFICATION_EMAILS` is not set, it will fall back to `ALERT_TO_EMAIL` if configured.

### Auto-configured by Netlify:
- `NETLIFY_SITE_ID` - Automatically set
- `NETLIFY_BLOB_READ_WRITE_TOKEN` - Automatically set
- `URL` - Site URL (used for generating image URLs)

## Scheduling

The earthquake poller runs on a schedule. Configure it in Netlify Dashboard:

1. Go to **Site Settings** → **Functions**
2. Find `earthquake-poller` function
3. Click **Edit** and set schedule to: `*/3 * * * *` (every 3 minutes)

Or use Netlify's scheduled functions feature:
- Go to **Site Settings** → **Build & Deploy** → **Scheduled Functions**
- Add new scheduled function:
  - Function: `earthquake-poller`
  - Schedule: `*/3 * * * *` (every 3 minutes)

**Recommended schedule:** Every 3-5 minutes for timely updates without overloading USGS API.

## Image Template

The pipeline uses `1stUSGSTemp.png` as the base template. Make sure this file exists in the project root.

### Template Layout:
- **Magnitude text** (M7.2): Red, Roboto 41.5pt, positioned before "EARTHQUAKE NEAR"
- **Location text**: Red, Roboto 41.5pt (auto-resized if too long), positioned after "EARTHQUAKE NEAR"
- **USGS images**: Two images placed in lower section, maintaining aspect ratio

### Font:
- Uses Roboto font (falls back to Arial/sans-serif if not available)
- To use actual Roboto font, download and place in `fonts/` directory:
  - `fonts/Roboto-Regular.ttf`
  - `fonts/Roboto-Bold.ttf`

## Testing

### Test Mode (Dry Run)

Run the poller in test mode to see what it would do without creating posts or sending emails:

```bash
# Via API call
curl -X GET "https://your-site.netlify.app/.netlify/functions/earthquake-poller?test=true"

# Or set environment variable
EARTHQUAKE_TEST_MODE=true
```

Test mode will:
- ✅ Fetch USGS data
- ✅ Generate images
- ✅ Show what would be posted
- ❌ NOT create actual posts
- ❌ NOT send emails

### Manual Testing

1. **Test image generation:**
```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/generate-earthquake-image" \
  -H "Content-Type: application/json" \
  -d '{
    "magnitude": 7.5,
    "location": "SOUTHERN CALIFORNIA",
    "eventId": "test-123",
    "usgsImages": []
  }'
```

2. **Test email alert (use test magnitude < 7.0 to avoid sending):**
```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/send-earthquake-alert" \
  -H "Content-Type: application/json" \
  -d '{
    "earthquake": {
      "magnitude": 6.5,
      "location_display": "TEST LOCATION",
      "time_ms": 1234567890,
      "usgs_event_url": "https://example.com"
    }
  }'
```

## Data Storage

### Earthquake Data
Stored in Netlify Blobs store: `earthquakes`
- Key format: `earthquake-{event_id}.json`
- Contains: event_id, magnitude, location, time, USGS URLs, images, alert_sent flag

### Posts
Stored in Netlify Blobs store: `x-posts` (same as regular posts)
- Key format: `post-eq-{event_id}.json`
- Added to `index.json` for display on website
- Category: "Earthquake"
- Source: "USGS"

### Images
Stored in Netlify Blobs store: `post-media`
- Key format: `earthquake-{event_id}-{timestamp}.png`
- Retrieved via: `/.netlify/functions/get-uploaded-image?key={key}`

## Acceptance Tests

The pipeline must pass these tests:

1. ✅ **New quake appears on website** - When a new quake appears, website shows new entry with branded image
2. ✅ **Branded image format**:
   - Uses `1stUSGSTemp.png` as background
   - Magnitude in red Roboto 41.5pt before "EARTHQUAKE NEAR"
   - Location after it, auto-resized if too long, same red, aligned above red line
   - Two distinct USGS images placed cleanly without covering text
3. ✅ **No email for < 7.0** - Quakes under 7.0: NO email sent
4. ✅ **Email for >= 7.0** - Quakes at/over 7.0: email sent with attachment + common-person wording
5. ✅ **No duplicates** - No duplicate posting or duplicate emails for same event_id

## Troubleshooting

### Images not generating
- Check that `1stUSGSTemp.png` exists in project root
- Check function logs for image generation errors
- Verify USGS images are being fetched (check `usgsImages` array in logs)

### Emails not sending
- Verify `ALERT_TO_EMAIL` is set
- Verify `RESEND_API_KEY` is set and valid
- Check Resend dashboard for delivery status
- Check function logs for email errors

### Duplicate posts
- Check that `earthquakeExists()` is working correctly
- Verify event_id is stable (USGS provides stable IDs)
- Check blob store for existing earthquakes

### Template positioning issues
- Adjust `MAGNITUDE_X`, `MAGNITUDE_Y`, `LOCATION_X`, `LOCATION_Y` in `generate-earthquake-image.js`
- Adjust `IMAGE_AREA_Y`, `IMAGE_AREA_HEIGHT` for USGS image placement

## Local Development

To test locally:

```bash
# Install dependencies
npm install

# Run Netlify dev
npm run dev

# Test poller (test mode)
curl "http://localhost:8888/.netlify/functions/earthquake-poller?test=true"
```

## Monitoring

Check function logs in Netlify Dashboard:
- **Site Settings** → **Functions** → **earthquake-poller** → **Logs**

Look for:
- `[earthquake-poller]` - Poller activity
- `[generate-earthquake-image]` - Image generation
- `[send-earthquake-alert]` - Email alerts

## USGS Data Source

- **Feed URL**: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`
- **Detail API**: Each event has a `detail` URL for full product data
- **Event IDs**: Stable, unique identifiers for deduplication
- **Images**: Extracted from shakemap and other product types

## Support

For issues or questions:
1. Check function logs
2. Verify environment variables
3. Test in test mode first
4. Check USGS API status

