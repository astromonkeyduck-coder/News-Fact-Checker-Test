#!/usr/bin/env node
/**
 * Test instant fallback images (satellite/map) when USGS images aren't available
 * Run: node test-fallback-images.js
 */

const fs = require('fs');
const path = require('path');

// Import the image generation function
const { generateImage } = require('./netlify/functions/generate-earthquake-image');

async function testFallbackImages() {
  console.log('🧪 Testing instant fallback images (satellite/map)...\n');
  
  // Test case: Earthquake with coordinates but NO USGS images
  // This simulates the real-world scenario where USGS images aren't available yet
  const testCase = {
    magnitude: 6.5,
    location: 'MEXICO',
    eventId: 'test-fallback-001',
    usgsImages: [], // No USGS images - should trigger fallback
    coordinates: [-98.2433, 19.4326], // Mexico City coordinates [lon, lat]
  // Format: [longitude, latitude] - same as GeoJSON
  };
  
  console.log(`📸 Generating image for M${testCase.magnitude} near ${testCase.location}`);
  console.log(`   Coordinates: ${testCase.coordinates[1]}, ${testCase.coordinates[0]}`);
  console.log(`   USGS Images: ${testCase.usgsImages.length} (will use fallback)\n`);
  
  // Create output directory
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  try {
    // Generate image
    const imageBuffer = await generateImage(
      testCase.magnitude,
      testCase.location,
      testCase.usgsImages,
      testCase.eventId,
      testCase.coordinates // Pass coordinates for fallback images
    );
    
    // Save to file
    const filename = `earthquake-fallback-m${testCase.magnitude}-${testCase.eventId}.png`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    
    console.log(`✅ Saved: ${filepath}`);
    console.log(`   Size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    console.log(`\n✨ Test complete! Open the image to verify:`);
    console.log(`   - Template background is present`);
    console.log(`   - Text overlay (magnitude, headline, location) is visible`);
    console.log(`   - Satellite/map image(s) are composited in lower section`);
    console.log(`   - Images show the earthquake location on a map`);
    
  } catch (error) {
    console.error(`❌ Error generating image:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testFallbackImages().catch(console.error);
}

module.exports = { testFallbackImages };




