# Environment Variables for Live Awareness Layer

## Required Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

### Supabase (Database)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**How to get:**
1. Go to https://supabase.com
2. Create a new project (or use existing)
3. Go to Project Settings → API
4. Copy "Project URL" → `SUPABASE_URL`
5. Copy "service_role" key (NOT anon key) → `SUPABASE_SERVICE_ROLE_KEY`

### OpenAI
```
OPENAI_API_KEY=sk-...
```

**How to get:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key → `OPENAI_API_KEY`

### Optional: RSS Feeds
```
RSS_FEEDS_JSON=[{"name":"BBC News","url":"https://feeds.bbci.co.uk/news/rss.xml","reliability":"major_media","tags":["news"]}]
```

**Format:** JSON array of feed objects:
```json
[
  {
    "name": "Feed Name",
    "url": "https://feed-url.com/rss.xml",
    "reliability": "major_media",
    "tags": ["tag1", "tag2"]
  }
]
```

## Local Development

For local testing with `netlify dev`:

1. Create `.env` file in project root:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
RSS_FEEDS_JSON=[{"name":"BBC","url":"https://feeds.bbci.co.uk/news/rss.xml","reliability":"major_media","tags":["news"]}]
```

2. Run: `netlify dev`

## Security Notes

- **Never commit** `.env` file or expose these keys in client-side code
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security - keep it secret
- `OPENAI_API_KEY` has billing access - keep it secret
- All keys are server-side only (Netlify Functions)

