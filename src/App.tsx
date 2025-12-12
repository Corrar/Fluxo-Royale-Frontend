import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoadingScreen } from "./components/LoadingScreen";
import { subscribeToLoading } from "./services/api";
import { ThemeProvider } from "@/components/theme-provider";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stock from "./pages/Stock";
import Requests from "./pages/Requests";
import MyRequests from "./pages/MyRequests";
import Separations from "./pages/Separations";
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
import Inicio from "./pages/Inicio";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* PALETA SUAVE (SOFT DARK MODE) */}
    <style>{`
      .dark {
        --background: 222 47% 11%;
        --foreground: 213 27% 84%;
        --card: 217 33% 17%;
        --card-foreground: 213 27% 84%;
        --popover: 217 33% 17%;
        --popover-foreground: 213 27% 84%;
        --primary: 142.1 70.6% 45.3%;
        --primary-foreground: 144.9 80.4% 10%;
        --secondary: 217 33% 17%;
        --secondary-foreground: 210 40% 98%;
        --muted: 217 33% 17%;
        --muted-foreground: 215 20.2% 65.1%;
        --border: 217 33% 17%;
        --input: 217 33% 17%;
        --accent: 217 33% 17%;
        --accent-foreground: 210 40% 98%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
        --ring: 142.4 71.8% 29.2%;
      }
    `}</style>

    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <GlobalLoader />
            
            <Routes>
              <Route path="/auth" element={<Auth />} />
              
              {/* Rota padrão (Dashboard) */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* --- ROTA DA PÁGINA INÍCIO (BOAS-VINDAS) --- */}
              <Route
                path="/inicio"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Inicio />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Rota da Calculadora */}
              <Route
                path="/calculator"
                element={
                  <ProtectedRoute allowedRoles={["almoxarife", "auxiliar"]}>
                    <Layout>
                      <CalculatorPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Rota de Avisos e Lembretes */}
              <Route
                path="/reminders"
                element={
                  <ProtectedRoute allowedRoles={["admin", "chefe", "almoxarife", "compras"]}>
                    <Layout>
                      <RemindersPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/products"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Products />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* ATUALIZADO: Adicionado 'chefe' */}
              <Route
                path="/stock"
                element={
                  <ProtectedRoute allowedRoles={["admin", "almoxarife", "auxiliar", "assistente_tecnico", "chefe"]}>
                    <Layout>
                      <Stock />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/requests"
                element={
                  <ProtectedRoute allowedRoles={["admin", "almoxarife"]}>
                    <Layout>
                      <Requests />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/my-requests"
                element={
                  <ProtectedRoute allowedRoles={["setor"]}>
                    <Layout>
                      <MyRequests />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/separations"
                element={
                  <ProtectedRoute allowedRoles={["admin", "almoxarife"]}>
                    <Layout>
                      <Separations />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reconciliation"
                element={
                  <ProtectedRoute allowedRoles={["admin", "assistente_tecnico"]}>
                    <Layout>
                      <TravelReconciliation />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/withdrawal"
                element={
                  <ProtectedRoute allowedRoles={["admin", "almoxarife"]}>
                    <Layout>
                      <StockWithdrawalPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* ATUALIZADO: Adicionado 'chefe' */}
              <Route
                path="/low-stock"
                element={
                  <ProtectedRoute allowedRoles={["compras", "admin", "almoxarife", "chefe"]}>
                    <Layout>
                      <LowStock />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Layout>
                      <Users />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={["admin", "almoxarife"]}>
                    <Layout>
                      <Reports />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/calc-min-stock"
                element={
                  <ProtectedRoute allowedRoles={["admin", "almoxarife"]}>
                    <Layout>
                      <CalcMinStock />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/stock-view"
                element={
                  <ProtectedRoute allowedRoles={["setor"]}>
                    <Layout>
                      <StockView />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;