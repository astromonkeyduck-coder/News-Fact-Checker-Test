/**
 * Test script for 3-line headline system validation
 * Tests the 4 required cases to verify text placement
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testValidationCases() {
  console.log('🧪 Testing 3-Line Headline System\n');
  console.log('='.repeat(60));
  
  const testCases = [
    { magnitude: 6.5, location: 'PAPUA NEW GUINEA' },
    { magnitude: 3.1, location: 'CHILE' },
    { magnitude: 7.8, location: 'SOUTHERN IRAN' },
    { magnitude: 4.9, location: 'NEAR THE KERMADEC ISLANDS' },
  ];
  
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const { magnitude, location } = testCase;
    
    console.log(`\n📸 Test ${i + 1}/4: M${magnitude} "${location}"`);
    console.log('   Generating image...');
    
    try {
      const imageBuffer = await generateImage(magnitude, location, [], `test-3line-${i + 1}`);
      
      const filename = `3line-m${magnitude}-${location.toLowerCase().replace(/\s+/g, '-')}.png`;
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
  console.log('   - Line 1: "Breaking News:" (white, above headline)');
  console.log('   - Line 2: "M#.# EARTHQUAKE NEAR" (magnitude + headline on same baseline)');
  console.log('   - Line 3: Location (red, below headline)');
  console.log('   - All text shares same anchorX (left edge)');
  console.log('   - Magnitude is ALWAYS inside the headline line');
  console.log('   - Location is ALWAYS directly under headline');
  console.log('   - No text overlaps map or rings');
  console.log('   - USGS images are visible (from base template)\n');
}

testValidationCases().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

