const CACHE_NAME = 'kid-friendly-ai-v2';
const STATIC_CACHE_NAME = 'kid-friendly-ai-static-v2';
const DYNAMIC_CACHE_NAME = 'kid-friendly-ai-dynamic-v2';
const IMAGE_CACHE_NAME = 'kid-friendly-ai-images-v2';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/api/health',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/framework.js',
  '/_next/static/chunks/pages/_app.js',
  '/_next/static/chunks/pages/index.js',
  '/_next/static/css/app.css'
];

// API endpoints that should use network-first strategy
const NETWORK_FIRST_APIS = [
  '/api/ask',
  '/api/tts'
];

// Cache strategies for different types of content
const getCacheStrategy = (request) => {
  const url = new URL(request.url);

  // API endpoints
  if (url.pathname.startsWith('/api/')) {
    if (NETWORK_FIRST_APIS.includes(url.pathname)) {
      return networkFirst;
    }
    return cacheFirst;
  }

  // Static assets
  if (request.destination === 'script' || request.destination === 'style') {
    return cacheFirst;
  }

  // Images
  if (request.destination === 'image') {
    return imageCache;
  }

  // Navigation
  if (request.mode === 'navigate') {
    return networkFirst;
  }

  // Default
  return cacheFirst;
};

// Cache strategies
const cacheFirst = async (request, cacheName = STATIC_CACHE_NAME) => {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, network.clone());
    }
    return network;
  } catch (error) {
    console.log('Cache first strategy failed:', error);
    throw error;
  }
};

const networkFirst = async (request) => {
  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, network.clone());
    }
    return network;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
};

const imageCache = async (request) => {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      cache.put(request, network.clone());
    }
    return network;
  } catch (error) {
    console.log('Image cache failed:', error);
    throw error;
  }
};

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME &&
              cacheName !== IMAGE_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-HTTP requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Use appropriate cache strategy
  const strategy = getCacheStrategy(event.request);
  event.respondWith(strategy(event.request));
});

// Handle offline fallback for API requests
const offlineFallback = async (request) => {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // For API requests, return a custom offline response
    if (request.url.startsWith('/api/')) {
      return new Response(JSON.stringify({
        error: 'offline',
        message: 'You are currently offline. Please check your internet connection.',
        timestamp: Date.now()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'X-Offline': 'true'
        }
      });
    }

    // For other requests, return a generic offline page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Kid-Friendly AI</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .offline-icon { font-size: 48px; margin-bottom: 20px; }
            .message { color: #666; margin-bottom: 30px; }
            .retry-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="offline-icon">📵</div>
          <h1>You're Offline</h1>
          <p class="message">Please check your internet connection and try again.</p>
          <button class="retry-btn" onclick="window.location.reload()">Retry</button>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error) {
    console.error('Offline fallback failed:', error);
    return new Response('Offline', { status: 503 });
  }
};

// Handle background sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync' || event.tag === 'sync-operations') {
    event.waitUntil(
      (async () => {
        console.log('Background sync triggered');

        // Notify clients about sync
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'sync_request',
            timestamp: Date.now()
          });
        });
      })()
    );
  }
});

// Handle push notifications (if needed in future)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png'
      })
    );
  }
});