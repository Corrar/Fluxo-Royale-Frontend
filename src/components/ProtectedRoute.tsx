import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

// --- TIPAGEM DE PROPRIEDADES ---
interface ProtectedRouteProps {
  children: React.ReactNode;
  // Alteramos de requiredPermission para pageKey para manter consistência com o AuthContext
  pageKey?: string; 
}

/**
 * Componente Guardião das Rotas
 * Envolve as páginas do sistema para garantir que apenas utilizadores 
 * autenticados e autorizados lhes podem aceder.
 */
export function ProtectedRoute({ children, pageKey }: ProtectedRouteProps) {
  // Extraímos as funções e estados do nosso contexto de autenticação inteligente
  const { user, loading, canAccess } = useAuth();
  
  // Guardamos a localização atual para onde o utilizador tentou ir
  const location = useLocation();

  // --------------------------------------------------------------------------
  // PASSO 1: ESTADO DE CARREGAMENTO (LOADING)
  // --------------------------------------------------------------------------
  // Aguarda que o AuthContext recupere o utilizador e as permissões do localStorage/API
  if (loading) {
    return <LoadingScreen isLoading={true} message="Verificando permissões de acesso..." />;
  }

  // --------------------------------------------------------------------------
  // PASSO 2: VERIFICAÇÃO DE AUTENTICAÇÃO (LOGIN)
  // --------------------------------------------------------------------------
  // Se não houver nenhum utilizador registado na sessão, expulsa para o ecrã de Auth
  if (!user) {
    // A propriedade "state" permite que o ecrã de login saiba para onde redirecionar após o sucesso
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // --------------------------------------------------------------------------
  // PASSO 3: VERIFICAÇÃO DE AUTORIZAÇÃO (PERMISSÕES)
  // --------------------------------------------------------------------------
  // Se a rota exige uma permissão (pageKey) e o utilizador não a possui, bloqueia o acesso.
  // A função canAccess é inteligente: se a pageKey for "produtos", ela verifica 
  // se existe "produtos:view", "produtos:edit", etc.
  if (pageKey && !canAccess(pageKey)) {
    // Redireciona o utilizador não autorizado para a página inicial (dashboard principal)
    return <Navigate to="/inicio" replace />;
  }

  // --------------------------------------------------------------------------
  // PASSO 4: SUCESSO (ACESSO CONCEDIDO)
  // --------------------------------------------------------------------------
  // Se passou por todas as barreiras, renderiza o componente filho (a página solicitada)
  return <>{children}</>;
}
