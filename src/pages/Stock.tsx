import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext"; // Importar Socket
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
  Download, FileSpreadsheet, FileText, Menu 
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

const SECTORS = ["ELETRICA", "FLOW", "ESTEIRA", "LAVADORA", "USINAGEM", "DESENVOLVIMENTO", "VIAGEM", "TERCEIROS", "ACUMULADOR", "REPOSIÇÃO"];
type ViewMode = "table" | "entry" | "exit";

interface CartItem {
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number;
}

export default function Stock() {
  const { profile } = useAuth();
  const { socket } = useSocket(); // Hook do Socket
  const queryClient = useQueryClient();
  
  // --- PERMISSÕES ---
  const isAuxiliar = profile?.role === "auxiliar";
  const isAssistente = profile?.role === "assistente_tecnico";
  const isAdmin = profile?.role === "admin";
  const isCompras = profile?.role === "compras";
  const isAlmoxarife = profile?.role === "almoxarife";

  const canEditStock = isAlmoxarife || isAdmin;
  
  // Define quem pode VER e EDITAR o custo. 
  // Se quiser que alguém veja mas não edite, separe em duas variáveis.
  const canEditCost = isCompras || isAdmin || isAuxiliar;
  
  const canViewSalesPrice = isAuxiliar || isAssistente || isAdmin;
  const canEditSalesPrice = isAuxiliar || isAdmin;

  // --- NOVA LÓGICA DE PERMISSÃO PARA USINAGEM ---
  const userSector = profile?.sector?.toLowerCase() || "";

  // Função para verificar se o usuário pode editar um item específico
  const canEditItem = (stockItem: any) => {
    // 1. Admin e Almoxarife têm permissão global
    if (canEditStock) return true;

    // 2. Setor Usinagem pode editar se o item tiver a tag 'Usinagem'
    if (userSector === "usinagem") {
      const tags = stockItem.products?.tags || [];
      const hasUsinagemTag = Array.isArray(tags) && tags.some((t: string) => t.toLowerCase() === "usinagem");
      return hasUsinagemTag;
    }

    return false;
  };
  // ----------------------------------------------

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

  // =================================================================
  // 🔴 SOCKET LISTENER (ATUALIZAÇÃO EM TEMPO REAL)
  // =================================================================
  useEffect(() => {
    if (!socket) return;

    const handleStockUpdate = () => {
      console.log("🔄 Recebido evento de atualização de estoque via Socket");
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
    };

    // Escuta eventos comuns de atualização
    socket.on("stock_updated", handleStockUpdate);
    socket.on("refresh_stock", handleStockUpdate);
    socket.on("update_stock", handleStockUpdate);

    return () => {
      socket.off("stock_updated", handleStockUpdate);
      socket.off("refresh_stock", handleStockUpdate);
      socket.off("update_stock", handleStockUpdate);
    };
  }, [socket, queryClient]);

  // 2. MUTAÇÕES (Com Refetch de Segurança)
  const manualEntryMutation = useMutation({
    mutationFn: async (items: any[]) => await api.post("/manual-entry", { items }),
    onSuccess: () => { 
      // Invalida imediatamente
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
      
      // Invalida novamente após 500ms para garantir que o DB processou
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["stocks"] });
      }, 500);

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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["stocks"] });
      }, 500);
      
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
    if (!searchTerm) return viewMode === "table" ? stocks : stocks.slice(0, 50); 
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

  const handleExportReport = (type: 'pdf' | 'excel') => {
    if (!filteredStocks || filteredStocks.length === 0) {
      toast.error("Sem dados para exportar.");
      return;
    }
    const exportData = filteredStocks.map((item: any) => {
      const available = (Number(item.quantity_on_hand) || 0) - (Number(item.quantity_reserved) || 0);
      
      const data: any = {
        SKU: item.products?.sku || "N/A",
        Produto: item.products?.name || "Sem Nome",
        "Unidade": item.products?.unit || "-",
        "Físico": Number(item.quantity_on_hand || 0),
        "Reservado": Number(item.quantity_reserved || 0),
        "Disponível": available,
        "Mínimo": Number(item.products?.min_stock || 0),
      };

      // Só adiciona o Custo se tiver permissão
      if (canEditCost) {
        data["Custo (R$)"] = Number(item.products?.unit_price || 0).toFixed(2);
      }

      return data;
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
      
      // Adiciona coluna de custo no PDF se permitido
      if (canEditCost) {
        columns.push({ header: "Custo", dataKey: "Custo (R$)" });
      }

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
          {/* Oculta Skeleton de custo se não tiver permissão */}
          {canEditCost && <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>}
          {canViewSalesPrice && <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>}
          <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-[90px] ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  // --- RENDER TABLE MODE ---
  if (viewMode === "table") {
    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gestão de Estoque</h1>
            <p className="text-sm md:text-base text-muted-foreground">Visão geral e controle</p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-dashed gap-2 flex-1 md:flex-none">
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

        {/* Campo de Pesquisa */}
        <div className="flex items-center gap-4 bg-card p-3 md:p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar por nome ou SKU..." 
              value={searchTerm} 
              onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
              className="pl-10"
            />
          </div>
        </div>

        {/* --- VIEW DESKTOP: TABELA --- */}
        <div className="hidden md:block border rounded-lg bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Físico</TableHead>
                <TableHead>Reservado</TableHead>
                <TableHead>Disponível</TableHead>
                
                {/* COLUNA CUSTO CONDICIONAL */}
                {canEditCost && <TableHead>Custo (R$)</TableHead>}
                
                {canViewSalesPrice && <TableHead className="text-blue-600">Venda (R$)</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton /> : paginatedStocks.map((stock: any) => {
                const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
                const isLow = stock.products?.min_stock && available < stock.products.min_stock;
                return (
                  <TableRow key={stock.id}>
                    <TableCell className="font-medium">{stock.products?.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{stock.products?.sku}</TableCell>
                    <TableCell>{stock.quantity_on_hand}</TableCell>
                    <TableCell className="text-amber-600">{stock.quantity_reserved}</TableCell>
                    <TableCell className="font-bold">{available.toFixed(2)}</TableCell>
                    
                    {/* CÉLULA CUSTO CONDICIONAL */}
                    {canEditCost && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{stock.products?.unit_price ? `R$ ${Number(stock.products.unit_price).toFixed(2)}` : "-"}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenCostPrice(stock)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    )}

                    {canViewSalesPrice && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-700">{stock.products?.sales_price ? `R$ ${Number(stock.products.sales_price).toFixed(2)}` : "-"}</span>
                          {canEditSalesPrice && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenSalesPrice(stock)}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{isLow ? <Badge variant="outline" className="text-amber-600 bg-amber-50">Baixo</Badge> : <Badge variant="outline" className="text-green-600 bg-green-50">OK</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {canEditItem(stock) && <Button variant="ghost" size="sm" onClick={() => handleOpenAdjust(stock)}><Settings2 className="h-4 w-4 mr-2" /> Ajustar</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* --- VIEW MOBILE: CARDS --- */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
             Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)
          ) : (
            paginatedStocks.map((stock: any) => {
              const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
              return (
                <Card key={stock.id} className="shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base font-bold line-clamp-2">{stock.products?.name}</CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{stock.products?.sku}</p>
                      </div>
                      {canEditItem(stock) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenAdjust(stock)}>Ajustar Quantidade</DropdownMenuItem>
                            {canEditCost && <DropdownMenuItem onClick={() => handleOpenCostPrice(stock)}>Alterar Custo</DropdownMenuItem>}
                            {canEditSalesPrice && <DropdownMenuItem onClick={() => handleOpenSalesPrice(stock)}>Alterar Preço Venda</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-2 text-sm">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Físico:</span>
                      <span className="font-semibold">{stock.quantity_on_hand} {stock.products?.unit}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Disponível:</span>
                      <span className={available > 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>
                        {available.toFixed(2)}
                      </span>
                    </div>
                    {canViewSalesPrice && (
                      <div className="flex justify-between">
                         <span className="text-muted-foreground">Preço:</span>
                         <span className="font-bold text-blue-600">R$ {Number(stock.products?.sales_price || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Paginação */}
        {filteredStocks.length > 0 && !isLoading && (
          <div className="py-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button></PaginationItem>
                <PaginationItem><span className="text-sm mx-2">Pg {currentPage} de {totalPages}</span></PaginationItem>
                <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próximo</Button></PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Dialogs de Ajuste (Mantidos iguais) */}
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
             <DialogHeader><DialogTitle>Definir Preço de Venda</DialogTitle></DialogHeader>
             <form onSubmit={handleConfirmSalesPrice} className="space-y-4">
                <Label>Novo Preço (R$)</Label>
                <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPriceDialog(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
             </form>
          </DialogContent>
        </Dialog>

        <Dialog open={costDialog} onOpenChange={setCostDialog}>
          <DialogContent>
             <DialogHeader><DialogTitle>Atualizar Custo</DialogTitle></DialogHeader>
             <form onSubmit={handleConfirmCostPrice} className="space-y-4">
                <Label>Novo Custo (R$)</Label>
                <Input type="number" step="0.01" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} />
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCostDialog(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
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
    // Alterado para h-auto no mobile e min-h-screen para evitar problemas de scroll
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 pb-10 min-h-[calc(100vh-4rem)]">
      
      {/* Header do Modo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3 w-full">
          <Button variant="outline" size="icon" onClick={resetTransaction}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              {isEntry ? <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" /> : <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-red-600" />}
              {isEntry ? "Entrada" : "Saída"}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
              {isEntry ? "Adicionar materiais ao almoxarifado" : "Registrar retirada manual de materiais"}
            </p>
          </div>

          <div className="flex bg-muted p-1 rounded-lg shrink-0">
             <Button size="sm" variant={isEntry ? "default" : "ghost"} className={isEntry ? "bg-emerald-600" : ""} onClick={() => { setViewMode("entry"); setCart([]); }}>Entrada</Button>
             <Button size="sm" variant={!isEntry ? "default" : "ghost"} className={!isEntry ? "bg-red-600" : ""} onClick={() => { setViewMode("exit"); setCart([]); }}>Saída</Button>
          </div>
        </div>
      </div>

      {/* GRID RESPONSIVO: 
        Mobile: Flex-col (Vertical)
        Desktop (lg): Grid 12 colunas 
      */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 flex-1">
        
        {/* COLUNA 1: PRODUTOS (No mobile fica no topo) */}
        <Card className="lg:col-span-3 flex flex-col h-[400px] lg:h-[calc(100vh-10rem)] border-muted-foreground/20 shadow-sm overflow-hidden order-1">
          <CardHeader className="pb-3 bg-muted/10 shrink-0 p-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Produtos
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredStocks.map((stock: any) => {
               const available = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
               return (
                <div 
                  key={stock.id} 
                  className="flex flex-col p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all active:scale-95"
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

        {/* COLUNA 2: ITENS DA TRANSAÇÃO (No mobile fica no meio) */}
        <div className="lg:col-span-6 flex flex-col h-auto lg:h-[calc(100vh-10rem)] gap-4 order-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              Carrinho <Badge variant="secondary">{cart.length} itens</Badge>
            </h3>
            
            {/* Seletor de Destino */}
            {!isEntry && (
              <div className="w-full md:w-64">
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="h-10 border-red-200 bg-red-50/50">
                    <SelectValue placeholder="Selecione o Destino..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-[200px]">
            {cart.length === 0 ? (
              <div className="h-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                <Package className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Toque nos produtos para adicionar</p>
              </div>
            ) : (
              cart.map((item) => {
                const finalStock = isEntry 
                  ? Number(item.current_stock) + Number(item.quantity) 
                  : Number(item.current_stock) - Number(item.quantity);

                return (
                  <Card key={item.product_id} className={`overflow-hidden transition-all ${isEntry ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'}`}>
                    <div className="p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                      {/* Icone e Nome */}
                      <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${themeClass}`}>
                            <Package className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm truncate">{item.name}</h4>
                            <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                          </div>
                          {/* Botão Remover (Mobile: Fica na direita) */}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500 sm:hidden" onClick={() => removeFromCart(item.product_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center justify-between w-full sm:w-auto gap-4 mt-2 sm:mt-0">
                         <div className="text-center hidden sm:block">
                           <span className="text-[10px] text-muted-foreground block">Atual</span>
                           <span className="font-semibold text-sm">{item.current_stock}</span>
                         </div>
                         
                         <div className={`flex items-center gap-1 px-3 py-1 rounded-md ${bgClass} border ${borderClass} flex-1 sm:flex-none justify-center`}>
                           <span className={`text-sm font-bold ${themeClass} mr-1`}>{isEntry ? "+" : "-"}</span>
                           <Input 
                             type="number"
                             inputMode="decimal"
                             className={`h-8 w-20 text-center font-bold bg-transparent border-none focus-visible:ring-0 p-0 ${themeClass} text-lg`}
                             value={item.quantity}
                             onChange={(e) => updateQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                           />
                         </div>

                         <div className="text-center hidden sm:block">
                           <span className="text-[10px] text-muted-foreground block">Novo</span>
                           <span className="font-bold text-sm">{finalStock}</span>
                         </div>

                         {/* Botão Remover (Desktop) */}
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500 hidden sm:inline-flex" onClick={() => removeFromCart(item.product_id)}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA 3: RESUMO (No mobile fica no final) */}
        <Card className="lg:col-span-3 flex flex-col h-fit lg:sticky lg:top-4 border-muted-foreground/20 shadow-md order-3 mb-6 lg:mb-0">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-base flex items-center gap-2">
              Resumo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-2 rounded-lg text-center">
                <span className="text-xs text-muted-foreground block mb-1">Itens</span>
                <span className="text-xl font-bold">{cart.length}</span>
              </div>
              <div className={`p-2 rounded-lg text-center ${bgClass} border ${borderClass}`}>
                <span className={`text-xs block mb-1 ${themeClass}`}>Total Qtd.</span>
                <span className={`text-xl font-bold ${themeClass}`}>
                  {isEntry ? "+" : "-"}{cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-md flex items-start gap-3 ${cart.length > 0 ? "bg-green-50 text-green-800" : "bg-muted text-muted-foreground"}`}>
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-xs leading-tight">
                {cart.length > 0 ? "Pronto para confirmar." : "Adicione itens..."}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 p-4 pt-0">
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
              Cancelar
            </Button>
          </CardFooter>
        </Card>

      </div>
    </div>
  );
}
