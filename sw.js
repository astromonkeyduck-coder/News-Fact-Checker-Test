/**
 * Service Worker for Noteworthy News
 * Provides offline support, caching, and faster page loads
 */

const CACHE_VERSION = 'v1.1.1-about-update';
const CACHE_NAME = `noteworthy-news-${CACHE_VERSION}`;

// Helper function to check if a URL is cacheable
function isCacheableUrl(url) {
  try {
    const urlObj = new URL(url);
    // Only cache http:// and https:// URLs
    // Skip chrome-extension://, file://, data:, blob:, etc.
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    // Invalid URL, don't cache
    return false;
  }
}

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
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

// Push notifications (if you add them later)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Noteworthy News';
  const options = {
    body: data.body || 'New breaking news update',
    icon: '/IMG_5794.PNG',
    badge: '/IMG_5794.PNG',
    tag: data.tag || 'news-update',
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

