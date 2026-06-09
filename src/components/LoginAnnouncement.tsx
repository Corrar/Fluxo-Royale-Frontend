import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function LoginAnnouncement() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  useEffect(() => {
    if (settings && !isLoading) {
      const isActive = settings.find((s: any) => s.key === "announcement_active")?.value === "true";
      const hasSeen = sessionStorage.getItem("announcement_seen");

      // Mostra o pop-up se estiver ativo E se o usuário ainda não o viu nesta sessão
      if (isActive && !hasSeen) {
        setIsOpen(true);
      }
    }
  }, [settings, isLoading]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("announcement_seen", "true");
  };

  if (!settings) return null;

  // Extrai os valores guardados
  const title = settings.find((s: any) => s.key === "announcement_title")?.value;
  const message = settings.find((s: any) => s.key === "announcement_message")?.value;
  const imageUrl = settings.find((s: any) => s.key === "announcement_image")?.value;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* O segredo visual está aqui: p-0 (sem padding interior), overflow-hidden (corta a imagem arredondada nas pontas) */}
      <DialogContent className="p-0 overflow-hidden sm:max-w-[420px] rounded-[1.5rem] md:rounded-[2rem] border-none bg-white dark:bg-[#0A0A0A] shadow-2xl">
        
        {/* PARTE SUPERIOR: A IMAGEM (HERO) */}
        {imageUrl && (
          <div className="relative w-full aspect-square sm:aspect-[4/3] bg-slate-100 dark:bg-slate-900">
            <img 
              src={imageUrl} 
              alt="Anúncio Promocional" 
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')} // Oculta se a imagem falhar ao carregar
            />
            {/* Gradiente sutil em baixo da imagem para que o texto que vem a seguir não choque bruscamente */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-[#0A0A0A] to-transparent" />
          </div>
        )}

        {/* PARTE INFERIOR: TEXTO E BOTÃO */}
        <div className={`flex flex-col ${imageUrl ? 'px-8 pb-8 pt-2' : 'p-8'}`}>
          <DialogHeader className="space-y-3 text-center mb-8">
            {title && (
              <DialogTitle className="text-2xl md:text-[28px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {title}
              </DialogTitle>
            )}
            {message && (
              <DialogDescription className="text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                {message}
              </DialogDescription>
            )}
          </DialogHeader>
          
          <Button 
            onClick={handleClose} 
            className="w-full h-14 text-[16px] font-black rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all active:scale-95 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)]"
          >
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
