/**
 * Test Image Generation with Strict Event Binding
 * Generates actual images for two different events to verify no cross-contamination
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
    const startTime = Date.now();
    const imageBuffer = await generateImage(
      magnitude,
      location,
      eventId,
      'standard',
      coordinates,
      detailUrl
    );
    const duration = Date.now() - startTime;
    
    if (imageBuffer) {
      const finalHash = getBufferHash(imageBuffer);
      console.log(`\n✅ Image generated successfully`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Final image buffer hash: ${finalHash}`);
      console.log(`  Buffer size: ${Math.round(imageBuffer.length / 1024)}KB`);
      
      // Save to file
      const outputPath = `test-strict-${eventId}-${Date.now()}.png`;
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`  Saved to: ${outputPath}`);
      
      // Open image
      try {
        require('child_process').execSync(`open ${outputPath}`);
      } catch (e) {
        // Ignore if open fails
      }
      
      return { success: true, bufferHash: finalHash, outputPath, duration };
    } else {
      console.log(`\n❌ Image generation returned null`);
      return { success: false };
    }
  } catch (error) {
    console.error(`\n❌ Error generating image:`, error.message);
    if (error.stack) {
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n🔍 STRICT EVENT BINDING IMAGE GENERATION TEST\n');
  console.log('This test will generate images for two different events');
  console.log('to verify that strict binding prevents cross-event contamination.\n');
  
  // Test 1: Los Angeles event (small, may not have images)
  const laEvent = {
    eventId: 'ci41152183',
    detailUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ci41152183.geojson',
    magnitude: 1.33,
    location: 'Los Angeles, California',
    coordinates: [-118.2437, 34.0522]  // [lon, lat]
  };
  
  // Test 2: India event (large, has images)
  const indiaEvent = {
    eventId: 'us7000rmhe',
    detailUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us7000rmhe.geojson',
    magnitude: 6.8,
    location: 'Northeast India',
    coordinates: [91.5, 26.0]  // [lon, lat]
  };
  
  const results = [];
  
  console.log('⏳ Generating image for LA event...');
  const laResult = await testEvent(
    laEvent.eventId,
    laEvent.detailUrl,
    laEvent.magnitude,
    laEvent.location,
    laEvent.coordinates
  );
  results.push({ event: 'LA', ...laResult });
  
  // Wait 2 seconds between tests
  console.log('\n⏳ Waiting 2 seconds before next test...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n⏳ Generating image for India event...');
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
  
  console.log(`\nLA Event (${laEvent.eventId}):`);
  console.log(`  Success: ${laResult.success ? '✅' : '❌'}`);
  if (laResult.bufferHash) {
    console.log(`  Buffer Hash: ${laResult.bufferHash}`);
    console.log(`  Duration: ${laResult.duration}ms`);
    console.log(`  Output: ${laResult.outputPath}`);
  }
  if (laResult.error) {
    console.log(`  Error: ${laResult.error}`);
  }
  
  console.log(`\nIndia Event (${indiaEvent.eventId}):`);
  console.log(`  Success: ${indiaResult.success ? '✅' : '❌'}`);
  if (indiaResult.bufferHash) {
    console.log(`  Buffer Hash: ${indiaResult.bufferHash}`);
    console.log(`  Duration: ${indiaResult.duration}ms`);
    console.log(`  Output: ${indiaResult.outputPath}`);
  }
  if (indiaResult.error) {
    console.log(`  Error: ${indiaResult.error}`);
  }
  
  // Critical check: Different buffer hashes
  if (laResult.bufferHash && indiaResult.bufferHash) {
    if (laResult.bufferHash === indiaResult.bufferHash) {
      console.log(`\n❌ CRITICAL: Both events produced the SAME buffer hash!`);
      console.log(`   This indicates cross-event contamination (cache collision or wrong images)`);
      console.log(`   Hash: ${laResult.bufferHash}`);
    } else {
      console.log(`\n✅ Different buffer hashes - no cross-event contamination detected`);
      console.log(`   LA hash:    ${laResult.bufferHash}`);
      console.log(`   India hash: ${indiaResult.bufferHash}`);
    }
  }
  
  console.log('\n📋 Check the generated images to verify:');
  console.log('  - LA image shows California location (or fallback map)');
  console.log('  - India image shows India location/shakemaps');
  console.log('  - No India maps appear in LA image');
  console.log('  - No LA maps appear in India image');
  
  console.log('\n📋 Check the logs above for:');
  console.log('  - "Products present" log block with strictMatch status');
  console.log('  - "Final selected images" log block with buffer hashes');
  console.log('  - Any "REJECTED" or "CRITICAL" messages');
}

runTests().catch(console.error);

