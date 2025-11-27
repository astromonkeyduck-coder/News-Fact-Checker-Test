#!/usr/bin/env node
/**
 * Test newsletter function locally without deploying
 * Usage: node test-newsletter-local.js
 */

// Load environment variables
require('dotenv').config();

// Mock the Netlify function event
const mockEvent = {
  httpMethod: 'POST',
  body: JSON.stringify({
    subject: 'Test Newsletter - Local',
    testEmail: process.env.TEST_EMAIL || 'test@example.com',
    includeRecentPosts: true
  }),
  headers: {},
  queryStringParameters: null
};

const mockContext = {};

// Import and run the function
async function testNewsletter() {
  console.log('🧪 Testing newsletter function locally...\n');
  
  try {
    // Import the function
    const { handler } = require('./netlify/functions/send-newsletter');
    
    // Call the handler
    const result = await handler(mockEvent, mockContext);
    
    // Parse the response
    const body = JSON.parse(result.body);
    
    console.log('📧 Response Status:', result.statusCode);
    console.log('📧 Response Body:', JSON.stringify(body, null, 2));
    
    if (result.statusCode === 200 && body.success) {
      console.log('\n✅ SUCCESS! Test email sent to:', body.testMode ? mockEvent.testEmail : 'audience');
      if (body.emailId) {
        console.log('📬 Email ID:', body.emailId);
      }
    } else {
      console.log('\n❌ FAILED:', body.error || body.message);
    }
    
    process.exit(result.statusCode === 200 ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if required env vars are set
if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not found in environment variables');
  console.error('💡 Create a .env file with: RESEND_API_KEY=your_key_here');
  console.error('💡 Or set it: export RESEND_API_KEY=your_key_here');
  process.exit(1);
}

if (!process.env.RESEND_AUDIENCE_ID) {
  console.warn('⚠️  RESEND_AUDIENCE_ID not set (needed for full audience sends, but test email will work)');
}

testNewsletter();

