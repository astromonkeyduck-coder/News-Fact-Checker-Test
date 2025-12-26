# How to Migrate Your Writing Style to Blobs

## Quick Migration Guide

### Step 1: Prepare Your Writing Style Content

Your writing style should be a single text block containing your writing samples. You can include multiple essays/examples separated by clear markers.

**Example format:**
```
[Your first writing sample here]

---

[Your second writing sample here]

---

[Your third writing sample here]
```

### Step 2: Get Required Values from Netlify

1. **NETLIFY_SITE_ID**: 
   - Go to Netlify Dashboard → Your Site → Site Settings → General
   - Find "Site information" → Copy the "Site ID"

2. **NETLIFY_BLOB_READ_WRITE_TOKEN**:
   - Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables
   - Find `NETLIFY_BLOB_READ_WRITE_TOKEN` → Copy the value
   - (If it doesn't exist, you'll need to create it in Netlify)

3. **WRITTING_STYLE**: 
   - Copy your writing style content (the text you want to migrate)

### Step 3: Run the Migration Script

**Option A: Using environment variables in terminal**

```bash
NETLIFY_SITE_ID="your-site-id-here" \
NETLIFY_BLOB_READ_WRITE_TOKEN="your-token-here" \
WRITTING_STYLE="$(cat your-writing-style.txt)" \
node netlify/functions/migrate-writing-style.js
```

**Option B: Using a .env file**

1. Create a `.env` file in your project root:
```bash
NETLIFY_SITE_ID=your-site-id-here
NETLIFY_BLOB_READ_WRITE_TOKEN=your-token-here
WRITTING_STYLE="[paste your writing style content here]"
```

2. Run the script:
```bash
node netlify/functions/migrate-writing-style.js
```

**Option C: For large content, use a file**

1. Save your writing style to a file (e.g., `writing-style.txt`)
2. Run:
```bash
export NETLIFY_SITE_ID="your-site-id-here"
export NETLIFY_BLOB_READ_WRITE_TOKEN="your-token-here"
export WRITTING_STYLE="$(cat writing-style.txt)"
node netlify/functions/migrate-writing-style.js
```

### Step 4: Verify Migration

The script will output:
- ✅ Writing style size in KB
- ✅ Confirmation that it was stored in Blobs
- 📝 Next steps

### Step 5: Remove from Netlify Environment Variables

**CRITICAL:** After successful migration, you MUST:
1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Find `WRITTING_STYLE`
3. **DELETE it** (this is required for deployment to succeed)
4. Save changes

### Step 6: Redeploy

After removing the environment variable, trigger a new deployment. It should now succeed!

## 🔒 Security Reminder

Your writing style is stored securely in Netlify Blobs:
- ✅ Encrypted at rest and in transit
- ✅ Only accessible by your functions
- ✅ Not exposed to the public internet
- ✅ More secure than environment variables

## Troubleshooting

**Error: "NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN must be set"**
- Make sure both values are set in your environment or .env file
- Verify the values are correct from Netlify Dashboard

**Error: "WRITTING_STYLE environment variable is not set"**
- Make sure you've set WRITTING_STYLE with your content
- For large content, use a file and export it as shown in Option C

**Migration succeeds but deployment still fails**
- Make sure you deleted WRITTING_STYLE from Netlify Dashboard environment variables
- Check that the migration script reported success
- Verify NETLIFY_BLOB_READ_WRITE_TOKEN is still set in Netlify

