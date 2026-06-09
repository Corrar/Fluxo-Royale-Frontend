import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings, BellRing, Megaphone, AlertTriangle, Image as ImageIcon } from "lucide-react"; 
import { useSocket } from "@/contexts/SocketContext";

// --- Importação do teu componente de Upload ---
import { ImageUpload } from "@/components/cards/ImageUpload";

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const { requestNotificationPermission } = useSocket();
  
  // --- Estados locais para o Aviso de Login ---
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementImage, setAnnouncementImage] = useState(""); 
  
  const { data: settings, isLoading, isError, error } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  // --- Preenche os estados quando os dados chegam da API ---
  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      setAnnouncementActive(settings.find((s: any) => s.key === "announcement_active")?.value === "true");
      setAnnouncementTitle(settings.find((s: any) => s.key === "announcement_title")?.value || "");
      setAnnouncementMessage(settings.find((s: any) => s.key === "announcement_message")?.value || "");
      setAnnouncementImage(settings.find((s: any) => s.key === "announcement_image")?.value || ""); 
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      await api.put("/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  // --- Função para salvar o Aviso de Login ---
  const handleSaveAnnouncement = async () => {
    try {
      await updateMutation.mutateAsync({ key: "announcement_active", value: announcementActive.toString() });
      await updateMutation.mutateAsync({ key: "announcement_title", value: announcementTitle });
      await updateMutation.mutateAsync({ key: "announcement_message", value: announcementMessage });
      await updateMutation.mutateAsync({ key: "announcement_image", value: announcementImage }); 
      toast.success("Aviso de login atualizado com sucesso!");
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-muted-foreground">A carregar configurações do sistema...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Erro de Comunicação com o Servidor
            </CardTitle>
            <CardDescription className="text-red-500/80">
              Não foi possível carregar as configurações. O teu Backend pode estar desligado ou a rota não existe.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm font-mono text-red-800 dark:text-red-400">
            Detalhes do erro: {(error as any)?.message || "Erro desconhecido"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const regularSettings = settings?.filter((s: any) => !s.key.startsWith("announcement_")) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Settings className="h-8 w-8 text-gray-700" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground">Ajuste parâmetros globais e notificações.</p>
      </div>

      <div className="grid gap-6">
        
        {/* --- CARD: GERENCIAR AVISO DE LOGIN --- */}
        <Card className="border-blue-200 dark:border-blue-900 shadow-sm overflow-hidden">
          <CardHeader className="pb-4 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Megaphone className="h-5 w-5" />
              Aviso na Tela Inicial (Poster Promocional)
            </CardTitle>
            <CardDescription>
              Configure o poster de ecrã inteiro que aparece para os utilizadores logo após o login.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Ativar Poster de Aviso</div>
                <div className="text-xs text-slate-500">
                  Se desativado, o aviso não será mostrado a ninguém.
                </div>
              </div>
              <Switch 
                checked={announcementActive}
                onCheckedChange={setAnnouncementActive}
              />
            </div>

            {/* --- BLOCO DE UPLOAD DA IMAGEM --- */}
            <div className="space-y-3 p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                <Label className="font-semibold text-slate-700 dark:text-slate-300">
                  Imagem do Poster
                </Label>
              </div>
              
              <ImageUpload 
                value={announcementImage} 
                onChange={(url) => setAnnouncementImage(url || "")} 
              />

              <p className="text-[12px] text-slate-500 pt-2">
                Faça upload de uma imagem do seu computador ou cole um URL direto. Se preenchido, o pop-up vira um poster visual lindíssimo de ecrã inteiro.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title" className="font-semibold">Título do Aviso</Label>
                <Input 
                  id="title" 
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Ex: Super Promoção de Inverno" 
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="message" className="font-semibold">Subtítulo / Descrição</Label>
                <Textarea 
                  id="message" 
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  placeholder="Detalhes adicionais do poster..." 
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <Button onClick={handleSaveAnnouncement} className="w-full sm:w-auto h-11 px-8">
              Guardar Configurações do Poster
            </Button>
          </CardContent>
        </Card>

        {/* --- CARD: NOTIFICAÇÕES (MOBILE/PUSH) --- */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Notificações do Dispositivo
            </CardTitle>
            <CardDescription>
              Permita que o sistema envie alertas mesmo com o app fechado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/20">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Ativar Notificações Push</div>
                <div className="text-xs text-muted-foreground">
                  Necessário para receber avisos em segundo plano.
                </div>
              </div>
              <Button onClick={requestNotificationPermission} variant="outline" size="sm">
                Ativar Agora
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* --- SETTINGS EXISTENTES (DO BACKEND) --- */}
        {regularSettings?.map((setting: any) => (
          <Card key={setting.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{setting.key === 'min_stock_days' ? 'Dias de Estoque Mínimo' : setting.key}</CardTitle>
              <CardDescription>{setting.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Input 
                  defaultValue={setting.value} 
                  id={`input-${setting.key}`}
                  className="max-w-md"
                />
                <Button 
                  onClick={() => {
                    const input = document.getElementById(`input-${setting.key}`) as HTMLInputElement;
                    updateMutation.mutate({ key: setting.key, value: input.value });
                    toast.success("Configuração atualizada!");
                  }}
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
