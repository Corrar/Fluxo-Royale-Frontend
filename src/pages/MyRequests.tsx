import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  ShoppingCart, 
  ArrowRight, 
  History, 
  Box, 
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

// --- Configuração de Status ---
const statusConfig = {
  aberto: { 
    label: "Aberto", 
    color: "bg-blue-50 text-blue-700 border-blue-200", 
    icon: Clock 
  },
  aprovado: { 
    label: "Aprovado", 
    color: "bg-emerald-50 text-emerald-700 border-emerald-200", 
    icon: CheckCircle2 
  },
  rejeitado: { 
    label: "Rejeitado", 
    color: "bg-red-50 text-red-700 border-red-200", 
    icon: XCircle 
  },
  entregue: { 
    label: "Entregue", 
    color: "bg-gray-100 text-gray-700 border-gray-200", 
    icon: Truck 
  },
};

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
}

export default function MyRequests() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Estados
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [sector] = useState(profile?.sector || "Setor não definido");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Estados do Dialog
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState("");

  // 1. BUSCAR DADOS
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => {
      const response = await api.get("/my-requests");
      return response.data;
    },
    refetchInterval: 10000, // Atualiza a cada 10s para ver mudanças de status
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data;
    },
  });

  // 2. MUTAÇÃO DE CRIAÇÃO
  const createRequestMutation = useMutation({
    mutationFn: async (data: { sector: string; items: Array<{ product_id: string; quantity: number }> }) => {
      await api.post("/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      toast.success("Solicitação enviada com sucesso!");
      setCart([]); 
      setActiveTab("history"); 
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erro ao criar solicitação");
    },
  });

  // --- Lógica de Negócio ---

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products.slice(0, 10);
    return products.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleProductSelect = (product: any) => {
    if (cart.find(item => item.product_id === product.id)) {
      toast.warning("Este item já está na lista.");
      return;
    }
    const stockInfo = product.stock?.[0];
    const available = stockInfo ? (stockInfo.quantity_on_hand - stockInfo.quantity_reserved) : 0;

    if (available <= 0) {
      toast.error("Produto indisponível no estoque.");
      return;
    }

    setSelectedProduct({ ...product, available });
    setQtyInput("");
    setIsQtyDialogOpen(true);
  };

  const confirmAddItem = () => {
    const qtd = parseFloat(qtyInput);
    if (!qtd || qtd <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    if (qtd > selectedProduct.available) {
      toast.error(`Quantidade indisponível. Estoque atual: ${selectedProduct.available} ${selectedProduct.unit}`);
      return;
    }

    setCart([...cart, {
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      unit: selectedProduct.unit,
      quantity: qtd
    }]);

    setIsQtyDialogOpen(false);
    toast.success("Adicionado à lista");
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.product_id !== id));
  };

  const handleSubmit = () => {
    if (!sector) return toast.error("Erro: Setor não identificado.");
    if (cart.length === 0) return toast.error("Adicione itens à solicitação.");

    createRequestMutation.mutate({
      sector,
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Painel do Setor</h1>
          <p className="text-muted-foreground">Gerencie suas solicitações de material</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg">
          <Button 
            variant={activeTab === "new" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab("new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Nova Solicitação
          </Button>
          <Button 
            variant={activeTab === "history" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab("history")}
            className="gap-2"
          >
            <History className="h-4 w-4" /> Meus Pedidos
          </Button>
        </div>
      </div>

      {/* --- ABA: NOVA SOLICITAÇÃO --- */}
      {activeTab === "new" && (
        <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0 overflow-hidden pb-2">
          
          {/* Catálogo */}
          <Card className="flex flex-col h-full border-muted-foreground/20 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/10 shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5 text-primary" /> Buscar Produtos
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome ou SKU..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2">
              {isLoadingProducts ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Box className="h-8 w-8 animate-bounce mb-2" /> Carregando...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Nenhum produto encontrado.</div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product: any) => {
                    const stockInfo = product.stock?.[0];
                    const available = stockInfo ? (stockInfo.quantity_on_hand - stockInfo.quantity_reserved) : 0;
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all group bg-card ${available > 0 ? 'hover:bg-muted/50 hover:border-primary/30 cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                        onClick={() => available > 0 && handleProductSelect(product)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${available > 0 ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <Package className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span className="font-mono bg-muted px-1.5 rounded">{product.sku}</span>
                              <span className="truncate">{product.unit}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {available > 0 ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Disp: {available}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">Esgotado</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carrinho */}
          <Card className="flex flex-col h-full border-muted-foreground/20 shadow-md bg-slate-50/50 overflow-hidden">
            <CardHeader className="pb-4 bg-white border-b shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5 text-primary" /> Itens da Solicitação
              </CardTitle>
              <CardDescription>Revise os itens antes de enviar</CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <div className="p-4 bg-white border-b space-y-1.5 relative">
                <Label htmlFor="sector" className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  Setor Solicitante <Lock className="h-3 w-3 text-muted-foreground/70" />
                </Label>
                <Input id="sector" value={sector} readOnly className="bg-slate-100 border-slate-200 text-muted-foreground cursor-not-allowed pl-3 font-semibold" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 opacity-60">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center"><ShoppingCart className="h-8 w-8" /></div>
                    <div className="text-center">
                      <p className="font-medium">Sua lista está vazia</p>
                      <p className="text-xs">Selecione produtos no catálogo ao lado</p>
                    </div>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product_id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-bold block">{item.quantity}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{item.unit}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveItem(item.product_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-white border-t mt-auto shrink-0">
                <Button className="w-full h-12 text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]" onClick={handleSubmit} disabled={cart.length === 0 || createRequestMutation.isPending}>
                  {createRequestMutation.isPending ? "Enviando..." : (
                    <>Enviar Solicitação <ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- ABA: HISTÓRICO DE PEDIDOS (ATUALIZADO) --- */}
      {activeTab === "history" && (
        <Card className="flex-1 overflow-hidden border-muted-foreground/20 flex flex-col min-h-0 shadow-sm">
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Meus Pedidos Recentes
            </CardTitle>
            <CardDescription>Acompanhe o status das suas solicitações</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead>Itens Solicitados</TableHead>
                  <TableHead className="w-[160px] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRequests ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-32">Carregando histórico...</TableCell></TableRow>
                ) : requests?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-32 text-muted-foreground">Você ainda não fez nenhuma solicitação.</TableCell></TableRow>
                ) : (
                  requests?.map((request: any) => {
                    const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.aberto;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={request.id} className="hover:bg-muted/5 group">
                        {/* Data */}
                        <TableCell className="align-top py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{format(new Date(request.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(request.created_at), "HH:mm")}</span>
                          </div>
                        </TableCell>
                        
                        {/* Itens */}
                        <TableCell className="align-top py-4">
                          <div className="space-y-2">
                            <ul className="text-sm space-y-1">
                              {request.request_items?.map((item: any) => (
                                <li key={item.id} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[10px] bg-slate-100 text-slate-700 border-slate-200">
                                    {item.quantity_requested} {item.products?.unit || "UN"}
                                  </Badge>
                                  <span className="truncate text-sm">{item.products?.name || item.custom_product_name}</span>
                                </li>
                              ))}
                            </ul>
                            
                            {/* Alerta de Recusa (Se houver motivo) */}
                            {request.status === 'rejeitado' && request.rejection_reason && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-800 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-xs uppercase tracking-wide mb-0.5">Motivo da Recusa:</p>
                                  <p>{request.rejection_reason}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Status */}
                        <TableCell className="align-top py-4 text-center">
                          <Badge variant="outline" className={`${status.color} px-3 py-1 gap-1.5 text-xs font-medium`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Quantidade */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 p-3 rounded-lg border">
                <p className="font-semibold text-sm">{selectedProduct.name}</p>
                <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                  <span>SKU: {selectedProduct.sku}</span>
                  <span>Estoque: <strong>{selectedProduct.available}</strong></span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="number" step="0.01" placeholder="0.00" value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    className="text-lg h-12 font-bold text-center" autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()}
                  />
                  <span className="text-muted-foreground font-medium w-12 text-center bg-muted h-12 flex items-center justify-center rounded-md">{selectedProduct.unit}</span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Máximo: {selectedProduct.available}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsQtyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAddItem}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}