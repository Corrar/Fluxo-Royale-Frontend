import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetContent } from "./ui/sheet"; 
import { NavLink, useNavigate } from "react-router-dom"; 
// Importações do Menu Dropdown
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
// Novos ícones importados para a barra dinâmica e menu do usuário
import { Home, Package, FileText, Menu, Search, Settings, BarChart3, Sparkles, Eye, LogOut, UserCircle } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

// Subcomponente para os botões da Bottom Bar do Mobile
const BottomNavButton = ({ to, icon, label }: { to: string, icon: ReactNode, label: string }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all duration-300 active:scale-90 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
  >
    {({ isActive }) => (
      <>
        <div className={`relative flex items-center justify-center transition-all duration-500 ease-out ${isActive ? '-translate-y-1 scale-110 drop-shadow-md' : ''}`}>
          {icon}
        </div>
        <span className={`text-[10px] tracking-wide transition-all duration-500 ${isActive ? 'font-black opacity-100' : 'font-medium opacity-80'}`}>
          {label}
        </span>
      </>
    )}
  </NavLink>
);

export function Layout({ children }: LayoutProps) {
  // --- EXTRAÇÃO DO CANACCESS E SIGNOUT ---
  const { profile, canAccess, signOut } = useAuth();
  const isSetor = profile?.role === "setor";
  
  // --- Lógica de Navegação e Pesquisa ---
  const navigate = useNavigate(); 
  const [searchTerm, setSearchTerm] = useState("");

  const executeSearch = () => {
    if (searchTerm.trim() !== '') {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch();
      (e.target as HTMLInputElement).blur(); // Esconde o teclado no telemóvel
    }
  };
  
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // --- Lógica de Arrasto (Swipe-to-Close) para o Menu Mobile ---
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (touchStartY && touchEndY) {
      const distance = touchEndY - touchStartY;
      if (distance > 50) {
        setIsMobileOpen(false);
      }
    }
    setTouchStartY(0);
    setTouchEndY(0);
  };

  // =========================================================================
  // MÁGICA DA STATUS BAR: Sincroniza a barra do celular com o Tema do React
  // =========================================================================
  useEffect(() => {
    const updateThemeColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const metaThemeColor = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
      
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", isDark ? "#000000" : "#F8FAFC");
      }
    };

    updateThemeColor();
    const observer = new MutationObserver(updateThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // =========================================================================
  // LISTA DINÂMICA DA BARRA INFERIOR (BOTTOM NAV BAR)
  // =========================================================================
  const availableNavItems = [
    { to: isSetor ? "/stock-view" : "/inicio", icon: <Home className="h-[22px] w-[22px]" strokeWidth={2.5} />, label: "Início", allowed: true },
    { to: "/", icon: <BarChart3 className="h-[22px] w-[22px]" strokeWidth={2.5} />, label: "Dashboard", allowed: canAccess('dashboard') },
    { to: "/products", icon: <Package className="h-[22px] w-[22px]" strokeWidth={2.5} />, label: "Catálogo", allowed: canAccess('produtos') },
    { to: "/requests", icon: <FileText className="h-[22px] w-[22px]" strokeWidth={2.5} />, label: "Pedidos", allowed: canAccess('solicitacoes') },
    { to: "/tasks", icon: <Sparkles className="h-[22px] w-[22px]" strokeWidth={2.5} />, label: "Tarefas", allowed: canAccess('dashboard') },
    { to: "/stock-view", icon: <Eye className="h-[22px] w-[22px]" strokeWidth={2.5} />, label: "Consulta", allowed: canAccess('consultar') && !isSetor },
  ];

  // Filtra apenas as permitidas e pega no máximo as 4 primeiras
  const bottomNavItems = availableNavItems.filter(item => item.allowed).slice(0, 4);

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] dark:bg-[#000000] overflow-hidden font-sans selection:bg-blue-500/30 transition-colors duration-500">
      
      {/* --- DESKTOP: SIDEBAR FIXA --- */}
      <div className="hidden lg:flex flex-col h-full border-r border-slate-200/60 dark:border-white/5 bg-white dark:bg-[#0A0A0A] transition-all duration-300 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300 relative">
        
        {/* ================================================================= */}
        {/* HEADER TOP (Nível Apple iOS - Vidro Fosco & Input Nativo)         */}
        {/* ================================================================= */}
        <header className="sticky top-0 z-50 w-full flex items-center justify-between shrink-0 transition-all 
          border-b border-black/[0.05] dark:border-white/[0.05] lg:border-slate-200/60 lg:dark:border-white/5
          pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2.5 px-4 
          bg-[#F8FAFC]/70 dark:bg-[#000000]/70 backdrop-blur-[20px] saturate-[1.8]
          lg:pt-0 lg:pb-0 lg:h-[76px] lg:px-8 lg:bg-white/80 lg:dark:bg-[#0A0A0A]/80 lg:backdrop-blur-3xl">
          
          {/* --- MOBILE: Header Topo Premium (Logo + Pesquisa + Avatar) --- */}
          <div className="lg:hidden flex items-center justify-between gap-3 w-full animate-in fade-in slide-in-from-top-2 duration-700 ease-out">
            
            <div className="shrink-0 active:scale-95 transition-transform duration-200 flex items-center justify-center">
              <img 
                src="/favicon.png" 
                alt="Fluxo Royale" 
                className="h-[32px] w-[32px] object-contain drop-shadow-md dark:drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]" 
              />
            </div>
            
            <div className="flex-1 relative group">
              <div 
                className="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer z-10"
                onClick={executeSearch}
              >
                <Search 
                  className="h-[18px] w-[18px] text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors duration-300 hover:scale-110 active:scale-90" 
                  strokeWidth={2.5} 
                />
              </div>
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full h-[38px] bg-slate-100/90 dark:bg-[#1C1C1E]/90 text-slate-900 dark:text-white rounded-full pl-10 pr-4 text-[15px] font-medium tracking-tight placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white dark:focus:bg-[#2C2C2E] transition-all duration-300 border border-transparent focus:border-blue-500/30 shadow-sm relative z-0"
              />
            </div>

            {/* --- MENU DROPDOWN MOBILE (Avatar) --- */}
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none shrink-0 rounded-full">
                <div className="h-[34px] w-[34px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-[14px] shadow-[0_4px_10px_rgba(37,99,235,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] ring-[1.5px] ring-white/80 dark:ring-[#0A0A0A] active:scale-95 transition-transform duration-200">
                  {profile?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-[16px] p-2 mt-2">
                <DropdownMenuLabel className="font-bold text-slate-800 dark:text-slate-200">Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer rounded-[10px] gap-3 text-[15px] font-medium py-2.5">
                  <UserCircle className="h-5 w-5 text-slate-500" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer rounded-[10px] gap-3 text-[15px] font-medium py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10">
                  <LogOut className="h-5 w-5" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {/* --- DESKTOP: Layout Tradicional --- */}
          <div className="hidden lg:flex items-center gap-3">
            <h2 className="text-[19px] font-black tracking-tighter text-slate-800 dark:text-white leading-none pt-0.5">
              Painel de Controle
            </h2>
          </div>
          
          <div className="hidden lg:flex items-center gap-3 sm:gap-6">
            <ModeToggle />

            <div className="flex items-center gap-3 pl-5 border-l border-slate-200 dark:border-slate-800/50">
              <div className="text-right flex flex-col justify-center">
                <p className="font-bold text-[14px] leading-tight text-slate-800 dark:text-slate-100 tracking-tight">
                  {profile?.name?.split(' ')[0] || 'Usuário'}
                </p>
                <p className="text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-0.5">
                  {profile?.role?.replace('_', ' ')}
                </p>
              </div>
              
              {/* --- MENU DROPDOWN DESKTOP (Avatar) --- */}
              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none rounded-full">
                  <div className="h-[42px] w-[42px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-[16px] shadow-[0_4px_12px_rgba(37,99,235,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] ring-2 ring-white dark:ring-[#0A0A0A] relative group cursor-pointer hover:scale-105 transition-transform duration-300">
                    {profile?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-[16px] p-2 mt-1 border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                  <DropdownMenuLabel className="font-bold text-slate-800 dark:text-slate-200">Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer rounded-[10px] gap-3 text-[15px] font-medium py-2.5">
                    <UserCircle className="h-5 w-5 text-slate-500" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer rounded-[10px] gap-3 text-[15px] font-medium py-2.5 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10">
                    <LogOut className="h-5 w-5" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-0 pb-32 lg:pb-0">
          <div className="mx-auto max-w-[1600px] w-full h-full lg:p-4">
            {children}
          </div>
        </main>

        {/* --- MOBILE: BOTTOM NAV BAR --- */}
        <div className="lg:hidden fixed bottom-5 left-4 right-4 h-[72px] bg-white/80 dark:bg-[#111111]/80 backdrop-blur-3xl border border-white/40 dark:border-white/5 z-40 flex items-center justify-between px-2 shadow-[0_8px_32px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[2rem] animate-in slide-in-from-bottom-10 duration-700">
          
          {/* Mapeamento dinâmico dos botões filtrados */}
          {bottomNavItems.map((item, index) => (
            <BottomNavButton key={index} to={item.to} icon={item.icon} label={item.label} />
          ))}
          
          <button 
            onClick={() => setIsMobileOpen(true)} 
            className="flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all duration-300 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 active:scale-90 group"
          >
            <div className="relative flex items-center justify-center transition-all duration-300 group-hover:scale-110">
              <Menu className="h-[22px] w-[22px]" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-medium tracking-wide opacity-80 group-hover:opacity-100">Menu</span>
          </button>
        </div>

        {/* --- MOBILE: BOTTOM SHEET (Menu Gaveta Interativo) --- */}
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetContent 
            side="bottom" 
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="p-0 h-[92vh] rounded-t-[2.5rem] border-none shadow-[0_-20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_-20px_60px_rgba(0,0,0,0.8)] bg-slate-50 dark:bg-[#050505] flex flex-col focus:outline-none overflow-hidden animate-in slide-in-from-bottom-full duration-500"
          >
            {/* ÁREA DE TOQUE PARA ARRASTAR (Swipe-to-Close) */}
            <div 
              className="relative flex flex-col items-center justify-center pt-3 pb-2 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 z-10 cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* O Puxador (Handle) */}
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/60 rounded-full mb-4"></div>
              
              {/* Configurações dentro da área de arrasto */}
              <div className="w-full flex items-center justify-between px-6 pb-2">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-300">Aparência</span>
                </div>
                <div className="opacity-80 hover:opacity-100 transition-opacity active:scale-95">
                  <ModeToggle />
                </div>
              </div>
            </div>
            
            {/* Conteúdo do Menu (Sidebar) */}
            <Sidebar 
              isCollapsed={false} 
              toggleSidebar={() => {}} 
              onItemClick={() => setIsMobileOpen(false)} 
              isMobileMenu={true} 
            />
          </SheetContent>
        </Sheet>
        
      </div>
    </div>
  );
}
