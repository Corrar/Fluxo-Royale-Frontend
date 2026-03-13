import { useState, useMemo, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useSocket } from "@/contexts/SocketContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, AlertTriangle, ArrowLeft, Upload, FileSpreadsheet, Plus, Trash2,
  ArrowRightLeft, FileText, Download, Scale, MapPin, Users, Eye
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
// ✨ NOVO: Adicionado 'available_quantity' para controle de estoque
interface Product { 
  id: string; 
  sku: string; 
  name: string; 
  unit: string; 
  available_quantity: number; // Certifique-se que o backend envia isso!
}

interface TravelItemInput {
  product_id: string; sku: string; name: string; quantity: number; unit: string;
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
  // ✨ NOVO: Adicionado available_stock no estado manual para mostrar na tela
  const [manualOutbound, setManualOutbound] = useState({ sku: "", name: "", quantity: "", unit: "", product_id: "", available_stock: 0 });

  // Estados Acerto (Volta)
  const [reconcileItems, setReconcileItems] = useState<any[]>([]);

  // 1. DADOS: Buscar Produtos
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 1000 * 60 * 10,
  });

  const productsDictionary = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.sku, p));
    return map;
  }, [products]);

  // 2. DADOS: Buscar Viagens
  const { data: travelOrders = [], isLoading: isLoadingOrders } = useQuery<TravelOrder[]>({
    queryKey: ["travel-orders"],
    queryFn: async () => (await api.get("/travel-orders")).data,
  });

  // Atualização em Tempo Real
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ["travel-orders"] });
    socket.on("travel_orders_update", handleUpdate);
    return () => { socket.off("travel_orders_update", handleUpdate); };
  }, [socket, queryClient]);

  // 3. MUTAÇÕES
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => await api.post('/travel-orders', data),
    onSuccess: () => {
      toast.success("Viagem registrada! Estoque reservado com sucesso.");
      resetNewTripForm();
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao registrar viagem.")
  });

  const reconcileOrderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => await api.post(`/travel-orders/${id}/reconcile`, data),
    onSuccess: () => {
      toast.success("Acerto concluído! Estoque físico e reservas atualizados.");
      setViewMode('list');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erro ao fazer acerto.")
  });

  // --- HANDLERS: NOVA VIAGEM ---
  const resetNewTripForm = () => {
    setTechnicians(""); setCity(""); setOutboundList([]);
    setManualOutbound({ sku: "", name: "", quantity: "", unit: "", product_id: "", available_stock: 0 });
  };

  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sku = e.target.value;
    const found = productsDictionary.get(sku);
    setManualOutbound({
      ...manualOutbound, 
      sku,
      name: found?.name || "", 
      unit: found?.unit || "un", 
      product_id: found?.id || "",
      available_stock: found?.available_quantity || 0 // ✨ Puxa o estoque
    });
  };

  const addManualItem = () => {
    const qtd = parseFloat(manualOutbound.quantity);
    if (!manualOutbound.product_id) return toast.warning("Produto não encontrado na base de dados.");
    if (qtd <= 0 || isNaN(qtd)) return toast.warning("Quantidade inválida.");

    // ✨ NOVO: Lógica restritiva de estoque
    const existingItem = outboundList.find(i => i.product_id === manualOutbound.product_id);
    const quantityAlreadyInList = existingItem ? existingItem.quantity : 0;
    const totalDesiredQuantity = quantityAlreadyInList + qtd;

    if (totalDesiredQuantity > manualOutbound.available_stock) {
      return toast.error(`Estoque insuficiente! Disponível: ${manualOutbound.available_stock} ${manualOutbound.unit}. Já tens ${quantityAlreadyInList} na lista.`);
    }

    setOutboundList(prev => {
      if (existingItem) {
        return prev.map(i => i.product_id === manualOutbound.product_id ? { ...i, quantity: totalDesiredQuantity } : i);
      }
      return [...prev, { ...manualOutbound, quantity: qtd } as TravelItemInput];
    });
    
    setManualOutbound({ sku: "", name: "", quantity: "", unit: "", product_id: "", available_stock: 0 });
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
        let skippedItems = 0; // ✨ NOVO: Contador para itens com estoque insuficiente

        data.forEach(row => {
          const sku = String(row['sku'] || row['SKU'] || row['Codigo'] || "");
          const qty = Number(row['quantity'] || row['qtd'] || row['Qtd'] || 0);
          const found = productsDictionary.get(sku);
          
          if (found && qty > 0) {
            const existing = formatted.find(i => i.product_id === found.id);
            const currentQty = existing ? existing.quantity : 0;
            const totalQty = currentQty + qty;

            // ✨ NOVO: Validação de estoque via Excel
            if (totalQty <= (found.available_quantity || 0)) {
              if (existing) existing.quantity = totalQty;
              else formatted.push({ product_id: found.id, sku: found.sku, name: found.name, unit: found.unit, quantity: qty });
            } else {
              skippedItems++;
            }
          }
        });
        
        setOutboundList(formatted);
        toast.success(`${formatted.length} itens reconhecidos da planilha.`);
        if (skippedItems > 0) {
           toast.warning(`${skippedItems} itens ignorados ou ajustados por falta de estoque suficiente.`);
        }
      } 
      else if (target === 'reconcile') {
        let updatedItems = [...reconcileItems];
        data.forEach(row => {
          const sku = String(row['sku'] || row['SKU'] || row['Codigo'] || "");
          const qty = Number(row['quantity'] || row['qtd'] || row['Qtd'] || 0);
          const found = productsDictionary.get(sku);
          
          if (found) {
            const existingIdx = updatedItems.findIndex(i => i.product_id === found.id);
            if (existingIdx >= 0) {
              updatedItems[existingIdx].returnedQuantity += qty;
            } else {
               updatedItems.push({
                 product_id: found.id, sku: found.sku, name: found.name, unit: found.unit,
                 quantity_out: 0, returnedQuantity: qty
               });
            }
          }
        });
        setReconcileItems(updatedItems);
        toast.success("Planilha de retorno lida com sucesso!");
      }
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateTrip = () => {
    if (!technicians || !city) return toast.warning("Preencha os Técnicos e a Cidade.");
    if (outboundList.length === 0) return toast.warning("Adicione itens à viagem.");
    createOrderMutation.mutate({ technicians, city, items: outboundList });
  };

  // --- HANDLERS: ACERTO (VOLTA) ---
  const openReconcile = (order: TravelOrder, mode: 'reconcile' | 'view') => {
    setSelectedOrder(order);
    const initialItems = order.items.map(item => ({
      product_id: item.product_id,
      sku: item.products?.sku || 'N/A',
      name: item.products?.name || 'N/A',
      unit: item.products?.unit || 'un',
      quantity_out: Number(item.quantity_out),
      returnedQuantity: mode === 'view' ? Number(item.quantity_returned) : 0, 
      status: item.status
    }));
    setReconcileItems(initialItems);
    setViewMode(mode);
  };

  const updateReturnedQuantity = (product_id: string, qty: number) => {
    setReconcileItems(prev => prev.map(item => 
      item.product_id === product_id ? { ...item, returnedQuantity: Math.max(0, qty) } : item
    ));
  };

  const handleConfirmReconcile = () => {
    if (!selectedOrder) return;
    const returnedPayload = reconcileItems
      .filter(item => item.returnedQuantity >= 0)
      .map(item => ({ product_id: item.product_id, returnedQuantity: item.returnedQuantity }));
    
    reconcileOrderMutation.mutate({ id: selectedOrder.id, data: { returnedItems: returnedPayload } });
  };

  // --- EXPORTAÇÃO ---
  const generateReport = (order: TravelOrder, format: 'pdf' | 'excel') => {
    // ... (Código de exportação mantido intacto)
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
  // RENDERIZAÇÃO DAS TELAS (Refatoradas para Dark Mode)
  // ============================================================================

  if (viewMode === 'list') {
    return (
      <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              {/* ✨ NOVO: text-foreground em vez de cores fixas escuras */}
              <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
                  <Scale className="h-8 w-8 text-blue-600 dark:text-blue-400" /> Controle de Viagens
              </h1>
              <p className="text-muted-foreground">Registe saídas, faça acertos de material e monitorize reservas.</p>
          </div>
          <Button onClick={() => { resetNewTripForm(); setViewMode('new'); }} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Nova Viagem (Ida)
          </Button>
        </div>

        {/* ✨ NOVO: Adicionado bg-card text-card-foreground ao Card */}
        <Card className="shadow-sm bg-card text-card-foreground">
          <Table>
            <TableHeader className="bg-muted/50 dark:bg-muted/20">
              <TableRow>
                <TableHead>Data da Viagem</TableHead>
                <TableHead>Técnicos</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-center">Itens Únicos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingOrders ? (
                 <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">Carregando viagens...</TableCell></TableRow>
              ) : travelOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-32 text-muted-foreground">Nenhuma viagem registrada.</TableCell></TableRow>
              ) : travelOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{new Date(order.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> {order.technicians}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" /> {order.city}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono">{order.items?.length || 0}</TableCell>
                  <TableCell>
                    {order.status === 'pending' ? (
                      <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Em Viagem</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-100/50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">Acerto Concluído</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === 'pending' ? (
                      <Button variant="default" size="sm" onClick={() => openReconcile(order, 'reconcile')} className="bg-amber-600 hover:bg-amber-700 text-white">
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> Fazer Acerto
                      </Button>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openReconcile(order, 'view')}>
                          <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><Download className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => generateReport(order, 'excel')}><FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Excel (.xlsx)</DropdownMenuItem>
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
      <div className="space-y-6 pb-20 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground"><Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" /> Registrar Ida (Nova Viagem)</h1>
                <p className="text-muted-foreground">O material adicionado aqui ficará como "Reservado" no seu estoque.</p>
            </div>
        </div>

        {/* ✨ NOVO: Ajuste de border e background para o Card no dark mode */}
        <Card className="shadow-sm border-blue-200 dark:border-blue-900 bg-card">
          <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="tecnicos">Técnicos <span className="text-red-500">*</span></Label>
                    <Input id="tecnicos" placeholder="Ex: João e Maria" value={technicians} onChange={(e) => setTechnicians(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade / Destino <span className="text-red-500">*</span></Label>
                    <Input id="cidade" placeholder="Ex: Porto" value={city} onChange={(e) => setCity(e.target.value)} className="bg-background" />
                </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="manual">Adicionar Manualmente</TabsTrigger>
                <TabsTrigger value="upload">Importar Planilha (Excel)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual">
                {/* ✨ NOVO: Ajuste do painel manual para dark mode */}
                <div className="flex flex-wrap gap-2 items-end bg-muted/30 p-4 rounded-lg border border-border">
                  <div className="grid gap-1 w-32">
                    <Label className="text-xs">SKU</Label>
                    <Input className="h-9 bg-background" placeholder="Bipar..." value={manualOutbound.sku} onChange={handleSkuChange} autoFocus />
                  </div>
                  <div className="grid gap-1 flex-1 min-w-[150px]">
                    <Label className="text-xs flex justify-between">
                      Produto
                      {/* ✨ NOVO: Feedback visual do estoque disponível */}
                      {manualOutbound.product_id && (
                        <span className={`font-semibold ${manualOutbound.available_stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          Disp: {manualOutbound.available_stock} {manualOutbound.unit}
                        </span>
                      )}
                    </Label>
                    <Input className="h-9 bg-muted cursor-not-allowed text-muted-foreground" readOnly value={manualOutbound.name} placeholder="Automático" />
                  </div>
                  <div className="grid gap-1 w-24">
                    <Label className="text-xs">Qtd.</Label>
                    <Input className="h-9 font-bold bg-background" type="number" min="1" placeholder="0" value={manualOutbound.quantity} onChange={e => setManualOutbound({...manualOutbound, quantity: e.target.value})} />
                  </div>
                  <Button onClick={addManualItem} className="h-9 w-12 shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
              </TabsContent>

              <TabsContent value="upload">
                <div className="bg-muted/10 hover:bg-muted/30 transition-colors p-6 rounded-lg border-2 border-dashed border-border text-center">
                  <Label htmlFor="outbound-file" className="cursor-pointer block">
                    <FileSpreadsheet className="h-10 w-10 text-blue-500 mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">Clique para carregar lista em .xlsx</span>
                    <span className="text-xs text-muted-foreground block mt-1">Obrigatório colunas: SKU, Quantidade</span>
                  </Label>
                  <Input id="outbound-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleExcelUpload(e, 'outbound')} />
                </div>
              </TabsContent>

              {outboundList.length > 0 && (
                <div className="mt-6 border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[100px]">SKU</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd. a levar</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outboundList.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                          <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">{item.quantity} {item.unit}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => setOutboundList(prev => prev.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Tabs>
          </CardContent>
          <CardFooter className="bg-muted/20 p-4 border-t border-border flex justify-end gap-3">
             <Button variant="outline" onClick={() => setViewMode('list')}>Cancelar</Button>
             <Button onClick={handleCreateTrip} disabled={outboundList.length === 0 || createOrderMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
               {createOrderMutation.isPending ? "A Reservar..." : "Registrar Saída e Reservar Estoque"}
             </Button>
          </CardFooter>
        </Card>
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
              <div className="bg-amber-50/50 dark:bg-amber-950/30 p-4 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                 <span className="text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2">
                   <AlertTriangle className="h-4 w-4 shrink-0" /> Tem uma planilha de retorno? Carregue aqui para preencher as devoluções automaticamente.
                 </span>
                 <Label htmlFor="reconcile-file" className="cursor-pointer shrink-0">
                    <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                      <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600 dark:text-green-500" /> Ler Excel
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
                  <TableHead className="text-center text-blue-700 dark:text-blue-400">Levaram</TableHead>
                  <TableHead className="text-center text-amber-700 dark:text-amber-500 w-32">{isViewing ? "Devolveram" : "Devolvido (Input)"}</TableHead>
                  <TableHead className="text-center">Dif.</TableHead>
                  {isViewing && <TableHead className="text-center">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconcileItems.map((item) => {
                  const out = Number(item.quantity_out);
                  const ret = Number(item.returnedQuantity);
                  const missing = out - ret;
                  
                  // ✨ NOVO: Cores de background dinâmicas que respeitam Dark Mode
                  let rowClass = "hover:bg-muted/30 transition-colors";
                  if (missing > 0) rowClass = "bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-900/30";
                  if (missing < 0) rowClass = "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/30";

                  return (
                    <TableRow key={item.product_id} className={rowClass}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                      <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                      <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400">{out} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></TableCell>
                      <TableCell className="text-center bg-amber-50/30 dark:bg-amber-900/10">
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
                        <span className={`font-bold ${missing > 0 ? "text-red-500 dark:text-red-400" : missing < 0 ? "text-blue-500 dark:text-blue-400" : "text-green-500 dark:text-green-400"}`}>
                          {missing > 0 ? `Faltou ${missing}` : missing < 0 ? `Sobrou ${Math.abs(missing)}` : "OK"}
                        </span>
                      </TableCell>
                      {isViewing && (
                        <TableCell className="text-center">
                          {item.status === 'ok' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">OK</Badge>}
                          {item.status === 'missing' && <Badge variant="destructive">FALTA</Badge>}
                          {item.status === 'extra' && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">EXTRA</Badge>}
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
