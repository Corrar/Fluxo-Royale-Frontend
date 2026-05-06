import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { toast } from "sonner";
import { useSocket } from "./SocketContext";

// ============================================================================
// 1. DEFINIÇÃO DE TIPOS E INTERFACES
// ============================================================================

/** Todos os cargos disponíveis no sistema */
type UserRole = 
  | "admin" 
  | "almoxarife" 
  | "setor" 
  | "compras" 
  | "escritorio" 
  | "financeiro" 
  | "chefe" 
  | "assistente_tecnico"
  | "engenharia"
  | "prototipo"
  | "gerente"
  | "Ferro"
  | "desenvolvimento";

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  name: string;
  role: UserRole;
  sector: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  permissions: string[];
  loading: boolean;
  canAccess: (pageKey: string) => boolean;
  updatePermissions: (newPermissions: string[]) => void;
  signIn: (id: string, password: string) => Promise<{ error: any }>;
  signUp: (id: string, password: string, name: string, role: UserRole, sector?: string) => Promise<{ error: any }>;
  signOut: (redirectPath?: string) => void;
  logout: (redirectPath?: string) => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⏱️ CONFIGURAÇÃO DE TEMPO DE INATIVIDADE (30 MINUTOS EM MILISSEGUNDOS)
const INACTIVITY_LIMIT = 30 * 60 * 1000; 

// ============================================================================
// 2. COMPONENTE PROVIDER (FORNECEDOR DO CONTEXTO)
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Estados globais da aplicação
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const { socket } = useSocket(); 

  // Refs para controlo de temporizadores sem causar re-renderizações no React
  const isHeartbeatRunning = useRef(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // 🔥 CARREGAR SESSÃO NO F5 (REFRESH DA PÁGINA)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const loadSession = () => {
      const token = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("user_data");
      const savedProfile = localStorage.getItem("user_profile");
      const savedPermissions = localStorage.getItem("user_permissions");

      if (token && savedUser && savedProfile) {
        try {
          // Restaura os dados do cache
          api.defaults.headers.Authorization = `Bearer ${token}`;
          setUser(JSON.parse(savedUser));
          setProfile(JSON.parse(savedProfile));
          
          if (savedPermissions) {
             setPermissions(JSON.parse(savedPermissions));
          }
        } catch (error) {
          // Se o JSON falhar, limpamos tudo para evitar que a app quebre
          console.error("Erro ao restaurar sessão (dados corrompidos):", error);
          localStorage.clear();
          delete api.defaults.headers.Authorization;
          setUser(null);
          setProfile(null);
          setPermissions([]);
        }
      }
      // Indica que o carregamento inicial terminou
      setLoading(false);
    };
    
    loadSession();
  }, []);

  // --------------------------------------------------------------------------
  // 🚪 FUNÇÃO DE LOGOUT
  // --------------------------------------------------------------------------
  const signOut = useCallback((redirectPath = "/auth") => {
    setLoading(true);
    
    // Limpa o temporizador de inatividade se existir
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    // Pequeno atraso para garantir transição suave
    setTimeout(() => {
      localStorage.clear();
      delete api.defaults.headers.Authorization;
      setUser(null);
      setProfile(null);
      setPermissions([]);
      navigate(redirectPath);
      setLoading(false);
    }, 500);
  }, [navigate]);

  // --------------------------------------------------------------------------
  // ⏱️ AUTO-LOGOUT POR INATIVIDADE (30 MIN)
  // --------------------------------------------------------------------------
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    if (user) {
      idleTimerRef.current = setTimeout(() => {
        signOut("/auth?timeout=true");
      }, INACTIVITY_LIMIT);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (!user) return;

    resetIdleTimer();

    // Eventos que indicam que o utilizador está ativo
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    let lastCall = 0;
    
    // Otimização (Throttle) para não reiniciar o temporizador a cada milissegundo
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastCall > 1000) { 
        lastCall = now;
        resetIdleTimer();
      }
    };

    events.forEach(event => window.addEventListener(event, handleActivity));

    // Limpeza dos eventos ao desmontar
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, resetIdleTimer]);

  // --------------------------------------------------------------------------
  // ❤️ RASTREADOR DE TEMPO ONLINE (HEARTBEAT)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (user && profile) {
      const sendHeartbeat = async () => {
        if (isHeartbeatRunning.current) return;
        isHeartbeatRunning.current = true;

        try {
          await api.put(`/users/${profile.id}/heartbeat`, {}, { skipLoading: true } as any);
        } catch (error) {
          // Erro silencioso para não incomodar o utilizador
        } finally {
          isHeartbeatRunning.current = false;
        }
      };

      sendHeartbeat(); // Executa imediatamente
      intervalId = setInterval(sendHeartbeat, 300000); // Depois a cada 5 minutos
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, profile]);

  // --------------------------------------------------------------------------
  // 🚫 SEGURANÇA EM TEMPO REAL (WEBSOCKETS)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (socket && user && profile) {
      
      // 1. Conta suspensa
      const handleStatusChange = (data: { userId: string, is_active: boolean }) => {
        if (data.userId === user.id && data.is_active === false) {
          toast.error("Sessão Terminada. A sua conta foi suspensa pelo administrador.", { duration: 5000 });
          signOut(); 
        }
      };

      // 2. Alteração nas permissões do cargo
      const handleRolePermsChange = (data: { role: string }) => {
        if (data.role === profile.role) {
          toast.info("As permissões de acesso do seu cargo foram atualizadas. Por favor, faça login novamente.", { duration: 6000 });
          setTimeout(() => signOut(), 3000);
        }
      };

      // 3. Alteração nas permissões individuais
      const handleUserPermsChange = (data: { userId: string }) => {
        if (data.userId === user.id) {
          toast.info("As suas permissões de acesso individuais foram atualizadas. Por favor, faça login novamente.", { duration: 6000 });
          setTimeout(() => signOut(), 3000);
        }
      };

      socket.on('user_status_changed', handleStatusChange);
      socket.on('role_permissions_updated', handleRolePermsChange);
      socket.on('user_permissions_updated', handleUserPermsChange);

      return () => {
        socket.off('user_status_changed', handleStatusChange);
        socket.off('role_permissions_updated', handleRolePermsChange);
        socket.off('user_permissions_updated', handleUserPermsChange);
      };
    }
  }, [socket, user, profile, signOut]);

  // --------------------------------------------------------------------------
  // 🛡️ O GUARDIÃO (VERIFICADOR DE ACESSO INTELIGENTE)
  // --------------------------------------------------------------------------
  /**
   * Verifica se o utilizador tem permissão para aceder a uma funcionalidade
   * Suporta validação exata (ex: 'produtos:add') ou validação de módulo base (ex: 'produtos')
   * @param pageKey Chave da permissão
   * @returns boolean
   */
  const canAccess = (pageKey: string) => {
    // 1. Administradores têm acesso irrestrito
    if (profile?.role === 'admin') return true;
    
    // 2. Verificação Exata (Se o componente pedir uma ação específica, ex: 'produtos:edit')
    if (permissions.includes(pageKey)) return true;

    // 3. Verificação de Módulo Base (O Pulo do Gato)
    // Se a Sidebar perguntar apenas por 'produtos', verificamos se existe QUALQUER permissão que comece com 'produtos:'
    const hasAnyActionInModule = permissions.some(p => p.startsWith(`${pageKey}:`));
    
    return hasAnyActionInModule;
  };

  /**
   * Atualiza as permissões no estado local e no cache
   */
  const updatePermissions = useCallback((newPermissions: string[]) => {
    setPermissions(newPermissions);
    localStorage.setItem("user_permissions", JSON.stringify(newPermissions));
  }, []);

  // --------------------------------------------------------------------------
  // 🔑 LOGIN (SÍGN-IN)
  // --------------------------------------------------------------------------
  const signIn = async (id: string, password: string) => {
    setLoading(true);
    try {
      // Garante a formatação correta do email
      const email = id.includes("@") ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@fluxoroyale.local`;
      const response = await api.post("/auth/login", { email, password });
      
      const { token, user, profile, permissions: backendPermissions } = response.data;

      // Guarda os dados no navegador
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("user_profile", JSON.stringify(profile));
      localStorage.setItem("user_permissions", JSON.stringify(backendPermissions || []));
      
      // Define o token padrão para as próximas requisições
      api.defaults.headers.Authorization = `Bearer ${token}`;

      // Atualiza o estado do React
      setUser(user);
      setProfile(profile);
      setPermissions(backendPermissions || []);

      navigate("/inicio");
      return { error: null };
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      const msg = error.response?.data?.error || "Erro ao conectar com o servidor";
      return { error: { message: msg } };
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // 📝 REGISTO (SIGN-UP)
  // --------------------------------------------------------------------------
  const signUp = async () => {
    toast.error("Cadastro via site desabilitado. Solicite ao administrador.");
    return { error: { message: "Funcionalidade restrita" } };
  };

  // ============================================================================
  // 3. RETORNO DO PROVIDER
  // ============================================================================
  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile, 
        permissions, 
        loading, 
        canAccess, 
        updatePermissions, 
        signIn, 
        signUp, 
        signOut,
        logout: signOut // Apelido para signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// --------------------------------------------------------------------------
// 🚀 HOOK PERSONALIZADO
// --------------------------------------------------------------------------
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
