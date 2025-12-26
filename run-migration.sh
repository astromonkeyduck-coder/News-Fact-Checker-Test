#!/bin/bash
# Migration script helper - Run this after setting your Netlify credentials

echo "🚀 Writing Style Migration Helper"
echo "=================================="
echo ""

# Check if writing style file exists
if [ ! -f "writing-style-samples.txt" ]; then
    echo "❌ Error: writing-style-samples.txt not found"
    exit 1
fi

# Load .env file if it exists
if [ -f ".env" ]; then
    echo "📁 Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Load .env.netlify file if it exists (for Netlify-specific credentials)
if [ -f ".env.netlify" ]; then
    echo "📁 Loading .env.netlify file..."
    export $(cat .env.netlify | grep -v '^#' | grep -v '^$' | xargs)
fi

# Check for required variables
if [ -z "$NETLIFY_SITE_ID" ]; then
    echo "❌ NETLIFY_SITE_ID is not set"
    echo "   Get it from: Netlify Dashboard → Site Settings → General → Site ID"
    echo ""
    read -p "Enter NETLIFY_SITE_ID (or press Enter to skip): " SITE_ID
    if [ ! -z "$SITE_ID" ]; then
        export NETLIFY_SITE_ID="$SITE_ID"
    else
        echo "❌ Cannot proceed without NETLIFY_SITE_ID"
        exit 1
    fi
fi

if [ -z "$NETLIFY_BLOB_READ_WRITE_TOKEN" ]; then
    echo "❌ NETLIFY_BLOB_READ_WRITE_TOKEN is not set"
    echo "   Get it from: Netlify Dashboard → Site Settings → Environment Variables"
    echo ""
    read -p "Enter NETLIFY_BLOB_READ_WRITE_TOKEN (or press Enter to skip): " TOKEN
    if [ ! -z "$TOKEN" ]; then
        export NETLIFY_BLOB_READ_WRITE_TOKEN="$TOKEN"
    else
        echo "❌ Cannot proceed without NETLIFY_BLOB_READ_WRITE_TOKEN"
        exit 1
    fi
fi

# Load writing style
export WRITTING_STYLE="$(cat writing-style-samples.txt)"

echo ""
echo "✅ All required variables are set"
echo "📊 Writing style size: $(echo "$WRITTING_STYLE" | wc -c | awk '{printf "%.2f KB", $1/1024}')"
echo ""
echo "🔄 Running migration..."
echo ""

# Run the migration
node netlify/functions/migrate-writing-style.js

