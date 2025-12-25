# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to https://supabase.com
2. Sign up / Log in
3. Click "New Project"
4. Fill in:
   - **Name:** `noteworthy-news` (or your choice)
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to your users
5. Wait for project to provision (~2 minutes)

## 2. Run Migration

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy contents of `supabase/migrations/001_create_live_events.sql`
4. Paste into SQL Editor
5. Click **Run**

## 3. Verify Table Creation

1. Go to **Table Editor** in Supabase dashboard
2. You should see `live_events` table
3. Verify columns:
   - `canonical_id` (text, primary key)
   - `title` (text)
   - `summary` (text)
   - `source_name` (text)
   - `source_url` (text)
   - `published_at` (timestamptz)
   - `fetched_at` (timestamptz)
   - `tags` (text array)
   - `reliability` (text)
   - `raw_json` (jsonb)

## 4. Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (NOT anon key) → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important:** Use `service_role` key, not `anon` key, because:
- Functions need to bypass Row Level Security
- Functions need full database access for ingestion

## 5. Test Connection

You can test the connection by running the ingest function manually:

```bash
# In Netlify Functions directory
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('live_events').select('count').then(r => console.log('Connected!', r));
"
```

## 6. Schedule the Ingest Function

The `ingest-live-events` function is configured to run every 5 minutes via Netlify Scheduled Functions.

To enable:
1. Go to Netlify Dashboard → Your Site → Functions
2. Find `ingest-live-events`
3. Enable scheduled execution (should be automatic with `exports.config`)

Or manually trigger:
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/ingest-live-events
```

## Next Steps

- See `ENV_VARS.md` for environment variable setup
- See `LOCAL_DEV.md` for local development instructions

