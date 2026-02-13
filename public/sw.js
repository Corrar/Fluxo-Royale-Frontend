// public/sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { 
    title: 'Nova Solicitação', 
    body: 'Há um novo pedido no almoxarifado.',
    url: '/requests',
    tag: 'fluxo-alert-requests' 
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // 🔥 CORREÇÃO: Verifica se o app já está aberto para não duplicar o som
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const isAppFocused = clientList.some((client) => client.focused);

      // Se o app estiver focado, NÃO faz nada (o SocketContext cuidará disso)
      if (isAppFocused) {
        return;
      }

      const options = {
        body: data.body,
        icon: '/favicon.png', 
        badge: '/favicon.png',
        vibrate: [500, 200, 500], 
        tag: data.tag, 
        renotify: true, 
        priority: 'high',
        data: { url: data.url },
        actions: [{ action: 'open', title: 'Ver Pedido' }]
      };

      return self.registration.showNotification(data.title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient.url !== urlToOpen) {
              return focusedClient.navigate(urlToOpen);
            }
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
