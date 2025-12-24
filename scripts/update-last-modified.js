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
  return getFormattedDateForDate(new Date());
}

// Get formatted date for a specific Date object
function getFormattedDateForDate(date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // getMonth(), getDate() return LOCAL time values
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  const formatted = `${month} ${day}, ${year}`;
  
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
    // If Scheduled Maintenance is found, update it to one week from today
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    const maintenanceDate = getFormattedDateForDate(oneWeekFromNow);
    const newScheduledMaintenance = `Scheduled Maintenance: ${maintenanceDate}`;
    content = content.replace(scheduledMaintenancePattern, newScheduledMaintenance);
    
    // Also update the title attribute
    const titlePattern = /title="Scheduled Maintenance: [^"]+"/;
    const newTitle = `title="Scheduled Maintenance: ${maintenanceDate}"`;
    if (titlePattern.test(content)) {
      content = content.replace(titlePattern, newTitle);
    }
    
    // Also update the maintenance date in the overlay document (after the countdown)
    const countdownSectionPattern = /(<div id="countdown"[^>]*>[^<]+<\/div>\s*<p style="font-size: 0\.8rem; margin-top: 6px; color: #555;">)[^<]+(<\/p>)/;
    if (countdownSectionPattern.test(content)) {
      content = content.replace(countdownSectionPattern, `$1${maintenanceDate}$2`);
    }
    
    // Update the JavaScript date calculation to use current date as last push date
    const lastPushDatePattern = /const lastPushDate = new Date\('[^']+'\);/;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hours = '19';
    const minutes = '45';
    const newLastPushDate = `const lastPushDate = new Date('${year}-${month}-${day}T${hours}:${minutes}:00-05:00'); // ${getFormattedDateForDate(today)} 7:45 PM EST`;
    if (lastPushDatePattern.test(content)) {
      content = content.replace(lastPushDatePattern, newLastPushDate);
    }
    
    // Also update the app-version meta tag
    const versionMetaPattern = /<meta name="app-version" content="[^"]*">/;
    const newVersionMeta = `<meta name="app-version" content="${getFormattedDate()}">`;
    if (versionMetaPattern.test(content)) {
      content = content.replace(versionMetaPattern, newVersionMeta);
    }
    
    fs.writeFileSync(indexHtmlPath, content, 'utf8');
    console.log(`✅ Updated Scheduled Maintenance to: ${maintenanceDate} (one week from today)`);
    console.log(`✅ Updated last push date reference to: ${getFormattedDateForDate(today)}`);
  } else {
    console.warn('⚠️  Could not find "Last Update" or "Scheduled Maintenance" pattern in index.html');
    // Don't fail the build, just warn
  }
} catch (error) {
  console.error('❌ Error updating Last Update timestamp:', error.message);
  process.exit(1);
}

