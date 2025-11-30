# Security Check System

A Cloudflare-style human verification screen for protecting routes on Noteworthy News.

## Overview

This system provides a professional, presidential-looking security check screen that appears before users access protected routes. It's designed to be easily customizable and ready for integration with real verification services (Cloudflare Turnstile, hCaptcha, etc.).

## Files

- **`src/components/SecurityCheck.jsx`** - Main React component
- **`src/components/security-check.css`** - Component styles
- **`security-check.html`** - Standalone security check page
- **`lib/security/securityConfig.js`** - Configuration file (ES6 module)
- **`lib/security/routeProtection.js`** - Route protection utility (ES6 module)
- **`lib/security/routeProtection-browser.js`** - Browser-compatible route protection (IIFE)

## Quick Start

### 1. Protect a Route

Add this script tag at the very beginning of your HTML page's `<body>`:

```html
<body>
    <!-- Route Protection: Security Check -->
    <script src="lib/security/routeProtection-browser.js"></script>
    <!-- Rest of your page content -->
</body>
```

### 2. Configure Protected Routes

Edit `lib/security/securityConfig.js` to add/remove protected routes:

```javascript
export const PROTECTED_ROUTES = [
  "/game",
  "/game.html",
  "/admin",
  "/dashboard",
  // Add your routes here
];
```

Or edit the `PROTECTED_ROUTES` array in `lib/security/routeProtection-browser.js` for the browser version.

### 3. Customize the Security Check Screen

Edit the config in `security-check.html` or modify `lib/security/securityConfig.js`:

```javascript
export const securityConfig = {
  title: "Your custom title",
  subtitle: "Your custom subtitle",
  loadingMessage: "Your loading message",
  estimatedTime: 3, // seconds
  logoUrl: "/your-logo.png",
  showContactLink: true
};
```

## How It Works

1. **Route Detection**: When a user visits a protected route, `routeProtection-browser.js` checks if the route is in the protected list.

2. **Verification Check**: It checks if the user has been verified recently (within 30 minutes) using `sessionStorage`.

3. **Redirect**: If not verified, the user is redirected to `/security-check.html?return=/original-path`.

4. **Verification Screen**: The SecurityCheck component displays a Cloudflare-style verification screen with:
   - Logo
   - Title and subtitle
   - Animated spinner
   - Progress indicator
   - Footer with help links

5. **Completion**: After the simulated verification (currently 2-4 seconds), the user is redirected back to their original destination.

6. **Session Storage**: A verification token is stored in `sessionStorage` that lasts 30 minutes.

## Integration with Real Verification

The SecurityCheck component has clear TODO comments where you should integrate real verification:

```javascript
// TODO: Replace this simulated verification with real logic:
// - Cloudflare Turnstile / hCaptcha verification
// - Server-side session/token validation
// - Rate limiting / IP reputation checks
// - Browser fingerprinting validation
```

### Example: Cloudflare Turnstile Integration

```javascript
// In SecurityCheck.jsx, replace the useEffect with:
useEffect(() => {
  // Load Turnstile script
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  script.async = true;
  script.defer = true;
  
  script.onload = () => {
    window.turnstile.render('#turnstile-widget', {
      sitekey: 'YOUR_SITE_KEY',
      callback: (token) => {
        // Verify token with your backend
        verifyToken(token).then((verified) => {
          if (verified) {
            setIsVerifying(false);
            if (onVerified) onVerified();
          }
        });
      }
    });
  };
  
  document.body.appendChild(script);
  
  return () => {
    // Cleanup
  };
}, [onVerified]);
```

## Customization

### Styling

Edit `src/components/security-check.css` to customize:
- Colors
- Card appearance
- Animations
- Spacing
- Mobile responsiveness

### Component Props

The SecurityCheck component accepts these props:

```javascript
<SecurityCheck
  title="Custom Title"
  subtitle="Custom subtitle"
  loadingMessage="Custom loading message"
  onVerified={() => console.log('Verified!')}
  estimatedTime={5}
  showContactLink={true}
  logoUrl="/custom-logo.png"
/>
```

## Protected Routes

Currently protected routes:
- `/game` / `/game.html`
- `/geography-game.html`
- `/admin` / `/admin-analytics.html` / `/admin-newsletter.html` / `/admin-add-tweets.html`
- `/dashboard`
- `/profile.html`

## Verification Duration

Users remain verified for **30 minutes** after completing the security check. This is configurable in `routeProtection-browser.js`:

```javascript
const maxAge = 30 * 60 * 1000; // Change this value
```

## Browser Compatibility

- Modern browsers with ES5+ support
- `sessionStorage` required
- React 18+ (loaded via CDN)

## Accessibility

- ARIA labels on spinner (`aria-busy`, `aria-label`)
- Keyboard accessible links
- High contrast mode support
- Reduced motion support

## Testing

1. Visit a protected route (e.g., `/game.html`)
2. You should be redirected to `/security-check.html`
3. Wait 2-4 seconds for verification
4. You should be redirected back to the original route
5. Refresh the page - you should NOT be redirected again (within 30 minutes)

## Troubleshooting

**Issue**: Security check doesn't appear
- Check browser console for errors
- Verify React and ReactDOM are loading
- Check that Babel standalone is loaded

**Issue**: Infinite redirect loop
- Clear `sessionStorage` in browser dev tools
- Check that the security check page itself is not in PROTECTED_ROUTES

**Issue**: Styling looks wrong
- Verify `security-check.css` is loaded
- Check that `styles.css` is not overriding styles
- Ensure fonts are loading correctly

## Future Enhancements

- [ ] Real Cloudflare Turnstile integration
- [ ] Server-side token validation
- [ ] Rate limiting based on IP
- [ ] Browser fingerprinting
- [ ] Configurable verification duration per route
- [ ] Analytics tracking for security checks

