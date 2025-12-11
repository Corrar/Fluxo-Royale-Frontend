import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { toast } from "sonner";

// --- CORREÇÃO AQUI: Adicionados os novos cargos ---
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
  signUp: (id: string, password: string, name: string, role: UserRole, sector?: string) => Promise<{ error: any }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Começa true para cobrir o F5 (Load inicial)
  const navigate = useNavigate();

  useEffect(() => {
    // Recuperar sessão ao recarregar a página (F5)
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user_data');
    const savedProfile = localStorage.getItem('user_profile');

    if (token && savedUser && savedProfile) {
      setUser(JSON.parse(savedUser));
      setProfile(JSON.parse(savedProfile));
    }
    
    // Pequeno delay visual para garantir que não pisque no F5
    setTimeout(() => setLoading(false), 500);
  }, []);

  const signIn = async (id: string, password: string) => {
    setLoading(true); // Ativa loading manual
    try {
      const email = id.includes('@') ? id : `${id.trim().toLowerCase()}@fluxoroyale.local`;
      
      // O axios (api.ts) também vai tentar ativar o loading, mas como já setamos true aqui, fica fluido
      const response = await api.post('/auth/login', { email, password });
      const { token, user, profile } = response.data;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(user));
      localStorage.setItem('user_profile', JSON.stringify(profile));

      setUser(user);
      setProfile(profile);
      navigate("/");
      
      return { error: null };
    } catch (error: any) {
      console.error(error);
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
    setLoading(true); // Efeito visual de saída
    
    // Simula um pequeno processamento para dar feedback visual ao usuário
    setTimeout(() => {
      localStorage.clear();
      setUser(null);
      setProfile(null);
      navigate("/auth");
      setLoading(false);
    }, 800);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};