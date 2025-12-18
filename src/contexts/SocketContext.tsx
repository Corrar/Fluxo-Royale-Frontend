import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { Bell, Lock } from 'lucide-react'; // <--- Importei o Lock para o ícone

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  // Pegamos a função updatePermissions aqui
  const { user, profile, updatePermissions } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Só conecta se tiver usuário E perfil carregado
    if (!user || !profile) return;

    // Define URL (remove /api do final se existir)
    const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace('/api', '');
    
    console.log("🔌 Inicializando Socket em:", SOCKET_URL);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], 
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    // --- EVENTOS DE CONEXÃO ---

    newSocket.on('connect', () => {
      console.log("✅ Socket Conectado! ID:", newSocket.id);
      setIsConnected(true);
      
      // Entra na sala do cargo principal
      if (profile.role) {
        newSocket.emit('join_room', profile.role);
        console.log(`📢 Entrou na sala principal: ${profile.role}`);
      }

      // Se for admin, entra nas outras salas para monitorar
      if (profile.role === 'admin') {
          newSocket.emit('join_room', 'almoxarife');
          newSocket.emit('join_room', 'compras');
      }
    });

    newSocket.on('disconnect', () => {
      console.log("❌ Socket Desconectado");
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error("⚠️ Erro de conexão Socket:", err.message);
      setIsConnected(false);
    });

    // --- ESCUTA DE NOTIFICAÇÕES GERAIS ---
    newSocket.on('new_request_notification', (data: any) => {
      console.log("🔔 Notificação:", data);
      
      toast(data.message, {
        icon: <Bell className="h-5 w-5 text-blue-500" />,
        description: "Clique para visualizar",
        duration: 5000,
        action: {
          label: 'Ver',
          onClick: () => window.location.href = '/requests'
        }
      });
    });

    // --- 🔥 NOVO: ESCUTA ATUALIZAÇÃO DE PERMISSÕES ---
    newSocket.on('permissions_updated', (newPermissions: string[]) => {
      console.log("🔐 Permissões recebidas via Socket:", newPermissions);
      
      // 1. Atualiza o AuthContext imediatamente
      updatePermissions(newPermissions);

      // 2. Avisa o usuário que o acesso mudou
      toast.info("Permissões de acesso atualizadas.", {
        icon: <Lock className="h-4 w-4 text-orange-500" />,
        description: "Seu menu foi ajustado automaticamente pelo administrador."
      });
    });

    // LIMPEZA AO DESMONTAR OU MUDAR USUÁRIO
    return () => {
      console.log("🧹 Desconectando Socket...");
      newSocket.disconnect();
      setIsConnected(false);
    };
  }, [user, profile]); // Recria apenas se mudar o usuário logado

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  return useContext(SocketContext);
};