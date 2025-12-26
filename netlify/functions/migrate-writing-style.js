/**
 * Migration script to move WRITTING_STYLE from environment variable to Netlify Blobs
 * This avoids the 4KB AWS Lambda environment variable limit
 * 
 * Run this once to migrate your writing style to Blobs storage:
 * node netlify/functions/migrate-writing-style.js
 */

const { getStore } = require("@netlify/blobs");

async function migrateWritingStyle() {
  const writingStyle = process.env.WRITTING_STYLE;
  
  if (!writingStyle) {
    console.error('❌ WRITTING_STYLE environment variable is not set');
    console.log('Please set WRITTING_STYLE in your environment before running this migration.');
    process.exit(1);
  }
  
  const sizeInKB = (Buffer.byteLength(writingStyle, 'utf8') / 1024).toFixed(2);
  console.log(`📊 Writing style size: ${sizeInKB} KB`);
  
  if (parseFloat(sizeInKB) > 3.5) {
    console.warn(`⚠️  Writing style is ${sizeInKB} KB, which may contribute to the 4KB env var limit`);
  }
  
  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    
    if (!siteID || !token) {
      console.error('❌ NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN must be set');
      console.log('These are required to access Netlify Blobs storage.');
      process.exit(1);
    }
    
    const store = getStore({
      name: "config",
      siteID: siteID,
      token: token,
    });
    
    // Store writing style in Blobs
    await store.set("writing-style", writingStyle);
    
    console.log('✅ Writing style successfully migrated to Netlify Blobs!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Verify the migration worked by checking your functions');
    console.log('2. You can now remove WRITTING_STYLE from your environment variables');
    console.log('   (or keep it as a fallback for local development)');
    console.log('');
    console.log('💡 To update the writing style in the future, run this script again with the new content.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateWritingStyle();
}

module.exports = { migrateWritingStyle };

