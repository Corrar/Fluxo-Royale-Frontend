import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Plus, Trash2, Search, ShoppingCart, ArrowRight, History, Box,
  Clock, CheckCircle2, XCircle, Truck, AlertTriangle, Send, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Configuração de Status ---
const statusConfig = {
  aberto: { label: "Aberto", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  entregue: { label: "Entregue", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300", icon: Truck },
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
  
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [sector] = useState(profile?.sector || "Setor não definido");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState("");

  // 1. DADOS
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => (await api.get("/my-requests")).data,
    refetchInterval: 10000, 
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await api.get("/products")).data,
  });

  // 2. MUTAÇÃO
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
      const msg = error.response?.data?.error || "Erro ao criar solicitação.";
      toast.error(msg);
    },
  });

  // --- Função Auxiliar de Cálculo de Estoque (Lógica Inteligente) ---
  const getAvailableStock = (product: any) => {
    // Com a atualização do backend, 'stock' agora é um objeto estruturado
    const stockInfo = product.stock; 
    
    // Se não existir informação de stock, retorna 0
    if (!stockInfo) return 0;

    // O onHand que vem do banco JÁ É o saldo livre da prateleira.
    // (Porque quando aprovamos pedidos, já descontamos do on_hand no banco).
    const onHand = Number(stockInfo.quantity_on_hand || 0);
    
    // 'openRequests' são os pedidos na fila (ainda 'aberto').
    // Precisamos descontar eles virtualmente para você não pedir o que já foi pedido mas ainda não aprovado.
    const openRequests = Number(stockInfo.quantity_open || 0); 

    // NÃO subtraímos 'reserved' aqui, pois o banco já fez isso no onHand.
    
    // Estoque Virtual = Físico Livre - Fila de Espera
    return Math.max(0, onHand - openRequests);
  };

  // --- Lógica ---
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products.slice(0, 20); // Mostra mais produtos inicialmente
    return products.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleProductSelect = (product: any) => {
    if (cart.find(item => item.product_id === product.id)) {
      toast.info("Item já adicionado. Remova do carrinho para editar.");
      return;
    }

    const available = getAvailableStock(product);

    if (available <= 0) {
      toast.error("Produto indisponível ou já comprometido em outras solicitações.");
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
      toast.error(`Quantidade indisponível. Máximo: ${selectedProduct.available}`);
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
    toast.success("Adicionado!");
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.product_id !== id));
  };

  const handleSubmit = () => {
    if (!sector) return toast.error("Erro: Setor não identificado.");
    if (cart.length === 0) return toast.error("Carrinho vazio.");
    createRequestMutation.mutate({
      sector,
      items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel do Setor</h1>
          <p className="text-muted-foreground">Solicite materiais do estoque central</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg border">
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
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden pb-2">
          
          {/* ESQUERDA: CATÁLOGO DE PRODUTOS */}
          <Card className="flex flex-col flex-[2] h-full border-muted-foreground/20 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/10 shrink-0 border-b space-y-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5 text-primary" /> Catálogo de Produtos
                </CardTitle>
                <Badge variant="outline" className="bg-background">{filteredProducts.length} itens encontrados</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Digite o nome, SKU ou descrição..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-background text-base"
                />
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 bg-muted/5">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3">
                {isLoadingProducts ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Box className="h-8 w-8 animate-bounce mb-2" /> Carregando catálogo...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    Nenhum produto encontrado com este termo.
                  </div>
                ) : (
                  filteredProducts.map((product: any) => {
                    const available = getAvailableStock(product);
                    const inCart = cart.some(i => i.product_id === product.id);
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`
                          relative flex flex-col p-4 rounded-lg border shadow-sm transition-all bg-card
                          ${available <= 0 ? 'opacity-60 grayscale cursor-not-allowed border-dashed' : 'hover:border-primary hover:shadow-md cursor-pointer'}
                          ${inCart ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}
                        `}
                        onClick={() => available > 0 && handleProductSelect(product)}
                      >
                        {inCart && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                            NO CARRINHO
                          </div>
                        )}

                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h3 className="font-semibold text-sm leading-snug text-foreground break-words line-clamp-2" title={product.name}>
                            {product.name}
                          </h3>
                          {available > 0 ? (
                            <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200">
                              {available} {product.unit}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="shrink-0">Esgotado</Badge>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-dashed">
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{product.sku}</span>
                          </div>
                          <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                            Selecionar <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* DIREITA: CARRINHO / REVISÃO */}
          <Card className="flex flex-col flex-1 h-full border-l-4 border-l-primary shadow-lg bg-card overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-primary">
                <ShoppingCart className="h-5 w-5" /> Revisão do Pedido
              </CardTitle>
              <CardDescription>
                Setor: <span className="font-semibold text-foreground">{sector}</span>
              </CardDescription>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-0">
              <div className="flex flex-col divide-y divide-border">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3 px-4 text-center">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 opacity-50" />
                    </div>
                    <p>Seu carrinho está vazio.</p>
                    <p className="text-sm opacity-70">Clique nos produtos à esquerda para adicionar.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product_id} className="flex gap-3 p-4 hover:bg-muted/10 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground break-words leading-snug">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{item.sku}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md">
                          <span className="font-bold text-sm">{item.quantity}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{item.unit}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50 -mr-1" 
                          onClick={() => handleRemoveItem(item.product_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-4 bg-muted/20 border-t mt-auto">
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="text-muted-foreground">Total de Itens:</span>
                <span className="font-bold text-lg">{cart.length}</span>
              </div>
              <Button 
                className="w-full h-12 text-base font-bold shadow-md transition-all hover:scale-[1.02]" 
                onClick={handleSubmit} 
                disabled={cart.length === 0 || createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="mr-2 h-5 w-5" /> Confirmar Pedido</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* --- ABA: HISTÓRICO DE PEDIDOS --- */}
      {activeTab === "history" && (
        <Card className="flex-1 overflow-hidden border-muted-foreground/20 flex flex-col min-h-0 shadow-sm">
          <CardHeader className="shrink-0 pb-2 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico de Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[140px]">Data</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead className="w-[160px] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRequests ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-32">Carregando...</TableCell></TableRow>
                ) : requests?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-32 text-muted-foreground">Nenhum pedido realizado.</TableCell></TableRow>
                ) : (
                  requests?.map((request: any) => {
                    const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.aberto;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={request.id} className="hover:bg-muted/5">
                        <TableCell className="align-top py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{format(new Date(request.created_at), "dd/MM/yy")}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(request.created_at), "HH:mm")}</span>
                            <span className="text-[10px] font-mono text-muted-foreground mt-1">#{request.id}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell className="align-top py-4">
                          <div className="space-y-1">
                            {request.request_items?.map((item: any) => (
                              <div key={item.id} className="flex items-start gap-2 text-sm">
                                <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[10px] shrink-0">
                                  {item.quantity_requested} {item.products?.unit}
                                </Badge>
                                <span className="text-foreground leading-tight">{item.products?.name || item.custom_product_name}</span>
                              </div>
                            ))}
                            
                            {request.rejection_reason && (
                              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded text-xs text-red-800 dark:text-red-300 flex gap-2">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>Recusa: {request.rejection_reason}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
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

      {/* --- DIALOG DE QUANTIDADE (Formulário Simples) --- */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle>Quantas unidades?</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/30 p-3 rounded-lg border">
                <p className="font-semibold text-sm leading-tight mb-1">{selectedProduct.name}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>SKU: {selectedProduct.sku}</span>
                  <span>Disp: <strong className="text-foreground">{selectedProduct.available}</strong></span>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="text-xl h-14 font-bold text-center bg-background" 
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()}
                />
                <div className="h-14 w-16 bg-muted flex items-center justify-center rounded-md font-medium text-muted-foreground border">
                  {selectedProduct.unit}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsQtyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAddItem} className="w-full sm:w-auto">Adicionar ao Pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}