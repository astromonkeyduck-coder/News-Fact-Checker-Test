/**
 * Test script for safe area + render quality validation
 * Tests the 3 required cases to verify:
 * - No text clipping
 * - Text stays in left column
 * - Right-side rings untouched
 * - Text is crisp (broadcast quality)
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testValidationCases() {
  console.log('🧪 Testing Safe Area + Render Quality\n');
  console.log('='.repeat(60));
  
  const testCases = [
    { magnitude: 6.5, location: 'PAPUA NEW GUINEA' },
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
    
    console.log(`\n📸 Test ${i + 1}/3: M${magnitude} "${location}"`);
    console.log('   Generating image...');
    
    try {
      const imageBuffer = await generateImage(magnitude, location, [], `test-safe-${i + 1}`);
      
      const filename = `safe-m${magnitude}-${location.toLowerCase().replace(/\s+/g, '-')}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, imageBuffer);
      
      const fileSize = (imageBuffer.length / 1024).toFixed(1);
      console.log(`   ✅ Saved: ${filepath} (${fileSize}KB)`);
      
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
  console.log('   - No text clipping');
  console.log('   - Text stays entirely in left column (58% of canvas)');
  console.log('   - Right-side epicenter rings are untouched');
  console.log('   - Text is crisp (broadcast quality, not web-canvas quality)');
  console.log('   - Image feels broadcast-quality\n');
}

testValidationCases().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

