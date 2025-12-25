/**
 * STEP 7: Test endpoint for image generator
 * GET /.netlify/functions/test-generate
 * 
 * Hardcodes "M7.2 EARTHQUAKE NEAR TAIWAN" and returns generated PNG
 * Uses the SAME code path as production
 */

const { handler: generateHandler } = require('./generate-earthquake-image');

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }
  
  try {
    // STEP 7: Hardcoded test data
    const testData = {
      magnitude: 7.2,
      location: "TAIWAN",
      eventId: "test-001",
      usgsImages: [] // No USGS images for test
    };
    
    console.log('[test-generate] Generating test image with hardcoded data:', testData);
    
    // Create a mock event object that matches generate-earthquake-image handler format
    const mockEvent = {
      httpMethod: "POST",
      body: JSON.stringify({
        magnitude: testData.magnitude,
        location: testData.location,
        eventId: testData.eventId,
        usgsImages: testData.usgsImages,
      }),
    };
    
    // Call the actual generator
    const result = await generateHandler(mockEvent, context);
    
    if (result.statusCode === 200) {
      const imageData = JSON.parse(result.body);
      
      // Return redirect to the image URL
      return {
        statusCode: 302,
        headers: {
          ...headers,
          "Location": imageData.url,
        },
        body: "",
      };
    } else {
      // Return error as JSON
      return {
        statusCode: result.statusCode,
        headers: { ...headers, "Content-Type": "application/json" },
        body: result.body,
      };
    }
  } catch (error) {
    console.error('[test-generate] Error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error?.message || "Internal server error",
        stack: error?.stack,
      }),
    };
  }
};

