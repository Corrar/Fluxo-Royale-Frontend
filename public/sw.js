self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Quando o usuário clica na notificação no celular
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Fecha a notificação

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se a aba já estiver aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes('/requests') && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow('/requests');
      }
    })
  );
});