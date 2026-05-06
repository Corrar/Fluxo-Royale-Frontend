import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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

  // --- CONTROLE DE DUPLICIDADE ---
  const processedIdsRef = useRef<Set<string>>(new Set());
  
  // 🔥 Ref para evitar múltiplas chamadas de inscrição simultâneas
  const isSubscribingRef = useRef(false);

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

  const incrementCount = useCallback(() => {
    if (window.location.pathname !== '/requests') {
      setUnreadCount((prev) => {
        const newValue = prev + 1;
        localStorage.setItem('@fluxo:unreadCount', String(newValue));
        return newValue;
      });
    }
  }, []);

  // --- REGISTRAR SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ SW registrado:', reg.scope))
        .catch(err => console.error('❌ Falha no SW:', err));
    }
  }, []);

  // --- NOTIFICAÇÃO DO SISTEMA (QUANDO O APP ESTÁ ABERTO) ---
  const sendSystemNotification = async (title: string, body: string, id?: string) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // 🔥 CORREÇÃO: Vibração única, limpa e padrão (300ms)
    const standardVibration = [300];
    
    // Tag única para deduplicação
    const notificationTag = id ? `fluxo-alert-${id}` : `fluxo-alert-${body.substring(0, 10)}`;

    // Tenta usar o Service Worker para mostrar a notificação (mais estável)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          
          // Obtém as notificações já mostradas pelo SO
          const existingNotifications = await registration.getNotifications({ tag: notificationTag });
          
          // Se já existir uma notificação com esta tag, cancela
          if (existingNotifications.length > 0) {
            console.log("🚫 Notificação nativa cancelada (SW Web Push já exibiu):", notificationTag);
            return;
          }

          await registration.showNotification(title, {
            body: body,
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: notificationTag,
            renotify: true,
            requireInteraction: true,
            vibrate: standardVibration, // Aplicando a vibração única
            silent: false, // 🔥 Garante que o som do sistema operacional toca
            data: { url: '/requests' }
          } as any); 
          return; 
        }
      } catch (e) { console.warn("SW notificação falhou", e); }
    }

    // Fallback para API nativa
    try {
      const notification = new Notification(title, {
        body: body,
        icon: "/favicon.png",
        tag: notificationTag,
        renotify: true,
        silent: false, // 🔥 Garante que o som do sistema operacional toca
      } as any);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(standardVibration); // Aplicando a vibração única no fallback
      }
      
      notification.onclick = function() {
        window.focus();
        window.location.href = '/requests';
        notification.close();
      };
    } catch (e) { console.error("Erro fallback", e); }
  };

  // --- INSCRIÇÃO NO PUSH MANAGER ---
  const subscribeUserToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    if (isSubscribingRef.current) return;
    
    if (VAPID_PUBLIC_KEY.includes("SUA_CHAVE")) {
        console.warn("⚠️ VAPID KEY não configurada.");
        return;
    }

    try {
      isSubscribingRef.current = true;
      const registration = await navigator.serviceWorker.ready;
      
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      if (subscription) {
          const subscriptionJSON = JSON.parse(JSON.stringify(subscription));
          
          await api.post('/notifications/subscribe', { 
            subscription: subscriptionJSON 
          }, { skipLoading: true } as any);
      }

    } catch (error) {
      console.error("❌ Erro ao inscrever no Push:", error);
    } finally {
      isSubscribingRef.current = false;
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success("Notificações ativadas!");
      sendSystemNotification("Sistema Conectado", "Configuração concluída.");
      subscribeUserToPush();
    }
  };

  useEffect(() => {
    if (!user || !profile) return;

    // Configuração do Socket
    const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace('/api', '');
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], 
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    // Handler de Conexão
    const handleConnect = () => {
      console.log("✅ Socket Conectado!");
      setIsConnected(true);
      
      if (profile.role) newSocket.emit('join_room', profile.role);
      
      if (profile.role === 'admin') {
          newSocket.emit('join_room', 'almoxarife');
          newSocket.emit('join_room', 'compras');
      }

      if (Notification.permission === 'granted') {
         subscribeUserToPush();
      }
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', () => setIsConnected(false));

    // --- RECEBE NOTIFICAÇÃO VIA SOCKET ---
    const handleNewRequestNotification = (data: any) => {
      if (profile.role === 'almoxarife') {
        if (data.type === 'entrada' || data.type === 'entry' || data.isPurchase) {
           return; 
        }
      }

      // Deduplicação com ID
      const uniqueId = data.id || `req-fallback-${Math.floor(Date.now() / 1000)}`; 
      
      if (processedIdsRef.current.has(uniqueId)) {
        return;
      }

      processedIdsRef.current.add(uniqueId);
      setTimeout(() => {
        processedIdsRef.current.delete(uniqueId);
      }, 15000); 

      incrementCount(); 

      toast(data.message, {
        id: uniqueId, 
        icon: <Bell className="h-5 w-5 text-blue-500" />,
        action: { label: 'Ver', onClick: () => window.location.href = '/requests' }
      });

      // 🔥 CORREÇÃO: A linha sendSystemNotification foi removida daqui para evitar dupla notificação
    };

    const handleNewRequest = (data: any) => {
       if (profile.role === 'almoxarife') {
          if (data && (data.type === 'entrada' || data.type === 'entry')) return;
       }
       incrementCount(); 
    };

    const handlePermissionsUpdated = (newPermissions: string[]) => {
      updatePermissions(newPermissions);
      toast.info("Permissões atualizadas.");
    };

    newSocket.on('new_request_notification', handleNewRequestNotification);
    newSocket.on('new_request', handleNewRequest);
    newSocket.on('permissions_updated', handlePermissionsUpdated);

    // Gatilho de Permissão
    const handleFirstInteraction = () => {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            toast.success("Notificações ativadas!");
            subscribeUserToPush();
          }
        });
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    if (Notification.permission === 'default') {
      window.addEventListener('click', handleFirstInteraction);
      window.addEventListener('touchstart', handleFirstInteraction);
    }

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('new_request_notification', handleNewRequestNotification);
      newSocket.off('new_request', handleNewRequest);
      newSocket.off('permissions_updated', handlePermissionsUpdated);
      newSocket.disconnect();
      setIsConnected(false);
      
      window.removeEventListener('click', handleFirstInteraction); 
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [user, profile, incrementCount, updatePermissions]);

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
