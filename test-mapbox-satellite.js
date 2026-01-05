/**
 * Test Mapbox Satellite Image Generation
 * Tests the new Mapbox satellite imagery with epicenter overlay
 */

require('dotenv').config({ path: '.env.local' });

// Import the generateImage function directly
const { generateImage } = require('./netlify/functions/generate-earthquake-image');
const fs = require('fs');
const crypto = require('crypto');

function getBufferHash(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return 'null';
  return crypto.createHash('sha1').update(buffer).digest('hex').substring(0, 8);
}

async function testMapboxSatellite() {
  console.log('\n🛰️ TESTING MAPBOX SATELLITE IMAGERY\n');
  console.log('='.repeat(80));
  
  // Check if MAPBOX_TOKEN is set
  const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
  if (!MAPBOX_TOKEN) {
    console.log('⚠️  MAPBOX_TOKEN not found in environment');
    console.log('   The system will fall back to location cards');
    console.log('   Set MAPBOX_TOKEN in .env.local for local testing');
    console.log('   Or set it in Netlify Dashboard → Environment Variables\n');
  } else {
    console.log('✅ MAPBOX_TOKEN found in environment');
    console.log(`   Token starts with: ${MAPBOX_TOKEN.substring(0, 10)}...\n`);
  }
  
  // Test with LA event (small earthquake, will use fallback maps)
  const testEvent = {
    eventId: 'ci41152183',
    detailUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ci41152183.geojson',
    magnitude: 1.33,
    location: 'Los Angeles, California',
    coordinates: [-118.2437, 34.0522]  // [lon, lat]
  };
  
  console.log('📋 Test Event:');
  console.log(`   Event ID: ${testEvent.eventId}`);
  console.log(`   Location: ${testEvent.location}`);
  console.log(`   Magnitude: M${testEvent.magnitude}`);
  console.log(`   Coordinates: [${testEvent.coordinates[0]}, ${testEvent.coordinates[1]}]`);
  console.log(`   Expected: Force fallback-only (no USGS images)`);
  console.log(`   Expected: 2 Mapbox satellite images (zoom 7 + zoom 11)`);
  console.log('\n' + '-'.repeat(80) + '\n');
  
  try {
    const startTime = Date.now();
    console.log('⏳ Generating image with Mapbox satellite fallback...\n');
    
    const imageBuffer = await generateImage(
      testEvent.magnitude,
      testEvent.location,
      testEvent.eventId,
      'standard',
      testEvent.coordinates,
      testEvent.detailUrl
    );
    
    const duration = Date.now() - startTime;
    
    if (imageBuffer) {
      const finalHash = getBufferHash(imageBuffer);
      console.log(`\n✅ Image generated successfully`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Final image buffer hash: ${finalHash}`);
      console.log(`   Buffer size: ${Math.round(imageBuffer.length / 1024)}KB`);
      
      // Save to file
      const outputPath = `test-mapbox-satellite-${Date.now()}.png`;
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`   Saved to: ${outputPath}`);
      
      // Open image
      try {
        require('child_process').execSync(`open ${outputPath}`);
        console.log(`   ✅ Opened in default viewer`);
      } catch (e) {
        console.log(`   ⚠️  Could not open image automatically`);
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 TEST RESULTS');
      console.log('='.repeat(80));
      console.log('\n✅ Image generation: SUCCESS');
      console.log(`   Output file: ${outputPath}`);
      console.log(`   File size: ${Math.round(imageBuffer.length / 1024)}KB`);
      console.log(`   Generation time: ${duration}ms`);
      
      if (MAPBOX_TOKEN) {
        console.log('\n✅ Mapbox integration: ACTIVE');
        console.log('   Check the image to verify:');
        console.log('   - Two satellite imagery maps (regional + local)');
        console.log('   - Epicenter overlays (rings, crosshair, dot)');
        console.log('   - NO text labels near epicenter');
        console.log('   - Maps show Los Angeles region');
      } else {
        console.log('\n⚠️  Mapbox integration: FALLBACK MODE');
        console.log('   The system used location cards instead of satellite imagery');
        console.log('   Set MAPBOX_TOKEN to enable satellite imagery');
      }
      
      console.log('\n📋 Next steps:');
      console.log('   1. Open the generated image to visually verify');
      console.log('   2. Check that both maps show satellite imagery (if MAPBOX_TOKEN set)');
      console.log('   3. Verify epicenter overlays are present and accurate');
      console.log('   4. Confirm no text labels appear near epicenter');
      
    } else {
      console.log(`\n❌ Image generation returned null`);
      console.log('   Check the logs above for errors');
    }
  } catch (error) {
    console.error(`\n❌ Error generating image:`, error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(0, 10).join('\n'));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(80));
    console.log('\nTroubleshooting:');
    console.log('  1. Check that MAPBOX_TOKEN is set (if using satellite imagery)');
    console.log('  2. Verify coordinates are valid (lat: -85 to 85, lon: -180 to 180)');
    console.log('  3. Check Netlify function logs for detailed error messages');
  }
}

testMapboxSatellite().catch(console.error);

