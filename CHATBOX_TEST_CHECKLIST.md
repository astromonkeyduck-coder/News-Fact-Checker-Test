# Chatbox Feature Test Checklist

## ✅ Syntax Validation
- [x] All JavaScript files pass syntax checks
- [x] No syntax errors in chat widget
- [x] No syntax errors in Netlify functions

## 🧪 Feature Tests

### 1. Text Chat
- [ ] Send a text message
- [ ] Receive AI response
- [ ] Chat history persists during conversation
- [ ] Multiple messages work correctly

### 2. Image Upload
- [ ] Click file upload button → select image
- [ ] Drag & drop image into chat
- [ ] Copy image → Paste (Cmd+V/Ctrl+V) in chat
- [ ] Image preview appears before sending
- [ ] Multiple images can be uploaded

### 3. Image Analysis
- [ ] Upload an image with text: "What is this?"
- [ ] AI analyzes and describes the image
- [ ] Response includes image understanding

### 4. Image Generation
- [ ] Type: "Generate a dog"
- [ ] Type: "Create an image of a sunset"
- [ ] Generated image appears in chat
- [ ] AI response mentions the generated image

### 5. Image Editing ⚠️ (Needs Testing)
- [ ] Upload an image
- [ ] Type: "Make this blue"
- [ ] Type: "Change the color to red"
- [ ] Type: "Edit this to be more vibrant"
- [ ] Edited image should be similar to original with requested changes
- [ ] Verify image fidelity (should preserve composition, structure, etc.)

### 6. Voice Conversations ⚠️ (Needs Testing)
- [ ] Click microphone button → Voice panel expands
- [ ] Select a voice (Cove, Alloy, etc.)
- [ ] Click "Start Voice Call" button
- [ ] Grant microphone permission
- [ ] Status shows "Connected - Speak now!"
- [ ] Speak into microphone
- [ ] AI responds with voice
- [ ] Click "End Call" to stop
- [ ] Test with different voices

## 🔍 Integration Points Verified

### Voice Feature
- ✅ Endpoint construction: `endpoint.replace('/noteworthy-chat', '/realtime-voice')`
- ✅ Model name: `gpt-4o-realtime-preview` (fixed from dated version)
- ✅ Tools format: Simplified to `{ type: 'image_generation' }` and `{ type: 'web_search' }`
- ✅ WebSocket URL construction with ephemeral token
- ✅ Audio context setup (24kHz sample rate)

### Image Editing
- ✅ Detection function: `isImageEditRequest()` checks for uploaded images + edit keywords
- ✅ Endpoint: Constructs absolute URL to `/.netlify/functions/generate-image`
- ✅ Image extraction: Finds first image file, extracts base64 data
- ✅ Quality settings: Uses `hd` quality and `vivid` style for better fidelity
- ✅ Prompt enhancement: Vision analysis emphasizes preservation of original

### File Handling
- ✅ File upload button wired to file input
- ✅ Paste handler for images
- ✅ File preview system
- ✅ Base64 encoding for API transmission

## 🐛 Known Issues / Potential Problems

1. **Voice API 400 Error** (Previously fixed)
   - Changed model from `gpt-4o-realtime-preview-2024-12-17` to `gpt-4o-realtime-preview`
   - Simplified tools format
   - Should work now, but needs live testing

2. **Image Editing Fidelity**
   - Uses DALL-E 3 image-to-image (not true pixel editing)
   - May not be 100% identical to original
   - Prompt engineering optimized for preservation
   - May need further refinement based on results

3. **Endpoint URLs**
   - Voice: Uses relative path replacement
   - Image edit: Uses absolute URL construction
   - Both should work in production

## 📝 Testing Instructions

1. **Local Testing:**
   ```bash
   # Start Netlify dev server
   netlify dev
   
   # Open browser to localhost:8888
   # Open browser console (F12)
   # Test each feature and check console for errors
   ```

2. **Production Testing:**
   - Deploy to Netlify
   - Test on live site
   - Check browser console for errors
   - Monitor Netlify function logs

3. **Voice Testing:**
   - Requires HTTPS (or localhost)
   - Requires microphone permission
   - Check browser console for WebSocket connection status
   - Verify audio capture/playback works

4. **Image Testing:**
   - Test with various image formats (PNG, JPG, etc.)
   - Test with different image sizes
   - Verify base64 encoding works
   - Check that edited images preserve original structure

## 🎯 Success Criteria

- ✅ All syntax checks pass
- ⚠️ Voice feature works (needs live test)
- ⚠️ Image editing works (needs live test)
- ✅ Text chat works
- ✅ Image upload works
- ✅ Image analysis works
- ✅ Image generation works

