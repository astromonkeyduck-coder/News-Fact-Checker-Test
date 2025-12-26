/**
 * Get writing style from Netlify Blobs storage
 * This avoids the 4KB AWS Lambda environment variable limit
 * Falls back to environment variable if Blobs is not available
 * 
 * 🔒 SECURITY: Netlify Blobs is private and secure:
 * - Encrypted at rest and in transit
 * - Only accessible by functions with NETLIFY_BLOB_READ_WRITE_TOKEN
 * - Not exposed to the public internet
 * - Your writing style remains secret and protected
 */

const { getStore } = require("@netlify/blobs");

/**
 * Get writing style content
 * @param {object} event - Netlify function event (for headers)
 * @returns {Promise<string>} Writing style content or empty string
 */
async function getWritingStyle(event = null) {
  // First, try to get from Blobs storage
  try {
    const siteID = process.env.NETLIFY_SITE_ID || (event?.headers?.['x-nf-site-id']);
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN || (event?.headers?.['x-nf-token']);
    
    let store;
    if (siteID && token) {
      store = getStore({
        name: "config",
        siteID: siteID,
        token: token,
      });
    } else {
      store = getStore({ name: "config" });
    }
    
    const writingStyle = await store.get("writing-style", { type: "text" });
    if (writingStyle) {
      console.log('[get-writing-style] ✅ Retrieved from Blobs storage');
      return writingStyle;
    }
  } catch (blobError) {
    console.warn('[get-writing-style] ⚠️ Could not retrieve from Blobs:', blobError.message);
  }
  
  // Fallback to environment variable (for backwards compatibility and local dev)
  const envWritingStyle = process.env.WRITTING_STYLE || '';
  if (envWritingStyle) {
    console.log('[get-writing-style] ⚠️ Using environment variable (consider moving to Blobs to avoid 4KB limit)');
    return envWritingStyle;
  }
  
  return '';
}

module.exports = {
  getWritingStyle,
};

