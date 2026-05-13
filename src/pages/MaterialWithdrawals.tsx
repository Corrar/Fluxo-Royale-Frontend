import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Search, ShoppingCart, Trash2, LogOut, Loader2, Minus, Plus } from "lucide-react";

// Setores autorizados para saída
const SECTORS = [
  "Elétrica", "Flow", "Esteira", "Lavadora", "Usinagem", 
  "Desenvolvimento", "Protótipo", "Engenharia", "Outros", 
  "Viagem", "Terceiros", "Acumulador", "Reposição"
];

interface CartItem { 
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number; 
}

export default function MaterialWithdrawals() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [destination, setDestination] = useState("");
  const [opCode, setOpCode] = useState("");

  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => (await api.get("/stock")).data,
  });

  const manualExitMutation = useMutation({
    mutationFn: async (data: { sector: string; op_code?: string; items: any[] }) => await api.post("/stock/manual-withdrawal", data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Saída registrada com sucesso!"); 
      setCart([]); setDestination(""); setOpCode(""); setSearchTerm("");
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao registrar saída."),
  });

  const filteredStocks = useMemo(() => {
    if (!stocks || !searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return stocks
      .filter((s: any) => s.products?.name?.toLowerCase().includes(term) || s.products?.sku?.toLowerCase().includes(term))
      .slice(0, 8); // Limita a 8 resultados para manter a UI limpa
  }, [stocks, searchTerm]);

  const addToCart = (stock: any) => {
    if (cart.find(item => item.product_id === stock.products.id)) return toast.info("Item já está na lista.");
    const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
    if (available <= 0) return toast.error("Sem estoque disponível para saída.");

    setCart([...cart, { 
      product_id: stock.products.id, name: stock.products.name, sku: stock.products.sku, 
      unit: stock.products.unit, current_stock: available, quantity: 1 
    }]);
    setSearchTerm(""); 
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = item.quantity + delta;
        if (newQty > item.current_stock) { toast.warning(`Máximo disponível: ${item.current_stock}`); return { ...item, quantity: item.current_stock }; }
        return { ...item, quantity: Math.max(1, newQty) };
      }
      return item;
    }));
  };

  // ---> AQUI ESTÁ A FUNÇÃO QUE FALTAVA <---
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <LogOut className="h-6 w-6 text-red-500" /> Saída de Materiais
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Registe a retirada de material do armazém para os setores da fábrica.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA: BUSCA DE PRODUTOS */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 bg-card border shadow-sm">
            <Label className="text-sm font-semibold mb-2 block text-muted-foreground">Procurar Produto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Digite o nome ou SKU do produto..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10 h-12 text-lg bg-background" 
              />
            </div>
            
            {/* Resultados da Busca */}
            {searchTerm && (
              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredStocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado com estoque disponível.</p>
                ) : (
                  filteredStocks.map((stock: any) => {
                    const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
                    return (
                      <div key={stock.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-bold text-foreground text-sm">{stock.products?.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {stock.products?.sku || '-'} | Disp: <span className="font-bold text-emerald-500">{available} {stock.products?.unit}</span></p>
                        </div>
                        <Button size="sm" onClick={() => addToCart(stock)} variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                          Adicionar
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </Card>
        </div>

        {/* COLUNA DIREITA: CARRINHO E CHECKOUT */}
        <div className="lg:col-span-1">
          <Card className="p-5 bg-card border shadow-md flex flex-col h-full sticky top-6">
            <h3 className="font-bold text-lg border-b pb-3 mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" /> Lista de Retirada
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[200px] max-h-[40vh] custom-scrollbar pr-1 mb-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-8">
                  <ShoppingCart className="h-10 w-10 mb-2" />
                  <p className="text-sm font-medium">A lista está vazia</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product_id} className="p-3 bg-background border rounded-lg relative group">
                    <p className="font-semibold text-sm leading-tight pr-6">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground mb-2">Máx: {item.current_stock}</p>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <button onClick={() => removeFromCart(item.product_id)} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4 pt-4 border-t mt-auto">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destino / Setor *</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">OP / Observação (Opcional)</Label>
                <Input placeholder="Ex: OP-1234" value={opCode} onChange={(e) => setOpCode(e.target.value)} className="bg-background" />
              </div>

              <Button 
                className="w-full h-12 text-md font-bold shadow-lg" 
                variant="destructive"
                disabled={cart.length === 0 || manualExitMutation.isPending}
                onClick={() => {
                  if (cart.length === 0) return toast.warning("Adicione itens à lista.");
                  if (!destination) return toast.warning("Selecione o setor de destino.");
                  manualExitMutation.mutate({ sector: destination, op_code: opCode.trim(), items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })) });
                }}
              >
                {manualExitMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />}
                Confirmar Saída
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
