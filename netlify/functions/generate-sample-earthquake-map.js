/**
 * Generate and store a sample earthquake map image for the newsletter
 * Uses a FIXED blob key so the URL is stable: get-uploaded-image?key=newsletter-sample-map.png
 *
 * GET /.netlify/functions/generate-sample-earthquake-map
 * Call once to generate; newsletter uses the stable URL.
 */

const SAMPLE_KEY = 'newsletter-sample-map.png';
const STORE_NAME = 'post-media';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { generateImage } = require('./generate-earthquake-image');
    const { getStore } = require('@netlify/blobs');

    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    const baseUrl = process.env.URL || 'https://noteworthynews.co';

    if (!siteID || !token) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Missing NETLIFY_SITE_ID or NETLIFY_BLOB_READ_WRITE_TOKEN',
        }),
      };
    }

    console.log('[generate-sample-earthquake-map] Generating sample image...');

    // Sample: M6.2 east of Tokyo - real place, coordinates for Kanto region
    const magnitude = 6.2;
    const location = 'Tokyo, Japan';
    const eventId = 'newsletter-sample';
    const coordinates = [139.7, 35.6]; // [lon, lat] east of Tokyo

    const imageBuffer = await generateImage(
      magnitude,
      location,
      eventId,
      'standard',
      coordinates,
      null // no detailUrl - will use template/fallback
    );

    const store = getStore({ name: STORE_NAME, siteID, token });
    await store.set(SAMPLE_KEY, imageBuffer, { contentType: 'image/png' });

    const imageUrl = `${baseUrl}/.netlify/functions/get-uploaded-image?key=${encodeURIComponent(SAMPLE_KEY)}`;

    console.log('[generate-sample-earthquake-map] Image stored:', SAMPLE_KEY);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: imageUrl,
        key: SAMPLE_KEY,
      }),
    };
  } catch (error) {
    console.error('[generate-sample-earthquake-map] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error?.message || 'Failed to generate sample map',
      }),
    };
  }
};
