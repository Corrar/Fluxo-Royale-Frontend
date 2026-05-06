import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Trash2, Package, ArrowRight } from "lucide-react";
import { toast } from "sonner";

// Lista de Setores
const SECTORS = [
  "Elétrica", 
  "Flow", 
  "Esteira", 
  "Lavadora", 
  "Usinagem", 
  "Desenvolvimento", 
  "Protótipo", 
  "Engenharia", 
  "Outros"
];

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
}

export function StockWithdrawalPanel() {
  const queryClient = useQueryClient();
  
  // Estados
  const [sector, setSector] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [opCode, setOpCode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Estados dos modais/gavetas
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState("");

  // 1. Buscar Produtos Reais da API
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data;
    },
  });

  // 2. Mutação para Enviar a Retirada
  const withdrawalMutation = useMutation({
    mutationFn: async (data: { sector: string; op_code?: string; items: { product_id: string; quantity: number }[] }) => {
      await api.post("/manual-withdrawal", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Retirada registrada com sucesso!");
      // Limpar formulário e fechar carrinho
      setCart([]);
      setSector("");
      setSearchTerm("");
      setOpCode("");
      setIsCartOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erro ao registrar retirada");
    },
  });

  // Filtragem de produtos (Busca)
  const filteredProducts = useMemo(() => {
    // 🛡️ PROTEÇÃO 1: Se products não existir ou não for um Array, retorna lista vazia e evita Crash
    if (!products || !Array.isArray(products)) return [];
    
    if (!searchTerm) return products.slice(0, 10); 
    
    return products.filter((p: any) => {
      // 🛡️ PROTEÇÃO 2: Garante que propriedades sejam strings antes de usar .toLowerCase()
      const name = p?.name || "";
      const sku = p?.sku || "";
      
      return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             sku.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [products, searchTerm]);

  // Handlers
  const handleProductSelect = (product: any) => {
    if (cart.find(item => item.product_id === product.id)) {
      toast.warning("Este produto já está na lista.");
      return;
    }
    
    // 🛡️ PROTEÇÃO 3: Aceita a chave "quantity" ou "quantity_on_hand", cobrindo diferentes retornos da API
    const available = Number(product.quantity ?? product.quantity_on_hand ?? 0);

    if (available <= 0) {
      toast.error("Produto sem estoque disponível.");
      return;
    }

    setSelectedProduct({ ...product, available });
    setQtyInput("");
    setIsQtyDialogOpen(true);
  };

  const confirmAddItem = () => {
    const qtd = parseFloat(qtyInput);
    
    // Segurança redundante do lado do cliente
    if (isNaN(qtd) || qtd <= 0) {
      toast.error("Digite uma quantidade válida maior que zero.");
      return;
    }
    
    if (qtd > selectedProduct.available) {
      toast.error(`Quantidade indisponível. Máximo: ${selectedProduct.available}`);
      return;
    }

    setCart([...cart, {
      product_id: selectedProduct.id,
      name: selectedProduct.name || "Sem Nome",
      sku: selectedProduct.sku || "-",
      unit: selectedProduct.unit || "un",
      quantity: qtd
    }]);

    setIsQtyDialogOpen(false);
    toast.success("Item adicionado à lista");
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.product_id !== id));
  };

  const handleSubmit = () => {
    if (!sector) {
      toast.error("Selecione o setor de destino.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione produtos à lista.");
      return;
    }

    withdrawalMutation.mutate({
      sector,
      op_code: opCode, 
      items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
    });
  };

  return (
    <div className="flex flex-col h-full gap-4 max-w-4xl mx-auto">
      
      {/* Cabeçalho com Botão do Carrinho */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold">Retirada de Estoque</h2>
          <p className="text-sm text-muted-foreground hidden sm:block">Busque os produtos e adicione ao carrinho</p>
        </div>
        
        {/* GAVETA DO CARRINHO (SHEET) */}
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button className="relative h-12 px-6" variant={cart.length > 0 ? "default" : "outline"}>
              <ShoppingCart className="h-5 w-5 mr-2" />
              Carrinho
              {cart.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full" variant="destructive">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg md:max-w-xl overflow-hidden flex flex-col">
            <SheetHeader className="pb-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Sua Lista de Retirada
              </SheetTitle>
              <SheetDescription>
                Revise os itens, selecione o setor e confirme a saída.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-6">
              {/* Seleção de Setor */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Setor de Destino</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* CAMPO DA OP */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Número da OP</Label>
                <Input 
                  placeholder="Digite a OP (Obrigatório para peças/componentes)" 
                  value={opCode}
                  onChange={(e) => setOpCode(e.target.value)}
                  className="h-12 border-primary/20 focus-visible:ring-primary/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  Deixe em branco apenas se retirar exclusivamente Camisetas/EPIs/Ferramentas.
                </p>
              </div>

              {/* Tabela de Itens */}
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-24 text-center">Qtd.</TableHead>
                      <TableHead className="w-12 text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                          O carrinho está vazio. Adicione itens primeiro.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="align-top py-4">
                            <span className="font-medium text-sm whitespace-normal break-words block leading-tight mb-1">
                              {item.name}
                            </span>
                            <span className="text-xs text-muted-foreground block">SKU: {item.sku}</span>
                          </TableCell>
                          <TableCell className="text-center font-bold align-top py-4">
                            {item.quantity}
                            <span className="text-xs font-normal text-muted-foreground block">{item.unit}</span>
                          </TableCell>
                          <TableCell className="align-top py-3 text-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                              onClick={() => handleRemoveItem(item.product_id)}
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Rodapé da Gaveta */}
            <div className="pt-4 border-t mt-auto">
              <Button 
                className="w-full h-14 text-lg font-bold" 
                onClick={handleSubmit}
                disabled={cart.length === 0 || !sector || withdrawalMutation.isPending}
              >
                {withdrawalMutation.isPending ? "Processando..." : (
                  <>Confirmar Saída <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ÁREA DE BUSCA E LISTAGEM */}
      <Card className="flex-1 flex flex-col border-muted-foreground/20 shadow-md min-h-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Digite o nome ou SKU do produto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 text-lg rounded-xl"
              autoFocus
            />
          </div>

          <div className="space-y-3 mt-4 flex-1 overflow-y-auto pr-2 pb-4">
            {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Carregando produtos...</p>}
            
            {!isLoading && filteredProducts.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum produto encontrado para "{searchTerm}".</p>
            )}

            {filteredProducts.map((product: any) => {
               // 🛡️ PROTEÇÃO: Aceita quantidade de múltiplas origens de forma segura
               const available = Number(product.quantity ?? product.quantity_on_hand ?? 0);
               const isLow = available < (product.min_stock || 0);

               return (
                <div 
                  key={product.id} 
                  className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-all group shadow-sm"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="max-w-[200px] sm:max-w-md lg:max-w-lg">
                      <p className="font-semibold text-base leading-tight">{product.name || "Produto sem nome"}</p>
                      <p className="text-sm text-muted-foreground mt-1">SKU: {product.sku || "-"}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <Badge variant={available > 0 ? "outline" : "destructive"} className="mb-1 text-sm py-1 px-3">
                      {available} {product.unit || "un"}
                    </Badge>
                    {isLow && available > 0 && <span className="text-xs text-yellow-600 font-bold bg-yellow-100 px-2 py-0.5 rounded-md mt-1">Estoque Baixo</span>}
                  </div>
                </div>
               );
            })}
          </div>
        </CardContent>
      </Card>

      {/* DIALOG PARA QUANTIDADE */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informe a Quantidade</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6 py-4">
              <div className="bg-muted/40 p-4 rounded-lg">
                <p className="font-bold text-lg mb-1">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground font-medium">Estoque Disponível: {selectedProduct.available} {selectedProduct.unit || "un"}</p>
              </div>
              <div className="flex gap-3 items-center">
                <Input 
                  type="number" 
                  min="0.01"
                  step="0.01" 
                  placeholder="0.00" 
                  value={qtyInput}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val < 0) return;
                    setQtyInput(e.target.value);
                  }}
                  className="text-2xl h-14 font-semibold text-center"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e') {
                      e.preventDefault();
                    }
                    if (e.key === 'Enter') {
                      confirmAddItem();
                    }
                  }}
                />
                <span className="text-muted-foreground font-bold text-lg">{selectedProduct.unit || "un"}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-12" onClick={() => setIsQtyDialogOpen(false)}>Cancelar</Button>
            <Button className="h-12 px-8" onClick={confirmAddItem}>Adicionar à Lista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
