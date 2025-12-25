# USGS Images Integration - How It Works

## ✅ USGS Images Are Now Integrated

The image generator now **automatically adds USGS images** from the earthquake event when they're available.

## 🔄 How It Works

### 1. Earthquake Poller Extracts USGS Images
When `earthquake-poller.js` processes an earthquake:
- Fetches event detail from USGS
- Extracts up to 2 USGS images using `extractUSGSImages()`
- Passes them to the image generator via `usgsImages` parameter

### 2. Image Generator Composites USGS Images
When `generate-earthquake-image.js` receives `usgsImages`:
- Downloads each USGS image from its URL
- Processes and resizes to fit template layout
- Composites onto template in lower section (Y: 450px)
- Places 2 images side-by-side (or 1 centered if only 1 available)

### 3. Layer Order
1. **Base Layer**: `2ndUSGSTemp.png` (template with static elements)
2. **Text Overlay**: Dynamic text (magnitude, headline, location)
3. **USGS Images**: Actual earthquake-specific images from USGS (if provided)

## 📐 USGS Image Placement

```javascript
// USGS image placement area (lower section)
const IMAGE_AREA_Y = 450;        // Y position (lower section)
const IMAGE_AREA_HEIGHT = 250;   // Height for each image
const IMAGE_PADDING = 20;        // Padding from edges
const IMAGE_SPACING = 15;        // Space between two images
```

- **2 images**: Side-by-side, each taking ~50% of width (minus spacing)
- **1 image**: Centered, taking full width (minus padding)
- **0 images**: Template's static images remain (if template has them)

## 🔍 When USGS Images Are Added

USGS images are automatically added when:
1. ✅ Earthquake poller runs (scheduled function)
2. ✅ Event detail is successfully fetched from USGS
3. ✅ USGS images are found in the event's product data
4. ✅ Images are successfully downloaded and processed

**Timeline**: This happens **automatically** every time the earthquake pipeline processes a new earthquake event.

## 🧪 Testing with USGS Images

To test with actual USGS images, you can:

1. **Run the full pipeline test**:
   ```bash
   npm run test:earthquake-full
   ```
   This fetches a real earthquake, extracts USGS images, and generates the image.

2. **Manually test with USGS image URLs**:
   ```javascript
   const usgsImages = [
     { url: 'https://earthquake.usgs.gov/.../image1.png', type: 'shakemap', filename: 'intensity.png' },
     { url: 'https://earthquake.usgs.gov/.../image2.png', type: 'shakemap', filename: 'mmi.png' }
   ];
   ```

## 📝 Current Status

- ✅ Code accepts `usgsImages` parameter
- ✅ Downloads USGS images from URLs
- ✅ Processes and resizes images to fit template
- ✅ Composites images onto template in lower section
- ✅ Handles 0, 1, or 2 images gracefully
- ✅ Falls back to template's static images if none provided

**The USGS images will be added automatically when the earthquake pipeline runs!**

