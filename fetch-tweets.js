const puppeteer = require('puppeteer');

async function fetchNoteworthyTweets() {
    console.log('Fetching tweets from @newsnoteworthy...');
    
    const browser = await puppeteer.launch({
        headless: true, // Run in background
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Go to the Noteworthy News profile
        await page.goto('https://x.com/newsnoteworthy', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for tweets to load
        await page.waitForTimeout(3000);
        
        // Extract tweet content
        const tweets = await page.evaluate(() => {
            const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
            const tweetTexts = [];
            
            tweetElements.forEach((tweet, index) => {
                if (index < 10) { // Get first 10 tweets
                    const textElement = tweet.querySelector('[data-testid="tweetText"]');
                    if (textElement) {
                        const text = textElement.textContent.trim();
                        if (text && text.length > 20) { // Only include substantial tweets
                            tweetTexts.push({
                                text: text,
                                index: index + 1
                            });
                        }
                    }
                }
            });
            
            return tweetTexts;
        });
        
        console.log('\n📰 Found tweets from @newsnoteworthy:');
        console.log('=====================================');
        
        tweets.forEach((tweet, index) => {
            console.log(`\n${index + 1}. ${tweet.text}`);
            console.log('---');
        });
        
        console.log(`\n✅ Successfully fetched ${tweets.length} tweets`);
        console.log('\n💡 You can now copy these headlines and add them to your game!');
        
        return tweets;
        
    } catch (error) {
        console.error('❌ Error fetching tweets:', error.message);
        console.log('\n🔧 Alternative: You can manually copy tweets from https://x.com/newsnoteworthy');
        return [];
    } finally {
        await browser.close();
    }
}

// Run the script
fetchNoteworthyTweets().catch(console.error);
