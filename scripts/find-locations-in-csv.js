#!/usr/bin/env node

/**
 * Script to find posts in CSV that mention specific locations
 * and show which posts contain which locations
 */

const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = '/Users/richarda/Downloads/account_analytics_content_2025-03-02_2025-11-26.csv';

if (!fs.existsSync(csvPath)) {
  console.error('CSV file not found:', csvPath);
  process.exit(1);
}

// List of locations to search for (from user's list)
const locationsToFind = [
  'ALBUQUERQUE', 'Albuquerque', 'Al Hudaydah', 'Yemen', 'Alene', 'Idaho',
  'Almería', 'Spain', 'Amman', 'Jordan', 'Anaconda', 'Montana',
  'Anchorage', 'Alaska', 'Andersen County', 'South Carolina', 'Annapolis', 'Maryland',
  'Athens', 'Georgia', 'Athens', 'Ohio', 'Atlanta', 'Georgia',
  'Auburn', 'Alabama', 'Austin', 'Texas', 'Ballymena', 'Northern',
  'Baltimore', 'Maryland', 'Balıkesir', 'Turkey', 'Bangkok', 'Thailand',
  'Baton Rouge', 'Louisiana', 'Bavaria', 'Germany', 'Belgorod', 'Russia',
  'Bethesda', 'Maryland', 'Black River', 'St. Elizabeth', 'Bladensburg', 'Maryland',
  'Bogotá', 'Colombia', 'Bosasso', 'Puntland', 'Boulder', 'Colorado',
  'Box Elder County', 'Utah', 'Brevard County', 'Florida', 'Brisbane', 'Australia',
  'Broadview', 'IL', 'Brooklyn Park', 'Minnesota', 'Bucksnort', 'Tennessee',
  'Buenos Aires', 'Argentina', 'Cadereyta Jiménez', 'Mexico', 'Cambridgeshire', 'England',
  'Carbondale', 'Kansas', 'Carlow', 'Ireland', 'Catalonia', 'Spain',
  'Chapel Hill', 'North Carolina', 'Charlottesville', 'Virginia', 'Chattanooga', 'Tennessee',
  'Chicago', 'Illinois', 'Chino Hills', 'Southern', 'Chuluota', 'Florida',
  'Cincinnati', 'Ohio', 'Clayton', 'Missouri', 'Clearwater', 'FL',
  'Clearwater', 'Florida', 'Cleveland', 'Ohio', 'Concord', 'North Carolina',
  'Copake', 'New York', 'Cornella', 'Spain', 'Cypress', 'Texas',
  'Dallas', 'TX', 'Dallas', 'Texas', 'Damascus', 'Syria',
  'Danville', 'Virginia', 'Davao', 'Philippines', 'Daytona Beach', 'Florida',
  'Denver', 'Colorado', 'Des Moines', 'Iowa', 'Devenish', 'Fermanagh',
  'Dodge City', 'Kansas', 'Doha', 'Qatar', 'Dublin', 'Ireland',
  'East Palestine', 'Ohio', 'Edinburgh', 'Scotland', 'El Paso', 'Texas',
  'El Segundo', 'California', 'Enterprise', 'Alabama', 'Erie', 'Pennsylvania',
  'Escondido', 'California', 'Falmouth', 'Massachusetts', 'Fayetteville', 'North Carolina',
  'Florence', 'Italy', 'Fort Lauderdale', 'Florida', 'Fort Myers', 'Florida',
  'Fort Pierce', 'Florida', 'Fort Wayne', 'Indiana', 'Fort Worth', 'Texas',
  'Fredericton', 'Canada', 'Freiburg', 'Breisgau', 'Fresno', 'California',
  'Gainesville', 'Florida', 'Galveston', 'Texas', 'Gaza', 'Palestine',
  'Geelong', 'Victoria', 'Genoa', 'Italy', 'Glenwood', 'Iowa',
  'Golden', 'Colorado', 'Grand Blanc', 'Michigan', 'Grand Prairie', 'Texas',
  'Grand Rapids', 'Michigan', 'Green Bay', 'Wisconsin', 'Greensboro', 'North Carolina',
  'Greenville', 'Texas', 'Guatemala City', 'Guatemala', 'Halifax', 'Nova Scotia',
  'Hamburg', 'Germany', 'Hamilton County', 'Iowa', 'Harnett County', 'North Carolina',
  'Harris County', 'Texas', 'Hartford', 'Connecticut', 'Havana', 'Cuba',
  'Hawaii', 'Island', 'Helensburgh', 'Scotland', 'Hermiston', 'Oregon',
  'Hillsboro', 'Oregon', 'Hiroshima', 'Japan', 'Hobart', 'Tasmania',
  'Hollywood', 'Florida', 'Honolulu', 'Hawaii', 'Hounslow', 'England',
  'Houston', 'Texas', 'Huntington Beach', 'California', 'Indianapolis', 'Indiana',
  'Invercargill', 'New Zealand', 'Irbil', 'Iraq', 'Islamabad', 'Pakistan',
  'Istanbul', 'Turkey', 'Jakarta', 'Indonesia', 'Jalalabad', 'Afghanistan',
  'Jeddah', 'Saudi Arabia', 'Jerusalem', 'Israel', 'Johannesburg', 'South Africa',
  'Juneau', 'Alaska', 'Kabul', 'Afghanistan', 'Kamchatka', 'Russia',
  'Kamchatsky', 'Russia', 'Kansas City', 'Kansas', 'Kansas City', 'Missouri',
  'Kennesaw', 'Georgia', 'Kharkiv', 'Ukraine', 'Kyiv', 'Ukraine',
  'Lagos', 'Nigeria', 'Lake Ariel', 'Pennsylvania', 'Lake Wales', 'Florida',
  'Larnaca', 'Cyprus', 'Las Cruces', 'New Mexico', 'Las Vegas', 'Nevada',
  'Lavaur', 'France', 'Lebanon', 'Oregon', 'Leicester', 'England',
  'Lexington', 'Kentucky', 'Lima', 'Peru', 'Little River', 'South Carolina',
  'Liverpool', 'England', 'London', 'England', 'Long Beach', 'California',
  'Los Angeles', 'California', 'Louisville', 'Kentucky', 'Lubbock', 'Texas',
  'Madrid', 'Spain', 'Makhachkala', 'Dagestan', 'Makkah', 'Saudi Arabia',
  'Mandeville', 'Jamaica', 'Manhattan', 'New York', 'Manila', 'Philippines',
  'Maple Grove', 'Minnesota', 'Marbella', 'Spain', 'Mariupol', 'Ukraine',
  'Marseille', 'France', 'McAllen', 'Texas', 'Melbourne', 'Australia',
  'Memphis', 'Tennessee', 'Merseyside', 'England', 'Mexico City', 'Mexico',
  'Miami', 'FL', 'Miami', 'Florida', 'Miami Beach', 'Florida',
  'Milan', 'Italy', 'Milwaukee', 'Wisconsin', 'Minneapolis', 'Minnesota',
  'Mobile', 'Alabama', 'Mogadishu', 'Somalia', 'Moncton', 'New Brunswick',
  'Monroe County', 'New York', 'Montreal', 'Canada', 'Mount Juliet', 'Tennessee',
  'Muncie', 'Indiana', 'Munich', 'Germany', 'Murfreesboro', 'Tennessee',
  'Nantes', 'France', 'Naples', 'Florida', 'Nashville', 'Tennessee',
  'Nashua', 'New Hampshire', 'Nassau County', 'New York', 'New Brunswick', 'Canada',
  'New Delhi', 'India', 'New Haven', 'Connecticut', 'New Orleans', 'Louisiana',
  'New York', 'NY', 'New York City', 'New York', 'Newark', 'New Jersey',
  'Newcastle', 'England', 'Norfolk', 'Virginia', 'North Las Vegas', 'Nevada',
  'North Platte', 'Nebraska', 'Odessa', 'Ukraine', 'Oklahoma City', 'Oklahoma',
  'Olympia', 'Washington', 'Orlando', 'Florida', 'Oslo', 'Norway',
  'Ottawa', 'Canada', 'Oxford', 'England', 'Paducah', 'Kentucky',
  'Palmdale', 'California', 'Panama City', 'Florida', 'Paris', 'France',
  'Paterson', 'New Jersey', 'Pensacola', 'Florida', 'Philadelphia', 'Pennsylvania',
  'Phoenix', 'Arizona', 'Pittsburgh', 'Pennsylvania', 'Portland', 'Oregon',
  'Prague', 'Czech Republic', 'Pretoria', 'South Africa', 'Prince George', 'British Columbia',
  'Providence', 'Rhode Island', 'Pueblo', 'Colorado', 'Pune', 'India',
  'Quebec City', 'Canada', 'Queens', 'New York', 'Quito', 'Ecuador',
  'Raleigh', 'North Carolina', 'Rapid City', 'South Dakota', 'Reading', 'Pennsylvania',
  'Recife', 'Brazil', 'Reno', 'Nevada', 'Richmond', 'Virginia',
  'Rio de Janeiro', 'Brazil', 'Riyadh', 'Saudi Arabia', 'Rochester', 'New York',
  'Rockford', 'Illinois', 'Rome', 'Italy', 'Sacramento', 'California',
  'Salem', 'Massachusetts', 'Salt Lake City', 'Utah', 'San Antonio', 'Texas',
  'San Diego', 'California', 'San Francisco', 'California', 'San Jose', 'California',
  'San Juan', 'Puerto Rico', 'San Luis Potosí', 'Mexico', 'Sanford', 'Florida',
  'Santa Fe', 'New Mexico', 'Santiago', 'Chile', 'Santo Domingo', 'Dominican Republic',
  'São Paulo', 'Brazil', 'Savannah', 'Georgia', 'Scottsdale', 'Arizona',
  'Seattle', 'Washington', 'Sheffield', 'England', 'Shenzhen', 'China',
  'Shreveport', 'Louisiana', 'Simferopol', 'Crimea', 'Sioux City', 'Iowa',
  'Sofia', 'Bulgaria', 'Spokane', 'Washington', 'Springfield', 'Missouri',
  'St. Augustine', 'Florida', 'St. Elizabeth', 'Jamaica', 'Susquehanna County', 'Pennsylvania',
  'Swidnik', 'Poland', 'Sydney', 'Australia', 'Tacoma', 'Washington',
  'Taif', 'Saudi', 'Tampa', 'Florida', 'Tampere', 'Finland',
  'Tateyama City Coast', 'Chiba', 'Taylortown', 'North Carolina', 'Tehran', 'Iran',
  'Tel Aviv', 'Israel', 'The Bronx', 'New York', 'Traverse City', 'Michigan',
  'Tucson', 'Arizona', 'Tulsa', 'Oklahoma', 'Uppsala', 'Sweden',
  'Valdosta', 'Georgia', 'Vancouver', 'British Columbia', 'Vero Beach', 'Florida',
  'Villahermosa', 'Mexico', 'Virginia Beach', 'VA', 'Visayas', 'Philippines',
  'Waterbury', 'Connecticut', 'Wayne', 'Michigan', 'West Valley City', 'Utah',
  'Wichita Falls', 'Texas', 'Williamstown', 'New Jersey', 'Wilmington', 'NC',
  'Wilson County', 'Tennessee', 'Wolf Point', 'Montana', 'York County', 'Pennsylvania'
];

// Normalize locations for searching (remove duplicates, create search patterns)
const normalizedLocations = [...new Set(locationsToFind.map(loc => loc.toLowerCase().trim()))];

console.log(`Searching for ${normalizedLocations.length} unique locations in CSV...\n`);

// Read and parse CSV
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n');

// Parse CSV (simple parser - handles quoted fields)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

// Find posts with locations
const postsWithLocations = [];
const locationCounts = {};

// Skip header row
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const fields = parseCSVLine(line);
  if (fields.length < 3) continue;
  
  const postId = fields[0];
  const date = fields[1];
  const postText = fields[2] || '';
  const postLink = fields[3] || '';
  
  if (!postId || !postText) continue;
  
  const textLower = postText.toLowerCase();
  const foundLocations = [];
  
  // Search for each location (skip very short ones that cause false positives)
  for (const location of normalizedLocations) {
    // Skip very short locations that are likely false positives (unless they're common abbreviations)
    if (location.length <= 2 && !['ny', 'tx', 'fl', 'ca', 'va', 'nc', 'sc', 'ga', 'il', 'pa', 'oh', 'mi', 'wi', 'mn', 'co', 'az', 'nv', 'or', 'wa', 'id', 'mt', 'wy', 'ut', 'nm', 'ok', 'ar', 'la', 'ms', 'al', 'tn', 'ky', 'wv', 'md', 'de', 'ct', 'ri', 'ma', 'vt', 'nh', 'me'].includes(location)) {
      continue;
    }
    
    // Create search pattern - prefer whole word matches
    const escapedLocation = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // For longer locations, use word boundary
    // For shorter ones (like state codes), be more careful
    let pattern;
    if (location.length <= 3) {
      // For short codes, match with word boundaries and common patterns
      pattern = new RegExp(`\\b${escapedLocation}\\b`, 'i');
    } else {
      // For longer names, allow flexible matching
      pattern = new RegExp(`\\b${escapedLocation}\\b`, 'i');
    }
    
    if (pattern.test(textLower)) {
      // Additional validation for short codes - check context
      if (location.length <= 3) {
        // For state codes, check if it appears in context like "City, ST" or "ST" alone
        const contextPattern = new RegExp(`(?:,\\s*|\\s+|^)${escapedLocation}(?:\\s|,|$|\\s)`, 'i');
        if (!contextPattern.test(textLower)) {
          continue; // Skip if not in proper context
        }
      }
      
      const locationKey = location.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!foundLocations.includes(locationKey)) {
        foundLocations.push(locationKey);
        locationCounts[locationKey] = (locationCounts[locationKey] || 0) + 1;
      }
    }
  }
  
  if (foundLocations.length > 0) {
    postsWithLocations.push({
      postId,
      date,
      postText: postText.substring(0, 150) + (postText.length > 150 ? '...' : ''),
      postLink,
      locations: foundLocations
    });
  }
}

// Sort by number of locations found (most first)
postsWithLocations.sort((a, b) => b.locations.length - a.locations.length);

// Display results
console.log(`\n✅ Found ${postsWithLocations.length} posts mentioning your locations!\n`);

// Show location frequency
console.log('📍 Location Frequency:');
const sortedLocations = Object.entries(locationCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);
sortedLocations.forEach(([loc, count]) => {
  console.log(`  ${loc}: ${count} post(s)`);
});

console.log(`\n📋 Sample Posts (first 20):\n`);
postsWithLocations.slice(0, 20).forEach((post, idx) => {
  console.log(`${idx + 1}. Post ID: ${post.postId}`);
  console.log(`   Date: ${post.date}`);
  console.log(`   Locations: ${post.locations.join(', ')}`);
  console.log(`   Text: ${post.postText}`);
  console.log(`   Link: ${post.postLink}`);
  console.log('');
});

// Save full results to JSON
const outputPath = path.join(__dirname, '..', 'posts-with-locations.json');
fs.writeFileSync(outputPath, JSON.stringify({
  totalPosts: postsWithLocations.length,
  locationCounts,
  posts: postsWithLocations
}, null, 2));

console.log(`\n💾 Full results saved to: ${outputPath}`);
console.log(`\n📊 Summary:`);
console.log(`   - Total posts found: ${postsWithLocations.length}`);
console.log(`   - Unique locations mentioned: ${Object.keys(locationCounts).length}`);
console.log(`   - Total location mentions: ${Object.values(locationCounts).reduce((a, b) => a + b, 0)}`);

