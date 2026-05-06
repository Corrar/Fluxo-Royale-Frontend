import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, Package, ShoppingCart, FileText, Users, BarChart3, LogOut, 
  Calculator, Eye, ClipboardList, Bell, ChevronLeft, ChevronRight,
  AlertTriangle, ShieldCheck, Lock, Sparkles, Kanban, Zap, ChevronDown, Search, ArrowUpCircle,
  Briefcase, RefreshCw, ArchiveRestore, Terminal, Building2,
  Printer, ArrowLeftRight // <-- Novos ícones para o Módulo 3D
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Input } from "./ui/input";

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  onItemClick?: () => void;
  isMobileMenu?: boolean;
}

// --- 📱 CARTÃO DE ACESSO RÁPIDO (Formato Quadrado Maior) ---
const QuickAccessCard = ({ to, icon, label, onClick }: any) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink 
      to={to} 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center w-full aspect-square gap-3 p-4 rounded-[28px] transition-all active:scale-95 border box-border ${isActive ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-[#1A1A1A] dark:border-white/10 dark:hover:bg-white/10'}`}
    >
      <div className={`transition-all duration-300 ${isActive ? 'text-emerald-600 dark:text-emerald-400 scale-110 drop-shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
        {icon}
      </div>
      <span className={`text-[12px] font-black tracking-wide text-center leading-tight w-full truncate px-1 ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
        {label}
      </span>
    </NavLink>
  );
};

// --- 🗂️ COMPONENTE DE GRUPO ---
const NavGroup = ({ title, isCollapsed, isMobileMenu, children }: { title: string; isCollapsed: boolean; isMobileMenu?: boolean; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (isMobileMenu) {
    return (
      <div className="mb-6 px-4 w-full box-border">
        <h3 className="text-[13px] font-black text-slate-500 dark:text-slate-400 mb-3 px-2 tracking-tight uppercase">
          {title}
        </h3>
        <div className="flex flex-col gap-2.5 w-full box-border">
          {children}
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="mb-2">
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 mb-1 rounded-[16px] group hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-200 active:scale-[0.98] outline-none"
      >
        <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
          {title}
        </span>
        <ChevronDown 
          className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : "rotate-0"}`} 
          strokeWidth={2.5} 
        />
      </button>
      <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
        {children}
      </div>
    </div>
  );
};

export function Sidebar({ isCollapsed, toggleSidebar, onItemClick, isMobileMenu }: SidebarProps) {
  const { profile, signOut, canAccess } = useAuth();
  const { unreadCount } = useSocket(); 
  const location = useLocation();
  const navigate = useNavigate(); // <-- Instanciado para podermos trocar de módulo

  // Papéis Base (Algumas rotas dependem da Home principal e ferramentas de admin puro)
  const isAdmin = profile?.role === "admin";
  const isSetor = profile?.role === "setor";

  // --- LÓGICA DE CONTROLE DE MÓDULOS (ESTOQUE vs 3D) ---
  const has3DAccess = isAdmin || profile?.role === "prototipo" || profile?.role === "engenharia";
  const is3DModuleActive = location.pathname.startsWith('/producao-3d');

  const toggleModule = () => {
    if (is3DModuleActive) {
       navigate('/inicio'); // Volta para o ERP
    } else {
       navigate('/producao-3d'); // Vai para a Fábrica 3D
    }
  };
  // -----------------------------------------------------

  // Agrupamentos dinâmicos (Verificam se há pelo menos uma permissão para mostrar o bloco todo)
  const showEstoqueGroup = canAccess('produtos') || canAccess('estoque') || canAccess('consultar');
  const showOperacionalGroup = canAccess('solicitacoes') || canAccess('minhas_solicitacoes') || canAccess('separacoes') || canAccess('reposicoes') || canAccess('confronto_viagem');
  const showAdminGroup = canAccess('clientes') || canAccess('office_dashboard') || canAccess('estoque_critico') || canAccess('relatorios') || canAccess('usuarios') || canAccess('logs') || canAccess('permissoes') || isAdmin;

  const desktopBaseClass = "flex items-center gap-3.5 rounded-[14px] px-3.5 py-3 text-[15px] font-semibold transition-all duration-200 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-white/5 active:scale-[0.98] group relative";
  const desktopActiveClass = "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-500/10";

  const formatBadgeCount = (count: number) => {
    if (!count || count <= 0) return null;
    return count > 9 ? "9+" : count;
  };

  const renderLink = (to: string, icon: React.ReactNode, label: string) => {
    const isRequestsRoute = to === "/requests";
    const hasCount = unreadCount > 0;
    const showBadge = isRequestsRoute && hasCount;
    const isActive = location.pathname === to;
    
    // --- LINK MODO MOBILE ---
    if (isMobileMenu) {
      return (
        <NavLink 
          to={to} 
          onClick={onItemClick} 
          className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all duration-200 active:scale-[0.98] box-border border ${isActive ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 shadow-sm' : 'bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/10 shadow-sm hover:border-slate-300 dark:hover:border-white/20'}`}
        >
          <div className="flex items-center min-w-0 flex-1 pr-4">
            <span className={`font-extrabold text-[18px] truncate tracking-tight ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {label}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {showBadge && (
              <span className="bg-red-500 text-white text-[12px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                {formatBadgeCount(unreadCount)}
              </span>
            )}
            <div className={`transition-colors shrink-0 ${isActive ? 'text-emerald-500 drop-shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
              {icon}
            </div>
          </div>
        </NavLink>
      );
    }

    // --- LINK MODO DESKTOP ---
    return (
      <NavLink 
        to={to} 
        className={`${desktopBaseClass} ${isActive ? desktopActiveClass : ''} ${isCollapsed ? "justify-center px-0 w-[48px] h-[48px] mx-auto" : ""}`}
        title={isCollapsed ? label : ""}
        onClick={onItemClick}
      >
        <div className="relative flex items-center justify-center shrink-0">
          <div className="transition-transform group-active:scale-90 duration-200">
            {icon}
          </div>
          {showBadge && isCollapsed && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-[#111111]"></span>
            </span>
          )}
        </div>
        {!isCollapsed && (
          <>
            <span className="truncate flex-1 tracking-tight">
              {label}
            </span>
            {showBadge && (
              <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-[11px] font-black text-white shadow-sm animate-in zoom-in duration-300 shrink-0">
                {formatBadgeCount(unreadCount)}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  const scrollToTop = () => {
    const el = document.getElementById('mobile-menu-top');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`flex flex-col h-full transition-all duration-300 overflow-x-hidden ${isMobileMenu ? "w-full bg-transparent" : isCollapsed ? "w-[88px] bg-white dark:bg-[#111111]" : "w-[280px] bg-white dark:bg-[#111111]"}`}>
      
      {/* CABEÇALHO */}
      {!isMobileMenu ? (
        <div className={`h-[72px] flex items-center ${isCollapsed ? "justify-center" : "justify-between px-6"} shrink-0`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-10 w-10 flex items-center justify-center shrink-0 rounded-[12px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                <img src="/favicon.png" alt="Logo" className="h-6 w-6 object-contain hover:scale-105 transition-transform duration-300" />
              </div>
              <h1 className="text-[18px] font-black tracking-tight text-slate-900 dark:text-white leading-none">Fluxo Royale</h1>
            </div>
          )}
          <Button 
            variant="ghost" size="icon" 
            className={`text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full h-9 w-9 transition-colors ${isCollapsed ? "" : "hidden lg:flex"}`} 
            onClick={toggleSidebar}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" strokeWidth={2.5} /> : <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />}
          </Button>
        </div>
      ) : (
        <div className="px-6 py-4 shrink-0 flex flex-col w-full box-border" id="mobile-menu-top">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight w-full text-center">
            Menu
          </h2>
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" strokeWidth={2.5} />
            <Input 
              placeholder="O que você precisa?" 
              className="pl-12 pr-4 h-14 rounded-[20px] bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 font-bold text-[15px] shadow-sm focus-visible:ring-emerald-500/20 w-full" 
            />
          </div>
        </div>
      )}

      {/* --- BOTÃO TOGGLE DE MÓDULO --- */}
      {has3DAccess && (
        <div className={`px-4 mt-2 mb-2 ${isCollapsed && !isMobileMenu ? "flex justify-center px-2" : ""}`}>
           <button
             onClick={toggleModule}
             title={is3DModuleActive ? "Ir para Estoque ERP" : "Ir para Produção 3D"}
             className={`flex items-center border border-emerald-200 dark:border-emerald-500/30 transition-all duration-200 active:scale-95 shadow-sm 
               ${is3DModuleActive ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-white dark:bg-[#1A1A1A] hover:bg-emerald-50 dark:hover:bg-white/5"}
               ${isCollapsed && !isMobileMenu ? "w-12 h-12 justify-center rounded-[16px]" : "w-full justify-between p-3 rounded-[16px]"}
             `}
           >
             <div className="flex items-center gap-3">
               {is3DModuleActive ? (
                 <Printer className="text-emerald-600 dark:text-emerald-400 h-5 w-5" strokeWidth={2.5} />
               ) : (
                 <Package className="text-emerald-600 dark:text-emerald-400 h-5 w-5" strokeWidth={2.5} />
               )}
               
               {!isCollapsed && !isMobileMenu && (
                 <span className="font-bold text-[13px] text-emerald-700 dark:text-emerald-400">
                    {is3DModuleActive ? 'Módulo: Produção 3D' : 'Módulo: Estoque ERP'}
                 </span>
               )}
             </div>
             {!isCollapsed && !isMobileMenu && (
                <ArrowLeftRight className="h-4 w-4 text-emerald-500 opacity-60" strokeWidth={2.5} />
             )}
           </button>
        </div>
      )}

      {/* NAVEGAÇÃO INTERNA */}
      <ScrollArea className={`flex-1 custom-scrollbar ${isMobileMenu ? "px-0 w-full" : "py-4 px-3"}`}>
        <nav className="flex flex-col gap-1 pb-10 w-full box-border">
          
          {!is3DModuleActive ? (
            /* ========================================== */
            /* MÓDULO: ESTOQUE E ERP PRINCIPAL            */
            /* ========================================== */
            <>
              {/* ACESSO RÁPIDO (Apenas Mobile) */}
              {isMobileMenu && (
                <div className="mb-6 mt-2 w-full">
                  <span className="text-[13px] font-black text-slate-500 dark:text-slate-400 mb-4 block px-6 tracking-tight uppercase">Acesso Rápido</span>
                  <div className="grid grid-cols-2 gap-3 px-5">
                    {canAccess('produtos') && <QuickAccessCard to="/products" icon={<Package className="h-8 w-8"/>} label="Produtos" onClick={onItemClick} />}
                    {(canAccess('solicitacoes') || canAccess('minhas_solicitacoes')) && <QuickAccessCard to="/requests" icon={<FileText className="h-8 w-8"/>} label="Pedidos" onClick={onItemClick} />}
                    {isAdmin && <QuickAccessCard to="/dev-dashboard" icon={<Terminal className="h-8 w-8 text-blue-500"/>} label="Painel TI" onClick={onItemClick} />}
                    {canAccess('dashboard') && <QuickAccessCard to="/tasks" icon={<Sparkles className="h-8 w-8"/>} label="Tarefas" onClick={onItemClick} />}
                  </div>
                </div>
              )}

              {/* SESSÃO PRINCIPAL */}
              {isMobileMenu ? (
                <NavGroup title="Principal" isCollapsed={isCollapsed} isMobileMenu={isMobileMenu}>
                  {renderLink(isSetor ? "/stock-view" : "/inicio", <Home className="h-6 w-6" strokeWidth={2.2} />, "Início")}
                  {canAccess('dashboard') && renderLink("/", <BarChart3 className="h-6 w-6" strokeWidth={2.2} />, "Dashboard")}
                  {canAccess('dashboard') && renderLink("/tasks", <Sparkles className="h-6 w-6" strokeWidth={2.2} />, "Quadro de Tarefas")}
                  {canAccess('tarefas_eletrica') && renderLink("/tasks-eletrica", <Zap className="h-6 w-6 text-amber-500" strokeWidth={2.2} />, "Quadro Elétrica")}
                  {canAccess('avisos') && renderLink("/reminders", <Bell className="h-6 w-6" strokeWidth={2.2} />, "Avisos")}
                  {canAccess('calculadora') && renderLink("/calculator", <Calculator className="h-6 w-6" strokeWidth={2.2} />, "Calculadora")}
                </NavGroup>
              ) : (
                <div className="px-2">
                  {renderLink(isSetor ? "/stock-view" : "/inicio", <Home className="h-[22px] w-[22px]" strokeWidth={2.2} />, "Início")}
                  {canAccess('dashboard') && renderLink("/", <BarChart3 className="h-[22px] w-[22px]" strokeWidth={2.2} />, "Dashboard")}
                  {canAccess('dashboard') && renderLink("/tasks", <Sparkles className="h-[22px] w-[22px]" strokeWidth={2.2} />, "Quadro de Tarefas")}
                  {canAccess('tarefas_eletrica') && renderLink("/tasks-eletrica", <Zap className="h-[22px] w-[22px] text-amber-500" strokeWidth={2.2} />, "Quadro Elétrica")}
                  {canAccess('avisos') && renderLink("/reminders", <Bell className="h-[22px] w-[22px]" strokeWidth={2.2} />, "Avisos")}
                  {canAccess('calculadora') && renderLink("/calculator", <Calculator className="h-[22px] w-[22px]" strokeWidth={2.2} />, "Calculadora")}
                </div>
              )}

              {!isCollapsed && !isMobileMenu && <div className="h-6" />}
              {isCollapsed && !isMobileMenu && <div className="h-2" />}

              {/* GESTÃO ESTOQUE */}
              {showEstoqueGroup && (
                <NavGroup title="Estoque" isCollapsed={isCollapsed} isMobileMenu={isMobileMenu}>
                  <div className={!isMobileMenu ? "px-2" : "flex flex-col gap-2.5 w-full"}>
                    {canAccess('produtos') && renderLink("/products", <Package className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Catálogo")}
                    {canAccess('estoque') && renderLink("/stock", <ShoppingCart className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Movimentação")}
                    {canAccess('consultar') && renderLink("/stock-view", <Eye className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Visão Geral")}
                  </div>
                </NavGroup>
              )}

              {!isCollapsed && !isMobileMenu && showEstoqueGroup && <div className="h-2" />}

              {/* OPERACIONAL */}
              {showOperacionalGroup && (
                <NavGroup title="Operacional" isCollapsed={isCollapsed} isMobileMenu={isMobileMenu}>
                  <div className={!isMobileMenu ? "px-2" : "flex flex-col gap-2.5 w-full"}>
                    {canAccess('solicitacoes') && renderLink("/requests", <FileText className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Solicitações")}
                    {canAccess('minhas_solicitacoes') && renderLink("/my-requests", <ShoppingCart className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Meus Pedidos")}
                    {canAccess('separacoes') && renderLink("/separations", <Kanban className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Quadro Gestão")}
                    {canAccess('reposicoes') && renderLink("/replenishments", <RefreshCw className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Reposições")}
                    {canAccess('confronto_viagem') && renderLink("/reconciliation", <ClipboardList className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Confronto")}
                  </div>
                </NavGroup>
              )}

              {!isCollapsed && !isMobileMenu && showOperacionalGroup && <div className="h-2" />}

              {/* ADMINISTRAÇÃO */}
              {showAdminGroup && (
                <NavGroup title="Gestão Admin" isCollapsed={isCollapsed} isMobileMenu={isMobileMenu}>
                  <div className={!isMobileMenu ? "px-2" : "flex flex-col gap-2.5 w-full"}>
                    
                    {/* --- MENU DE CLIENTES E OPS --- */}
                    {canAccess('clientes') && renderLink("/clientes", <Building2 className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Clientes e OPs")}

                    {canAccess('office_dashboard') && renderLink("/office-exits", <Briefcase className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Controle de Saída")}
                    {canAccess('estoque_critico') && renderLink("/low-stock", <AlertTriangle className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Críticos")}
                    {canAccess('relatorios') && renderLink("/reports", <BarChart3 className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Relatórios")}
                    
                    {canAccess('usuarios') && renderLink("/users", <Users className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Usuários")}
                    {canAccess('logs') && renderLink("/audit", <ShieldCheck className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Auditoria")}
                    {canAccess('permissoes') && renderLink("/permissions", <Lock className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Permissões")}

                    {isAdmin && (
                      <>
                        {renderLink("/dev-dashboard", <Terminal className={isMobileMenu ? "h-6 w-6 text-blue-500" : "h-[22px] w-[22px] text-blue-500"} strokeWidth={2.2} />, "Painel TI")}
                        {renderLink("/produtos-arquivados", <ArchiveRestore className={isMobileMenu ? "h-6 w-6" : "h-[22px] w-[22px]"} strokeWidth={2.2} />, "Arquivo Morto")}
                      </>
                    )}
                  </div>
                </NavGroup>
              )}
            </>
          ) : (
            /* ========================================== */
            /* MÓDULO: PRODUÇÃO 3D                        */
            /* ========================================== */
            <>
              <NavGroup title="Fábrica 3D" isCollapsed={isCollapsed} isMobileMenu={isMobileMenu}>
                <div className={!isMobileMenu ? "px-2" : "flex flex-col gap-2.5 w-full"}>
                  {renderLink("/producao-3d", <BarChart3 className={isMobileMenu ? "h-6 w-6 text-emerald-500" : "h-[22px] w-[22px] text-emerald-500"} strokeWidth={2.2} />, "Dashboard Operacional")}
                  {renderLink("/producao-3d/demandas", <Kanban className={isMobileMenu ? "h-6 w-6 text-orange-500" : "h-[22px] w-[22px] text-orange-500"} strokeWidth={2.2} />, "Quadro de Demandas")}
                  {renderLink("/producao-3d/catalogo", <Package className={isMobileMenu ? "h-6 w-6 text-blue-500" : "h-[22px] w-[22px] text-blue-500"} strokeWidth={2.2} />, "Catálogo de Peças")}
                </div>
              </NavGroup>
            </>
          )}

          {/* BOTÕES DE AÇÃO RODAPÉ MOBILE */}
          {isMobileMenu && (
            <div className="px-6 mt-6 mb-12 flex flex-col gap-4 w-full box-border">
              <Button 
                variant="outline" 
                className="w-full h-14 rounded-[18px] font-bold text-[16px] text-emerald-600 bg-white border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 active:scale-95 shadow-sm" 
                onClick={scrollToTop}
              >
                <ArrowUpCircle className="h-6 w-6 mr-2" strokeWidth={2.5} /> Voltar ao Topo
              </Button>
              
              <Button 
                variant="ghost" 
                className="w-full h-14 rounded-[18px] font-bold text-[16px] text-red-500 bg-white border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 hover:bg-red-50 hover:text-red-600 active:scale-95 shadow-sm"
                onClick={() => { signOut(); if (onItemClick) onItemClick(); }}
              >
                <LogOut className="h-6 w-6 mr-2" strokeWidth={2.5} /> Sair da Conta
              </Button>
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* RODAPÉ DESKTOP */}
      {!isMobileMenu && (
        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent shrink-0">
          {!isCollapsed ? (
            <button 
              onClick={() => { signOut(); if (onItemClick) onItemClick(); }}
              className="flex items-center gap-3 p-3 w-full rounded-[20px] transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-500/10 group active:scale-[0.98] border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
            >
              <div className="h-10 w-10 rounded-[14px] bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-red-100 dark:group-hover:bg-red-500/20 transition-colors">
                <LogOut className="h-5 w-5 text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" strokeWidth={2.5} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[14px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">Sair da Conta</p>
                <p className="text-[11px] font-medium text-slate-400 truncate">Encerrar sessão</p>
              </div>
            </button>
          ) : (
            <div className="flex justify-center">
               <button 
                  className="h-12 w-12 rounded-[16px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-90 transition-all"
                  onClick={() => { signOut(); if (onItemClick) onItemClick(); }}
                  title="Sair"
                >
                  <LogOut className="h-6 w-6" strokeWidth={2.5} />
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}