import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { toast } from "sonner";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";
import { useNavigate } from "react-router-dom"; 

// Importações dos componentes UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Importações de Ícones
import { Download, FileSpreadsheet, FileText, ArrowDownToLine, LogOut, Search, Package, Filter, Lock, ExternalLink, Loader2, MapPin, Factory, Truck, UserCircle, ArrowRight, PackageX } from "lucide-react"; 

// Nossos Sub-componentes Refatorados
import { StockTable } from "./StockTable";
import { TransactionPanel } from "./TransactionPanel";

// 💡 CORREÇÃO 1: Lista de setores atualizada com Protótipo, Engenharia e Outros
const SECTORS = [
  "ELETRICA", "FLOW", "ESTEIRA", "LAVADORA", "USINAGEM", 
  "DESENVOLVIMENTO", "PROTÓTIPO", "ENGENHARIA", "OUTROS", 
  "VIAGEM", "TERCEIROS", "ACUMULADOR", "REPOSIÇÃO"
];

type ViewMode = "table" | "entry" | "exit";

interface CartItem { 
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number; 
}

// =========================================================================
// HELPER: Design Inteligente para a Lista de Reservas
// =========================================================================
const getOriginDetails = (sectorString: string) => {
  if (!sectorString) return { icon: Package, text: "text-muted-foreground", bg: "bg-muted/50", label: "Desconhecido" };
  
  const s = sectorString.toLowerCase();
  
  if (s.includes("viagem")) {
    return { icon: MapPin, text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", label: sectorString };
  }
  if (s.includes("op") || s.includes("produção") || s.includes("separação")) {
    return { icon: Factory, text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: sectorString };
  }
  if (s.includes("reposição")) {
    return { icon: Truck, text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: sectorString };
  }
  
  // Default (Setores Internos da Empresa)
  return { icon: UserCircle, text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: `Setor: ${sectorString}` };
};

export default function Stock() {
  const { profile } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate(); 
  
  // --- PERMISSÕES ---
  const isEscritorio = profile?.role === "escritorio"; 
  const isAssistente = profile?.role === "assistente_tecnico";
  const isAdmin = profile?.role === "admin";
  const isCompras = profile?.role === "compras";
  const isAlmoxarife = profile?.role === "almoxarife";
  const userSector = profile?.sector?.toLowerCase() || "";

  const canEditStock = isAlmoxarife || isAdmin;
  const canEditCost = isCompras || isAdmin || isEscritorio; 
  const canViewSalesPrice = isEscritorio || isAssistente || isAdmin; 
  const canEditSalesPrice = isEscritorio || isAdmin; 

  const canEditItem = (stockItem: any) => {
    if (canEditStock) return true;
    if (userSector === "usinagem") {
      const tags = stockItem.products?.tags || [];
      return Array.isArray(tags) && tags.some((t: string) => t.toLowerCase() === "usinagem");
    }
    return false;
  };

  // --- ESTADOS GERAIS ---
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [destination, setDestination] = useState("");
  const [opCode, setOpCode] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // --- ESTADOS DOS MODAIS ---
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [adjustValue, setAdjustValue] = useState("");
  
  const [priceDialog, setPriceDialog] = useState(false); 
  const [costDialog, setCostDialog] = useState(false); 
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<any>(null);
  const [priceValue, setPriceValue] = useState(""); 
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel'>('pdf');
  const [exportFileName, setExportFileName] = useState("");
  const [exportFilteredOnly, setExportFilteredOnly] = useState(true);

  const [reserveDialog, setReserveDialog] = useState(false);
  const [selectedStockForReserve, setSelectedStockForReserve] = useState<any>(null);
  const [reserveValue, setReserveValue] = useState("");

  // --- QUERIES E SOCKET ---
  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => (await api.get("/stock")).data,
  });

  const { data: activeReservations, isLoading: isLoadingReservations } = useQuery({
    queryKey: ["stock_reservations", selectedStockForReserve?.id],
    queryFn: async () => {
      if (!selectedStockForReserve?.id) return [];
      const response = await api.get(`/stock/${selectedStockForReserve.id}/reservations`);
      return response.data;
    },
    enabled: !!selectedStockForReserve?.id && reserveDialog,
  });

  useEffect(() => {
    if (!socket) return;
    const handleStockUpdate = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["stocks"] });
      }, Math.random() * 2000); 
    };
    socket.on("stock_updated", handleStockUpdate);
    socket.on("refresh_stock", handleStockUpdate);
    socket.on("update_stock", handleStockUpdate);
    return () => { 
      socket.off("stock_updated", handleStockUpdate); 
      socket.off("refresh_stock", handleStockUpdate); 
      socket.off("update_stock", handleStockUpdate); 
    };
  }, [socket, queryClient]);

  // --- MUTAÇÕES ---

  const manualEntryMutation = useMutation({
    mutationFn: async (items: any[]) => await api.post("/stock/manual-entry", { items }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["stocks"] }), 500);
      toast.success("Entrada registrada com sucesso!"); 
      resetTransaction(); 
    },
    onError: (error: any) => toast.error(`Erro na entrada: ${error.response?.data?.error || "Falha"}`),
  });

  const manualExitMutation = useMutation({
    mutationFn: async (data: { sector: string; op_code?: string; items: any[] }) => await api.post("/stock/manual-withdrawal", data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["stocks"] }), 500);
      toast.success("Saída registrada com sucesso!"); 
      resetTransaction(); 
    },
    // 💡 CORREÇÃO 2: Log detalhado de erro. Se falhar, o Toast vai mostrar a mensagem exata do Backend.
    onError: (error: any) => {
      console.error("Erro na mutação de saída:", error.response?.data || error.message);
      toast.error(`Erro na saída: ${error.response?.data?.error || error.message || "Falha de comunicação"}`);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => await api.put(`/stock/${id}`, { quantity_on_hand: quantity }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stocks"] }); toast.success("Estoque ajustado!"); setAdjustDialog(false); },
    onError: () => toast.error("Erro ao ajustar estoque. Tente novamente."),
  });

  const updateCostPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { unit_price: price }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stocks"] }); toast.success("Custo atualizado!"); setCostDialog(false); },
    onError: () => toast.error("Erro ao atualizar o custo. Tente novamente."),
  });

  const updateSalesPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { sales_price: price }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stocks"] }); toast.success("Preço de venda atualizado!"); setPriceDialog(false); },
    onError: () => toast.error("Erro ao atualizar o preço. Tente novamente."),
  });

  const adjustReserveMutation = useMutation({
    mutationFn: async ({ id, quantity_reserved }: { id: string; quantity_reserved: number }) => 
      await api.put(`/stock/${id}`, { quantity_reserved }), 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Reserva atualizada com sucesso!"); 
      setReserveDialog(false); 
    },
    onError: () => toast.error("Erro ao atualizar reserva. Verifique a conexão."),
  });

  // --- FUNÇÕES AUXILIARES ---
  const resetTransaction = () => { 
    setCart([]); setDestination(""); setSearchTerm(""); setOpCode(""); 
    setSelectedTag("all"); setStockFilter("all"); setViewMode("table"); 
  };

  const allTags = useMemo(() => {
    if (!stocks) return [];
    const tagsSet = new Set<string>();
    stocks.forEach((stock: any) => {
      const pTags = stock.products?.tags || [];
      if (Array.isArray(pTags)) pTags.forEach((tag: string) => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let filtered = stocks;
    
    if (selectedTag !== "all") {
      filtered = filtered.filter((s: any) => s.products?.tags?.includes(selectedTag));
    }
    
    if (stockFilter !== "all") {
      filtered = filtered.filter((stock: any) => {
        const fisico = Number(stock.quantity_on_hand) || 0;
        const minStock = Number(stock.products?.min_stock) || 0;
        if (stockFilter === "zero") return fisico === 0;
        if (stockFilter === "low") return fisico > 0 && fisico < minStock;
        if (stockFilter === "in_stock") return fisico > 0;
        return true;
      });
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((s: any) => s.products?.name?.toLowerCase().includes(term) || s.products?.sku?.toLowerCase().includes(term));
    } else if (viewMode !== "table") {
      filtered = filtered.slice(0, 50);
    }
    
    return filtered;
  }, [stocks, searchTerm, selectedTag, stockFilter, viewMode]);

  const paginatedStocks = useMemo(() => {
    if (viewMode !== "table") return filteredStocks;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStocks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStocks, currentPage, viewMode]);

  const totalPages = Math.ceil(filteredStocks.length / ITEMS_PER_PAGE);

  const confirmExport = () => {
    const dataToExport = exportFilteredOnly ? filteredStocks : stocks;

    if (!dataToExport || dataToExport.length === 0) return toast.error("Sem dados para exportar.");
    
    const finalFileName = exportFileName.trim() || "Relatorio_Estoque";
    
    const exportData = dataToExport.map((item: any) => {
      const available = (Number(item.quantity_on_hand) || 0) - (Number(item.quantity_reserved) || 0);
      
      const tagsString = Array.isArray(item.products?.tags) && item.products.tags.length > 0 
        ? item.products.tags.join(", ") 
        : "-";

      const data: any = { 
        SKU: item.products?.sku || "N/A", 
        Produto: item.products?.name || "Sem Nome", 
        Etiquetas: tagsString,
        Unidade: item.products?.unit || "-", 
        Físico: Number(item.quantity_on_hand || 0), 
        Reservado: Number(item.quantity_reserved || 0), 
        Disponível: available, 
        Mínimo: Number(item.products?.min_stock || 0) 
      };
      if (canEditCost) data["Custo (R$)"] = Number(item.products?.unit_price || 0).toFixed(2);
      return data;
    });

    if (exportType === 'excel') { 
      exportToExcel(exportData, finalFileName); 
      toast.success("Excel baixado!"); 
    } else {
      const columns = [
        { header: "SKU", dataKey: "SKU" }, 
        { header: "Produto", dataKey: "Produto" }, 
        { header: "Etiquetas", dataKey: "Etiquetas" },
        { header: "Físico", dataKey: "Físico" },
        { header: "Reservado", dataKey: "Reservado" }, 
        { header: "Disponível", dataKey: "Disponível" }, 
        { header: "Mín.", dataKey: "Mínimo" }
      ];
      if (canEditCost) columns.push({ header: "Custo", dataKey: "Custo (R$)" });
      
      let reportTitle = "Relatório de Estoque";
      if (exportFilteredOnly && selectedTag !== "all") {
        reportTitle += ` | Filtro: ${selectedTag}`;
      }

      exportToPDF(reportTitle, columns, exportData, finalFileName);
      toast.success("PDF gerado!");
    }
    setExportDialogOpen(false);
  };

  const handleConfirmTransaction = () => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return toast.error("Adicione itens válidos com quantidade maior que 0.");
    
    if (viewMode === "entry") {
      // 💡 CORREÇÃO 3: Força a conversão para Number()
      manualEntryMutation.mutate(
        validItems.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) }))
      );
    } else {
      if (!destination) return toast.error("Selecione o destino.");
      // 💡 CORREÇÃO 3: Força a conversão para Number()
      manualExitMutation.mutate({ 
        sector: destination, 
        op_code: opCode, 
        items: validItems.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) })) 
      });
    }
  };

  // --- HANDLERS DOS MODAIS ---
  const handleOpenExportDialog = (type: 'pdf' | 'excel') => {
    if (!filteredStocks || filteredStocks.length === 0) return toast.error("Sem dados para exportar.");
    setExportType(type);
    let defaultName = "Relatorio_Estoque";
    if (selectedTag !== "all") defaultName += `_${selectedTag}`;
    if (stockFilter !== "all") defaultName += `_${stockFilter}`;
    setExportFileName(defaultName);
    setExportDialogOpen(true);
  };

  const handleOpenAdjust = (s: any) => { setSelectedStock(s); setAdjustValue(s.quantity_on_hand.toString()); setAdjustDialog(true); };
  const handleOpenSalesPrice = (s: any) => { setSelectedProductForPrice(s.products); setPriceValue(s.products.sales_price?.toString() || "0"); setPriceDialog(true); };
  const handleOpenCostPrice = (s: any) => { setSelectedProductForPrice(s.products); setPriceValue(s.products.unit_price?.toString() || "0"); setCostDialog(true); };

  const submitAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjustValue);
    if (isNaN(val)) return toast.error("Por favor, insira um valor numérico.");
    adjustMutation.mutate({ id: selectedStock.id, quantity: val });
  };

  const submitCostPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(priceValue);
    if (isNaN(val)) return toast.error("Por favor, insira um valor numérico.");
    updateCostPriceMutation.mutate({ id: selectedProductForPrice.id, price: val });
  };

  const submitSalesPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(priceValue);
    if (isNaN(val)) return toast.error("Por favor, insira um valor numérico.");
    updateSalesPriceMutation.mutate({ id: selectedProductForPrice.id, price: val });
  };

  const handleOpenReserve = (stock: any) => { 
    setSelectedStockForReserve(stock); 
    setReserveValue(stock.quantity_reserved?.toString() || "0"); 
    setReserveDialog(true); 
  };
  
  const handleConfirmReserve = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (selectedStockForReserve) {
      const val = parseFloat(reserveValue);
      if (isNaN(val)) return toast.error("Por favor, insira um valor numérico.");
      adjustReserveMutation.mutate({ id: selectedStockForReserve.id, quantity_reserved: val }); 
    }
  };

  // --- CARRINHO HELPER FUNCTIONS ---
  const addToCart = (stock: any) => {
    if (cart.find(item => item.product_id === stock.products.id)) return toast.info("Item já na lista");
    const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
    if (viewMode === "exit" && available <= 0) return toast.error("Sem estoque disponível.");
    setCart([...cart, { product_id: stock.products.id, name: stock.products.name, sku: stock.products.sku, unit: stock.products.unit, current_stock: viewMode === "exit" ? available : Number(stock.quantity_on_hand), quantity: 1 }]);
  };
  const updateQuantity = (productId: string, newQty: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        if (viewMode === "exit" && newQty > item.current_stock) { toast.warning(`Máximo disponível: ${item.current_stock}`); return { ...item, quantity: item.current_stock }; }
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }));
  };
  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.product_id !== productId));

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================

  if (viewMode !== "table") {
    return (
      <TransactionPanel 
        viewMode={viewMode} setViewMode={setViewMode} searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
        filteredStocks={filteredStocks} cart={cart} setCart={setCart} destination={destination} setDestination={setDestination} sectors={SECTORS} 
        addToCart={addToCart} removeFromCart={removeFromCart} updateQuantity={updateQuantity} handleConfirmTransaction={handleConfirmTransaction} 
        isPending={manualEntryMutation.isPending || manualExitMutation.isPending} resetTransaction={resetTransaction}
        opCode={opCode} setOpCode={setOpCode}
      />
    );
  }

  const availableForReserve = (Number(selectedStockForReserve?.quantity_on_hand) || 0) - (Number(selectedStockForReserve?.quantity_reserved) || 0);

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
      
      {/* Topbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestão de Estoque</h1>
          <p className="text-sm md:text-base text-muted-foreground">Visão geral e controle</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-dashed gap-2 flex-1 md:flex-none">
                <Download className="h-4 w-4" /> Exportar Filtro
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenExportDialog('excel')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenExportDialog('pdf')} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-600" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {canEditStock && (
            <>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 md:flex-none" onClick={() => setViewMode("entry")}>
                <ArrowDownToLine className="mr-2 h-4 w-4"/> Entrada
              </Button>
              <Button variant="destructive" className="flex-1 md:flex-none" onClick={() => setViewMode("exit")}>
                <LogOut className="mr-2 h-4 w-4"/> Saída
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-3 md:p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome ou SKU..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10 bg-background" />
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-1/2 sm:w-[170px] bg-background">
              <Package className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Estoque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o Estoque</SelectItem>
              <SelectItem value="in_stock">Com Estoque (&gt; 0)</SelectItem>
              <SelectItem value="low">Estoque Baixo</SelectItem>
              <SelectItem value="zero">Estoque Zerado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTag} onValueChange={(v) => { setSelectedTag(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-1/2 sm:w-[170px] bg-background">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Etiquetas</SelectItem>
              {allTags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela Injetada */}
      <StockTable 
        paginatedStocks={paginatedStocks} isLoading={isLoading} canEditItem={canEditItem} 
        canEditCost={canEditCost} canViewSalesPrice={canViewSalesPrice} canEditSalesPrice={canEditSalesPrice} 
        handleOpenAdjust={handleOpenAdjust} handleOpenCostPrice={handleOpenCostPrice} handleOpenSalesPrice={handleOpenSalesPrice} 
        handleOpenReserve={handleOpenReserve} 
      />

      {/* Paginação */}
      {filteredStocks.length > 0 && !isLoading && (
        <Pagination>
          <PaginationContent>
            <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button></PaginationItem>
            <PaginationItem><span className="text-sm mx-2">Pg {currentPage} de {totalPages}</span></PaginationItem>
            <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próximo</Button></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* ================= MODAIS BÁSICOS ================= */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Ajuste de Quantidade Física</DialogTitle></DialogHeader>
          <form onSubmit={submitAdjust} className="space-y-4">
            <Label>Quantidade Física Total</Label>
            <Input type="number" step="0.01" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdjustDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={adjustMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Definir Preço de Venda</DialogTitle></DialogHeader>
          <form onSubmit={submitSalesPrice} className="space-y-4">
            <Label>Novo Preço (R$)</Label>
            <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPriceDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateSalesPriceMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={costDialog} onOpenChange={setCostDialog}>
        <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Atualizar Custo</DialogTitle></DialogHeader>
          <form onSubmit={submitCostPrice} className="space-y-4">
            <Label>Novo Custo (R$)</Label>
            <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCostDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateCostPriceMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
            <DialogDescription>Escolha as opções para o seu ficheiro {exportType === 'excel' ? 'Excel (.xlsx)' : 'PDF'}.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div>
              <Label htmlFor="filename" className="mb-2 block text-sm font-medium">Nome do Arquivo</Label>
              <Input id="filename" value={exportFileName} onChange={(e) => setExportFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmExport()} autoFocus/>
            </div>
            
            <div className="flex items-center space-x-3 bg-muted/50 p-3 rounded-md border">
              <input
                type="checkbox"
                id="export-filtered"
                checked={exportFilteredOnly}
                onChange={(e) => setExportFilteredOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="export-filtered" className="text-sm font-medium cursor-pointer leading-none">
                Exportar apenas resultados filtrados
              </Label>
            </div>

          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={confirmExport} className="bg-primary text-primary-foreground">Baixar Ficheiro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL MODERNO DE RESERVAS (CLEAN SAAS UI)                 */}
      {/* ========================================================= */}
      <Dialog open={reserveDialog} onOpenChange={setReserveDialog}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-border/60 bg-background" onCloseAutoFocus={(e) => e.preventDefault()}>
          
          {/* Header & Dashboards */}
          <div className="p-6 bg-muted/30 border-b border-border/40">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <Lock className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-xl font-bold text-foreground">
                    Rastreio de Reservas
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-1">
                    Analisando origens para o item: <strong className="text-foreground">{selectedStockForReserve?.products?.name}</strong>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Dashboard Visual de Quantidades (Semantic Tailwind) */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="bg-card rounded-xl p-4 border border-border/50 flex flex-col items-center justify-center shadow-sm">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Físico Total</span>
                <span className="text-2xl font-bold text-foreground">{selectedStockForReserve?.quantity_on_hand}</span>
              </div>
              <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-500/20 flex flex-col items-center justify-center shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-[0.03] dark:opacity-[0.08]">
                  <Lock className="h-16 w-16 text-amber-900 dark:text-amber-500" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-500 mb-1 z-10">
                  Em Pedidos
                </span>
                <span className="text-3xl font-black text-amber-700 dark:text-amber-500 z-10">{selectedStockForReserve?.quantity_reserved}</span>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border/50 flex flex-col items-center justify-center shadow-sm">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Livre para Uso</span>
                <span className={`text-2xl font-bold ${availableForReserve > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive'}`}>
                  {availableForReserve.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* LISTA DE RASTREIO DINÂMICA */}
          <div className="p-6 bg-background">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Search className="h-4 w-4" /> Detalhamento de Origens
            </h3>
            
            <div className="space-y-3 max-h-[35vh] overflow-y-auto custom-scrollbar pr-2">
              {isLoadingReservations ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                  <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                  <span className="text-sm font-medium">Rastreando o sistema...</span>
                </div>
              ) : activeReservations && activeReservations.length > 0 ? (
                activeReservations.map((res: any, idx: number) => {
                  const origin = getOriginDetails(res.sector);
                  return (
                    <div key={idx} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-card border border-border/50 hover:border-border hover:bg-muted/30 rounded-xl shadow-sm transition-all gap-4 sm:gap-0">
                      
                      {/* Info do Setor/Origem */}
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${origin.bg} ${origin.text}`}>
                          <origin.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-sm">
                            Pedido #{res.request_id || res.id}
                          </p>
                          <p className="text-xs font-medium text-muted-foreground mt-0.5">{origin.label}</p>
                        </div>
                      </div>
                      
                      {/* Quantidade & Ação */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0">
                        <div className="flex flex-col sm:items-end">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Qtd. Retida</span>
                          <span className="font-black text-amber-600 dark:text-amber-500 text-lg leading-none mt-1">
                            {res.quantity} <span className="text-xs font-normal text-muted-foreground">un.</span>
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 text-xs font-semibold bg-background hover:bg-muted"
                          onClick={() => {
                            setReserveDialog(false); 
                            setTimeout(() => navigate(`/requests?id=${res.request_id || res.id}`), 150);
                          }}
                        >
                          Acessar <ArrowRight className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 border border-dashed rounded-xl border-border/50 bg-muted/20">
                  <PackageX className="h-10 w-10 mx-auto text-muted-foreground opacity-30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum pedido retendo este material no momento.</p>
                </div>
              )}
            </div>

            {/* Ajuste Manual (Admin) */}
            <div className="pt-4 mt-6 border-t border-border/40">
              <form onSubmit={handleConfirmReserve} className="flex flex-col sm:flex-row sm:items-end gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Forçar Correção (Admin)</Label>
                  <p className="text-[10px] text-muted-foreground/70 mb-2">Use apenas se o sistema estiver dessincronizado.</p>
                  <Input 
                    type="number" step="0.01" min="0" max={selectedStockForReserve?.quantity_on_hand || 0}
                    value={reserveValue} onChange={(e) => setReserveValue(e.target.value)} 
                    className="h-9 bg-background border-border/60 focus-visible:ring-amber-500/30"
                  />
                </div>
                <Button type="submit" variant="secondary" className="h-9 text-amber-700 dark:text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 w-full sm:w-auto" disabled={adjustReserveMutation.isPending}>
                  Sobrescrever Valor
                </Button>
              </form>
            </div>
          </div>
          
        </DialogContent>
      </Dialog>

    </div>
  );
}
