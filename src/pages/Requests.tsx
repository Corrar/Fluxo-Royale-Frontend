import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { 
  Check, X, Package, Search, Trash2, AlertCircle, Truck, 
  FileText, Clock, CheckCircle2, XCircle, Eye, User, Layers, Calendar
} from "lucide-react";

// Removi o import do ScrollArea pois usaremos div nativa para garantir a rolagem
// import { ScrollArea } from "@/components/ui/scroll-area";

// Configuração Visual dos Status
const statusStyles: any = {
  aberto: { 
    label: "Aberto", 
    color: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    rowBorder: "border-l-blue-500",
    icon: Clock,
    headerColor: "bg-blue-600"
  },
  aprovado: { 
    label: "Aprovado", 
    color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    rowBorder: "border-l-emerald-500",
    icon: CheckCircle2,
    headerColor: "bg-emerald-600"
  },
  rejeitado: { 
    label: "Rejeitado", 
    color: "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    rowBorder: "border-l-red-500",
    icon: XCircle,
    headerColor: "bg-red-600"
  },
  entregue: { 
    label: "Entregue", 
    color: "text-slate-700 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    rowBorder: "border-l-slate-500",
    icon: Truck,
    headerColor: "bg-slate-600"
  },
};

export default function Requests() {
  const { profile } = useAuth();
  
  // === 1. IMPORTAR A FUNÇÃO DE LIMPEZA ===
  const { socket, markRequestsAsRead } = useSocket(); 
  const queryClient = useQueryClient();
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialogs
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // === 2. EFEITO PARA LIMPAR A BOLINHA AO ENTRAR ===
  useEffect(() => {
    markRequestsAsRead();
  }, [markRequestsAsRead]);

  // 3. EFEITO DE ATUALIZAÇÃO EM TEMPO REAL
  useEffect(() => {
    if (socket) {
      const handleUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ["requests"] });
      };

      socket.on("new_request", handleUpdate);
      socket.on("refresh_requests", handleUpdate);

      return () => {
        socket.off("new_request", handleUpdate);
        socket.off("refresh_requests", handleUpdate);
      };
    }
  }, [socket, queryClient]);

  // 4. BUSCAR DADOS (Com Anti-Flicker)
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => (await api.get("/requests")).data,
    refetchInterval: 10000, 
    placeholderData: keepPreviousData, 
  });

  // MUTAÇÕES
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      await api.put(`/requests/${id}/status`, { status, rejection_reason: reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const msg = variables.status === 'aprovado' ? 'Solicitação Aprovada!' : 
                  variables.status === 'rejeitado' ? 'Solicitação Recusada.' : 'Status Atualizado.';
      toast.success(msg);
      closeAllDialogs();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erro ao atualizar.");
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Excluído com sucesso.");
      closeAllDialogs();
    },
  });

  // Helpers
  const closeAllDialogs = () => {
    setIsRejectDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedRequest(null);
    setRequestActionId(null);
    setRejectionReason("");
  };

  const handleApprove = (id: string) => updateStatusMutation.mutate({ id, status: "aprovado" });
  const handleDeliver = (id: string) => updateStatusMutation.mutate({ id, status: "entregue" });
  
  const openRejectDialog = (id: string) => {
    setRequestActionId(id);
    setIsRejectDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setRequestActionId(id);
    setDeleteDialogOpen(true);
  };

  // Filtros
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter((request: any) => {
      const matchesSearch = 
        searchTerm === "" ||
        request.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.request_items?.some((item: any) => (item.products?.name || item.custom_product_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Gestão de Solicitações</h1>
          <p className="text-muted-foreground mt-1">Aprovação e controle de saída de materiais.</p>
        </div>
      </div>

      {/* Barra de Ferramentas */}
      <Card className="border shadow-sm bg-card">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex bg-muted/50 p-1 rounded-lg w-full md:w-auto overflow-x-auto scrollbar-hide">
            {['all', 'aberto', 'aprovado', 'rejeitado', 'entregue'].map((status) => {
              const isActive = statusFilter === status;
              const config = statusStyles[status] || {};
              const Icon = config.icon;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  {status !== 'all' && Icon && <Icon className="h-3.5 w-3.5" />}
                  {status === 'all' ? 'Todas' : config.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido, setor ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela Principal */}
      <Card className="border shadow-md overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[80px] text-center">Data / Ref</TableHead>
                <TableHead className="w-[180px]">Solicitante / Setor</TableHead>
                <TableHead>Resumo dos Itens</TableHead>
                <TableHead className="w-[140px] text-center">Status</TableHead>
                <TableHead className="w-[140px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-32">Carregando...</TableCell></TableRow>
              ) : filteredRequests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-48">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-10 w-10 mb-2 opacity-20" />
                      <p>Nenhuma solicitação encontrada.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests?.map((request: any) => {
                  const style = statusStyles[request.status] || statusStyles.aberto;
                  const StatusIcon = style.icon;
                  const itemCount = request.request_items?.length || 0;
                  
                  return (
                    <TableRow key={request.id} className={`group hover:bg-muted/5 transition-colors border-l-4 ${style.rowBorder}`}>
                      
                      {/* === COLUNA DE ID SIMPLIFICADA === */}
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-medium text-xs text-foreground">
                            {format(new Date(request.created_at), "dd/MM")}
                          </span>
                          <span 
                            className="font-mono text-[10px] text-muted-foreground uppercase bg-muted/50 px-1 rounded" 
                            title={`ID Completo: ${request.id}`}
                          >
                            #{request.id.substring(0, 6)}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {request.requester?.name || "Desconhecido"}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Layers className="h-3.5 w-3.5" />
                            {request.sector}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {request.request_items?.slice(0, 2).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center text-sm">
                              <Badge variant="secondary" className="mr-2 h-5 px-1.5 font-mono text-[10px] bg-muted border-border">
                                {item.quantity_requested} {item.products?.unit || "UN"}
                              </Badge>
                              <span className="truncate max-w-[200px] text-foreground/80">{item.products?.name || item.custom_product_name}</span>
                            </div>
                          ))}
                          {itemCount > 2 && (
                            <span className="text-xs text-muted-foreground font-medium pl-1">
                              + {itemCount - 2} outros itens...
                            </span>
                          )}
                        </div>
                        {request.rejection_reason && (
                          <div className="mt-2 text-xs text-red-500 flex items-center gap-1 font-medium">
                            <AlertCircle className="h-3 w-3" /> Recusado: {request.rejection_reason}
                          </div>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${style.color} px-2.5 py-0.5 gap-1.5 text-xs font-medium border`}>
                          <StatusIcon className="h-3 w-3" />
                          {style.label}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setSelectedRequest(request)}
                            title="Ver Detalhes Completos"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canManage && (
                            <>
                              {request.status === "aberto" && (
                                <div className="flex items-center gap-1 ml-1 pl-1 border-l border-border">
                                  <Button 
                                    variant="ghost" size="icon" 
                                    className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                    onClick={() => handleApprove(request.id)}
                                    title="Aprovar"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" size="icon" 
                                    className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                    onClick={() => openRejectDialog(request.id)}
                                    title="Recusar"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              {request.status === "aprovado" && (
                                <Button 
                                  variant="ghost" size="icon"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 ml-1"
                                  onClick={() => handleDeliver(request.id)}
                                  title="Marcar Entregue"
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                              )}

                              <Button 
                                variant="ghost" size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-red-600 ml-1 opacity-50 hover:opacity-100"
                                onClick={() => openDeleteDialog(request.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ================================================================= */}
      {/* MODAL DE DETALHES (Scroll corrigido) */}
      {/* ================================================================= */}
      <Dialog open={!!selectedRequest} onOpenChange={() => closeAllDialogs()}>
        <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden shadow-2xl">
          <div className={`h-2 w-full ${statusStyles[selectedRequest?.status]?.headerColor || "bg-slate-500"}`} />
          <div className="p-6">
            <DialogHeader className="mb-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    Solicitação #{selectedRequest?.id.substring(0, 6)}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {selectedRequest && format(new Date(selectedRequest.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </DialogDescription>
                </div>
                {selectedRequest && (
                  <Badge className={`${statusStyles[selectedRequest.status]?.color} text-sm px-3 py-1 border`}>
                    {statusStyles[selectedRequest.status]?.label}
                  </Badge>
                )}
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/20">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Solicitante</p>
                  <p className="font-semibold text-foreground">{selectedRequest?.requester?.name || "Usuário Removido"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/20">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Setor / Departamento</p>
                  <p className="font-semibold text-foreground">{selectedRequest?.sector || "Geral"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Lista de Materiais
                </h4>
                <span className="text-xs text-muted-foreground">{selectedRequest?.request_items?.length} itens</span>
              </div>
              
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground grid grid-cols-12 gap-2">
                  <div className="col-span-2">CÓDIGO</div>
                  <div className="col-span-7">PRODUTO</div>
                  <div className="col-span-3 text-right">QTD</div>
                </div>
                
                {/* --- AQUI ESTÁ A CORREÇÃO: DIV NATIVA COM OVERFLOW-Y-AUTO --- */}
                <div className="max-h-[240px] overflow-y-auto">
                  <div className="divide-y divide-border">
                    {selectedRequest?.request_items?.map((item: any, i: number) => (
                      <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center hover:bg-muted/20 transition-colors">
                        <div className="col-span-2 font-mono text-xs text-muted-foreground">
                          {item.products?.sku || "MANUAL"}
                        </div>
                        <div className="col-span-7 font-medium leading-tight">
                          {item.products?.name || item.custom_product_name}
                        </div>
                        <div className="col-span-3 text-right">
                          <Badge variant="outline" className="font-mono font-bold bg-background">
                            {item.quantity_requested} {item.products?.unit || "UN"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* ------------------------------------------------------------- */}
              </div>
            </div>

            {selectedRequest?.rejection_reason && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-lg animate-in slide-in-from-bottom-2">
                <h5 className="flex items-center gap-2 text-red-800 dark:text-red-400 font-bold text-sm mb-1">
                  <AlertCircle className="h-4 w-4" /> Motivo da Recusa
                </h5>
                <p className="text-red-700 dark:text-red-300 text-sm pl-6">
                  "{selectedRequest.rejection_reason}"
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-2 bg-muted/10 border-t flex flex-col sm:flex-row gap-3">
            {canManage && selectedRequest?.status === 'aberto' ? (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 h-11" 
                  onClick={() => openRejectDialog(selectedRequest.id)}
                >
                  <X className="mr-2 h-4 w-4" /> Recusar Pedido
                </Button>
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-md" 
                  onClick={() => handleApprove(selectedRequest.id)}
                >
                  <Check className="mr-2 h-4 w-4" /> Aprovar Pedido
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="w-full h-11" onClick={closeAllDialogs}>
                Fechar Visualização
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE RECUSA --- */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Recusar Solicitação</DialogTitle>
            <DialogDescription>Motivo da recusa (obrigatório):</DialogDescription>
          </DialogHeader>
          <Textarea 
            placeholder="Ex: Item em falta, quantidade excessiva..." 
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="bg-background min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => requestActionId && updateStatusMutation.mutate({ id: requestActionId, status: "rejeitado", reason: rejectionReason })}>
              Confirmar Recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE EXCLUSÃO --- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Excluir Registro?</DialogTitle></DialogHeader>
          <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => requestActionId && deleteRequestMutation.mutate(requestActionId)}>Excluir Definitivamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
