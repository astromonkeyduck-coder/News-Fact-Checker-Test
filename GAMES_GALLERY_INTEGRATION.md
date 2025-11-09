# Games Gallery - Quick Integration Guide

## 🚀 Fastest Integration (5 minutes)

### Step 1: Add CSS
Add to your HTML `<head>` or main CSS file:

```html
<link rel="stylesheet" href="/src/components/games-gallery.css">
```

### Step 2: Mount Component

#### If using React with build system (Vite/Next.js/CRA):

```jsx
import GamesGallery from './src/components/GamesGallery';

function App() {
  return <GamesGallery />;
}
```

#### If using vanilla HTML + React CDN:

```html
<div id="games-root"></div>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel" src="/src/components/GamesGallery.jsx"></script>
<script type="text/babel">
  const root = ReactDOM.createRoot(document.getElementById('games-root'));
  root.render(<GamesGallery />);
</script>
```

### Step 3: Add games.json

Place `games.json` in your public/root directory with at least one game:

```json
[
  {
    "id": "my-game",
    "title": "My Game",
    "category": "Puzzle",
    "src": "/games/my-game/index.html",
    "thumb": "/games/my-game/cover.jpg",
    "description": "A fun game",
    "approved": true
  }
]
```

### Step 4: Add a Game

1. Place game files in `/public/games/my-game/`
2. Ensure `index.html` exists
3. Add cover image as `cover.jpg` (optional)
4. Update `games.json` (see above)

### Step 5: Test

```bash
npm run dev
# or
netlify dev
```

Visit your page and verify the gallery loads!

## 📦 File Structure

```
your-project/
├── public/
│   ├── games/
│   │   ├── my-game/
│   │   │   ├── index.html
│   │   │   ├── cover.jpg
│   │   │   └── [other assets]
│   │   └── another-game/
│   │       └── ...
│   └── _headers (for Netlify CSP)
├── src/
│   └── components/
│       ├── GamesGallery.jsx
│       └── games-gallery.css
├── games.json
└── package.json
```

## ⚙️ Configuration Options

### Props

```jsx
<GamesGallery
  gamesSource="/games.json"  // URL to games.json or array
  maxColumns={4}             // Max grid columns (default: 4)
  className="my-custom-class" // Additional CSS class
/>
```

### Custom games.json location

```jsx
<GamesGallery gamesSource="/api/games" />
```

### Pass games as array

```jsx
const myGames = [
  {
    id: 'game1',
    title: 'Game 1',
    category: 'Puzzle',
    src: '/games/game1/index.html',
    approved: true
  }
];

<GamesGallery gamesSource={myGames} />
```

## 🔒 Security Setup

### Netlify

Create `public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; frame-src 'self' https://trusted-embed.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
```

### Vercel

Create `vercel.json` (see `vercel.json.example`):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; frame-src 'self' https://trusted-embed.com; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        }
      ]
    }
  ]
}
```

## 🎨 Styling

The component uses self-contained CSS. To customize:

```css
/* Override gallery styles */
.games-gallery {
  background: your-color;
}

.games-card {
  border-radius: 16px;
}
```

## 🧪 Testing

```bash
# Run tests
npm run test:games

# Validate games.json
npm run validate:games
```

## 📝 Adding Games

### Method 1: Manual

1. Upload game to `/public/games/<slug>/`
2. Edit `games.json`
3. Commit and deploy

### Method 2: Script

```bash
node scripts/copy-game-build.js ~/Downloads/my-game-build my-game
```

Then edit `games.json` to add the entry.

## 🐛 Troubleshooting

**Games not showing?**
- Check browser console for errors
- Verify `games.json` is valid JSON
- Ensure paths are correct (relative to public/)

**Modal not opening?**
- Check if game has `approved: true`
- Verify `src` path is correct
- Check CSP headers allow `frame-src`

**Styling broken?**
- Ensure CSS file is loaded
- Check for CSS conflicts
- Verify Tailwind isn't overriding (if using Tailwind)

## 📚 Next Steps

- Read full documentation: `GAMES_GALLERY_README.md`
- Review acceptance criteria: `GAMES_GALLERY_ACCEPTANCE.md`
- See example: `games-gallery-example.html`

## 💡 Tips

- Use `approved: false` for games pending review
- External embeds require `approved: true` to play
- Thumbnails are optional but recommended
- Categories are auto-generated from games
- Recently played games are stored in localStorage

---

**Need help?** Check the main README or component code comments.

