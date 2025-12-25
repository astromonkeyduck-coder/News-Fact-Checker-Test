/**
 * Direct test of image generation - bypasses HTTP
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Copy the generateImage function logic
async function testDirect() {
  console.log('🧪 Testing image generation directly...\n');
  
  // Try to load template
  const possiblePaths = [
    path.join(process.cwd(), '1stUSGSTemp.png'),
    path.join(process.cwd(), 'netlify/functions/1stUSGSTemp.png'),
    path.resolve('./1stUSGSTemp.png'),
  ];
  
  let templateBuffer = null;
  
  for (const templatePath of possiblePaths) {
    console.log(`Checking: ${templatePath}`);
    if (fs.existsSync(templatePath)) {
      templateBuffer = fs.readFileSync(templatePath);
      console.log(`✅ Found template: ${templatePath} (${templateBuffer.length} bytes)\n`);
      break;
    }
  }
  
  if (!templateBuffer) {
    // Try HTTP
    console.log('Trying HTTP...');
    try {
      const response = await fetch('http://localhost:8888/1stUSGSTemp.png');
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        templateBuffer = Buffer.from(arrayBuffer);
        console.log(`✅ Loaded via HTTP (${templateBuffer.length} bytes)\n`);
      }
    } catch (e) {
      console.error('HTTP failed:', e.message);
    }
  }
  
  if (!templateBuffer) {
    throw new Error('Template not found!');
  }
  
  // Test Sharp processing
  console.log('Testing Sharp processing...');
  const template = sharp(templateBuffer);
  const metadata = await template.metadata();
  console.log(`✅ Template loaded: ${metadata.width}x${metadata.height}\n`);
  
  // Create test SVG
  const svg = Buffer.from(`
    <svg width="${metadata.width}" height="${metadata.height}">
      <text x="50" y="100" font-family="Arial" font-size="41.5" font-weight="bold" fill="#FF0000">M6.5</text>
      <text x="50" y="150" font-family="Arial" font-size="41.5" fill="#FF0000">TEST LOCATION</text>
    </svg>
  `);
  
  const result = await template
    .composite([{ input: svg, blend: 'over' }])
    .png()
    .toBuffer();
  
  // Save test output
  const outputPath = path.join(process.cwd(), 'test-output-direct.png');
  fs.writeFileSync(outputPath, result);
  console.log(`✅ Generated test image: ${outputPath} (${result.length} bytes)\n`);
  console.log('✅ DIRECT TEST PASSED - Image generation works!\n');
}

testDirect().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

