# Save last 30 seconds on YouTube (browser button)

## Chrome extension (use this)

**Folder:** `scripts/clip-pipeline/browser/extension/`  
**Zip:** `scripts/clip-pipeline/browser/noteworthy-youtube-clip-extension.zip`

1. `chrome://extensions` → Developer mode → **Load unpacked** → select the `extension` folder
2. Open YouTube, play video, click **Save last 30s** (or `Alt+Shift+C`)

Full docs: [`extension/README.md`](extension/README.md)

---

## Userscript (alternative)

This uses **browser capture** of the playing video — not yt-dlp, not server-side YouTube ripping.

## Install (one time)

1. Install a userscript manager in Chrome or Firefox:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - or [Violentmonkey](https://violentmonkey.github.io/)

2. Create a new script and paste the contents of:
   [`youtube-save-last.user.js`](youtube-save-last.user.js)

3. Save and enable the script.

## Use

1. Open any YouTube watch page or livestream.
2. **Let the video play** for at least a few seconds (the script buffers the last 30s continuously).
3. Click the red **“Save last 30s”** button (bottom-right of the page).
4. A `.webm` file downloads to your Downloads folder.

## Convert to X-ready MP4 (optional)

```bash
npm run clip:convert-webm -- ~/Downloads/youtube-last-30s-....webm \
  --rights-basis "Manual review required — browser capture from YouTube"
```

Output goes to `data/clips/output/`.

## Limitations

| Issue | What happens |
|-------|----------------|
| DRM / protected streams | `captureStream()` may fail — button shows an error |
| Just opened the page | Wait until buffer shows ~30s before saving |
| YouTube navigation | Buffer resets when you change videos |
| Audio/video sync | Usually fine; re-encode with `clip:convert-webm` if needed |

## Legal

- You are responsible for **copyright, YouTube Terms of Service**, and whether reposting is allowed.
- Prefer **official parallel feeds** (White House HLS, C-SPAN, pool) when available — use `clip:record:buffer` for those.
- **Human review** before posting to X.

## Troubleshooting

**No button?** Refresh the page. Check Tampermonkey shows the script enabled on `youtube.com`.

**“Capture blocked”?** That stream uses protection the browser won’t expose. Use a rights-cleared direct feed instead.

**Empty/small file?** Play the video longer, then click save again.
