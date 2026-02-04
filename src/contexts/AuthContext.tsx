import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { toast } from "sonner";

// --- NOVOS CARGOS ADICIONADOS ---
type UserRole = 
  | "admin" 
  | "almoxarife" 
  | "setor" 
  | "compras" 
  | "auxiliar" 
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
  signUp: (
    id: string,
    password: string,
    name: string,
    role: UserRole,
    sector?: string
  ) => Promise<{ error: any }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Ref para evitar múltiplas chamadas simultâneas
  const isHeartbeatRunning = useRef(false);

  // --- FUNÇÃO AUXILIAR PARA BUSCAR PERMISSÕES ---
  const fetchUserPermissions = async (role: string) => {
    try {
      const response = await api.get("/admin/permissions");
      const allPermissions = response.data;
      const myPermissions = allPermissions[role] || [];
      
      setPermissions(myPermissions);
      localStorage.setItem("user_permissions", JSON.stringify(myPermissions));
      return myPermissions;
    } catch (error) {
      console.error("Erro ao buscar permissões:", error);
      return [];
    }
  };

  // ========================================================================
  // 🔥 CARREGAR SESSÃO NO F5
  // ========================================================================
  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("user_data");
      const savedProfile = localStorage.getItem("user_profile");
      const savedPermissions = localStorage.getItem("user_permissions");

      if (token && savedUser && savedProfile) {
        try {
          api.defaults.headers.Authorization = `Bearer ${token}`;
          const parsedProfile = JSON.parse(savedProfile);

          setUser(JSON.parse(savedUser));
          setProfile(parsedProfile);
          
          if (savedPermissions) {
             setPermissions(JSON.parse(savedPermissions));
             fetchUserPermissions(parsedProfile.role); 
          } else {
             await fetchUserPermissions(parsedProfile.role);
          }
        } catch (error) {
          console.error("Erro ao restaurar sessão:", error);
          localStorage.clear();
        }
      }
      setLoading(false);
    };
    loadSession();
  }, []);

  // ========================================================================
  // ⏱️ RASTREADOR DE TEMPO ONLINE (HEARTBEAT) - OTIMIZADO
  // ========================================================================
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (user && profile) {
      const sendHeartbeat = async () => {
        if (isHeartbeatRunning.current) return;
        isHeartbeatRunning.current = true;

        try {
          // Passamos { skipLoading: true } para que o api.ts NÃO mostre o loader na tela
          // O cast (as any) é necessário pois o axios padrão não conhece essa prop customizada
          await api.put(`/users/${profile.id}/heartbeat`, {}, { skipLoading: true } as any);
        } catch (error) {
          // Silencioso para não atrapalhar o usuário
        } finally {
          isHeartbeatRunning.current = false;
        }
      };

      // Executa imediatamente ao carregar
      sendHeartbeat();
      // Executa a cada 60 segundos
      intervalId = setInterval(sendHeartbeat, 60000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, profile]);

  // ========================================================================
  // 🔥 HELPER DE ACESSO (RBAC)
  // ========================================================================
  const canAccess = (pageKey: string) => {
    if (profile?.role === 'admin') return true;
    return permissions.includes(pageKey);
  };

  const updatePermissions = (newPermissions: string[]) => {
    console.log("🔄 Permissões atualizadas:", newPermissions);
    setPermissions(newPermissions);
    localStorage.setItem("user_permissions", JSON.stringify(newPermissions));
  };

  // ========================================================================
  // 🔥 LOGIN
  // ========================================================================
  const signIn = async (id: string, password: string) => {
    setLoading(true);
    try {
      const email = id.includes("@") ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@fluxoroyale.local`;
      const response = await api.post("/auth/login", { email, password });
      const { token, user, profile } = response.data;

      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("user_profile", JSON.stringify(profile));
      api.defaults.headers.Authorization = `Bearer ${token}`;

      setUser(user);
      setProfile(profile);
      await fetchUserPermissions(profile.role);

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

  const signUp = async () => {
    toast.error("Cadastro via site desabilitado. Solicite ao administrador.");
    return { error: { message: "Funcionalidade restrita" } };
  };

  const signOut = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.clear();
      delete api.defaults.headers.Authorization;
      setUser(null);
      setProfile(null);
      setPermissions([]);
      navigate("/auth");
      setLoading(false);
    }, 500);
  };

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading, canAccess, updatePermissions, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
