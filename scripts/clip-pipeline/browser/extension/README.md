# Noteworthy YouTube Clip - Chrome Extension

Save the last 30 seconds from YouTube as **MP4** with one click.

## Before first install

```bash
npm run extension:vendor   # optional wasm fallback
npm run clip:install-native-host -- YOUR_EXTENSION_ID   # recommended for MP4
```

Get `YOUR_EXTENSION_ID` from `chrome://extensions` (under the extension name).

Without the native host, MP4 conversion often fails in Chrome - you'll get WebM only.

## Install (unpacked)

### Chrome / Brave / Edge

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder:
   ```
   scripts/clip-pipeline/browser/extension
   ```
5. Open any YouTube watch page - red **Save last 30s** button appears bottom-right.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…**
3. Choose `manifest.json` in this folder

(Firefox may need manifest tweaks for permanent install; unpacked temporary works for dev.)

## Use

1. Play a YouTube video or livestream for at least ~10–30 seconds.
2. Click **Save last 30s** on the page, or:
   - Extension popup → **Save last clip now**
   - Keyboard: **Alt+Shift+C**
3. A `.mp4` file downloads (first save may take ~15s while FFmpeg loads).

## Reinstall after update

1. Run `npm run extension:vendor` if vendor folder missing
2. `chrome://extensions` → click **Reload** on this extension

## Popup settings

- Buffer length: 15 / 30 / 45 / 60 seconds

## Zip for sharing

From repo root:

```bash
cd scripts/clip-pipeline/browser
zip -r noteworthy-youtube-clip-extension.zip extension -x "*.DS_Store"
```

Unzip anywhere and **Load unpacked** pointing at the `extension` folder.

## Legal

You are responsible for copyright and YouTube Terms of Service before republishing clips.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **failed to import ffmpeg-core.js** | Run `npm run extension:vendor`, then **Reload** extension (v1.1.1+ fix) |
| No button on YouTube | Refresh page; check extension is enabled |
| "Capture blocked" | DRM stream - use official feed instead |
| Empty clip | Let video play longer before saving |
| Shortcut doesn't work | Click extension icon once on that tab first |
