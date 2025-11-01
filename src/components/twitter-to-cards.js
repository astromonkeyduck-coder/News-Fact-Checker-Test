/**
 * Transforms X Timeline Widget into your card format
 * 
 * This script:
 * 1. Loads the X timeline widget (hidden)
 * 2. Intercepts loaded tweets via MutationObserver
 * 3. Converts them to your card format
 * 4. Displays them in your articles-track container
 */

(function() {
  'use strict';

  // Configuration
  const TWITTER_USERNAME = 'newsnoteworthy'; // Change this to your username
  const CONTAINER_ID = 'articlesTrack';
  const MAX_TWEETS = 10; // How many tweets to show

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
      console.error(`Container ${CONTAINER_ID} not found`);
      return;
    }

    // Create hidden container for X widget
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'x-timeline-hidden';
    widgetContainer.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
    document.body.appendChild(widgetContainer);

    // Load X timeline widget
    const timelineLink = document.createElement('a');
    timelineLink.className = 'twitter-timeline';
    timelineLink.href = `https://twitter.com/${TWITTER_USERNAME}`;
    timelineLink.setAttribute('data-width', '600');
    timelineLink.setAttribute('data-height', '800');
    timelineLink.setAttribute('data-theme', 'dark');
    timelineLink.textContent = `Tweets by ${TWITTER_USERNAME}`;
    
    widgetContainer.appendChild(timelineLink);

    // Load X widgets script
    if (!document.querySelector('script[src*="platform.twitter.com/widgets.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.charset = 'utf-8';
      script.async = true;
      document.head.appendChild(script);
    }

    // Wait for widget to load and intercept tweets
    waitForWidget(timelineLink, container);
  }

  function waitForWidget(timelineLink, container) {
    let checkCount = 0;
    const maxChecks = 50; // 5 seconds max wait

    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Check if iframe is loaded
      const iframe = document.querySelector('iframe[src*="twitter.com/i/api/2/timeline"]');
      
      if (iframe || checkCount >= maxChecks) {
        clearInterval(checkInterval);
        
        if (iframe) {
          // Try to intercept postMessage events from iframe
          interceptTweets(iframe, container);
          
          // Fallback: scrape visible tweets from iframe after load
          setTimeout(() => scrapeTweetsFromWidget(container), 3000);
        } else {
          // Fallback: fetch via oEmbed or server function
          console.warn('Could not intercept X widget, using fallback method');
          fetchTweetsViaAPI(container);
        }
      }
    }, 100);
  }

  function interceptTweets(iframe, container) {
    // Listen for postMessage events (X widget communicates via postMessage)
    window.addEventListener('message', (event) => {
      // X widgets send data via postMessage
      if (event.data && typeof event.data === 'object') {
        try {
          // X widget structure - adapt based on actual messages
          if (event.data.type === 'timeline' || event.data.tweets) {
            const tweets = event.data.tweets || [];
            if (tweets.length > 0) {
              renderTweetsAsCards(tweets, container);
            }
          }
        } catch (e) {
          // Ignore unrelated messages
        }
      }
    });
  }

  function scrapeTweetsFromWidget(container) {
    // Try to access iframe content (will fail due to CORS, but worth trying)
    const iframe = document.querySelector('iframe[src*="twitter.com"]');
    if (!iframe) return;

    try {
      // This won't work due to CORS, but we can try
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const tweets = iframeDoc.querySelectorAll('[data-testid="tweet"]');
      
      if (tweets.length > 0) {
        // Extract tweet data
        const tweetData = Array.from(tweets).slice(0, MAX_TWEETS).map(extractTweetData);
        renderTweetsAsCards(tweetData, container);
      }
    } catch (e) {
      // CORS blocked - use API fallback
      console.log('Cannot access iframe content (CORS), using API fallback');
      fetchTweetsViaAPI(container);
    }
  }

  function extractTweetData(tweetElement) {
    // Extract data from tweet DOM element
    const textEl = tweetElement.querySelector('[data-testid="tweetText"]');
    const timeEl = tweetElement.querySelector('time');
    const linkEl = tweetElement.querySelector('a[href*="/status/"]');
    const imgEl = tweetElement.querySelector('img[src*="pbs.twimg.com"]');
    
    return {
      text: textEl?.textContent || '',
      date: timeEl?.getAttribute('datetime') || new Date().toISOString(),
      url: linkEl?.href || '',
      image: imgEl?.src || null,
      id: linkEl?.href?.match(/\/status\/(\d+)/)?.[1] || Date.now().toString()
    };
  }

  async function fetchTweetsViaAPI(container) {
    // Fallback: Use server function to fetch tweets
    try {
      const response = await fetch(`/.netlify/functions/fetch-profile-tweets?username=${TWITTER_USERNAME}&limit=${MAX_TWEETS}`);
      if (response.ok) {
        const tweets = await response.json();
        renderTweetsAsCards(tweets, container);
      } else {
        showError(container, 'Unable to load tweets. Please check your username.');
      }
    } catch (err) {
      console.error('Error fetching tweets:', err);
      showError(container, 'Error loading tweets. Using fallback method.');
    }
  }

  function renderTweetsAsCards(tweets, container) {
    if (!Array.isArray(tweets) || tweets.length === 0) {
      showError(container, 'No tweets found.');
      return;
    }

    // Clear container or append
    // container.innerHTML = ''; // Uncomment to replace existing cards

    const cardsHTML = tweets.map(tweet => createCardHTML(tweet)).join('');
    
    // Prepend new tweets to existing cards
    const firstCard = container.querySelector('.article-card');
    if (firstCard) {
      firstCard.insertAdjacentHTML('beforebegin', cardsHTML);
    } else {
      container.innerHTML = cardsHTML;
    }
  }

  function createCardHTML(tweet) {
    const formatDate = (dateStr) => {
      try {
        return new Date(dateStr).toLocaleString();
      } catch {
        return 'Recently';
      }
    };

    const formatText = (text) => {
      if (!text) return '';
      // Escape HTML
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    };

    const calculateReadTime = (text) => {
      const words = text.split(/\s+/).filter(w => w.length > 0).length;
      return Math.ceil(words / 200) || 1;
    };

    const getTitle = (text) => {
      const firstSentence = text.match(/^[^.!?]+[.!?]?/)?.[0] || text;
      return firstSentence.substring(0, 80) + (firstSentence.length > 80 ? '...' : '');
    };

    const imageHtml = tweet.image 
      ? `<div class="article-image">
          <img src="${tweet.image}" alt="${getTitle(tweet.text || '').replace(/"/g, '&quot;')}" loading="lazy" />
        </div>`
      : '';

    const text = tweet.text || '';
    const title = getTitle(text);
    const formattedText = formatText(text);
    const readTime = calculateReadTime(text);
    const date = formatDate(tweet.date || new Date().toISOString());
    const link = tweet.url || `https://twitter.com/${TWITTER_USERNAME}/status/${tweet.id}`;

    return `
      <article class="article-card" role="listitem" data-post-type="${tweet.image ? 'photo' : 'text'}" data-tweet-id="${tweet.id}">
        ${imageHtml}
        <div class="article-content">
          <h3 class="article-headline">
            <a href="${link}" target="_blank" rel="noopener noreferrer">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a>
          </h3>
          <p class="article-excerpt">${formattedText}</p>
          <div class="article-meta">
            <span class="article-date">${date}</span>
            <span class="article-read-time">${readTime} min read</span>
          </div>
        </div>
      </article>
    `;
  }

  function showError(container, message) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.8);">
        ${message}
      </div>
    `;
  }
})();

