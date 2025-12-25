# Testing Earthquake Images

This guide shows you how to test what the earthquake images will look like before deploying.

## Quick Test (Recommended)

### Step 1: Start Netlify Dev

```bash
npm run dev
```

This starts the local development server at `http://localhost:8888`

### Step 2: Run the Visual Test

In a new terminal:

```bash
npm run test:earthquake
```

Or directly:

```bash
node test-earthquake-visual.js
```

### Step 3: Check the Results

The script will:
- Generate test images for different scenarios
- Save them to `test-output/` directory
- Show you the file paths

Open the images in `test-output/` to see how they look!

## Manual Testing via API

You can also test the image generation function directly:

### Test Image Generation

```bash
curl -X POST "http://localhost:8888/.netlify/functions/generate-earthquake-image" \
  -H "Content-Type: application/json" \
  -d '{
    "magnitude": 7.5,
    "location": "SOUTHERN CALIFORNIA",
    "eventId": "test-123",
    "usgsImages": []
  }'
```

This returns a JSON response with the image URL. Open that URL in your browser to see the image.

### Test Full Pipeline (Dry Run)

```bash
curl "http://localhost:8888/.netlify/functions/earthquake-poller?test=true"
```

This shows what would be posted without actually creating posts or sending emails.

## Testing on Production

Once deployed, you can test on your live site:

```bash
# Test image generation
curl -X POST "https://noteworthynews.co/.netlify/functions/generate-earthquake-image" \
  -H "Content-Type: application/json" \
  -d '{
    "magnitude": 7.5,
    "location": "SOUTHERN CALIFORNIA",
    "eventId": "test-123",
    "usgsImages": []
  }'

# Test poller (dry run)
curl "https://noteworthynews.co/.netlify/functions/earthquake-poller?test=true"
```

## Adjusting Text Position

If the text positioning looks off, edit these constants in `netlify/functions/generate-earthquake-image.js`:

```javascript
const MAGNITUDE_X = 50;      // Move left/right
const MAGNITUDE_Y = 100;     // Move up/down
const LOCATION_X = 50;       // Move left/right
const LOCATION_Y = 150;      // Move up/down
```

Then re-run the test to see the changes.

## What to Check

When reviewing test images:

1. ✅ **Magnitude text** (M7.2) appears before "EARTHQUAKE NEAR"
2. ✅ **Location text** appears after "EARTHQUAKE NEAR"
3. ✅ **Text fits** without overflowing off the image
4. ✅ **Text is readable** and properly sized
5. ✅ **Text color** matches template (red)
6. ✅ **USGS images** (when available) fit in lower section without covering text

## Troubleshooting

**"Template not found" error:**
- Make sure `1stUSGSTemp.png` is in the project root
- Check the file path in the error message

**Images not generating:**
- Check that Netlify dev is running
- Check function logs for errors
- Verify Sharp is installed: `npm install sharp`

**Text positioning issues:**
- Adjust the X/Y constants based on your template layout
- The template is 940x788 pixels - use this as reference

