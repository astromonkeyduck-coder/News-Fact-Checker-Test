// Test function to debug Resend setup
// Call this endpoint to test if Resend is configured correctly

// Load environment variables from .env file for local development
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const { Resend } = require('resend');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Check if API key exists (don't log key, even partially)
    const apiKey = process.env.RESEND_API_KEY;
    const hasApiKey = !!apiKey;

    // Only initialize Resend if we have an API key
    let resend = null;
    if (hasApiKey) {
      resend = new Resend(apiKey);
    }

    // Test email configuration
    const testResults = {
      timestamp: new Date().toISOString(),
      apiKeyExists: hasApiKey,
      tests: [],
    };

    // Test 1: API Key exists
    if (!hasApiKey) {
      testResults.tests.push({
        name: 'API Key Check',
        status: 'FAILED',
        message: 'RESEND_API_KEY environment variable is not set in Netlify',
        fix: 'Go to Netlify Dashboard → Site Settings → Environment Variables → Add RESEND_API_KEY',
      });
    } else {
      testResults.tests.push({
        name: 'API Key Check',
        status: 'PASSED',
        message: 'API key is configured',
      });
    }

    // Test 2: Try sending a test email (if API key exists)
    if (hasApiKey && resend) {
      try {
        const testEmailResult = await resend.emails.send({
          from: 'onboarding@resend.dev', // Use Resend's test domain
          to: 'richard@noteworthynews.co',
          subject: 'Resend Test Email',
          clickTracking: false, // Disable click tracking for better deliverability
          html: '<p>This is a test email from your Netlify function. If you receive this, Resend is working!</p>',
        });

        if (testEmailResult.error) {
          testResults.tests.push({
            name: 'Send Test Email',
            status: 'FAILED',
            message: testEmailResult.error.message || 'Failed to send email',
            error: testEmailResult.error,
            fix: 'Check your Resend API key and account status at resend.com',
          });
        } else {
          testResults.tests.push({
            name: 'Send Test Email',
            status: 'PASSED',
            message: 'Test email sent successfully!',
            emailId: testEmailResult.data?.id,
          });
        }
      } catch (emailError) {
        testResults.tests.push({
          name: 'Send Test Email',
          status: 'FAILED',
          message: emailError.message,
          error: emailError.toString(),
        });
      }
    }

    // Determine overall status
    const allPassed = testResults.tests.every(test => test.status === 'PASSED');
    testResults.overallStatus = allPassed ? 'PASSED' : 'FAILED';

    return {
      statusCode: allPassed ? 200 : 500,
      headers,
      body: JSON.stringify(testResults, null, 2),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Test function error',
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};

