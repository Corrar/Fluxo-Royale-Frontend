import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoadingScreen } from "./components/LoadingScreen";
import { subscribeToLoading } from "./services/api";
import { ThemeProvider } from "@/components/theme-provider";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import InactiveProducts from "./pages/InactiveProducts";
import Stock from "./pages/Stock";
import Requests from "./pages/Requests";
import MyRequests from "./pages/MyRequests";
import Separations from "./pages/Separations";
import Replenishments from "./pages/Replenishments";
import LowStock from "./pages/LowStock";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import CalcMinStock from "./pages/CalcMinStock";
import StockView from "./pages/StockView";
import NotFound from "./pages/NotFound";
import StockWithdrawalPage from "./pages/StockWithdrawalPage";
import TravelReconciliation from "./pages/TravelReconciliation";
import CalculatorPage from "./pages/CalculatorPage";
import RemindersPage from "./pages/RemindersPage";
import TasksBoard from "./pages/TaskBoard";
import EletricaBoard from "./pages/EletricaBoard";
import Inicio from "./pages/Inicio";
import AuditLogs from "./pages/AuditLogs";
import PermissionsPage from "./pages/PermissionsPage";
import Search from "./pages/Search";
import OfficeDashboard from "./pages/OfficeDashboard";
import UserProfile from "./pages/UserProfile";
import DevDashboard from "./pages/DevDashboard";
import Clients from "./pages/Clients";

// =====================================================================
// 🛑 CONFIGURAÇÃO GLOBAL DO REACT QUERY - SALVAÇÃO DO NEONDB FREE TIER
// =====================================================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mantém os dados em cache por 1 minuto (60.000 ms) em TODAS as páginas
      staleTime: 60 * 1000, 
      
      // IMPEDE que o sistema baixe os dados de novo só porque o usuário mudou de aba/deu Alt+Tab!
      refetchOnWindowFocus: false, 
      
      // Impede refetches automáticos se a internet cair e voltar rapidamente
      refetchOnReconnect: false,
      
      // Se falhar a comunicação com o servidor, tenta apenas mais 1 vez (padrão são 3 vezes)
      retry: 1,
    },
  },
});

const GlobalLoader = () => {
  const { loading: authLoading } = useAuth();
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLoading((isLoading) => {
      setApiLoading(isLoading);
    });
    return unsubscribe;
  }, []);

  return <LoadingScreen isLoading={authLoading || apiLoading} />;
};

const App = () => {
  // --- 🔔 O SEGREDO DAS NOTIFICAÇÕES COM APP FECHADO ESTÁ AQUI ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Registra o Service Worker assim que a página carregar
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('✅ Service Worker (Notificações) registrado:', registration.scope);
          })
          .catch(error => {
            console.error('❌ Falha ao registrar Service Worker:', error);
          });
      });
    }
  }, []);
  // -------------------------------------------------------------

  return (
    <QueryClientProvider client={queryClient}>
      {/* 🎨 PALETA ALTO CONTRASTE (VISIBILIDADE MÁXIMA & DARK MODE) */}
      <style>{`
        :root {
          --background: 0 0% 100%;
          --foreground: 222.2 84% 4.9%;
          --card: 0 0% 100%;
          --card-foreground: 222.2 84% 4.9%;
          --popover: 0 0% 100%;
          --popover-foreground: 222.2 84% 4.9%;
          --primary: 221.2 83.2% 53.3%;
          --primary-foreground: 210 40% 98%;
          --secondary: 210 40% 96.1%;
          --secondary-foreground: 222.2 47.4% 11.2%;
          --muted: 210 40% 96.1%;
          --muted-foreground: 215.4 16.3% 46.9%;
          --accent: 210 40% 96.1%;
          --accent-foreground: 222.2 47.4% 11.2%;
          --destructive: 0 84.2% 60.2%;
          --destructive-foreground: 210 40% 98%;
          --border: 214.3 31.8% 91.4%;
          --input: 214.3 31.8% 91.4%;
          --ring: 221.2 83.2% 53.3%;
          --radius: 0.5rem;
        }

        .dark {
          --background: 224 71% 4%; 
          --foreground: 210 40% 100%;
          --card: 222 47% 11%; 
          --card-foreground: 210 40% 100%;
          --popover: 222 47% 11%;
          --popover-foreground: 210 40% 100%;
          --primary: 217 91% 60%;
          --primary-foreground: 0 0% 100%;
          --secondary: 217 32% 25%;
          --secondary-foreground: 210 40% 100%;
          --muted: 217 32% 25%;
          --muted-foreground: 215 20% 75%; 
          --border: 217 32% 30%; 
          --input: 217 32% 30%; 
          --destructive: 0 62.8% 30.6%;
          --destructive-foreground: 210 40% 98%;
          --ring: 224 76% 48%;
        }

        /* === CORREÇÃO DE INPUTS PARA VISIBILIDADE === */
        .dark input, 
        .dark textarea, 
        .dark select {
          background-color: hsl(217 32% 18%) !important;
          color: #FFFFFF !important;
          border: 1px solid hsl(217 32% 40%) !important;
        }

        .dark input:focus, 
        .dark textarea:focus {
          border-color: hsl(217 91% 60%) !important;
          background-color: hsl(217 32% 22%) !important;
          outline: none;
        }

        .dark ::placeholder {
          color: hsl(215 20% 65%) !important;
          opacity: 1;
        }

        .dark .lucide {
          color: hsl(215 20% 80%);
        }
      `}</style>

      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <SocketProvider>
                  <GlobalLoader />
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    
                    {/* PÁGINAS GERAIS */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute pageKey="dashboard">
                          <Layout><Dashboard /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/inicio"
                      element={
                        <ProtectedRoute>
                          <Layout><Inicio /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* NOVA ROTA DE CLIENTES E OPs */}
                    <Route
                      path="/clientes"
                      element={
                        <ProtectedRoute pageKey="clientes">
                          <Layout><Clients /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* NOVA ROTA DO PERFIL DO USUÁRIO */}
                    <Route
                      path="/perfil"
                      element={
                        <ProtectedRoute>
                          <Layout><UserProfile /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/search"
                      element={
                        <ProtectedRoute>
                          <Layout><Search /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* ESTOQUE INTELIGENTE */}
                    <Route
                      path="/stock-view"
                      element={
                        <ProtectedRoute pageKey="consultar">
                          <Layout><StockView /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* FERRAMENTAS */}
                    <Route
                      path="/calculator"
                      element={
                        <ProtectedRoute pageKey="calculadora">
                          <Layout><CalculatorPage /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* GESTÃO E AVISOS */}
                    <Route
                      path="/reminders"
                      element={
                        <ProtectedRoute pageKey="avisos">
                          <Layout><RemindersPage /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/tasks"
                      element={
                        <ProtectedRoute pageKey="dashboard">
                          <Layout><TasksBoard /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/tasks-eletrica"
                      element={
                        <ProtectedRoute pageKey="tarefas_eletrica">
                          <Layout><EletricaBoard /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/products"
                      element={
                        <ProtectedRoute pageKey="produtos">
                          <Layout><Products /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* NOVA ROTA DE PRODUTOS ARQUIVADOS/INATIVOS */}
                    <Route
                      path="/produtos-arquivados"
                      element={
                        <ProtectedRoute pageKey="usuarios">
                          <Layout><InactiveProducts /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* ESTOQUE - AJUSTE MANUAL */}
                    <Route
                      path="/stock"
                      element={
                        <ProtectedRoute pageKey="estoque">
                          <Layout><Stock /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* PEDIDOS E MOVIMENTAÇÃO */}
                    <Route
                      path="/requests"
                      element={
                        <ProtectedRoute pageKey="solicitacoes">
                          <Layout><Requests /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/my-requests"
                      element={
                        <ProtectedRoute pageKey="minhas_solicitacoes">
                          <Layout><MyRequests /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* --- ROTA ESCRITÓRIO: CONTROLE DE SAÍDA COM PERMISSÃO --- */}
                    <Route
                      path="/office-exits"
                      element={
                        <ProtectedRoute pageKey="office_dashboard"> 
                          <Layout><OfficeDashboard /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    {/* ----------------------------------------------------------- */}
                    
                    <Route
                      path="/separations"
                      element={
                        <ProtectedRoute pageKey="separacoes">
                          <Layout><Separations /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* --- NOVA ROTA DE REPOSIÇÕES --- */}
                    <Route
                      path="/replenishments"
                      element={
                        <ProtectedRoute pageKey="reposicoes">
                          <Layout><Replenishments /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/reconciliation"
                      element={
                        <ProtectedRoute pageKey="confronto_viagem">
                          <Layout><TravelReconciliation /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/withdrawal"
                      element={
                        <ProtectedRoute pageKey="estoque">
                          <Layout><StockWithdrawalPage /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* RELATÓRIOS E COMPRAS */}
                    <Route
                      path="/low-stock"
                      element={
                        <ProtectedRoute pageKey="estoque_critico">
                          <Layout><LowStock /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute pageKey="relatorios">
                          <Layout><Reports /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route
                      path="/calc-min-stock"
                      element={
                        <ProtectedRoute pageKey="calculo_minimo">
                          <Layout><CalcMinStock /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* ADMINISTRAÇÃO */}
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute pageKey="usuarios">
                          <Layout><Users /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    {/* PAINEL EXCLUSIVO DO DESENVOLVEDOR */}
                    <Route
                      path="/dev-dashboard"
                      element={
                        <ProtectedRoute pageKey="usuarios">
                          <Layout><DevDashboard /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/audit"
                      element={
                        <ProtectedRoute pageKey="logs">
                          <Layout><AuditLogs /></Layout>
                        </ProtectedRoute>
                      }
                    />

                    <Route
                      path="/permissions"
                      element={
                        <ProtectedRoute pageKey="permissoes">
                          <Layout><PermissionsPage /></Layout>
                        </ProtectedRoute>
                      }
                    />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
              </SocketProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
