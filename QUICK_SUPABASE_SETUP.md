# Quick Supabase Setup (Free Tier) - 5 Minutes

## What is Supabase?
Supabase is a free database service (like Firebase, but uses PostgreSQL). We use it to store earthquake events and track which ones we've already sent emails for.

## Free Tier Includes:
- ✅ 500 MB database storage (plenty for earthquakes)
- ✅ 1 GB file storage
- ✅ 50,000 monthly active users
- ✅ **Completely free** for this use case

---

## Step-by-Step Setup (5 Minutes)

### Step 1: Create Supabase Account
1. Go to **https://supabase.com**
2. Click **"Start your project"** or **"Sign up"**
3. Sign up with GitHub (easiest) or email
4. Verify your email if needed

### Step 2: Create New Project
1. Click **"New Project"**
2. Fill in:
   - **Name:** `noteworthy-news` (or anything you want)
   - **Database Password:** Create a strong password (save it somewhere safe, but you won't need it for this)
   - **Region:** Choose closest to you (e.g., `US East` or `US West`)
3. Click **"Create new project"**
4. Wait ~2 minutes for it to provision

### Step 3: Create Database Tables
1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy and paste this SQL (creates the tables we need):

```sql
-- Create verified_events table
CREATE TABLE IF NOT EXISTS verified_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id TEXT UNIQUE NOT NULL,
    engine TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
    title TEXT NOT NULL,
    summary TEXT,
    location_display TEXT,
    country_code TEXT,
    lat FLOAT,
    lon FLOAT,
    geobox JSONB,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    updated_at_source TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'update', 'resolved')),
    tags TEXT[],
    assets JSONB,
    image_url TEXT,
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMPTZ,
    raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create engine_runs table
CREATE TABLE IF NOT EXISTS engine_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engine TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    ok BOOLEAN DEFAULT false,
    count_new INTEGER DEFAULT 0,
    count_updated INTEGER DEFAULT 0,
    count_total_seen INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verified_events_canonical_id ON verified_events(canonical_id);
CREATE INDEX IF NOT EXISTS idx_verified_events_engine_fetched_at ON verified_events(engine, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_engine_runs_engine_started_at ON engine_runs(engine, started_at DESC);
```

4. Click **"Run"** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

### Step 4: Get Your API Credentials
1. In Supabase dashboard, click **"Project Settings"** (gear icon in bottom left)
2. Click **"API"** in the left sidebar
3. You'll see two important values:

   **a) Project URL:**
   - Copy the **"Project URL"** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - This is your `SUPABASE_URL`

   **b) Service Role Key:**
   - Scroll down to **"Project API keys"**
   - Find **"service_role"** key (NOT the "anon" key!)
   - Click the eye icon to reveal it
   - Copy the entire key (it's long, starts with `eyJ...`)
   - This is your `SUPABASE_SERVICE_ROLE_KEY`

   ⚠️ **Important:** Use the `service_role` key, NOT the `anon` key!

### Step 5: Add to Netlify Environment Variables
1. Go to **Netlify Dashboard** → Your Site → **Site Settings** → **Environment Variables**
2. Click **"Add a variable"**
3. Add these two variables:

   **Variable 1:**
   - Key: `SUPABASE_URL`
   - Value: (paste the Project URL from Step 4a)

   **Variable 2:**
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (paste the service_role key from Step 4b)

4. Click **"Save"** for each

---

## ✅ You're Done!

Now you have:
- ✅ Supabase account (free)
- ✅ Database tables created
- ✅ API credentials added to Netlify

The function will now be able to:
- Store earthquake events in the database
- Track which earthquakes have been sent
- Send you emails for new earthquakes

---

## Verify It Works

After you push and deploy:
1. Go to **Supabase Dashboard** → **Table Editor**
2. You should see `verified_events` and `engine_runs` tables
3. After the function runs, check `verified_events` - you should see earthquake data!

---

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Free tier limits: https://supabase.com/pricing
- If you get stuck, check the logs in Netlify Functions
