/**
 * Test Mapbox integration in production
 * This script tests if MAPBOX_TOKEN is accessible and Mapbox API works
 */

require('dotenv').config({ path: '.env.local' });

async function testMapboxProduction() {
  console.log('\n🛰️ TESTING MAPBOX PRODUCTION INTEGRATION\n');
  console.log('='.repeat(80));
  
  // Test 1: Check if MAPBOX_TOKEN is set locally (for reference)
  const localToken = process.env.MAPBOX_TOKEN;
  if (localToken) {
    console.log('✅ MAPBOX_TOKEN found locally');
    console.log(`   Token starts with: ${localToken.substring(0, 10)}...`);
  } else {
    console.log('⚠️  MAPBOX_TOKEN not found locally (expected - should be in Netlify)');
  }
  
  console.log('\n📋 Test Instructions:');
  console.log('   1. Check Netlify Dashboard → Functions → Logs');
  console.log('   2. Look for the next earthquake event');
  console.log('   3. Search logs for:');
  console.log('      - "🔗 Mapbox API URL" (confirms function is running)');
  console.log('      - "✅ Mapbox satellite image fetched" (success)');
  console.log('      - "⚠️ MAPBOX_TOKEN not set" (token missing)');
  console.log('      - "❌ Failed to fetch Mapbox satellite image" (API error)');
  console.log('      - "⚠️ Mapbox satellite failed" (fallback triggered)');
  
  console.log('\n🔍 Expected Behavior:');
  console.log('   ✅ If MAPBOX_TOKEN is set in Netlify:');
  console.log('      - Logs should show "🔗 Mapbox API URL"');
  console.log('      - Logs should show "✅ Mapbox satellite image fetched"');
  console.log('      - Generated images should show satellite imagery with epicenter overlays');
  console.log('');
  console.log('   ❌ If MAPBOX_TOKEN is NOT set or invalid:');
  console.log('      - Logs will show "⚠️ MAPBOX_TOKEN not set"');
  console.log('      - Logs will show "⚠️ Mapbox satellite failed"');
  console.log('      - Generated images will show location cards (grey boxes)');
  
  console.log('\n📊 How to Verify:');
  console.log('   1. Wait for the next earthquake event (or trigger one manually)');
  console.log('   2. Check the generated image - it should show:');
  console.log('      - Satellite imagery (aerial/satellite view of the location)');
  console.log('      - Red epicenter rings and crosshair overlay');
  console.log('      - NO text labels near epicenter');
  console.log('      - Two different zoom levels (regional + local)');
  console.log('   3. If you see grey location cards instead, check Netlify logs');
  
  console.log('\n🔧 Troubleshooting:');
  console.log('   If Mapbox is not working:');
  console.log('   1. Verify MAPBOX_TOKEN in Netlify Dashboard → Environment Variables');
  console.log('   2. Ensure token is set for "All scopes" or at least "Functions"');
  console.log('   3. Check token starts with "pk." (public token) or "sk." (secret token)');
  console.log('   4. Verify token has "styles:read" and "styles:tiles" scopes');
  console.log('   5. Check Netlify function logs for specific error messages');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test script complete');
  console.log('   Next step: Monitor Netlify logs for the next earthquake event');
  console.log('='.repeat(80) + '\n');
}

testMapboxProduction().catch(console.error);

