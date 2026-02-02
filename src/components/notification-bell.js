/**
 * Floating Notification Bell Widget
 * Provides a persistent UI element for managing push notifications
 */

(function() {
  'use strict';

  // Styles for the notification bell
  const STYLES = `
    #notification-bell-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    @media (max-width: 768px) {
      #notification-bell-widget {
        bottom: 80px; /* Above mobile nav */
        right: 16px;
      }
    }

    .notification-bell-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0f234a 0%, #1a3a6e 100%);
      border: 2px solid rgba(74, 144, 226, 0.5);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(74, 144, 226, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: all 0.3s ease;
      position: relative;
    }

    .notification-bell-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 28px rgba(0, 0, 0, 0.4), 0 0 30px rgba(74, 144, 226, 0.4);
      border-color: rgba(74, 144, 226, 0.8);
    }

    .notification-bell-btn.subscribed {
      border-color: rgba(46, 204, 113, 0.6);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(46, 204, 113, 0.3);
    }

    .notification-bell-btn.subscribed:hover {
      box-shadow: 0 6px 28px rgba(0, 0, 0, 0.4), 0 0 30px rgba(46, 204, 113, 0.5);
    }

    .notification-bell-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid #0f234a;
    }

    .notification-bell-dot.active {
      background: #2ECC71;
      animation: pulse-bell 2s infinite;
    }

    .notification-bell-dot.inactive {
      background: #E74C3C;
    }

    .notification-bell-dot.permission-needed {
      background: #F1C40F;
    }

    @keyframes pulse-bell {
      0%, 100% { 
        box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7);
      }
      50% { 
        box-shadow: 0 0 0 8px rgba(46, 204, 113, 0);
      }
    }

    /* Panel Styles */
    .notification-bell-panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 340px;
      max-width: calc(100vw - 32px);
      background: linear-gradient(135deg, #0f234a 0%, #07152a 100%);
      border: 1px solid rgba(74, 144, 226, 0.3);
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px) scale(0.95);
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .notification-bell-panel.open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }

    .notification-bell-panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .notification-bell-panel-header h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: white;
    }

    .notification-bell-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      transition: color 0.2s;
    }

    .notification-bell-close:hover {
      color: white;
    }

    .notification-bell-panel-content {
      padding: 20px;
      max-height: 400px;
      overflow-y: auto;
    }

    /* Hide bell on certain pages */
    .notification-bell-hidden {
      display: none !important;
    }
  `;

  // Inject styles
  function injectStyles() {
    if (document.getElementById('notification-bell-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'notification-bell-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  // Check if we should show the bell on this page
  function shouldShowBell() {
    const path = window.location.pathname;
    // Hide on admin pages, profile page (has its own preferences), etc.
    const hiddenPages = ['/admin', '/profile.html'];
    return !hiddenPages.some(p => path.includes(p));
  }

  // Create the bell widget
  async function createBellWidget() {
    if (!shouldShowBell()) return;
    
    injectStyles();

    // Remove existing widget if present
    const existing = document.getElementById('notification-bell-widget');
    if (existing) existing.remove();

    // Create widget container
    const widget = document.createElement('div');
    widget.id = 'notification-bell-widget';

    // Wait for PushNotifications to be available
    let retries = 20;
    while (!window.PushNotifications && retries > 0) {
      await new Promise(r => setTimeout(r, 200));
      retries--;
    }

    if (!window.PushNotifications) {
      console.warn('[NotificationBell] PushNotifications not available');
      return;
    }

    const Push = window.PushNotifications;
    const isSupported = Push.isSupported();
    
    if (!isSupported) {
      console.log('[NotificationBell] Push not supported, not showing bell');
      return;
    }

    const permission = Push.getPermissionState();
    const isSubscribed = await Push.isSubscribed();

    // Determine status
    let dotClass = 'inactive';
    if (permission === 'denied') {
      dotClass = 'inactive';
    } else if (isSubscribed) {
      dotClass = 'active';
    } else if (permission === 'default') {
      dotClass = 'permission-needed';
    }

    widget.innerHTML = `
      <div class="notification-bell-panel" id="notification-bell-panel">
        <div class="notification-bell-panel-header">
          <h4>🔔 Notifications</h4>
          <button class="notification-bell-close" aria-label="Close">×</button>
        </div>
        <div class="notification-bell-panel-content" id="notification-bell-prefs">
          <!-- Preferences loaded here -->
        </div>
      </div>
      <button class="notification-bell-btn ${isSubscribed ? 'subscribed' : ''}" aria-label="Notification settings">
        <span>${isSubscribed ? '🔔' : '🔕'}</span>
        <span class="notification-bell-dot ${dotClass}"></span>
      </button>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const bellBtn = widget.querySelector('.notification-bell-btn');
    const panel = widget.querySelector('.notification-bell-panel');
    const closeBtn = widget.querySelector('.notification-bell-close');
    const prefsContainer = widget.querySelector('#notification-bell-prefs');

    let panelOpen = false;

    bellBtn.addEventListener('click', async () => {
      panelOpen = !panelOpen;
      panel.classList.toggle('open', panelOpen);
      
      if (panelOpen && window.NotificationPreferences) {
        // Render preferences in the panel
        await window.NotificationPreferences.render(prefsContainer, { showTestButton: false });
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panelOpen = false;
      panel.classList.remove('open');
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (panelOpen && !widget.contains(e.target)) {
        panelOpen = false;
        panel.classList.remove('open');
      }
    });

    // Update bell state when subscription changes
    window.addEventListener('push-subscription-changed', async () => {
      const newIsSubscribed = await Push.isSubscribed();
      const newPermission = Push.getPermissionState();
      
      bellBtn.classList.toggle('subscribed', newIsSubscribed);
      bellBtn.querySelector('span:first-child').textContent = newIsSubscribed ? '🔔' : '🔕';
      
      const dot = bellBtn.querySelector('.notification-bell-dot');
      dot.className = 'notification-bell-dot';
      
      if (newPermission === 'denied') {
        dot.classList.add('inactive');
      } else if (newIsSubscribed) {
        dot.classList.add('active');
      } else {
        dot.classList.add('permission-needed');
      }
    });

    console.log('[NotificationBell] Widget created');
  }

  // Initialize when DOM is ready
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        // Delay to ensure other scripts load first
        setTimeout(createBellWidget, 1500);
      });
    } else {
      setTimeout(createBellWidget, 1500);
    }
  }

  // Expose refresh function
  window.NotificationBell = {
    refresh: createBellWidget
  };

  init();

  console.log('[NotificationBell] Module loaded');
})();
