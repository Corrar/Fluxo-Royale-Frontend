import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, FileSpreadsheet, Plus, Trash2,
  FileText, Download, MapPin, Users, Search, Minus, Package, PackageSearch,
  CheckCircle2, Clock, Car, ChevronRight, HardHat, CalendarDays, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- TIPAGENS ---
interface Product { 
  id: string; 
  sku: string; 
  name: string; 
  unit: string; 
  stock?: { quantity_on_hand: number; quantity_reserved: number; };
}

interface TravelItemInput {
  product_id: string; sku: string; name: string; quantity: number; unit: string; available_stock: number;
}

interface TravelOrderItem {
  id: string; product_id: string; quantity_out: string | number; quantity_returned: string | number;
  status: string; products: { name: string; sku: string; unit: string; };
}

interface TravelOrder {
  id: string; technicians: string; city: string; status: 'pending' | 'reconciled';
  created_at: string; updated_at: string; items: TravelOrderItem[];
}

type ViewMode = 'list' | 'new' | 'reconcile' | 'view';

// Lógica de Estoque Disponível
const getAvailableStock = (product?: Product) => {
  if (!product || !product.stock) return 0;
  return Math.max(0, Number(product.stock.quantity_on_hand) - Number(product.stock.quantity_reserved));
};

export default function TravelReconciliation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrder, setSelectedOrder] = useState<TravelOrder | null>(null);

  const [technicians, setTechnicians] = useState("");
  const [city, setCity] = useState("");
  const [outboundList, setOutboundList] = useState<TravelItemInput[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [reconcileItems, setReconcileItems] = useState<any[]>([]);

  // DADOS
  const { data: products = [], refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 1000 * 15,
  });

  const productsDictionary = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.sku, p));
    return map;
  }, [products]);

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower)).slice(0, 5); 
  }, [searchTerm, products]);

  const { data: travelOrders = [], isLoading: isLoadingOrders } = useQuery<TravelOrder[]>({
    queryKey: ["travel-orders"],
    queryFn: async () => (await api.get("/travel-orders")).data,
  });

  const stats = useMemo(() => {
    const total = travelOrders.length;
    const pending = travelOrders.filter(t => t.status === 'pending').length;
    const reconciled = travelOrders.filter(t => t.status === 'reconciled').length;
    return { total, pending, reconciled };
  }, [travelOrders]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] }); 
    };
    socket.on("travel_orders_update", handleUpdate);
    socket.on("stock_update", handleUpdate); 
    return () => { socket.off("travel_orders_update", handleUpdate); socket.off("stock_update", handleUpdate); };
  }, [socket, queryClient]);

  // MUTAÇÕES
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => await api.post('/travel-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Viagem criada! Estoque reservado. 🚗");
      resetNewTripForm();
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Ops! Ocorreu um erro ao registar.")
  });

  const reconcileOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.post(`/travel-orders/${id}/reconcile`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Tudo certo! Acerto finalizado. ✅");
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao tentar fazer o acerto.")
  });

  // HANDLERS
  const resetNewTripForm = () => { setTechnicians(""); setCity(""); setOutboundList([]); setSearchTerm(""); };

  const handleAddFromSearch = (product: Product) => {
    setOutboundList(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const available = getAvailableStock(product);

      if (currentQty + 1 > available) {
        toast.error(`Apenas ${available} un. disponíveis de ${product.name}.`);
        return prev;
      }
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [{ product_id: product.id, sku: product.sku, name: product.name, unit: product.unit, quantity: 1, available_stock: available }, ...prev];
    });
    setSearchTerm("");
  };

  const updateItemQuantity = (productId: string, delta: number) => {
    setOutboundList(prev => prev.map(item => {
        if (item.product_id === productId) {
           const freshProduct = productsDictionary.get(item.sku);
           const currentStock = getAvailableStock(freshProduct);
           const newQty = item.quantity + delta;
           if (newQty <= 0) return null; 
           if (newQty > currentStock) { toast.error(`Limite! Apenas ${currentStock}x disponíveis.`); return item; }
           return { ...item, quantity: newQty, available_stock: currentStock };
        }
        return item;
      }).filter(Boolean) as TravelItemInput[]);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'outbound' | 'reconcile') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      if (target === 'outbound') {
        const formatted: TravelItemInput[] = [];
        let skippedItems = 0;
        data.forEach(row => {
          const sku = String(row['sku'] || row['SKU'] || row['Codigo'] || "");
          const qty = Number(row['quantity'] || row['qtd'] || row['Qtd'] || 0);
          const found = productsDictionary.get(sku);
          if (found && qty > 0) {
            const existingInCart = outboundList.find(i => i.product_id === found.id);
            const existingInFormatted = formatted.find(i => i.product_id === found.id);
            const totalQty = (existingInCart?.quantity || 0) + (existingInFormatted?.quantity || 0) + qty;
            const available = getAvailableStock(found);

            if (totalQty <= available) {
              if (existingInFormatted) existingInFormatted.quantity += qty;
              else formatted.push({ product_id: found.id, sku: found.sku, name: found.name, unit: found.unit, quantity: qty, available_stock: available });
            } else { skippedItems++; }
          }
        });
        setOutboundList(prev => {
           const newList = [...prev];
           formatted.forEach(newItem => {
               const existing = newList.find(i => i.product_id === newItem.product_id);
               if (existing) existing.quantity += newItem.quantity; else newList.push(newItem);
           });
           return newList;
        });
        toast.success(`${formatted.length} itens importados.`);
        if (skippedItems > 0) toast.warning(`${skippedItems} itens ignorados (sem estoque).`);
      } 
      else if (target === 'reconcile') {
        let updatedItems = [...reconcileItems];
        data.forEach(row => {
          const sku = String(row['sku'] || row['SKU'] || row['Codigo'] || "");
          const qty = Number(row['quantity'] || row['qtd'] || row['Qtd'] || 0);
          const found = productsDictionary.get(sku);
          if (found) {
            const existingIdx = updatedItems.findIndex(i => i.product_id === found.id);
            if (existingIdx >= 0) updatedItems[existingIdx].returnedQuantity += qty;
            else updatedItems.push({ product_id: found.id, sku: found.sku, name: found.name, unit: found.unit, quantity_out: 0, returnedQuantity: qty });
          }
        });
        setReconcileItems(updatedItems);
        toast.success("Planilha lida com sucesso!");
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateTrip = () => {
    if (!technicians || !city) return toast.warning("Faltam os dados da viagem (Destino/Equipa).");
    if (outboundList.length === 0) return toast.warning("O carrinho está vazio.");

    for (const item of outboundList) {
      const freshProduct = products.find(p => p.id === item.product_id);
      const currentAvailable = getAvailableStock(freshProduct);
      if (item.quantity > currentAvailable) {
        toast.error(`Estoque de ${item.name} alterado. Restam ${currentAvailable}x.`);
        refetchProducts(); return; 
      }
    }
    createOrderMutation.mutate({ technicians, city, items: outboundList });
  };

  const openReconcile = (order: TravelOrder, mode: 'reconcile' | 'view') => {
    setSelectedOrder(order);
    const initialItems = order.items.map(item => ({
      product_id: item.product_id, sku: item.products?.sku || 'N/A', name: item.products?.name || 'N/A', unit: item.products?.unit || 'un',
      quantity_out: Number(item.quantity_out), returnedQuantity: mode === 'view' ? Number(item.quantity_returned) : 0, status: item.status
    }));
    setReconcileItems(initialItems);
    setViewMode(mode);
  };

  const updateReturnedQuantity = (product_id: string, qty: number) => {
    setReconcileItems(prev => prev.map(item => item.product_id === product_id ? { ...item, returnedQuantity: Math.max(0, qty) } : item));
  };

  const handleConfirmReconcile = () => {
    if (!selectedOrder) return;
    const returnedPayload = reconcileItems.filter(item => item.returnedQuantity >= 0).map(item => ({ product_id: item.product_id, returnedQuantity: item.returnedQuantity }));
    reconcileOrderMutation.mutate({ id: selectedOrder.id, data: { returnedItems: returnedPayload } });
  };

  const generateReport = (order: TravelOrder, format: 'pdf' | 'excel') => {
    const tableData = order.items.map(item => {
      const qOut = Number(item.quantity_out);
      const qRet = Number(item.quantity_returned);
      return { SKU: item.products?.sku, Produto: item.products?.name, "Saída": qOut, "Retorno": qRet, "Diferença": qRet - qOut, "Status": item.status === 'ok' ? 'OK' : item.status === 'missing' ? 'FALTA' : 'SOBRA' };
    });
    const fileName = `Viagem_${order.city.replace(/\s/g, '_')}_${new Date(order.created_at).toLocaleDateString('pt-BR')}`;
    if (format === 'excel') exportToExcel(tableData, fileName);
    else {
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("Relatório de Acerto", 14, 20);
      autoTable(doc, { head: [["SKU", "Produto", "Saída", "Retorno", "Dif.", "Status"]], body: tableData.map(d => [String(d.SKU), String(d.Produto), String(d.Saída), String(d.Retorno), String(d.Diferença), String(d.Status)]), startY: 30 });
      doc.save(`${fileName}.pdf`);
    }
  };

  // ============================================================================
  // UI 1: DASHBOARD (NUBANK/PICPAY STYLE)
  // ============================================================================
  if (viewMode === 'list') {
    return (
      <div className="space-y-10 animate-in fade-in duration-700 pb-32 max-w-4xl mx-auto mt-4 md:mt-8">
        
        {/* App Header */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground font-medium mb-1">Visão Geral</p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">Minhas Viagens</h1>
            </div>
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Car className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          {/* Large Stat Cards (Scrollable on mobile) */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            <div className="bg-card ring-1 ring-border/50 rounded-[2rem] p-6 min-w-[200px] flex-1 shadow-sm snap-start">
              <p className="text-sm font-bold text-muted-foreground mb-2">Histórico Total</p>
              <h3 className="text-4xl font-black tracking-tight text-foreground">{stats.total}</h3>
            </div>
            <div className="bg-amber-500/10 ring-1 ring-amber-500/20 rounded-[2rem] p-6 min-w-[200px] flex-1 shadow-sm snap-start">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-500 mb-2 flex items-center gap-1.5"><Clock className="h-4 w-4" /> Em andamento</p>
              <h3 className="text-4xl font-black tracking-tight text-amber-700 dark:text-amber-500">{stats.pending}</h3>
            </div>
            <div className="bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-[2rem] p-6 min-w-[200px] flex-1 shadow-sm snap-start">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-500 mb-2 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Finalizadas</p>
              <h3 className="text-4xl font-black tracking-tight text-emerald-700 dark:text-emerald-500">{stats.reconciled}</h3>
            </div>
          </div>
        </div>

        {/* Bank Statement Style List */}
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-6">Extrato de Viagens</h2>
          
          {isLoadingOrders ? (
            <div className="flex justify-center py-20"><div className="animate-pulse flex items-center gap-3 text-muted-foreground font-bold"><Search className="h-5 w-5" /> A procurar dados...</div></div>
          ) : travelOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="h-24 w-24 bg-muted/30 rounded-full flex items-center justify-center mb-6">
                <MapPin className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">Nada por aqui</h3>
              <p className="text-muted-foreground mt-2 font-medium">A sua equipa ainda não registou saídas.</p>
            </div>
          ) : (
            <div className="bg-card rounded-[2rem] ring-1 ring-border/50 shadow-sm overflow-hidden flex flex-col">
              {travelOrders.map((order, idx) => (
                <div 
                  key={order.id} 
                  onClick={() => openReconcile(order, order.status === 'pending' ? 'reconcile' : 'view')}
                  className={`p-5 flex items-center justify-between cursor-pointer transition-all hover:bg-muted/40 active:bg-muted/60 ${idx !== travelOrders.length - 1 ? 'border-b border-border/40' : ''}`}
                >
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                      <MapPin className={`h-5 w-5 ${order.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-foreground text-lg">{order.city}</h4>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mt-0.5">
                        {order.technicians} <span className="opacity-50">•</span> {new Date(order.created_at).toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'})}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold text-foreground text-lg">{order.items?.length || 0} <span className="text-sm text-muted-foreground font-medium">itens</span></span>
                    {order.status === 'pending' 
                      ? <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">Na rua</span>
                      : <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">OK</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating Action Button (FAB) Bottom Center */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none px-4">
          <Button 
            onClick={() => { resetNewTripForm(); setViewMode('new'); }} 
            className="pointer-events-auto shadow-2xl shadow-emerald-600/30 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-16 px-8 text-lg font-extrabold transition-transform active:scale-95 flex items-center gap-3"
          >
            <Plus className="h-6 w-6" /> Registar Saída
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UI 2: NOVA VIAGEM (A IDA) - FLUXO CONTINUO
  // ============================================================================
  if (viewMode === 'new') {
    return (
      <div className="max-w-2xl mx-auto space-y-10 pb-40 animate-in slide-in-from-right-8 duration-500 mt-4 md:mt-8 px-2">
        
        {/* Header Limpo */}
        <div className="flex items-center gap-5">
          <button onClick={() => setViewMode('list')} className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Nova Viagem</h1>
          </div>
        </div>

        {/* Formulário Soft */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-bold text-foreground ml-1">Para onde vão?</Label>
            <div className="relative">
              <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-600" />
              <Input placeholder="Ex: Obra de Lisboa" value={city} onChange={e => setCity(e.target.value)} className="pl-16 h-16 rounded-[1.5rem] bg-muted/30 border-0 ring-1 ring-border/50 focus:ring-2 focus:ring-emerald-500 focus:bg-background text-lg font-medium transition-all shadow-sm" />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-bold text-foreground ml-1">Quem faz a equipa?</Label>
            <div className="relative">
              <HardHat className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-emerald-600" />
              <Input placeholder="Ex: João e Maria" value={technicians} onChange={e => setTechnicians(e.target.value)} className="pl-16 h-16 rounded-[1.5rem] bg-muted/30 border-0 ring-1 ring-border/50 focus:ring-2 focus:ring-emerald-500 focus:bg-background text-lg font-medium transition-all shadow-sm" />
            </div>
          </div>
        </div>

        {/* Busca e Carrinho */}
        <div className="space-y-6 pt-4">
          <h2 className="text-2xl font-black text-foreground">Materiais</h2>

          {/* Busca Spotlight */}
          <div className="relative z-20">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <Input
                placeholder="Procurar item..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-16 h-16 rounded-[1.5rem] border-0 ring-1 ring-border/50 shadow-sm text-lg font-medium focus-visible:ring-2 focus-visible:ring-foreground transition-all bg-card"
              />
              <Label htmlFor="upload-excel" className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-2 bg-muted/50 hover:bg-muted rounded-xl transition-colors">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              </Label>
              <Input id="upload-excel" type="file" accept=".xlsx" className="hidden" onChange={e => handleExcelUpload(e, 'outbound')} />
            </div>

            {/* Menu Suspenso de Busca */}
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute top-[110%] left-0 right-0 p-2 shadow-2xl ring-1 ring-border/50 rounded-[2rem] bg-card animate-in fade-in slide-in-from-top-2">
                {searchResults.map(product => {
                   const available = getAvailableStock(product);
                   return (
                     <button
                       key={product.id}
                       onClick={() => handleAddFromSearch(product)}
                       className="w-full flex items-center justify-between p-4 hover:bg-muted/40 rounded-2xl transition-all text-left group active:scale-[0.98]"
                     >
                        <div>
                          <p className="font-bold text-foreground text-lg">{product.name}</p>
                          <p className="text-sm font-medium text-muted-foreground">{product.sku}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className={`text-sm py-1 px-3 rounded-full border-0 font-bold ${available > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                            {available} {product.unit}
                          </Badge>
                        </div>
                     </button>
                   );
                })}
              </div>
            )}
          </div>

          {/* Carrinho Minimalista */}
          {outboundList.length > 0 && (
            <div className="flex flex-col gap-3">
              {outboundList.map((item) => (
                <div key={item.product_id} className="bg-card p-4 rounded-[1.5rem] ring-1 ring-border/50 shadow-sm flex items-center justify-between gap-4">
                   <div className="flex-1 overflow-hidden">
                      <h3 className="font-extrabold text-foreground text-lg truncate">{item.name}</h3>
                      <p className="text-sm font-medium text-muted-foreground">Disp: {item.available_stock} {item.unit}</p>
                   </div>

                   {/* Stepper Estilo iOS */}
                   <div className="flex items-center bg-muted/40 rounded-full ring-1 ring-border/50 overflow-hidden h-12">
                      <button onClick={() => updateItemQuantity(item.product_id, -1)} className="w-12 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted">
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="w-10 h-full flex items-center justify-center font-black text-foreground text-lg">
                        {item.quantity}
                      </div>
                      <button onClick={() => updateItemQuantity(item.product_id, 1)} className="w-12 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted">
                        <Plus className="h-4 w-4" />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Bottom Checkout */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/95 to-transparent z-40 pointer-events-none">
          <div className="max-w-2xl mx-auto">
             <Button
               onClick={handleCreateTrip}
               disabled={outboundList.length === 0 || createOrderMutation.isPending}
               className="w-full h-16 pointer-events-auto text-xl font-black rounded-full bg-foreground text-background shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
             >
               {createOrderMutation.isPending ? "A processar..." : `Avançar • ${outboundList.length} item(s)`}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UI 3: ACERTO (RECIBO FINTECH)
  // ============================================================================
  if (viewMode === 'reconcile' || viewMode === 'view') {
    const isViewing = viewMode === 'view';
    return (
      <div className="max-w-2xl mx-auto space-y-8 pb-40 animate-in slide-in-from-right-8 duration-400 mt-4 md:mt-8 px-2">
        
        {/* Header App */}
        <div className="flex items-center justify-between">
          <button onClick={() => setViewMode('list')} className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          
          {isViewing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
                  <MoreHorizontal className="h-6 w-6 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 font-medium shadow-xl">
                <DropdownMenuItem onClick={() => generateReport(selectedOrder!, 'pdf')} className="p-3 text-base cursor-pointer rounded-xl"><FileText className="h-5 w-5 mr-3 text-red-500" /> PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateReport(selectedOrder!, 'excel')} className="p-3 text-base cursor-pointer rounded-xl"><FileSpreadsheet className="h-5 w-5 mr-3 text-green-600" /> Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Receipt Concept */}
        <div className="bg-card rounded-[2.5rem] ring-1 ring-border/50 shadow-sm overflow-hidden flex flex-col">
          
          {/* Top Half: Meta */}
          <div className="p-8 pb-10 bg-muted/20 relative">
             <h2 className="text-3xl font-black text-foreground mb-6">
               {isViewing ? "Resumo do Acerto" : "Acerto de Contas"}
             </h2>
             
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Equipa</span>
                  <span className="font-extrabold text-foreground text-lg">{selectedOrder?.technicians}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Destino</span>
                  <span className="font-extrabold text-foreground text-lg">{selectedOrder?.city}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Data</span>
                  <span className="font-extrabold text-foreground text-lg">{selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
             </div>
             
             {/* Cut-out dashed line simulation */}
             <div className="absolute -bottom-px left-0 right-0 flex items-center justify-between">
                <div className="h-6 w-6 rounded-full bg-background -ml-3 ring-1 ring-border/50 ring-l-transparent"></div>
                <div className="flex-1 border-t-2 border-dashed border-border/60 mx-2"></div>
                <div className="h-6 w-6 rounded-full bg-background -mr-3 ring-1 ring-border/50 ring-r-transparent"></div>
             </div>
          </div>

          {/* Bottom Half: Items */}
          <div className="p-6 pt-8 bg-card">
            
            {!isViewing && (
              <div className="mb-6">
                <Label htmlFor="reconcile-file" className="cursor-pointer w-full flex items-center justify-center gap-3 h-14 rounded-full bg-muted/50 hover:bg-muted text-foreground font-bold transition-colors active:scale-95">
                  <FileSpreadsheet className="h-5 w-5" /> Preencher via Excel
                </Label>
                <Input id="reconcile-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleExcelUpload(e, 'reconcile')} />
              </div>
            )}

            <div className="space-y-6">
              {reconcileItems.map((item) => {
                const out = Number(item.quantity_out);
                const ret = Number(item.returnedQuantity);
                const missing = out - ret;
                
                let statusDot = <div className="h-3 w-3 rounded-full bg-emerald-500"></div>;
                let statusText = "Tudo Certo";
                
                if (missing > 0) {
                  statusDot = <div className="h-3 w-3 rounded-full bg-red-500"></div>;
                  statusText = `Falta ${missing}`;
                } else if (missing < 0) {
                  statusDot = <div className="h-3 w-3 rounded-full bg-blue-500"></div>;
                  statusText = `Sobrou ${Math.abs(missing)}`;
                }

                return (
                  <div key={item.product_id} className="flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-foreground text-lg leading-tight">{item.name}</h4>
                        <p className="text-sm font-medium text-muted-foreground mt-1">Levou: {out}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {isViewing ? (
                          <span className="font-black text-2xl text-foreground">{ret}</span>
                        ) : (
                          <Input 
                            type="number" min="0" 
                            placeholder="0"
                            className="h-12 w-24 text-center text-xl font-black bg-muted/30 border-0 ring-1 ring-border/50 focus:ring-2 focus:ring-amber-500 rounded-2xl transition-all" 
                            value={item.returnedQuantity === 0 && item.quantity_out === 0 ? '' : item.returnedQuantity} 
                            onChange={(e) => updateReturnedQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                          />
                        )}
                        <div className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                          {statusText} {statusDot}
                        </div>
                      </div>
                    </div>
                    <div className="h-px w-full bg-border/40 last:hidden"></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {!isViewing && (
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/95 to-transparent z-40 pointer-events-none">
            <div className="max-w-2xl mx-auto flex gap-4">
               <Button 
                  onClick={handleConfirmReconcile} 
                  disabled={reconcileOrderMutation.isPending} 
                  className="w-full h-16 pointer-events-auto text-xl font-black rounded-full bg-amber-500 text-amber-950 shadow-2xl hover:bg-amber-400 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                 {reconcileOrderMutation.isPending ? "A processar..." : "Confirmar Devoluções"}
               </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
