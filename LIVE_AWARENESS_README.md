# Live Awareness Layer - Implementation Guide

## Overview

This system keeps your AI up-to-date with current events by:
1. **Ingesting** fresh events every 5 minutes into a Supabase database
2. **Answering** questions using the database first, falling back to OpenAI web search
3. **Storing** web search results back to the database for future use

## Architecture

```
┌─────────────────┐
│  Ingest Function│  (Every 5 min)
│ ingest-live-    │  Pulls from:
│ events          │  - Our site posts
└────────┬────────┘  - USGS earthquakes
         │           - RSS feeds (optional)
         ▼
┌─────────────────┐
│  Supabase DB    │
│  live_events    │  Stores normalized events
└────────┬────────┘  with deduplication
         │
         ▼
┌─────────────────┐
│  AI Answer      │  Query flow:
│  Function       │  1. Search DB (last 72h)
└────────┬────────┘  2. If insufficient → OpenAI web search
         │          3. Store web results → DB
         ▼
┌─────────────────┐
│  Frontend       │  Shows answer + sources
│  Widget         │  + last_updated timestamp
└─────────────────┘
```

## Quick Start

### 1. Setup Supabase (5 minutes)

See `SUPABASE_SETUP.md` for detailed instructions.

**TL;DR:**
```bash
# Create project at supabase.com
# Run migration:
supabase db push
# Or copy SQL from supabase/migrations/001_create_live_events.sql
```

### 2. Set Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

See `ENV_VARS.md` for details.

### 3. Install Dependencies

```bash
npm install
```

### 4. Deploy

Push to Git - Netlify auto-deploys. The scheduled function will start running automatically.

## Functions

### `ingest-live-events` (Scheduled)

**Runs:** Every 5 minutes  
**Purpose:** Pull fresh events from sources and store in database

**Sources:**
- Our own site posts (via `/.netlify/functions/get-posts`)
- USGS earthquake feed (last 24h, magnitude 2.5+)
- RSS feeds (optional, via `RSS_FEEDS_JSON` env var)

**Output:** Stores events in `live_events` table with deduplication

### `ai-answer` (On-demand)

**Called by:** Frontend when user asks a question  
**Purpose:** Provide up-to-date AI answers

**Flow:**
1. Search database for relevant events (last 72 hours)
2. If DB has ≥3 relevant events → Use DB only
3. If DB insufficient → Call OpenAI with web search
4. Store web search results back to DB
5. Return answer + sources + last_updated

**Request:**
```json
POST /.netlify/functions/ai-answer
{
  "question": "What earthquakes happened today?"
}
```

**Response:**
```json
{
  "answer": "According to USGS data, there were 3 earthquakes...",
  "sources": [
    {
      "title": "Earthquake: 4.2 magnitude at California",
      "url": "https://earthquake.usgs.gov/...",
      "snippet": "...",
      "published_at": "2025-12-24T10:30:00Z",
      "fetched_at": "2025-12-24T15:45:00Z",
      "source_name": "USGS",
      "reliability": "official"
    }
  ],
  "last_updated": "2025-12-24T15:45:00Z",
  "used_web_search": false,
  "db_events_count": 5
}
```

## Frontend Integration

### Option 1: Use `ai-answer` for Current Events

Update your chat widget to detect current events questions and route to `ai-answer`:

```javascript
// In noteworthy-chat.js or similar
async function askAI(question) {
  // Detect if question is about current events
  const isCurrentEvents = /(today|yesterday|recent|latest|breaking|news|earthquake|happened)/i.test(question);
  
  if (isCurrentEvents) {
    // Use ai-answer for current events
    const response = await fetch('/.netlify/functions/ai-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    
    const data = await response.json();
    
    // Display answer with sources
    displayAnswer(data.answer, data.sources, data.last_updated);
  } else {
    // Use regular noteworthy-chat for general questions
    // ... existing code ...
  }
}

function displayAnswer(answer, sources, lastUpdated) {
  // Show answer
  const answerEl = document.createElement('div');
  answerEl.innerHTML = answer.split('\n').map(p => `<p>${p}</p>`).join('');
  
  // Show last updated
  const updatedEl = document.createElement('div');
  updatedEl.className = 'last-updated';
  updatedEl.textContent = `Last updated: ${new Date(lastUpdated).toLocaleString()}`;
  
  // Show sources (expandable)
  const sourcesEl = document.createElement('details');
  sourcesEl.innerHTML = `
    <summary>Sources (${sources.length})</summary>
    <ul>
      ${sources.map(s => `
        <li>
          <a href="${s.url}" target="_blank">${s.title}</a>
          ${s.source_name ? ` (${s.source_name})` : ''}
          ${s.published_at ? ` - ${new Date(s.published_at).toLocaleDateString()}` : ''}
        </li>
      `).join('')}
    </ul>
  `;
  
  // Append to chat
  chatContainer.appendChild(answerEl);
  chatContainer.appendChild(updatedEl);
  chatContainer.appendChild(sourcesEl);
}
```

### Option 2: Integrate into `noteworthy-chat`

Modify `noteworthy-chat.js` to call `ai-answer` internally for current events questions, then format the response to match existing UI.

## Testing

### Test Ingest Function

```bash
# Manual trigger
curl -X POST https://your-site.netlify.app/.netlify/functions/ingest-live-events

# Check database
# Supabase Dashboard → Table Editor → live_events
# Should see new rows
```

### Test AI Answer Function

```bash
# Test with DB data (should use DB only)
curl -X POST https://your-site.netlify.app/.netlify/functions/ai-answer \
  -H "Content-Type: application/json" \
  -d '{"question": "What earthquakes happened recently?"}'

# Test with unknown topic (should use web search)
curl -X POST https://your-site.netlify.app/.netlify/functions/ai-answer \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the latest news about [obscure topic]?"}'
```

### Verify Tests (Must Pass)

1. ✅ Ask about something from yesterday in DB → Uses DB only (`used_web_search: false`)
2. ✅ Ask about something NOT in DB → Uses web search (`used_web_search: true`)
3. ✅ Ask about unknown topic → Says "I don't have confirmed information"

## Monitoring

### Check Ingest Status

```bash
# View function logs in Netlify Dashboard
# Or check database for recent fetched_at timestamps
```

### Check Database Health

```sql
-- Recent events count
SELECT COUNT(*) FROM live_events 
WHERE fetched_at > NOW() - INTERVAL '24 hours';

-- Events by source
SELECT source_name, COUNT(*) 
FROM live_events 
WHERE fetched_at > NOW() - INTERVAL '24 hours'
GROUP BY source_name;

-- Most recent events
SELECT title, source_name, fetched_at 
FROM live_events 
ORDER BY fetched_at DESC 
LIMIT 10;
```

## Troubleshooting

**Ingest function not running:**
- Check Netlify Dashboard → Functions → `ingest-live-events`
- Verify schedule is enabled
- Check function logs for errors

**Database empty:**
- Verify Supabase credentials in env vars
- Check migration was run successfully
- Test ingest function manually

**AI answers not using DB:**
- Check database has recent events (last 72h)
- Verify search query matches event titles/summaries
- Check function logs for search results

**Web search not working:**
- Verify `OPENAI_API_KEY` is set
- Check `search-web` function exists and works
- Check OpenAI API quota/billing

## Next Steps

- Add more RSS feeds via `RSS_FEEDS_JSON`
- Customize search relevance (improve keyword matching)
- Add more sources (Twitter API, news APIs, etc.)
- Implement caching for frequently asked questions
- Add analytics on DB vs web search usage

## Files

- `netlify/functions/ingest-live-events.js` - Scheduled ingestion
- `netlify/functions/ai-answer.js` - AI answer with DB-first approach
- `supabase/migrations/001_create_live_events.sql` - Database schema
- `ENV_VARS.md` - Environment variables guide
- `SUPABASE_SETUP.md` - Database setup
- `LOCAL_DEV.md` - Local development guide

