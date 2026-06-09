import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // <-- Adicionado
import { Switch } from "@/components/ui/switch"; // <-- Adicionado
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings, BellRing, Megaphone } from "lucide-react"; // <-- Megaphone adicionado
import { useSocket } from "@/contexts/SocketContext";

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const { requestNotificationPermission } = useSocket();
  
  // --- Estados locais para o Aviso de Login ---
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  // --- Preenche os estados quando os dados chegam da API ---
  useEffect(() => {
    if (settings) {
      setAnnouncementActive(settings.find((s: any) => s.key === "announcement_active")?.value === "true");
      setAnnouncementTitle(settings.find((s: any) => s.key === "announcement_title")?.value || "");
      setAnnouncementMessage(settings.find((s: any) => s.key === "announcement_message")?.value || "");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      await api.put("/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configuração salva!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  // --- Função para salvar o Aviso de Login ---
  const handleSaveAnnouncement = async () => {
    try {
      // Usamos mutateAsync para esperar que as 3 chamadas terminem
      await updateMutation.mutateAsync({ key: "announcement_active", value: announcementActive.toString() });
      await updateMutation.mutateAsync({ key: "announcement_title", value: announcementTitle });
      await updateMutation.mutateAsync({ key: "announcement_message", value: announcementMessage });
      toast.success("Aviso de login atualizado com sucesso!");
    } catch (error) {
      // O erro já é tratado pelo onError da mutation
    }
  };

  if (isLoading) return <div>Carregando...</div>;

  // Filtra as configurações para não repetir as chaves do anúncio na listagem geral
  const regularSettings = settings?.filter((s: any) => !s.key.startsWith("announcement_"));

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
        
        {/* --- NOVO CARD: GERENCIAR AVISO DE LOGIN --- */}
        <Card className="border-blue-200 dark:border-blue-900 shadow-sm">
          <CardHeader className="pb-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Megaphone className="h-5 w-5" />
              Aviso na Tela Inicial (Pop-up)
            </CardTitle>
            <CardDescription>
              Configure um alerta que aparece para os utilizadores logo após o login.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Ativar Aviso Pop-up</div>
                <div className="text-xs text-muted-foreground">
                  Se desativado, o aviso não será mostrado a ninguém.
                </div>
              </div>
              <Switch 
                checked={announcementActive}
                onCheckedChange={setAnnouncementActive}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título do Aviso</Label>
              <Input 
                id="title" 
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Ex: Manutenção Programada" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem do Aviso</Label>
              <Textarea 
                id="message" 
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Escreva os detalhes do aviso aqui..." 
                className="min-h-[100px]"
              />
            </div>

            <Button onClick={handleSaveAnnouncement} className="w-full sm:w-auto">
              Guardar Configurações do Aviso
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
