/**
 * Test script for template fix validation
 * Tests the 5 required cases to verify text placement
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testValidationCases() {
  console.log('🧪 Testing Template Fix - Validation Cases\n');
  console.log('='.repeat(60));
  
  const testCases = [
    { magnitude: 3.2, location: 'LAOS' },
    { magnitude: 6.5, location: 'PAPUA NEW GUINEA' },
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
      const imageBuffer = await generateImage(magnitude, location, [], `test-${i + 1}`);
      
      const filename = `validation-m${magnitude}-${location.toLowerCase().replace(/\s+/g, '-')}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, imageBuffer);
      
      console.log(`   ✅ Saved: ${filepath}`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Validation tests complete!');
  console.log('\n📂 Check test-output/ directory for all generated images');
  console.log('\n🔍 Verify:');
  console.log('   - "M#.#" is directly before "EARTHQUAKE NEAR" on same baseline');
  console.log('   - No clipping at edges');
  console.log('   - BOTH USGS images from template are visible');
  console.log('   - Layout matches template style exactly\n');
}

testValidationCases().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

