import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Sheet, SheetContent } from "./ui/sheet"; 
import { NavLink } from "react-router-dom";
import { Home, Package, FileText, Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

// Subcomponente para os botões da Bottom Bar do Mobile sem fundo nos ícones
const BottomNavButton = ({ to, icon, label }: { to: string, icon: ReactNode, label: string }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all duration-300 active:scale-90 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
  >
    {({ isActive }) => (
      <>
        {/* Apenas o ícone com o efeito de pulo, sem quadrado de fundo */}
        <div className={`relative flex items-center justify-center transition-all duration-300 ${isActive ? '-translate-y-1 scale-110 drop-shadow-md' : ''}`}>
          {icon}
        </div>
        <span className={`text-[10px] tracking-wide transition-all ${isActive ? 'font-black opacity-100' : 'font-medium opacity-80'}`}>
          {label}
        </span>
      </>
    )}
  </NavLink>
);

export function Layout({ children }: LayoutProps) {
  const { profile } = useAuth();
  
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#F7F7F9] dark:bg-[#0A0A0A] overflow-hidden font-sans selection:bg-emerald-500/30 transition-colors duration-500">
      
      {/* --- DESKTOP: SIDEBAR FIXA --- */}
      <div className="hidden lg:flex flex-col h-full border-r border-slate-200/60 dark:border-white/5 bg-white dark:bg-[#111111] transition-all duration-300 z-20">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300 relative">
        
        {/* HEADER TOP (Híbrido) */}
        <header className="h-[72px] sticky top-0 border-b border-slate-200/60 dark:border-white/5 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl px-5 lg:px-8 flex items-center justify-between shrink-0 z-30 transition-all">
          
          {/* Mobile: Mostra Perfil ao invés do Menu Hamburger */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-gradient-to-tr from-emerald-400 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Olá,</span>
              <span className="text-[16px] font-black text-slate-800 dark:text-white leading-none tracking-tight">
                {profile?.name?.split(' ')[0] || 'Usuário'}
              </span>
            </div>
          </div>

          {/* Desktop: Logo Centralizada (opcional) ou Espaço */}
          <div className="hidden lg:flex items-center gap-3">
            <h2 className="text-[19px] font-black tracking-tight text-slate-800 dark:text-white">
              Painel de Controle
            </h2>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-5">
            <ModeToggle />

            {/* Desktop: Avatar & Info */}
            <div className="hidden lg:flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right flex flex-col justify-center">
                <p className="font-bold text-[14px] leading-tight text-slate-800 dark:text-slate-100 tracking-tight">
                  {profile?.name?.split(' ')[0] || 'Usuário'}
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">
                  {profile?.role?.replace('_', ' ')}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-bold text-[15px] shadow-sm ring-2 ring-white dark:ring-[#0A0A0A]">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-0 pb-32 lg:pb-0">
          <div className="mx-auto max-w-7xl w-full h-full p-4 lg:p-8">
            {children}
          </div>
        </main>

        {/* --- MOBILE: BOTTOM NAV BAR (ESTILO FLUTUANTE PREMIUM) --- */}
        <div className="lg:hidden fixed bottom-5 left-4 right-4 h-[72px] bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl border border-white/40 dark:border-white/10 z-40 flex items-center justify-between px-2 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[28px]">
          <BottomNavButton to="/inicio" icon={<Home className="h-6 w-6" strokeWidth={2.2} />} label="Início" />
          <BottomNavButton to="/products" icon={<Package className="h-6 w-6" strokeWidth={2.2} />} label="Estoque" />
          <BottomNavButton to="/requests" icon={<FileText className="h-6 w-6" strokeWidth={2.2} />} label="Pedidos" />
          
          <button 
            onClick={() => setIsMobileOpen(true)} 
            className="flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all duration-300 text-slate-400 hover:text-emerald-500 active:scale-90"
          >
            <div className="relative flex items-center justify-center transition-all duration-300">
              <Menu className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <span className="text-[10px] font-medium tracking-wide opacity-80">Menu</span>
          </button>
        </div>

        {/* --- MOBILE: BOTTOM SHEET (Menu Completo Gaveta) --- */}
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetContent 
            side="bottom" 
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="p-0 h-[92vh] rounded-t-[36px] border-none shadow-[0_-20px_60px_rgba(0,0,0,0.2)] bg-slate-50 dark:bg-[#0A0A0A] flex flex-col focus:outline-none overflow-hidden"
          >
            {/* Pílula de arrasto (Handle) */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/60 rounded-full mx-auto mt-4 shrink-0"></div>
            
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
