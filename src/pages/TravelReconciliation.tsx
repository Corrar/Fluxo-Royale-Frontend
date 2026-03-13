import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, ArrowLeft, Upload, FileSpreadsheet, Plus, Trash2,
  ArrowRightLeft, FileText, Download, Scale, MapPin, Users, Eye, Search, Minus, Package, PackageSearch
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

// --- TIPAGENS AJUSTADAS PARA O FORMATO DO BACKEND ---
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

// ✨ NOVO: Função para calcular o estoque disponível real com base no retorno do backend
const getAvailableStock = (product?: Product) => {
  if (!product || !product.stock) return 0;
  // Math.max evita números negativos. Subtrai o que já está reservado do que existe fisicamente.
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
    staleTime: 1000 * 15, // 15 segundos para garantir dados frescos
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
      
      toast.success("Viagem registrada! Estoque reservado com sucesso.");
      resetNewTripForm();
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao registrar viagem.")
  });

  const reconcileOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.post(`/travel-orders/${id}/reconcile`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
      
      toast.success("Acerto concluído! Estoque físico e reservas atualizados.");
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
      
      // ✨ Usamos a função para pegar o estoque real
      const available = getAvailableStock(product);

      if (currentQty + 1 > available) {
        toast.error(`Estoque insuficiente de ${product.name}. Restam apenas ${available} unidades.`);
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
           
           // ✨ Avaliamos novamente contra os dados mais recentes do cache
           const currentStock = getAvailableStock(freshProduct);
           
           const newQty = item.quantity + delta;
           if (newQty <= 0) return null; 
           
           if (newQty > currentStock) {
             toast.error(`Limite atingido para ${item.name}. Estoque atual: ${currentStock} ${item.unit}.`);
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
            } else {
              skippedItems++;
            }
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
        toast.success(`${formatted.length} itens da planilha processados.`);
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

    // ✨ Pre-flight check validando a propriedade aninhada
    for (const item of outboundList) {
      const freshProduct = products.find(p => p.id === item.product_id);
      const currentAvailable = getAvailableStock(freshProduct);
      
      if (item.quantity > currentAvailable) {
        toast.error(`Bloqueado: O estoque de ${item.name} sofreu alterações! Disponível agora: ${currentAvailable}. Ajuste o carrinho.`);
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

  // --- EXPORTAÇÃO ---
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

  if (viewMode === 'list') {
    return (
      <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
                  <Scale className="h-8 w-8 text-emerald-600 dark:text-emerald-400" /> Controle de Viagens
              </h1>
              <p className="text-muted-foreground">Registe saídas, faça acertos de material e monitorize reservas.</p>
          </div>
          <Button onClick={() => { resetNewTripForm(); setViewMode('new'); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 px-6 h-12 text-md">
            <Plus className="mr-2 h-5 w-5" /> Nova Viagem
          </Button>
        </div>

        <Card className="shadow-sm bg-card text-card-foreground border-border rounded-2xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 dark:bg-muted/20">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Técnicos</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingOrders ? (
                 <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : travelOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">Nenhuma viagem registrada.</TableCell></TableRow>
              ) : travelOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{new Date(order.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {order.technicians}</div></TableCell>
                  <TableCell><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {order.city}</div></TableCell>
                  <TableCell className="text-center font-mono">{order.items?.length || 0}</TableCell>
                  <TableCell>
                    {order.status === 'pending' ? <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-300">Em Viagem</Badge> : <Badge variant="outline" className="bg-emerald-100/50 text-emerald-700 border-emerald-300">Acerto Concluído</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === 'pending' ? (
                      <Button variant="default" size="sm" onClick={() => openReconcile(order, 'reconcile')} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> Acerto
                      </Button>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openReconcile(order, 'view')}><Eye className="h-4 w-4" /></Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => generateReport(order, 'excel')}><FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateReport(order, 'pdf')}><FileText className="h-4 w-4 mr-2 text-red-600" /> PDF</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  if (viewMode === 'new') {
    return (
      <div className="max-w-3xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="rounded-full bg-muted/50 hover:bg-muted shrink-0">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Nova Viagem</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados e monte o carrinho de materiais.</p>
          </div>
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
          <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 block">Destino e Equipe</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Para onde vão?" value={city} onChange={e => setCity(e.target.value)} className="pl-12 h-14 rounded-2xl bg-muted/40 border-transparent focus:bg-background focus:border-emerald-500 text-lg transition-all" />
            </div>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Quem vai viajar?" value={technicians} onChange={e => setTechnicians(e.target.value)} className="pl-12 h-14 rounded-2xl bg-muted/40 border-transparent focus:bg-background focus:border-emerald-500 text-lg transition-all" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-foreground">Materiais</h2>
            <Label htmlFor="upload-excel" className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-100 px-4 py-2 rounded-full hover:bg-emerald-200 transition-colors w-max">
              <FileSpreadsheet className="h-4 w-4" /> Importar de Excel
            </Label>
            <Input id="upload-excel" type="file" accept=".xlsx" className="hidden" onChange={e => handleExcelUpload(e, 'outbound')} />
          </div>

          <div className="relative z-10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
              <Input
                placeholder="Busque por nome ou SKU..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-14 h-16 rounded-2xl border-border shadow-sm text-lg focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500 transition-all bg-card"
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
                       className="w-full flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-colors text-left border border-transparent hover:border-border"
                     >
                        <div>
                          <p className="font-bold text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className={`${available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {available} {product.unit} disp.
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">Toque para add</p>
                        </div>
                     </button>
                   );
                })}
              </Card>
            )}
            
            {searchTerm && searchResults.length === 0 && (
               <Card className="absolute top-full left-0 right-0 mt-2 p-6 text-center shadow-xl border-border rounded-2xl bg-card text-muted-foreground">
                 Nenhum produto encontrado.
               </Card>
            )}
          </div>

          {outboundList.length > 0 ? (
            <div className="space-y-3 mt-6">
              {outboundList.map((item) => (
                <div key={item.product_id} className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                   <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Package className="h-7 w-7 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-foreground text-lg leading-tight">{item.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.sku}</span>
                          <span className="mx-2">•</span> 
                          Disp: {item.available_stock} {item.unit}
                        </p>
                      </div>
                   </div>

                   <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="flex items-center bg-muted/40 rounded-2xl border border-border overflow-hidden h-12">
                         <button onClick={() => updateItemQuantity(item.product_id, -1)} className="w-12 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:scale-95">
                           <Minus className="h-5 w-5" />
                         </button>
                         <span className="w-10 text-center font-extrabold text-foreground text-lg">{item.quantity}</span>
                         <button onClick={() => updateItemQuantity(item.product_id, 1)} className="w-12 h-full flex items-center justify-center hover:bg-muted/80 text-foreground transition-colors active:scale-95">
                           <Plus className="h-5 w-5" />
                         </button>
                      </div>
                      <button onClick={() => updateItemQuantity(item.product_id, -item.quantity)} className="h-12 w-12 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all">
                        <Trash2 className="h-5 w-5" />
                      </button>
                   </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 border-2 border-dashed border-border rounded-3xl bg-muted/10 mt-6">
               <PackageSearch className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
               <p className="text-foreground font-bold text-lg">O carrinho está vazio</p>
               <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Use a barra de pesquisa acima para encontrar materiais e adicionar à viagem.</p>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border z-40 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-t-0 sm:p-0 sm:mt-8">
          <div className="max-w-3xl mx-auto">
            <Button
              onClick={handleCreateTrip}
              disabled={outboundList.length === 0 || createOrderMutation.isPending}
              className="w-full h-16 text-xl font-extrabold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {createOrderMutation.isPending ? "A Reservar..." : `Confirmar Viagem (${outboundList.length} itens)`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'reconcile' || viewMode === 'view') {
    const isViewing = viewMode === 'view';
    return (
      <div className="space-y-6 pb-20 animate-in slide-in-from-right-4 duration-300 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                  {isViewing ? <Eye className="h-6 w-6 text-muted-foreground" /> : <ArrowRightLeft className="h-6 w-6 text-amber-600 dark:text-amber-500" />}
                  {isViewing ? "Detalhes do Acerto" : "Fazer Acerto de Contas (Volta)"}
                </h1>
                <p className="text-muted-foreground">
                  {isViewing ? "Viagem já concluída e estoque baixado." : "Aponte o que os técnicos devolveram. O que faltar será baixado do estoque físico."}
                </p>
            </div>
        </div>

        <Card className="shadow-md overflow-hidden border-border bg-card">
          <div className={`p-4 text-white flex justify-between items-center ${isViewing ? 'bg-slate-700 dark:bg-slate-800' : 'bg-amber-600 dark:bg-amber-700'}`}>
             <div className="flex gap-6">
                <div><span className="text-sm opacity-80 block">Técnicos</span><span className="font-bold">{selectedOrder?.technicians}</span></div>
                <div><span className="text-sm opacity-80 block">Destino</span><span className="font-bold">{selectedOrder?.city}</span></div>
                <div><span className="text-sm opacity-80 block">Data de Saída</span><span className="font-bold">{selectedOrder && new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</span></div>
             </div>
             {isViewing && (
               <Button variant="outline" size="sm" onClick={() => generateReport(selectedOrder!, 'pdf')} className="text-foreground bg-background hover:bg-muted border-border">
                 <FileText className="h-4 w-4 mr-2" /> Relatório PDF
               </Button>
             )}
          </div>

          <CardContent className="p-0">
            {!isViewing && (
              <div className="bg-amber-50/50 p-4 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                 <span className="text-sm text-amber-800 flex items-center gap-2">
                   <AlertTriangle className="h-4 w-4 shrink-0" /> Tem uma planilha de retorno? Carregue aqui para preencher.
                 </span>
                 <Label htmlFor="reconcile-file" className="cursor-pointer shrink-0">
                    <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                      <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Ler Excel
                    </div>
                 </Label>
                 <Input id="reconcile-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleExcelUpload(e, 'reconcile')} />
              </div>
            )}

            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center text-blue-700">Levaram</TableHead>
                  <TableHead className="text-center text-amber-700 w-32">{isViewing ? "Devolveram" : "Devolvido (Input)"}</TableHead>
                  <TableHead className="text-center">Dif.</TableHead>
                  {isViewing && <TableHead className="text-center">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconcileItems.map((item) => {
                  const out = Number(item.quantity_out);
                  const ret = Number(item.returnedQuantity);
                  const missing = out - ret;
                  
                  let rowClass = "hover:bg-muted/30 transition-colors";
                  if (missing > 0) rowClass = "bg-red-50/50 hover:bg-red-100/50";
                  if (missing < 0) rowClass = "bg-blue-50/50 hover:bg-blue-100/50";

                  return (
                    <TableRow key={item.product_id} className={rowClass}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                      <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                      <TableCell className="text-center font-bold text-blue-600">{out} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></TableCell>
                      <TableCell className="text-center bg-amber-50/30">
                        {isViewing ? (
                          <span className="font-bold text-foreground">{ret}</span>
                        ) : (
                          <Input 
                            type="number" min="0" className="h-8 w-20 mx-auto text-center font-bold bg-background" 
                            value={item.returnedQuantity === 0 && item.quantity_out === 0 ? '' : item.returnedQuantity} 
                            onChange={(e) => updateReturnedQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${missing > 0 ? "text-red-500" : missing < 0 ? "text-blue-500" : "text-green-500"}`}>
                          {missing > 0 ? `Faltou ${missing}` : missing < 0 ? `Sobrou ${Math.abs(missing)}` : "OK"}
                        </span>
                      </TableCell>
                      {isViewing && (
                        <TableCell className="text-center">
                          {item.status === 'ok' && <Badge className="bg-green-100 text-green-700">OK</Badge>}
                          {item.status === 'missing' && <Badge variant="destructive">FALTA</Badge>}
                          {item.status === 'extra' && <Badge className="bg-blue-100 text-blue-700">EXTRA</Badge>}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          
          {!isViewing && (
            <CardFooter className="bg-muted/20 p-4 border-t border-border flex justify-end gap-3">
               <Button variant="outline" onClick={() => setViewMode('list')}>Cancelar</Button>
               <Button onClick={handleConfirmReconcile} disabled={reconcileOrderMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg text-base h-12 px-8">
                 {reconcileOrderMutation.isPending ? "Processando..." : "Concluir Acerto Definitivo"}
               </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  return null;
}
