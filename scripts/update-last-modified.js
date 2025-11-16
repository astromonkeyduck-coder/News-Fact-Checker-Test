#!/usr/bin/env node

/**
 * Script to automatically update the "Last Update" timestamp in index.html
 * This should be run before committing or as part of the build process
 */

const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');

// Get current date in the format: "Month Day, Year"
// Uses local timezone (system timezone) - Node.js Date methods already use local time
function getFormattedDate() {
  const now = new Date();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // getMonth(), getDate() return LOCAL time values
  const month = months[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();
  
  const formatted = `${month} ${day}, ${year}`;
  console.log(`[Timestamp] Formatted: ${formatted}`);
  
  return formatted;
}

try {
  // Read the index.html file
  let content = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Find and replace the Last Update line
  // Pattern: Last Update: [any date/time format]
  const lastUpdatePattern = /Last Update:\s*[^<]+/;
  const scheduledMaintenancePattern = /Scheduled Maintenance:\s*[^<]+/;
  const newLastUpdate = `Last Update: ${getFormattedDate()}`;
  
  if (lastUpdatePattern.test(content)) {
    content = content.replace(lastUpdatePattern, newLastUpdate);
    
    // Also update the app-version meta tag
    const versionMetaPattern = /<meta name="app-version" content="[^"]*">/;
    const newVersionMeta = `<meta name="app-version" content="${getFormattedDate()}">`;
    if (versionMetaPattern.test(content)) {
      content = content.replace(versionMetaPattern, newVersionMeta);
    } else {
      // If meta tag doesn't exist, add it after viewport meta
      const viewportMetaPattern = /(<meta name="viewport"[^>]*>)/;
      if (viewportMetaPattern.test(content)) {
        content = content.replace(viewportMetaPattern, `$1\n    ${newVersionMeta}`);
      }
    }
    
    // Write back to file
    fs.writeFileSync(indexHtmlPath, content, 'utf8');
    console.log(`✅ Updated Last Update timestamp to: ${getFormattedDate()}`);
  } else if (scheduledMaintenancePattern.test(content)) {
    // If Scheduled Maintenance is found, don't update it (it has a specific date)
    // Just update the app-version meta tag
    const versionMetaPattern = /<meta name="app-version" content="[^"]*">/;
    const newVersionMeta = `<meta name="app-version" content="${getFormattedDate()}">`;
    if (versionMetaPattern.test(content)) {
      content = content.replace(versionMetaPattern, newVersionMeta);
      fs.writeFileSync(indexHtmlPath, content, 'utf8');
      console.log(`✅ Found Scheduled Maintenance (not updating), updated app-version to: ${getFormattedDate()}`);
    } else {
      console.log('ℹ️  Found Scheduled Maintenance (not updating date)');
    }
  } else {
    console.warn('⚠️  Could not find "Last Update" or "Scheduled Maintenance" pattern in index.html');
    // Don't fail the build, just warn
  }
} catch (error) {
  console.error('❌ Error updating Last Update timestamp:', error.message);
  process.exit(1);
}

