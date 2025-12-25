/**
 * Visual Test for Earthquake Image Generation
 * 
 * This script helps you test what the earthquake images will look like
 * without needing to run the full pipeline.
 * 
 * Usage:
 *   1. Make sure you're running Netlify dev: npm run dev
 *   2. Run this script: node test-earthquake-visual.js
 *   3. Check the test-output/ directory for generated images
 */

const fs = require('fs');
const path = require('path');

// Use node-fetch if available, otherwise use global fetch (Node 18+)
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  // Node 18+ has fetch built-in
  fetch = globalThis.fetch;
  if (!fetch) {
    console.error('❌ Error: fetch is not available. Install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

async function testEarthquakeImage() {
  console.log('🧪 Testing Earthquake Image Generation\n');
  console.log('This will call the generate-earthquake-image function locally...\n');
  
  const baseUrl = 'http://localhost:8888';
  const endpoint = `${baseUrl}/.netlify/functions/generate-earthquake-image`;
  
  // Test cases
  const testCases = [
    {
      name: 'Large Earthquake - California',
      magnitude: 7.5,
      location: 'SOUTHERN CALIFORNIA',
      eventId: 'test-california-001',
    },
    {
      name: 'Medium Earthquake - Taiwan',
      magnitude: 6.2,
      location: 'TAIWAN',
      eventId: 'test-taiwan-001',
    },
    {
      name: 'Very Large Earthquake - Chile',
      magnitude: 8.1,
      location: 'NORTHERN CHILE',
      eventId: 'test-chile-001',
    },
    {
      name: 'Long Location Name Test',
      magnitude: 5.8,
      location: 'VERY LONG LOCATION NAME THAT NEEDS TO FIT PROPERLY',
      eventId: 'test-long-name-001',
    },
  ];
  
  // Create output directory
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}\n`);
  }
  
  console.log(`📡 Testing against: ${endpoint}\n`);
  console.log('⚠️  Make sure Netlify dev is running (npm run dev)\n');
  
  for (const testCase of testCases) {
    try {
      console.log(`📸 Testing: ${testCase.name}`);
      console.log(`   Magnitude: M${testCase.magnitude}`);
      console.log(`   Location: ${testCase.location}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnitude: testCase.magnitude,
          location: testCase.location,
          eventId: testCase.eventId,
          usgsImages: [], // No USGS images for testing
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Download the generated image
      const imageUrl = result.url;
      const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${baseUrl}${imageUrl}`;
      
      console.log(`   ✅ Generated: ${fullImageUrl}`);
      
      // Fetch the image
      const imageResponse = await fetch(fullImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      // Save to file
      const filename = `earthquake-m${testCase.magnitude}-${testCase.eventId}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, imageBuffer);
      
      console.log(`   💾 Saved to: ${filepath}\n`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('\n✨ Test complete!');
  console.log(`\n📂 Check the 'test-output' directory to see all generated images.`);
  console.log('   Open them in an image viewer to see how they\'ll look on the website.\n');
  console.log('💡 Tips:');
  console.log('   - Check text positioning (magnitude and location)');
  console.log('   - Verify text fits and doesn\'t overflow');
  console.log('   - Adjust constants in generate-earthquake-image.js if needed\n');
}

// Run the test
testEarthquakeImage().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

