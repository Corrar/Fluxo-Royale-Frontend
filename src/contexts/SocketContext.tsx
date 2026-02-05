import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { api } from '@/services/api'; 

// Chave Pública VAPID
const VAPID_PUBLIC_KEY = "BMNY3LkuWRwc81P1xGvWiZ6-hzfu4kbkoh3V0gzJRiOn1ag0hv65VN4dm_ZlTf4TuowjljtzEnwti0d1oV1YHlA"; 

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  hasUnreadRequests: boolean; 
  unreadCount: number;        
  markRequestsAsRead: () => void;
  requestNotificationPermission: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  hasUnreadRequests: false,
  unreadCount: 0,
  markRequestsAsRead: () => {},
  requestNotificationPermission: () => {},
});

// Função utilitária para converter a chave VAPID
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updatePermissions } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // --- ESTADO DO CONTADOR ---
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const saved = localStorage.getItem('@fluxo:unreadCount');
    return saved ? parseInt(saved, 10) : 0;
  });

  const hasUnreadRequests = unreadCount > 0;

  const markRequestsAsRead = () => {
    setUnreadCount(0);
    localStorage.setItem('@fluxo:unreadCount', '0');
  };

  const incrementCount = () => {
    if (window.location.pathname !== '/requests') {
      setUnreadCount((prev) => {
        const newValue = prev + 1;
        localStorage.setItem('@fluxo:unreadCount', String(newValue));
        return newValue;
      });
    }
  };

  // --- REGISTRAR SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ SW registrado:', reg.scope))
        .catch(err => console.error('❌ Falha no SW:', err));
    }
  }, []);

  // --- NOTIFICAÇÃO DO SISTEMA (QUANDO O APP ESTÁ ABERTO) ---
  const sendSystemNotification = async (title: string, body: string) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const urgentVibration = [500, 200, 500, 200, 500];

    // Tenta usar o Service Worker para mostrar a notificação (mais estável)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          // CORREÇÃO AQUI: Adicionado 'as any' para evitar erro TS2353 no 'renotify'
          await registration.showNotification(title, {
            body: body,
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: "fluxo-alert-" + Date.now(),
            renotify: true,
            requireInteraction: true,
            vibrate: urgentVibration,
            data: { url: '/requests' }
          } as any); 
          return; 
        }
      } catch (e) { console.warn("SW notificação falhou", e); }
    }

    // Fallback para API nativa
    try {
      // CORREÇÃO AQUI: Adicionado 'as any' para evitar erro TS2353 no 'renotify'
      const notification = new Notification(title, {
        body: body,
        icon: "/favicon.png",
        tag: "fluxo-alert-" + Date.now(),
        renotify: true,
        silent: false,
      } as any);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(urgentVibration);
      }
      
      notification.onclick = function() {
        window.focus();
        window.location.href = '/requests';
        notification.close();
      };
    } catch (e) { console.error("Erro fallback", e); }
  };

  // --- 🚀 INSCRIÇÃO NO PUSH MANAGER ---
  const subscribeUserToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    if (VAPID_PUBLIC_KEY.includes("SUA_CHAVE")) {
        console.warn("⚠️ VAPID KEY não configurada.");
        return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // 1. Tenta pegar inscrição existente ou cria nova
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // 2. Envia para o backend (serializando corretamente)
      if (subscription) {
          const subscriptionJSON = JSON.parse(JSON.stringify(subscription));
          console.log("📡 Enviando inscrição Push:", subscriptionJSON);
          
          await api.post('/notifications/subscribe', { 
            subscription: subscriptionJSON 
          });
      }

    } catch (error) {
      console.error("❌ Erro ao inscrever no Push:", error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      toast.success("Notificações ativadas!");
      sendSystemNotification("Sistema Conectado", "Configuração concluída.");
      
      // Ativa o Push
      subscribeUserToPush();
    }
  };

  useEffect(() => {
    if (!user || !profile) return;

    const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace('/api', '');
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], 
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log("✅ Socket Conectado!");
      setIsConnected(true);
      
      if (profile.role) newSocket.emit('join_room', profile.role);
      
      if (profile.role === 'admin') {
          newSocket.emit('join_room', 'almoxarife');
          newSocket.emit('join_room', 'compras');
      }

      // Se já tiver permissão, garante que a inscrição está atualizada
      if (Notification.permission === 'granted') {
         subscribeUserToPush();
      }
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    // --- RECEBE NOTIFICAÇÃO VIA SOCKET (APP ABERTO) ---
    newSocket.on('new_request_notification', (data: any) => {
      if (profile.role === 'almoxarife') {
        if (data.type === 'entrada' || data.type === 'entry' || data.isPurchase) {
           return; 
        }
      }

      incrementCount(); 

      toast(data.message, {
        icon: <Bell className="h-5 w-5 text-blue-500" />,
        action: { label: 'Ver', onClick: () => window.location.href = '/requests' }
      });

      sendSystemNotification("🚨 NOVA SOLICITAÇÃO!", data.message || "Novo pedido pendente.");
    });

    newSocket.on('new_request', (data: any) => {
       if (profile.role === 'almoxarife') {
          if (data && (data.type === 'entrada' || data.type === 'entry')) return;
       }
       incrementCount(); 
    });

    newSocket.on('permissions_updated', (newPermissions: string[]) => {
      updatePermissions(newPermissions);
      toast.info("Permissões atualizadas.");
    });

    return () => {
      newSocket.disconnect();
      setIsConnected(false);
    };
  }, [user, profile]);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      hasUnreadRequests, 
      unreadCount, 
      markRequestsAsRead, 
      requestNotificationPermission 
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
