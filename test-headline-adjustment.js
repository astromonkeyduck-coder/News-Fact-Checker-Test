/**
 * Test script for headline block adjustment validation
 * Tests the 2 required cases to verify:
 * - Headline block moved down
 * - Magnitude is red and larger
 * - Text doesn't collide with accent line or map features
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testValidationCases() {
  console.log('🧪 Testing Headline Block Adjustment\n');
  console.log('='.repeat(60));
  
  const testCases = [
    { magnitude: 6.5, location: 'PAPUA NEW GUINEA' },
    { magnitude: 7.8, location: 'SOUTHERN IRAN' },
  ];
  
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const { magnitude, location } = testCase;
    
    console.log(`\n📸 Test ${i + 1}/2: M${magnitude} "${location}"`);
    console.log('   Generating image...');
    
    try {
      const imageBuffer = await generateImage(magnitude, location, [], `test-adjust-${i + 1}`);
      
      const filename = `adjusted-m${magnitude}-${location.toLowerCase().replace(/\s+/g, '-')}.png`;
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
  console.log('\n📂 Check test-output/ directory for generated images');
  console.log('\n🔍 Verify:');
  console.log('   - Headline block is visually centered in left zone');
  console.log('   - Magnitude is immediately noticeable (RED, larger)');
  console.log('   - Text does not collide with accent line or map features');
  console.log('   - Magnitude inline before "EARTHQUAKE NEAR" (same baseline)');
  console.log('   - Location directly under headline\n');
}

testValidationCases().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

