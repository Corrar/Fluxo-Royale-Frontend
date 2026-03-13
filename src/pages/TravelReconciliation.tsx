import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, ArrowLeft, FileSpreadsheet, Plus, Trash2,
  ArrowRightLeft, FileText, Download, MapPin, Users, Eye, Search, Minus, Package, PackageSearch,
  CheckCircle2, Clock, Route, Car
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

// Função para calcular o estoque disponível real
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

  // Estados Nova Viagem (Ida)
  const [technicians, setTechnicians] = useState("");
  const [city, setCity] = useState("");
  const [outboundList, setOutboundList] = useState<TravelItemInput[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados Acerto (Volta)
  const [reconcileItems, setReconcileItems] = useState<any[]>([]);

  // 1. DADOS: Buscar Produtos
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

  // Busca Inteligente
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lower = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.sku.toLowerCase().includes(lower)
    ).slice(0, 5); 
  }, [searchTerm, products]);

  // 2. DADOS: Buscar Viagens
  const { data: travelOrders = [], isLoading: isLoadingOrders } = useQuery<TravelOrder[]>({
    queryKey: ["travel-orders"],
    queryFn: async () => (await api.get("/travel-orders")).data,
  });

  // Cálculos para os Cards de Resumo (Dashboard)
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
      toast.success("Viagem registada! Estoque reservado com sucesso.");
      resetNewTripForm();
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao registar viagem.")
  });

  const reconcileOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.post(`/travel-orders/${id}/reconcile`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      toast.success("Acerto concluído! Estoque atualizado.");
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao fazer acerto.")
  });

  // --- HANDLERS: NOVA VIAGEM ---
  const resetNewTripForm = () => {
    setTechnicians(""); setCity(""); setOutboundList([]); setSearchTerm("");
  };

  const handleAddFromSearch = (product: Product) => {
    setOutboundList(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const available = getAvailableStock(product);

      if (currentQty + 1 > available) {
        toast.error(`Estoque insuficiente. Restam ${available} unidades de ${product.name}.`);
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
             toast.error(`Limite atingido para ${item.name}. Disponível: ${currentStock} ${item.unit}.`);
             return item;
           }
           return { ...item, quantity: newQty, available_stock: currentStock };
        }
        return item;
      }).filter(Boolean) as TravelItemInput[];
    });
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'outbound' | 'reconcile') => {
    // Lógica idêntica mantida para segurança
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
        toast.success(`${formatted.length} itens importados.`);
        if (skippedItems > 0) toast.warning(`${skippedItems} itens ignorados por excederem o estoque!`);
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
    if (!technicians || !city) return toast.warning("Preencha os Técnicos e a Cidade.");
    if (outboundList.length === 0) return toast.warning("O carrinho de viagem está vazio.");

    // Pre-flight check
    for (const item of outboundList) {
      const freshProduct = products.find(p => p.id === item.product_id);
      const currentAvailable = getAvailableStock(freshProduct);
      if (item.quantity > currentAvailable) {
        toast.error(`Bloqueado: O estoque de ${item.name} mudou! Disponível: ${currentAvailable}. Ajuste o carrinho.`);
        refetchProducts(); 
        return; 
      }
    }
    createOrderMutation.mutate({ technicians, city, items: outboundList });
  };

  // --- HANDLERS: ACERTO ---
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
    if (format === 'excel') {
      exportToExcel(tableData, fileName);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("Relatório de Acerto de Viagem", 14, 20);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100); 
      doc.text(`Cidade: ${order.city}  |  Técnicos: ${order.technicians}`, 14, 28);
      doc.text(`Data Ida: ${new Date(order.created_at).toLocaleDateString('pt-BR')}  |  Data Volta: ${new Date(order.updated_at).toLocaleDateString('pt-BR')}`, 14, 34);

      autoTable(doc, {
          head: [["SKU", "Produto", "Saída", "Retorno", "Dif.", "Status"]],
          body: tableData.map(d => [String(d.SKU), String(d.Produto), String(d.Saída), String(d.Retorno), String(d.Diferença), String(d.Status)]),
          startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [71, 85, 105] },
      });
      doc.save(`${fileName}.pdf`);
    }
  };

  // ============================================================================
  // RENDERIZAÇÃO DAS TELAS
  // ============================================================================

  // ------------------------- VISTA 1: DASHBOARD (LISTA) -------------------------
  if (viewMode === 'list') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-3xl font-extrabold flex items-center gap-3 text-foreground">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <Car className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Gestão de Viagens
              </h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">Controle saídas, retornos e reconciliações de material.</p>
          </div>
          <Button onClick={() => { resetNewTripForm(); setViewMode('new'); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 px-6 h-12 font-bold w-full md:w-auto transition-transform active:scale-95">
            <Plus className="mr-2 h-5 w-5" /> Nova Viagem
          </Button>
        </div>

        {/* Cards de Métricas (UX Upgrade) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border shadow-sm rounded-2xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"><Route className="h-6 w-6"/></div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Viagens</p>
                <h3 className="text-2xl font-bold text-foreground">{stats.total}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm rounded-2xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400"><Clock className="h-6 w-6"/></div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <h3 className="text-2xl font-bold text-foreground">{stats.pending}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm rounded-2xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-6 w-6"/></div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acertos Concluídos</p>
                <h3 className="text-2xl font-bold text-foreground">{stats.reconciled}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Viagens */}
        <Card className="shadow-sm bg-card border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-12">Data de Saída</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingOrders ? (
                   <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">A carregar...</TableCell></TableRow>
                ) : travelOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Route className="h-12 w-12 mb-3 text-muted-foreground/30" />
                        <p className="text-lg font-medium text-foreground">Nenhuma viagem encontrada</p>
                        <p className="text-sm mt-1">Crie a primeira viagem para começar a monitorizar o estoque externo.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : travelOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/30 transition-colors group">
                    <TableCell className="font-medium">{new Date(order.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {order.technicians}</div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {order.city}</div></TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono bg-muted/50">{order.items?.length || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      {order.status === 'pending' ? (
                        <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 gap-1.5 py-1">
                          <Clock className="h-3 w-3" /> Em Viagem
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-100/50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1.5 py-1">
                          <CheckCircle2 className="h-3 w-3" /> Concluído
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status === 'pending' ? (
                        <Button variant="default" size="sm" onClick={() => openReconcile(order, 'reconcile')} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-all active:scale-95">
                          <ArrowRightLeft className="h-4 w-4 mr-2" /> Fazer Acerto
                        </Button>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openReconcile(order, 'view')} className="rounded-xl text-muted-foreground hover:text-foreground">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="rounded-xl border-border"><Download className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem onClick={() => generateReport(order, 'excel')} className="cursor-pointer"><FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Exportar Excel</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => generateReport(order, 'pdf')} className="cursor-pointer"><FileText className="h-4 w-4 mr-2 text-red-500" /> Exportar PDF</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  }

  // ------------------------- VISTA 2: NOVA VIAGEM (A IDA) -------------------------
  if (viewMode === 'new') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="rounded-full bg-muted/50 hover:bg-muted shrink-0 transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Registar Saída</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados e adicione os materiais que a equipa vai levar.</p>
          </div>
        </div>

        <div className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm transition-all hover:shadow-md">
          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 block flex items-center gap-2">
            <Route className="h-4 w-4" /> Informações da Viagem
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-foreground">Para onde vão?</Label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Ex: Obra Centro" value={city} onChange={e => setCity(e.target.value)} className="pl-12 h-14 rounded-2xl bg-muted/30 border-border focus:bg-background focus:ring-emerald-500/20 focus:border-emerald-500 text-lg transition-all" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Quem vai viajar?</Label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Ex: João e Maria" value={technicians} onChange={e => setTechnicians(e.target.value)} className="pl-12 h-14 rounded-2xl bg-muted/30 border-border focus:bg-background focus:ring-emerald-500/20 focus:border-emerald-500 text-lg transition-all" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" /> Materiais (Carrinho)
            </h2>
            <Label htmlFor="upload-excel" className="cursor-pointer inline-flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-5 py-2.5 rounded-xl hover:bg-emerald-200 transition-colors w-full sm:w-max">
              <FileSpreadsheet className="h-4 w-4" /> Importar Planilha
            </Label>
            <Input id="upload-excel" type="file" accept=".xlsx" className="hidden" onChange={e => handleExcelUpload(e, 'outbound')} />
          </div>

          <div className="relative z-10">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
              <Input
                placeholder="Busque um produto por nome ou SKU para adicionar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-14 h-16 rounded-2xl border-2 border-border shadow-sm text-lg focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all bg-card"
              />
            </div>

            {searchTerm && searchResults.length > 0 && (
              <Card className="absolute top-full left-0 right-0 mt-2 p-2 shadow-2xl border-border rounded-2xl bg-card animate-in fade-in slide-in-from-top-2">
                {searchResults.map(product => {
                   const available = getAvailableStock(product);
                   return (
                     <button
                       key={product.id}
                       onClick={() => handleAddFromSearch(product)}
                       className="w-full flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-colors text-left border border-transparent hover:border-border group"
                     >
                        <div>
                          <p className="font-bold text-foreground text-lg group-hover:text-emerald-600 transition-colors">{product.name}</p>
                          <p className="text-sm text-muted-foreground font-mono mt-0.5">{product.sku}</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <Badge variant="secondary" className={`text-sm py-1 px-3 ${available > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700'}`}>
                            {available} {product.unit} disp.
                          </Badge>
                          <span className="text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Toque para adicionar</span>
                        </div>
                     </button>
                   );
                })}
              </Card>
            )}
            
            {searchTerm && searchResults.length === 0 && (
               <Card className="absolute top-full left-0 right-0 mt-2 p-8 text-center shadow-xl border-border rounded-2xl bg-card text-muted-foreground flex flex-col items-center">
                 <Search className="h-8 w-8 mb-2 opacity-20" />
                 Nenhum produto encontrado.
               </Card>
            )}
          </div>

          {outboundList.length > 0 ? (
            <div className="space-y-3 mt-6">
              {outboundList.map((item) => (
                <div key={item.product_id} className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                        <Package className="h-6 w-6 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-lg leading-tight">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-mono text-xs text-muted-foreground">{item.sku}</Badge>
                          <span className="text-xs text-muted-foreground">Disp: {item.available_stock} {item.unit}</span>
                        </div>
                      </div>
                   </div>

                   <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="flex items-center bg-muted/40 rounded-xl border border-border overflow-hidden h-12 shadow-inner">
                         <button onClick={() => updateItemQuantity(item.product_id, -1)} className="w-12 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted">
                           <Minus className="h-4 w-4" />
                         </button>
                         <div className="w-12 h-full bg-background flex items-center justify-center font-extrabold text-foreground text-lg border-x border-border/50">
                           {item.quantity}
                         </div>
                         <button onClick={() => updateItemQuantity(item.product_id, 1)} className="w-12 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:bg-muted">
                           <Plus className="h-4 w-4" />
                         </button>
                      </div>
                      <button onClick={() => updateItemQuantity(item.product_id, -item.quantity)} className="h-12 w-12 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-transparent hover:border-red-100">
                        <Trash2 className="h-5 w-5" />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 px-4 border-2 border-dashed border-border rounded-3xl bg-muted/10 mt-6 flex flex-col items-center justify-center">
               <div className="h-20 w-20 bg-background rounded-full shadow-sm flex items-center justify-center mb-4 border border-border">
                 <PackageSearch className="h-10 w-10 text-muted-foreground/40" />
               </div>
               <p className="text-foreground font-bold text-xl">O carrinho está vazio</p>
               <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">Procure os materiais na barra acima para adicioná-los à viagem.</p>
            </div>
          )}
        </div>

        {/* Rodapé Flutuante CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-background/80 backdrop-blur-xl border-t border-border z-40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0 sm:mt-8">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4">
             <Button variant="outline" onClick={() => setViewMode('list')} className="h-14 sm:w-32 rounded-2xl text-base font-bold hidden sm:flex">
               Cancelar
             </Button>
             <Button
               onClick={handleCreateTrip}
               disabled={outboundList.length === 0 || createOrderMutation.isPending}
               className="flex-1 h-14 text-lg font-extrabold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
             >
               {createOrderMutation.isPending ? "A Reservar Estoque..." : `Confirmar Viagem • ${outboundList.length} iten(s)`}
             </Button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------- VISTA 3: ACERTO (A VOLTA) -------------------------
  if (viewMode === 'reconcile' || viewMode === 'view') {
    const isViewing = viewMode === 'view';
    return (
      <div className="space-y-8 pb-32 animate-in slide-in-from-right-4 duration-300 max-w-5xl mx-auto">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="rounded-full bg-muted/50 hover:bg-muted shrink-0">
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </Button>
              <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3 text-foreground">
                    {isViewing ? "Detalhes do Acerto" : "Fazer Acerto de Contas"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isViewing ? "Resumo do que foi levado vs devolvido." : "Valide o material devolvido para atualizar o estoque."}
                  </p>
              </div>
          </div>
          {isViewing && (
            <Button variant="outline" size="sm" onClick={() => generateReport(selectedOrder!, 'pdf')} className="rounded-xl font-bold hidden md:flex border-border shadow-sm hover:bg-accent">
              <FileText className="h-4 w-4 mr-2" /> Gerar Relatório
            </Button>
          )}
        </div>

        {/* Card Resumo Viagem */}
        <Card className={`border-0 shadow-lg rounded-3xl overflow-hidden ${isViewing ? 'bg-slate-800 text-white' : 'bg-amber-600 text-white'}`}>
           <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                {isViewing ? <CheckCircle2 className="h-32 w-32" /> : <ArrowRightLeft className="h-32 w-32" />}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8 relative z-10 w-full">
                 <div>
                   <p className="text-white/70 text-sm font-medium mb-1 flex items-center gap-2"><Users className="h-4 w-4"/> Equipe</p>
                   <p className="font-bold text-xl">{selectedOrder?.technicians}</p>
                 </div>
                 <div>
                   <p className="text-white/70 text-sm font-medium mb-1 flex items-center gap-2"><MapPin className="h-4 w-4"/> Destino</p>
                   <p className="font-bold text-xl">{selectedOrder?.city}</p>
                 </div>
                 <div className="col-span-2 md:col-span-1">
                   <p className="text-white/70 text-sm font-medium mb-1 flex items-center gap-2"><Clock className="h-4 w-4"/> Saída</p>
                   <p className="font-bold text-xl">{selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</p>
                 </div>
              </div>
           </div>
        </Card>

        {/* Upload Excel Card */}
        {!isViewing && (
          <Card className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 shadow-none rounded-2xl">
            <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-amber-800 dark:text-amber-400">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">Tem uma planilha com as devoluções? Carregue aqui para preencher a lista automaticamente.</p>
              </div>
              <Label htmlFor="reconcile-file" className="cursor-pointer shrink-0 w-full sm:w-auto">
                <div className="flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold bg-white dark:bg-background border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 shadow-sm hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors h-11 px-6">
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Ler Excel de Retorno
                </div>
              </Label>
              <Input id="reconcile-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleExcelUpload(e, 'reconcile')} />
            </CardContent>
          </Card>
        )}

        {/* Lista de Acerto Dinâmica */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold px-1">Itens da Viagem</h2>
          
          <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
            {/* Header Falso para manter estrutura em telas grandes */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-muted/40 border-b border-border text-sm font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5 pl-2">Produto</div>
              <div className="col-span-2 text-center text-blue-600 dark:text-blue-400">Levaram</div>
              <div className="col-span-3 text-center text-amber-600 dark:text-amber-500">{isViewing ? "Devolvido" : "Quantidade Devolvida"}</div>
              <div className="col-span-2 text-right pr-4">Resultado</div>
            </div>

            <div className="divide-y divide-border">
              {reconcileItems.map((item) => {
                const out = Number(item.quantity_out);
                const ret = Number(item.returnedQuantity);
                const missing = out - ret;
                
                // Lógica de Cores Modernas
                let statusColor = "bg-transparent";
                let diffText = "Bateu Certo";
                let diffColor = "text-emerald-500 dark:text-emerald-400";
                
                if (missing > 0) {
                  statusColor = "bg-red-50/30 dark:bg-red-950/10";
                  diffText = `Falta ${missing}`;
                  diffColor = "text-red-500 dark:text-red-400";
                } else if (missing < 0) {
                  statusColor = "bg-blue-50/30 dark:bg-blue-950/10";
                  diffText = `Sobrou ${Math.abs(missing)}`;
                  diffColor = "text-blue-500 dark:text-blue-400";
                }

                return (
                  <div key={item.product_id} className={`p-4 md:p-5 flex flex-col md:grid md:grid-cols-12 gap-4 items-center transition-colors hover:bg-muted/20 ${statusColor}`}>
                    
                    {/* Produto Info */}
                    <div className="col-span-5 w-full flex flex-col justify-center">
                      <p className="font-bold text-foreground text-base leading-tight">{item.name}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1">{item.sku}</p>
                    </div>

                    {/* Quantidade Levada */}
                    <div className="col-span-2 w-full md:w-auto flex justify-between md:justify-center items-center">
                      <span className="md:hidden text-sm font-medium text-muted-foreground">Levaram:</span>
                      <Badge variant="outline" className="text-base py-1 px-3 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30">
                        {out} <span className="text-xs font-normal ml-1 opacity-70">{item.unit}</span>
                      </Badge>
                    </div>

                    {/* Quantidade Devolvida (Input/View) */}
                    <div className="col-span-3 w-full flex justify-between md:justify-center items-center">
                      <span className="md:hidden text-sm font-medium text-muted-foreground">Devolveram:</span>
                      {isViewing ? (
                        <span className="font-extrabold text-xl px-4 py-1 rounded-xl bg-muted/50 border border-border">{ret}</span>
                      ) : (
                        <div className="relative group/input">
                          <Input 
                            type="number" 
                            min="0" 
                            className="h-12 w-28 text-center text-xl font-extrabold bg-background border-2 border-border focus:border-amber-500 focus:ring-amber-500/20 rounded-xl transition-all shadow-inner" 
                            value={item.returnedQuantity === 0 && item.quantity_out === 0 ? '' : item.returnedQuantity} 
                            onChange={(e) => updateReturnedQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Diferença/Resultado */}
                    <div className="col-span-2 w-full flex justify-between md:justify-end items-center md:pr-2">
                      <span className="md:hidden text-sm font-medium text-muted-foreground">Resultado:</span>
                      <div className="text-right">
                        <span className={`font-bold text-lg ${diffColor}`}>
                          {diffText}
                        </span>
                        {isViewing && (
                          <div className="mt-1">
                            {item.status === 'ok' && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 border-0">OK</Badge>}
                            {item.status === 'missing' && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 border-0">FALTA</Badge>}
                            {item.status === 'extra' && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 border-0">EXTRA</Badge>}
                          </div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Rodapé CTA Acerto */}
        {!isViewing && (
          <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-background/80 backdrop-blur-xl border-t border-border z-40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0 sm:mt-8">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4 justify-end">
               <Button variant="outline" onClick={() => setViewMode('list')} className="h-14 sm:w-32 rounded-2xl text-base font-bold hidden sm:flex">
                 Cancelar
               </Button>
               <Button 
                  onClick={handleConfirmReconcile} 
                  disabled={reconcileOrderMutation.isPending} 
                  className="w-full sm:w-auto h-14 text-lg font-extrabold rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-xl shadow-amber-600/20 px-10 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                 {reconcileOrderMutation.isPending ? "A Processar..." : "Concluir Acerto Definitivo"}
               </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
