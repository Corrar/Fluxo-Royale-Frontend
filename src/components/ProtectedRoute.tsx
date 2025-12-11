import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen"; // Importa a tela do outro arquivo

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/auth");
      } else if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        navigate("/");
      }
    }
  }, [user, profile, loading, navigate, allowedRoles]);

  // Se estiver carregando, exibe o componente da Tela de Carregamento
  if (loading) {
    return <LoadingScreen message="Verificando acesso..." />;
  }

  if (!user || (allowedRoles && profile && !allowedRoles.includes(profile.role))) {
    return null;
  }

  return <>{children}</>;
}