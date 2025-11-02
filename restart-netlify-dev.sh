#!/bin/bash
# Script to restart Netlify Dev and ensure functions are loaded

echo "🔄 Restarting Netlify Dev..."
echo ""
echo "1. Stopping any running Netlify Dev processes..."
pkill -f "netlify dev" 2>/dev/null
sleep 2

echo "2. Clearing Netlify cache..."
rm -rf .netlify/cache 2>/dev/null
rm -rf .netlify/functions-serve 2>/dev/null

echo "3. Verifying posts-read.js exists..."
if [ -f "netlify/functions/posts-read.js" ]; then
  echo "   ✅ posts-read.js found"
else
  echo "   ❌ posts-read.js NOT FOUND!"
  exit 1
fi

echo ""
echo "4. Starting Netlify Dev..."
echo "   Run this command in your terminal:"
echo "   npm run dev"
echo ""
echo "   Or run: npx netlify dev"
echo ""
echo "5. Wait for 'Functions server is running' message"
echo "6. Then refresh your browser at http://localhost:8888"
echo ""


