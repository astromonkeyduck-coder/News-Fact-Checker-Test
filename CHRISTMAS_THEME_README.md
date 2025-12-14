# Christmas Theme - Quick Toggle Guide

The Christmas theme adds festive decorations to your website including:
- ❄️ Animated snowflakes
- 🎄 Christmas color accents (red, green, gold)
- ✨ Subtle festive effects on buttons and links
- 🎁 Holiday-themed visual enhancements

## How to Turn OFF the Christmas Theme

**After Christmas, simply edit `christmas-config.js`:**

1. Open `christmas-config.js`
2. Change `ENABLE_CHRISTMAS_THEME: true` to `ENABLE_CHRISTMAS_THEME: false`
3. Save the file

That's it! The Christmas theme will be disabled across all pages.

## Auto-Disable Feature

The theme is configured to automatically disable after January 2nd, 2025. To change this date, edit the `AUTO_DISABLE_DATE` in `christmas-config.js`:

```javascript
AUTO_DISABLE_DATE: new Date('2025-01-02'), // Change this date
```

## Files Included

- `christmas-config.js` - Configuration file (toggle on/off here)
- `christmas-theme.css` - All Christmas styling
- `christmas-theme-loader.js` - Script that loads the theme conditionally

## Pages with Christmas Theme

The theme is automatically loaded on:
- `index.html`
- `article.html`
- `game.html`
- `mobile.html`

To add it to other pages, simply add these lines before the closing `</head>` tag:

```html
<!-- Christmas Theme - Easy to toggle on/off -->
<script src="christmas-config.js"></script>
<script>
    window.CHRISTMAS_CONFIG = CHRISTMAS_CONFIG;
</script>
<script src="christmas-theme-loader.js"></script>
```

## Customization

You can customize the Christmas theme by editing `christmas-theme.css`. The theme uses CSS variables for easy color customization:

```css
--christmas-red: #dc2626;
--christmas-green: #16a34a;
--christmas-gold: #fbbf24;
```

Happy Holidays! 🎄



