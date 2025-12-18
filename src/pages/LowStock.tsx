import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, Eye, Search, X, Filter, Users, Megaphone, CalendarClock, Truck, AlertOctagon,
  Download, FileSpreadsheet, FileText
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

export default function LowStock() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // --- ESTADOS ---
  const [noteDialogItem, setNoteDialogItem] = useState<any>(null);
  const [tempNote, setTempNote] = useState("");
  const [tempDate, setTempDate] = useState(""); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Filtros
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // --- CORREÇÃO DE PERMISSÃO ---
  const canEdit = profile?.role === "compras" || profile?.role === "admin";

  // 1. BUSCAR DADOS
  const { data: lowStockItems, isLoading } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const response = await api.get("/products/low-stock");
      return response.data;
    },
  });

  // 2. MUTAÇÃO: ATUALIZAR TUDO
  const updateInfoMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; note: string; date?: string | null }) => {
      await api.put(`/products/${data.id}/purchase-info`, {
        purchase_status: data.status,
        purchase_note: data.note,
        delivery_forecast: data.date
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: () => toast.error("Erro ao atualizar item."),
  });

  // --- FILTRAGEM ---
  const filteredItems = useMemo(() => {
    if (!lowStockItems) return [];
    
    return lowStockItems.filter((item: any) => {
      const matchesSearch = 
        searchTerm === "" ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());

      const itemStatus = item.purchase_status || "pendente";
      const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;

      const matchesVendor = 
        vendorFilter === "" || 
        (item.purchase_note && item.purchase_note.toLowerCase().includes(vendorFilter.toLowerCase()));

      const matchesCategory = 
        categoryFilter === "" ||
        (item.description && item.description.toLowerCase().includes(categoryFilter.toLowerCase())) ||
        item.name.toLowerCase().includes(categoryFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesVendor && matchesCategory;
    });
  }, [lowStockItems, searchTerm, statusFilter, vendorFilter, categoryFilter]);

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (vendorFilter ? 1 : 0) + (categoryFilter ? 1 : 0);

  // --- NOVA FUNÇÃO DE EXPORTAÇÃO ---
  const handleExportReport = (type: 'pdf' | 'excel') => {
    const itemsToExport = selectedItems.length > 0 
        ? lowStockItems.filter((i: any) => selectedItems.includes(i.id))
        : filteredItems;

    if (!itemsToExport || itemsToExport.length === 0) {
        toast.error("Nada para exportar");
        return;
    }

    const exportData = itemsToExport.map((item: any) => ({
        SKU: item.sku,
        Produto: item.name,
        "Estoque Atual": item.disponivel,
        "Mínimo": item.min_stock,
        "Status": (item.purchase_status || "pendente").toUpperCase(),
        "Previsão": item.delivery_forecast ? format(new Date(item.delivery_forecast), "dd/MM/yyyy") : "-",
        "Obs": item.purchase_note || ""
    }));

    if (type === 'excel') {
        exportToExcel(exportData, "Relatorio_Compras");
        toast.success("Excel baixado!");
    } else {
        const columns = [
            { header: "SKU", dataKey: "SKU" },
            { header: "Produto", dataKey: "Produto" },
            { header: "Estoque", dataKey: "Estoque Atual" },
            { header: "Mínimo", dataKey: "Mínimo" },
            { header: "Status", dataKey: "Status" },
            { header: "Previsão", dataKey: "Previsão" },
        ];
        exportToPDF("Relatório de Compras / Estoque Crítico", columns, exportData, "Relatorio_Compras_PDF");
        toast.success("PDF gerado!");
    }
    
    setSelectedItems([]);
  };

  // --- HANDLERS ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredItems.map((item: any) => item.id);
      setSelectedItems(allIds);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, id]);
    } else {
      setSelectedItems((prev) => prev.filter((itemId) => itemId !== id));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedItems.length === 0) return;
    const promise = Promise.all(
      selectedItems.map((id) => {
        const originalItem = lowStockItems.find((i: any) => i.id === id);
        return updateInfoMutation.mutateAsync({
          id,
          status: newStatus,
          note: originalItem?.purchase_note || "",
          date: originalItem?.delivery_forecast
        });
      })
    );
    toast.promise(promise, {
      loading: 'Atualizando...',
      success: () => { setSelectedItems([]); return 'Itens atualizados com sucesso!'; },
      error: 'Erro na atualização',
    });
  };

  const handleStatusChange = (item: any, newStatus: string) => {
    const shouldKeepDate = (newStatus === 'comprado' || newStatus === 'cotacao') && item.delivery_forecast;
    updateInfoMutation.mutate({ 
      id: item.id, 
      status: newStatus, 
      note: item.purchase_note || "",
      date: shouldKeepDate ? item.delivery_forecast : null 
    }, { onSuccess: () => toast.success("Status atualizado!") });
  };

  const openNoteDialog = (item: any) => {
    setNoteDialogItem(item);
    setTempNote(item.purchase_note || "");
    setTempDate(item.delivery_forecast ? item.delivery_forecast.toString().split('T')[0] : "");
  };

  const handleSaveDialog = () => {
    if (noteDialogItem) {
      let statusToSave = noteDialogItem.purchase_status || "pendente";
      if (tempDate && statusToSave === "pendente") {
        statusToSave = "comprado";
      }

      updateInfoMutation.mutate({
        id: noteDialogItem.id,
        status: statusToSave,
        note: tempNote,
        date: tempDate || null
      }, { 
        onSuccess: () => { 
          toast.success("Informações salvas!"); 
          setNoteDialogItem(null); 
        } 
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "comprado": return "text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "cotacao": return "text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "nao_comprado": return "text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default: return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
    }
  };

  const renderDeliveryDate = (dateString: any) => {
    if (!dateString) return <span className="text-muted-foreground text-xs">-</span>;
    try {
      const date = new Date(dateString);
      const userDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      if (isNaN(userDate.getTime())) return <span className="text-muted-foreground text-xs">-</span>;
      const isLate = isPast(userDate) && !isToday(userDate);
      return (
        <div className={`flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-md border w-fit mx-auto ${isLate ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"}`}>
          <CalendarClock className="h-3 w-3" />
          {format(userDate, "dd/MM")}
          {isLate && <span className="font-bold ml-1">!</span>}
        </div>
      );
    } catch (e) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Progresso de Compras
          </h1>
          <p className="text-muted-foreground">Gestão inteligente de reposição, cotações e prazos.</p>
        </div>
        
        {/* --- BOTÃO DE EXPORTAÇÃO --- */}
        {selectedItems.length === 0 && (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-dashed border-slate-300 dark:border-slate-700 dark:text-slate-300">
                <Download className="h-4 w-4" />
                Baixar Relatório
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:bg-slate-900 dark:border-slate-800">
                <DropdownMenuItem onClick={() => handleExportReport('excel')} className="gap-2 cursor-pointer dark:focus:bg-slate-800">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Baixar Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReport('pdf')} className="gap-2 cursor-pointer dark:focus:bg-slate-800">
                <FileText className="h-4 w-4 text-red-600" />
                Baixar PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        )}
      </div>

      {/* FERRAMENTAS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Pesquisar por Nome ou SKU..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          />
        </div>

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant={activeFiltersCount > 0 ? "secondary" : "outline"} className={`gap-2 shrink-0 ${activeFiltersCount === 0 ? "dark:bg-slate-900 dark:border-slate-700" : ""}`}>
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary text-primary-foreground">{activeFiltersCount}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 shadow-xl dark:bg-slate-900 dark:border-slate-800" align="end">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium leading-none dark:text-slate-200">Filtros Avançados</h4>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary" onClick={() => { setStatusFilter("all"); setVendorFilter(""); setCategoryFilter(""); }}>
                  Limpar
                </Button>
              </div>
              <Separator className="dark:bg-slate-800" />
              <div className="space-y-2">
                <Label className="text-xs font-semibold dark:text-slate-300">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 dark:bg-slate-800 dark:border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">🔴 Pendente</SelectItem>
                    <SelectItem value="cotacao">🔵 Em Cotação</SelectItem>
                    <SelectItem value="comprado">🟢 Comprado</SelectItem>
                    <SelectItem value="nao_comprado">⚫ Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold dark:text-slate-300">Fornecedor (Aviso)</Label>
                <Input placeholder="Ex: Weg..." value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="h-8 dark:bg-slate-800 dark:border-slate-700" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold dark:text-slate-300">Categoria</Label>
                <Input placeholder="Ex: Elétrica..." value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-8 dark:bg-slate-800 dark:border-slate-700" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* TABELA */}
      <div className="border rounded-lg bg-card border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
            <TableRow className="border-slate-200 dark:border-slate-800">
              <TableHead className="w-[40px] text-center">
                <Checkbox 
                  checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  className="dark:border-slate-500 dark:data-[state=checked]:bg-primary"
                />
              </TableHead>
              <TableHead className="dark:text-slate-300">Produto</TableHead>
              <TableHead className="dark:text-slate-300">Estoque / Mín</TableHead>
              <TableHead className="dark:text-slate-300">Déficit</TableHead>
              <TableHead className="dark:text-slate-300">Tempo Crítico</TableHead>
              <TableHead className="dark:text-slate-300">Demanda</TableHead>
              <TableHead className="dark:text-slate-300">Status</TableHead>
              <TableHead className="text-center dark:text-slate-300">Previsão</TableHead>
              <TableHead className="text-center dark:text-slate-300">Gestão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center h-24 dark:text-slate-400">Carregando...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
            ) : (
              filteredItems.map((item: any) => {
                const deficit = item.min_stock - item.disponivel;
                const isSelected = selectedItems.includes(item.id);
                const demandaSetores = Number(item.demanda_reprimida || 0);

                return (
                  <TableRow key={item.id} className={`transition-colors border-slate-100 dark:border-slate-800 ${isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}>
                    <TableCell className="text-center">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)} className="dark:border-slate-500 dark:data-[state=checked]:bg-primary" />
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-slate-900 dark:text-slate-200">{item.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                        {item.disponivel} / {item.min_stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-red-600 dark:text-red-400">+{deficit > 0 ? deficit : 0}</TableCell>
                    
                    {/* INDICADOR DE TEMPO CRÍTICO */}
                    <TableCell>
                      {item.critical_since ? (
                        (() => {
                          const days = differenceInDays(new Date(), new Date(item.critical_since));
                          return (
                            <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full w-fit ${
                              days > 7 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" : 
                              days > 3 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800" : 
                              "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                            }`}>
                              <AlertOctagon className="w-3 h-3" />
                              {days === 0 ? "Hoje" : `${days} dias`}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {demandaSetores > 0 ? (
                        <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 gap-1 border-transparent">
                          <Users className="h-3 w-3" /> +{demandaSetores}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Select 
                        value={item.purchase_status || "pendente"} 
                        onValueChange={(val) => handleStatusChange(item, val)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={`w-[140px] h-8 focus:ring-0 shadow-none border ${getStatusColor(item.purchase_status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                          <SelectItem value="pendente">🔴 Pendente</SelectItem>
                          <SelectItem value="cotacao">🔵 Em Cotação</SelectItem>
                          <SelectItem value="comprado">🟢 Comprado</SelectItem>
                          <SelectItem value="nao_comprado">⚫ Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-center">
                      {renderDeliveryDate(item.delivery_forecast)}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={item.purchase_note || item.delivery_forecast ? "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30" : "text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"}
                        onClick={() => openNoteDialog(item)}
                        title="Editar detalhes e prazo"
                      >
                        {!canEdit && (item.purchase_note || item.delivery_forecast) ? <Eye className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* BARRA FLUTUANTE DE AÇÕES */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-popover dark:bg-slate-900 border border-border/50 dark:border-slate-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3 border-r dark:border-slate-700 pr-4 mr-2">
            <Badge variant="secondary" className="rounded-full px-2 bg-primary text-primary-foreground">{selectedItems.length}</Badge>
            <span className="text-sm font-medium whitespace-nowrap dark:text-slate-200">Selecionados</span>
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('cotacao')} className="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50">
                Em Cotação
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('comprado')} className="text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50">
                Comprado
              </Button>
            </div>
          )}

          {/* EXPORTAR SELECIONADOS */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                <Download className="h-4 w-4" />
                Exportar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="dark:bg-slate-900 dark:border-slate-800">
                <DropdownMenuItem onClick={() => handleExportReport('excel')} className="gap-2 cursor-pointer dark:focus:bg-slate-800">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReport('pdf')} className="gap-2 cursor-pointer dark:focus:bg-slate-800">
                <FileText className="h-4 w-4 text-red-600" /> PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="border-l pl-2 ml-2 dark:border-slate-700">
            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-muted dark:hover:bg-slate-800 dark:text-slate-400" onClick={() => setSelectedItems([])}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* DIALOG DE DETALHES */}
      <Dialog open={!!noteDialogItem} onOpenChange={(open) => !open && setNoteDialogItem(null)}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">{canEdit ? "Gerenciar Compra" : "Detalhes da Compra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/30 dark:bg-slate-800 p-3 rounded-md">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Produto</p>
              <p className="text-sm font-medium dark:text-slate-200">{noteDialogItem?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{noteDialogItem?.sku}</p>
              {noteDialogItem?.demanda_reprimida > 0 && (
                <div className="mt-2 flex items-center gap-2 text-orange-600 dark:text-orange-400 text-xs font-bold bg-orange-50 dark:bg-orange-900/20 p-1 rounded border border-orange-100 dark:border-orange-900">
                  <Megaphone className="h-3 w-3" />
                  {noteDialogItem.demanda_reprimida} unidades solicitadas em aberto!
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold dark:text-slate-300">Previsão de Entrega</Label>
                <Input 
                  type="date" 
                  value={tempDate} 
                  onChange={(e) => setTempDate(e.target.value)} 
                  disabled={!canEdit}
                  className={`dark:bg-slate-800 dark:border-slate-700 ${tempDate && new Date(tempDate) < new Date(new Date().setHours(0,0,0,0)) ? "border-red-300 text-red-600 dark:text-red-400 font-medium" : ""}`}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold dark:text-slate-300">Status Sugerido</Label>
                <div className="text-xs pt-3 text-muted-foreground">
                  {tempDate && noteDialogItem?.purchase_status === 'pendente' ? "Mudará p/ Comprado" : "Mantém atual"}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="note" className="text-xs font-semibold dark:text-slate-300">Observações / Fornecedor</Label>
              <Textarea 
                id="note"
                placeholder={canEdit ? "Ex: Comprado na Loja X, NF 123..." : "Nenhum detalhe registrado."}
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                rows={4}
                readOnly={!canEdit}
                className="resize-none dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNoteDialogItem(null)} className="dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Cancelar</Button>
              {canEdit && <Button onClick={handleSaveDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar Alterações</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}