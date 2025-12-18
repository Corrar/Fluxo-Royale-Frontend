import { 
  Home, Package, ShoppingCart, FileText, Users, BarChart3, LogOut, 
  Calculator, Eye, ClipboardList, Bell, ChevronLeft, ChevronRight, Rocket,
  Truck, AlertTriangle, ShieldCheck, Lock 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  onItemClick?: () => void;
}

export function Sidebar({ isCollapsed, toggleSidebar, onItemClick }: SidebarProps) {
  // Pegamos a função canAccess do contexto atualizado
  const { profile, signOut, canAccess } = useAuth();

  // --- CARGOS (Ainda úteis para estrutura geral ou Admin) ---
  const isAdmin = profile?.role === "admin";
  const isSetor = profile?.role === "setor";

  // --- ESTILOS ---
  const baseClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary text-muted-foreground";
  const activeClass = "bg-muted text-primary";

  const renderLink = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink 
      to={to} 
      className={`${baseClass} ${isCollapsed ? "justify-center px-2" : ""}`}
      activeClassName={activeClass}
      title={isCollapsed ? label : ""}
      onClick={onItemClick}
    >
      {icon}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  return (
    <div 
      className={`flex flex-col h-full bg-card text-card-foreground transition-all duration-300 ${isCollapsed ? "w-[70px]" : "w-64"} border-r`}
    >
      {/* CABEÇALHO */}
      <div className={`p-4 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-xl font-bold text-primary truncate tracking-tight">Fluxo Royale</h1>
            <p className="text-xs text-muted-foreground truncate">Gestão Inteligente</p>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-muted-foreground hover:text-primary hidden lg:flex" 
          onClick={toggleSidebar}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="flex flex-col gap-1 pt-2 pb-4">
          
          {/* MENU COMUM */}
          {renderLink(isSetor ? "/stock-view" : "/inicio", <Rocket className="h-5 w-5" />, "Início")}

          {/* DASHBOARD (Controlado por Permissão) */}
          {canAccess('dashboard') && renderLink("/", <Home className="h-5 w-5" />, "Dashboard")}
          
          {/* AVISOS */}
          {canAccess('avisos') && renderLink("/reminders", <Bell className="h-5 w-5" />, "Avisos")}

          {/* CALCULADORA */}
          {canAccess('calculadora') && renderLink("/calculator", <Calculator className="h-5 w-5" />, "Calculadora")}

          {/* SEÇÃO: GESTÃO */}
          {(canAccess('produtos') || canAccess('estoque') || canAccess('consultar')) && (
            <div className="pt-4 pb-1">
              {!isCollapsed && <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider truncate">Gestão</p>}
              
              {canAccess('produtos') && renderLink("/products", <Package className="h-5 w-5" />, "Produtos")}
              {canAccess('estoque') && renderLink("/stock", <ShoppingCart className="h-5 w-5" />, "Estoque")}
              {canAccess('consultar') && renderLink("/stock-view", <Eye className="h-5 w-5" />, "Consultar")}
            </div>
          )}

          {/* SEÇÃO: MOVIMENTAÇÃO (Atualizada) */}
          {(canAccess('solicitacoes') || canAccess('minhas_solicitacoes') || canAccess('separacoes') || canAccess('confronto_viagem')) && (
            <div className="pt-4 pb-1">
              {!isCollapsed && <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground/70 uppercase truncate">Movimentação</p>}
              
              {canAccess('solicitacoes') && renderLink("/requests", <FileText className="h-5 w-5" />, "Solicitações")}
              {canAccess('minhas_solicitacoes') && renderLink("/my-requests", <FileText className="h-5 w-5" />, "Minhas Solic.")}
              {canAccess('separacoes') && renderLink("/separations", <Truck className="h-5 w-5" />, "Separações")}
              
              {/* NOVO LINK DE CONFRONTO */}
              {canAccess('confronto_viagem') && renderLink("/reconciliation", <ClipboardList className="h-5 w-5" />, "Confronto")}
            </div>
          )}

          {/* SEÇÃO: ADMINISTRAÇÃO */}
          {(isAdmin || canAccess('estoque_critico') || canAccess('relatorios')) && (
            <div className="pt-4 pb-1">
              {!isCollapsed && <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground/70 uppercase truncate">Admin</p>}
              
              {canAccess('estoque_critico') && renderLink("/low-stock", <AlertTriangle className="h-5 w-5" />, "Compras")}
              {canAccess('relatorios') && renderLink("/reports", <BarChart3 className="h-5 w-5" />, "Relatórios")}
              {canAccess('calculo_minimo') && renderLink("/calc-min-stock", <Calculator className="h-5 w-5" />, "Estoque Mín.")}
              
              {isAdmin && (
                <>
                  {renderLink("/users", <Users className="h-5 w-5" />, "Usuários")}
                  {renderLink("/audit", <ShieldCheck className="h-5 w-5" />, "Auditoria")}
                  {/* LINK DE PERMISSÕES */}
                  {renderLink("/permissions", <Lock className="h-5 w-5" />, "Permissões")}
                </>
              )}
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* RODAPÉ */}
      <div className="p-4 border-t bg-muted/10">
        {!isCollapsed && (
          <div className="mb-3 px-1">
            <p className="text-sm font-medium truncate">{profile?.name}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {profile?.role?.replace('_', ' ')}
            </p>
          </div>
        )}
        <Button 
          variant="ghost" 
          className={`w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 ${isCollapsed ? "justify-center px-0" : "justify-start"}`} 
          onClick={() => {
            signOut();
            if (onItemClick) onItemClick();
          }}
          title="Sair"
        >
          <LogOut className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
          {!isCollapsed && "Sair"}
        </Button>
      </div>
    </div>
  );
}