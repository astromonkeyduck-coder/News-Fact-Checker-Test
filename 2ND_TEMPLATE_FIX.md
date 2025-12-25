# 2ndUSGSTemp.png Template Fix - Dynamic Text Only

## ✅ Implementation Complete

### Fixed: Template-Based Dynamic Text Overlay

The image generator now uses `2ndUSGSTemp.png` as the exact source of truth. The template contains ALL static elements, and we only overlay the 3 dynamic text elements.

## 📐 System Architecture

### Layer Order (Mandatory)
1. **Base Layer**: `2ndUSGSTemp.png` drawn at (0, 0)
   - Contains: Background, map, rings, logos, USGS images, footer, "Breaking News:" label, Noteworthy banner
   - Output dimensions match template exactly (no scaling/cropping)
2. **Text Overlay**: Only 3 dynamic text elements

### Dynamic Text Elements (ONLY 3)

#### A) Magnitude (White)
- **Text**: `M${magnitude.toFixed(1)}` (e.g., "M6.5")
- **Color**: White (#FFFFFF)
- **Font**: 41.5px, bold, Roboto
- **Position**: Inline immediately before "EARTHQUAKE NEAR" on same baseline

#### B) Headline (White)
- **Text**: "EARTHQUAKE NEAR"
- **Color**: White (#FFFFFF)
- **Font**: 60px, bold, Roboto
- **Position**: After magnitude on same baseline (gap: 18px)

#### C) Location (Red)
- **Text**: Location (e.g., "PAPUA NEW GUINEA") - auto-uppercased
- **Color**: Red (#FF0000) - matches template red
- **Font**: 41.5px, bold, Roboto (auto-sized if too long)
- **Position**: Directly under headline, left-aligned

### Text Placement Rules

- **anchorX**: Left alignment (matches template's "Breaking News:" label position)
- **headlineBaselineY**: Baseline for headline (below "Breaking News:" in template)
- **Same baseline**: Magnitude and "EARTHQUAKE NEAR" share the same Y coordinate
- **Left-aligned**: All text shares the same `anchorX` (left edge)
- **Edge safety**: Minimum left margin (40px) to prevent clipping

## 🔧 Constants

```javascript
// Anchor point (left edge aligned with template's "Breaking News:" label)
const ANCHOR_X = 50;
const HEADLINE_BASELINE_Y = 200;
const LOCATION_OFFSET = 40; // Below headline

// Headline: "M6.5 EARTHQUAKE NEAR"
const HEADLINE_TEXT = "EARTHQUAKE NEAR";
const HEADLINE_FONT_SIZE = 60;
const MAGNITUDE_FONT_SIZE = 41.5;
const MAGNITUDE_GAP = 18;
const HEADLINE_COLOR = '#FFFFFF'; // WHITE
const MAGNITUDE_COLOR = '#FFFFFF'; // WHITE

// Location
const LOCATION_FONT_SIZE = 41.5;
const LOCATION_COLOR = '#FF0000'; // RED
const MAX_LOCATION_WIDTH = 800;
const SAFE_LEFT_MARGIN = 40;
```

## ✅ Validation Tests

All 5 validation cases generated successfully:
1. ✅ M6.5 "PAPUA NEW GUINEA"
2. ✅ M3.1 "CHILE"
3. ✅ M7.8 "SOUTHERN IRAN"
4. ✅ M4.9 "NEAR THE KERMADEC ISLANDS"
5. ✅ M2.7 "PUERTO RICO"

**Location**: `test-output/2nd-*.png`

## 🔍 Verification Checklist

For each generated image, verify:
- [ ] Only ONE headline exists (no duplicates)
- [ ] Magnitude is inline before "EARTHQUAKE NEAR" (same baseline)
- [ ] Location is under headline in red
- [ ] USGS images are present (from template)
- [ ] Nothing overlaps banner or USGS assets
- [ ] No clipping on edges
- [ ] Template static elements preserved (map, rings, footer, banner, "Breaking News:" label)

## 🗑️ Removed Code

- ❌ "Breaking News:" label drawing (now in template)
- ❌ Background generation
- ❌ Map/rings/logo drawing
- ❌ USGS image placement (now in template)
- ❌ Footer/banner drawing (now in template)
- ❌ Any code that recreates static template elements

## 📝 Commit Message

```
fix(usgs-alert): render dynamic headline on 2ndUSGSTemp background-only template

- Use 2ndUSGSTemp.png as exact source of truth (base layer)
- Template contains ALL static elements (background, map, rings, logos, USGS images, footer, banner, "Breaking News:" label)
- Only overlay 3 dynamic text elements:
  * Magnitude (white): M#.#
  * Headline (white): EARTHQUAKE NEAR
  * Location (red): e.g. PAPUA NEW GUINEA
- Magnitude inline before headline on same baseline
- Location directly under headline, left-aligned
- Output dimensions match template exactly (no scaling/cropping)
- Remove all code that generates backgrounds or static elements
```

## 🛠️ Fine-Tuning

If text positioning needs adjustment:

1. **Text not aligned with template "Breaking News:" label**:
   - Adjust `ANCHOR_X` to match left edge of "Breaking News:" in template
   - Adjust `HEADLINE_BASELINE_Y` to match baseline of headline area in template

2. **Location too close/far from headline**:
   - Adjust `LOCATION_OFFSET` (increase for more space, decrease for less)

3. **Magnitude too close/far from "EARTHQUAKE NEAR"**:
   - Adjust `MAGNITUDE_GAP` (increase for more space, decrease for less)

4. **Text clipping on left edge**:
   - Increase `SAFE_LEFT_MARGIN` or adjust `ANCHOR_X` to shift everything right

## 🎯 Key Differences from Previous Version

1. **Template**: Changed from `1stUSGSTemp.png` to `2ndUSGSTemp.png`
2. **Static Elements**: All now in template (not drawn in code)
3. **Text Colors**: Headline and magnitude are WHITE (not red)
4. **Simplified**: Only 3 dynamic text elements (removed "Breaking News:" label)
5. **Dimensions**: Uses template's native dimensions (no hardcoded values)

