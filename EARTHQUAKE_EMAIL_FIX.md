# Earthquake Email Fix

## Problem Identified

The `sendEmailAlert` function was trying to access `earthquake.magnitude`, but the stored event object doesn't have a `magnitude` field. The magnitude is only stored in:
- `raw.properties.mag` (the original USGS feature)
- Not as a direct field on the event

This caused emails to fail silently because `magnitude` was `undefined`, and the email function requires it.

## Fix Applied

### 1. Store Magnitude in Assets
Added `magnitude` to the `assets` JSONB field when creating events:
```javascript
assets: {
  usgs_images: usgsImages,
  magnitude: magnitude, // Store magnitude in assets for easy access
},
```

### 2. Extract Magnitude from Multiple Sources
Updated `sendEmailAlert` to extract magnitude from multiple possible locations:
```javascript
// Extract magnitude from event - it might be in earthquake.magnitude, assets.magnitude, or raw.properties.mag
let magnitude = earthquake.magnitude;
if (!magnitude && earthquake.assets?.magnitude) {
  magnitude = earthquake.assets.magnitude;
}
if (!magnitude && earthquake.raw?.properties?.mag) {
  magnitude = earthquake.raw.properties.mag;
}
if (!magnitude) {
  logger.error('Cannot send email: magnitude not found in event', null, { canonical_id: earthquake.canonical_id });
  return false;
}
```

### 3. Use Extracted Magnitude
Updated the payload sent to `send-earthquake-alert` to use the extracted magnitude:
```javascript
magnitude: magnitude, // Use extracted magnitude
```

## What This Fixes

- ✅ Emails will now be sent for earthquakes (magnitude is now accessible)
- ✅ Works for both new and existing events
- ✅ Falls back to `raw.properties.mag` if magnitude isn't in assets
- ✅ Logs error if magnitude truly can't be found

## Testing

After deployment, check:
1. **Function Logs**: Look for "Sending email alert" messages with magnitude values
2. **Email Delivery**: You should receive earthquake emails
3. **Error Logs**: If magnitude still can't be found, you'll see an error log

## Next Steps

1. Commit and push this fix
2. Wait for next earthquake (or manually trigger `ingest-all`)
3. Verify email is received with correct magnitude
