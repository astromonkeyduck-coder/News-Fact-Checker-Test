#!/usr/bin/env node

/**
 * Script to automatically update the "Last Update" timestamp in index.html
 * This should be run before committing or as part of the build process
 */

const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');

// Get current date/time in the format: "Month Day, Year at H:MM AM/PM"
function getFormattedDate() {
  const now = new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const month = months[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();
  
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  
  return `${month} ${day}, ${year} at ${hours}:${minutesStr} ${ampm}`;
}

try {
  // Read the index.html file
  let content = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Find and replace the Last Update line
  // Pattern: Last Update: [any date/time format]
  const lastUpdatePattern = /Last Update:\s*[^<]+/;
  const newLastUpdate = `Last Update: ${getFormattedDate()}`;
  
  if (lastUpdatePattern.test(content)) {
    content = content.replace(lastUpdatePattern, newLastUpdate);
    
    // Write back to file
    fs.writeFileSync(indexHtmlPath, content, 'utf8');
    console.log(`✅ Updated Last Update timestamp to: ${getFormattedDate()}`);
  } else {
    console.warn('⚠️  Could not find "Last Update" pattern in index.html');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error updating Last Update timestamp:', error.message);
  process.exit(1);
}

