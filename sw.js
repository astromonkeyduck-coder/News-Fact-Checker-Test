/**
 * Service Worker for Noteworthy News
 * Provides offline support, caching, and faster page loads
 */

const CACHE_VERSION = 'v2.1.1-admin-sw';
const CACHE_NAME = `noteworthy-news-${CACHE_VERSION}`;

// Helper function to check if a URL is cacheable
function isCacheableUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/v2/index.html',
  '/v2/styles/tokens.css',
  '/v2/styles/base.css',
  '/v2/styles/layout.css',
  '/v2/styles/components.css',
  '/v2/js/main.js',
  '/v2/js/feed.js',
  '/v2/js/auth.js',
  '/game.html',
  '/geography-game.html',
  '/geography-game.js',
  '/logo.svg',
  '/site.webmanifest',
  '/IMG_5794.PNG',
  '/PREVIEWIMAGEBRUH.jpg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Netlify Functions entirely - they're serverless and shouldn't be cached
  if (url.pathname.startsWith('/.netlify/functions/')) {
    // Let the request pass through to the network without service worker interception
    return;
  }

  // Skip cross-origin requests (unless you want to cache them)
  if (url.origin !== location.origin) {
    // Cache external resources like fonts, images
    if (request.destination === 'font' || request.destination === 'image') {
      event.respondWith(
        caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return fetch(request)
              .then((response) => {
                // Don't cache if not successful
                if (!response || response.status !== 200 || response.type !== 'basic') {
                  return response;
                }
                // Only cache if URL is cacheable (http/https)
                if (isCacheableUrl(request.url)) {
                  // Clone the response
                  const responseToCache = response.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(request, responseToCache);
                    })
                    .catch((error) => {
                      // Silently fail if caching fails (e.g., chrome-extension URLs)
                      console.warn('[Service Worker] Failed to cache:', request.url, error);
                    });
                }
                return response;
              });
          })
      );
    }
    return;
  }

  // Admin shell (auth, API client): network-first so fixes deploy without stale SW cache.
  if (
    url.pathname.startsWith('/admin/') &&
    (request.destination === 'script' ||
      request.destination === 'style' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css'))
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic' && isCacheableUrl(request.url)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Strategy: Cache First, then Network
  // Good for: Static assets, images, fonts
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp')
  ) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((response) => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              // Only cache if URL is cacheable (http/https)
              if (isCacheableUrl(request.url)) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  })
                  .catch((error) => {
                    // Silently fail if caching fails (e.g., chrome-extension URLs)
                    console.warn('[Service Worker] Failed to cache:', request.url, error);
                  });
              }
              return response;
            });
        })
    );
    return;
  }

  // Strategy: Network First, then Cache
  // Good for: API calls, dynamic content
  // Note: Netlify Functions are already skipped above
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('posts-read')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses (200 OK) and ensure it's a valid Response
          if (response && response.status === 200 && response instanceof Response && isCacheableUrl(request.url)) {
            // Clone the response before caching
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              })
              .catch((error) => {
                // Silently fail if caching fails
                console.warn('[Service Worker] Failed to cache:', request.url, error);
              });
          }
          // Always return the response, even if it's an error
          // Ensure we return a valid Response object
          if (!(response instanceof Response)) {
            // If somehow we got a non-Response, create one
            return new Response(JSON.stringify({ error: 'Invalid response format' }), {
              status: 500,
              statusText: 'Internal Server Error',
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return response;
        })
        .catch((error) => {
          // Network failed, try cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return a proper error response if network fails and no cache
              return new Response(JSON.stringify({ 
                error: 'Network request failed',
                offline: true 
              }), {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
    return;
  }

  // Default: Network First, then Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Ensure we have a valid Response object
        if (!(response instanceof Response)) {
          return new Response(JSON.stringify({ error: 'Invalid response format' }), {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (response && response.status === 200 && isCacheableUrl(request.url)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            })
            .catch((error) => {
              // Silently fail if caching fails (e.g., chrome-extension URLs)
              console.warn('[Service Worker] Failed to cache:', request.url, error);
            });
        }
        return response;
      })
      .catch((error) => {
        // Return cached response if available, otherwise return error response
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a proper error response
            return new Response(JSON.stringify({ 
              error: 'Network request failed',
              offline: true 
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            });
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-newsletter') {
    event.waitUntil(syncNewsletter());
  }
});

async function syncNewsletter() {
  // Get pending newsletter subscriptions from IndexedDB
  // and sync them when back online
  console.log('[Service Worker] Syncing newsletter subscriptions');
}

// ===========================================
// PUSH NOTIFICATIONS
// ===========================================

// Notification type configurations
const NOTIFICATION_CONFIGS = {
  'breaking-news': {
    icon: '/IMG_5794.PNG',
    badge: '/IMG_5794.PNG',
    vibrate: [200, 100, 200, 100, 200], // Urgent pattern
    requireInteraction: true,
    actions: [
      { action: 'read', title: 'Read Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  },
  'earthquake': {
    icon: '/IMG_5794.PNG',
    badge: '/IMG_5794.PNG',
    vibrate: [300, 100, 300, 100, 300], // Very urgent pattern
    requireInteraction: true,
    actions: [
      { action: 'read', title: 'View Details' },
      { action: 'map', title: 'Open Map' }
    ]
  },
  'weather': {
    icon: '/IMG_5794.PNG',
    badge: '/IMG_5794.PNG',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'read', title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  },
  'website-update': {
    icon: '/IMG_5794.PNG',
    badge: '/IMG_5794.PNG',
    vibrate: [100],
    requireInteraction: false,
    actions: [
      { action: 'read', title: 'See Updates' },
      { action: 'dismiss', title: 'Later' }
    ]
  },
  'default': {
    icon: '/IMG_5794.PNG',
    badge: '/IMG_5794.PNG',
    vibrate: [100, 50, 100],
    requireInteraction: false,
    actions: []
  }
};

// Push event handler - receives push notifications from server
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('[Service Worker] Failed to parse push data:', e);
    data = { title: 'Noteworthy News', body: event.data?.text() || 'New update available' };
  }

  const notificationType = data.type || 'default';
  const config = NOTIFICATION_CONFIGS[notificationType] || NOTIFICATION_CONFIGS['default'];
  
  const title = data.title || 'Noteworthy News';
  const options = {
    body: data.body || 'New breaking news update',
    icon: data.icon || config.icon,
    badge: data.badge || config.badge,
    tag: data.tag || `noteworthy-${notificationType}-${Date.now()}`,
    vibrate: config.vibrate,
    requireInteraction: config.requireInteraction,
    actions: config.actions,
    data: {
      url: data.url || '/',
      type: notificationType,
      id: data.id || null,
      mapUrl: data.mapUrl || null,
      timestamp: Date.now()
    },
    // Rich notification features
    image: data.image || null, // Large image for the notification
    silent: data.silent || false
  };

  // Remove null values
  Object.keys(options).forEach(key => {
    if (options[key] === null) delete options[key];
  });

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler - handles both notification body clicks and action clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let targetUrl = data.url || '/';
  
  // Handle different actions
  if (event.action === 'dismiss') {
    // Just close, don't open anything
    return;
  } else if (event.action === 'map' && data.mapUrl) {
    targetUrl = data.mapUrl;
  } else if (event.action === 'read' || !event.action) {
    // Default action - open the main URL
    targetUrl = data.url || '/';
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open with the target URL
        for (const client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Check if there's any Noteworthy News window open
        for (const client of windowClients) {
          if (client.url.includes('noteworthynews.co') && 'focus' in client) {
            // Navigate to the target URL and focus
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Notification close handler - track dismissals for analytics
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  console.log('[Service Worker] Notification closed:', data.type, data.id);
  
  // Could send analytics here if needed
});
