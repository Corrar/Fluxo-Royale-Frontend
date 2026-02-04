import { 
  Home, Package, ShoppingCart, FileText, Users, BarChart3, LogOut, 
  Calculator, Eye, ClipboardList, Bell, ChevronLeft, ChevronRight, Rocket,
  Truck, AlertTriangle, ShieldCheck, Lock, User, Sparkles // <--- ADICIONADO SPARKLES
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  onItemClick?: () => void;
}

export function Sidebar({ isCollapsed, toggleSidebar, onItemClick }: SidebarProps) {
  const { profile, signOut, canAccess } = useAuth();
  
  // Consumindo diretamente a contagem numérica do Contexto
  const { unreadCount } = useSocket(); 

  const isAdmin = profile?.role === "admin";
  const isSetor = profile?.role === "setor";

  const baseClass = "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted/50 group";
  const activeClass = "bg-primary/5 text-primary border-l-4 border-primary rounded-l-none font-semibold";

  // Formata o número (ex: 12 vira "9+")
  const formatBadgeCount = (count: number) => {
    if (!count || count <= 0) return null;
    return count > 9 ? "9+" : count;
  };

  const renderLink = (to: string, icon: React.ReactNode, label: string) => {
    // Lógica simplificada: Se for a rota de solicitações E tiver contagem > 0
    const isRequestsRoute = to === "/requests";
    const hasCount = unreadCount > 0;
    const showBadge = isRequestsRoute && hasCount;
    
    return (
      <NavLink 
        to={to} 
        className={`${baseClass} ${isCollapsed ? "justify-center px-2" : ""}`}
        activeClassName={activeClass}
        title={isCollapsed ? label : ""}
        onClick={onItemClick}
      >
        <div className="relative flex items-center justify-center">
          {icon}
          
          {/* --- BOLINHA (Modo Colapsado) --- */}
          {showBadge && isCollapsed && (
            <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-red-600 border-[2px] border-card shadow-sm text-[9px] font-bold text-white animate-in zoom-in duration-300">
              {formatBadgeCount(unreadCount)}
            </span>
          )}
        </div>
        
        {!isCollapsed && (
          <>
            <span className="truncate group-hover:translate-x-1 transition-transform duration-300 flex-1">
              {label}
            </span>
            
            {/* --- BOLINHA (Modo Expandido) --- */}
            {showBadge && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 shadow-sm mr-1 text-[10px] font-bold text-white animate-in zoom-in duration-300">
                {formatBadgeCount(unreadCount)}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-card text-card-foreground transition-all duration-300 ${isCollapsed ? "w-[80px]" : "w-72"} border-r shadow-2xl z-20`}>
      
      {/* CABEÇALHO */}
      <div className={`h-20 flex items-center ${isCollapsed ? "justify-center" : "justify-between px-6"} border-b border-border/40 bg-muted/5`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-500">
            {/* --- ALTERAÇÃO AQUI: Imagem do Egg no lugar do foguete azul --- */}
            <div className="h-10 w-10 flex items-center justify-center shrink-0">
              <img 
                src="/favicon.png" // Assumindo que este é o caminho da imagem da aba
                alt="Fluxo Royale Logo" 
                className="h-9 w-9 object-contain drop-shadow-sm animate-in zoom-in duration-700"
              />
            </div>
            {/* --------------------------------------------------------- */}
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none">Fluxo Royale</h1>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Sistema de Gestão</span>
            </div>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          className={`text-muted-foreground hover:text-primary transition-colors ${isCollapsed ? "" : "hidden lg:flex"}`} 
          onClick={toggleSidebar}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* NAVEGAÇÃO */}
      <ScrollArea className="flex-1 py-6">
        <nav className="flex flex-col gap-1 px-3">
          
          {renderLink(isSetor ? "/stock-view" : "/inicio", <Home className="h-5 w-5" />, "Início")}
          
          {canAccess('dashboard') && renderLink("/", <BarChart3 className="h-5 w-5" />, "Dashboard")}
          
          {/* --- NOVO LINK PARA TAREFAS --- */}
          {canAccess('dashboard') && renderLink("/tasks", <Sparkles className="h-5 w-5" />, "Quadro de Tarefas")}
          
          {canAccess('avisos') && renderLink("/reminders", <Bell className="h-5 w-5" />, "Avisos")}
          {canAccess('calculadora') && renderLink("/calculator", <Calculator className="h-5 w-5" />, "Calculadora")}

          {!isCollapsed && <Separator className="my-3 bg-border/40" />}

          {/* GESTÃO */}
          {(canAccess('produtos') || canAccess('estoque') || canAccess('consultar')) && (
            <div className="mb-2">
              {!isCollapsed && <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Gestão de Estoque</p>}
              {canAccess('produtos') && renderLink("/products", <Package className="h-5 w-5" />, "Produtos")}
              {canAccess('estoque') && renderLink("/stock", <ShoppingCart className="h-5 w-5" />, "Movimentação")}
              {canAccess('consultar') && renderLink("/stock-view", <Eye className="h-5 w-5" />, "Consulta Rápida")}
            </div>
          )}

          {/* OPERACIONAL */}
          {(canAccess('solicitacoes') || canAccess('minhas_solicitacoes') || canAccess('separacoes') || canAccess('confronto_viagem')) && (
            <div className="mb-2">
              {!isCollapsed && <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Operacional</p>}
              
              {canAccess('solicitacoes') && renderLink("/requests", <FileText className="h-5 w-5" />, "Solicitações")}
              
              {canAccess('minhas_solicitacoes') && renderLink("/my-requests", <ShoppingCart className="h-5 w-5" />, "Meus Pedidos")}
              {canAccess('separacoes') && renderLink("/separations", <Truck className="h-5 w-5" />, "Separação")}
              {canAccess('confronto_viagem') && renderLink("/reconciliation", <ClipboardList className="h-5 w-5" />, "Confronto")}
            </div>
          )}

          {/* ADMINISTRAÇÃO */}
          {(isAdmin || canAccess('estoque_critico') || canAccess('relatorios')) && (
            <div className="mb-2">
              {!isCollapsed && <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Administração</p>}
              {canAccess('estoque_critico') && renderLink("/low-stock", <AlertTriangle className="h-5 w-5" />, "Compras & Críticos")}
              {canAccess('relatorios') && renderLink("/reports", <BarChart3 className="h-5 w-5" />, "Relatórios")}
              
              {isAdmin && (
                <>
                  {renderLink("/users", <Users className="h-5 w-5" />, "Usuários")}
                  {renderLink("/audit", <ShieldCheck className="h-5 w-5" />, "Auditoria")}
                  {renderLink("/permissions", <Lock className="h-5 w-5" />, "Permissões")}
                </>
              )}
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* RODAPÉ */}
      <div className="p-4 border-t border-border/40 bg-muted/10">
        {!isCollapsed ? (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border shadow-sm">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {profile?.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize truncate">
                  {profile?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full border-red-200/50 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => {
                signOut();
                if (onItemClick) onItemClick();
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Encerrar Sessão
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 cursor-help" title={profile?.name}>
                <User className="h-5 w-5 text-primary" />
             </div>
             <Button 
                variant="ghost" 
                size="icon"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  signOut();
                  if (onItemClick) onItemClick();
                }}
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </Button>
          </div>
        )}
      </div>
    </div>
  );
}