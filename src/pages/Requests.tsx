import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Check, 
  X, 
  Package, 
  Search, 
  Trash2, 
  AlertCircle, 
  Filter, 
  Truck,
  FileText
} from "lucide-react";

// Definição de cores e labels para os status
const statusStyles = {
  aberto: { label: "Aberto", className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  aprovado: { label: "Aprovado", className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  rejeitado: { label: "Rejeitado", className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
  entregue: { label: "Entregue", className: "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100" },
};

export default function Requests() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Estados para Dialogs
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);

  // 1. BUSCAR DADOS
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const response = await api.get("/requests");
      return response.data;
    },
    refetchInterval: 5000, // Mantém atualizado em tempo real
  });

  // 2. MUTAÇÃO: Atualizar Status (Aprovar / Recusar / Entregar)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      // Envia o motivo se houver (para rejeições)
      await api.put(`/requests/${id}/status`, { status, rejection_reason: reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      
      const actionMap: Record<string, string> = {
        'aprovado': 'Solicitação aprovada!',
        'rejeitado': 'Solicitação recusada.',
        'entregue': 'Material marcado como entregue.'
      };
      
      toast.success(actionMap[variables.status] || "Status atualizado!");
      
      // Fechar dialogs e limpar estados
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedRequestId(null);
    },
    onError: (error: any) => {
      console.error("Erro no update:", error);
      toast.error(error.response?.data?.error || "Erro ao atualizar status. Tente novamente.");
    },
  });

  // 3. MUTAÇÃO: Excluir
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Solicitação excluída permanentemente.");
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    },
    onError: () => toast.error("Erro ao excluir solicitação"),
  });

  // Handlers de Ação
  const handleApprove = (id: string) => {
    updateStatusMutation.mutate({ id, status: "aprovado" });
  };

  const handleDeliver = (id: string) => {
    updateStatusMutation.mutate({ id, status: "entregue" });
  };

  const openRejectDialog = (id: string) => {
    setSelectedRequestId(id);
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const confirmRejection = () => {
    if (selectedRequestId) {
      if (!rejectionReason.trim()) {
        toast.warning("Por favor, informe o motivo da recusa.");
        return;
      }
      updateStatusMutation.mutate({ 
        id: selectedRequestId, 
        status: "rejeitado", 
        reason: rejectionReason 
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setRequestToDelete(id);
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
        request.request_items?.some((item: any) => {
          const productName = item.products?.name || item.custom_product_name || "";
          return productName.toLowerCase().includes(searchTerm.toLowerCase());
        });
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Solicitações de Material</h1>
          <p className="text-muted-foreground mt-1">Gerencie e aprove pedidos dos setores</p>
        </div>
      </div>

      {/* Barra de Ferramentas */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Filtros de Status (Abas) */}
          <div className="flex bg-muted/50 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
            {['all', 'aberto', 'aprovado', 'rejeitado', 'entregue'].map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                    isActive 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                  }`}
                >
                  {status === 'all' ? 'Todas' : statusStyles[status as keyof typeof statusStyles]?.label}
                </button>
              );
            })}
          </div>

          {/* Busca */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por setor, solicitante ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-muted-foreground/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Dados */}
      <Card className="border-muted-foreground/20 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[140px]">Data</TableHead>
                <TableHead className="w-[180px]">Solicitante / Setor</TableHead>
                <TableHead>Itens Solicitados</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                {canManage && <TableHead className="text-right pr-6">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-32">Carregando solicitações...</TableCell></TableRow>
              ) : filteredRequests?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-40">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-10 w-10 mb-2 opacity-20" />
                      <p>Nenhuma solicitação encontrada com os filtros atuais.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests?.map((request: any) => {
                  const style = statusStyles[request.status as keyof typeof statusStyles] || statusStyles.aberto;
                  
                  return (
                    <TableRow key={request.id} className="group hover:bg-muted/5">
                      {/* Data */}
                      <TableCell className="whitespace-nowrap font-medium text-muted-foreground text-xs">
                        {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      
                      {/* Solicitante */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{request.requester?.name || "Desconhecido"}</span>
                          <span className="text-xs text-muted-foreground">{request.sector}</span>
                        </div>
                      </TableCell>
                      
                      {/* Itens */}
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {request.request_items?.map((item: any) => (
                            <Badge key={item.id} variant="secondary" className="bg-slate-100 border-slate-200 text-slate-700 font-normal hover:bg-slate-200">
                              <span className="font-bold mr-1">{item.quantity_requested} {item.products?.unit || "UN"}</span> 
                              {item.products?.name || item.custom_product_name}
                            </Badge>
                          ))}
                        </div>
                        {request.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Motivo: {request.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      
                      {/* Status */}
                      <TableCell>
                        <Badge variant="outline" className={style.className}>
                          {style.label}
                        </Badge>
                      </TableCell>
                      
                      {/* Ações */}
                      {canManage && (
                        <TableCell className="text-right pr-4">
                          <div className="flex gap-2 justify-end items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            
                            {/* ESTADO: ABERTO */}
                            {request.status === "aberto" && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 shadow-sm" 
                                  onClick={() => handleApprove(request.id)}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1.5" /> Aprovar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3" 
                                  onClick={() => openRejectDialog(request.id)}
                                  disabled={updateStatusMutation.isPending}
                                >
                                  <X className="h-3.5 w-3.5 mr-1.5" /> Recusar
                                </Button>
                              </>
                            )}

                            {/* ESTADO: APROVADO */}
                            {request.status === "aprovado" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8" 
                                onClick={() => handleDeliver(request.id)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <Truck className="h-3.5 w-3.5 mr-1.5" /> Marcar Entregue
                              </Button>
                            )}

                            {/* Botão de Excluir (Sempre visível para admin limpar histórico se precisar) */}
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-muted-foreground hover:text-red-600" 
                              onClick={() => handleDeleteClick(request.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* --- DIALOG DE RECUSA --- */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Solicitação</DialogTitle>
            <DialogDescription>
              Por favor, informe o motivo da recusa para que o setor solicitante possa corrigir ou entender o problema.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="Ex: Item em falta no estoque, favor solicitar compra..." 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={confirmRejection}
              disabled={!rejectionReason.trim() || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "Processando..." : "Confirmar Recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE EXCLUSÃO --- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Registro</DialogTitle>
            <DialogDescription>
              Tem certeza? Isso removerá o histórico dessa solicitação permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={() => requestToDelete && deleteRequestMutation.mutate(requestToDelete)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}