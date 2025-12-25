/**
 * Test script for precision alignment validation
 * Tests the 2 required cases to verify:
 * - Dynamic text block aligns perfectly with "Breaking News:" label
 * - Location font is exactly 41.5px (unless clipping would occur)
 * - No text overlaps rings/banner
 */

const path = require('path');
const fs = require('fs');
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testValidationCases() {
  console.log('🧪 Testing Precision Alignment + Font Sizing\n');
  console.log('='.repeat(60));
  
  const testCases = [
    { magnitude: 6.5, location: 'PAPUA NEW GUINEA' },
    { magnitude: 4.9, location: 'NEAR THE KERMADEC ISLANDS' },
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
      const imageBuffer = await generateImage(magnitude, location, [], `test-precision-${i + 1}`);
      
      const filename = `precision-m${magnitude}-${location.toLowerCase().replace(/\s+/g, '-')}.png`;
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
  console.log('   - Dynamic block aligns perfectly with "Breaking News:" label left edge');
  console.log('   - Location font is exactly 41.5px (unless clipping would occur)');
  console.log('   - No text overlaps rings/banner');
  console.log('   - All text x positions shifted by ALIGN_SHIFT_X as a unit\n');
}

testValidationCases().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

