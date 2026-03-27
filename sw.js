/**
 * Service Worker for Cortex Freelancer PWA
 * Handles caching, offline functionality, and background sync
 */

const CACHE_NAME = 'cortex-freelancer-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline functionality
const CACHE_URLS = [
  '/',
  '/app/demo.html',
  '/assets/css/app.css',
  '/assets/js/app.js',
  '/app/js/demo-workflow.js',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/offline.html',
  '/manifest.json'
];

// API endpoints to cache
const API_CACHE_URLS = [
  '/api/health',
  '/api/user/profile',
  '/api/analytics/dashboard'
];

// Network-first resources
const NETWORK_FIRST = [
  '/api/jobs/',
  '/api/chat/',
  '/api/ai/'
];

// Cache-first resources
const CACHE_FIRST = [
  '/assets/',
  '/icons/',
  '.png',
  '.jpg',
  '.css',
  '.js'
];

/**
 * Install event - cache essential resources
 */
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching app shell');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker installation failed:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle network requests with caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') return;
  
  event.respondWith(handleFetch(request));
});

/**
 * Handle fetch requests with appropriate caching strategy
 */
async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Network-first strategy for API calls
    if (isNetworkFirst(url.pathname)) {
      return await networkFirst(request);
    }
    
    // Cache-first strategy for static assets
    if (isCacheFirst(url.pathname)) {
      return await cacheFirst(request);
    }
    
    // Default: Network-first with cache fallback
    return await networkFirst(request);
    
  } catch (error) {
    console.error('❌ Fetch failed:', error);
    return await getCachedResponse(request) || createOfflineResponse(request);
  }
}

/**
 * Network-first strategy: try network, fallback to cache
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('🔄 Network failed, trying cache for:', request.url);
    return await getCachedResponse(request) || createOfflineResponse(request);
  }
}

/**
 * Cache-first strategy: try cache, fallback to network
 */
async function cacheFirst(request) {
  const cachedResponse = await getCachedResponse(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response));
        }
      })
      .catch(() => {}); // Ignore background update failures
    
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    return createOfflineResponse(request);
  }
}

/**
 * Get cached response if available
 */
async function getCachedResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  return await cache.match(request);
}

/**
 * Create offline response for failed requests
 */
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    return caches.match(OFFLINE_URL);
  }
  
  // Return cached API response or error
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Offline - cached data not available',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Generic offline response
  return new Response(
    'Resource not available offline',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    }
  );
}

/**
 * Check if URL should use network-first strategy
 */
function isNetworkFirst(pathname) {
  return NETWORK_FIRST.some(pattern => pathname.startsWith(pattern));
}

/**
 * Check if URL should use cache-first strategy
 */
function isCacheFirst(pathname) {
  return CACHE_FIRST.some(pattern => 
    pathname.startsWith(pattern) || pathname.includes(pattern)
  );
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-jobs') {
    event.waitUntil(syncJobApplications());
  }
  
  if (event.tag === 'background-sync-analytics') {
    event.waitUntil(syncAnalyticsData());
  }
});

/**
 * Sync job applications when back online
 */
async function syncJobApplications() {
  try {
    // Get pending applications from IndexedDB
    const pendingApplications = await getPendingApplications();
    
    for (const application of pendingApplications) {
      try {
        await fetch('/api/jobs/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(application)
        });
        
        // Remove from pending queue
        await removePendingApplication(application.id);
        
        console.log('✅ Synced job application:', application.id);
      } catch (error) {
        console.error('❌ Failed to sync application:', application.id, error);
      }
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

/**
 * Sync analytics data when back online
 */
async function syncAnalyticsData() {
  try {
    const pendingEvents = await getPendingAnalytics();
    
    if (pendingEvents.length > 0) {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: pendingEvents })
      });
      
      await clearPendingAnalytics();
      console.log('✅ Synced analytics events:', pendingEvents.length);
    }
  } catch (error) {
    console.error('❌ Analytics sync failed:', error);
  }
}

/**
 * Push notification handling
 */
self.addEventListener('push', (event) => {
  console.log('📬 Push message received');
  
  const options = {
    body: 'You have new job opportunities matching your skills!',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    data: { url: '/jobs' },
    actions: [
      {
        action: 'view-jobs',
        title: 'View Jobs'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true,
    tag: 'job-notification'
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      options.title = payload.title || 'Cortex Freelancer';
      options.body = payload.body || options.body;
      options.data = { ...options.data, ...payload.data };
    } catch (error) {
      console.error('❌ Error parsing push data:', error);
      options.title = 'Cortex Freelancer';
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(options.title || 'Cortex Freelancer', options)
  );
});

/**
 * Notification click handling
 */
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view-jobs') {
    event.waitUntil(
      self.clients.openWindow('/jobs')
    );
  } else if (event.action !== 'dismiss') {
    // Default action - open app
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      self.clients.openWindow(url)
    );
  }
});

/**
 * Message handling for communication with main thread
 */
self.addEventListener('message', (event) => {
  console.log('💬 Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
    return;
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
    return;
  }
});

// Utility functions for IndexedDB operations
// (These would be implemented with proper IndexedDB operations)

async function getPendingApplications() {
  // Implementation would use IndexedDB to get pending job applications
  return [];
}

async function removePendingApplication(id) {
  // Implementation would remove application from IndexedDB
}

async function getPendingAnalytics() {
  // Implementation would get pending analytics events from IndexedDB
  return [];
}

async function clearPendingAnalytics() {
  // Implementation would clear analytics events from IndexedDB
}

console.log('🎯 Cortex Freelancer Service Worker loaded successfully');