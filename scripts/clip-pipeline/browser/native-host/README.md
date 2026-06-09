# Native MP4 converter (recommended)

In-browser FFmpeg is unreliable in Chrome extensions. **Install the native host** once — it uses the same `ffmpeg-static` as `npm run clip:convert-webm` and makes MP4 saves work reliably.

## Install

1. Load the extension unpacked from `extension/`
2. Copy the **Extension ID** from `chrome://extensions` (32-char string under the extension name)
3. Run from repo root:

```bash
npm run clip:install-native-host -- YOUR_EXTENSION_ID
```

4. Reload the extension in Chrome

## Test the host

```bash
echo '{"type":"ping"}' | node scripts/clip-pipeline/browser/native-host/noteworthy-clip-host.js
```

(Chrome wraps messages with a 4-byte length prefix — the extension handles that.)

## Uninstall

Delete `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.noteworthy.clip.json`

## Manual WebM → MP4 (no native host)

```bash
npm run clip:convert-webm -- ~/Downloads/youtube-last-30s-....webm --rights-basis "Manual review"
```
