# Voice Call Sidebar Feature

## Overview

Added a sidebar that appears during voice calls to display generated images and essays, so they don't get blocked by the voice call interface.

---

## Features

### ✅ Sidebar Display
- **Location**: Fixed position on the right side of the screen
- **Visibility**: Automatically shows when voice mode starts
- **Auto-hide**: Hides when voice call ends
- **Manual close**: User can close it with the × button

### ✅ Image Generation
- When user asks to generate an image during a voice call:
  - Image appears in the sidebar (not blocked by call UI)
  - Shows the generated image with prompt
  - Sidebar automatically appears if not already visible

### ✅ Essay/Text Generation
- When user asks to write an essay or long text during a voice call:
  - Text appears in the sidebar in a scrollable container
  - Only shows if text is substantial (>100 characters)
  - Formatted for easy reading

---

## Implementation

### HTML Structure
```html
<div class="voice-call-sidebar" id="voiceCallSidebar" style="display: none;">
  <div class="voice-sidebar-header">
    <div class="voice-sidebar-title">
      <svg>...</svg>
      <span>Call Results</span>
    </div>
    <button class="voice-sidebar-close" id="voiceSidebarClose">×</button>
  </div>
  <div class="voice-sidebar-content" id="voiceSidebarContent">
    <div class="voice-sidebar-empty">
      <p>Generated content will appear here during your call</p>
    </div>
  </div>
</div>
```

### CSS Styling
- Fixed position on right side
- Dark theme matching chat widget
- Scrollable content area
- Responsive design (adapts to mobile)
- Smooth slide-in animation

### JavaScript Functions

#### `showVoiceSidebar()`
- Shows the sidebar when voice mode starts
- Called automatically when WebSocket connects

#### `hideVoiceSidebar()`
- Hides the sidebar when voice mode ends
- Called automatically when call stops

#### `showInVoiceSidebar(type, data)`
- Displays content in the sidebar
- **Types**: `'image'`, `'text'`, `'essay'`
- **Data format**:
  - Image: `{ image_url: "...", prompt: "..." }`
  - Text/Essay: `{ text: "..." }`

---

## Message Handling

### Image Generation
**Message**: `response.function_call_result.done` with `name === 'generate_image'`

**Behavior**:
- If `voiceModeActive`: Shows in sidebar
- If not in voice mode: Shows in chat (normal behavior)

### Text/Essay Generation
**Messages**:
- `response.text.delta` - Streaming text chunks
- `response.text.done` - Complete text response
- `response.content.delta` - Alternative format
- `response.content.done` - Alternative format
- `response.done` - Final response (checks for text content)

**Behavior**:
- Collects text from delta messages
- Shows in sidebar when complete (if >100 characters)
- Only shows during voice mode

---

## User Experience

### During Voice Call
1. User asks: "Generate me a picture of a sunset"
2. AI responds: "I'll generate that for you..."
3. Sidebar appears (if not already visible)
4. Image appears in sidebar
5. User can continue talking while viewing the image

### Essay Example
1. User asks: "Write me an essay about climate change"
2. AI responds: "I'll write that essay for you..."
3. Sidebar appears
4. Essay text streams in and appears in sidebar
5. User can scroll to read the full essay

---

## Styling Details

### Sidebar
- **Width**: 400px (responsive on mobile)
- **Position**: Fixed, right: 24px, top: 24px
- **Z-index**: 2147482999 (just below chat widget)
- **Background**: Dark gradient matching chat theme
- **Border**: Blue accent border
- **Animation**: Slide in from right

### Content Items
- **Image**: Full width, rounded corners, shadow
- **Text**: Scrollable container, max-height 400px
- **Spacing**: 20px padding, items spaced 20px apart

---

## Mobile Responsiveness

- On mobile (< 768px):
  - Sidebar width: `calc(100vw - 24px)`
  - Position: `right: 12px, top: 12px`
  - Max height: `calc(100vh - 24px)`

---

## Status

✅ **IMPLEMENTED**

**Files Modified**:
- `src/widgets/noteworthy-chat.js`
  - Added sidebar HTML structure
  - Added CSS styles
  - Added sidebar functions
  - Updated function call handlers
  - Added text response handlers
  - Integrated with voice mode start/stop

**Date**: December 14, 2025

---

## Future Enhancements

- [ ] Allow sidebar to be resized
- [ ] Add ability to download images from sidebar
- [ ] Add copy button for essays
- [ ] Show multiple items in sidebar (stacked)
- [ ] Add animations for new items appearing
