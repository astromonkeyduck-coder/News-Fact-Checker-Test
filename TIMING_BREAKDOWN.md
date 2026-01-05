# Earthquake Processing Timing Breakdown

## After `ingest-all` Runs

### 1. **USGS Engine Execution** (~1-3 seconds)
- Fetches earthquake feed from USGS API
- Processes each earthquake sequentially

### 2. **Per-Earthquake Processing** (per earthquake)

#### **Image Generation** (~2-5 seconds typical, up to 30 seconds max)
- **Direct function call**: ~2-3 seconds
- **HTTP call (fallback)**: ~3-5 seconds
- **Timeout**: 30 seconds maximum
- **Retries for USGS images**:
  - Retry 1: 2 seconds delay
  - Retry 2: 3 seconds delay
  - Total retry time: ~5 seconds

#### **Email Sending** (~0.5-2 seconds)
- Happens immediately after image generation completes
- Fetches image from blob storage
- Sends via Resend API
- Usually completes in < 1 second

### 3. **Total Timeline**

**Best Case (new earthquake, images available immediately):**
- Image generation: ~2-3 seconds
- Email sending: ~0.5-1 second
- **Total: ~3-4 seconds** from ingest start to email sent

**Typical Case (new earthquake, no USGS images yet):**
- Image generation (with fallback maps): ~3-5 seconds
- Email sending: ~0.5-1 second
- **Total: ~4-6 seconds** from ingest start to email sent

**Worst Case (retries needed, slow network):**
- Image generation with retries: ~10-15 seconds
- Email sending: ~1-2 seconds
- **Total: ~12-17 seconds** from ingest start to email sent

**Timeout Case:**
- Image generation timeout: 30 seconds
- Email may not send if image generation fails
- **Total: ~30 seconds** (then fails)

## Notes

- **Sequential Processing**: Earthquakes are processed one at a time (not parallel)
- **Image Generation Threshold**: Only earthquakes with magnitude >= 0.5 get images
- **Email Threshold**: All earthquakes get emails (no threshold)
- **Video Generation**: Only for magnitude >= 4.0, happens in parallel (non-blocking)

## Example Timeline

```
00:00 - ingest-all starts
00:01 - USGS engine starts fetching feed
00:02 - Feed received, processing earthquake #1
00:02 - Image generation starts
00:05 - Image generation completes
00:05 - Email sending starts
00:06 - Email sent ✅
00:06 - Processing earthquake #2
...
```

