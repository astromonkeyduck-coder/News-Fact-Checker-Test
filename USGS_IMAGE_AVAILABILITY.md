# USGS Image Availability Timeline

## ⚡ Images Available IMMEDIATELY (0-3 minutes)

### 1. "Did You Feel It?" (DYFI) Maps
- **Availability**: Within 3 minutes of earthquake
- **Type**: Community intensity maps based on public reports
- **Product Name**: `dyfi` in USGS products
- **Status**: ✅ Currently NOT prioritized in our code

### 2. Basic Event Images
- **Availability**: Immediate (if available)
- **Type**: Basic location maps, epicenter plots
- **Product Names**: Various (location, origin, etc.)
- **Status**: ✅ Currently used as fallback

## ⏱️ Images Available AFTER Processing (5-30 minutes)

### 1. ShakeMaps
- **Availability**: 5-10 minutes after earthquake
- **Type**: Ground shaking intensity maps (most useful)
- **Product Name**: `shakemap` in USGS products
- **Status**: ✅ Currently PRIORITIZED in our code (first choice)
- **Images Include**:
  - Intensity maps (MMI - Modified Mercalli Intensity)
  - Peak ground acceleration maps
  - Peak ground velocity maps
  - Population exposure maps

### 2. PAGER Reports
- **Availability**: 20-30 minutes after earthquake
- **Type**: Impact assessment (economic losses, fatalities)
- **Product Name**: `pager` in USGS products
- **Status**: ❌ Currently NOT used

## 📊 Current Code Behavior

Our `extractUSGSImages()` function:
1. **First Priority**: Shakemap products (5-10 min delay)
2. **Fallback**: Other products (may include immediate images)

**Problem**: If we poll immediately after an earthquake, shakemaps won't be ready yet!

## 🔧 Recommendation: Add Immediate Image Support

We should update the code to:
1. **First**: Look for immediate products (DYFI, basic maps)
2. **Then**: Look for shakemap products (if available)
3. **Fallback**: Any other image products

This ensures we get images immediately, and upgrade to better shakemaps when they become available.

## 📝 Current Timeline

**Scenario: Earthquake happens at T+0**
- **T+0-3 min**: Only basic/DYFI images available
- **T+5-10 min**: Shakemaps become available
- **T+20-30 min**: PAGER reports available

**Our current code**: Waits for shakemaps (5-10 min delay) or uses fallback products.

