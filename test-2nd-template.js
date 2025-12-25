/**
 * Test script for 2ndUSGSTemp.png template validation
 * Tests the 5 required cases to verify dynamic text placement
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testValidationCases() {
  console.log('🧪 Testing 2ndUSGSTemp.png Template - Dynamic Text Only\n');
  console.log('='.repeat(60));
  
  const testCases = [
    { magnitude: 6.5, location: 'PAPUA NEW GUINEA' },
    { magnitude: 3.1, location: 'CHILE' },
    { magnitude: 7.8, location: 'SOUTHERN IRAN' },
    { magnitude: 4.9, location: 'NEAR THE KERMADEC ISLANDS' },
    { magnitude: 2.7, location: 'PUERTO RICO' },
  ];
  
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const { magnitude, location } = testCase;
    
    console.log(`\n📸 Test ${i + 1}/5: M${magnitude} "${location}"`);
    console.log('   Generating image...');
    
    try {
      const imageBuffer = await generateImage(magnitude, location, [], `test-2nd-${i + 1}`);
      
      const filename = `2nd-m${magnitude}-${location.toLowerCase().replace(/\s+/g, '-')}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, imageBuffer);
      
      console.log(`   ✅ Saved: ${filepath}`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Validation tests complete!');
  console.log('\n📂 Check test-output/ directory for all generated images');
  console.log('\n🔍 Verify:');
  console.log('   - Only ONE headline exists (no duplicates)');
  console.log('   - Magnitude is inline before EARTHQUAKE NEAR (same baseline)');
  console.log('   - Location is under headline in red');
  console.log('   - USGS images are present (from template)');
  console.log('   - Nothing overlaps banner or USGS assets');
  console.log('   - No clipping on edges');
  console.log('   - Template static elements preserved (map, rings, footer, banner)\n');
}

testValidationCases().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

