import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { toast } from "sonner";
import * as XLSX from "xlsx"; // Importação da biblioteca Excel
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Search, ShoppingCart, Trash2, LogOut, Loader2, Minus, Plus, Download, FileUp } from "lucide-react";

// Setores autorizados para saída
const SECTORS = [
  "Elétrica", "Flow", "Esteira", "Lavadora", "Usinagem", 
  "Desenvolvimento", "Protótipo", "Engenharia", "Outros", 
  "Viagem", "Terceiros", "Acumulador", "Reposição"
];

interface CartItem { 
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number | string; 
}

export default function MaterialWithdrawals() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [destination, setDestination] = useState("");
  const [opCode, setOpCode] = useState("");
  
  // Referência para o input de arquivo oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .slice(0, 8); 
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
        const currentQty = Number(item.quantity) || 0;
        const newQty = currentQty + delta;
        if (newQty > item.current_stock) { 
          toast.warning(`Máximo disponível: ${item.current_stock}`); 
          return { ...item, quantity: item.current_stock }; 
        }
        return { ...item, quantity: Math.max(1, newQty) };
      }
      return item;
    }));
  };

  // Nova função para lidar com digitação manual na quantidade
  const handleManualQuantityChange = (productId: string, value: string) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        if (value === "") return { ...item, quantity: "" }; // Permite apagar para digitar novo número
        
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) return item;
        
        if (numValue > item.current_stock) {
          toast.warning(`Máximo disponível: ${item.current_stock}`);
          return { ...item, quantity: item.current_stock };
        }
        return { ...item, quantity: numValue };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Lógica para Baixar Template Excel
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ SKU: "", Quantidade: "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Saida");
    XLSX.writeFile(wb, "Modelo_Saida_Estoque.xlsx");
  };

  // Lógica para processar arquivo Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let itemsAdded = 0;
        let newCart = [...cart];

        jsonData.forEach((row: any) => {
          const sku = row.SKU?.toString().trim();
          const qty = Number(row.Quantidade);

          if (sku && qty > 0) {
            const stockItem = stocks?.find((s: any) => s.products?.sku === sku);
            
            if (stockItem) {
              const available = (Number(stockItem.quantity_on_hand) || 0) - (Number(stockItem.quantity_reserved) || 0);
              
              if (available >= qty) {
                const existingIndex = newCart.findIndex(i => i.product_id === stockItem.products.id);
                if (existingIndex >= 0) {
                  // Se já existe no carrinho, atualiza a quantidade
                  const currentQty = Number(newCart[existingIndex].quantity) || 0;
                  newCart[existingIndex].quantity = Math.min(currentQty + qty, available);
                } else {
                  // Adiciona novo item ao carrinho
                  newCart.push({
                    product_id: stockItem.products.id,
                    name: stockItem.products.name,
                    sku: stockItem.products.sku,
                    unit: stockItem.products.unit,
                    current_stock: available,
                    quantity: qty
                  });
                }
                itemsAdded++;
              } else {
                toast.warning(`Estoque insuficiente para o SKU: ${sku}`);
              }
            } else {
              toast.error(`Produto não encontrado para o SKU: ${sku}`);
            }
          }
        });

        setCart(newCart);
        if (itemsAdded > 0) toast.success(`${itemsAdded} SKU(s) processado(s) com sucesso!`);
      } catch (err) {
        toast.error("Erro ao ler o arquivo Excel. Verifique a formatação.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""; // Limpa o input
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <LogOut className="h-6 w-6 text-red-500" /> Saída de Materiais
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Registe a retirada de material do armazém para os setores da fábrica.
          </p>
        </div>
        
        {/* Novos botões de Excel */}
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={downloadTemplate} className="flex-1 md:flex-none">
            <Download className="mr-2 h-4 w-4" />
            Modelo Excel
          </Button>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none">
            <FileUp className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA: BUSCA DE PRODUTOS */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 bg-card border shadow-sm">
            <Label className="text-sm font-semibold mb-2 block text-muted-foreground">Procurar Produto Manualmente</Label>
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
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      {/* INPUT MANUAL AQUI */}
                      <Input
                        type="number"
                        min="1"
                        max={item.current_stock}
                        value={item.quantity}
                        onChange={(e) => handleManualQuantityChange(item.product_id, e.target.value)}
                        className="h-7 w-16 text-center text-sm font-bold px-1"
                      />
                      
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
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
                  // Validação para garantir que nenhum item está com quantidade vazia
                  if (cart.some(i => !i.quantity || Number(i.quantity) < 1)) return toast.warning("Verifique as quantidades dos itens.");
                  if (!destination) return toast.warning("Selecione o setor de destino.");
                  
                  manualExitMutation.mutate({ 
                    sector: destination, 
                    op_code: opCode.trim(), 
                    items: cart.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) })) 
                  });
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
