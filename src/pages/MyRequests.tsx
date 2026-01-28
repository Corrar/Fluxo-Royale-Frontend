import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Plus, Trash2, Search, ShoppingCart, History, Box,
  Clock, CheckCircle2, XCircle, Truck, AlertTriangle, Send, Loader2,
  ChevronUp, Package
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Configuração de Status ---
const statusConfig = {
  aberto: { label: "Aberto", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  entregue: { label: "Entregue", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Truck },
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
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [sector] = useState(profile?.sector || "Setor não definido");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Modais
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false); 
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState("");

  // 1. SOCKET
  useEffect(() => {
    if (socket) {
      const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["my-requests"] });
        queryClient.invalidateQueries({ queryKey: ["products-list"] });
      };
      socket.on("refresh_requests", handleRefresh);
      socket.on("refresh_stock", handleRefresh);
      return () => {
        socket.off("refresh_requests", handleRefresh);
        socket.off("refresh_stock", handleRefresh);
      };
    }
  }, [socket, queryClient]);

  // 2. DADOS
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => (await api.get("/my-requests")).data,
    refetchInterval: 10000, 
    placeholderData: keepPreviousData, 
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await api.get("/products")).data,
    placeholderData: keepPreviousData,
  });

  // 3. MUTAÇÃO
  const createRequestMutation = useMutation({
    mutationFn: async (data: { sector: string; items: Array<{ product_id: string; quantity: number }> }) => {
      await api.post("/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });

      toast.success("Solicitação enviada com sucesso!");
      setCart([]); 
      setIsMobileCartOpen(false);
      setActiveTab("history"); 
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Erro ao criar solicitação.";
      toast.error(msg);
    },
  });

  // --- Helpers ---
  const getAvailableStock = (product: any) => {
    const stockInfo = product.stock; 
    if (!stockInfo) return 0;
    const onHand = Number(stockInfo.quantity_on_hand || 0);
    const openRequests = Number(stockInfo.quantity_open || 0); 
    return Math.max(0, onHand - openRequests);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products.slice(0, 50); 
    return products.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleProductSelect = (product: any) => {
    const available = getAvailableStock(product);
    if (available <= 0) {
      toast.error("Produto indisponível.");
      return;
    }
    setSelectedProduct({ ...product, available });
    
    const existing = cart.find(i => i.product_id === product.id);
    setQtyInput(existing ? existing.quantity.toString() : "");
    
    setIsQtyDialogOpen(true);
  };

  const confirmAddItem = () => {
    const qtd = parseInt(qtyInput, 10);
    if (!qtd || qtd <= 0) return toast.error("Quantidade inválida");
    if (qtd > selectedProduct.available) return toast.error(`Máximo disponível: ${Math.floor(selectedProduct.available)}`);

    const existingIndex = cart.findIndex(i => i.product_id === selectedProduct.id);
    
    if (existingIndex >= 0) {
        const newCart = [...cart];
        newCart[existingIndex].quantity = qtd;
        setCart(newCart);
        toast.success("Quantidade atualizada!");
    } else {
        setCart([...cart, {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          unit: selectedProduct.unit,
          quantity: qtd
        }]);
        toast.success("Adicionado ao carrinho!");
    }
    setIsQtyDialogOpen(false);
  };

  const handleRemoveItem = (id: string) => {
    const newCart = cart.filter(item => item.product_id !== id);
    setCart(newCart);
    if (newCart.length === 0) setIsMobileCartOpen(false); 
  };

  const handleSubmit = () => {
    if (!sector) return toast.error("Erro: Setor não identificado.");
    if (cart.length === 0) return toast.error("Carrinho vazio.");
    createRequestMutation.mutate({
      sector,
      items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
    });
  };

  // --- COMPONENTE VISUAL DO CARRINHO ---
  const CartListContent = () => (
    <div className="flex flex-col h-full bg-background">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
            <ShoppingCart className="h-12 w-12 opacity-20" />
            <p>Seu carrinho está vazio.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 py-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex gap-3 items-center bg-card p-3 rounded-lg border shadow-sm overflow-hidden">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                    <Package className="h-5 w-5" />
                  </div>
                  
                  {/* ALTERAÇÃO: Removido line-clamp-2 para exibir nome completo no carrinho */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight break-words" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded">{item.sku}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-1">
                    <div className="text-right">
                        <span className="block text-sm font-bold">{item.quantity}</span>
                        <span className="block text-[10px] text-muted-foreground uppercase">{item.unit}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleRemoveItem(item.product_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

      <div className="p-4 border-t bg-background mt-auto pb-8 md:pb-4">
         <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-muted-foreground">Total de Itens</span>
            <span className="text-xl font-bold">{cart.length}</span>
         </div>
         <Button 
            className="w-full h-12 text-base font-bold shadow-lg" 
            onClick={handleSubmit} 
            disabled={cart.length === 0 || createRequestMutation.isPending}
         >
            {createRequestMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Send className="mr-2 h-5 w-5" />}
            Confirmar Solicitação
         </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Minhas Solicitações</h1>
          <p className="text-sm md:text-base text-muted-foreground">Setor: <span className="font-semibold text-foreground">{sector}</span></p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg border w-full md:w-auto">
          <Button 
            variant={activeTab === "new" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab("new")}
            className="flex-1 md:flex-none gap-2"
          >
            <Plus className="h-4 w-4" /> Nova
          </Button>
          <Button 
            variant={activeTab === "history" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab("history")}
            className="flex-1 md:flex-none gap-2"
          >
            <History className="h-4 w-4" /> Histórico
          </Button>
        </div>
      </div>

      {/* --- ABA: NOVA SOLICITAÇÃO --- */}
      {activeTab === "new" && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 relative">
          
          {/* ESQUERDA: CATÁLOGO */}
          <Card className="flex flex-col flex-[2] h-full border-muted-foreground/20 shadow-sm overflow-hidden pb-24 lg:pb-0">
            <CardHeader className="pb-3 bg-muted/10 shrink-0 border-b p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar produto por nome ou SKU..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background h-10"
                />
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 bg-muted/5">
              <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {isLoadingProducts ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Box className="h-8 w-8 animate-bounce mb-2" /> Carregando...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    Nenhum produto encontrado.
                  </div>
                ) : (
                  filteredProducts.map((product: any) => {
                    const available = getAvailableStock(product);
                    const inCart = cart.some(i => i.product_id === product.id);
                    const cartItem = cart.find(i => i.product_id === product.id);
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`
                          relative flex flex-col p-3 md:p-4 rounded-lg border shadow-sm transition-all bg-card
                          ${available <= 0 ? 'opacity-60 grayscale cursor-not-allowed border-dashed' : 'hover:border-primary hover:shadow-md cursor-pointer active:scale-95'}
                          ${inCart ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}
                        `}
                        onClick={() => available > 0 && handleProductSelect(product)}
                      >
                        {inCart && (
                            <Badge className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] animate-in zoom-in">
                                {cartItem?.quantity} {cartItem?.unit} no Carrinho
                            </Badge>
                        )}

                        <div className="flex justify-between items-start gap-2 mb-2">
                          {/* ALTERAÇÃO: Removido line-clamp-2 para exibir nome completo */}
                          <h3 className="font-semibold text-sm leading-snug break-words">{product.name}</h3>
                          {available > 0 ? (
                            <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-800 h-5 px-1.5 text-[10px]">
                              {Math.floor(available)} {product.unit}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="shrink-0 h-5 px-1.5 text-[10px]">Esgotado</Badge>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-dashed">
                          <span className="font-mono bg-muted px-1 rounded">{product.sku}</span>
                          <span className={`font-medium flex items-center ${inCart ? 'text-primary' : 'text-muted-foreground'}`}>
                             {inCart ? 'Editar Qtd.' : 'Adicionar'} <Plus className="h-3 w-3 ml-1"/>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* DIREITA: CARRINHO (Apenas Desktop) */}
          <Card className="hidden lg:flex flex-col flex-1 h-full border-l-4 border-l-primary shadow-lg bg-card overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b p-4">
              <CardTitle className="flex items-center gap-2 text-lg text-primary">
                <ShoppingCart className="h-5 w-5" /> Seu Carrinho
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              <CartListContent />
            </CardContent>
          </Card>

          {/* === BARRA FIXA INFERIOR (Apenas Mobile) === */}
          {cart.length > 0 && (
            <div className="fixed bottom-0 left-0 w-full bg-background border-t p-4 z-40 lg:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
               <div className="flex items-center gap-4 max-w-md mx-auto">
                 <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Total de itens</p>
                    <p className="font-bold text-lg leading-none">{cart.length} produto(s)</p>
                 </div>
                 <Button 
                    size="lg" 
                    className="gap-2 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6"
                    onClick={() => setIsMobileCartOpen(true)}
                 >
                    Ver Carrinho <ChevronUp className="h-4 w-4" />
                 </Button>
               </div>
            </div>
          )}
        </div>
      )}

      {/* --- ABA: HISTÓRICO --- */}
      {activeTab === "history" && (
        <Card className="flex-1 overflow-hidden border-muted-foreground/20 flex flex-col min-h-0 shadow-sm bg-transparent border-none md:bg-card md:border">
          
          {/* DESKTOP TABLE */}
          <div className="hidden md:block h-full overflow-auto rounded-md border bg-card">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[120px] text-center">Data</TableHead>
                  <TableHead>Itens Solicitados</TableHead>
                  <TableHead className="w-[140px] text-center">Status</TableHead>
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
                        <TableCell className="align-top text-center py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{format(new Date(request.created_at), "dd/MM/yyyy")}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(request.created_at), "HH:mm")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top py-4">
                          <div className="space-y-1">
                            {request.request_items?.map((item: any) => (
                              <div key={item.id} className="text-sm flex gap-2 items-center">
                                <Badge variant="outline" className="h-5 px-1 font-mono text-[10px]">{Math.floor(item.quantity_requested)} {item.products?.unit}</Badge>
                                <span className="text-foreground">{item.products?.name || item.custom_product_name}</span>
                              </div>
                            ))}
                            {request.rejection_reason && (
                              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3"/> Motivo: {request.rejection_reason}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-center py-4">
                          <Badge variant="outline" className={`${status.color} px-3 py-1`}>
                            <StatusIcon className="h-3 w-3 mr-1" /> {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3 overflow-auto pb-4">
            {isLoadingRequests ? <div className="text-center p-4">Carregando...</div> : 
             requests?.length === 0 ? <div className="text-center p-10 text-muted-foreground bg-card rounded-lg border">Sem histórico.</div> :
             requests?.map((request: any) => {
               const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.aberto;
               const StatusIcon = status.icon;
               return (
                <Card key={request.id} className="shadow-sm border-l-4" style={{ borderLeftColor: status.label === 'Aprovado' ? '#10b981' : status.label === 'Rejeitado' ? '#ef4444' : '#3b82f6' }}>
                  <CardHeader className="p-4 pb-2 flex flex-row justify-between items-start space-y-0">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        Pedido #{request.id.toString().slice(0,6)}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {format(new Date(request.created_at), "dd 'de' MMM, HH:mm")}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${status.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1"/> {status.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="space-y-2 mt-2">
                      {request.request_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm border-b border-dashed last:border-0 pb-1 last:pb-0">
                          <span className="text-foreground line-clamp-1 mr-2">{item.products?.name}</span>
                          <span className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                            {Math.floor(item.quantity_requested)} {item.products?.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
               )
             })
            }
          </div>
        </Card>
      )}

      {/* --- DIALOG DE QUANTIDADE (Adicionar Item) --- */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent className="max-w-[90%] sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Quantidade</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 p-3 rounded-lg border">
                <p className="font-semibold text-sm leading-tight mb-1">{selectedProduct.name}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                   <span>Disponível: <strong>{Math.floor(selectedProduct.available)}</strong></span>
                   <span>Un: {selectedProduct.unit}</span>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <Input 
                  type="number" 
                  step="1" 
                  placeholder="0" 
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="text-2xl h-14 font-bold text-center" 
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()}
                />
              </div>
              <Button onClick={confirmAddItem} className="w-full h-12 text-lg">Confirmar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- DIALOG CARRINHO MOBILE (CORRIGIDO: CSS FORCE OVERRIDE) --- */}
      <Dialog open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DialogContent 
            className="fixed z-50 left-0 bottom-0 w-full max-w-none h-[85vh] translate-x-0 translate-y-0 p-0 gap-0 bg-background rounded-t-xl border-t shadow-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-300"
            // Forçamos estilos inline para garantir que o Radix UI não centralize
            style={{ 
                left: 0, 
                bottom: 0, 
                top: 'auto', 
                transform: 'none', 
                maxWidth: '100%' 
            }}
        >
          <DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5"/> Revisar Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <CartListContent />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
