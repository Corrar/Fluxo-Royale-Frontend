import { 
  Home, Package, ShoppingCart, FileText, Users, BarChart3, LogOut, 
  Calculator, Eye, ClipboardList, Bell, ChevronLeft, ChevronRight, Rocket 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

// Interface para receber o controle do Layout pai
interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const { profile, signOut } = useAuth();

  // --- PERFIS & PERMISSÕES ---
  const isAdmin = profile?.role === "admin";
  const isAlmoxarife = profile?.role === "almoxarife" || isAdmin;
  const isSetor = profile?.role === "setor";
  const isCompras = profile?.role === "compras";
  const isAuxiliar = profile?.role === "auxiliar";
  const isAssistente = profile?.role === "assistente_tecnico";
  const isChefe = profile?.role === "chefe";
  
  const canViewCompras = isCompras || isAlmoxarife;
  const canViewDashboard = isAdmin || isAlmoxarife || isCompras || isChefe; 
  const isTecnico = isAuxiliar || isAssistente;
  
  // Links Específicos
  const showCalculatorLink = profile?.role === "auxiliar";
  const showRemindersLink = isChefe || isAdmin || isAlmoxarife || isCompras;

  // --- ESTILOS ---
  // Mantendo seu design azul/destacado
  const baseClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary text-muted-foreground";
  const activeClass = "bg-muted text-primary";

  // Função auxiliar para renderizar os links
  const renderLink = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink 
      to={to} 
      className={`${baseClass} ${isCollapsed ? "justify-center px-2" : ""}`}
      activeClassName={activeClass}
      title={isCollapsed ? label : ""}
    >
      {icon}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  return (
    <div 
      className={`flex flex-col border-r bg-card text-card-foreground transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"} h-full`}
    >
      {/* CABEÇALHO + BOTÃO DE RECOLHER */}
      <div className={`p-4 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-2xl font-bold text-primary truncate">Fluxo</h1>
            <p className="text-xs text-muted-foreground truncate">Gestão</p>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-muted-foreground hover:text-primary" 
          onClick={toggleSidebar}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <nav className="flex flex-col gap-2 pt-2">
          
          {/* LINK INÍCIO (NOVO) */}
          {renderLink("/inicio", <Rocket className="h-5 w-5" />, "Início")}

          {/* DASHBOARD */}
          {canViewDashboard && renderLink("/", <Home className="h-5 w-5" />, "Dashboard")}
          
          {/* AVISOS */}
          {showRemindersLink && renderLink("/reminders", <Bell className="h-5 w-5" />, "Avisos")}

          {/* CALCULADORA */}
          {showCalculatorLink && renderLink("/calculator", <Calculator className="h-5 w-5" />, "Calculadora")}

          {/* GESTÃO */}
          {(isAlmoxarife || isCompras || isSetor) && (
            <div className="pt-4 pb-2">
              {!isCollapsed && (
                <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                  Gestão
                </p>
              )}
              {(isAlmoxarife || isCompras) && renderLink("/products", <Package className="h-5 w-5" />, "Produtos")}
              {isAlmoxarife && renderLink("/stock", <ShoppingCart className="h-5 w-5" />, "Estoque")}
              {isSetor && renderLink("/stock-view", <Eye className="h-5 w-5" />, "Consultar")}
            </div>
          )}

          {/* TÉCNICO */}
          {isTecnico && (
            <div className="pt-4 pb-2">
              {!isCollapsed && <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase truncate">Técnico</p>}
              {renderLink("/stock", <Package className="h-5 w-5" />, "Catálogo")}
              {isAssistente && renderLink("/reconciliation", <ClipboardList className="h-5 w-5" />, "Confronto")}
            </div>
          )}

          {/* MOVIMENTAÇÕES */}
          {(isAlmoxarife || isSetor) && (
            <div className="pt-4 pb-2">
              {!isCollapsed && <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase truncate">Movimentação</p>}
              {isAlmoxarife && renderLink("/requests", <FileText className="h-5 w-5" />, "Solicitações")}
              {isSetor && renderLink("/my-requests", <FileText className="h-5 w-5" />, "Minhas Solic.")}
              {isAlmoxarife && renderLink("/separations", <ClipboardList className="h-5 w-5" />, "Separações")}
            </div>
          )}

          {/* ADMINISTRAÇÃO */}
          {(isAlmoxarife || isCompras) && (
            <div className="pt-4 pb-2">
              {!isCollapsed && <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase truncate">Admin</p>}
              {canViewCompras && renderLink("/low-stock", <ShoppingCart className="h-5 w-5" />, "Compras")}
              {isAlmoxarife && (
                <>
                  {renderLink("/reports", <BarChart3 className="h-5 w-5" />, "Relatórios")}
                  {renderLink("/calc-min-stock", <Calculator className="h-5 w-5" />, "Estoque Mín.")}
                </>
              )}
              {isAdmin && renderLink("/users", <Users className="h-5 w-5" />, "Usuários")}
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* RODAPÉ */}
      <div className="p-4 border-t">
        {!isCollapsed && (
          <div className="mb-4 px-2">
            <p className="text-sm font-medium truncate">{profile?.name}</p>
            <p className="text-xs text-muted-foreground capitalize truncate">
              {profile?.role?.replace('_', ' ')}
            </p>
          </div>
        )}
        <Button 
          variant="outline" 
          className={`w-full text-red-500 hover:text-red-600 hover:bg-red-50 ${isCollapsed ? "justify-center px-0" : "justify-start"}`} 
          onClick={signOut}
          title="Sair"
        >
          <LogOut className={`h-4 w-4 ${!isCollapsed && "mr-2"}`} />
          {!isCollapsed && "Sair"}
        </Button>
      </div>
    </div>
  );
}