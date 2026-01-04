# Email Features Setup Guide

This guide explains how to set up and use the three new email features:

1. **Leaderboard Position Notifications** - "You got knocked out of #X spot!"
2. **Visit Streak Celebrations** - Celebrate daily visit streaks (starts after day 2)
3. **Location-Based Alerts** - Get alerts for events near your location

---

## 1. Leaderboard Position Notifications

### How It Works
- When someone submits a score that knocks you out of your leaderboard position, you get an email
- Only sends if you were previously in a position and got knocked out
- Works for all game types (fact-checker, geography, etc.)

### Setup
**Already integrated!** Just pass `userEmail` when submitting scores.

### Usage
When submitting a score to the leaderboard, include the user's email:

```javascript
// In your game code when submitting score
fetch('/.netlify/functions/leaderboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gameType: 'fact-checker',
    score: 1250,
    userName: 'Player Name',
    userId: 'user123',
    userEmail: 'user@example.com', // Add this for notifications
    // ... other game data
  })
});
```

### Email Preferences
Users can disable these notifications in their profile settings (you'll need to add this UI).

---

## 2. Visit Streak Celebrations

### How It Works
- Tracks daily visits to the site
- Streak starts counting after day 2 (so day 2 = streak of 1)
- Sends celebration emails at milestones: 2, 3, 4, 6, 8, 11, 15, 31, 51, 101 days

### Setup

#### Step 1: Track Visits on Page Load
Add this to your main pages (index.html, game.html, etc.):

```javascript
// Track visit when page loads (only for authenticated users)
if (window.auth0 && window.auth0.isAuthenticated()) {
  window.auth0.getUser().then(user => {
    if (user && user.email) {
      // Track visit (non-blocking)
      fetch('/.netlify/functions/track-visit-streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.name || user.nickname || null
        })
      }).catch(err => console.log('Streak tracking failed:', err));
    }
  });
}
```

#### Step 2: Add to Your Main Script
Add this to `script.js` or your main JavaScript file:

```javascript
// Track visit streak on page load
document.addEventListener('DOMContentLoaded', function() {
  // Wait for Auth0 to initialize
  setTimeout(() => {
    if (window.auth0 && window.auth0.isAuthenticated()) {
      window.auth0.getUser().then(user => {
        if (user && user.email) {
          fetch('/.netlify/functions/track-visit-streak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: user.email,
              userName: user.name || user.nickname || null
            })
          }).catch(err => {
            // Silently fail - don't interrupt user experience
            console.log('Streak tracking:', err);
          });
        }
      });
    }
  }, 1000); // Wait 1 second for Auth0 to initialize
});
```

### How Streaks Work
- **Day 1:** First visit (doesn't count)
- **Day 2:** Second consecutive visit = Streak of 1 (email sent!)
- **Day 3:** Third consecutive visit = Streak of 2 (email sent!)
- **Day 4:** Fourth consecutive visit = Streak of 3 (email sent!)
- And so on...

If a user misses a day, the streak resets to 1.

### Email Milestones
Emails are sent at:
- 2 days (streak 1)
- 3 days (streak 2)
- 4 days (streak 3)
- 6 days (streak 5)
- 8 days (streak 7)
- 11 days (streak 10)
- 15 days (streak 14)
- 31 days (streak 30)
- 51 days (streak 50)
- 101 days (streak 100)

---

## 3. Location-Based Alerts

### How It Works
- Users set their location and alert radius
- When events (weather, earthquakes, FAA, USCG, volcano, embassy) occur near them, they get an email
- Works with all your event engines

### Setup

#### Step 1: Add Location Preference UI
Add a location settings section to `profile.html`:

```html
<div class="location-settings">
  <h3>Location-Based Alerts</h3>
  <p>Get notified about events near you</p>
  
  <label>
    <input type="checkbox" id="location-alerts-enabled">
    Enable location-based alerts
  </label>
  
  <div id="location-inputs" style="display: none;">
    <label>
      City:
      <input type="text" id="location-city" placeholder="e.g., Miami, FL">
    </label>
    <label>
      Alert Radius (miles):
      <input type="number" id="location-radius" value="50" min="5" max="500">
    </label>
    <button onclick="saveLocationPreferences()">Save Location</button>
  </div>
</div>

<script>
async function saveLocationPreferences() {
  const enabled = document.getElementById('location-alerts-enabled').checked;
  const city = document.getElementById('location-city').value;
  const radius = parseInt(document.getElementById('location-radius').value) || 50;
  
  // Geocode city to get lat/lon (use your geocode-proxy function)
  const geocodeResponse = await fetch(`/.netlify/functions/geocode-proxy?address=${encodeURIComponent(city)}`);
  const geocodeData = await geocodeResponse.json();
  
  if (geocodeData.latitude && geocodeData.longitude) {
    const user = await window.auth0.getUser();
    
    // Save to user-data
    await fetch('/.netlify/functions/user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await window.auth0.getTokenSilently()}`
      },
      body: JSON.stringify({
        email: user.email,
        data: {
          preferences: {
            location: {
              enabled: enabled,
              city: city,
              latitude: geocodeData.latitude,
              longitude: geocodeData.longitude,
              radiusMiles: radius,
              alertTypes: ['all'] // or ['weather', 'earthquake', 'faa', etc.]
            }
          }
        }
      })
    });
    
    alert('Location preferences saved!');
  }
}
</script>
```

#### Step 2: Integrate with Event Engines
Update your event engines to check for location-based alerts. For example, in `engines/usgs.js`:

```javascript
// After creating/updating an event
if (event.latitude && event.longitude) {
  // Get all users with location alerts enabled
  // Then check if event is near each user
  // Send location alert if within radius
  
  // This is a simplified example - you'll need to:
  // 1. Get list of users with location alerts enabled
  // 2. For each user, check if event is within their radius
  // 3. Send alert if yes
  
  const { checkAndSendLocationAlert } = require('../send-location-alert');
  // ... check users and send alerts
}
```

**Note:** For production, you'll want to:
- Store user location preferences in a queryable database
- Batch check events against user locations
- Rate limit alerts (don't spam users)

### Alert Types
Users can choose which event types they want alerts for:
- `all` - All event types
- `weather` - Weather alerts (NWS)
- `earthquake` - Earthquakes (USGS)
- `faa` - Flight disruptions (FAA)
- `uscg` - Coast Guard alerts
- `volcano` - Volcano warnings
- `embassy` - Embassy advisories

---

## Testing

### Test Leaderboard Notifications
1. Submit a score with your email
2. Have someone else submit a higher score
3. Check your email for "knocked out" notification

### Test Streak Tracking
1. Visit the site today (authenticated)
2. Visit again tomorrow
3. Check email for streak celebration

### Test Location Alerts
1. Set your location in profile
2. Wait for an event near your location
3. Check email for location alert

---

## Environment Variables

Make sure these are set in Netlify:
- `RESEND_API_KEY` - For sending emails
- `RESEND_FROM_EMAIL` - From email address
- `NETLIFY_SITE_ID` - For Blobs storage
- `NETLIFY_BLOB_READ_WRITE_TOKEN` - For Blobs storage

---

## User Preferences

Users can manage their email preferences:
- **Profile page** - Add UI to enable/disable each email type
- **Unsubscribe links** - Include in every email
- **Email frequency** - Allow users to choose (immediate/daily digest)

---

## Next Steps

1. ✅ Functions are created and ready
2. ⏳ Add visit tracking to your pages
3. ⏳ Add location preferences UI to profile
4. ⏳ Integrate location checks into event engines
5. ⏳ Test everything!

---

## Questions?

- Check function logs in Netlify Dashboard
- Test each function individually
- Make sure environment variables are set
- Verify Resend API key is working

