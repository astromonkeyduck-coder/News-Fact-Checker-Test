/**
 * Debug Packet Test Script
 * Tests image generation for two different events to verify event-locked selection
 */

require('dotenv').config({ path: '.env.local' });

const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testEvent(eventId, detailUrl, magnitude, location, coordinates) {
  console.log('\n' + '='.repeat(80));
  console.log(`TESTING EVENT: ${eventId}`);
  console.log('='.repeat(80));
  console.log(`Location: ${location}`);
  console.log(`Magnitude: ${magnitude}`);
  console.log(`Coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
  console.log(`Detail URL: ${detailUrl}`);
  console.log('-'.repeat(80));
  
  try {
    const imageBuffer = await generateImage(
      magnitude,
      location,
      eventId,
      'standard',
      coordinates,
      detailUrl
    );
    
    if (imageBuffer) {
      const crypto = require('crypto');
      const finalHash = crypto.createHash('sha1').update(imageBuffer).digest('hex').substring(0, 8);
      console.log(`\n✅ Image generated successfully`);
      console.log(`Final image buffer hash: ${finalHash}`);
      console.log(`Buffer size: ${Math.round(imageBuffer.length / 1024)}KB`);
      
      // Save to file
      const fs = require('fs');
      const outputPath = `test-debug-${eventId}-${Date.now()}.png`;
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`Saved to: ${outputPath}`);
      
      return { success: true, bufferHash: finalHash, outputPath };
    } else {
      console.log(`\n❌ Image generation returned null`);
      return { success: false };
    }
  } catch (error) {
    console.error(`\n❌ Error generating image:`, error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n🔍 DEBUG PACKET TEST: Verifying Event-Locked Image Selection\n');
  
  // Test 1: Los Angeles event
  const laEvent = {
    eventId: 'ci41152183',
    detailUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ci41152183.geojson',
    magnitude: 1.33,
    location: 'Los Angeles, California',
    coordinates: [-118.2437, 34.0522]  // [lon, lat]
  };
  
  // Test 2: India event (known to have images)
  const indiaEvent = {
    eventId: 'us7000rmhe',
    detailUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000rmhe.geojson',
    magnitude: 6.8,
    location: 'Northeast India',
    coordinates: [91.5, 26.0]  // [lon, lat] - approximate coordinates for India event
  };
  
  const results = [];
  
  // Test LA event
  const laResult = await testEvent(
    laEvent.eventId,
    laEvent.detailUrl,
    laEvent.magnitude,
    laEvent.location,
    laEvent.coordinates
  );
  results.push({ event: 'LA', ...laResult });
  
  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test India event
  const indiaResult = await testEvent(
    indiaEvent.eventId,
    indiaEvent.detailUrl,
    indiaEvent.magnitude,
    indiaEvent.location,
    indiaEvent.coordinates
  );
  results.push({ event: 'India', ...indiaResult });
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`LA Event (${laEvent.eventId}):`);
  console.log(`  Success: ${laResult.success}`);
  if (laResult.bufferHash) {
    console.log(`  Buffer Hash: ${laResult.bufferHash}`);
  }
  console.log(`\nIndia Event (${indiaEvent.eventId}):`);
  console.log(`  Success: ${indiaResult.success}`);
  if (indiaResult.bufferHash) {
    console.log(`  Buffer Hash: ${indiaResult.bufferHash}`);
  }
  
  if (laResult.bufferHash && indiaResult.bufferHash) {
    if (laResult.bufferHash === indiaResult.bufferHash) {
      console.log(`\n❌ CRITICAL: Both events produced the SAME buffer hash!`);
      console.log(`   This indicates cross-event contamination (cache collision or wrong images)`);
    } else {
      console.log(`\n✅ Different buffer hashes - no cross-event contamination detected`);
    }
  }
  
  console.log('\n📋 Check the logs above for:');
  console.log('  - GeoJSON eventId matches request eventId');
  console.log('  - URLs contain the correct eventId');
  console.log('  - Different buffer hashes for different events');
  console.log('  - Rejected candidates (if any)');
}

runTests().catch(console.error);

