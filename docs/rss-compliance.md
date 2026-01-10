# RSS Feed Compliance & Copyright Policy

## Overview

The Noteworthy News "RSS Intelligence" feature aggregates headlines from trusted RSS feeds for situational awareness. This document outlines our copyright-compliant implementation and policies.

## Core Principles

### 1. Headline-Only Policy

**What We Display:**
- **Headline/Title** - The article title from the RSS feed
- **Source Attribution** - Publisher name with link
- **Published Time** - When the article was published
- **Short Snippet** - Only if explicitly provided in RSS feed, clamped to 200 characters maximum
- **Link to Original** - Always links to the publisher's article (opens in new tab)

**What We DO NOT Display:**
- Full article text
- `content:encoded` fields (full article bodies)
- Article images/media (unless explicitly permitted)
- Any content scraped from article pages
- Paywalled content bypass

### 2. Attribution Requirements

Every headline item must display:
- **Source Name** - Clickable link to publisher homepage or article
- **"via RSS"** indicator - Small text showing content source
- **Publisher Link** - Direct link to original article

Example:
```
Source: BBC World (link)
via RSS
```

### 3. Link-Out Policy

- All headlines link to the **canonical article URL** from the RSS feed
- Links open in **new tab** with `rel="noopener noreferrer"`
- We **never inline** publisher images or media by default
- We **never host** or cache full article content

### 4. Content Snippet Rules

Snippets are only displayed if:
1. The RSS feed explicitly provides a description/summary field
2. The snippet is under 200 characters (clamped with "…" if longer)
3. The snippet does not appear to be full article text (>500 chars = discarded)
4. The feed's `snippetPolicy.allowDescription` is `true`

We **never** use:
- `content:encoded` fields (full article HTML)
- Scraped content from article pages
- Any content that looks like a full article body

### 5. Caching & Storage

**Server-Side Cache:**
- Feed fetch results cached for **10 minutes** (configurable)
- In-memory cache (ephemeral, cleared on function restart)
- Cache key: `feed_{feedId}`

**Client-Side Storage:**
- Minimal metadata only (title, link, published, source, snippet)
- Stored for up to **24 hours** maximum
- No long-term archiving without explicit reason
- User preferences (enabled feeds) stored in localStorage

**What We Do NOT Store:**
- Full RSS XML
- Full article text
- Article images/media
- Long-term archives

### 6. Rate Limiting & Safety

**Per-Feed Limits:**
- Maximum **1 fetch per 10 minutes** per feed (configurable)
- Request timeout: **8 seconds**
- Maximum **25 items** per feed per fetch
- Concurrency limit: **4 feeds** fetched in parallel

**Error Handling:**
- Failed feeds do not break the UI
- Graceful degradation with error messages
- No retry storms or DDoS behavior
- Respects HTTP 429 (rate limit) responses

### 7. Robots & Scraping Policy

**What We Request:**
- **Only** the RSS/Atom feed URL itself
- User-Agent: `NoteworthyNewsRSSBot/1.0 (contact: contact@noteworthynews.co)`
- Standard HTTP headers only

**What We Do NOT Do:**
- Fetch article HTML pages
- Scrape publisher websites
- Bypass paywalls
- Use proxies or workarounds
- Store full article content

### 8. Source Controls & Opt-Out

**User Controls:**
- Toggle feeds on/off via UI
- Filter by region, topic, source
- Adjust time window (1h, 6h, 24h, 1 week)

**Publisher Opt-Out:**
- Immediate disable via config file
- Contact email: `contact@noteworthynews.co`
- Feed removal request honored within 24 hours
- No questions asked - immediate compliance

**Configuration:**
- Feed registry: `/src/rss/feeds.js`
- Disable feed by setting `enabledByDefault: false`
- Or add to `disabledFeeds` array in user config

### 9. Content Display Rules

**UI Design:**
- No sensational styling
- Clear source attribution
- No image thumbnails by default
- Professional, credible appearance
- "Why shown?" hover tooltip explains source

**Legal Disclaimer:**
Every panel displays:
```
Headlines and snippets are provided by their respective publishers. 
Click through for full context. © rights belong to original owners.

Not affiliated with publishers.
```

### 10. Security & SSRF Protection

**Feed URL Validation:**
- Only feeds from the registry are allowed
- Feed URLs must match exactly (no wildcards)
- Prevents Server-Side Request Forgery (SSRF) attacks
- No arbitrary URL fetching

**Input Sanitization:**
- All strings sanitized before display
- HTML tags stripped from snippets
- URLs validated (must be http/https)
- No raw HTML rendering

## Technical Implementation

### Feed Registry

Location: `/src/rss/feeds.js`

Each feed definition includes:
- `id` - Unique identifier
- `name` - Publisher name
- `homepage` - Publisher website
- `feedUrl` - RSS feed URL
- `snippetPolicy` - Whether to show snippets, max chars
- `licenseNotes` - Internal compliance reminder

### API Endpoints

**Single Feed:**
- `GET /.netlify/functions/rss-feed?feedId=<id>`
- Returns normalized feed data with items

**Aggregate:**
- `GET /.netlify/functions/rss-aggregate?region=<r>&topic=<t>&source=<s>&timeWindowHours=<h>&limit=<n>`
- Returns combined, deduplicated, sorted items from all enabled feeds

### Parsing Logic

1. Fetch RSS feed with proper User-Agent
2. Parse with `rss-parser` library
3. Normalize items:
   - Extract title, link, published date
   - Process snippet (if allowed) with HTML stripping and length clamping
   - Discard items without valid title/URL
4. Deduplicate by URL + title hash
5. Sort by published date (newest first)

## Contact & Removal Requests

**Publisher Contact:**
- Email: `contact@noteworthynews.co`
- Subject: "RSS Feed Removal Request"
- Include: Feed URL and publisher name

**Response Time:**
- Immediate acknowledgment
- Feed disabled within 24 hours
- Confirmation sent to requester

## Compliance Checklist

- ✅ Headlines only (no full articles)
- ✅ Proper attribution on every item
- ✅ Links to original articles
- ✅ Snippet clamping (200 chars max)
- ✅ No content:encoded usage
- ✅ No article page scraping
- ✅ Rate limiting (10 min per feed)
- ✅ SSRF protection (registry-only URLs)
- ✅ User opt-out controls
- ✅ Publisher removal process
- ✅ Legal disclaimer in UI
- ✅ Ephemeral caching (10 min TTL)
- ✅ Honest User-Agent header

## Updates

This policy is subject to updates. Last updated: January 2026.

For questions or concerns, contact: `contact@noteworthynews.co`
