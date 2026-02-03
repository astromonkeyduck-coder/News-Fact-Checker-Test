#!/usr/bin/env node
/**
 * Test Twitter's GraphQL endpoints (what Discord bots might use)
 */

const tweetId = '2017449907313930440';
const tweetUrl = `https://x.com/newsnoteworthy/status/${tweetId}`;

async function testGraphQLEndpoints() {
    console.log('🔍 Testing Twitter GraphQL/API endpoints...\n');
    
    // Try mobile.twitter.com (often has different data)
    console.log('1. Testing mobile.twitter.com...');
    try {
        const mobileResponse = await fetch(`https://mobile.twitter.com/newsnoteworthy/status/${tweetId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
            }
        });
        
        if (mobileResponse.ok) {
            const mobileHtml = await mobileResponse.text();
            console.log(`   ✅ Got HTML (${mobileHtml.length} chars)`);
            
            // Look for media URLs
            const pbsMatches = mobileHtml.match(/https?:\/\/pbs\.twimg\.com\/media\/[^\s"']+/gi);
            if (pbsMatches) {
                console.log(`   🖼️  Found ${pbsMatches.length} pbs.twimg.com URLs`);
                pbsMatches.slice(0, 3).forEach(url => {
                    if (!url.includes('profile_images')) {
                        console.log(`      - ${url}`);
                    }
                });
            }
            
            // Look for GraphQL queries
            const graphqlQueries = mobileHtml.match(/https?:\/\/[^"'\s<>]*graphql[^"'\s<>]*/gi);
            if (graphqlQueries) {
                console.log(`   📡 Found ${graphqlQueries.length} GraphQL endpoints`);
            }
        }
    } catch (e) {
        console.log('   ❌ Error:', e.message);
    }
    
    // Try Twitter's internal API endpoints (what the web app uses)
    console.log('\n2. Testing internal API patterns...');
    
    // Common GraphQL query for tweet details
    const graphqlQuery = {
        queryId: 'V3ZzeV7Q-LBvF8o0jXx9zw', // TweetDetail query (common)
        variables: JSON.stringify({
            tweetId: tweetId,
            with_rux_injections: false,
            includePromotedContent: false,
            withCommunity: true,
            withQuickPromoteEligibilityTweetFields: false,
            withBirdwatchNotes: false,
            withSuperFollowsUserFields: false,
            withDownvotePerspective: false,
            withReactionsMetadata: false,
            withReactionsPerspective: false,
            withSuperFollowsTweetFields: false,
            withVoice: false,
            withV2Timeline: false
        })
    };
    
    // Try the GraphQL endpoint
    const graphqlUrl = `https://twitter.com/i/api/graphql/${graphqlQuery.queryId}/TweetDetail?variables=${encodeURIComponent(graphqlQuery.variables)}`;
    console.log('   Trying:', graphqlUrl.substring(0, 100) + '...');
    
    try {
        const graphqlResponse = await fetch(graphqlUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA', // Guest token (public)
                'x-twitter-client-language': 'en',
                'x-twitter-active-user': 'yes',
            }
        });
        
        console.log(`   Status: ${graphqlResponse.status}`);
        
        if (graphqlResponse.ok) {
            const data = await graphqlResponse.json();
            console.log('   ✅ Got JSON response!');
            console.log('   Data keys:', Object.keys(data).join(', '));
            
            // Try to find media in the response
            const jsonStr = JSON.stringify(data);
            const mediaMatches = jsonStr.match(/pbs\.twimg\.com\/media\/[^"'\s]+/gi);
            if (mediaMatches) {
                console.log(`   🖼️  Found ${mediaMatches.length} media URLs!`);
                [...new Set(mediaMatches)].slice(0, 5).forEach(url => {
                    console.log(`      - https://${url}`);
                });
            }
        } else {
            const errorText = await graphqlResponse.text();
            console.log('   Response:', errorText.substring(0, 200));
        }
    } catch (e) {
        console.log('   ❌ Error:', e.message);
    }
    
    // Try alternative: Look for guest token and use it
    console.log('\n3. Testing guest token approach...');
    try {
        // First get a guest token
        const guestTokenResponse = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            }
        });
        
        if (guestTokenResponse.ok) {
            const guestData = await guestTokenResponse.json();
            console.log('   ✅ Got guest token:', guestData.guest_token?.substring(0, 20) + '...');
        }
    } catch (e) {
        console.log('   ❌ Error:', e.message);
    }
}

if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

testGraphQLEndpoints();
