# State Department RSS Feeds - Explanation

## Primary Feed (Currently Used)

### ✅ Travel Advisories & Travel Warnings
**URL:** `https://travel.state.gov/_res/rss/TAsTWs.xml`
- **Status:** ✅ **ACTIVE - This is what we're using**
- **Content:** Official travel advisories with threat levels (Level 1-4)
- **Format:** Structured RSS with categories for threat levels and country codes
- **Why we use it:** This is the official feed specifically for travel advisories

---

## Additional State Department Feeds (Optional)

These feeds are available but most return "forbidden" errors when accessed. However, they could be useful if they become accessible:

### Regional Feeds
These contain region-specific updates that might include travel-related security information:

1. **Africa:** `https://www.state.gov/rss-feed/africa/feed/`
   - Regional updates for African countries
   - May include security alerts relevant to travelers

2. **East Asia & Pacific:** `https://www.state.gov/rss-feed/east-asia-and-the-pacific/feed/`
   - Updates for Asia-Pacific region
   - Could include travel warnings

3. **Europe & Eurasia:** `https://www.state.gov/rss-feed/europe-and-eurasia/feed/`
   - European regional updates
   - May contain security/travel information

4. **Near East:** `https://www.state.gov/rss-feed/near-east/feed/`
   - Middle East regional updates
   - Often includes security alerts

5. **South & Central Asia:** `https://www.state.gov/rss-feed/south-and-central-asia/feed/`
   - South/Central Asian updates
   - Could include travel advisories

6. **Western Hemisphere:** `https://www.state.gov/rss-feed/western-hemisphere/feed/`
   - Americas regional updates
   - May include travel warnings

### Security & Diplomatic Feeds

7. **Diplomatic Security:** `https://www.state.gov/rss-feed/diplomatic-security/feed/`
   - Security alerts and warnings
   - **Most relevant** for travel safety
   - May contain information about threats to travelers

### Other Feeds (Less Relevant for Travel Advisories)

8. **Press Releases:** `https://www.state.gov/rss-feed/press-releases/feed/`
   - General press releases
   - May occasionally mention travel advisories

9. **Department Press Briefings:** `https://www.state.gov/rss-feed/department-press-briefings/feed/`
   - Daily press briefings
   - May mention travel advisories in Q&A

10. **Collected Department Releases:** `https://www.state.gov/rss-feed/collected-department-releases/feed/`
    - Aggregated releases
    - May include travel-related announcements

11. **Secretary's Remarks:** `https://www.state.gov/rss-feed/secretarys-remarks/feed/`
    - Speeches and statements
    - Less directly relevant

12. **Public Schedule:** `https://www.state.gov/rss-feed/public-schedule/feed/`
    - Official schedules
    - Not relevant for travel advisories

13. **Treaties:** `https://www.state.gov/rss-feed/treaties-new/feed/`
    - Treaty information
    - Not relevant for travel advisories

14. **Direct Line to American Business:** `https://www.state.gov/rss-feed/direct-line-to-american-business/feed/`
    - Business-focused updates
    - May occasionally mention travel

15. **International Organizations:** `https://www.state.gov/rss-feed/international-organizations/feed/`
    - IO-related updates
    - Less relevant

---

## Current Implementation

### What We're Using Now:
- ✅ **Primary Feed:** `https://travel.state.gov/_res/rss/TAsTWs.xml`
  - This is the official travel advisories feed
  - Contains all Level 1-4 travel advisories
  - Structured format with threat levels and country codes

### Optional Additional Feeds:
The Embassy engine now supports fetching from additional feeds if you enable it:

**To enable additional feeds:**
1. Add to Netlify environment variables:
   ```
   ENABLE_STATE_DEPT_ADDITIONAL_FEEDS=true
   ```

2. The engine will then also check:
   - Diplomatic Security feed (most relevant)
   - Regional feeds (Africa, Asia, Europe, etc.)
   - Filters for travel/security-related content

**Note:** Most of these feeds currently return "forbidden" errors, but the code is ready if they become accessible.

---

## Recommendation

**For now:**
- ✅ Use the primary feed: `https://travel.state.gov/_res/rss/TAsTWs.xml`
- This gives you all official travel advisories

**If you want more coverage:**
- Enable `ENABLE_STATE_DEPT_ADDITIONAL_FEEDS=true`
- The engine will try to fetch from additional feeds
- It will filter for travel/security-related content
- Most feeds may not work due to access restrictions, but the code will handle it gracefully

---

## Summary

**Primary Feed (Active):**
- ✅ Travel Advisories: `https://travel.state.gov/_res/rss/TAsTWs.xml`

**Additional Feeds (Optional):**
- ⚠️ Most return "forbidden" errors
- Can be enabled with `ENABLE_STATE_DEPT_ADDITIONAL_FEEDS=true`
- Most relevant: Diplomatic Security feed
- Regional feeds may contain travel-related security info

The primary feed is sufficient for travel advisories. Additional feeds are optional and may not be accessible.

