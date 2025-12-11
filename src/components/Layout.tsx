import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { Button } from "./ui/button";
import { Menu } from "lucide-react"; // Removi LogOut da importação
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ModeToggle } from "@/components/mode-toggle";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { profile } = useAuth();
  
  // Estado para controlar o menu lateral
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden fixed top-4 left-4 z-50">
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-auto">
          {/* No mobile, passamos false/vazio pois o Sheet controla a visibilidade */}
          <Sidebar isCollapsed={false} toggleSidebar={() => {}} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      {/* MUDANÇA IMPORTANTE: Removi 'w-64' fixo. O componente Sidebar define a largura agora. */}
      <div className="hidden lg:block shrink-0 transition-all duration-300">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleSidebar={() => setSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>

      {/* Main Content Wrapper */}
      {/* flex-1 garante que ele ocupe todo o espaço restante quando o menu encolher */}
      <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300">
        
        {/* Header */}
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold ml-10 lg:ml-0">Sistema de Controle de Fluxo</h2>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Botão de Tema */}
            <ModeToggle />

            {/* Informações do Usuário (Opcional, pode manter ou remover) */}
            <div className="text-sm text-right hidden sm:block">
              <p className="font-medium">{profile?.name}</p>
              <p className="text-muted-foreground text-xs capitalize">{profile?.role}</p>
            </div>
            
            {/* MUDANÇA: Botão de Sair (LogOut) removido daqui, pois já está no Sidebar */}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}