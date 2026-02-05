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
    url: '/requests',
    tag: 'fluxo-alert-requests' // Tag padrão caso o backend não mande
  };

  // Tenta ler os dados enviados pelo servidor (server.ts)
  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json }; // Mescla os dados padrão com os do servidor
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png', 
    badge: '/favicon.png',
    
    // Vibração forte para chamar atenção
    vibrate: [500, 200, 500], 
    
    // 🔥 IMPORTANTE: Usa a tag do backend ou a padrão para AGRUPAR
    tag: data.tag, 
    
    // 🔥 IMPORTANTE: Vibra novamente mesmo sendo a mesma tag (substituição)
    renotify: true, 
    
    // Tenta prioridade alta no Android (ajuda a acordar a tela em alguns casos)
    priority: 'high',
    
    data: {
      url: data.url
    },
    actions: [
      { action: 'open', title: 'Ver Pedido' }
    ]
  };

  // Mostra a notificação
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação: Lógica inteligente de foco
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Monta a URL completa
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Procura se o app já está aberto em QUALQUER aba
      for (const client of clientList) {
        // Se encontrou uma janela e pode focar
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            // Depois de focar, navega para a página certa caso não esteja nela
            if (focusedClient.url !== urlToOpen) {
              return focusedClient.navigate(urlToOpen);
            }
          });
        }
      }

      // 2. Se não encontrou nenhuma janela aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
