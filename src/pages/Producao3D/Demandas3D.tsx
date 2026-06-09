import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Package, User, Hash, Loader2, Trash2, CheckCircle2, 
  AlertTriangle, Printer, Play, ChevronRight, Clock, Info
} from "lucide-react";
import { toast } from "sonner";

// Tipos
type DemandStatus = "Em análise" | "Aceita" | "Em desenvolvimento" | "Concluída" | "Rejeitada";

// Estilos Minimalistas Premium
const priorityStyles: Record<string, string> = {
  Baixa: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  Média: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  Alta: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  Urgente: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

export default function Demandas3D() {
  const queryClient = useQueryClient();
  
  const [actionDemand, setActionDemand] = useState<{id: string, type: 'conclude' | 'reject'} | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("fila");

  // 1. Busca Demandas
  const { data: demands = [], isLoading: loadingDemands } = useQuery({
    queryKey: ["demands-3d"],
    queryFn: async () => (await api.get("/producao-3d/demands")).data,
    refetchInterval: 5000,
  });

  // 2. Busca Produtos
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await api.get("/products")).data,
  });

  // 3. Mutação de Status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: DemandStatus; reason?: string }) => {
      return api.put(`/producao-3d/demands/${id}/status`, { status, rejection_reason: reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demands-3d"] });
      queryClient.invalidateQueries({ queryKey: ["products-active"] });
      queryClient.invalidateQueries({ queryKey: ["stock-all"] }); 
      
      if (variables.status === "Concluída") {
        toast.success("Produção finalizada com sucesso!");
      } else if (variables.status === "Rejeitada") {
        toast.success("Demanda recusada e arquivada.");
      }
      
      setActionDemand(null);
      setRejectionReason("");
    },
    onError: () => toast.error("Erro ao processar a peça."),
  });

  // Organização dos dados
  const groupedDemands = useMemo(() => {
    return {
      fila: demands.filter((d: any) => d.status === "Em análise" || d.status === "Aceita"),
      produzindo: demands.filter((d: any) => d.status === "Em desenvolvimento"),
      historico: demands.filter((d: any) => d.status === "Concluída" || d.status === "Rejeitada"),
    };
  }, [demands]);

  // Ações Elegantes
  const getActionConfig = (status: DemandStatus) => {
    switch (status) {
      case "Em análise":
        return { label: "Aceitar Pedido", next: "Aceita" as DemandStatus, icon: CheckCircle2, color: "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20" };
      case "Aceita":
        return { label: "Iniciar Produção", next: "Em desenvolvimento" as DemandStatus, icon: Play, color: "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20" };
      case "Em desenvolvimento":
        return { label: "Finalizar Peça", next: "Concluída" as DemandStatus, icon: Printer, color: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20", isModal: true };
      default:
        return null;
    }
  };

  const handleAction = (demandId: string, currentStatus: DemandStatus) => {
    const config = getActionConfig(currentStatus);
    if (!config) return;

    if (config.isModal) {
      setActionDemand({ id: demandId, type: 'conclude' });
    } else {
      updateStatusMutation.mutate({ id: demandId, status: config.next });
    }
  };

  if (loadingDemands || loadingProducts) {
    return (
      <div className="p-6 md:p-10 space-y-6 h-[calc(100vh-120px)] w-full">
        <Skeleton className="h-10 w-48 rounded-full dark:bg-white/5 mx-auto mb-10" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-full h-24 rounded-[24px] dark:bg-white/5" />)}
      </div>
    );
  }

  // --- LINHA DE DESIGN (FULL WIDTH GRID) ---
  const DemandRow = ({ demand }: { demand: any }) => {
    const product = products.find((p: any) => p.id === demand.partId);
    const actionConfig = getActionConfig(demand.status);
    const isHistory = demand.status === "Concluída" || demand.status === "Rejeitada";

    return (
      <div className="group relative bg-white dark:bg-[#1A1A1A] rounded-[28px] p-5 md:p-6 mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-none transition-all duration-300 border border-slate-100 dark:border-white/5 animate-in slide-in-from-bottom-2 w-full">
        
        {/* Grelha de Ecrã Inteiro: Divide o espaço em 12 colunas no Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* COLUNA 1: IDENTIDADE VISUAL (Ocupa 4 de 12 colunas) */}
          <div className="md:col-span-4 flex items-center gap-5">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-white/5">
              {product?.image_url ? (
                <img src={product.image_url} alt="" className="object-cover h-full w-full" />
              ) : (
                <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              )}
            </div>
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full ${priorityStyles[demand.priority] || priorityStyles['Média']}`}>
                  {demand.priority}
                </span>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/5 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Hash className="h-3 w-3" /> {demand.opNumber}
                </span>
              </div>
              <h3 className="font-extrabold text-[16px] md:text-[18px] text-slate-900 dark:text-white truncate">
                {product?.name || "Peça Desconhecida"}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-1 uppercase">{product?.sku}</p>
            </div>
          </div>

          {/* COLUNA 2: DADOS DO PEDIDO E NOTAS (Ocupa 5 de 12 colunas) */}
          <div className="md:col-span-5 flex flex-col justify-center gap-3">
            <div className="flex flex-wrap items-center gap-4 text-[13px]">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-full">
                <User className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold truncate max-w-[150px]">{demand.requester}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-full">
                <Package className="h-4 w-4" />
                <span className="font-black">Qtd: {demand.quantity} un.</span>
              </div>
            </div>

            {demand.notes && (
              <div className="bg-slate-50 dark:bg-white/[0.03] p-3 rounded-[20px] flex items-start gap-2.5 border border-slate-100 dark:border-white/5">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap leading-relaxed line-clamp-2" title={demand.notes}>
                  {demand.notes}
                </p>
              </div>
            )}
          </div>

          {/* COLUNA 3: AÇÕES (Ocupa 3 de 12 colunas) */}
          <div className="md:col-span-3 flex items-center justify-end gap-3">
            {isHistory ? (
              <div className="flex flex-col items-end w-full">
                <span className={`text-[12px] font-bold px-4 py-1.5 rounded-full ${demand.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                  {demand.status}
                </span>
                <span className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {new Date(demand.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-end w-full gap-2">
                <button
                  onClick={() => setActionDemand({ id: demand.id, type: 'reject' })}
                  className="h-12 w-12 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                  title="Recusar"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                
                {actionConfig && (
                  <Button 
                    className={`h-12 px-6 rounded-full font-bold shadow-lg transition-all active:scale-95 w-full md:w-auto ${actionConfig.color}`}
                    onClick={() => handleAction(demand.id, demand.status)}
                    disabled={updateStatusMutation.isPending}
                  >
                    {updateStatusMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      <div className="flex items-center gap-2">
                        <actionConfig.icon className="h-4 w-4" />
                        <span className="whitespace-nowrap">{actionConfig.label}</span>
                      </div>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-[#F5F7FA] dark:bg-transparent">
      
      {/* HEADER MINIMALISTA */}
      <div className="px-6 md:px-10 py-8 shrink-0 flex flex-col md:items-center text-center">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Produção <span className="text-violet-600 dark:text-violet-400">3D</span>
        </h1>
        <p className="text-[13px] text-slate-500 font-medium mt-2">
          Gira o fluxo de fabricação de forma simples e intuitiva.
        </p>
      </div>

      {/* ÁREA PRINCIPAL FULL WIDTH */}
      <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-32 w-full">
        <div className="w-full mx-auto">
          
          {/* ABAS ESTILO PÍLULA (PILL TABS) - Mantidas ao centro */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-8">
            <TabsList className="bg-slate-200/50 dark:bg-white/5 p-1.5 rounded-full h-auto flex w-full max-w-lg mx-auto shadow-inner">
              <TabsTrigger 
                value="fila" 
                className="rounded-full flex-1 py-2.5 text-[13px] font-bold text-slate-500 data-[state=active]:bg-white dark:data-[state=active]:bg-[#222] data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-400 data-[state=active]:shadow-sm transition-all"
              >
                Fila <span className="ml-1.5 opacity-50 font-normal">({groupedDemands.fila.length})</span>
              </TabsTrigger>
              <TabsTrigger 
                value="produzindo" 
                className="rounded-full flex-1 py-2.5 text-[13px] font-bold text-slate-500 data-[state=active]:bg-white dark:data-[state=active]:bg-[#222] data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-sm transition-all"
              >
                Em Curso <span className="ml-1.5 opacity-50 font-normal">({groupedDemands.produzindo.length})</span>
              </TabsTrigger>
              <TabsTrigger 
                value="historico" 
                className="rounded-full flex-1 py-2.5 text-[13px] font-bold text-slate-500 data-[state=active]:bg-white dark:data-[state=active]:bg-[#222] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
              >
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* CONTEÚDO DAS ABAS */}
            <div className="mt-6 w-full">
              {['fila', 'produzindo', 'historico'].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-0 outline-none focus:ring-0 mt-0 w-full">
                  {groupedDemands[tab as keyof typeof groupedDemands].length === 0 ? (
                    <div className="text-center py-24 bg-white/50 dark:bg-white/[0.02] rounded-[32px] border border-dashed border-slate-200 dark:border-white/5 max-w-4xl mx-auto">
                      <div className="h-16 w-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <h3 className="text-[16px] font-bold text-slate-700 dark:text-slate-300">Tudo limpo por aqui.</h3>
                      <p className="text-[13px] text-slate-500 mt-1">Não há peças nesta fase de produção.</p>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-2">
                      {groupedDemands[tab as keyof typeof groupedDemands].map((demand: any) => (
                        <DemandRow key={demand.id} demand={demand} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>

      {/* MODAIS DE PROCESSO */}
      <Dialog open={!!actionDemand} onOpenChange={(o) => { if (!o) { setActionDemand(null); setRejectionReason(""); } }}>
        <DialogContent className="max-w-md bg-white dark:bg-[#111111] border-none sm:rounded-[32px] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:shadow-none overflow-hidden">
          
          {actionDemand?.type === 'conclude' && (
            <div className="flex flex-col items-center text-center space-y-6 animate-in zoom-in-95">
              <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              
              <div>
                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                  Finalizar Produção
                </DialogTitle>
                <p className="text-[14px] text-slate-500 leading-relaxed px-4">
                  Ao confirmar, a peça será dada como pronta. As automações de estoque e reserva ocorrerão instantaneamente.
                </p>
              </div>

              <Button 
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold text-[16px] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                disabled={updateStatusMutation.isPending} 
                onClick={() => updateStatusMutation.mutate({ id: actionDemand.id, status: 'Concluída' })}
              >
                {updateStatusMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Confirmar e Dar Baixa"}
              </Button>
              <button 
                className="text-[13px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => setActionDemand(null)}
              >
                Cancelar
              </button>
            </div>
          )}

          {actionDemand?.type === 'reject' && (
            <div className="flex flex-col space-y-6 animate-in zoom-in-95">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  Recusar Peça
                </DialogTitle>
                <p className="text-[13px] text-slate-500">
                  Esta ação arquivará o pedido e ele não será produzido.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-bold text-slate-700 dark:text-slate-400 ml-1">Motivo (Recomendado)</Label>
                <Textarea
                  placeholder="Descreva o motivo da recusa..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="bg-slate-50 dark:bg-white/5 border-none rounded-[20px] resize-none h-24 p-4 text-[14px] focus-visible:ring-1 focus-visible:ring-red-500"
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  variant="destructive" 
                  className="w-full h-14 rounded-full font-bold text-[15px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                  disabled={updateStatusMutation.isPending} 
                  onClick={() => updateStatusMutation.mutate({ id: actionDemand.id, status: 'Rejeitada', reason: rejectionReason })}
                >
                  {updateStatusMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Confirmar Recusa"}
                </Button>
                <button 
                  className="text-[13px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-2"
                  onClick={() => setActionDemand(null)}
                >
                  Manter no Quadro
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
