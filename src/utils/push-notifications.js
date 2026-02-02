/**
 * Push Notifications Manager for Noteworthy News
 * Handles browser push notification subscriptions and preferences
 */

(function() {
  'use strict';

  // VAPID public key - will be fetched from server
  let VAPID_PUBLIC_KEY = null;

  // Notification types and their defaults
  const NOTIFICATION_TYPES = {
    'breaking-news': { label: 'Breaking News', default: true, description: 'Major breaking news alerts' },
    'earthquake': { label: 'Earthquakes', default: true, description: 'Significant earthquake alerts (M4.5+)' },
    'weather': { label: 'Weather Alerts', default: false, description: 'Severe weather warnings in your area' },
    'website-update': { label: 'Website Updates', default: true, description: 'New features and site updates (max 1/day)' }
  };

  // Local storage keys
  const STORAGE_KEYS = {
    subscription: 'noteworthy-push-subscription',
    preferences: 'noteworthy-push-preferences',
    vapidKey: 'noteworthy-vapid-key'
  };

  /**
   * Check if push notifications are supported
   */
  function isSupported() {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  /**
   * Get current notification permission state
   */
  function getPermissionState() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission; // 'granted', 'denied', or 'default'
  }

  /**
   * Request notification permission from user
   */
  async function requestPermission() {
    if (!isSupported()) {
      console.warn('[Push] Push notifications not supported');
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission result:', permission);
      return permission;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      return 'denied';
    }
  }

  /**
   * Get VAPID public key from server
   */
  async function getVapidKey() {
    // Check cache first
    if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
    
    const cached = localStorage.getItem(STORAGE_KEYS.vapidKey);
    if (cached) {
      VAPID_PUBLIC_KEY = cached;
      return cached;
    }

    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const endpoint = isLocalhost 
        ? 'http://localhost:8888/.netlify/functions/push-subscribe?action=vapid-key'
        : '/.netlify/functions/push-subscribe?action=vapid-key';
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch VAPID key');
      
      const data = await response.json();
      VAPID_PUBLIC_KEY = data.vapidKey;
      localStorage.setItem(STORAGE_KEYS.vapidKey, VAPID_PUBLIC_KEY);
      return VAPID_PUBLIC_KEY;
    } catch (error) {
      console.error('[Push] Error fetching VAPID key:', error);
      return null;
    }
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Subscribe to push notifications
   */
  async function subscribe() {
    if (!isSupported()) {
      return { success: false, error: 'Push notifications not supported' };
    }

    // Request permission first
    const permission = await requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied', permission };
    }

    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID key
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        return { success: false, error: 'Could not get VAPID key' };
      }

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        console.log('[Push] New subscription created');
      } else {
        console.log('[Push] Using existing subscription');
      }

      // Save to server
      const result = await saveSubscriptionToServer(subscription);
      
      if (result.success) {
        // Save locally
        localStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify(subscription.toJSON()));
        console.log('[Push] Subscription saved successfully');
      }

      return { success: true, subscription };
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async function unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();
        
        // Remove from server
        await removeSubscriptionFromServer(subscription);
        
        // Clear local storage
        localStorage.removeItem(STORAGE_KEYS.subscription);
        
        console.log('[Push] Unsubscribed successfully');
      }

      return { success: true };
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if currently subscribed
   */
  async function isSubscribed() {
    if (!isSupported()) return false;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Get current subscription
   */
  async function getSubscription() {
    if (!isSupported()) return null;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch (error) {
      console.error('[Push] Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Save subscription to server
   */
  async function saveSubscriptionToServer(subscription) {
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const endpoint = isLocalhost 
        ? 'http://localhost:8888/.netlify/functions/push-subscribe'
        : '/.netlify/functions/push-subscribe';

      // Get user info if authenticated
      let userEmail = null;
      if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
        try {
          const isAuth = window.auth0.isAuthenticated();
          if (isAuth && typeof window.auth0.getUser === 'function') {
            const user = await window.auth0.getUser();
            userEmail = user?.email;
          }
        } catch (e) {
          // Continue without user info
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          subscription: subscription.toJSON(),
          userEmail,
          preferences: getLocalPreferences()
        })
      });

      if (!response.ok) throw new Error('Server error');
      
      return await response.json();
    } catch (error) {
      console.error('[Push] Error saving subscription to server:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove subscription from server
   */
  async function removeSubscriptionFromServer(subscription) {
    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const endpoint = isLocalhost 
        ? 'http://localhost:8888/.netlify/functions/push-subscribe'
        : '/.netlify/functions/push-subscribe';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unsubscribe',
          subscription: subscription.toJSON()
        })
      });

      return response.ok;
    } catch (error) {
      console.error('[Push] Error removing subscription from server:', error);
      return false;
    }
  }

  /**
   * Get notification preferences from local storage
   */
  function getLocalPreferences() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.preferences);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Return defaults
    }

    // Return defaults
    const defaults = {};
    Object.entries(NOTIFICATION_TYPES).forEach(([key, config]) => {
      defaults[key] = config.default;
    });
    return defaults;
  }

  /**
   * Save notification preferences
   */
  async function savePreferences(preferences) {
    // Save locally
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));

    // Sync to server if subscribed
    const subscription = await getSubscription();
    if (subscription) {
      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const endpoint = isLocalhost 
          ? 'http://localhost:8888/.netlify/functions/notification-preferences'
          : '/.netlify/functions/notification-preferences';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            preferences
          })
        });

        if (response.ok) {
          console.log('[Push] Preferences synced to server');
        }
      } catch (error) {
        console.error('[Push] Error syncing preferences:', error);
      }
    }

    return { success: true, preferences };
  }

  /**
   * Update a single preference
   */
  async function updatePreference(type, enabled) {
    const preferences = getLocalPreferences();
    preferences[type] = enabled;
    return savePreferences(preferences);
  }

  /**
   * Get all available notification types with their current state
   */
  function getNotificationTypes() {
    const preferences = getLocalPreferences();
    return Object.entries(NOTIFICATION_TYPES).map(([key, config]) => ({
      id: key,
      label: config.label,
      description: config.description,
      enabled: preferences[key] ?? config.default,
      default: config.default
    }));
  }

  /**
   * Test notification (for debugging)
   */
  async function testNotification(type = 'breaking-news') {
    if (!isSupported()) {
      alert('Push notifications not supported');
      return;
    }

    const permission = getPermissionState();
    if (permission !== 'granted') {
      alert('Please enable notifications first');
      return;
    }

    // Use service worker to show notification
    const registration = await navigator.serviceWorker.ready;
    
    const testData = {
      'breaking-news': {
        title: '🚨 BREAKING: Test Alert',
        body: 'This is a test breaking news notification from Noteworthy News',
        url: '/'
      },
      'earthquake': {
        title: '🌍 Earthquake Alert: M5.2',
        body: 'A magnitude 5.2 earthquake detected near Test Location',
        url: '/situation-monitor.html',
        mapUrl: '/situation-monitor.html'
      },
      'weather': {
        title: '⛈️ Severe Weather Alert',
        body: 'Thunderstorm warning for your area',
        url: '/situation-monitor.html'
      },
      'website-update': {
        title: '✨ New on Noteworthy News',
        body: 'Check out our latest feature: Push Notifications!',
        url: '/'
      }
    };

    const data = testData[type] || testData['breaking-news'];
    
    registration.showNotification(data.title, {
      body: data.body,
      icon: '/IMG_5794.PNG',
      badge: '/IMG_5794.PNG',
      tag: `test-${type}-${Date.now()}`,
      data: { url: data.url, type, mapUrl: data.mapUrl }
    });
  }

  // Expose API globally
  window.PushNotifications = {
    isSupported,
    getPermissionState,
    requestPermission,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscription,
    getLocalPreferences,
    savePreferences,
    updatePreference,
    getNotificationTypes,
    testNotification,
    NOTIFICATION_TYPES
  };

  // Log initialization
  console.log('[Push] Push notifications manager initialized', {
    supported: isSupported(),
    permission: getPermissionState()
  });

})();
