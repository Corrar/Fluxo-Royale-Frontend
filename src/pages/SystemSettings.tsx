import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings, BellRing } from "lucide-react";
import { useSocket } from "@/contexts/SocketContext";

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const { requestNotificationPermission } = useSocket();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

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

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Settings className="h-8 w-8 text-gray-700" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground">Ajuste parâmetros globais e notificações.</p>
      </div>

      <div className="grid gap-4">
        {/* --- NOVO CARD: NOTIFICAÇÕES (MOBILE/PUSH) --- */}
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
        {settings?.map((setting: any) => (
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
