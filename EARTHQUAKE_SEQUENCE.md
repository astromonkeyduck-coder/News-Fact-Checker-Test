# Earthquake Pipeline - Exact Sequence of Events

## When the Next Earthquake Happens

### Step-by-Step Order (Automatic, Every 3 Minutes)

**Time: T+0 minutes** (Earthquake occurs at USGS)

---

**Time: T+0-3 minutes** (Within 3 minutes of earthquake)

1. **Scheduled Function Triggers**
   - `earthquake-poller.js` runs automatically (every 3 minutes)
   - Fetches USGS `all_hour` feed
   - Finds new earthquake in feed

2. **Deduplication Check**
   - Checks if `event_id` already exists in storage
   - If exists → **SKIP** (already processed)
   - If new → **CONTINUE**

3. **Fetch Event Details**
   - Calls USGS detail URL for this earthquake
   - Gets full event data including products/images

4. **Extract USGS Images**
   - Looks for 2 different USGS images:
     - Priority 1: Immediate products (DYFI, origin, location) - available 0-3 min
     - Priority 2: ShakeMap products - available 5-10 min
     - Priority 3: Other products (fallback)
   - Ensures images are from different product types (not duplicates)

5. **Generate Branded Image** ⚡
   - Calls `generate-earthquake-image` function
   - Loads `2ndUSGSTemp.png` template
   - Scales to 4K (2577x2160, maintains aspect ratio)
   - Adds dynamic text:
     - Magnitude (red): "M6.5"
     - Headline (white): "EARTHQUAKE NEAR"
     - Location (red): "GOROKA, PAPUA NEW GUINEA"
   - Composites 2 USGS images (if available)
   - Applies high-quality processing (lanczos3, sharpening)
   - Saves to Netlify Blob storage
   - Returns image URL

6. **Store Earthquake Data**
   - Saves earthquake metadata to storage:
     - event_id, magnitude, location, time, URLs, images, etc.
   - Marks as processed

7. **Create Website Post** 📝
   - Creates post in Netlify Blob store (`x-posts`)
   - Post includes:
     - Title: "M6.5 Earthquake Near GOROKA, PAPUA NEW GUINEA"
     - Story/Text: Human-readable description
     - Image: URL to generated 4K image
     - Link: USGS event page URL
     - Date: Earthquake timestamp
   - Adds to post index
   - **Post appears on website immediately**

8. **Send Email Alert** 📧
   - Calls `send-earthquake-alert` function
   - Downloads image from URL
   - Formats email:
     - Subject: "BREAKING: [Severity] Earthquake Near [Location] (M[X.X])"
     - Body: Human-readable message
     - Attachment: 4K branded image
   - Sends to all emails in `AI_NOTIFICATION_EMAILS` or `ALERT_TO_EMAIL`
   - Marks `alert_sent = true` in storage

9. **Complete**
   - Logs success
   - Returns results (processed, created, alerts sent)

---

## Timeline Example

**Example: M6.5 earthquake at 2:00 PM**

- **2:00 PM** - Earthquake occurs
- **2:00-2:03 PM** - USGS processes and adds to feed
- **2:03 PM** - Scheduled function runs, detects new earthquake
- **2:03 PM** - Image generation starts (takes ~5-10 seconds)
- **2:03 PM** - Post created on website
- **2:03 PM** - Email sent with image
- **2:03 PM** - Complete! ✅

**If USGS images not immediately available:**
- **2:03 PM** - Image generated with template only (no USGS images yet)
- **2:08-2:13 PM** - ShakeMap images become available
- **2:13 PM** - Next scheduled run could update post with better images (if implemented)

---

## What You'll See

1. **Website** - New post appears with 4K image
2. **Email** - Alert arrives with image attached
3. **Logs** - Netlify function logs show processing details

---

## Important Notes

- **Deduplication:** Same earthquake won't be processed twice
- **Image Quality:** Always 4K, high quality
- **Email:** Always sent (for all magnitudes, currently)
- **Timing:** Usually within 3-5 minutes of earthquake
- **Reliability:** If image generation fails, post still created (without image)

---

## Current Configuration

✅ **Image Generation:** Always  
✅ **Website Posting:** Always  
✅ **Email Alerts:** Always (all magnitudes)  
✅ **4K Output:** Enabled  
✅ **USGS Images:** 2 different images (when available)

