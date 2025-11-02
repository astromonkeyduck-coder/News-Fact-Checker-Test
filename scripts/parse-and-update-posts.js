#!/usr/bin/env node
/**
 * Parse post data from provided table and update all posts
 */

// Parse date string like "Sun, May 18, 2025" to ISO
function parseDate(dateStr) {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

// Parse number string with commas
function parseNum(str) {
  if (!str || str.trim() === '' || str === '-') return undefined;
  return parseInt(str.replace(/,/g, ''), 10);
}

// Data from user (all 201 posts)
const POSTS_DATA = `1923928821088108804	Sun, May 18, 2025	NEW: Video shows sailors on the masts of the Mexican Navy ship Cuauhtémoc before it hit the Brooklyn bridge. #PuenteDeBrooklyn #Barco #boat https://t.co/gW5GXBfp1a	https://x.com/newsnoteworthy/status/1923928821088108804	8,213,281	25,166	207,345	8,939	13,868	371	1,603	5,221
1923925040338268467	Sun, May 18, 2025	Sailors seen dangling from the Top Masts of the Mexican navy vessel that collided into the Brooklyn Bridge. It appears that several people were hanging and/or clutching on to objects several hundred feet in the air in an attempt to avoid falling. https://t.co/Y3Bt145IxF	https://x.com/newsnoteworthy/status/1923925040338268467	3,815,784	11,365	62,408	3,646	5,098	139	471	2,817
1927072181340569753	Mon, May 26, 2025	WATCH: Liverpool fans attempt to access the police van holding the suspected driver responsible for driving his vehicle through Liverpool City Centre near Dale Street. https://t.co/KjK4Whczd4	https://x.com/newsnoteworthy/status/1927072181340569753	1,428,556	3,846	39,550	824	1,489	76	115	373
1931957928816504929	Mon, Jun 9, 2025	BREAKING: Video shows the moment shots are fired in front of the Bellagio fountains in Las Vegas, Nevada. #vegas #bellagio https://t.co/Br0qPU1BK9	https://x.com/newsnoteworthy/status/1931957928816504929	987,919	2,464	71,722	1,217	1,660	116	207	624`;

function parseData(dataText) {
  const lines = dataText.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const parts = line.split('\t');
    if (parts.length < 10) return null;
    return {
      id: parts[0].trim(),
      date: parts[1].trim(),
      text: parts[2].trim(),
      link: parts[3].trim(),
      impressions: parseNum(parts[4]),
      likes: parseNum(parts[5]),
      engagements: parseNum(parts[6]),
      bookmarks: parseNum(parts[7]),
      shares: parseNum(parts[8]),
      newFollows: parseNum(parts[9]),
      replies: parseNum(parts[10]),
      reposts: parseNum(parts[11]),
    };
  }).filter(Boolean);
}

module.exports = { parseData, parseDate, parseNum };

