// public/sw.js

// Instalação e ativação imediata para garantir controle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 🔥 OUVINTE DE PUSH: É isto que funciona com o app FECHADO
self.addEventListener('push', (event) => {
  let data = { 
    title: 'Nova Solicitação', 
    body: 'Há um novo pedido no almoxarifado.',
    url: '/requests' 
  };

  // Tenta ler os dados enviados pelo servidor (server.ts)
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png', // Ícone da notificação (certifique-se que existe)
    badge: '/favicon.png', // Ícone pequeno para a barra de status (Android)
    vibrate: [200, 100, 200], // Padrão de vibração
    tag: 'request-notification', // Evita empilhar muitas notificações iguais
    renotify: true, // Vibra novamente mesmo se já houver uma notificação lá
    data: {
      url: data.url || '/requests'
    },
    actions: [
      { action: 'open', title: 'Ver Pedido' }
    ]
  };

  // Mostra a notificação no sistema operativo
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação: Abre o app na página certa
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se o app já estiver aberto (mesmo em segundo plano), foca nele
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Se estiver FECHADO, abre uma nova janela/aba
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
