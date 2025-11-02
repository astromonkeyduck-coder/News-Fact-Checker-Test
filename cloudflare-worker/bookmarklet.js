/**
 * Bookmarklet for one-tap adding tweets to feed
 * 
 * Usage: Copy this code, create a new bookmark in Chrome/Browser,
 * paste as the URL. When on a tweet page, click the bookmarklet.
 */

javascript:(function(){
  const tweetUrl = window.location.href;
  // Your Cloudflare Worker URL
  const workerUrl = 'https://x-feed-worker.pangpangpangismysubdomainbrutha.workers.dev';
  
  // Check if we're on a tweet page
  if (!tweetUrl.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/\d+/i)) {
    alert('❌ This doesn\'t look like a tweet page.\n\nMake sure you\'re on a tweet page (URL should contain /status/)');
    return;
  }

  // Create popup window that persists across tab switches
  const popupWidth = 320;
  const popupHeight = 120;
  const left = screen.width - popupWidth - 20;
  const top = 20;
  
  const popup = window.open(
    '',
    'noteworthy-status',
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=no,scrollbars=no,status=no`
  );
  
  if (!popup) {
    // Fallback if popup blocked - show inline indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, rgba(74, 144, 226, 0.95), rgba(46, 204, 113, 0.95));
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 600;
      max-width: 300px;
    `;
    indicator.textContent = '🔄 Adding to feed...';
    document.body.appendChild(indicator);
    
    // Post to worker
    fetch(`${workerUrl}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: tweetUrl }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          indicator.style.background = 'linear-gradient(135deg, rgba(46, 204, 113, 0.95), rgba(74, 144, 226, 0.95))';
          indicator.textContent = '✅ Added to feed!';
          setTimeout(() => indicator.remove(), 3000);
        } else {
          throw new Error(data.message || data.error || 'Failed to add');
        }
      })
      .catch(err => {
        indicator.style.background = 'linear-gradient(135deg, rgba(255, 107, 107, 0.95), rgba(255, 165, 0, 0.95))';
        indicator.textContent = `❌ Error: ${err.message}`;
        setTimeout(() => indicator.remove(), 5000);
      });
    return;
  }

  // Style the popup window
  popup.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Noteworthy Status</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.95), rgba(46, 204, 113, 0.95));
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          padding: 20px;
          text-align: center;
          font-weight: 600;
          font-size: 14px;
          position: relative;
        }
        .status {
          font-size: 18px;
          margin-bottom: 8px;
        }
        .close-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          transition: background 0.2s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .success {
          background: linear-gradient(135deg, rgba(46, 204, 113, 0.95), rgba(74, 144, 226, 0.95));
        }
        .error {
          background: linear-gradient(135deg, rgba(255, 107, 107, 0.95), rgba(255, 165, 0, 0.95));
        }
      </style>
    </head>
    <body>
      <button class="close-btn" onclick="window.close()">×</button>
      <div class="status">🔄 Adding to feed...</div>
      <div style="font-size: 12px; opacity: 0.9;">This window stays visible when you switch tabs</div>
    </body>
    </html>
  `);
  popup.document.close();

  // Post to worker
  fetch(`${workerUrl}/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: tweetUrl }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        popup.document.body.className = 'success';
        popup.document.querySelector('.status').textContent = '✅ Added to feed!';
        setTimeout(() => popup.close(), 3000);
      } else {
        throw new Error(data.message || data.error || 'Failed to add');
      }
    })
    .catch(err => {
      popup.document.body.className = 'error';
      popup.document.querySelector('.status').textContent = `❌ Error: ${err.message}`;
      // Don't auto-close on error, let user close manually
    });
})();

