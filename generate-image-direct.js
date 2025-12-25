/**
 * Generate earthquake image directly (bypasses Netlify function)
 * This allows testing without Netlify dev running
 */

const path = require('path');
const fs = require('fs');

// Import the generateImage function directly
const generateImagePath = path.join(__dirname, 'netlify/functions/generate-earthquake-image.js');
const generateImageModule = require(generateImagePath);

// Check if generateImage is exported
let generateImage;
if (typeof generateImageModule.generateImage === 'function') {
  generateImage = generateImageModule.generateImage;
} else {
  // Try to extract it from the module
  console.log('⚠️  generateImage not exported, trying to access internal function...');
  // We'll need to call it differently
  process.exit(1);
}

async function main() {
  console.log('🎨 Generating earthquake image directly...\n');
  
  const magnitude = 6.5;
  const location = 'PAPUA NEW GUINEA';
  const eventId = 'test-direct-001';
  const usgsImages = []; // No USGS images for this test
  
  try {
    console.log(`   Magnitude: M${magnitude}`);
    console.log(`   Location: ${location}`);
    console.log(`   Generating...\n`);
    
    const imageBuffer = await generateImage(magnitude, location, usgsImages, eventId);
    
    // Save to file
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `earthquake-direct-${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    
    console.log(`✅ Image generated successfully!`);
    console.log(`📁 Saved to: ${filepath}`);
    console.log(`\n🖼️  Opening image...`);
    
    // Try to open the image
    const { exec } = require('child_process');
    exec(`open "${filepath}"`, (error) => {
      if (error) {
        console.log(`\n💡 Open manually: ${filepath}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

