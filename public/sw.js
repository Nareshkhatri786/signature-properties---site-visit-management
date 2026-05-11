// Service Worker for Signature CRM
// Simplified to handle Push Notifications and avoid aggressive caching issues

// Push Notification Event
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'Notification', body: 'New update from Signature CRM' };
    
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: data.url || '/'
      },
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Open App' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (err) {
    console.error('[SW] Push error:', err);
  }
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open and focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Simple fetch listener to bypass cache
self.addEventListener('fetch', (event) => {
  // We do nothing, letting the browser handle fetching normally
  // This prevents stale assets from being served
});
