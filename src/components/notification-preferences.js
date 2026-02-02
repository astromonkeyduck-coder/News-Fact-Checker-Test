/**
 * Notification Preferences UI Component
 * Provides a beautiful UI for managing push notification preferences
 */

(function() {
  'use strict';

  // Styles for the notification preferences panel
  const STYLES = `
    .notification-prefs-container {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .notification-prefs-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .notification-prefs-header h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: white;
    }

    .notification-prefs-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .notification-prefs-status.enabled {
      background: rgba(46, 204, 113, 0.2);
      color: #2ECC71;
    }

    .notification-prefs-status.disabled {
      background: rgba(231, 76, 60, 0.2);
      color: #E74C3C;
    }

    .notification-prefs-status.unsupported {
      background: rgba(241, 196, 15, 0.2);
      color: #F1C40F;
    }

    .notification-prefs-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse-dot 2s infinite;
    }

    .notification-prefs-status.enabled .notification-prefs-status-dot {
      background: #2ECC71;
    }

    .notification-prefs-status.disabled .notification-prefs-status-dot {
      background: #E74C3C;
    }

    .notification-prefs-status.unsupported .notification-prefs-status-dot {
      background: #F1C40F;
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .notification-prefs-main-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: linear-gradient(135deg, rgba(74, 144, 226, 0.15), rgba(46, 204, 113, 0.15));
      border: 1px solid rgba(74, 144, 226, 0.3);
      border-radius: 12px;
      margin-bottom: 20px;
    }

    .notification-prefs-main-toggle-text h4 {
      margin: 0 0 4px 0;
      font-size: 1rem;
      font-weight: 600;
      color: white;
    }

    .notification-prefs-main-toggle-text p {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .notification-prefs-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .notification-pref-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      transition: all 0.2s ease;
    }

    .notification-pref-item:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .notification-pref-item.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .notification-pref-info {
      flex: 1;
    }

    .notification-pref-info h5 {
      margin: 0 0 2px 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .notification-pref-info p {
      margin: 0;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
    }

    .notification-pref-badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(241, 196, 15, 0.2);
      color: #F1C40F;
      font-weight: 600;
    }

    /* Toggle Switch Styles */
    .notification-toggle {
      position: relative;
      width: 48px;
      height: 26px;
      flex-shrink: 0;
    }

    .notification-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .notification-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.15);
      transition: 0.3s;
      border-radius: 26px;
    }

    .notification-toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 3px;
      bottom: 3px;
      background: white;
      transition: 0.3s;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .notification-toggle input:checked + .notification-toggle-slider {
      background: linear-gradient(135deg, #4A90E2, #2ECC71);
    }

    .notification-toggle input:checked + .notification-toggle-slider:before {
      transform: translateX(22px);
    }

    .notification-toggle input:disabled + .notification-toggle-slider {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Subscribe Button */
    .notification-subscribe-btn {
      width: 100%;
      padding: 14px 20px;
      margin-top: 20px;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .notification-subscribe-btn.subscribe {
      background: linear-gradient(135deg, #4A90E2, #2ECC71);
      color: white;
    }

    .notification-subscribe-btn.subscribe:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(74, 144, 226, 0.4);
    }

    .notification-subscribe-btn.unsubscribe {
      background: rgba(231, 76, 60, 0.15);
      color: #E74C3C;
      border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .notification-subscribe-btn.unsubscribe:hover {
      background: rgba(231, 76, 60, 0.25);
    }

    .notification-subscribe-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .notification-test-btn {
      margin-top: 12px;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .notification-test-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    /* Permission denied message */
    .notification-permission-denied {
      padding: 16px;
      background: rgba(231, 76, 60, 0.1);
      border: 1px solid rgba(231, 76, 60, 0.3);
      border-radius: 10px;
      margin-top: 16px;
    }

    .notification-permission-denied p {
      margin: 0 0 12px 0;
      color: #E74C3C;
      font-size: 0.9rem;
    }

    .notification-permission-denied a {
      color: #4A90E2;
      text-decoration: underline;
    }
  `;

  // Inject styles
  function injectStyles() {
    if (document.getElementById('notification-prefs-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'notification-prefs-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  /**
   * Render notification preferences panel
   * @param {string|HTMLElement} container - Container element or selector
   * @param {Object} options - Configuration options
   */
  async function render(container, options = {}) {
    injectStyles();

    const containerEl = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;

    if (!containerEl) {
      console.error('[NotificationPrefs] Container not found');
      return;
    }

    // Check if PushNotifications is available
    if (!window.PushNotifications) {
      containerEl.innerHTML = `
        <div class="notification-prefs-container">
          <p style="color: rgba(255,255,255,0.6);">Loading notification settings...</p>
        </div>
      `;
      // Wait for it to load
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!window.PushNotifications) {
        containerEl.innerHTML = `
          <div class="notification-prefs-container">
            <p style="color: #E74C3C;">Push notifications module not loaded.</p>
          </div>
        `;
        return;
      }
    }

    const Push = window.PushNotifications;
    const isSupported = Push.isSupported();
    const permission = Push.getPermissionState();
    const isSubscribed = await Push.isSubscribed();
    const preferences = Push.getLocalPreferences();
    const notificationTypes = Push.getNotificationTypes();

    // Status badge
    let statusClass, statusText;
    if (!isSupported) {
      statusClass = 'unsupported';
      statusText = 'Not Supported';
    } else if (permission === 'denied') {
      statusClass = 'disabled';
      statusText = 'Blocked';
    } else if (isSubscribed) {
      statusClass = 'enabled';
      statusText = 'Active';
    } else {
      statusClass = 'disabled';
      statusText = 'Inactive';
    }

    // Build HTML
    let html = `
      <div class="notification-prefs-container">
        <div class="notification-prefs-header">
          <h3>🔔 Push Notifications</h3>
          <span class="notification-prefs-status ${statusClass}">
            <span class="notification-prefs-status-dot"></span>
            ${statusText}
          </span>
        </div>
    `;

    if (!isSupported) {
      html += `
        <p style="color: rgba(255,255,255,0.6);">
          Your browser doesn't support push notifications. Try using Chrome, Firefox, or Edge.
        </p>
      </div>`;
      containerEl.innerHTML = html;
      return;
    }

    if (permission === 'denied') {
      html += `
        <div class="notification-permission-denied">
          <p>⚠️ Notifications are blocked for this site.</p>
          <p>To enable notifications, click the lock icon in your browser's address bar and allow notifications.</p>
        </div>
      </div>`;
      containerEl.innerHTML = html;
      return;
    }

    // Main subscribe/unsubscribe section
    if (!isSubscribed) {
      html += `
        <div class="notification-prefs-main-toggle">
          <div class="notification-prefs-main-toggle-text">
            <h4>Enable Notifications</h4>
            <p>Get instant alerts for breaking news and updates</p>
          </div>
        </div>
        <button class="notification-subscribe-btn subscribe" id="notification-subscribe-btn">
          <span>🔔</span> Enable Push Notifications
        </button>
      </div>`;
      containerEl.innerHTML = html;
      
      // Add click handler
      document.getElementById('notification-subscribe-btn').addEventListener('click', async () => {
        const btn = document.getElementById('notification-subscribe-btn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Enabling...';
        
        const result = await Push.subscribe();
        
        if (result.success) {
          // Re-render with updated state
          render(container, options);
        } else {
          btn.disabled = false;
          btn.innerHTML = '<span>🔔</span> Enable Push Notifications';
          alert(result.error || 'Failed to enable notifications');
        }
      });
      return;
    }

    // Show preferences when subscribed
    html += `
      <div class="notification-prefs-list">
    `;

    // Add each notification type
    const typeIcons = {
      'breaking-news': '🚨',
      'earthquake': '🌍',
      'weather': '⛈️',
      'website-update': '✨'
    };

    for (const type of notificationTypes) {
      const icon = typeIcons[type.id] || '📢';
      const badge = type.id === 'website-update' ? '<span class="notification-pref-badge">Max 1/day</span>' : '';
      
      html += `
        <div class="notification-pref-item" data-type="${type.id}">
          <div class="notification-pref-info">
            <h5>${icon} ${type.label} ${badge}</h5>
            <p>${type.description}</p>
          </div>
          <label class="notification-toggle">
            <input type="checkbox" ${type.enabled ? 'checked' : ''} data-pref="${type.id}">
            <span class="notification-toggle-slider"></span>
          </label>
        </div>
      `;
    }

    html += `
      </div>
      <button class="notification-subscribe-btn unsubscribe" id="notification-unsubscribe-btn">
        <span>🔕</span> Turn Off Notifications
      </button>
    `;

    if (options.showTestButton) {
      html += `
        <button class="notification-test-btn" id="notification-test-btn">
          Send Test Notification
        </button>
      `;
    }

    html += `</div>`;
    containerEl.innerHTML = html;

    // Add preference toggle handlers
    containerEl.querySelectorAll('[data-pref]').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const type = e.target.dataset.pref;
        const enabled = e.target.checked;
        await Push.updatePreference(type, enabled);
      });
    });

    // Add unsubscribe handler
    document.getElementById('notification-unsubscribe-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('notification-unsubscribe-btn');
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Disabling...';
      
      const result = await Push.unsubscribe();
      
      if (result.success) {
        render(container, options);
      } else {
        btn.disabled = false;
        btn.innerHTML = '<span>🔕</span> Turn Off Notifications';
        alert(result.error || 'Failed to disable notifications');
      }
    });

    // Add test button handler
    document.getElementById('notification-test-btn')?.addEventListener('click', () => {
      Push.testNotification('breaking-news');
    });
  }

  // Expose component globally
  window.NotificationPreferences = {
    render
  };

  console.log('[NotificationPrefs] Component loaded');
})();
