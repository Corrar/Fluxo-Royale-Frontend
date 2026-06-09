import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

export function LoginAnnouncement() {
  const [isOpen, setIsOpen] = useState(false);

  // 1. Procuramos as configurações globais (usando React Query)
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  useEffect(() => {
    if (settings && !isLoading) {
      // 2. Extraímos os valores das configurações
      const isActive = settings.find((s: any) => s.key === "announcement_active")?.value === "true";
      
      // 3. Verificamos se o utilizador já viu o aviso nesta sessão
      const hasSeen = sessionStorage.getItem("announcement_seen");

      // Se estiver ativo e o utilizador ainda não viu, abrimos o modal
      if (isActive && !hasSeen) {
        setIsOpen(true);
      }
    }
  }, [settings, isLoading]);

  const handleClose = () => {
    setIsOpen(false);
    // 4. Marcamos como visto na sessão atual para não voltar a aparecer até ele fechar o navegador
    sessionStorage.setItem("announcement_seen", "true");
  };

  // Se não houver dados, não renderizamos nada
  if (!settings) return null;

  const title = settings.find((s: any) => s.key === "announcement_title")?.value || "Aviso Importante";
  const message = settings.find((s: any) => s.key === "announcement_message")?.value || "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xl">
            <Megaphone className="h-6 w-6" />
            {title}
          </DialogTitle>
          {/* Usamos whitespace-pre-wrap para respeitar as quebras de linha que o admin escrever */}
          <DialogDescription className="pt-4 text-base whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6">
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
