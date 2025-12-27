# Local Development Guide

## Prerequisites

- Node.js 18+ installed
- Netlify CLI installed: `npm install -g netlify-cli`
- Supabase project created (see `SUPABASE_SETUP.md`)

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Install function dependencies:**
```bash
cd netlify/functions
npm install @supabase/supabase-js openai
cd ../..
```

3. **Create `.env` file:**
```bash
cp .env.example .env
# Edit .env with your credentials (see ENV_VARS.md)
```

4. **Run Supabase migration:**
```bash
# Using Supabase CLI
supabase db push

# OR manually via Supabase Dashboard SQL Editor
# (copy contents of supabase/migrations/001_create_live_events.sql)
```

## Running Locally

```bash
# Start Netlify Dev server
netlify dev
```

This will:
- Start local server on `http://localhost:8888`
- Load environment variables from `.env`
- Run functions locally
- Hot-reload on changes

## Testing Functions

### Test Ingest Function
```bash
# Manual trigger
curl -X POST http://localhost:8888/.netlify/functions/ingest-live-events

# Check logs
# Should see: "Fetched X events total" and "Stored: X inserted"
```

### Test AI Answer Function
```bash
curl -X POST http://localhost:8888/.netlify/functions/ai-answer \
  -H "Content-Type: application/json" \
  -d '{"question": "What earthquakes happened today?"}'
```

Expected response:
```json
{
  "answer": "...",
  "sources": [...],
  "last_updated": "2025-12-24T...",
  "used_web_search": false,
  "db_events_count": 5
}
```

## Testing the Flow

1. **Trigger ingest:**
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/ingest-live-events
   ```

2. **Check database:**
   - Go to Supabase Dashboard → Table Editor → `live_events`
   - Should see new rows

3. **Ask AI about something in DB:**
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/ai-answer \
     -H "Content-Type: application/json" \
     -d '{"question": "What earthquakes happened recently?"}'
   ```
   - Should use DB only (`used_web_search: false`)

4. **Ask AI about something NOT in DB:**
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/ai-answer \
     -H "Content-Type: application/json" \
     -d '{"question": "What is the latest news about [obscure topic]?"}'
   ```
   - Should use web search (`used_web_search: true`)
   - Check DB again - new rows should be added

## Debugging

### Check Function Logs
```bash
# Netlify Dev shows logs in terminal
# Look for [Ingest] or [AI Answer] prefixes
```

### Check Database
- Supabase Dashboard → Table Editor
- Filter by `fetched_at` to see recent entries

### Common Issues

**"Missing Supabase credentials"**
- Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**"Missing OpenAI API key"**
- Check `.env` file has `OPENAI_API_KEY`

**"Table does not exist"**
- Run migration: `supabase db push` or manually via SQL Editor

**"Function not found"**
- Make sure you're in project root
- Check `netlify/functions/` directory structure

## Production Deployment

1. Set environment variables in Netlify Dashboard
2. Push to Git (Netlify auto-deploys)
3. Verify scheduled function is enabled:
   - Netlify Dashboard → Functions → `ingest-live-events`
   - Should show "Scheduled" status


