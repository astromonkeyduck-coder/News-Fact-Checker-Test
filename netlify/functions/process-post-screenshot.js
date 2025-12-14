/**
 * Process screenshot of a post to extract text, metrics, and metadata
 * Uses OpenAI Vision API to analyze the screenshot
 */

const { getStore } = require("@netlify/blobs");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "OpenAI API key not configured" }),
      };
    }

    // Parse image data from request body
    let imageBase64 = null;
    let contentType = 'image/png';
    
    // Handle base64 encoded body
    let bodyStr = event.body || "{}";
    if (event.isBase64Encoded) {
      bodyStr = Buffer.from(bodyStr, 'base64').toString('utf-8');
    }
    
    // Try parsing as JSON
    try {
      const body = JSON.parse(bodyStr);
      if (body.image) {
        // Extract base64 and content type from data URL
        const dataUrlMatch = body.image.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
          contentType = dataUrlMatch[1];
          imageBase64 = dataUrlMatch[2];
        } else {
          // Assume it's already base64
          imageBase64 = body.image;
        }
      } else if (body.base64) {
        imageBase64 = body.base64;
        contentType = body.contentType || 'image/png';
      }
    } catch (e) {
      // Not JSON, might be raw base64
      imageBase64 = bodyStr;
    }

    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No image data provided" }),
      };
    }

    // Call OpenAI Vision API
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this screenshot of a social media post (likely from X/Twitter). Extract the following information and return it as JSON:

1. **text**: The main post text/story content
2. **views**: Number of views (if visible)
3. **likes**: Number of likes (if visible)
4. **reposts**: Number of reposts/retweets (if visible)
5. **replies**: Number of replies (if visible)
6. **datePosted**: The date/time the post was made (if visible, in ISO format)
7. **link**: The post URL if visible in the screenshot
8. **images**: Array of image URLs if any images are visible in the post

Return ONLY valid JSON in this format:
{
  "text": "extracted post text",
  "views": 1234,
  "likes": 56,
  "reposts": 12,
  "replies": 8,
  "datePosted": "2025-12-14T12:00:00Z",
  "link": "https://x.com/username/status/123456",
  "images": []
}

If a value is not visible or cannot be determined, use null. Be precise with numbers - extract exact values when visible.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${contentType || 'image/png'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('[process-post-screenshot] OpenAI API error:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Failed to analyze screenshot",
          details: errorText.substring(0, 200)
        }),
      };
    }

    const visionData = await visionResponse.json();
    const content = visionData.choices?.[0]?.message?.content;
    
    if (!content) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "No response from vision API" }),
      };
    }

    // Parse the JSON response
    let extractedData;
    try {
      // Try to extract JSON from the response (might have markdown code blocks)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        extractedData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[process-post-screenshot] JSON parse error:', parseError);
      console.error('[process-post-screenshot] Content:', content);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: "Failed to parse extracted data",
          rawContent: content.substring(0, 500)
        }),
      };
    }

    // Clean and validate extracted data
    const result = {
      text: extractedData.text || null,
      views: extractedData.views ? parseInt(extractedData.views) : null,
      likes: extractedData.likes ? parseInt(extractedData.likes) : null,
      reposts: extractedData.reposts ? parseInt(extractedData.reposts) : null,
      replies: extractedData.replies ? parseInt(extractedData.replies) : null,
      datePosted: extractedData.datePosted || null,
      link: extractedData.link || null,
      images: Array.isArray(extractedData.images) ? extractedData.images : [],
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[process-post-screenshot] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || "Internal server error",
      }),
    };
  }
};
