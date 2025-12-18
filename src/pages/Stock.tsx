import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Settings2, Search, LogOut, ArrowDownToLine, Trash2, Package, ArrowRight, RotateCcw,
  CheckCircle2, TrendingDown, TrendingUp, DollarSign, Pencil, 
  Download, FileSpreadsheet, FileText // <--- Ícones Importados
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // <--- Dropdown Importado

// IMPORTA OS UTILITÁRIOS
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

const SECTORS = ["ELETRICA", "FLOW", "ESTEIRA", "LAVADORA", "USINAGEM", "DESENVOLVIMENTO", "VIAGEM", "TERCEIROS", "ACUMULADOR", "REPOSIÇÃO"];
type ViewMode = "table" | "entry" | "exit";

interface CartItem {
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number;
}

export default function Stock() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // --- PERMISSÕES ---
  const isAuxiliar = profile?.role === "auxiliar";
  const isAssistente = profile?.role === "assistente_tecnico";
  const isAdmin = profile?.role === "admin";
  const isCompras = profile?.role === "compras";
  const isAlmoxarife = profile?.role === "almoxarife";

  const canEditStock = isAlmoxarife || isAdmin;
  const canEditCost = isCompras || isAdmin || isAuxiliar;
  const canViewSalesPrice = isAuxiliar || isAssistente || isAdmin;
  const canEditSalesPrice = isAuxiliar || isAdmin;

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [destination, setDestination] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Estados dos Modais
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [adjustValue, setAdjustValue] = useState("");

  const [priceDialog, setPriceDialog] = useState(false); 
  const [costDialog, setCostDialog] = useState(false); 
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<any>(null);
  const [priceValue, setPriceValue] = useState(""); 

  // 1. BUSCAR ESTOQUE
  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => (await api.get("/stock")).data,
  });

  // 2. MUTAÇÕES (Mantidas iguais)
  const manualEntryMutation = useMutation({
    mutationFn: async (items: any[]) => await api.post("/manual-entry", { items }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Entrada registrada com sucesso!"); 
      resetTransaction(); 
    },
    onError: (error: any) => {
      console.error("Erro entrada:", error);
      toast.error(`Erro na entrada: ${error.response?.data?.error || "Falha de comunicação"}`);
    },
  });

  const manualExitMutation = useMutation({
    mutationFn: async (data: { sector: string; items: any[] }) => await api.post("/manual-withdrawal", data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Saída registrada com sucesso!"); 
      resetTransaction(); 
    },
    onError: (error: any) => {
      console.error("Erro saída:", error);
      toast.error(`Erro na saída: ${error.response?.data?.error || "Falha de comunicação"}`);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => await api.put(`/stock/${id}`, { quantity_on_hand: quantity }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Estoque ajustado!"); 
      setAdjustDialog(false); 
    },
    onError: () => toast.error("Erro ao ajustar estoque"),
  });

  const updateCostPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { unit_price: price }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Custo atualizado!"); 
      setCostDialog(false); 
    },
    onError: () => toast.error("Erro ao atualizar custo"),
  });

  const updateSalesPriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { sales_price: price }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      toast.success("Preço de venda atualizado!"); 
      setPriceDialog(false); 
    },
    onError: () => toast.error("Erro ao atualizar venda"),
  });

  // --- Helpers ---
  const resetTransaction = () => { 
    setCart([]); 
    setDestination(""); 
    setSearchTerm(""); 
    setViewMode("table"); 
  };

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    if (!searchTerm) return viewMode === "table" ? stocks : stocks.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return stocks.filter((stock: any) => 
      stock.products?.name?.toLowerCase().includes(term) || stock.products?.sku?.toLowerCase().includes(term)
    );
  }, [stocks, searchTerm, viewMode]);

  const paginatedStocks = useMemo(() => {
    if (viewMode !== "table") return filteredStocks;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStocks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStocks, currentPage, viewMode]);

  const totalPages = Math.ceil(filteredStocks.length / ITEMS_PER_PAGE);

  // --- NOVA FUNÇÃO EXPORTAR (Excel + PDF) ---
  const handleExportReport = (type: 'pdf' | 'excel') => {
    if (!filteredStocks || filteredStocks.length === 0) {
      toast.error("Sem dados para exportar.");
      return;
    }

    // Formata os dados para ficarem bonitos no relatório
    const exportData = filteredStocks.map((item: any) => {
      const available = (Number(item.quantity_on_hand) || 0) - (Number(item.quantity_reserved) || 0);
      return {
        SKU: item.products?.sku || "N/A",
        Produto: item.products?.name || "Sem Nome",
        "Unidade": item.products?.unit || "-",
        "Físico": Number(item.quantity_on_hand || 0),
        "Reservado": Number(item.quantity_reserved || 0),
        "Disponível": available,
        "Mínimo": Number(item.products?.min_stock || 0),
        "Custo (R$)": Number(item.products?.unit_price || 0).toFixed(2)
      };
    });

    if (type === 'excel') {
      exportToExcel(exportData, "Estoque_Geral");
      toast.success("Excel baixado!");
    } else {
      const columns = [
        { header: "SKU", dataKey: "SKU" },
        { header: "Produto", dataKey: "Produto" },
        { header: "Físico", dataKey: "Físico" },
        { header: "Reservado", dataKey: "Reservado" },
        { header: "Disponível", dataKey: "Disponível" },
        { header: "Mín.", dataKey: "Mínimo" },
      ];
      exportToPDF("Relatório Geral de Estoque", columns, exportData, "Estoque_PDF");
      toast.success("PDF gerado!");
    }
  };

  const addToCart = (stock: any) => {
    if (cart.find(item => item.product_id === stock.products.id)) return toast.info("Item já na lista");
    
    const currentOnHand = Number(stock.quantity_on_hand) || 0;
    const currentReserved = Number(stock.quantity_reserved) || 0;
    const available = currentOnHand - currentReserved;

    if (viewMode === "exit" && available <= 0) return toast.error("Sem estoque disponível.");
    
    setCart([...cart, {
      product_id: stock.products.id, 
      name: stock.products.name, 
      sku: stock.products.sku, 
      unit: stock.products.unit,
      current_stock: viewMode === "exit" ? available : currentOnHand, 
      quantity: 1
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

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const handleConfirmTransaction = () => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return toast.error("Adicione itens válidos com quantidade maior que 0.");
    
    if (viewMode === "entry") {
      manualEntryMutation.mutate(validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })));
    } else {
      if (!destination) return toast.error("Selecione o destino.");
      manualExitMutation.mutate({ 
        sector: destination, 
        items: validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })) 
      });
    }
  };

  // Handlers Dialogs
  const handleOpenAdjust = (stock: any) => { setSelectedStock(stock); setAdjustValue(stock.quantity_on_hand.toString()); setAdjustDialog(true); };
  const handleConfirmAdjust = (e: React.FormEvent) => { e.preventDefault(); if(selectedStock) adjustMutation.mutate({ id: selectedStock.id, quantity: parseFloat(adjustValue) }); };

  const handleOpenSalesPrice = (stock: any) => { setSelectedProductForPrice(stock.products); setPriceValue(stock.products.sales_price?.toString() || "0"); setPriceDialog(true); };
  const handleConfirmSalesPrice = (e: React.FormEvent) => { e.preventDefault(); if(selectedProductForPrice) updateSalesPriceMutation.mutate({ id: selectedProductForPrice.id, price: parseFloat(priceValue) }); };

  const handleOpenCostPrice = (stock: any) => { setSelectedProductForPrice(stock.products); setPriceValue(stock.products.unit_price?.toString() || "0"); setCostDialog(true); };
  const handleConfirmCostPrice = (e: React.FormEvent) => { e.preventDefault(); if(selectedProductForPrice) updateCostPriceMutation.mutate({ id: selectedProductForPrice.id, price: parseFloat(priceValue) }); };

  // --- SKELETON ---
  const TableSkeleton = () => (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
          {canViewSalesPrice && <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>}
          <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-[90px] ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  if (viewMode === "table") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div><h1 className="text-3xl font-bold">Gestão de Estoque</h1><p className="text-muted-foreground">Visão geral e controle</p></div>
          
          <div className="flex gap-3">
            {/* NOVO BOTÃO DROPDOWN EXPORTAR */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-dashed gap-2">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportReport('excel')} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReport('pdf')} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-red-600" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {canEditStock && (
              <>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setViewMode("entry")}><ArrowDownToLine className="mr-2 h-5 w-5"/> Entrada</Button>
                <Button size="lg" variant="destructive" onClick={() => setViewMode("exit")}><LogOut className="mr-2 h-5 w-5"/> Saída</Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="pl-10"/>
          </div>
        </div>

        <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Físico</TableHead>
                <TableHead>Reservado</TableHead>
                <TableHead>Disponível</TableHead>
                <TableHead>Custo Unit. (R$)</TableHead>
                {canViewSalesPrice && <TableHead className="text-blue-600">Preço Venda (R$)</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : (
               paginatedStocks.map((stock: any) => {
                const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
                const isLow = stock.products?.min_stock && available < stock.products.min_stock;
                return (
                  <TableRow key={stock.id}>
                    <TableCell className="font-medium">{stock.products?.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{stock.products?.sku}</TableCell>
                    <TableCell>{stock.quantity_on_hand}</TableCell>
                    <TableCell className="text-amber-600">{stock.quantity_reserved}</TableCell>
                    <TableCell className="font-bold">{available.toFixed(2)}</TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{stock.products?.unit_price ? `R$ ${Number(stock.products.unit_price).toFixed(2)}` : "-"}</span>
                        {canEditCost && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenCostPrice(stock)}>
                            <Pencil className="h-3 w-3 text-muted-foreground hover:text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>

                    {canViewSalesPrice && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-700">{stock.products?.sales_price ? `R$ ${Number(stock.products.sales_price).toFixed(2)}` : "-"}</span>
                          {canEditSalesPrice && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenSalesPrice(stock)}>
                              <Pencil className="h-3 w-3 text-muted-foreground hover:text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}

                    <TableCell>
                      {isLow ? <Badge variant="outline" className="text-amber-600 bg-amber-50">Baixo</Badge> : <Badge variant="outline" className="text-green-600 bg-green-50">OK</Badge>}
                    </TableCell>
                    
                    <TableCell className="text-right">
                      {canEditStock && (
                        <Button variant="ghost" size="sm" onClick={() => handleOpenAdjust(stock)}>
                          <Settings2 className="h-4 w-4 mr-2" /> Ajustar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }))}
            </TableBody>
          </Table>
          
          {filteredStocks.length > 0 && !isLoading && (
            <div className="border-t p-2">
              <Pagination>
                <PaginationContent>
                  <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button></PaginationItem>
                  <PaginationItem><span className="text-sm mx-2">Página {currentPage} de {totalPages}</span></PaginationItem>
                  <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próximo</Button></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        {/* DIALOGS */}
        <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Ajuste de Quantidade</DialogTitle></DialogHeader>
            <form onSubmit={handleConfirmAdjust} className="space-y-4">
              <Label>Quantidade Física Total</Label>
              <Input type="number" step="0.01" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} />
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdjustDialog(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Definir Preço de Venda (Catálogo)</DialogTitle></DialogHeader>
            <form onSubmit={handleConfirmSalesPrice} className="space-y-4">
              <Label>Novo Preço de Venda (R$)</Label>
              <div className="relative"><DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} /></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPriceDialog(false)}>Cancelar</Button><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar Venda</Button></div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={costDialog} onOpenChange={setCostDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Atualizar Custo Unitário</DialogTitle></DialogHeader>
            <form onSubmit={handleConfirmCostPrice} className="space-y-4">
              <Label>Novo Custo Unitário (R$)</Label>
              <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800 mb-2">
                Use a <strong>Calculadora de Custo</strong> na barra lateral para descobrir o valor correto antes de salvar.
              </div>
              <div className="relative"><DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} /></div>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCostDialog(false)}>Cancelar</Button><Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Salvar Custo</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- RENDERIZADOR: MODO TRANSAÇÃO (ENTRADA OU SAÍDA) ---
  const isEntry = viewMode === "entry";
  const themeClass = isEntry ? "text-emerald-600" : "text-red-600";
  const bgClass = isEntry ? "bg-emerald-50" : "bg-red-50";
  const borderClass = isEntry ? "border-emerald-200" : "border-red-200";

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header do Modo */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={resetTransaction}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {isEntry ? <TrendingUp className="h-6 w-6 text-emerald-600" /> : <TrendingDown className="h-6 w-6 text-red-600" />}
              {isEntry ? "Nova Entrada de Estoque" : "Nova Saída de Estoque"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEntry ? "Adicionar materiais ao almoxarifado" : "Registrar retirada manual de materiais"}
            </p>
          </div>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg">
          <Button 
            size="sm" 
            variant={isEntry ? "default" : "ghost"} 
            className={isEntry ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={() => { setViewMode("entry"); setCart([]); }}
          >
            Entrada
          </Button>
          <Button 
            size="sm" 
            variant={!isEntry ? "default" : "ghost"} 
            className={!isEntry ? "bg-red-600 hover:bg-red-700" : ""}
            onClick={() => { setViewMode("exit"); setCart([]); }}
          >
            Saída
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* COLUNA 1: PRODUTOS */}
        <Card className="col-span-12 lg:col-span-3 flex flex-col h-full border-muted-foreground/20 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/10 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Produtos Disponíveis
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredStocks.map((stock: any) => {
               const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
               return (
                <div 
                  key={stock.id} 
                  className="flex flex-col p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all group"
                  onClick={() => addToCart(stock)}
                >
                  <span className="font-medium text-sm break-words leading-tight">{stock.products?.name}</span>
                  <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{stock.products?.sku}</span>
                    <span className={isEntry ? "" : (available > 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold")}>
                      {isEntry ? stock.quantity_on_hand : available} {stock.products?.unit}
                    </span>
                  </div>
                </div>
               );
            })}
          </CardContent>
        </Card>

        {/* COLUNA 2: ITENS DA TRANSAÇÃO */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-full gap-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {isEntry ? "Itens para Entrada" : "Itens para Saída"}
              <Badge variant="secondary">{cart.length} itens</Badge>
            </h3>
            
            {/* Seletor de Destino */}
            {!isEntry && (
              <div className="w-64">
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="h-9 border-red-200 bg-red-50/50">
                    <SelectValue placeholder="Selecione o Destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                <Package className="h-10 w-10 mb-2 opacity-20" />
                <p>Selecione produtos na lista ao lado</p>
              </div>
            ) : (
              cart.map((item) => {
                const finalStock = isEntry 
                  ? Number(item.current_stock) + Number(item.quantity) 
                  : Number(item.current_stock) - Number(item.quantity);

                return (
                  <Card key={item.product_id} className={`overflow-hidden transition-all ${isEntry ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}>
                    <div className="p-4 flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${themeClass}`}>
                        <Package className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-sm truncate">{item.name}</h4>
                            <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-muted-foreground hover:text-red-500" onClick={() => removeFromCart(item.product_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 mt-3 text-sm">
                          <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Atual</span>
                            <span className="font-semibold">{item.current_stock}</span>
                          </div>
                          
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${bgClass} border ${borderClass}`}>
                            <span className={`text-xs font-bold ${themeClass}`}>
                              {isEntry ? "+" : "-"}
                            </span>
                            <Input 
                              type="number"
                              className={`h-6 w-20 text-center font-bold bg-transparent border-none focus-visible:ring-0 p-0 ${themeClass}`}
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                            />
                          </div>

                          <ArrowRight className="h-3 w-3 text-muted-foreground" />

                          <div className="text-center">
                            <span className="text-xs text-muted-foreground block">Novo</span>
                            <span className="font-bold">{finalStock} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA 3: RESUMO */}
        <Card className="col-span-12 lg:col-span-3 flex flex-col h-fit sticky top-4 border-muted-foreground/20 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {isEntry ? "Resumo da Entrada" : "Resumo da Saída"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-3 rounded-lg text-center">
                <span className="text-xs text-muted-foreground block mb-1">Itens Diferentes</span>
                <span className="text-2xl font-bold">{cart.length}</span>
              </div>
              <div className={`p-3 rounded-lg text-center ${bgClass} border ${borderClass}`}>
                <span className={`text-xs block mb-1 ${themeClass}`}>Qtd. Total</span>
                <span className={`text-2xl font-bold ${themeClass}`}>
                  {isEntry ? "+" : "-"}{cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-md flex items-start gap-3 ${cart.length > 0 ? "bg-green-50 text-green-800" : "bg-muted text-muted-foreground"}`}>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-xs leading-tight">
                {cart.length > 0 
                  ? "Tudo pronto! Revise os valores antes de confirmar a transação." 
                  : "Aguardando itens..."}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-0">
            <Button 
              className={`w-full h-12 text-lg font-bold shadow-lg ${isEntry ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-red-600 hover:bg-red-700 shadow-red-200"}`}
              onClick={handleConfirmTransaction}
              disabled={cart.length === 0 || manualEntryMutation.isPending || manualExitMutation.isPending}
            >
              {manualEntryMutation.isPending || manualExitMutation.isPending ? "Processando..." : (
                isEntry ? "Confirmar Entrada" : "Confirmar Saída"
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={resetTransaction}>
              Cancelar / Limpar
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  );
}