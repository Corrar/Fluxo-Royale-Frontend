import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

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
      const imageUrl = settings.find((s: any) => s.key === "announcement_image")?.value;
      const hasSeen = sessionStorage.getItem("announcement_seen");

      // Mostra o pop-up APENAS se estiver ativo, se não tiver sido visto E se houver imagem carregada
      if (isActive && !hasSeen && imageUrl) {
        setIsOpen(true);
      }
    }
  }, [settings, isLoading]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("announcement_seen", "true");
  };

  if (!settings) return null;

  const imageUrl = settings.find((s: any) => s.key === "announcement_image")?.value;

  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      {/* [&>button]:hidden esconde o botão de fechar padrão para usarmos o nosso flutuante */}
      <DialogContent className="p-0 border-none bg-transparent shadow-none sm:max-w-[460px] flex flex-col items-center [&>button]:hidden">
        
        {/* Botão de Fechar (X) flutuante acima da imagem */}
        <div className="w-full flex justify-end mb-3 z-50">
          <button 
            onClick={handleClose}
            className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white p-2.5 rounded-full transition-all duration-200 active:scale-90 shadow-lg border border-white/10"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Poster (A Imagem) */}
        <div className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl">
          <img 
            src={imageUrl} 
            alt="Poster Promocional" 
            className="w-full h-auto max-h-[80vh] object-cover"
            onError={handleClose} // Fecha automaticamente se o link da imagem quebrar
          />
        </div>
        
      </DialogContent>
    </Dialog>
  );
}
