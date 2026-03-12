import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { toast } from "sonner";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

// Importações dos componentes UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Importações de Ícones
import { Download, FileSpreadsheet, FileText, ArrowDownToLine, LogOut, Search, Package, Filter, Lock, Info } from "lucide-react";

// Nossos Sub-componentes Refatorados
import { StockTable } from "./StockTable";
import { TransactionPanel } from "./TransactionPanel";

const SECTORS = ["ELETRICA", "FLOW", "ESTEIRA", "LAVADORA", "USINAGEM", "DESENVOLVIMENTO", "VIAGEM", "TERCEIROS", "ACUMULADOR", "REPOSIÇÃO"];
type ViewMode = "table" | "entry" | "exit";

interface CartItem { 
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number; 
}

export default function Stock() {
  const { profile } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  // --- PERMISSÕES ---
  const isAuxiliar = profile?.role === "auxiliar";
  const isAssistente = profile?.role === "assistente_tecnico";
  const isAdmin = profile?.role === "admin";
  const isCompras = profile?.role === "compras";
  const isAlmoxarife = profile?.role === "almoxarife";
  const userSector = profile?.sector?.toLowerCase() || "";

  const canEditStock = isAlmoxarife || isAdmin;
  const canEditCost = isCompras || isAdmin || isAuxiliar;
  const canViewSalesPrice = isAuxiliar || isAssistente || isAdmin;
  const canEditSalesPrice = isAuxiliar || isAdmin;

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

  // NOVO: Estados de Gerenciamento de Reservas
  const [reserveDialog, setReserveDialog] = useState(false);
  const [selectedStockForReserve, setSelectedStockForReserve] = useState<any>(null);
  const [reserveValue, setReserveValue] = useState("");

  // --- QUERIES E SOCKET ---
  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => (await api.get("/stock")).data,
  });

  useEffect(() => {
    if (!socket) return;
    const handleStockUpdate = () => queryClient.invalidateQueries({ queryKey: ["stocks"] });
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
    mutationFn: async (items: any[]) => await api.post("/manual-entry", { items }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["stocks"] }), 500);
      toast.success("Entrada registrada com sucesso!"); 
      resetTransaction(); 
    },
    onError: (error: any) => toast.error(`Erro na entrada: ${error.response?.data?.error || "Falha"}`),
  });

  const manualExitMutation = useMutation({
    mutationFn: async (data: { sector: string; items: any[] }) => await api.post("/manual-withdrawal", data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["stocks"] }), 500);
      toast.success("Saída registrada com sucesso!"); 
      resetTransaction(); 
    },
    onError: (error: any) => toast.error(`Erro na saída: ${error.response?.data?.error || "Falha"}`),
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => await api.put(`/stock/${id}`, { quantity_on_hand: quantity }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stocks"] }); toast.success("Estoque ajustado!"); setAdjustDialog(false); },
  });

  const updateCostPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { unit_price: price }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stocks"] }); toast.success("Custo atualizado!"); setCostDialog(false); },
  });

  const updateSalesPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { sales_price: price }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["stocks"] }); toast.success("Preço de venda atualizado!"); setPriceDialog(false); },
  });

  // NOVO: Mutação para as Reservas
  const adjustReserveMutation = useMutation({
    mutationFn: async ({ id, quantity_reserved }: { id: string; quantity_reserved: number }) => 
      await api.put(`/stock/${id}`, { quantity_reserved }), // Certifique-se que seu backend suporta este campo no PUT
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Reserva atualizada com sucesso!"); 
      setReserveDialog(false); 
    },
    onError: () => toast.error("Erro ao atualizar reserva. Verifique a conexão."),
  });

  // --- FUNÇÕES AUXILIARES ---
  const resetTransaction = () => { 
    setCart([]); setDestination(""); setSearchTerm(""); 
    setSelectedTag("all"); setStockFilter("all"); setViewMode("table"); 
  };

  const allTags = useMemo(() => {
    if (!stocks) return [];
    const tagsSet = new Set<string>();
    stocks.forEach((stock: any) => {
      const pTags = stock.products?.tags || [];
      if (Array.isArray(pTags)) pTags.forEach(tag => tagsSet.add(tag));
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

  // --- HANDLERS DE EXPORTAÇÃO ---
  const handleOpenExportDialog = (type: 'pdf' | 'excel') => {
    if (!filteredStocks || filteredStocks.length === 0) return toast.error("Sem dados para exportar.");
    setExportType(type);
    let defaultName = "Relatorio_Estoque";
    if (selectedTag !== "all") defaultName += `_${selectedTag}`;
    if (stockFilter !== "all") defaultName += `_${stockFilter}`;
    setExportFileName(defaultName);
    setExportDialogOpen(true);
  };

  const confirmExport = () => {
    if (!filteredStocks || filteredStocks.length === 0) return;
    const finalFileName = exportFileName.trim() || "Relatorio_Estoque";
    const exportData = filteredStocks.map((item: any) => {
      const available = (Number(item.quantity_on_hand) || 0) - (Number(item.quantity_reserved) || 0);
      const data: any = { 
        SKU: item.products?.sku || "N/A", 
        Produto: item.products?.name || "Sem Nome", 
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
        { header: "SKU", dataKey: "SKU" }, { header: "Produto", dataKey: "Produto" }, { header: "Físico", dataKey: "Físico" },
        { header: "Reservado", dataKey: "Reservado" }, { header: "Disponível", dataKey: "Disponível" }, { header: "Mín.", dataKey: "Mínimo" }
      ];
      if (canEditCost) columns.push({ header: "Custo", dataKey: "Custo (R$)" });
      exportToPDF(`Relatório de Estoque ${selectedTag !== "all" ? `| Etiqueta: ${selectedTag}` : ""}`, columns, exportData, finalFileName);
      toast.success("PDF gerado!");
    }
    setExportDialogOpen(false);
  };

  // --- HANDLERS DO CARRINHO ---
  const addToCart = (stock: any) => {
    if (cart.find(item => item.product_id === stock.products.id)) return toast.info("Item já na lista");
    const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
    if (viewMode === "exit" && available <= 0) return toast.error("Sem estoque disponível.");
    setCart([...cart, { 
      product_id: stock.products.id, name: stock.products.name, sku: stock.products.sku, 
      unit: stock.products.unit, current_stock: viewMode === "exit" ? available : Number(stock.quantity_on_hand), quantity: 1 
    }]);
  };

  const updateQuantity = (productId: string, newQty: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        if (viewMode === "exit" && newQty > item.current_stock) { 
          toast.warning(`Máximo disponível: ${item.current_stock}`); 
          return { ...item, quantity: item.current_stock }; 
        }
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.product_id !== productId));
  
  const handleConfirmTransaction = () => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return toast.error("Adicione itens válidos com quantidade maior que 0.");
    if (viewMode === "entry") manualEntryMutation.mutate(validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })));
    else {
      if (!destination) return toast.error("Selecione o destino.");
      manualExitMutation.mutate({ sector: destination, items: validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })) });
    }
  };

  // --- HANDLERS DOS MODAIS (Ajuste, Preço, Custo, Reservas) ---
  const handleOpenAdjust = (s: any) => { setSelectedStock(s); setAdjustValue(s.quantity_on_hand.toString()); setAdjustDialog(true); };
  const handleOpenSalesPrice = (s: any) => { setSelectedProductForPrice(s.products); setPriceValue(s.products.sales_price?.toString() || "0"); setPriceDialog(true); };
  const handleOpenCostPrice = (s: any) => { setSelectedProductForPrice(s.products); setPriceValue(s.products.unit_price?.toString() || "0"); setCostDialog(true); };

  // NOVO: Handlers de Reserva
  const handleOpenReserve = (stock: any) => { 
    setSelectedStockForReserve(stock); 
    setReserveValue(stock.quantity_reserved?.toString() || "0"); 
    setReserveDialog(true); 
  };
  const handleConfirmReserve = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (selectedStockForReserve) {
      adjustReserveMutation.mutate({ 
        id: selectedStockForReserve.id, 
        quantity_reserved: parseFloat(reserveValue) 
      }); 
    }
  };

  // =========================================================================
  // RENDERIZAÇÃO
  // =========================================================================

  // MODO: TRANSAÇÃO (Entrada ou Saída)
  if (viewMode !== "table") {
    return (
      <TransactionPanel 
        viewMode={viewMode} setViewMode={setViewMode} searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
        filteredStocks={filteredStocks} cart={cart} setCart={setCart} destination={destination} setDestination={setDestination} sectors={SECTORS} 
        addToCart={addToCart} removeFromCart={removeFromCart} updateQuantity={updateQuantity} handleConfirmTransaction={handleConfirmTransaction} 
        isPending={manualEntryMutation.isPending || manualExitMutation.isPending} resetTransaction={resetTransaction}
      />
    );
  }

  // MODO: TABELA PRINCIPAL
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
          <Input placeholder="Pesquisar por nome ou SKU..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10" />
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-1/2 sm:w-[170px]">
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
            <SelectTrigger className="w-1/2 sm:w-[170px]">
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

      {/* ================= MODAIS ================= */}

      {/* Modal: Ajuste Físico */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajuste de Quantidade Física</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); adjustMutation.mutate({ id: selectedStock.id, quantity: parseFloat(adjustValue) }); }} className="space-y-4">
            <Label>Quantidade Física Total</Label>
            <Input type="number" step="0.01" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdjustDialog(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Preço de Venda */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Definir Preço de Venda</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateSalesPriceMutation.mutate({ id: selectedProductForPrice.id, price: parseFloat(priceValue) }); }} className="space-y-4">
            <Label>Novo Preço (R$)</Label>
            <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPriceDialog(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Custo */}
      <Dialog open={costDialog} onOpenChange={setCostDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atualizar Custo</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateCostPriceMutation.mutate({ id: selectedProductForPrice.id, price: parseFloat(priceValue) }); }} className="space-y-4">
            <Label>Novo Custo (R$)</Label>
            <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCostDialog(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Exportação */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Arquivo</DialogTitle>
            <DialogDescription>Escolha o nome para o seu ficheiro {exportType === 'excel' ? 'Excel (.xlsx)' : 'PDF'}.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filename" className="mb-2 block text-sm font-medium">Nome do Relatório</Label>
            <Input id="filename" value={exportFileName} onChange={(e) => setExportFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmExport()} autoFocus/>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={confirmExport} className="bg-primary text-primary-foreground">Baixar Ficheiro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NOVO Modal: Gerenciar Reservas */}
      <Dialog open={reserveDialog} onOpenChange={setReserveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Gerenciar Estoque Reservado
            </DialogTitle>
            <DialogDescription>
              Ajuste a quantidade de {selectedStockForReserve?.products?.name} bloqueada para outras operações.
            </DialogDescription>
          </DialogHeader>

          {/* Card Informativo Visual */}
          <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center text-sm border">
            <div className="text-center">
              <span className="text-muted-foreground block text-xs mb-1">Físico Total</span>
              <span className="font-bold text-base">{selectedStockForReserve?.quantity_on_hand}</span>
            </div>
            <div className="text-center">
              <span className="text-amber-600 block text-xs mb-1">Já Reservado</span>
              <span className="font-bold text-base text-amber-600">{selectedStockForReserve?.quantity_reserved}</span>
            </div>
            <div className="text-center">
              <span className="text-emerald-600 block text-xs mb-1">Disponível</span>
              <span className="font-bold text-base text-emerald-600">
                {(Number(selectedStockForReserve?.quantity_on_hand) || 0) - (Number(selectedStockForReserve?.quantity_reserved) || 0)}
              </span>
            </div>
          </div>

          <form onSubmit={handleConfirmReserve} className="space-y-4 mt-2">
            <div>
              <Label className="text-amber-700">Nova Quantidade Reservada Total</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0"
                max={selectedStockForReserve?.quantity_on_hand || 0}
                value={reserveValue} 
                onChange={(e) => setReserveValue(e.target.value)} 
                className="border-amber-200 focus-visible:ring-amber-500 mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> A reserva não pode ser maior que o estoque físico.
              </p>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setReserveDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={adjustReserveMutation.isPending}>
                {adjustReserveMutation.isPending ? "Salvando..." : "Atualizar Reserva"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}