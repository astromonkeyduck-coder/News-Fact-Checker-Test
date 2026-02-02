# Cursor AI Project Guidelines - Noteworthy News

## Security Rules (CRITICAL)

1. **Never put secrets in client code**
   - API keys, tokens, and credentials must ONLY exist in server-side Netlify Functions
   - Use `process.env.*` in functions, never in HTML/JS that runs in browser
   - Never log API keys or sensitive tokens

2. **Serverless functions for external APIs**
   - All OpenAI, Supabase, and other API calls must go through Netlify Functions
   - Client-side code calls `/api/*` endpoints, not external APIs directly

## Hidden Pages & Tools

1. **Clemens Converter (`/clemensconverter`)**
   - Must NOT appear in navigation, sitemap, RSS feeds, or any internal links
   - Must include `<meta name="robots" content="noindex, nofollow, noarchive" />` in HTML
   - Must have `X-Robots-Tag: noindex, nofollow` header in netlify.toml
   - Accessible only by direct URL

2. **Other hidden tools**
   - Follow same pattern: noindex meta + header, no links, not in sitemap

## Code Style & Structure

1. **Minimal changes**
   - Keep changes focused and consistent with existing project structure
   - Follow existing patterns for Netlify Functions (see `netlify/functions/` examples)
   - Use existing asset structure (`assets/js/`, `assets/css/`)

2. **Netlify Functions**
   - Place in `netlify/functions/`
   - Use standard handler pattern: `exports.handler = async (event, context) => { ... }`
   - Include CORS headers for browser requests
   - Handle OPTIONS requests for CORS preflight

3. **Error Handling**
   - Always return proper HTTP status codes
   - Log errors server-side (without sensitive data)
   - Show user-friendly error messages in UI

## Dependencies

- Prefer existing dependencies when possible
- If adding new packages, document why in implementation
- Check `package.json` before adding dependencies

## CSS Architecture Guidelines

### File Structure

```
styles/
├── responsive.css    # Modern responsive foundation (USE THIS)
├── styles.css        # Legacy styles (being deprecated)
├── mobile.css        # Legacy mobile-only (being deprecated)
└── mobile-fixes.css  # Legacy fixes (being deprecated)
```

### Breakpoints (Content-First, Mobile-First)

Use `min-width` queries with rem-based breakpoints. **Never use max-width queries.**

```css
/* Mobile-first: base styles are for smallest screens */
.component { /* mobile styles */ }

@media (min-width: 36rem)  { /* sm: 576px+ phones landscape */ }
@media (min-width: 48rem)  { /* md: 768px+ tablets */ }
@media (min-width: 64rem)  { /* lg: 1024px+ desktop */ }
@media (min-width: 80rem)  { /* xl: 1280px+ wide screens */ }
```

**Why rem?** Respects user zoom preferences. 1rem = user's base font size.

### Typography

Always use CSS custom properties with `clamp()`:

```css
/* Good */
font-size: var(--fs-lg);

/* Bad */
font-size: 24px;
font-size: 1.5rem;
```

Available tokens: `--fs-xs`, `--fs-sm`, `--fs-base`, `--fs-md`, `--fs-lg`, `--fs-xl`, `--fs-2xl`

`clamp()` eliminates the need for typography-specific media queries.

### Spacing

Use spacing tokens for all padding, margin, and gap:

```css
/* Good */
padding: var(--space-md);
gap: var(--space-sm);
margin-bottom: var(--space-lg);

/* Bad */
padding: 16px;
gap: 0.5rem;
margin-bottom: 24px;
```

Available tokens: `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`, `--space-2xl`

### Container Queries

Use for components rendered in multiple layout contexts:

```css
@supports (container-type: inline-size) {
  .feed-post-card {
    container-type: inline-size;
    container-name: feed-card;
  }
  
  @container feed-card (min-width: 25rem) {
    .feed-post-text { -webkit-line-clamp: 8; }
  }
}
```

Components with container queries:
- `.feed-post-card` - text lines, media height
- `.hero-stat-card` - padding, font size
- `.game-card` / `.feature-card` - icon/text layout
- `.article-card` - image/text ratio
- `.footer-section` - compact layout

### No !important

If you need `!important`, the architecture is broken. Fix specificity by:

1. **Load order**: `responsive.css` loads after `styles.css`
2. **Selector specificity**: Use parent selectors (`.feed-container .feed-post-card`)
3. **CSS Layers** (future): `@layer components { ... }`

### Color Tokens

Use semantic color variables:

```css
/* Brand */
var(--color-primary)        /* #4A90E2 */
var(--color-primary-light)  /* #4FACFE */

/* Backgrounds */
var(--color-bg-dark)        /* #07152a */
var(--color-bg-card)        /* rgba(255,255,255,0.05) */
var(--color-bg-card-hover)  /* rgba(255,255,255,0.08) */

/* Text */
var(--color-text-primary)   /* #ffffff */
var(--color-text-secondary) /* rgba(255,255,255,0.85) */
var(--color-text-muted)     /* rgba(255,255,255,0.7) */

/* Borders */
var(--color-border)         /* rgba(255,255,255,0.1) */
var(--color-border-focus)   /* #4A90E2 */
```

### Touch Targets

All interactive elements must have minimum 44px touch target:

```css
.button {
  min-height: var(--touch-target-min); /* 44px */
  min-width: var(--touch-target-min);
}
```

### Accessibility

Always include:

```css
/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms; transition-duration: 0.01ms; }
}

/* High contrast */
@media (prefers-contrast: high) {
  /* Increase border visibility, text contrast */
}

/* Focus visible */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
```

### Migration Path

When adding new styles:

1. Add to `styles/responsive.css` (not `styles.css`)
2. Use design tokens (not raw values)
3. Write mobile-first (base = mobile, add @media for larger)
4. Test at 360px, 768px, 1024px, 1440px
5. Verify 200% browser zoom works correctly

### Layout Conventions

**Header:**
- Mobile: Hamburger menu, hidden nav
- Desktop (64rem+): Full navigation visible

**Hero Section:**
- Mobile: Stacked vertical, centered
- Desktop: Side-by-side with decorative elements

**Feed:**
- Mobile: Single column (680px max-width)
- Desktop (80rem+): Two-column grid

**Game/Feature Cards:**
- Mobile: Single column
- Tablet (36rem+): 2 columns
- Desktop (64rem+): 3 columns

**Footer:**
- Mobile: Single column stack
- Tablet (36rem+): 2 columns
- Desktop (64rem+): 4+ columns

### Testing Checklist

Before deploying CSS changes:

- [ ] 360px viewport (small phones)
- [ ] 768px viewport (tablets)
- [ ] 1024px viewport (small desktop)
- [ ] 1440px viewport (standard desktop)
- [ ] 200% browser zoom at each breakpoint
- [ ] `prefers-reduced-motion: reduce` enabled
- [ ] `prefers-contrast: high` enabled
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Screen reader landmark navigation

### Stylesheet Load Order

```html
<!-- 1. Modern responsive foundation (tokens, base, components) -->
<link rel="stylesheet" href="styles/responsive.css">

<!-- 2. Legacy styles (being deprecated) -->
<link rel="stylesheet" href="styles.css">

<!-- 3. Page-specific overrides (if needed) -->
<link rel="stylesheet" href="src/styles/page-specific.css">
```

### Token Quick Reference

| Category | Tokens |
|----------|--------|
| Typography | `--fs-xs`, `--fs-sm`, `--fs-base`, `--fs-md`, `--fs-lg`, `--fs-xl`, `--fs-2xl` |
| Spacing | `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`, `--space-2xl` |
| Colors | `--color-primary`, `--color-bg-*`, `--color-text-*`, `--color-border-*` |
| Layout | `--container-sm/md/lg/xl/2xl`, `--header-height`, `--touch-target-min` |
| Animation | `--duration-fast/normal/slow`, `--ease-in/out/in-out`, `--transition-*` |
| Radius | `--radius-sm/md/lg/xl/2xl/full` |
| Z-Index | `--z-dropdown/sticky/fixed/modal/popover/tooltip/toast` |
