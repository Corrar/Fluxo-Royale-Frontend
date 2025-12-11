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
  ShoppingCart, MessageSquareText, Eye, Search, X, FileJson, Filter, Users, Megaphone, CalendarClock, Truck 
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format, isPast, isToday } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export default function LowStock() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // --- ESTADOS ---
  const [noteDialogItem, setNoteDialogItem] = useState<any>(null);
  const [tempNote, setTempNote] = useState("");
  const [tempDate, setTempDate] = useState(""); // Estado para a data no modal
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Filtros
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const canEdit = profile?.role === "compras" || profile?.role === "admin" || profile?.role === "almoxarife";

  // 1. BUSCAR DADOS
  const { data: lowStockItems, isLoading } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const response = await api.get("/products/low-stock");
      return response.data;
    },
  });

  // 2. MUTAÇÃO: ATUALIZAR TUDO (STATUS, NOTA, DATA)
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

  // 3. EXPORTAÇÃO
  const exportMutation = useMutation({
    mutationFn: async () => {
      const itemsToExport = selectedItems.length > 0 
        ? lowStockItems.filter((i: any) => selectedItems.includes(i.id))
        : filteredItems;

      if (!itemsToExport || itemsToExport.length === 0) throw new Error("Nada para exportar");

      const exportData = itemsToExport.map((item: any) => ({
        SKU: item.sku,
        Produto: item.name,
        "Estoque Atual": item.disponivel,
        "Mínimo": item.min_stock,
        "Demanda Setores": item.demanda_reprimida || 0,
        "Status": item.purchase_status || "pendente",
        "Previsão Entrega": item.delivery_forecast ? format(new Date(item.delivery_forecast), "dd/MM/yyyy") : "N/A",
        "Aviso/Obs": item.purchase_note || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Compras");
      XLSX.writeFile(wb, `Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
    },
    onSuccess: () => {
      toast.success("Download iniciado!");
      setSelectedItems([]);
    },
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

  // MUDANÇA DE STATUS EM MASSA (Restaurado)
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedItems.length === 0) return;
    const promise = Promise.all(
      selectedItems.map((id) => {
        const originalItem = lowStockItems.find((i: any) => i.id === id);
        // Mantém a data se já existir, para não apagar ao mudar status em massa
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
    // Lógica inteligente: Se mudar para Comprado, mantém a data. Se sair de Comprado, limpa a data.
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
    // Corta a string ISO para pegar apenas YYYY-MM-DD para o input type="date"
    setTempDate(item.delivery_forecast ? item.delivery_forecast.toString().split('T')[0] : "");
  };

  const handleSaveDialog = () => {
    if (noteDialogItem) {
      // Se usuário definiu data e status é pendente, muda automaticamente para comprado
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
      case "comprado": return "text-green-600 font-bold bg-green-50";
      case "cotacao": return "text-blue-600 font-bold bg-blue-50";
      case "nao_comprado": return "text-red-600 font-bold bg-red-50";
      default: return "text-yellow-600 bg-yellow-50";
    }
  };

  // Função robusta para renderizar data
  const renderDeliveryDate = (dateString: any) => {
    if (!dateString) return <span className="text-muted-foreground text-xs">-</span>;
    
    try {
      const date = new Date(dateString);
      // Ajuste de fuso horário para garantir que o dia mostrado é o dia selecionado
      const userDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      
      // Verifica se é inválido
      if (isNaN(userDate.getTime())) return <span className="text-muted-foreground text-xs">-</span>;

      const isLate = isPast(userDate) && !isToday(userDate);
      
      return (
        <div className={`flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-md border w-fit mx-auto ${isLate ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
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
    <div className="space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Progresso de Compras
          </h1>
          <p className="text-muted-foreground">Gestão inteligente de reposição, cotações e prazos.</p>
        </div>
        {selectedItems.length === 0 && (
          <Button onClick={() => exportMutation.mutate()} variant="outline" className="border-primary text-primary hover:bg-primary/10">
            <FileJson className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
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
            className="pl-10"
          />
        </div>

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant={activeFiltersCount > 0 ? "secondary" : "outline"} className="gap-2 shrink-0">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-primary text-white">{activeFiltersCount}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 shadow-xl" align="end">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium leading-none">Filtros Avançados</h4>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary" onClick={() => { setStatusFilter("all"); setVendorFilter(""); setCategoryFilter(""); }}>
                  Limpar
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">🔴 Pendente</SelectItem>
                    <SelectItem value="cotacao">🔵 Em Cotação</SelectItem>
                    <SelectItem value="comprado">🟢 Comprado</SelectItem>
                    <SelectItem value="nao_comprado">⚫ Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Fornecedor (Aviso)</Label>
                <Input placeholder="Ex: Weg..." value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Input placeholder="Ex: Elétrica..." value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-8" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* TABELA */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[40px] text-center">
                <Checkbox 
                  checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Estoque / Mín</TableHead>
              <TableHead>Déficit</TableHead>
              <TableHead>Demanda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Previsão</TableHead>
              <TableHead className="text-center">Gestão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24">Carregando...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
            ) : (
              filteredItems.map((item: any) => {
                const deficit = item.min_stock - item.disponivel;
                const isSelected = selectedItems.includes(item.id);
                const demandaSetores = Number(item.demanda_reprimida || 0);

                return (
                  <TableRow key={item.id} className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"}`}>
                    <TableCell className="text-center">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)} />
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600">
                        {item.disponivel} / {item.min_stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-red-600">+{deficit > 0 ? deficit : 0}</TableCell>
                    
                    {/* Demanda Real */}
                    <TableCell>
                      {demandaSetores > 0 ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200 gap-1">
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
                        <SelectTrigger className={`w-[140px] h-8 border-transparent focus:ring-0 shadow-none ${getStatusColor(item.purchase_status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">🔴 Pendente</SelectItem>
                          <SelectItem value="cotacao">🔵 Em Cotação</SelectItem>
                          <SelectItem value="comprado">🟢 Comprado</SelectItem>
                          <SelectItem value="nao_comprado">⚫ Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Coluna de Previsão */}
                    <TableCell className="text-center">
                      {renderDeliveryDate(item.delivery_forecast)}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={item.purchase_note || item.delivery_forecast ? "text-blue-600 hover:bg-blue-50" : "text-muted-foreground hover:bg-muted"}
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

      {/* BARRA FLUTUANTE DE AÇÕES (RESTAURADA COMPLETA) */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-popover border border-border/50 shadow-2xl rounded-full px-6 py-3 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3 border-r pr-4 mr-2">
            <Badge variant="secondary" className="rounded-full px-2 bg-primary text-primary-foreground">{selectedItems.length}</Badge>
            <span className="text-sm font-medium whitespace-nowrap">Selecionados</span>
          </div>
          
          {/* BOTÕES DE STATUS EM MASSA */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('cotacao')} className="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200">
                Em Cotação
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('comprado')} className="text-green-700 bg-green-50 hover:bg-green-100 border border-green-200">
                Comprado
              </Button>
            </div>
          )}

          <Button size="sm" variant="outline" onClick={() => exportMutation.mutate()}>
            <FileJson className="h-4 w-4 mr-2" /> Exportar
          </Button>
          
          <div className="border-l pl-2 ml-2">
            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 hover:bg-muted" onClick={() => setSelectedItems([])}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* DIALOG DE DETALHES */}
      <Dialog open={!!noteDialogItem} onOpenChange={(open) => !open && setNoteDialogItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{canEdit ? "Gerenciar Compra" : "Detalhes da Compra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Produto</p>
              <p className="text-sm font-medium">{noteDialogItem?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{noteDialogItem?.sku}</p>
              {noteDialogItem?.demanda_reprimida > 0 && (
                <div className="mt-2 flex items-center gap-2 text-orange-600 text-xs font-bold bg-orange-50 p-1 rounded border border-orange-100">
                  <Megaphone className="h-3 w-3" />
                  {noteDialogItem.demanda_reprimida} unidades solicitadas em aberto!
                </div>
              )}
            </div>

            {/* SELETOR DE DATA DE PREVISÃO */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Previsão de Entrega</Label>
                <Input 
                  type="date" 
                  value={tempDate} 
                  onChange={(e) => setTempDate(e.target.value)} 
                  disabled={!canEdit}
                  className={tempDate && new Date(tempDate) < new Date(new Date().setHours(0,0,0,0)) ? "border-red-300 text-red-600 font-medium" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Status Sugerido</Label>
                <div className="text-xs pt-3 text-muted-foreground">
                  {tempDate && noteDialogItem?.purchase_status === 'pendente' ? "Mudará p/ Comprado" : "Mantém atual"}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="note" className="text-xs font-semibold">Observações / Fornecedor</Label>
              <Textarea 
                id="note"
                placeholder={canEdit ? "Ex: Comprado na Loja X, NF 123..." : "Nenhum detalhe registrado."}
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                rows={4}
                readOnly={!canEdit}
                className="resize-none"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNoteDialogItem(null)}>Cancelar</Button>
              {canEdit && <Button onClick={handleSaveDialog}>Salvar Alterações</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}