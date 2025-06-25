// AnoChat Service Worker - Anonymous E2EE Chat PWA
// Security hardened - no logging in production

const CACHE_NAME = 'anochat-v1';
const OFFLINE_URL = '/offline.html';

// Core files that should always be cached
const CORE_CACHE_FILES = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/_next/static/css/app/layout.css',
  '/_next/static/chunks/pages/_app.js',
  '/_next/static/chunks/main.js',
  '/icon-192.png',
  '/icon-512.png'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Always go to network first, fallback to cache
  NETWORK_FIRST: 'network-first',
  // Always check cache first, fallback to network  
  CACHE_FIRST: 'cache-first',
  // Cache only (for offline pages)
  CACHE_ONLY: 'cache-only'
};

// Install event - cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CORE_CACHE_FILES);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Skip Supabase requests - always go to network for real-time data
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // If both cache and network fail, serve offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      })
  );
});

// Background sync for offline message queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processOfflineMessages());
  }
});

// Process offline messages
async function processOfflineMessages() {
  try {
    const messages = await getOfflineMessages();
    for (const message of messages) {
      try {
        await sendOfflineMessage(message);
        await removeOfflineMessage(message.id);
      } catch (error) {
        // Message will remain in queue for next sync
        break;
      }
    }
  } catch (error) {
    // Handle error silently in production
  }
}

// Get offline messages from IndexedDB
async function getOfflineMessages() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AnoChat', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['offlineMessages'], 'readonly');
      const store = transaction.objectStore('offlineMessages');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
      };
      
      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Send offline message
async function sendOfflineMessage(message) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

// Remove offline message after successful send
async function removeOfflineMessage(messageId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AnoChat', 1);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['offlineMessages'], 'readwrite');
      const store = transaction.objectStore('offlineMessages');
      const deleteRequest = store.delete(messageId);
      
      deleteRequest.onsuccess = () => {
        resolve();
      };
      
      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  
  const options = {
    body: 'New encrypted message received',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'anochat-message',
    requireInteraction: false,
    silent: true, // Silent for anonymity
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('AnoChat', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
}); 