# Earthquake Pipeline - Quick Start

## Setup (5 minutes)

1. **Set Environment Variables** in Netlify Dashboard:
   - `ALERT_TO_EMAIL` - Your email for magnitude >= 7.0 alerts
   - `RESEND_API_KEY` - Your Resend API key
   - `RESEND_FROM_EMAIL` - (Optional) From email, defaults to `richard@noteworthynews.co`

2. **Configure Schedule** in Netlify Dashboard:
   - Go to **Site Settings** → **Scheduled Functions**
   - Add: `earthquake-poller` with schedule `*/3 * * * *` (every 3 minutes)

3. **Deploy** - The functions are ready to use!

## How It Works

1. **Every 3 minutes**: `earthquake-poller` checks USGS for new earthquakes
2. **For each new quake**:
   - Generates branded image using `1stUSGSTemp.png`
   - Creates post on website
   - If magnitude >= 7.0: Sends email alert with image

## Test It

```bash
# Test mode (dry run - no posts, no emails)
curl "https://your-site.netlify.app/.netlify/functions/earthquake-poller?test=true"
```

## Files Created

- `netlify/functions/earthquake-poller.js` - Main poller
- `netlify/functions/generate-earthquake-image.js` - Image generator
- `netlify/functions/send-earthquake-alert.js` - Email alerts

## Template Positioning

If text positioning needs adjustment, edit these constants in `generate-earthquake-image.js`:

```javascript
const MAGNITUDE_X = 50;      // Horizontal position of magnitude
const MAGNITUDE_Y = 100;     // Vertical position of magnitude
const LOCATION_X = 50;       // Horizontal position of location
const LOCATION_Y = 150;      // Vertical position of location
const IMAGE_AREA_Y = 300;    // Where USGS images start
const IMAGE_AREA_HEIGHT = 400; // Height for USGS images
```

## Monitoring

Check logs in Netlify Dashboard → Functions → earthquake-poller → Logs

Look for:
- `[earthquake-poller]` - Processing status
- `[generate-earthquake-image]` - Image generation
- `[send-earthquake-alert]` - Email alerts

## Troubleshooting

**No posts appearing?**
- Check function logs
- Verify USGS feed is returning data
- Check blob store permissions

**Images not generating?**
- Verify `1stUSGSTemp.png` exists in project root
- Check function logs for errors

**Emails not sending?**
- Verify `ALERT_TO_EMAIL` and `RESEND_API_KEY` are set
- Check Resend dashboard for delivery status

## Full Documentation

See `EARTHQUAKE_PIPELINE_SETUP.md` for complete documentation.

