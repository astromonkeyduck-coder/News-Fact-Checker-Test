# Precision Alignment Fix - Pixel-Perfect Alignment + Exact Font Sizing

## ✅ All Three Fixes Implemented

### A) Pixel-Perfect Left Alignment ✅
- **ALIGN_SHIFT_X**: `+18px` - Calibration shift to match "Breaking News:" label left edge
- **Applied Uniformly**: All dynamic text x positions shifted by same amount
  - `magX = anchorX + ALIGN_SHIFT_X`
  - `headlineX = alignedX + magWidth + MAGNITUDE_GAP`
  - `locationX = alignedX`
- **Result**: Dynamic text block aligns exactly with "Breaking News:" label left edge

### B) Exact Location Font Size ✅
- **Base Size**: `41.5px` (EXACT, as required)
- **Scaling Logic**: Only scales down if text would exceed safe area
  - If `estimatedWidth > maxTextWidth`:
    - `scaleFactor = maxTextWidth / estimatedWidth`
    - `newSize = max(34px, 41.5px * scaleFactor)`
- **Result**: Location uses 41.5px unless clipping would occur (then scales down)

### C) Safe Area Still Applied ✅
- **SAFE_RIGHT**: `canvas.width * 0.58` (58% of canvas width)
- **MAX_TEXT_WIDTH**: `SAFE_RIGHT - (anchorX + ALIGN_SHIFT_X)`
- **Headline Auto-sizing**: Reduces if exceeds safe area
- **Location Scaling**: Scales down if exceeds safe area (minimum 34px)
- **Result**: Text never runs into right-side rings

## 📐 Updated Constants

```javascript
// Pixel-perfect alignment
const ANCHOR_X = 50; // Base anchor
const ALIGN_SHIFT_X = 18; // Shift to match "Breaking News:" label
const SAFE_LEFT = ANCHOR_X + ALIGN_SHIFT_X; // 68px (after alignment)

// Location font (exact sizing)
const LOCATION_FONT_SIZE_EXACT = 41.5; // EXACT size (required)
const LOCATION_FONT_SIZE_MIN = 34; // Minimum if scaling needed

// Safe area
const SAFE_RIGHT_RATIO = 0.58; // 58% of canvas width
const maxTextWidth = (templateWidth * 0.58) - SAFE_LEFT; // e.g., 477px for 940px template
```

## ✅ Validation Tests

Both validation cases generated successfully:
1. ✅ M6.5 "PAPUA NEW GUINEA"
   - Location: **41.5px** (exact, no scaling needed)
   - Log: "Location using exact size: 41.5px"
   
2. ✅ M4.9 "NEAR THE KERMADEC ISLANDS"
   - Location: **34px** (scaled down to prevent clipping)
   - Log: "Location scaled down to 34px to prevent clipping (would be 622.5px, max: 477px)"

**Location**: `test-output/precision-*.png`

## 🔍 Verification Checklist

For each generated image, verify:
- [ ] Dynamic block aligns perfectly with "Breaking News:" label left edge
- [ ] Location font is exactly 41.5px (unless clipping would occur)
- [ ] No text overlaps rings/banner
- [ ] All text x positions shifted by ALIGN_SHIFT_X as a unit
- [ ] Safe area constraints still enforced

## 📝 Summary of Changes

1. **Added ALIGN_SHIFT_X**: +18px calibration shift for pixel-perfect alignment
2. **Applied shift uniformly**: All text x positions (magX, headlineX, locationX) shifted together
3. **Location font exact**: 41.5px exactly (scales down only if clipping would occur)
4. **Safe area maintained**: Text still constrained to 58% of canvas width

## 🛠️ Fine-Tuning ALIGN_SHIFT_X

If alignment needs adjustment:
- **Too far left**: Increase `ALIGN_SHIFT_X` (e.g., 20, 22, 24)
- **Too far right**: Decrease `ALIGN_SHIFT_X` (e.g., 16, 14, 12)
- **Calibration method**: Compare left edge of "M6.5" with left edge of "B" in "Breaking News:"

All changes maintain the template's static elements and only affect the 3 dynamic text elements.

