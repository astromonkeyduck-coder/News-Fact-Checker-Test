# USGS Image Availability - Summary

## ⚡ Images Available IMMEDIATELY (0-3 minutes)

When an earthquake happens, these images are available **right away**:

1. **"Did You Feel It?" (DYFI) Maps**
   - Available: Within 3 minutes
   - Type: Community intensity maps
   - Product: `dyfi` in USGS products
   - ✅ **NOW PRIORITIZED** in our code (first choice)

2. **Basic Event Images**
   - Available: Immediate
   - Types: Location maps, epicenter plots, origin maps
   - Products: `origin`, `location`, `moment-tensor`
   - ✅ **NOW PRIORITIZED** in our code

## ⏱️ Images Available AFTER Processing (5-30 minutes)

1. **ShakeMaps** (Best Quality)
   - Available: 5-10 minutes after earthquake
   - Type: Ground shaking intensity maps (MMI, PGA, PGV)
   - Product: `shakemap` in USGS products
   - ✅ **NOW SECOND PRIORITY** (upgrades when available)

2. **PAGER Reports**
   - Available: 20-30 minutes
   - Type: Impact assessment
   - ❌ Not currently used

## 🔄 Updated Priority Order

Our code now uses this priority order:

1. **Immediate products** (0-3 min): `dyfi`, `origin`, `location`, `moment-tensor`
2. **Shakemap products** (5-10 min): `shakemap` (best quality)
3. **Other products** (fallback): Any remaining products

## 📊 What This Means

**Before**: Code waited for shakemaps (5-10 min delay) or used random fallback
**Now**: Code gets images immediately (0-3 min), then upgrades to shakemaps when available

## 🎯 Result

- **Immediate alerts**: Get images right away (DYFI, basic maps)
- **Better quality later**: Shakemaps added when they become available (5-10 min)
- **No delays**: Images appear in alerts immediately, not after 5-10 minutes

