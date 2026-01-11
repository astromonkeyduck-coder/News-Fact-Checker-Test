/**
 * Local test script for generate-earthquake-video function
 * Tests MP4 generation with TTS audio and datacenter.wav background
 * 
 * Run with: node test-video-generation-local.js
 * 
 * Requirements:
 * - ELEVENLABS_API_KEY environment variable (for TTS)
 * - datacenter.wav in project root
 * - Netlify dev running (optional, for blob storage)
 */

const path = require('path');
const fs = require('fs');

// Use node-fetch if available, otherwise use global fetch (Node 18+)
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  fetch = globalThis.fetch;
  if (!fetch) {
    console.error('❌ Error: fetch is not available. Install node-fetch: npm install node-fetch');
    process.exit(1);
  }
}

const BASE_URL = process.env.NETLIFY_DEV ? 'http://localhost:8888' : 'https://noteworthynews.co';

// Test data
const testData = {
  magnitude: 4.5,
  location: 'San Francisco, California',
  eventId: 'test-video-001',
  lat: 37.7749,
  lon: -122.4194,
};

async function testVideoGeneration() {
  console.log('🎬 Testing Earthquake Video Generation with Audio\n');
  console.log('📋 Test Parameters:');
  console.log(`   Magnitude: M${testData.magnitude}`);
  console.log(`   Location: ${testData.location}`);
  console.log(`   Event ID: ${testData.eventId}`);
  console.log(`   Coordinates: ${testData.lat}, ${testData.lon}\n`);

  // Check for required environment variables
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn('⚠️  ELEVENLABS_API_KEY not set - TTS will be skipped');
    console.warn('   Set it with: export ELEVENLABS_API_KEY=your_key\n');
  } else {
    console.log('✅ ELEVENLABS_API_KEY found\n');
  }

  // Check for datacenter.wav
  const datacenterPath = path.join(__dirname, 'datacenter.wav');
  if (fs.existsSync(datacenterPath)) {
    const stats = fs.statSync(datacenterPath);
    console.log(`✅ datacenter.wav found: ${Math.round(stats.size / 1024)}KB\n`);
  } else {
    console.warn(`⚠️  datacenter.wav not found at: ${datacenterPath}`);
    console.warn('   Background audio will be skipped\n');
  }

  try {
    console.log('🎥 Calling generate-earthquake-video function...\n');
    
    const response = await fetch(`${BASE_URL}/.netlify/functions/generate-earthquake-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        magnitude: testData.magnitude,
        location: testData.location,
        eventId: testData.eventId,
        lat: testData.lat,
        lon: testData.lon,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Function error (${response.status}):`, errorText);
      process.exit(1);
    }

    const result = await response.json();
    
    console.log('✅ Video generation response:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Format: ${result.format || 'unknown'}`);
    console.log(`   Duration: ${result.duration || 'unknown'}`);
    console.log(`   Has Audio: ${result.hasAudio || false}`);
    console.log(`   Frames Generated: ${result.framesGenerated || 0}`);
    console.log(`   Dimensions: ${result.dimensions || 'unknown'}`);
    
    if (result.mp4_url) {
      console.log(`\n🎬 MP4 URL (with audio): ${result.mp4_url}`);
    }
    if (result.gif_url) {
      console.log(`🎞️  GIF URL: ${result.gif_url}`);
    }
    if (result.url) {
      console.log(`🔗 Primary URL: ${result.url}`);
    }
    
    if (result.note) {
      console.log(`\n📝 Note: ${result.note}`);
    }

    // If we got a URL, try to download and save locally
    if (result.url || result.mp4_url || result.gif_url) {
      const videoUrl = result.mp4_url || result.url || result.gif_url;
      const format = result.mp4_url ? 'mp4' : 'gif';
      
      console.log(`\n📥 Downloading ${format.toUpperCase()}...`);
      try {
        const videoResponse = await fetch(videoUrl);
        if (videoResponse.ok) {
          const videoBuffer = await videoResponse.arrayBuffer();
          const outputPath = path.join(__dirname, `test-output-video.${format}`);
          fs.writeFileSync(outputPath, Buffer.from(videoBuffer));
          
          console.log(`✅ Video saved to: ${outputPath}`);
          console.log(`   Size: ${Math.round(videoBuffer.byteLength / 1024)}KB`);
          
          // Try to open automatically
          const { exec } = require('child_process');
          const platform = process.platform;
          let openCommand;
          
          if (platform === 'darwin') {
            openCommand = 'open';
          } else if (platform === 'win32') {
            openCommand = 'start';
          } else {
            openCommand = 'xdg-open';
          }
          
          exec(`${openCommand} "${outputPath}"`, (error) => {
            if (error) {
              console.log(`⚠️  Could not auto-open video: ${error.message}`);
              console.log(`   Please open manually: ${outputPath}`);
            } else {
              console.log(`🎬 Video opened automatically!`);
            }
          });
        } else {
          console.warn(`⚠️  Could not download video: ${videoResponse.status}`);
        }
      } catch (downloadError) {
        console.warn(`⚠️  Download error: ${downloadError.message}`);
        console.log(`   Video URL: ${videoUrl}`);
      }
    }

    console.log('\n✅ Test completed successfully!');
    
    if (result.format === 'gif') {
      console.log('\n💡 Note: MP4 generation may have failed or timed out.');
      console.log('   Check function logs for details.');
      console.log('   The GIF was generated successfully as a fallback.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testVideoGeneration();
