#!/bin/bash
# Quick migration script

echo "🚀 Migrating posts from Netlify to Cloudflare..."
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Run migration
node migrate-posts.js


