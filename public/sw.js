// public/sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // Estado base (Fallback) caso o payload venha incompleto
  let data = { 
    title: 'Nova Solicitação', 
    body: 'Há um novo pedido pendente no sistema.',
    url: '/requests',
    tag: `fluxo-alert-${Date.now()}` // Fallback dinâmico em vez de fixo
  };

  // 🔥 1. Lê a payload enviada pelo nosso novo backend (que agora traz o ID único na TAG)
  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json }; 
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Verifica se alguma aba do sistema está aberta E visível (em foco)
      const isAppFocused = clientList.some((client) => client.focused);

      // 🔥 2. DEDUPLICAÇÃO SUPREMA: 
      // Se o utilizador estiver com o ecrã focado na aplicação, o Socket.io já vai
      // cuidar da notificação (mostrando a Toast no ecrã e tocando o som).
      // Por isso, dizemos ao Service Worker (Push Nativo) para cancelar e ficar calado!
      if (isAppFocused) {
        console.log("🚫 [SW] App em foco. Push nativo cancelado para evitar som duplo.");
        return;
      }

      // Se a app estiver fechada ou em 2º plano (noutra aba), o SW assume o controlo:
      const options = {
        body: data.body,
        icon: data.icon || '/favicon.png', 
        badge: '/favicon.png',
        vibrate: [300], // 🔥 Apenas UMA vibração padrão e suave (300ms)
        tag: data.tag, // Usa o ID único vindo do backend para evitar repetições no SO
        renotify: true, 
        priority: data.priority || 'high',
        data: { url: data.url || '/requests' },
        actions: [{ action: 'open', title: 'Ver Pedido' }]
      };

      return self.registration.showNotification(data.title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  // Fecha a notificação nativa quando o utilizador clica nela
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Tenta encontrar uma aba que já esteja aberta com o sistema
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            // Se a aba aberta não estiver na página de destino, redireciona-a
            if (focusedClient.url !== urlToOpen) {
              return focusedClient.navigate(urlToOpen);
            }
          });
        }
      }
      // 2. Se a aplicação estiver totalmente fechada, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
