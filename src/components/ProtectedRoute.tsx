import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  // Enquanto está carregando o usuário, não podemos decidir nada ainda
  if (loading) {
    return <LoadingScreen message="Verificando acesso..." />;
  }

  // Se não estiver logado, redireciona para /auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Se houver regra de roles e não corresponder ao perfil, redireciona
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  // Tudo OK → renderiza a rota protegida
  return <>{children}</>;
}
