// src/pages/Requests.tsx (ou o caminho equivalente no seu projeto)

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogDescription, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { cn } from "@/lib/utils";

import { 
  Check, X, Package, Search, Trash2, Truck, 
  Clock, CheckCircle2, XCircle, ChevronRight,
  ClipboardList, PackageOpen, MapPin, AlertTriangle, ShieldAlert, Inbox, UserCircle, Briefcase, RotateCcw,
  CheckSquare, FileWarning
} from "lucide-react";

// ==========================================
// 🎨 TIPAGENS E CONFIGURAÇÕES VISUAIS
// ==========================================
// Define as cores e ícones para cada status possível do pedido
interface StatusConfig {
  label: string;
  color: string;
  icon: React.ElementType;
}

const statusStyles: Record<string, StatusConfig> = {
  aberto: { 
    label: "Em Análise", 
    color: "text-amber-600 bg-amber-100/50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    icon: Clock,
  },
  aprovado: { 
    label: "A Separar", 
    color: "text-blue-600 bg-blue-100/50 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    icon: Package,
  },
  rejeitado: { 
    label: "Recusado", 
    color: "text-rose-600 bg-rose-100/50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
    icon: XCircle,
  },
  entregue: { 
    label: "Concluído", 
    color: "text-emerald-600 bg-emerald-100/50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    icon: CheckCircle2,
  },
  devolvido: { 
    label: "Devolvido", 
    color: "text-purple-600 bg-purple-100/50 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
    icon: RotateCcw,
  },
};

// ==========================================
// 🧩 COMPONENTE: EMPTY STATE
// ==========================================
// Exibido quando não há nenhum pedido na lista
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-center rounded-[2rem] sm:rounded-[2.5rem] bg-white/50 dark:bg-[#111]/50 border border-slate-200/50 dark:border-white/5 backdrop-blur-xl min-h-[250px] sm:min-h-[300px] animate-in fade-in duration-700 w-full mt-4">
    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4 sm:mb-6 shadow-inner">
      <Inbox className="h-8 w-8 text-slate-400 dark:text-slate-500" />
    </div>
    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-sm mt-2 sm:mt-3">{description}</p>
  </div>
);

// ==========================================
// 📈 COMPONENTE: TIMELINE ESTILO MERCADO LIVRE
// ==========================================
// Responsável por desenhar a linha do tempo do pedido dentro do modal
const MLTimeline = ({ request }: { request: any }) => {
  const { status, created_at, rejection_reason } = request;
  const isRejected = status === "rejeitado";
  const isReturned = status === "devolvido";
  const isDelivered = status === "entregue" || status === "devolvido";
  const isApproved = status === "aprovado" || isDelivered;

  const steps = [
    {
      id: 1,
      title: "Pedido recebido",
      desc: "A sua solicitação foi registada com sucesso.",
      date: created_at ? format(new Date(created_at), "dd MMM HH:mm", { locale: ptBR }) : "",
      isCompleted: true, 
      isActive: status === "aberto",
      isRejected: false,
      isReturned: false
    },
    {
      id: 2,
      title: isRejected ? "Pedido recusado" : "Em preparação",
      desc: isRejected ? rejection_reason : "O almoxarifado aprovou e está a separar os materiais.",
      date: isRejected ? "Recusado" : (isApproved ? "Aprovado" : ""),
      isCompleted: isApproved || isRejected,
      isActive: status === "aprovado" || isRejected,
      isRejected: isRejected,
      isReturned: false
    }
  ];

  if (!isRejected) {
    steps.push({
      id: 3,
      title: "Entregue",
      desc: "Materiais finalizados e entregues ao setor.",
      date: isDelivered ? "Finalizado" : "",
      isCompleted: isDelivered,
      isActive: status === "entregue",
      isRejected: false,
      isReturned: false
    });
  }

  if (isReturned) {
    steps.push({
      id: 4,
      title: "Devolvido (Estorno)",
      desc: "Os materiais foram devolvidos e o stock restaurado.",
      date: "Estornado",
      isCompleted: true,
      isActive: true,
      isRejected: false,
      isReturned: true
    });
  }

  return (
    <div className="flex flex-col w-full py-2 pl-2">
      {steps.map((step, index) => {
         const isLast = index === steps.length - 1;
         const lineCompleted = steps[index + 1]?.isCompleted; 

         return (
           <div key={step.id} className="relative flex gap-4 sm:gap-6">
             {/* Linha Conectora */}
             {!isLast && (
               <div className={cn(
                 "absolute left-[11px] top-8 bottom-[-8px] w-[2px] rounded-full transition-colors duration-500",
                 lineCompleted && steps[index + 1]?.isReturned ? "bg-purple-500" :
                 lineCompleted && !step.isRejected ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
               )} />
             )}

             {/* Indicador Visual (Bolinha) */}
             <div className="relative flex flex-col items-center z-10 pt-1 shrink-0">
               {step.isReturned ? (
                 <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center ring-4 ring-white dark:ring-[#0A0A0A] shadow-sm">
                   <RotateCcw className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                 </div>
               ) : step.isCompleted && !step.isActive && !step.isRejected ? (
                 <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center ring-4 ring-white dark:ring-[#0A0A0A] shadow-sm">
                   <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                 </div>
               ) : step.isActive && !step.isRejected ? (
                 <div className="relative h-6 w-6 rounded-full bg-white dark:bg-[#111] border-[3px] border-emerald-500 flex items-center justify-center ring-4 ring-white dark:ring-[#0A0A0A] shadow-sm">
                   <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                   <div className="absolute inset-[-4px] rounded-full border border-emerald-500/50 animate-ping" />
                 </div>
               ) : step.isRejected ? (
                 <div className="h-6 w-6 rounded-full bg-rose-500 flex items-center justify-center ring-4 ring-white dark:ring-[#0A0A0A] shadow-sm">
                   <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                 </div>
               ) : (
                 <div className="h-6 w-6 rounded-full bg-white dark:bg-[#111] border-[3px] border-slate-200 dark:border-slate-800 flex items-center justify-center ring-4 ring-white dark:ring-[#0A0A0A]" />
               )}
             </div>

             {/* Textos */}
             <div className={cn(
               "flex flex-col pb-8 min-w-0 flex-1",
               !step.isCompleted && !step.isActive && "opacity-50 dark:opacity-40" 
             )}>
               <h4 className={cn(
                 "text-base sm:text-lg font-bold leading-tight tracking-tight",
                 step.isReturned ? "text-purple-600 dark:text-purple-400" :
                 step.isRejected ? "text-rose-600 dark:text-rose-400" : 
                 step.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
               )}>
                 {step.title}
               </h4>
               
               {step.date && (
                 <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                   {step.date}
                 </span>
               )}
               
               <p className="text-xs sm:text-sm mt-1 sm:mt-1.5 text-slate-500 leading-snug pr-2">
                 {step.desc}
               </p>
             </div>
           </div>
         )
      })}
    </div>
  )
}

// ==========================================
// 🚀 COMPONENTE PRINCIPAL: REQUESTS
// ==========================================
export default function Requests() {
  const { profile } = useAuth();
  const { socket, markRequestsAsRead } = useSocket(); 
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Estados para o Ajuste de Quantidade (Conferência)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [adjustedItems, setAdjustedItems] = useState<Record<string, number>>({});

  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    markRequestsAsRead();
  }, [markRequestsAsRead]);

  // ==========================================
  // 🔌 1. SOCKET (Atualizações em Tempo Real Absoluto)
  // ==========================================
  useEffect(() => {
    if (!socket) return;
    
    const handleNewRequest = (newRequestData: any) => {
        if (newRequestData && newRequestData.id) {
           queryClient.setQueryData(["requests"], (oldData: any) => {
             if (!oldData) return [newRequestData];
             if (oldData.some((req: any) => req.id === newRequestData.id)) return oldData;
             return [newRequestData, ...oldData]; 
           });
        }
    };

    const handleNotification = (data: any) => {
        toast.success(`🔔 NOVA SOLICITAÇÃO!`, {
          description: `O setor de ${data.sector} acabou de enviar um novo pedido.`,
          duration: 8000, 
        });
    };

    const handleRefresh = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
      }, Math.random() * 1500);
    };

    socket.on("new_request", handleNewRequest);
    socket.on("new_request_notification", handleNotification);
    socket.on("refresh_requests", handleRefresh);
    socket.on("request_updated", handleRefresh);
    socket.on("status_updated", handleRefresh);

    return () => { 
        socket.off("new_request", handleNewRequest);
        socket.off("new_request_notification", handleNotification);
        socket.off("refresh_requests", handleRefresh);
        socket.off("request_updated", handleRefresh);
        socket.off("status_updated", handleRefresh);
    };
  }, [socket, queryClient]);

  // ==========================================
  // 💾 2. DADOS (Busca na API)
  // ==========================================
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => (await api.get("/requests")).data,
    staleTime: Infinity, 
    placeholderData: keepPreviousData, 
  });

  // Atualização com Suporte para adjusted_items
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason, items }: { id: string; status: string; reason?: string, items?: any[] }) => {
      await api.put(`/requests/${id}/status`, { status, rejection_reason: reason, adjusted_items: items });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const msg = variables.status === 'aprovado' ? 'Aprovado e Ajustado! Pode separar os itens.' : 
                  variables.status === 'rejeitado' ? 'Solicitação recusada e stock devolvido.' : 
                  variables.status === 'devolvido' ? 'Pedido devolvido e stock restaurado com sucesso!' : 'Entrega confirmada com sucesso!';
      toast.success(msg);
      closeAllDialogs();
    },
    onError: (error: any) => { 
      toast.error(error.response?.data?.error || "Erro ao atualizar."); 
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/requests/${id}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success(data?.data?.message || "Pedido cancelado com sucesso.");
      closeAllDialogs();
    },
    onError: (error: any) => { 
      toast.error(error.response?.data?.error || "Erro ao cancelar o pedido."); 
    },
  });

  const closeAllDialogs = () => {
    setIsRejectDialogOpen(false);
    setDeleteDialogOpen(false);
    setIsApproveDialogOpen(false);
    setSelectedRequest(null);
    setRequestActionId(null);
    setRejectionReason("");
    setAdjustedItems({});
  };

  // --- LÓGICA DE APROVAÇÃO COM CONFERÊNCIA ---
  const openApproveDialog = (request: any) => {
    setRequestActionId(request.id);
    const initialAdjustments: Record<string, number> = {};
    
    // Preenche com os valores que o utilizador pediu por padrão
    request.request_items.forEach((item: any) => {
        initialAdjustments[item.id] = Number(item.quantity_requested);
    });
    
    setAdjustedItems(initialAdjustments);
    setIsApproveDialogOpen(true);
  };

  const handleAdjustQty = (itemId: string, change: number) => {
    setAdjustedItems(prev => {
        const newQty = Math.max(0, (prev[itemId] || 0) + change);
        return { ...prev, [itemId]: newQty };
    });
  };

  const confirmApproveWithAdjustments = () => {
    if (!requestActionId) return;
    
    // Transforma o objeto de ajustes num array para o backend
    const itemsToUpdate = Object.entries(adjustedItems).map(([id, qty]) => ({
        id: id,
        quantity_delivered: qty
    }));

    updateStatusMutation.mutate({ 
        id: requestActionId, 
        status: "aprovado", 
        items: itemsToUpdate 
    });
  };

  // -----------------------------------------------

  const handleDeliver = (id: string) => updateStatusMutation.mutate({ id, status: "entregue" });
  const handleReturn = (id: string) => updateStatusMutation.mutate({ id, status: "devolvido" });
  
  const openRejectDialog = (id: string) => {
    setRequestActionId(id);
    setIsRejectDialogOpen(true);
  };

  const openDeleteDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setRequestActionId(id);
    setDeleteDialogOpen(true);
  };

  // ==========================================
  // 🔍 FILTRAGEM INTELIGENTE E LIMPEZA AUTOMÁTICA
  // ==========================================
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    return requests.filter((request: any) => {
      
      const reqDate = new Date(request.created_at).getTime();
      const isOlderThan30Days = (now - reqDate) > THIRTY_DAYS_MS;
      if (isOlderThan30Days && (request.status === "entregue" || request.status === "rejeitado" || request.status === "devolvido")) {
        return false;
      }

      // 🛡️ Melhoria: Conversão segura de op_code para string para evitar erros se vier número do BD
      const safeOpCode = String(request.op_code || "").toLowerCase();

      const matchesSearch = 
        searchTerm === "" ||
        request.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        safeOpCode.includes(searchTerm.toLowerCase()) || // 🟢 Filtro por OP Global Seguro
        request.request_items?.some((item: any) => 
            (item.products?.name || item.custom_product_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.client_service || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";

  return (
    <div className="w-full mx-auto px-4 md:px-8 py-6 space-y-6 animate-in fade-in duration-1000 pb-32 min-h-screen bg-[#F8FAFC] dark:bg-[#000000] selection:bg-blue-500/30">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col mb-4">
        <h1 className="text-3xl md:text-[44px] font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 leading-none mb-3">
            <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-500 shrink-0" strokeWidth={2.5} /> 
            Solicitações
        </h1>
        <p className="text-sm md:text-[15px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-blue-500 shrink-0" />
          O histórico arquiva automaticamente itens inativos há mais de 30 dias.
        </p>
      </div>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center w-full mb-8">
         <div className="relative w-full xl:w-96 group shrink-0">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" strokeWidth={2.5} />
            <Input 
                placeholder="Procurar por setor, OP, solicitante ou item..." 
                className="pl-11 h-12 bg-white dark:bg-[#111] border border-slate-200/60 dark:border-white/5 rounded-full focus:bg-white dark:focus:bg-[#111] focus:ring-2 focus:ring-blue-500/30 transition-all font-medium text-[14px] w-full shadow-[0_4px_20px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         
         <div className="w-full overflow-x-auto custom-scrollbar pb-1 sm:pb-0 snap-x scroll-smooth">
            <div className="flex bg-white dark:bg-[#111] p-1.5 rounded-full w-max min-w-full xl:min-w-fit gap-1 shadow-[0_4px_20px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200/60 dark:border-white/5">
                {['all', 'aberto', 'aprovado', 'entregue', 'devolvido', 'rejeitado'].map((status) => {
                    const isActive = statusFilter === status;
                    const config = statusStyles[status] || { label: "Todas" };
                    return (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "snap-start flex-1 px-5 py-2 text-[13px] font-bold rounded-full transition-all capitalize tracking-wide whitespace-nowrap active:scale-95 outline-none",
                                isActive 
                                  ? "bg-blue-600 text-white shadow-md" 
                                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                            )}
                        >
                            {status === 'all' ? 'Todas' : config.label}
                        </button>
                    );
                })}
            </div>
         </div>
      </div>

      {/* GRID DE CARTÕES DE SOLICITAÇÃO */}
      {isLoading ? (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[280px] rounded-[2.5rem] bg-white/50 dark:bg-[#111] animate-pulse" />)}
         </div>
      ) : filteredRequests?.length === 0 ? (
         <EmptyState title="Tudo Limpo!" description="Ajuste os filtros de pesquisa ou aguarde novos pedidos dos setores." />
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 w-full">
            {filteredRequests.map((request: any) => {
               const style = statusStyles[request.status] || statusStyles.aberto;
               const StatusIcon = style.icon;
               const itemCount = request.request_items?.length || 0;
               const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ptBR });
               
               const hasOS = request.request_items?.some((i: any) => i.client_service);
               // 🟢 Validação correta para saber se a OP deve aparecer no Card
               const hasOpCode = !!request.op_code; 

               return (
                  <Card 
                     key={request.id} 
                     className={cn(
                         "group cursor-pointer rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_16px_40px_rgb(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:-translate-y-1.5 transition-all duration-500 ease-out active:scale-[0.98] flex flex-col justify-between overflow-hidden min-w-0",
                         request.status === 'aberto' && "ring-2 ring-amber-400/50 dark:ring-amber-500/30" 
                     )}
                     onClick={() => setSelectedRequest(request)}
                  >
                     <CardContent className="p-0 flex flex-col h-full relative z-10">
                         <div className="p-5 sm:p-6 pb-4">
                             <div className="flex justify-between items-start gap-2 mb-4">
                                 <Badge variant="outline" className={cn("shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] uppercase font-black tracking-widest border border-transparent", style.color)}>
                                     <StatusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5" strokeWidth={2.5} /> {style.label}
                                 </Badge>
                                 <span className="shrink-0 text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center gap-1 sm:gap-1.5 pt-0.5">
                                     <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {timeAgo}
                                 </span>
                             </div>
                             
                             <div className="w-full min-w-0 mt-2">
                                 <div className="flex items-center gap-3">
                                   <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                                     <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400" />
                                   </div>
                                   <div className="flex flex-col overflow-hidden">
                                     <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate">
                                        {request.requester?.name || "Sistema"}
                                     </h3>
                                     <span className="text-[12px] sm:text-[13px] font-semibold text-slate-500 truncate">{request.sector || "Setor Geral"}</span>
                                   </div>
                                 </div>
                                 
                                 {/* 🟢 Renderização do número da OP no Cartão */}
                                 {(hasOpCode || hasOS) && (
                                   <div className="mt-4 flex flex-wrap items-center gap-2">
                                     {hasOpCode && (
                                        <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-300/50 dark:border-blue-500/30">
                                          <Briefcase className="w-3.5 h-3.5" /> 
                                          OP: {request.op_code}
                                        </div>
                                     )}
                                     {hasOS && !hasOpCode && (
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 dark:bg-white/10 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                                          <FileWarning className="w-3.5 h-3.5" /> 
                                          Contém OS individual
                                        </div>
                                     )}
                                   </div>
                                 )}
                             </div>
                         </div>

                         <div className="px-5 sm:px-6 py-4 bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex items-center justify-between w-full min-w-0 mt-auto">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-white dark:bg-[#111] shadow-sm flex items-center justify-center shrink-0 border border-slate-100 dark:border-white/5">
                                    <Package className="h-4 w-4 text-slate-500" strokeWidth={2.5} />
                                </div>
                                <span className="text-[12px] sm:text-[14px] font-black text-slate-700 dark:text-slate-300 truncate">{itemCount} Itens Solicitados</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                {canManage && (
                                    <Button 
                                        variant="ghost" size="icon" 
                                        className="h-8 w-8 sm:h-9 sm:w-9 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 rounded-full z-20 transition-colors"
                                        onClick={(e) => openDeleteDialog(request.id, e)}
                                    >
                                        <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                                    </Button>
                                )}
                                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-slate-900 text-white dark:bg-white dark:text-black flex items-center justify-center group-hover:bg-blue-600 dark:group-hover:bg-blue-500 transition-colors shadow-sm">
                                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} />
                                </div>
                            </div>
                         </div>
                     </CardContent>
                  </Card>
               );
            })}
         </div>
      )}

      {/* ================================================================= */}
      {/* 🧾 MODAL DETALHADO (VISUALIZAÇÃO DO PEDIDO) */}
      {/* ================================================================= */}
      <Dialog open={!!selectedRequest && !isApproveDialogOpen} onOpenChange={() => closeAllDialogs()}>
        <DialogContent aria-describedby="dialog-desc" className="w-[95vw] sm:w-full max-w-2xl bg-[#FAFAFA] dark:bg-[#0A0A0A] border-none p-0 overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.8)] rounded-[1.5rem] sm:rounded-[2rem] flex flex-col max-h-[90dvh]">
          
          <DialogHeader className="sr-only">
              <DialogTitle>Detalhes da Solicitação</DialogTitle>
              <DialogDescription id="dialog-desc">Visualização dos detalhes, histórico e itens desta solicitação específica.</DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className={cn(
              "px-5 sm:px-10 py-6 sm:py-8 border-b border-black/5 dark:border-white/5 flex flex-col shrink-0 relative overflow-hidden",
              selectedRequest.status === 'entregue' ? "bg-emerald-600 dark:bg-emerald-900/40 text-white" :
              selectedRequest.status === 'devolvido' ? "bg-purple-600 dark:bg-purple-900/40 text-white" :
              selectedRequest.status === 'rejeitado' ? "bg-rose-600 dark:bg-rose-900/40 text-white" :
              selectedRequest.status === 'aprovado' ? "bg-blue-600 dark:bg-blue-900/40 text-white" : "bg-amber-500 dark:bg-amber-900/40 text-white"
            )}>
                <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none hidden sm:block">
                    <PackageOpen className="w-40 h-40" />
                </div>

                <h2 className="text-2xl sm:text-4xl font-black z-10 tracking-tighter leading-none mb-1 sm:mb-2">
                    {selectedRequest.status === 'entregue' ? "Pedido Concluído" :
                     selectedRequest.status === 'devolvido' ? "Pedido Devolvido" :
                     selectedRequest.status === 'rejeitado' ? "Pedido Recusado" :
                     selectedRequest.status === 'aprovado' ? "Em Preparação" : "Aguardando Análise"}
                </h2>

                <p className="text-xs sm:text-base font-medium opacity-90 z-10 max-w-md">
                    {selectedRequest.status === 'entregue' ? "Os materiais já foram entregues ao setor." :
                     selectedRequest.status === 'devolvido' ? "Os materiais foram devolvidos e o stock restaurado." :
                     selectedRequest.status === 'rejeitado' ? "A solicitação não pôde ser atendida nesta ocasião." :
                     selectedRequest.status === 'aprovado' ? "O almoxarifado já aprovou e está a preparar a entrega." : "A sua solicitação foi recebida e será analisada em breve."}
                </p>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mt-3 sm:mt-4 z-10 flex items-center gap-2">
                    REQ-{selectedRequest.id.substring(0, 8)}
                    {/* 🟢 Mostra a OP no Cabeçalho do Modal */}
                    {selectedRequest.op_code && (
                       <>
                         <span className="w-1 h-1 rounded-full bg-white opacity-50"></span>
                         OP-{selectedRequest.op_code}
                       </>
                    )}
                </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
            {selectedRequest && (
                <div className="p-5 sm:p-10 border-b border-slate-200/60 dark:border-white/5 bg-white dark:bg-transparent">
                    <MLTimeline request={selectedRequest} />
                </div>
            )}

            <div className="p-5 sm:p-10 border-b border-slate-200/60 dark:border-white/5 flex gap-3 sm:gap-4 items-start bg-slate-50 dark:bg-transparent">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/50 dark:border-transparent shadow-sm">
                    <MapPin className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">Local de Entrega</span>
                    <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate leading-tight">{selectedRequest?.requester?.name || "Desconhecido"}</span>
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-500 truncate">{selectedRequest?.sector || "Geral"}</span>
                </div>
            </div>

            {/* LISTA DE ITENS DENTRO DO MODAL */}
            <div className="p-5 sm:p-10 bg-white dark:bg-transparent">
              <h4 className="font-bold text-[10px] sm:text-[11px] mb-3 sm:mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Produtos Solicitados ({selectedRequest?.request_items?.length})
              </h4>
              
              <div className="space-y-2 sm:space-y-3">
                {selectedRequest?.request_items?.map((item: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl w-full min-w-0 group gap-3 sm:gap-0">
                      <div className="flex flex-col pr-3 sm:pr-4 min-w-0 flex-1">
                          <span className="font-bold text-sm sm:text-[15px] text-slate-900 dark:text-white leading-tight">
                              {item.products?.name || item.custom_product_name}
                          </span>
                          
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {item.products?.sku && (
                                <span className="font-mono text-[9px] sm:text-[10px] font-bold text-slate-500 bg-white dark:bg-black px-1.5 py-0.5 rounded shadow-sm border border-slate-200/50 dark:border-white/10">
                                    SKU: {item.products.sku}
                                </span>
                            )}
                            {/* 🟢 Exibe a OP na listagem de itens */}
                            {(item.client_service || selectedRequest.op_code) && (
                                <span className="text-[9px] sm:text-[10px] font-bold text-blue-700 bg-blue-100/50 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                    {selectedRequest.op_code ? `OP: ${selectedRequest.op_code}` : `OS/Cliente: ${item.client_service}`}
                                </span>
                            )}
                            {item.observation && (
                                <span className="text-[9px] sm:text-[10px] font-bold text-amber-700 bg-amber-100/50 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                    Para: {item.observation}
                                </span>
                            )}
                          </div>
                      </div>
                      
                      <div className="flex flex-row sm:flex-col items-center sm:items-end w-full sm:w-auto justify-between sm:justify-center border-t sm:border-none border-slate-200/50 dark:border-white/5 pt-2 sm:pt-0 shrink-0">
                          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 mb-0 sm:mb-0.5">
                            {selectedRequest.status === 'entregue' ? "Enviado" : "Qtd Pedida"}
                          </span>
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                              {item.quantity_delivered ?? item.quantity_requested} <span className="text-[10px] sm:text-[11px] text-slate-500 font-bold ml-0.5">{item.products?.unit || "un"}</span>
                          </span>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 bg-white dark:bg-[#111] border-t border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
            {canManage && selectedRequest?.status === 'aberto' ? (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl sm:rounded-2xl h-12 sm:h-14 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 font-bold text-sm sm:text-[15px] tracking-tight" 
                  onClick={() => openRejectDialog(selectedRequest.id)}
                >
                  <X className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Recusar
                </Button>
                <Button 
                  className="flex-[2] rounded-xl sm:rounded-2xl h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-[15px] tracking-tight shadow-[0_4px_20px_rgba(37,99,235,0.4)]" 
                  onClick={() => openApproveDialog(selectedRequest)}
                >
                  <CheckSquare className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Conferir & Aprovar
                </Button>
              </>
            ) : canManage && selectedRequest?.status === 'aprovado' ? (
              <Button 
                  className="w-full rounded-xl sm:rounded-2xl h-12 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm sm:text-[15px] tracking-tight shadow-[0_4px_20px_rgba(16,185,129,0.4)]" 
                  onClick={() => handleDeliver(selectedRequest.id)}
                >
                  <Truck className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Confirmar Entrega
              </Button>
            ) : canManage && selectedRequest?.status === 'entregue' ? (
              <>
                 <Button 
                   variant="outline" 
                   className="w-full rounded-xl sm:rounded-2xl h-12 sm:h-14 border-purple-200 dark:border-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 font-bold text-sm sm:text-[15px] tracking-tight" 
                   onClick={() => handleReturn(selectedRequest.id)}
                 >
                   <RotateCcw className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Estornar / Devolver
                 </Button>
                 <Button variant="secondary" className="w-full rounded-xl sm:rounded-2xl h-12 sm:h-14 font-bold text-sm sm:text-[15px] bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white" onClick={closeAllDialogs}>
                   Fechar Menu
                 </Button>
              </>
            ) : (
              <Button variant="secondary" className="w-full rounded-xl sm:rounded-2xl h-12 sm:h-14 font-bold text-sm sm:text-[15px] bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white" onClick={closeAllDialogs}>
                Fechar Menu
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE CONFERÊNCIA DE QUANTIDADES --- */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="w-[90vw] max-w-lg bg-white dark:bg-[#111] border-none rounded-[1.5rem] sm:rounded-[2rem] p-0 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          
          <div className="p-6 sm:p-8 pb-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0A0A0A]">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-500 rounded-full flex items-center justify-center shrink-0">
                <CheckSquare className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Conferência de Envio</DialogTitle>
                <DialogDescription className="text-xs font-medium text-slate-500 mt-0.5">
                  Ajuste as quantidades reais de acordo com a embalagem que será enviada. O stock descontará este valor.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white dark:bg-transparent">
            {selectedRequest?.request_items?.map((item: any) => (
               <div key={item.id} className="flex flex-col gap-3 p-4 bg-white dark:bg-[#111] border border-slate-200/60 dark:border-white/10 rounded-2xl shadow-sm">
                 
                 <div className="flex flex-col min-w-0">
                     <span className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                         {item.products?.name || item.custom_product_name}
                     </span>
                     <span className="text-[11px] text-slate-500 mt-1 font-medium">
                       Solicitado pelo utilizador: <strong className="text-slate-700 dark:text-slate-300">{item.quantity_requested} {item.products?.unit}</strong>
                     </span>
                 </div>

                 <div className="flex justify-between items-center border-t border-slate-100 dark:border-white/5 pt-3 mt-1">
                     <span className="text-[10px] uppercase font-bold text-slate-400">Qtd a Enviar:</span>
                     
                     <div className="flex items-center bg-slate-100 dark:bg-[#222] rounded-full p-1 shadow-inner border border-slate-200/60 dark:border-white/5">
                       <button onClick={() => handleAdjustQty(item.id, -1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-[#333] text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-[#444] font-bold transition-colors">
                         -
                       </button>
                       
                       <input 
                         type="number" 
                         min="0"
                         value={adjustedItems[item.id] || 0}
                         onChange={(e) => setAdjustedItems(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                         className="w-14 text-center text-base font-black text-blue-600 dark:text-blue-400 bg-transparent border-none focus:outline-none focus:ring-0 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                       />
                       
                       <button onClick={() => handleAdjustQty(item.id, 1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 font-bold transition-colors">
                         +
                       </button>
                     </div>
                 </div>
               </div>
            ))}
          </div>

          <DialogFooter className="p-6 bg-white dark:bg-[#111] border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row gap-2 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-12 rounded-xl font-bold border-slate-200 dark:border-white/10" onClick={() => setIsApproveDialogOpen(false)}>
              Voltar
            </Button>
            <Button className="w-full sm:flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md" onClick={confirmApproveWithAdjustments}>
              Confirmar e Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE RECUSA --- */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="w-[90vw] bg-white dark:bg-[#111] border-none rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 sm:max-w-md shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="h-14 w-14 sm:h-16 sm:w-16 bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center mb-1 sm:mb-2">
                  <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Recusar Solicitação</DialogTitle>
              <DialogDescription className="text-xs sm:text-[14px] font-medium text-slate-500">
                  Indique o motivo para que o setor entenda a recusa.
              </DialogDescription>
          </div>
          <Textarea 
            autoFocus
            placeholder="Ex: Produto fora de stock, limite excedido..." 
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="bg-slate-50 dark:bg-black/50 min-h-[100px] sm:min-h-[120px] rounded-xl sm:rounded-2xl border-slate-200 dark:border-white/5 focus:ring-2 focus:ring-rose-500/30 text-sm sm:text-[14px] p-3 sm:p-4 resize-none shadow-inner"
          />
          <DialogFooter className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => setIsRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] bg-rose-600 hover:bg-rose-700 shadow-md" onClick={() => requestActionId && updateStatusMutation.mutate({ id: requestActionId, status: "rejeitado", reason: rejectionReason })}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE CANCELAMENTO --- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[90vw] bg-white dark:bg-[#111] border-none rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 sm:max-w-md shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="h-14 w-14 sm:h-16 sm:w-16 bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-full flex items-center justify-center mb-1 sm:mb-2">
                  <Trash2 className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Cancelar Pedido?</DialogTitle>
              <DialogDescription className="text-xs sm:text-[14px] font-medium text-slate-500">
                  Esta ação irá inativar o pedido, alterar o status para "Recusado" e devolver os materiais reservados ao stock. Deseja prosseguir?
              </DialogDescription>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
            <Button variant="outline" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => setDeleteDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" className="w-full sm:flex-1 rounded-xl sm:rounded-2xl h-12 font-bold text-sm sm:text-[14px] bg-rose-600 hover:bg-rose-700 shadow-md" onClick={() => requestActionId && deleteRequestMutation.mutate(requestActionId)}>
                Sim, Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
