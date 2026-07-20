import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Search, ShoppingCart, Trash2, LogOut, Loader2, Minus, Plus, Download, FileUp, PackageOpen } from "lucide-react";

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => (await api.get("/stock")).data,
  });

  const manualExitMutation = useMutation({
    mutationFn: async (data: { sector: string; op_code?: string; items: any[] }) => await api.post("/stock/manual-withdrawal", data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Saída registrada com sucesso!", { className: "rounded-xl" }); 
      setCart([]); setDestination(""); setOpCode(""); setSearchTerm("");
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao registrar saída.", { className: "rounded-xl" }),
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

  const handleManualQuantityChange = (productId: string, value: string) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        if (value === "") return { ...item, quantity: "" };
        
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

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ SKU: "", Quantidade: "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo_Saida");
    XLSX.writeFile(wb, "Modelo_Saida_Estoque.xlsx");
  };

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
                  const currentQty = Number(newCart[existingIndex].quantity) || 0;
                  newCart[existingIndex].quantity = Math.min(currentQty + qty, available);
                } else {
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
        if (itemsAdded > 0) toast.success(`${itemsAdded} SKU(s) processados!`);
      } catch (err) {
        toast.error("Erro ao ler o arquivo Excel.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/50 dark:bg-background space-y-8 animate-in fade-in duration-500 pb-24 md:pb-8 transition-colors">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-foreground tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 rounded-2xl text-purple-600 dark:text-purple-400">
              <LogOut className="h-6 w-6" />
            </div>
            Saída de Materiais
          </h1>
          <p className="text-slate-500 dark:text-muted-foreground mt-2 text-sm md:text-base font-medium">
            Gerencie a retirada de itens do estoque de forma rápida e intuitiva.
          </p>
        </div>
        
        {/* Botões de Ação Secundária (Excel) */}
        <div className="flex gap-3 w-full md:w-auto">
          <Button variant="outline" onClick={downloadTemplate} className="flex-1 md:flex-none rounded-xl h-11 border-slate-200 dark:border-border text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-accent font-semibold shadow-sm transition-all">
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
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none rounded-xl h-11 bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-accent font-semibold shadow-sm transition-all">
            <FileUp className="mr-2 h-4 w-4" />
            Importar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: BUSCA DE PRODUTOS */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Card className="p-6 bg-white dark:bg-card border-0 dark:border dark:border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-3xl transition-colors">
            <Label className="text-sm font-bold mb-3 block text-slate-700 dark:text-foreground uppercase tracking-wider">Adicionar Manualmente</Label>
            
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-muted-foreground group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 transition-colors" />
              <Input 
                placeholder="Busque pelo nome ou SKU do produto..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-12 h-14 text-base bg-slate-50 dark:bg-background border-slate-200 dark:border-border rounded-2xl focus-visible:ring-purple-500/20 dark:focus-visible:ring-purple-500/40 focus-visible:border-purple-500 transition-all shadow-inner dark:shadow-none text-slate-900 dark:text-foreground" 
              />
            </div>
            
            {/* Resultados da Busca */}
            {searchTerm && (
              <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredStocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <PackageOpen className="h-12 w-12 text-slate-400 dark:text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-slate-500 dark:text-muted-foreground">Nenhum produto em estoque encontrado.</p>
                  </div>
                ) : (
                  filteredStocks.map((stock: any) => {
                    const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
                    return (
                      <div key={stock.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-border bg-slate-50/50 dark:bg-muted/20 hover:bg-slate-100 dark:hover:bg-muted/50 hover:shadow-sm dark:hover:shadow-none transition-all duration-200 group">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-foreground text-base">{stock.products?.name}</p>
                          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">
                            SKU: {stock.products?.sku || '-'} <span className="mx-2 text-slate-300 dark:text-slate-600">•</span> Disponível: <span className="font-bold text-emerald-600 dark:text-emerald-400">{available} {stock.products?.unit}</span>
                          </p>
                        </div>
                        <Button 
                          onClick={() => addToCart(stock)} 
                          className="rounded-xl h-10 px-5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100 font-semibold"
                        >
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
        <div className="lg:col-span-5 xl:col-span-4">
          <Card className="p-6 bg-white dark:bg-card border-0 dark:border dark:border-border shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-none rounded-3xl flex flex-col h-full sticky top-8 transition-colors">
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-foreground flex items-center gap-2">
                Lista de Retirada
              </h3>
              <div className="bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground text-xs font-bold px-3 py-1 rounded-full">
                {cart.length} itens
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 min-h-[250px] max-h-[50vh] custom-scrollbar pr-2 mb-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-muted-foreground py-12">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-muted/30 rounded-full flex items-center justify-center mb-4">
                    <ShoppingCart className="h-8 w-8 text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-base font-medium">Sua lista está vazia</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Busque produtos para adicionar.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product_id} className="p-4 bg-white dark:bg-card border border-slate-100 dark:border-border shadow-sm dark:shadow-none rounded-2xl relative group hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                    <p className="font-bold text-slate-800 dark:text-foreground text-sm leading-tight pr-8">{item.name}</p>
                    <p className="text-xs text-slate-400 dark:text-muted-foreground mt-1 mb-3">Máx: {item.current_stock}</p>
                    
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-muted/50 w-fit p-1 rounded-xl">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-background hover:shadow-sm dark:hover:shadow-none text-slate-600 dark:text-foreground" onClick={() => updateQuantity(item.product_id, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        min="1"
                        max={item.current_stock}
                        value={item.quantity}
                        onChange={(e) => handleManualQuantityChange(item.product_id, e.target.value)}
                        className="h-8 w-16 text-center text-sm font-bold bg-transparent border-none focus-visible:ring-0 px-0 text-slate-900 dark:text-foreground"
                      />
                      
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-background hover:shadow-sm dark:hover:shadow-none text-slate-600 dark:text-foreground" onClick={() => updateQuantity(item.product_id, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.product_id)} 
                      className="absolute top-4 right-4 text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 p-2 rounded-xl transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* ZONA DE CHECKOUT */}
            <div className="space-y-5 pt-6 border-t border-slate-100 dark:border-border mt-auto">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">Destino / Setor *</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="h-12 bg-slate-50 dark:bg-background border-slate-200 dark:border-border rounded-xl focus:ring-purple-500/20 dark:focus:ring-purple-500/40 font-medium text-slate-900 dark:text-foreground">
                    <SelectValue placeholder="Escolha o setor..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 dark:border-border shadow-xl dark:shadow-none">
                    {SECTORS.map(s => <SelectItem key={s} value={s} className="rounded-lg cursor-pointer">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider">OP / Observação <span className="font-normal normal-case text-slate-400 dark:text-slate-500">(Opcional)</span></Label>
                <Input 
                  placeholder="Ex: OP-1234" 
                  value={opCode} 
                  onChange={(e) => setOpCode(e.target.value)} 
                  className="h-12 bg-slate-50 dark:bg-background border-slate-200 dark:border-border rounded-xl focus-visible:ring-purple-500/20 dark:focus-visible:ring-purple-500/40 text-slate-900 dark:text-foreground" 
                />
              </div>

              <Button 
                className="w-full h-14 text-base font-bold shadow-[0_4px_14px_0_rgb(138,5,190,0.39)] dark:shadow-none hover:shadow-[0_6px_20px_rgba(138,5,190,0.23)] dark:hover:bg-purple-600 bg-purple-600 dark:bg-purple-700 text-white rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" 
                disabled={cart.length === 0 || manualExitMutation.isPending}
                onClick={() => {
                  if (cart.length === 0) return toast.warning("Adicione itens à lista.");
                  if (cart.some(i => !i.quantity || Number(i.quantity) < 1)) return toast.warning("Verifique as quantidades dos itens.");
                  if (!destination) return toast.warning("Selecione o setor de destino.");
                  
                  manualExitMutation.mutate({ 
                    sector: destination, 
                    op_code: opCode.trim(), 
                    items: cart.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) })) 
                  });
                }}
              >
                {manualExitMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {manualExitMutation.isPending ? "Processando..." : "Confirmar Saída"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
