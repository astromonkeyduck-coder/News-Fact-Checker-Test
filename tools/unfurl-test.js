#!/usr/bin/env node

/**
 * Unfurl Test Script
 * Tests how different user agents see article previews
 * 
 * Usage:
 *   node tools/unfurl-test.js "https://noteworthynews.co/article.html?id=post-usgs-xxx"
 *   node tools/unfurl-test.js "https://noteworthynews.co/article.html?id=post-usgs-xxx" --card=player
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const USER_AGENTS = {
  twitterbot: 'Twitterbot/1.0',
  facebook: 'facebookexternalhit/1.1',
  slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  discordbot: 'Discordbot (https://discordapp.com)',
  telegrambot: 'TelegramBot (like TwitterBot)',
  whatsapp: 'WhatsApp/2.0',
  linkedinbot: 'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function fetchHTML(url, userAgent) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': userAgent
      }
    };
    
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function extractMetaTag(html, property) {
  // Match both property="og:image" and name="twitter:image"
  const regex = new RegExp(`<(meta|Meta)\\s+(property|name)="${property}"\\s+content="([^"]+)"`, 'i');
  const match = html.match(regex);
  return match ? match[3] : null;
}

function extractTitle(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1] : null;
}

async function testUnfurl(url, userAgentName, userAgent) {
  try {
    console.log(`\n🔍 Testing as ${userAgentName}...`);
    const html = await fetchHTML(url, userAgent);
    
    const ogImage = extractMetaTag(html, 'og:image');
    const twitterImage = extractMetaTag(html, 'twitter:image');
    const twitterCard = extractMetaTag(html, 'twitter:card');
    const ogTitle = extractMetaTag(html, 'og:title');
    const twitterTitle = extractMetaTag(html, 'twitter:title');
    const title = extractTitle(html);
    
    console.log(`   Title: ${title || 'N/A'}`);
    console.log(`   OG Title: ${ogTitle || 'N/A'}`);
    console.log(`   Twitter Title: ${twitterTitle || 'N/A'}`);
    console.log(`   OG Image: ${ogImage ? ogImage.substring(0, 80) + '...' : '❌ MISSING'}`);
    console.log(`   Twitter Image: ${twitterImage ? twitterImage.substring(0, 80) + '...' : '❌ MISSING'}`);
    console.log(`   Twitter Card: ${twitterCard || 'N/A'}`);
    
    // Check if using default image
    if (ogImage && ogImage.includes('PREVIEWIMAGEBRUH.jpg')) {
      console.log(`   ⚠️  WARNING: Using default image!`);
    } else if (ogImage && !ogImage.includes('PREVIEWIMAGEBRUH.jpg')) {
      console.log(`   ✅ Using generated image`);
    }
    
    return {
      userAgent: userAgentName,
      ogImage,
      twitterImage,
      twitterCard,
      title,
      ogTitle,
      twitterTitle,
      success: true
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      userAgent: userAgentName,
      error: error.message,
      success: false
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(arg => arg.startsWith('http'));
  const cardParam = args.find(arg => arg.startsWith('--card='));
  const cardType = cardParam ? cardParam.split('=')[1] : 'summary';
  
  if (!url) {
    console.error('Usage: node tools/unfurl-test.js <url> [--card=summary|player]');
    console.error('Example: node tools/unfurl-test.js "https://noteworthynews.co/article.html?id=post-usgs-xxx"');
    process.exit(1);
  }
  
  // Add card parameter if specified
  const testUrl = cardType !== 'summary' ? `${url}${url.includes('?') ? '&' : '?'}card=${cardType}` : url;
  
  console.log(`\n📋 Testing URL: ${testUrl}`);
  console.log(`📋 Card Type: ${cardType}`);
  console.log('='.repeat(80));
  
  const results = [];
  
  // Test with different user agents
  for (const [name, ua] of Object.entries(USER_AGENTS)) {
    const result = await testUnfurl(testUrl, name, ua);
    results.push(result);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const withDefaultImage = successful.filter(r => r.ogImage && r.ogImage.includes('PREVIEWIMAGEBRUH.jpg'));
  const withGeneratedImage = successful.filter(r => r.ogImage && !r.ogImage.includes('PREVIEWIMAGEBRUH.jpg'));
  
  console.log(`✅ Successful requests: ${successful.length}/${results.length}`);
  console.log(`🖼️  Using generated images: ${withGeneratedImage.length}`);
  console.log(`⚠️  Using default images: ${withDefaultImage.length}`);
  
  if (withDefaultImage.length > 0) {
    console.log(`\n⚠️  WARNING: These user agents are seeing default images:`);
    withDefaultImage.forEach(r => {
      console.log(`   - ${r.userAgent}`);
    });
  }
  
  // Twitter-specific check
  const twitterResult = results.find(r => r.userAgent === 'twitterbot');
  if (twitterResult && twitterResult.success) {
    console.log(`\n🐦 Twitter Bot Results:`);
    console.log(`   OG Image: ${twitterResult.ogImage || 'MISSING'}`);
    console.log(`   Twitter Image: ${twitterResult.twitterImage || 'MISSING'}`);
    console.log(`   Twitter Card: ${twitterResult.twitterCard || 'MISSING'}`);
    if (twitterResult.ogImage && !twitterResult.ogImage.includes('PREVIEWIMAGEBRUH.jpg')) {
      console.log(`   ✅ Twitter is seeing generated image!`);
    } else {
      console.log(`   ❌ Twitter is seeing default image or missing image!`);
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
