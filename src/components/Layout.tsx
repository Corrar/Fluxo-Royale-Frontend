import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { Button } from "./ui/button";
import { Menu } from "lucide-react"; 
import { Sheet, SheetContent } from "./ui/sheet"; // Removi SheetTrigger pois controlamos via state
import { ModeToggle } from "@/components/mode-toggle";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { profile } = useAuth();
  
  // Controle de colapso (Desktop) e visibilidade (Mobile)
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      
      {/* --- MOBILE: MENU GAVETA (SHEET) --- */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-[280px] border-r bg-card">
          {/* No mobile, o menu sempre está expandido. Passamos a função para fechar ao clicar. */}
          <Sidebar 
            isCollapsed={false} 
            toggleSidebar={() => {}} 
            onItemClick={() => setIsMobileOpen(false)} 
          />
        </SheetContent>
      </Sheet>

      {/* --- DESKTOP: SIDEBAR FIXA --- */}
      {/* 'hidden lg:flex' faz sumir no mobile e aparecer como flexbox no desktop */}
      <div className="hidden lg:flex flex-col h-full border-r bg-card transition-all duration-300">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      {/* flex-1 garante que ocupe o espaço restante */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300">
        
        {/* Header */}
        <header className="h-16 border-b border-border bg-card px-4 lg:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            
            {/* Botão Hambúrguer (Apenas Mobile) */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden -ml-2 text-muted-foreground hover:text-primary"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <h2 className="text-lg font-semibold truncate">Sistema de Fluxo</h2>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Botão de Tema */}
            <ModeToggle />

            {/* Informações do Usuário */}
            <div className="text-sm text-right hidden sm:block">
              <p className="font-medium leading-none">{profile?.name}</p>
              <p className="text-muted-foreground text-xs capitalize mt-1">{profile?.role}</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto bg-background">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}