#!/bin/bash
# Cloudflare Worker Setup Script
# This script helps automate the setup process

set -e

echo "🚀 Cloudflare Worker Setup"
echo "=========================="
echo ""

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js first."
    exit 1
fi

# Step 1: Login check
echo "📋 Step 1: Checking Cloudflare login..."
if npx wrangler whoami &> /dev/null; then
    echo "✅ Already logged in to Cloudflare"
    WHOAMI=$(npx wrangler whoami 2>&1 | grep -i "email" || echo "Logged in")
    echo "   $WHOAMI"
else
    echo "🔐 You need to login to Cloudflare"
    echo "   Running: npx wrangler login"
    echo "   This will open your browser..."
    npx wrangler login || {
        echo "❌ Login failed. Please run 'npx wrangler login' manually."
        exit 1
    }
fi

echo ""
echo "📦 Step 2: Creating KV namespaces..."
echo ""

# Create production namespace
echo "Creating production KV namespace..."
PROD_OUTPUT=$(npx wrangler kv:namespace create "FEED" 2>&1)
echo "$PROD_OUTPUT"

PROD_ID=$(echo "$PROD_OUTPUT" | grep -oP 'id = "\K[^"]+' | head -1)

if [ -z "$PROD_ID" ]; then
    echo "⚠️  Could not extract production namespace ID automatically"
    echo "   Please copy the ID from the output above and update wrangler.toml manually"
else
    echo "✅ Production namespace ID: $PROD_ID"
fi

# Create preview namespace
echo ""
echo "Creating preview KV namespace..."
PREVIEW_OUTPUT=$(npx wrangler kv:namespace create "FEED" --preview 2>&1)
echo "$PREVIEW_OUTPUT"

PREVIEW_ID=$(echo "$PREVIEW_OUTPUT" | grep -oP 'preview_id = "\K[^"]+' | head -1)

if [ -z "$PREVIEW_ID" ]; then
    echo "⚠️  Could not extract preview namespace ID automatically"
    echo "   Please copy the ID from the output above and update wrangler.toml manually"
else
    echo "✅ Preview namespace ID: $PREVIEW_ID"
fi

echo ""
echo "📝 Step 3: Updating wrangler.toml..."

if [ ! -z "$PROD_ID" ] && [ ! -z "$PREVIEW_ID" ]; then
    # Update wrangler.toml with IDs
    sed -i.bak "s/id = \"your-kv-namespace-id\"/id = \"$PROD_ID\"/" wrangler.toml
    sed -i.bak "s/preview_id = \"your-preview-kv-namespace-id\"/preview_id = \"$PREVIEW_ID\"/" wrangler.toml
    echo "✅ Updated wrangler.toml with KV namespace IDs"
else
    echo "⚠️  Please manually update wrangler.toml with the IDs shown above"
fi

echo ""
echo "🧪 Step 4: Testing locally (optional)..."
echo "   Run: npm run dev"
echo "   Then test: curl http://localhost:8787/feed"
echo ""

echo "🚀 Step 5: Ready to deploy!"
echo "   Run: npm run deploy"
echo ""

echo "✅ Setup complete! Next steps:"
echo "   1. Review wrangler.toml to confirm KV IDs are set"
echo "   2. Test locally: npm run dev"
echo "   3. Deploy: npm run deploy"
echo ""



