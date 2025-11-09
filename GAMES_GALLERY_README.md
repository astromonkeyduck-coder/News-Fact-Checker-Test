# Games Gallery - Integration Guide

A production-ready, embed-ready Games Gallery component for browsing, searching, filtering, and playing HTML5 games in a secure iframe modal.

## 📦 Files

- `src/components/GamesGallery.jsx` - Main React component
- `src/components/games-gallery.css` - Styles (no external dependencies)
- `games.json` - Game catalog (JSON array)
- `src/components/__tests__/GamesGallery.test.js` - Jest tests

## 🚀 Quick Start

### 1. Install Dependencies

If using React via CDN, ensure React 18+ is loaded. For build systems:

```bash
npm install react react-dom
# Optional: for testing
npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
```

### 2. Add CSS

Include the CSS file in your HTML:

```html
<link rel="stylesheet" href="/src/components/games-gallery.css">
```

Or import in your main JS/TS file:

```javascript
import './components/games-gallery.css';
```

### 3. Mount the Component

#### Option A: React (with build system)

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import GamesGallery from './components/GamesGallery';

const root = ReactDOM.createRoot(document.getElementById('games-root'));
root.render(<GamesGallery />);
```

#### Option B: React (CDN)

```html
<div id="games-root"></div>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel" src="/src/components/GamesGallery.jsx"></script>
<script type="text/babel">
  const root = ReactDOM.createRoot(document.getElementById('games-root'));
  root.render(<GamesGallery />);
</script>
```

#### Option C: Next.js

```jsx
// pages/games.js or app/games/page.jsx
import GamesGallery from '../src/components/GamesGallery';

export default function GamesPage() {
  return <GamesGallery />;
}
```

#### Option D: Vite

```jsx
// src/App.jsx
import GamesGallery from './components/GamesGallery';

function App() {
  return <GamesGallery />;
}
```

### 4. Place Game Builds

For self-hosted games, place them in:

```
/public/games/<slug>/index.html
/public/games/<slug>/cover.jpg
/public/games/<slug>/[other assets]
```

Example:
```
/public/games/stunt-city/index.html
/public/games/stunt-city/cover.jpg
/public/games/stunt-city/js/
/public/games/stunt-city/assets/
```

### 5. Configure games.json

Edit `games.json` in the root directory:

```json
[
  {
    "id": "stunt-city",
    "title": "Stunt City",
    "category": "Driving",
    "src": "/games/stunt-city/index.html",
    "thumb": "/games/stunt-city/cover.jpg",
    "description": "Open-map stunt driving",
    "approved": true
  }
]
```

**Fields:**
- `id` (required): Unique identifier
- `title` (required): Display name
- `category` (required): Category for filtering (e.g., "Driving", "Parkour", "Puzzle", "Sports")
- `src` (required): Path to game HTML or external embed URL
- `thumb` (optional): Thumbnail image path
- `description` (optional): Short description
- `approved` (required): `true` for playable games, `false` for pending review

## 🔒 Security & CSP Configuration

### Content Security Policy (CSP)

Add these headers to your Netlify/Vercel configuration:

#### Netlify (`_headers` file in `public/` or `netlify.toml`)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; frame-src 'self' https://trusted-embed.com; script-src 'self' 'unsafe-inline' https://trusted-embed.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';"
    X-Frame-Options = "SAMEORIGIN"
    Referrer-Policy = "no-referrer"
```

Or create `public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; frame-src 'self' https://trusted-embed.com; script-src 'self' 'unsafe-inline' https://trusted-embed.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: no-referrer
```

#### Vercel (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; frame-src 'self' https://trusted-embed.com; script-src 'self' 'unsafe-inline' https://trusted-embed.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "Referrer-Policy",
          "value": "no-referrer"
        }
      ]
    }
  ]
}
```

### Subdomain Setup (Optional)

For enhanced security, serve games from a subdomain:

1. **Netlify**: Add a subdomain in Site Settings → Domain Management
2. **Vercel**: Add subdomain in Project Settings → Domains
3. Update `games.json` `src` paths to use the subdomain if needed
4. Adjust CSP `frame-src` to include the subdomain

Example: `games.yoursite.com`

### Iframe Sandbox Attributes

The component automatically sets:

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-presentation allow-fullscreen"
  allow="fullscreen; gamepad; pointer-lock; autoplay"
  referrerPolicy="no-referrer"
/>
```

**Security Notes:**
- `allow-scripts`: Required for games to run
- `allow-same-origin`: Needed for localStorage/cookies (use with caution)
- `allow-pointer-lock`: Required for FPS/3D games
- `referrerPolicy="no-referrer"`: Prevents referrer leakage

## 📝 Adding Games

### Self-Hosted Games

1. **Upload game files** to `/public/games/<slug>/`
2. **Add entry** to `games.json`:
   ```json
   {
     "id": "my-game",
     "title": "My Game",
     "category": "Puzzle",
     "src": "/games/my-game/index.html",
     "thumb": "/games/my-game/cover.jpg",
     "description": "A fun puzzle game",
     "approved": true
   }
   ```
3. **Commit and deploy**

### External Embed URLs

1. **Add entry** with external URL:
   ```json
   {
     "id": "partner-game",
     "title": "Partner Game",
     "category": "Driving",
     "src": "https://partner.example.com/embed/game",
     "thumb": "/games/partner-game/cover.jpg",
     "description": "External game",
     "approved": false
   }
   ```
2. **Review and test** the embed URL
3. **Set `approved: true`** after verification
4. **Commit and deploy**

**⚠️ Warning:** Only approve external URLs from trusted partners. Unapproved games will show a warning and cannot be played.

### Admin Workflow (Git)

1. Create feature branch: `git checkout -b add-game-<slug>`
2. Add game files to `/public/games/<slug>/`
3. Update `games.json`
4. Test locally: `npm run dev` or `netlify dev`
5. Commit: `git commit -m "Add game: <title>"`
6. Push and create PR
7. After merge, deploy

## 🧪 Testing

### Manual Testing Checklist

- [ ] Grid displays all approved games
- [ ] Search filters by title, description, category
- [ ] Category filter shows only selected category
- [ ] Click "Play" opens modal with iframe
- [ ] Game loads and is playable
- [ ] Press `Esc` closes modal
- [ ] Focus returns to Play button after close
- [ ] Mobile: single column layout, touch-friendly
- [ ] Unapproved games show warning and cannot be played
- [ ] Thumbnails load with lazy loading
- [ ] Keyboard shortcuts: `K` or `/` focuses search

### Automated Tests

Run Jest tests:

```bash
npm test -- GamesGallery.test.js
```

Tests cover:
- Search functionality
- Category filtering
- Modal open/close
- Focus management
- Unapproved game blocking

## 🎨 Customization

### Props

```jsx
<GamesGallery
  gamesSource="/games.json"  // URL or array
  maxColumns={4}             // Max grid columns
  className="custom-class"   // Additional CSS class
/>
```

### Styling

Override CSS variables or classes:

```css
.games-gallery {
  --games-primary-color: #your-color;
}

.games-card {
  /* Custom card styles */
}
```

## 📊 Analytics Integration

The component emits `game_play` events if `window.analytics` exists:

```javascript
window.analytics.track('game_play', {
  game_id: 'stunt-city',
  game_title: 'Stunt City',
  game_category: 'Driving'
});
```

## 🔧 Helper Scripts

### Validate Embed URLs

See `scripts/validate-game-embeds.js` for a script that checks:
- URLs respond with 200
- External URLs are whitelisted
- Required fields in games.json

### Copy Game Builds

See `scripts/copy-game-build.js` for uploading game files to `/public/games/<slug>/`

## ⚠️ Important Notes

### Copyright & Licensing

- **Do not hotlink copyrighted games** without permission
- Only host games you own or have licensed
- For external embeds, ensure partner agreements allow embedding
- Add proper attribution if required

### Performance

- Thumbnails are lazy-loaded (`loading="lazy"`)
- Modal iframe is code-split (loads only when opened)
- Preconnect to trusted embed hosts in `<head>`:
  ```html
  <link rel="preconnect" href="https://trusted-embed.com">
  ```

### Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Esc, Enter)
- Focus trap inside modal
- Screen reader friendly
- Reduced motion support

## 🐛 Troubleshooting

### Games not loading

1. Check browser console for errors
2. Verify `games.json` is valid JSON
3. Ensure game paths are correct (relative to public/)
4. Check CSP headers allow `frame-src`

### Modal not opening

1. Check if game is `approved: true`
2. Verify `src` URL is valid
3. Check browser console for CSP violations

### External embeds blocked

1. Add embed domain to CSP `frame-src`
2. Verify partner allows embedding (X-Frame-Options)
3. Check if URL requires authentication

## 📚 Examples

See `games.json` for 13 example entries covering:
- Driving games
- Parkour games
- Puzzle games
- Sports games
- External embed example (unapproved)

## 🚀 Deployment

### Netlify

1. Ensure `games.json` is in root
2. Place games in `public/games/`
3. Add `_headers` file for CSP
4. Deploy

### Vercel

1. Ensure `games.json` is in root
2. Place games in `public/games/`
3. Add `vercel.json` with headers
4. Deploy

## 📄 License

MIT - See your project's license file.

---

**Questions?** Check the component code comments or open an issue.

