# Comprehensive Data Logging & Analytics System

This document explains the comprehensive data logging and analytics system for Noteworthy News.

## Overview

The system automatically collects and logs:
- **IP addresses** of all users
- **AI chat interactions** (user inputs and AI responses)
- **Game scores** and leaderboard submissions
- **Newsletter signups**
- **Page views** and navigation
- **Clicks** and user interactions
- **Scroll depth** and engagement
- **Form submissions**
- **Time on site/page**
- **Tab visibility** (when users switch tabs)
- **Mouse movements** (heatmap data)
- **JavaScript errors**
- **User metadata** (user agent, referer, language, screen size, timezone, etc.)
- **Browser fingerprinting** for unique visitor tracking

## Storage

Data is stored in **Netlify Blobs** using the `analytics-data` store. Data is organized by:
- **Date** (`logs-YYYY-MM-DD`) - All logs for a specific day
- **Type** (`{dataType}-YYYY-MM-DD`) - All logs of a specific type for a day
- **Individual entries** (`entry-{id}`) - Individual log entries for detailed queries

## Data Types

### `ai-chat`
Logged when users interact with the AI chat:
- `userMessage` - What the user typed
- `aiResponse` - What the AI generated
- `usage` - Token usage from OpenAI API
- `model` - AI model used (e.g., "gpt-4o")
- `temperature` - AI temperature setting
- `maxTokens` - Max tokens setting
- `ip` - User's IP address
- `userAgent` - Browser/device info
- `timestamp` - When the interaction occurred

### `game-score`
Logged when users submit scores to leaderboards:
- `gameType` - "fact-checker" or "geography"
- `score` - The score achieved
- `userName` - Player's name (filtered for inappropriate content)
- `userId` - Unique user identifier
- `difficulty` - Game difficulty level
- `level` - Level reached
- `streak` - Best streak
- `time` - Completion time
- `speedBonus` - Speed bonus points
- `avgTime` - Average time per question
- `ip` - User's IP address
- `timestamp` - When the score was submitted

### `newsletter-signup`
Logged when users subscribe to the newsletter:
- `email` - Subscriber's email
- `firstName` - First name (if available)
- `fullName` - Full name (if available)
- `displayName` - Display name used in messages
- `notificationSent` - Whether admin notification was sent
- `autoReplySent` - Whether welcome email was sent
- `audienceAdded` - Whether added to Resend audience
- `ip` - User's IP address
- `timestamp` - When the signup occurred

### `page-view`
Logged automatically on every page load:
- `path` - Page path
- `search` - URL search parameters
- `hash` - URL hash
- `sessionId` - Unique session identifier
- `fingerprint` - Browser fingerprint for unique visitor tracking
- `pageUrl` - Full URL
- `pageTitle` - Page title
- `referrer` - Referring page
- `viewport` - Viewport dimensions
- `screen` - Screen dimensions
- `timeOnSite` - Total time on site
- `timeOnPage` - Time on current page
- `ip` - User's IP address
- `userAgent` - Browser/device info
- `timestamp` - When the page was viewed

### `click-batch`
Logged every 10 clicks (to avoid spam):
- `clicks` - Array of click events
- `totalClicks` - Total clicks in session
- Each click includes: target element info, position, timestamp

### `scroll-depth`
Logged when user scrolls:
- `depth` - Current scroll percentage
- `maxDepth` - Maximum scroll depth reached
- `scrollTop` - Scroll position
- `documentHeight` - Total document height
- `viewportHeight` - Viewport height

### `form-submit`
Logged when forms are submitted:
- `formId` - Form ID
- `formAction` - Form action URL
- `formMethod` - Form method
- `fieldCount` - Number of form fields

### `input-focus`
Logged when users focus on input fields:
- `inputType` - Input type (text, email, etc.)
- `inputId` - Input ID
- `inputName` - Input name
- `inputPlaceholder` - Input placeholder

### `page-exit`
Logged when user leaves the page:
- `timeOnPage` - Total time on page
- `timeOnSite` - Total time on site
- `maxScrollDepth` - Maximum scroll depth
- `clicks` - Total clicks
- `pageViews` - Total page views in session

### `tab-hidden` / `tab-visible`
Logged when user switches tabs:
- `timeOnPage` - Time on page when tab was hidden/visible

### `mouse-move`
Logged occasionally (10% of mouse movements) for heatmap data:
- `x` - Mouse X position
- `y` - Mouse Y position
- `timestamp` - When the movement occurred

### `javascript-error`
Logged when JavaScript errors occur:
- `message` - Error message
- `filename` - File where error occurred
- `lineno` - Line number
- `colno` - Column number
- `error` - Error object
- `stack` - Stack trace

### `custom-event`
For custom tracking events (use `window.trackEvent()`):
- `eventName` - Name of the custom event
- Any additional data you provide

## Querying Data

### Via API Endpoint

**GET** `/.netlify/functions/log-data`

Query parameters:
- `date` (optional) - Date in YYYY-MM-DD format (default: today)
- `type` (optional) - Filter by data type (e.g., "ai-chat", "game-score")
- `limit` (optional) - Number of results to return (default: 100, max: 10000)
- `format` (optional) - Response format: "json" (default) or "csv"

Examples:
```
/.netlify/functions/log-data?date=2025-01-15&type=ai-chat&limit=50
/.netlify/functions/log-data?type=game-score&format=csv
/.netlify/functions/log-data?date=2025-01-15&format=csv
```

### CSV Export

Add `&format=csv` to any query to export data as CSV:
```
/.netlify/functions/log-data?date=2025-01-15&type=ai-chat&format=csv
```

The CSV file will be automatically downloaded with filename: `noteworthy-data-YYYY-MM-DD-{type}.csv`

### Real-Time Streaming

**GET** `/.netlify/functions/stream-logs`

Query parameters:
- `date` (optional) - Date in YYYY-MM-DD format (default: today)
- `type` (optional) - Filter by data type
- `since` (optional) - ISO timestamp to get logs after this time
- `limit` (optional) - Number of results (default: 100)

Returns Server-Sent Events (SSE) format for real-time monitoring.

### Analytics Dashboard

Visit `/admin-analytics.html` for a visual dashboard with:
- Real-time log streaming
- Statistics and metrics
- CSV export button
- Date/type filtering
- Live updates every 5 seconds

## Response Format

### JSON Response

```json
{
  "logs": [
    {
      "dataType": "ai-chat",
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "referer": "https://noteworthynews.co/",
      "acceptLanguage": "en-US,en;q=0.9",
      "timestamp": "2025-01-15T10:30:00.000Z",
      "data": {
        "userMessage": "What is fact-checking?",
        "aiResponse": "Fact-checking is...",
        "usage": { "prompt_tokens": 50, "completion_tokens": 100 }
      },
      "id": "1736935800000-abc123"
    }
  ],
  "count": 1
}
```

### CSV Response

CSV format with all fields as columns. Nested objects are flattened with dot notation (e.g., `data.userMessage`).

## Client-Side Tracking

The analytics tracker (`src/utils/analytics-tracker.js`) automatically tracks:
- Page views on every page load
- Clicks (batched every 10 clicks)
- Scroll depth
- Form submissions
- Input focus
- Tab visibility
- Mouse movements (sampled)
- JavaScript errors
- Page exits

### Custom Event Tracking

You can track custom events from anywhere in your code:

```javascript
// Track a custom event
window.trackEvent('button-clicked', {
  buttonId: 'newsletter-signup',
  location: 'header'
});

// Or access the tracker directly
window.analyticsTracker.trackEvent('custom-action', {
  action: 'video-played',
  videoId: 'intro-video'
});
```

## Privacy & Security

- **IP addresses** are logged for analytics and security purposes
- **User messages** are logged to improve AI responses
- **Email addresses** are logged for newsletter management
- **Browser fingerprinting** is used for unique visitor tracking (doesn't use cookies)
- All data is stored securely in Netlify Blobs
- Data is organized by date for easy cleanup/archival
- Individual entries are limited to prevent storage bloat (50,000 per day)
- Client-side tracking is non-intrusive and doesn't block page functionality

## Adding New Data Types

To log a new type of data, use the `logData` function:

```javascript
const { logData } = require("./log-data");

// Log data (non-blocking)
logData("your-data-type", {
  field1: "value1",
  field2: "value2",
  // ... your data fields
}, event).catch(err => {
  console.error("Failed to log data:", err);
  // Don't fail the request if logging fails
});
```

## Automatic Logging

The following functions automatically log data:
- `noteworthy-chat.js` - Logs all AI chat interactions
- `leaderboard.js` - Logs all game score submissions
- `send-email.js` - Logs all newsletter signups
- `analytics-tracker.js` - Logs all visitor interactions (loaded on all pages)

## Storage Limits

- Maximum 50,000 entries per day per type
- Oldest entries are automatically removed when limit is reached
- Data is stored indefinitely unless manually cleaned up
- Consider archiving old data periodically

## Accessing Logs

You can access logs through:
1. **Analytics Dashboard** - `/admin-analytics.html` (visual interface with real-time streaming)
2. **API Endpoint** - Query via GET request
3. **CSV Export** - Add `&format=csv` to any query
4. **Netlify Dashboard** - View function logs
5. **Netlify Blobs** - Direct access via Netlify API (requires authentication)

## Real-Time Monitoring

The analytics dashboard (`/admin-analytics.html`) provides:
- **Live streaming** - Automatically updates every 5 seconds
- **Statistics** - Real-time counts of different event types
- **CSV export** - One-click export of filtered data
- **Date filtering** - View data for any date
- **Type filtering** - Filter by specific event types
- **Visual indicators** - See when new data arrives

## Data Collection Summary

The system collects comprehensive data on every visitor:

**Identity & Location:**
- IP address
- Browser fingerprint (unique visitor ID)
- Session ID
- Timezone
- Language preferences

**Behavior:**
- Pages visited
- Time on site/page
- Scroll depth
- Clicks and interactions
- Form submissions
- Tab switching
- Mouse movements (heatmap)

**Technical:**
- Browser/device info (user agent)
- Screen/viewport dimensions
- Referrer
- JavaScript errors
- Console errors

**Content:**
- AI chat messages and responses
- Game scores and performance
- Newsletter signups
- Custom events

This provides a complete picture of how users interact with your site!
