/**
 * Version Checker - Notifies users when website has been updated
 * Checks for updates periodically and shows a refresh prompt
 */

(function() {
  'use strict';

  // Get version from meta tag or use build timestamp
  function getCurrentVersion() {
    const metaVersion = document.querySelector('meta[name="app-version"]');
    if (metaVersion) {
      const version = metaVersion.getAttribute('content');
      console.log('[Version Checker] Current version from meta tag:', version);
      return version;
    }
    // Fallback: use last update timestamp from header
    const lastUpdateEl = document.querySelector('.last-update');
    if (lastUpdateEl) {
      const text = lastUpdateEl.textContent || '';
      const match = text.match(/Last Update:\s*(.+)/);
      if (match) {
        const version = match[1].trim();
        console.log('[Version Checker] Current version from last-update:', version);
        return version;
      }
    }
    // Final fallback: use page load time
    const fallback = new Date().toISOString();
    console.log('[Version Checker] Using fallback version:', fallback);
    return fallback;
  }

  // Store version in localStorage
  const STORAGE_KEY = 'noteworthy-app-version';
  const CHECK_INTERVAL = 60000; // Check every minute
  const VERSION_CHECK_URL = window.location.origin + window.location.pathname;

  let checkInterval = null;
  let notificationShown = false;

  // Create notification banner
  function createNotificationBanner() {
    // Remove existing banner if any
    const existing = document.getElementById('version-update-banner');
    if (existing) {
      existing.remove();
    }

    const banner = document.createElement('div');
    banner.id = 'version-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #4A90E2 0%, #2A60B0 100%);
      color: white;
      padding: 1rem 1.5rem;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      animation: slideDown 0.3s ease;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
        <span style="font-size: 1.25rem;">🔄</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 0.25rem;">New Version Available</div>
          <div style="font-size: 0.875rem; opacity: 0.9;">This website has been updated. Refresh to see the latest changes.</div>
        </div>
      </div>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <button id="version-update-refresh" style="
          padding: 0.5rem 1.25rem;
          background: white;
          color: #4A90E2;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        ">Refresh Now</button>
        <button id="version-update-dismiss" style="
          padding: 0.5rem 1rem;
          background: transparent;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          opacity: 0.8;
        ">Dismiss</button>
      </div>
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      #version-update-banner button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      #version-update-banner button:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);

    // Add event listeners
    const refreshBtn = banner.querySelector('#version-update-refresh');
    const dismissBtn = banner.querySelector('#version-update-dismiss');

    refreshBtn.addEventListener('click', () => {
      // Store that user is refreshing
      localStorage.setItem(STORAGE_KEY, getCurrentVersion());
      window.location.reload();
    });

    dismissBtn.addEventListener('click', () => {
      // Store current version so we don't show again until it changes
      localStorage.setItem(STORAGE_KEY, getCurrentVersion());
      banner.style.animation = 'slideDown 0.3s ease reverse';
      setTimeout(() => banner.remove(), 300);
      notificationShown = false;
    });

    // Add to page
    document.body.insertBefore(banner, document.body.firstChild);

    // Adjust body padding to account for banner
    document.body.style.paddingTop = banner.offsetHeight + 'px';

    notificationShown = true;
  }

  // Fetch the latest version from the server
  async function fetchLatestVersion() {
    try {
      const response = await fetch(VERSION_CHECK_URL, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Try to get version from meta tag
      const metaVersion = doc.querySelector('meta[name="app-version"]');
      if (metaVersion) {
        return metaVersion.getAttribute('content');
      }
      
      // Fallback: try to get from last-update element
      const lastUpdateEl = doc.querySelector('.last-update');
      if (lastUpdateEl) {
        const text = lastUpdateEl.textContent || '';
        const match = text.match(/Last Update:\s*(.+)/);
        if (match) {
          return match[1].trim();
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Version Checker] Failed to fetch latest version:', error);
      return null;
    }
  }

  // Check for version updates
  async function checkForUpdates() {
    try {
      const currentPageVersion = getCurrentVersion();
      const storedVersion = localStorage.getItem(STORAGE_KEY);

      console.log('[Version Checker] Checking for updates...');
      console.log('[Version Checker] Current page version:', currentPageVersion);
      console.log('[Version Checker] Stored version:', storedVersion);
      console.log('[Version Checker] Notification shown:', notificationShown);

      // If no stored version, store current and return
      if (!storedVersion) {
        console.log('[Version Checker] No stored version, storing current version');
        localStorage.setItem(STORAGE_KEY, currentPageVersion);
        return;
      }

      // Fetch the latest version from the server (bypasses cache)
      const latestVersion = await fetchLatestVersion();
      
      if (latestVersion) {
        console.log('[Version Checker] Latest version from server:', latestVersion);
        
        // Check if server version is different from stored version
        if (latestVersion !== storedVersion && !notificationShown) {
          console.log('[Version Checker] ✅ New version detected on server!');
          console.log('[Version Checker] Your version:', storedVersion);
          console.log('[Version Checker] Latest version:', latestVersion);
          createNotificationBanner();
        } else if (latestVersion === storedVersion) {
          console.log('[Version Checker] You are on the latest version');
        } else if (notificationShown) {
          console.log('[Version Checker] Notification already shown');
        }
      } else {
        // Fallback: compare current page version with stored
        if (currentPageVersion !== storedVersion && !notificationShown) {
          console.log('[Version Checker] ✅ Version mismatch detected!');
          console.log('[Version Checker] Stored version:', storedVersion);
          console.log('[Version Checker] Current page version:', currentPageVersion);
          createNotificationBanner();
        }
      }
    } catch (error) {
      console.error('[Version Checker] Update check failed:', error);
    }
  }

  // Start checking for updates
  function startVersionChecker() {
    console.log('[Version Checker] Starting version checker...');
    
    // Initial check immediately (don't wait)
    checkForUpdates();
    
    // Then check periodically
    checkInterval = setInterval(checkForUpdates, CHECK_INTERVAL);
    console.log('[Version Checker] Will check every', CHECK_INTERVAL / 1000, 'seconds');
  }

  // Stop checking (useful if needed)
  function stopVersionChecker() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startVersionChecker);
  } else {
    startVersionChecker();
  }

  // Also check when page becomes visible (user switches back to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !notificationShown) {
      checkForUpdates();
    }
  });

  // Export for manual control if needed
  window.versionChecker = {
    check: checkForUpdates,
    start: startVersionChecker,
    stop: stopVersionChecker
  };
})();

