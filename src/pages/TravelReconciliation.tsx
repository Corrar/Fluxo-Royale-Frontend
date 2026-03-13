import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, ArrowLeft, FileSpreadsheet, Plus, Trash2,
  FileText, Download, MapPin, Users, Search, Minus, Package, PackageSearch,
  CheckCircle2, Clock, Car, ChevronRight, HardHat, CalendarDays, MoreVertical
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
  stock?: {
    quantity_on_hand: number;
    quantity_reserved: number;
  };
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

  // 1. DADOS
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
    return products.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.sku.toLowerCase().includes(lower)
    ).slice(0, 5); 
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
    return () => { 
      socket.off("travel_orders_update", handleUpdate); 
      socket.off("stock_update", handleUpdate);
    };
  }, [socket, queryClient]);

  // 3. MUTAÇÕES
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => await api.post('/travel-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Pronto! Viagem registada e estoque reservado. 🚗");
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
      toast.success("Acerto concluído! Estoque perfeitamente atualizado. ✅");
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao tentar fazer o acerto.")
  });

  // --- HANDLERS ---
  const resetNewTripForm = () => {
    setTechnicians(""); setCity(""); setOutboundList([]); setSearchTerm("");
  };

  const handleAddFromSearch = (product: Product) => {
    setOutboundList(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const available = getAvailableStock(product);

      if (currentQty + 1 > available) {
        toast.error(`Sem estoque suficiente! Só tens ${available}x ${product.unit} de ${product.name}.`);
        return prev;
      }

      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [{
        product_id: product.id, sku: product.sku, name: product.name, unit: product.unit,
        quantity: 1, available_stock: available
      }, ...prev];
    });
    setSearchTerm("");
  };

  const updateItemQuantity = (productId: string, delta: number) => {
    setOutboundList(prev => {
      return prev.map(item => {
        if (item.product_id === productId) {
           const freshProduct = productsDictionary.get(item.sku);
           const currentStock = getAvailableStock(freshProduct);
           const newQty = item.quantity + delta;
           
           if (newQty <= 0) return null; 
           if (newQty > currentStock) {
             toast.error(`Limite máximo! Só tens ${currentStock}x ${item.unit} de ${item.name}.`);
             return item;
           }
           return { ...item, quantity: newQty, available_stock: currentStock };
        }
        return item;
      }).filter(Boolean) as TravelItemInput[];
    });
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
            const currentQty = (existingInCart?.quantity || 0) + (existingInFormatted?.quantity || 0);
            const totalQty = currentQty + qty;
            const available = getAvailableStock(found);

            if (totalQty <= available) {
              if (existingInFormatted) existingInFormatted.quantity += qty;
              else formatted.push({ 
                product_id: found.id, sku: found.sku, name: found.name, unit: found.unit, 
                quantity: qty, available_stock: available 
              });
            } else { skippedItems++; }
          }
        });
        
        setOutboundList(prev => {
           const newList = [...prev];
           formatted.forEach(newItem => {
               const existing = newList.find(i => i.product_id === newItem.product_id);
               if (existing) existing.quantity += newItem.quantity;
               else newList.push(newItem);
           });
           return newList;
        });
        toast.success(`Foram adicionados ${formatted.length} itens via planilha.`);
        if (skippedItems > 0) toast.warning(`${skippedItems} itens ignorados por falta de estoque.`);
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
            else updatedItems.push({
                 product_id: found.id, sku: found.sku, name: found.name, unit: found.unit,
                 quantity_out: 0, returnedQuantity: qty
            });
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
    if (!technicians || !city) return toast.warning("Preencha o Destino e a Equipa.");
    if (outboundList.length === 0) return toast.warning("Adicione pelo menos um material à viagem.");

    for (const item of outboundList) {
      const freshProduct = products.find(p => p.id === item.product_id);
      const currentAvailable = getAvailableStock(freshProduct);
      if (item.quantity > currentAvailable) {
        toast.error(`Espera! O estoque de ${item.name} foi alterado por alguém. Só restam ${currentAvailable}x.`);
        refetchProducts(); 
        return; 
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
      const diff = qRet - qOut;
      return {
        SKU: item.products?.sku, Produto: item.products?.name,
        "Saída": qOut, "Retorno": qRet, "Diferença": diff,
        "Status": item.status === 'ok' ? 'OK' : item.status === 'missing' ? 'FALTA' : 'SOBRA'
      };
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
  // UI 1: DASHBOARD (NOVO ESTILO APP)
  // ============================================================================
  if (viewMode === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-24 max-w-5xl mx-auto">
        
        {/* Header Elegante */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Viagens</h1>
            <p className="text-muted-foreground mt-1 font-medium">Controle saídas e retornos de material da equipa.</p>
          </div>
          <Button onClick={() => { resetNewTripForm(); setViewMode('new'); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-600/20 px-8 h-14 text-lg font-bold w-full md:w-auto transition-all active:scale-[0.98]">
            <Plus className="mr-2 h-6 w-6" /> Registar Saída
          </Button>
        </div>

        {/* Pílulas de Resumo */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          <div className="bg-card border border-border rounded-3xl p-5 min-w-[160px] flex-1 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total</p>
            <h3 className="text-3xl font-black text-foreground">{stats.total}</h3>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-3xl p-5 min-w-[160px] flex-1 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="h-4 w-4" /> Na Rua</p>
            <h3 className="text-3xl font-black text-amber-700 dark:text-amber-400">{stats.pending}</h3>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-3xl p-5 min-w-[160px] flex-1 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Acertadas</p>
            <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{stats.reconciled}</h3>
          </div>
        </div>

        {/* Lista Estilo Feed de Transações */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground ml-2">Histórico de Viagens</h2>
          
          {isLoadingOrders ? (
            <div className="text-center py-20 text-muted-foreground animate-pulse font-medium">Carregando viagens...</div>
          ) : travelOrders.length === 0 ? (
            <div className="text-center py-24 px-4 bg-muted/20 border-2 border-dashed border-border rounded-3xl">
              <Car className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-foreground font-bold text-xl">Nenhuma viagem registada</p>
              <p className="text-muted-foreground mt-2">Clique em "Registar Saída" para começar.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {travelOrders.map((order) => (
                <div 
                  key={order.id} 
                  onClick={() => openReconcile(order, order.status === 'pending' ? 'reconcile' : 'view')}
                  className="bg-card hover:bg-muted/30 rounded-3xl p-4 md:p-5 border border-border shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    {/* Ícone de Status */}
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 border ${order.status === 'pending' ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' : 'bg-muted border-border text-muted-foreground'}`}>
                      <Car className="h-7 w-7" />
                    </div>
                    
                    {/* Info Central */}
                    <div className="flex flex-col justify-center">
                      <h3 className="font-extrabold text-foreground text-lg leading-tight md:text-xl mb-1">{order.city}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-muted-foreground">
                        <span className="flex items-center gap-1"><HardHat className="h-4 w-4" /> {order.technicians}</span>
                        <span className="hidden md:inline text-border">•</span>
                        <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                        <span className="hidden md:inline text-border">•</span>
                        <span className="font-mono bg-muted px-2 py-0.5 rounded-lg text-xs">{order.items?.length || 0} iten(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito (Badges e Seta) */}
                  <div className="flex items-center gap-4 pl-2">
                    <div className="hidden sm:block">
                      {order.status === 'pending' ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-3 py-1 text-sm border-0">Em Andamento</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 px-3 py-1 text-sm border-0">Concluído</Badge>
                      )}
                    </div>
                    <div className="h-10 w-10 rounded-full bg-transparent group-hover:bg-background border border-transparent group-hover:border-border flex items-center justify-center transition-all shadow-sm">
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // UI 2: NOVA VIAGEM (A IDA)
  // ============================================================================
  if (viewMode === 'new') {
    return (
      <div className="max-w-3xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="h-12 w-12 rounded-full bg-muted/50 hover:bg-muted shrink-0 transition-colors">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Registar Saída</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">O que a equipa vai levar para a obra?</p>
          </div>
        </div>

        {/* Card Informações App-like */}
        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <Label className="text-foreground font-bold ml-1">Destino da Viagem</Label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                <Input placeholder="Ex: Obra Centro" value={city} onChange={e => setCity(e.target.value)} className="pl-14 h-16 rounded-2xl bg-muted/30 border-2 border-transparent focus:bg-background focus:ring-emerald-500/20 focus:border-emerald-500 text-lg font-medium transition-all shadow-inner" />
              </div>
            </div>
            <div className="space-y-2.5">
              <Label className="text-foreground font-bold ml-1">Equipa / Técnicos</Label>
              <div className="relative">
                <HardHat className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                <Input placeholder="Ex: João e Maria" value={technicians} onChange={e => setTechnicians(e.target.value)} className="pl-14 h-16 rounded-2xl bg-muted/30 border-2 border-transparent focus:bg-background focus:ring-emerald-500/20 focus:border-emerald-500 text-lg font-medium transition-all shadow-inner" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-black text-foreground">Carrinho</h2>
            <Label htmlFor="upload-excel" className="cursor-pointer inline-flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-5 py-3 rounded-2xl hover:bg-emerald-200 transition-colors w-full sm:w-max active:scale-95">
              <FileSpreadsheet className="h-5 w-5" /> Importar Planilha
            </Label>
            <Input id="upload-excel" type="file" accept=".xlsx" className="hidden" onChange={e => handleExcelUpload(e, 'outbound')} />
          </div>

          {/* Busca Global */}
          <div className="relative z-10">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
              <Input
                placeholder="Busque por produto ou SKU..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-16 h-20 rounded-3xl border-2 border-border shadow-sm text-xl font-medium focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all bg-card"
              />
            </div>

            {/* Float Menu de Busca */}
            {searchTerm && searchResults.length > 0 && (
              <Card className="absolute top-[105%] left-0 right-0 p-2 shadow-2xl border-border rounded-3xl bg-card animate-in fade-in slide-in-from-top-4">
                {searchResults.map(product => {
                   const available = getAvailableStock(product);
                   return (
                     <button
                       key={product.id}
                       onClick={() => handleAddFromSearch(product)}
                       className="w-full flex items-center justify-between p-4 hover:bg-muted/60 rounded-2xl transition-all text-left group active:bg-muted"
                     >
                        <div>
                          <p className="font-extrabold text-foreground text-lg group-hover:text-emerald-600 transition-colors">{product.name}</p>
                          <p className="text-sm font-medium text-muted-foreground mt-0.5">{product.sku}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className={`text-sm py-1.5 px-3 rounded-xl border-0 font-bold ${available > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700'}`}>
                            {available} {product.unit} disp.
                          </Badge>
                        </div>
                     </button>
                   );
                })}
              </Card>
            )}
            
            {searchTerm && searchResults.length === 0 && (
               <Card className="absolute top-[105%] left-0 right-0 p-8 text-center shadow-xl border-border rounded-3xl bg-card text-muted-foreground">
                 <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-20" />
                 <span className="font-bold text-lg">Produto não encontrado.</span>
               </Card>
            )}
          </div>

          {/* Itens do Carrinho */}
          {outboundList.length > 0 ? (
            <div className="space-y-4 pt-4">
              {outboundList.map((item) => (
                <div key={item.product_id} className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 group transition-all hover:border-border/80">
                   <div className="flex items-center gap-5">
                      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                        <Package className="h-7 w-7 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-lg leading-tight">{item.name}</h3>
                        <p className="text-sm font-medium text-muted-foreground mt-1">
                          {item.sku} <span className="mx-2 opacity-50">•</span> Disp: {item.available_stock}
                        </p>
                      </div>
                   </div>

                   <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="flex items-center bg-muted/40 rounded-2xl border border-border overflow-hidden h-14 shadow-inner">
                         <button onClick={() => updateItemQuantity(item.product_id, -1)} className="w-14 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted">
                           <Minus className="h-5 w-5" />
                         </button>
                         <div className="w-12 h-full bg-background flex items-center justify-center font-black text-foreground text-xl border-x border-border/50">
                           {item.quantity}
                         </div>
                         <button onClick={() => updateItemQuantity(item.product_id, 1)} className="w-14 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted">
                           <Plus className="h-5 w-5" />
                         </button>
                      </div>
                      <button onClick={() => updateItemQuantity(item.product_id, -item.quantity)} className="h-14 w-14 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all active:scale-90">
                        <Trash2 className="h-6 w-6" />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 px-4 bg-muted/10 border-2 border-dashed border-border/50 rounded-3xl mt-8">
               <div className="h-24 w-24 bg-card rounded-full shadow-sm flex items-center justify-center mx-auto mb-5 border border-border">
                 <PackageSearch className="h-12 w-12 text-muted-foreground/30" />
               </div>
               <p className="text-foreground font-black text-2xl">O carrinho está vazio</p>
               <p className="text-base font-medium text-muted-foreground mt-2">Usa a busca para adicionar os materiais.</p>
            </div>
          )}
        </div>

        {/* Rodapé Floating (Finalizar) */}
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-background/90 backdrop-blur-xl border-t border-border z-40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0 sm:mt-8">
          <div className="max-w-3xl mx-auto flex gap-4">
             <Button variant="outline" onClick={() => setViewMode('list')} className="h-16 w-32 rounded-3xl text-lg font-bold border-2 border-border hidden sm:flex">
               Cancelar
             </Button>
             <Button
               onClick={handleCreateTrip}
               disabled={outboundList.length === 0 || createOrderMutation.isPending}
               className="flex-1 h-16 text-xl font-black rounded-3xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl shadow-emerald-600/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
             >
               {createOrderMutation.isPending ? "A Reservar..." : `Confirmar Viagem (${outboundList.length})`}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // UI 3: ACERTO (A VOLTA)
  // ============================================================================
  if (viewMode === 'reconcile' || viewMode === 'view') {
    const isViewing = viewMode === 'view';
    return (
      <div className="space-y-8 pb-32 animate-in slide-in-from-right-4 duration-400 max-w-4xl mx-auto">
        
        {/* Header App-like */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="h-12 w-12 rounded-full bg-muted/50 hover:bg-muted shrink-0 transition-colors">
                <ArrowLeft className="h-6 w-6 text-foreground" />
              </Button>
              <div>
                  <h1 className="text-3xl font-black tracking-tight text-foreground">
                    {isViewing ? "Detalhes da Viagem" : "Acerto de Contas"}
                  </h1>
              </div>
          </div>
          {isViewing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full h-12 w-12 border-border shadow-sm">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 font-medium">
                <DropdownMenuItem onClick={() => generateReport(selectedOrder!, 'pdf')} className="p-3 text-base cursor-pointer rounded-xl"><FileText className="h-5 w-5 mr-3 text-red-500" /> Exportar PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateReport(selectedOrder!, 'excel')} className="p-3 text-base cursor-pointer rounded-xl"><FileSpreadsheet className="h-5 w-5 mr-3 text-green-600" /> Exportar Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Resumo Estilo Recibo Nubank */}
        <div className="bg-card rounded-[2rem] border border-border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 bg-muted/20 border-b border-dashed border-border/80">
             <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Equipa</p>
                  <p className="font-extrabold text-xl text-foreground">{selectedOrder?.technicians}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Destino</p>
                  <p className="font-extrabold text-xl text-foreground">{selectedOrder?.city}</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Data</p>
                  <p className="font-extrabold text-xl text-foreground">{selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
             </div>
          </div>

          <div className="p-2 md:p-4">
            {/* Linhas de Acerto */}
            <div className="flex flex-col gap-2">
              {reconcileItems.map((item) => {
                const out = Number(item.quantity_out);
                const ret = Number(item.returnedQuantity);
                const missing = out - ret;
                
                let diffBadge = <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold border-0 px-3 py-1">Tudo Certo</Badge>;
                if (missing > 0) diffBadge = <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold border-0 px-3 py-1">Falta {missing}</Badge>;
                if (missing < 0) diffBadge = <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-bold border-0 px-3 py-1">Sobrou {Math.abs(missing)}</Badge>;

                return (
                  <div key={item.product_id} className="p-4 rounded-2xl hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-foreground">{item.name}</h4>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>Levou: <strong className="text-foreground">{out}</strong> {item.unit}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto bg-muted/10 md:bg-transparent p-3 md:p-0 rounded-xl">
                      <span className="text-sm font-bold text-muted-foreground md:hidden">Retornou:</span>
                      
                      {isViewing ? (
                        <div className="flex items-center gap-4">
                          <span className="font-black text-2xl text-foreground">{ret}</span>
                          <div className="w-24 text-right">{diffBadge}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                           <Input 
                            type="number" 
                            min="0" 
                            className="h-14 w-24 text-center text-2xl font-black bg-background border-2 border-border focus:border-emerald-500 focus:ring-emerald-500/20 rounded-2xl transition-all shadow-inner" 
                            value={item.returnedQuantity === 0 && item.quantity_out === 0 ? '' : item.returnedQuantity} 
                            onChange={(e) => updateReturnedQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                          />
                          <div className="w-24 text-right hidden sm:block">{diffBadge}</div>
                        </div>
                      )}
                    </div>
                    
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé CTA Acerto */}
        {!isViewing && (
          <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-background/90 backdrop-blur-xl border-t border-border z-40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0 sm:mt-8">
            <div className="max-w-4xl mx-auto flex gap-4">
               <Button variant="outline" onClick={() => setViewMode('list')} className="h-16 w-32 rounded-3xl text-lg font-bold border-2 border-border hidden sm:flex">
                 Cancelar
               </Button>
               <Button 
                  onClick={handleConfirmReconcile} 
                  disabled={reconcileOrderMutation.isPending} 
                  className="flex-1 h-16 text-xl font-black rounded-3xl bg-amber-500 hover:bg-amber-600 text-white shadow-2xl shadow-amber-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                 {reconcileOrderMutation.isPending ? "A Processar..." : "Fechar Acerto"}
               </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
