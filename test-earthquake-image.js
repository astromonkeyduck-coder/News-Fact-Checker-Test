/**
 * Test script to preview earthquake image generation
 * Run: node test-earthquake-image.js
 */

const fs = require('fs');
const path = require('path');

// Import the image generation function
const { generateImage, storeImage } = require('./netlify/functions/generate-earthquake-image');

async function testImageGeneration() {
  console.log('🧪 Testing earthquake image generation...\n');
  
  // Test cases with different magnitudes and locations
  const testCases = [
    {
      magnitude: 7.5,
      location: 'SOUTHERN CALIFORNIA',
      eventId: 'test-001',
      usgsImages: [],
    },
    {
      magnitude: 6.2,
      location: 'TAIWAN',
      eventId: 'test-002',
      usgsImages: [],
    },
    {
      magnitude: 8.1,
      location: 'NORTHERN CHILE',
      eventId: 'test-003',
      usgsImages: [],
    },
    {
      magnitude: 5.8,
      location: 'VERY LONG LOCATION NAME THAT NEEDS TO FIT',
      eventId: 'test-004',
      usgsImages: [],
    },
  ];
  
  // Create output directory
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  for (const testCase of testCases) {
    try {
      console.log(`📸 Generating image for M${testCase.magnitude} near ${testCase.location}...`);
      
      // Generate image
      const imageBuffer = await generateImage(
        testCase.magnitude,
        testCase.location,
        testCase.usgsImages,
        testCase.eventId
      );
      
      // Save to file
      const filename = `earthquake-m${testCase.magnitude}-${testCase.eventId}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, imageBuffer);
      
      console.log(`✅ Saved: ${filepath}\n`);
    } catch (error) {
      console.error(`❌ Error generating image for test case:`, error.message);
      console.error(error.stack);
      console.log('');
    }
  }
  
  console.log(`\n✨ Test complete! Check the 'test-output' directory for generated images.`);
  console.log(`   You can open these images to see how they'll look on the website.`);
}

// Run if called directly
if (require.main === module) {
  testImageGeneration().catch(console.error);
}

module.exports = { testImageGeneration };

