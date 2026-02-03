/**
 * Update Breaking News Cards from CSV Analytics Data
 * Parses CSV file and converts to post format for breaking news cards
 */

const fs = require('fs');
const path = require('path');

// Read and parse CSV
function parseCSV(csvPath) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const posts = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith(',,,')) continue; // Skip empty lines
        
        // Parse CSV line (handling quoted fields)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim()); // Add last value
        
        if (values.length < headers.length) continue;
        
        // Create object from headers and values
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        // Skip rows with missing essential data
        if (!row['Post id'] || !row['Post text'] || row['Post id'] === 'undefined') {
            continue;
        }
        
        // Convert to post format
        const postId = row['Post id'].trim();
        const postText = row['Post text'].trim();
        const postLink = row['Post Link'] || '';
        const dateStr = row['Date'] || '';
        
        // Parse date
        let datePosted;
        if (dateStr) {
            // Try to parse date (format: "Sun, Feb 1, 2026")
            const dateMatch = dateStr.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d+)/);
            if (dateMatch) {
                const [, , month, day, year] = dateMatch;
                const monthMap = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                };
                datePosted = new Date(`${year}-${monthMap[month]}-${day.padStart(2, '0')}T00:00:00Z`).toISOString();
            } else {
                datePosted = new Date().toISOString();
            }
        } else {
            datePosted = new Date().toISOString();
        }
        
        // Determine if it's breaking news
        const isBreaking = postText.toUpperCase().includes('BREAKING') || 
                          postText.toUpperCase().includes('JUST IN') ||
                          postText.toUpperCase().startsWith('BREAKING');
        
        // Extract title and story
        let title = postText;
        let story = postText;
        
        // If text contains colon, use part before colon as title
        if (postText.includes(':')) {
            const colonIndex = postText.indexOf(':');
            title = postText.substring(0, colonIndex).trim();
            story = postText.substring(colonIndex + 1).trim();
            
            // Remove "BREAKING" prefix from title if present
            title = title.replace(/^BREAKING\s*/i, '').trim();
        }
        
        // Calculate read time (average 200 words per minute)
        const wordCount = postText.split(/\s+/).filter(w => w.length > 0).length;
        const readTime = Math.max(1, Math.ceil(wordCount / 200));
        
        // Create post object
        const post = {
            id: postId,
            title: title || postText.substring(0, 100),
            story: story || postText,
            text: postText,
            link: postLink,
            url: postLink,
            datePosted: datePosted,
            createdAt: datePosted,
            created_at: datePosted,
            category: isBreaking ? 'Breaking News' : 'News',
            breaking: isBreaking,
            readTime: readTime,
            // Analytics data
            impressions: parseInt(row['Impressions'] || '0', 10),
            likes: parseInt(row['Likes'] || '0', 10),
            engagements: parseInt(row['Engagements'] || '0', 10),
            bookmarks: parseInt(row['Bookmarks'] || '0', 10),
            shares: parseInt(row['Shares'] || '0', 10),
            reposts: parseInt(row['Reposts'] || '0', 10),
            replies: parseInt(row['Replies'] || '0', 10),
            profileVisits: parseInt(row['Profile visits'] || '0', 10),
            urlClicks: parseInt(row['URL Clicks'] || '0', 10),
        };
        
        posts.push(post);
    }
    
    return posts;
}

// Main function
function main() {
    const csvPath = path.join(__dirname, '../account_analytics_content_2026-01-15_2026-02-01.csv');
    const outputPath = path.join(__dirname, '../breaking-news-update.json');
    
    console.log('📊 Parsing CSV file...');
    const posts = parseCSV(csvPath);
    
    console.log(`✅ Parsed ${posts.length} posts from CSV`);
    
    // Sort by date (newest first)
    posts.sort((a, b) => {
        const dateA = new Date(a.datePosted).getTime();
        const dateB = new Date(b.datePosted).getTime();
        return dateB - dateA;
    });
    
    // Filter for breaking news (top 20)
    const breakingNews = posts
        .filter(post => post.breaking)
        .slice(0, 20);
    
    console.log(`🔥 Found ${breakingNews.length} breaking news posts`);
    
    // Write to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(breakingNews, null, 2));
    console.log(`💾 Saved to ${outputPath}`);
    
    // Also create a summary
    console.log('\n📋 Top Breaking News Posts:');
    breakingNews.slice(0, 5).forEach((post, index) => {
        console.log(`\n${index + 1}. ${post.title}`);
        console.log(`   Date: ${new Date(post.datePosted).toLocaleDateString()}`);
        console.log(`   Engagements: ${post.engagements.toLocaleString()}`);
        console.log(`   Link: ${post.link}`);
    });
    
    console.log(`\n✨ Done! Use this data to update breaking news cards.`);
    console.log(`\nTo import these posts, you can:`);
    console.log(`1. Use the Netlify function to import posts`);
    console.log(`2. Or manually update the posts in blob storage`);
}

if (require.main === module) {
    main();
}

module.exports = { parseCSV };
