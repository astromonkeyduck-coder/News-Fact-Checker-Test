#!/usr/bin/env node
/**
 * Send newsletter to full audience
 * Usage: node send-newsletter-audience.js
 */

// Load environment variables
require('dotenv').config();

// Mock the Netlify function event - NO testEmail, so it sends to audience
const mockEvent = {
  httpMethod: 'POST',
  body: JSON.stringify({
    subject: 'Noteworthy News: Washington D.C. National Guard Shooting Coverage',
    includeRecentPosts: true
    // NO testEmail - this will send to the full audience
  }),
  headers: {},
  queryStringParameters: null
};

const mockContext = {};

// Import and run the function
async function sendToAudience() {
  console.log('📧 Sending newsletter to full audience...\n');
  console.log('⚠️  WARNING: This will send to ALL subscribers in your audience!\n');
  
  // Confirm before sending
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Type "SEND" to confirm sending to audience: ', async (answer) => {
      rl.close();
      
      if (answer !== 'SEND') {
        console.log('❌ Cancelled. No emails sent.');
        process.exit(0);
      }
      
      try {
        // Import the function
        const { handler } = require('./netlify/functions/send-newsletter');
        
        // Call the handler
        const result = await handler(mockEvent, mockContext);
        
        // Parse the response
        const body = JSON.parse(result.body);
        
        console.log('\n📧 Response Status:', result.statusCode);
        console.log('📧 Response Body:', JSON.stringify(body, null, 2));
        
        if (result.statusCode === 200 && body.success) {
          console.log('\n✅ SUCCESS! Newsletter sent to audience');
          if (body.emailsSent) {
            console.log('📬 Emails sent:', body.emailsSent);
          }
          if (body.contactsCount) {
            console.log('👥 Total contacts:', body.contactsCount);
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
    });
  });
}

// Check if required env vars are set
if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not found in environment variables');
  console.error('💡 Create a .env file with: RESEND_API_KEY=your_key_here');
  process.exit(1);
}

if (!process.env.RESEND_AUDIENCE_ID) {
  console.error('❌ RESEND_AUDIENCE_ID not found in environment variables');
  console.error('💡 This is required for sending to audience');
  console.error('💡 Set it in .env: RESEND_AUDIENCE_ID=your_audience_id');
  process.exit(1);
}

sendToAudience();

