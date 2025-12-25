# 3-Line Headline System Fix

## ✅ Implementation Complete

### Fixed: Template-Based 3-Line Headline System

The image generator now uses the exact template (`1stUSGSTemp.png`) as the source of truth and implements a strict 3-line headline system.

## 📐 System Architecture

### Layer Order (Mandatory)
1. **Base Layer**: `1stUSGSTemp.png` drawn at (0, 0)
   - Preserves: Both USGS images, Map, Accent line, Epicenter rings, Noteworthy News banner
2. **Text Overlay**: Only dynamic text (3-line headline system)

### 3-Line Headline System

All text shares the same `anchorX` (left edge of "EARTHQUAKE NEAR" in template).

#### LINE 1 — Label
- **Text**: "Breaking News:"
- **Font**: 16px (small/medium, template style)
- **Color**: White (#FFFFFF)
- **Position**: 
  - x = `anchorX`
  - y = `headlineY - LABEL_OFFSET` (25px above headline)

#### LINE 2 — Main Headline (Critical)
- **Visual**: "M6.5 EARTHQUAKE NEAR" (reads as one line)
- **Implementation**:
  - Magnitude: `M${magnitude.toFixed(1)}` at `anchorX`, `headlineY`
  - Headline: "EARTHQUAKE NEAR" at `anchorX + magWidth + gap`, `headlineY`
  - **Same baseline** for both (magnitude and headline share `headlineY`)
- **Font**: 
  - Magnitude: 41.5px, bold
  - Headline: 60px, bold
- **Color**: Red (#FF0000)
- **Gap**: 18px between magnitude and headline

#### LINE 3 — Location
- **Text**: Location (e.g., "PAPUA NEW GUINEA")
- **Font**: 41.5px (slightly smaller than headline)
- **Color**: Red (#FF0000)
- **Position**:
  - x = `anchorX`
  - y = `headlineY + LOCATION_OFFSET` (40px below headline)
- **Auto-sizing**: Reduces font size if location text is too long

## 🔧 Constants

```javascript
// Anchor point (left edge of "EARTHQUAKE NEAR" in template)
const ANCHOR_X = 50;
const HEADLINE_Y = 200;

// Line 1: Label
const LABEL_TEXT = "Breaking News:";
const LABEL_FONT_SIZE = 16;
const LABEL_OFFSET = 25;
const LABEL_COLOR = '#FFFFFF';

// Line 2: Headline
const HEADLINE_TEXT = "EARTHQUAKE NEAR";
const HEADLINE_FONT_SIZE = 60;
const MAGNITUDE_FONT_SIZE = 41.5;
const MAGNITUDE_GAP = 18;
const HEADLINE_COLOR = '#FF0000';

// Line 3: Location
const LOCATION_FONT_SIZE = 41.5;
const LOCATION_OFFSET = 40;
const LOCATION_COLOR = '#FF0000';
const MAX_LOCATION_WIDTH = 800;
```

## ✅ Validation Tests

All 4 validation cases generated successfully:
1. ✅ M6.5 "PAPUA NEW GUINEA"
2. ✅ M3.1 "CHILE"
3. ✅ M7.8 "SOUTHERN IRAN"
4. ✅ M4.9 "NEAR THE KERMADEC ISLANDS"

**Location**: `test-output/3line-*.png`

## 🔍 Verification Checklist

For each generated image, verify:
- [ ] Line 1: "Breaking News:" appears above headline (white)
- [ ] Line 2: "M#.# EARTHQUAKE NEAR" reads as one line (magnitude + headline on same baseline)
- [ ] Line 3: Location appears below headline (red)
- [ ] All text shares same `anchorX` (left-aligned)
- [ ] Magnitude is ALWAYS inside the headline line (not separate)
- [ ] Location is ALWAYS directly under headline
- [ ] No text overlaps map or rings
- [ ] Both USGS images from template are visible
- [ ] Template elements preserved (map, accent line, rings, banner)

## 🗑️ Removed Code

- ❌ Old top-left magnitude placement
- ❌ Old separate location placement
- ❌ Code that added additional USGS images (template already has them)
- ❌ Any floating metadata or alternative text drawing

## 📝 Commit Message

```
fix(usgs-template): bind magnitude + location to 3-line headline system

- Use 1stUSGSTemp.png as exact source of truth (base layer)
- Implement 3-line headline system:
  * Line 1: "Breaking News:" (white, above)
  * Line 2: "M#.# EARTHQUAKE NEAR" (magnitude + headline on same baseline)
  * Line 3: Location (red, below)
- All text shares same anchorX (left edge of "EARTHQUAKE NEAR")
- Remove all old text placement logic
- Template preserves USGS images, map, rings, banner
- Only overlay dynamic text (no background generation)
```

## 🛠️ Fine-Tuning

If text positioning needs adjustment:

1. **Text not aligned with template "EARTHQUAKE NEAR"**:
   - Adjust `ANCHOR_X` to match left edge of "EARTHQUAKE NEAR" in template
   - Adjust `HEADLINE_Y` to match baseline of "EARTHQUAKE NEAR" in template

2. **"Breaking News:" too close/far from headline**:
   - Adjust `LABEL_OFFSET` (increase for more space, decrease for less)

3. **Location too close/far from headline**:
   - Adjust `LOCATION_OFFSET` (increase for more space, decrease for less)

4. **Magnitude too close/far from "EARTHQUAKE NEAR"**:
   - Adjust `MAGNITUDE_GAP` (increase for more space, decrease for less)

