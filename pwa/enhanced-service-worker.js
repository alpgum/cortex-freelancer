// CFX-030: Enhanced Service Worker for Cortex Freelancer
// Progressive Web App with offline-first capabilities

const CACHE_VERSION = 6;
const CACHE_NAME = `cortex-v${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';
const CHAT_CACHE = 'cortex-chat-v1';
const QUEUE_NAME = 'cortex-message-queue';

// App Shell - Critical files for offline functionality
const APP_SHELL = [
  '/',
  '/offline.html',
  '/app/index.html',
  '/app/chat.html',
  '/app/tools/index.html',
  '/app/tools/rate-calculator.html',
  '/app/tools/invoice.html',
  '/app/tools/proposal.html',
  '/app/css/chat.css',
  '/app/js/chat.js',
  '/app/js/profile-bridge.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

// API routes that should never be cached
const API_ROUTES = [
  '/api/',
  '/__/',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'google-analytics.com',
  'googletagmanager.com',
  'sentry.io',
  'stripe.com'
];

// Message queue for offline chat messages
class MessageQueue {
  constructor() {
    this.queue = [];
    this.init();
  }

  async init() {
    const stored = await this.getStoredQueue();
    this.queue = stored || [];
  }

  async add(message) {
    const queueItem = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      message: message,
      retries: 0,
      status: 'pending'
    };
    
    this.queue.push(queueItem);
    await this.saveQueue();

    // Background Sync will flush this queue when connectivity returns.
    // (Service Worker can't reliably read navigator.onLine.)

    return queueItem;
  }

  async processQueue() {
    const pendingMessages = this.queue.filter(item => item.status === 'pending');
    
    for (const item of pendingMessages) {
      try {
        await this.sendMessage(item);
        item.status = 'sent';
      } catch (error) {
        item.retries++;
        if (item.retries >= 3) {
          item.status = 'failed';
        }
        console.log(`Failed to send message ${item.id}, retry ${item.retries}`);
      }
    }
    
    await this.saveQueue();
    
    // Notify clients about queue updates
    this.notifyClients('queue-updated', {
      pending: this.queue.filter(item => item.status === 'pending').length,
      failed: this.queue.filter(item => item.status === 'failed').length
    });
  }

  async sendMessage(queueItem) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queueItem.message)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async getStoredQueue() {
    try {
      const cache = await caches.open(CHAT_CACHE);
      const response = await cache.match('/__sw/message-queue');
      if (response) {
        return await response.json();
      }
    } catch (error) {
      console.log('Error reading queue from cache:', error);
    }
    return [];
  }

  async saveQueue() {
    try {
      const cache = await caches.open(CHAT_CACHE);
      const response = new Response(JSON.stringify(this.queue), {
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.put('/__sw/message-queue', response);
    } catch (error) {
      console.log('Error saving queue to cache:', error);
    }
  }

  notifyClients(type, data) {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type, data });
      });
    });
  }
}

// Chat conversation cache management
class ChatCache {
  static async save(conversationId, messages) {
    try {
      const cache = await caches.open(CHAT_CACHE);
      const response = new Response(JSON.stringify(messages), {
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.put(`/__sw/conversation-${conversationId}`, response);
    } catch (error) {
      console.log('Error saving conversation:', error);
    }
  }

  static async get(conversationId) {
    try {
      const cache = await caches.open(CHAT_CACHE);
      const response = await cache.match(`/__sw/conversation-${conversationId}`);
      if (response) {
        return await response.json();
      }
    } catch (error) {
      console.log('Error loading conversation:', error);
    }
    return null;
  }

  static async list() {
    try {
      const cache = await caches.open(CHAT_CACHE);
      const keys = await cache.keys();
      return keys
        .map(req => req.url)
        .filter(url => url.includes('conversation-'))
        .map(url => url.split('conversation-')[1]);
    } catch (error) {
      console.log('Error listing conversations:', error);
    }
    return [];
  }
}

// Initialize message queue
const messageQueue = new MessageQueue();

// Utility functions
function isApiRoute(url) {
  return API_ROUTES.some(route => url.includes(route));
}

function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf)$/);
}

// Install event - cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(keys => {
        return Promise.all(
          keys
            .filter(key => key.startsWith('cortex-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        );
      }),
      // Take control of clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = request.url;

  // Only handle GET requests for most cases
  if (request.method !== 'GET' && !url.includes('/api/chat')) {
    return;
  }

  // Never cache API routes except for specific handling
  if (isApiRoute(url) && !url.includes('/api/chat')) {
    return;
  }

  // Handle chat API requests specially
  if (url.includes('/api/chat') && request.method === 'POST') {
    event.respondWith(handleChatRequest(request));
    return;
  }

  // Navigation requests - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Static assets - cache first with network fallback
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Other requests - network first with cache fallback
  event.respondWith(handleOtherRequests(request));
});

// Handle chat API requests
async function handleChatRequest(request) {
  try {
    const response = await fetch(request.clone());
    
    // If successful, save to conversation cache
    if (response.ok) {
      const data = await response.clone().json();
      
      // Extract conversation data if available
      if (data.conversationId && data.messages) {
        await ChatCache.save(data.conversationId, data.messages);
      }
    }
    
    return response;
  } catch (error) {
    // If offline, queue the message
    const requestData = await request.json();
    const queueItem = await messageQueue.add(requestData);
    
    // Return a placeholder response
    return new Response(JSON.stringify({
      success: false,
      queued: true,
      queueId: queueItem.id,
      message: 'Message queued for when connection returns'
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful navigation responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache first, then offline page
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    // Update cache in background (stale-while-revalidate)
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, response);
        });
      }
    }).catch(() => {
      // Ignore network errors for background updates
    });
    
    return cached;
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
    // Return generic offline response for missing assets
    return new Response('', { 
      status: 408, 
      statusText: 'Offline - Asset not available' 
    });
  }
}

// Handle other requests with network-first strategy
async function handleOtherRequests(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fallback to cache
    const cached = await caches.match(request);
    return cached || new Response('', { 
      status: 408, 
      statusText: 'Offline' 
    });
  }
}

// Background sync for message queue
self.addEventListener('sync', event => {
  if (event.tag === 'chat-sync') {
    event.waitUntil(messageQueue.processQueue());
  }
});

// Handle messages from clients
self.addEventListener('message', event => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'GET_QUEUE_STATUS':
      const pending = messageQueue.queue.filter(item => item.status === 'pending').length;
      const failed = messageQueue.queue.filter(item => item.status === 'failed').length;
      event.ports[0].postMessage({ pending, failed });
      break;
      
    case 'RETRY_FAILED_MESSAGES':
      messageQueue.queue.forEach(item => {
        if (item.status === 'failed') {
          item.status = 'pending';
          item.retries = 0;
        }
      });
      // Attempt immediately; if offline it will fail and remain pending.
      messageQueue.processQueue();
      break;
      
    case 'SAVE_CONVERSATION':
      ChatCache.save(data.conversationId, data.messages);
      break;

    case 'GET_CONVERSATION':
      var cid = (data && data.conversationId) || event.data.conversationId;
      ChatCache.get(cid).then(messages => {
        // Reply on MessagePort when provided
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(messages || []);
        }
      });
      break;
      
    case 'GET_CONVERSATIONS':
      ChatCache.list().then(conversations => {
        event.ports[0].postMessage({ conversations });
      });
      break;
  }
});

// Push notification handling (optional)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/app/chat.html'
    },
    actions: [
      {
        action: 'open',
        title: 'Open Chat'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cortex Freelancer', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/app/chat.html';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          // Check if chat is already open
          for (const client of clientList) {
            if (client.url.includes('/app/chat.html') && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Open new window if not found
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});