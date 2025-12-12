import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { toast } from "sonner";

// --- NOVOS CARGOS ---
type UserRole = "admin" | "almoxarife" | "setor" | "compras" | "auxiliar" | "chefe" | "assistente_tecnico";

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
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ========================================================================
  // 🔥 CARREGAR SESSÃO NO F5 (Corrigido para setar o Header da API)
  // ========================================================================
  useEffect(() => {
    const loadSession = () => {
      const token = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("user_data");
      const savedProfile = localStorage.getItem("user_profile");

      if (token && savedUser && savedProfile) {
        try {
          // 1. Configura o token no Axios IMEDIATAMENTE
          api.defaults.headers.Authorization = `Bearer ${token}`;

          // 2. Restaura o estado
          setUser(JSON.parse(savedUser));
          setProfile(JSON.parse(savedProfile));
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
  // 🔥 LOGIN
  // ========================================================================
  const signIn = async (id: string, password: string) => {
    setLoading(true);

    try {
      // Lógica de e-mail local
      const email = id.includes("@")
        ? id.trim().toLowerCase()
        : `${id.trim().toLowerCase()}@fluxoroyale.local`;

      const response = await api.post("/auth/login", { email, password });

      const { token, user, profile } = response.data;

      // 1. Salvar dados
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("user_profile", JSON.stringify(profile));

      // 2. Aplicar token ao Axios (Fundamental para próximas requisições)
      api.defaults.headers.Authorization = `Bearer ${token}`;

      // 3. Atualizar estado global
      setUser(user);
      setProfile(profile);

      // 4. Redirecionar para o Início
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

  // ========================================================================
  // 🔒 CADASTRO BLOQUEADO
  // ========================================================================
  const signUp = async () => {
    toast.error("Cadastro via site desabilitado. Solicite ao administrador.");
    return { error: { message: "Funcionalidade restrita" } };
  };

  // ========================================================================
  // 🔥 LOGOUT
  // ========================================================================
  const signOut = () => {
    setLoading(true);

    setTimeout(() => {
      // Limpa dados locais
      localStorage.clear();
      
      // Limpa header da API para evitar uso de token antigo
      delete api.defaults.headers.Authorization;

      // Reseta estados
      setUser(null);
      setProfile(null);
      
      navigate("/auth");
      setLoading(false);
    }, 500);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};