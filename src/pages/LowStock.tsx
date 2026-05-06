import { useState, useMemo, useEffect, useRef } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingCart, Eye, Search, X, Filter, CalendarClock, Truck, AlertOctagon,
  Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, 
  Copy, CheckCircle2, TrendingDown, Clock, Activity, TrendingUp,
  BrainCircuit, Target, MessageCircle, Mail, Calculator, Send, LayoutDashboard, ListTodo, Wrench,
  ArrowRight, PackageX, FileEdit // <-- Correção: Ícones adicionados aqui
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, differenceInDays, isBefore, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export interface ProductItem {
  id: string;
  name: string;
  sku: string;
  quantity: number | string;
  quantity_reserved: number | string;
  min_stock: number | string;
  purchase_status?: string;
  purchase_note?: string;
  delivery_forecast?: string | null;
  critical_since?: string | null;
  description?: string;
  unit?: string;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  customBadge?: React.ReactNode;
}

const KPICard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, customBadge }: KPICardProps) => (
  <Card className="gsap-element relative overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all duration-500 bg-card group rounded-2xl">
      <div className={`absolute -right-6 -top-6 p-10 rounded-full opacity-[0.03] dark:opacity-[0.05] transition-transform group-hover:scale-[1.15] group-hover:rotate-12 duration-1000 ease-out ${colorClass}`}>
          <Icon className="w-32 h-32" />
      </div>
      <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-xl border border-border/40 ${bgClass} ${colorClass}`}>
                  <Icon className="w-5 h-5" />
              </div>
              {customBadge}
          </div>
          <div className="flex-1 flex flex-col justify-end">
              <h3 className="text-3xl font-bold text-foreground tracking-tight truncate">{value}</h3>
              <p className="text-sm font-semibold text-muted-foreground mt-1 truncate">{title}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1 font-medium flex items-center gap-1.5 truncate">
                  {subtext}
              </p>
          </div>
      </CardContent>
  </Card>
);

export default function LowStock() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState("dashboard"); 
  
  const [noteDialogItem, setNoteDialogItem] = useState<ProductItem | null>(null);
  const [tempNote, setTempNote] = useState("");
  const [tempDate, setTempDate] = useState(""); 
  const [tempPrice, setTempPrice] = useState<string>(""); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all"); 
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const canEdit = profile?.role === "compras" || profile?.role === "admin" || profile?.role === "gerente";

  const { data: lowStockItems, isLoading } = useQuery<ProductItem[]>({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const response = await api.get("/products/low-stock");
      return response.data;
    },
    refetchInterval: 60000,
  });

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

  useGSAP(() => {
    if (!isLoading) {
        gsap.from(".gsap-element", { 
            y: 15, 
            opacity: 0, 
            duration: 0.5, 
            stagger: 0.05, 
            ease: "power2.out", 
            clearProps: "all" 
        });
    }
  }, { scope: containerRef, dependencies: [isLoading, activeTab] });

  useEffect(() => {
    if (lowStockItems && lowStockItems.length > 0 && !isCleaning) {
      const itemsToReset = lowStockItems.filter((item) => {
        if (item.purchase_status !== 'pendente' && item.delivery_forecast && item.critical_since) {
          try {
            const forecastDate = parseISO(item.delivery_forecast);
            const criticalDate = parseISO(item.critical_since);
            return isBefore(forecastDate, criticalDate);
          } catch (e) { return false; }
        }
        return false;
      });

      if (itemsToReset.length > 0) {
        setIsCleaning(true);
        Promise.all(itemsToReset.map((item) => 
          updateInfoMutation.mutateAsync({ id: item.id, status: "pendente", note: "", date: null })
        )).then(() => {
          toast.info(`${itemsToReset.length} itens tiveram dados de compra antigos resetados.`);
          setIsCleaning(false);
        }).catch(() => setIsCleaning(false));
      }
    }
  }, [lowStockItems]);

  const filteredItems = useMemo(() => {
    if (!lowStockItems) return [];
    return lowStockItems.filter((item) => {
      const minStock = Number(item.min_stock || 0);
      const currentQty = Number(item.quantity || 0);
      const reservedQty = Number(item.quantity_reserved || 0);
      const disponivel = currentQty - reservedQty;

      if (disponivel > minStock) return false; 

      const itemStatus = item.purchase_status || "pendente";
      const criticalDate = item.critical_since ? new Date(item.critical_since) : new Date();
      const days = differenceInDays(new Date(), criticalDate);

      if (quickFilter === "critical" && days < 30) return false;
      if (quickFilter === "pending" && itemStatus !== "pendente") return false;
      if (quickFilter === "progress" && (itemStatus !== "cotacao" && itemStatus !== "comprado")) return false;

      const matchesSearch = searchTerm === "" || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;
      const matchesVendor = vendorFilter === "" || (item.purchase_note && item.purchase_note.toLowerCase().includes(vendorFilter.toLowerCase()));
      const matchesCategory = categoryFilter === "" || (item.description && item.description.toLowerCase().includes(categoryFilter.toLowerCase())) || item.name.toLowerCase().includes(categoryFilter.toLowerCase());

      const matchesUrgency = 
        urgencyFilter === "all" || 
        (urgencyFilter === "30" && days >= 30) ||
        (urgencyFilter === "15" && days >= 15 && days < 30) ||
        (urgencyFilter === "recent" && days < 15);

      return matchesSearch && matchesStatus && matchesVendor && matchesCategory && matchesUrgency;
    });
  }, [lowStockItems, searchTerm, statusFilter, vendorFilter, categoryFilter, urgencyFilter, quickFilter]);

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (vendorFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (urgencyFilter !== "all" ? 1 : 0);

  const kpis = useMemo(() => {
      if (!filteredItems) return { total: 0, deficit: 0, urgent: 0, progress: 0 };
      const total = filteredItems.length;
      let deficit = 0;
      let urgent = 0;
      let inProgress = 0;

      filteredItems.forEach((i) => {
          const m = Number(i.min_stock || 0);
          const q = Number(i.quantity || 0) - Number(i.quantity_reserved || 0);
          deficit += (m - q);
          const days = differenceInDays(new Date(), i.critical_since ? new Date(i.critical_since) : new Date());
          if (days >= 30 && (i.purchase_status === 'pendente' || !i.purchase_status)) urgent++;
          if (i.purchase_status === 'cotacao' || i.purchase_status === 'comprado') inProgress++;
      });
      return { total, deficit, urgent, progress: total > 0 ? Math.round((inProgress / total) * 100) : 0 };
  }, [filteredItems]);

  const smartInsights = useMemo(() => {
    if (!filteredItems || filteredItems.length === 0) return [];
    const insights = [];
    if (kpis.urgent > 0) {
      insights.push({ icon: TriangleAlert, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", text: `Foco Imediato: Você tem ${kpis.urgent} itens parados no vermelho há mais de 30 dias. Priorize o contato com esses fornecedores hoje.` });
    }
    const pendentes = filteredItems.filter(i => !i.purchase_status || i.purchase_status === 'pendente').length;
    if (pendentes > (filteredItems.length / 2)) {
      insights.push({ icon: Target, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", text: `Oportunidade de Lote: ${pendentes} itens estão sem ação. Selecione vários itens na tabela e use o botão "Em Cotação" para processar em massa.` });
    } else if (kpis.progress > 50) {
      insights.push({ icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", text: `Ótimo trabalho! O setor de compras já encaminhou ${kpis.progress}% das necessidades de estoque.` });
    }
    return insights;
  }, [filteredItems, kpis]);

  const generateQuoteText = (item: ProductItem, deficit: number) => {
    const margemSeguranca = Math.ceil(deficit * 1.2);
    return `Olá! Gostaria de solicitar uma cotação.\n\n*Produto:* ${item.name}\n*SKU:* ${item.sku}\n*Quantidade:* ${margemSeguranca} ${item.unit || 'un'}\n\nFico a aguardar as condições e prazo de entrega. Obrigado!`;
  };

  const handleCommunicate = (method: 'copy' | 'whatsapp' | 'email', item: ProductItem, deficit: number) => {
      const text = generateQuoteText(item, deficit);
      
      if (method === 'copy') {
          navigator.clipboard.writeText(text);
          toast.success("Texto copiado para a área de transferência!");
      } else if (method === 'whatsapp') {
          const encodedText = encodeURIComponent(text);
          window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      } else if (method === 'email') {
          const encodedSubject = encodeURIComponent(`Cotação: ${item.name}`);
          const encodedBody = encodeURIComponent(text);
          window.open(`mailto:?subject=${encodedSubject}&body=${encodedBody}`);
      }
  };

  const handleExportReport = (type: 'pdf' | 'excel') => {
    const itemsToExport = selectedItems.length > 0 ? filteredItems.filter((i) => selectedItems.includes(i.id)) : filteredItems;
    if (!itemsToExport || itemsToExport.length === 0) return toast.error("Nenhum item válido para exportar.");

    const exportData = itemsToExport.map((item) => {
        const minStock = Number(item.min_stock || 0);
        const disponivel = Number(item.quantity || 0) - Number(item.quantity_reserved || 0);
        const deficit = minStock - disponivel;
        return {
            SKU: item.sku, Produto: item.name, "Estoque Disp.": disponivel, "Mínimo": minStock,
            "Déficit": deficit, "Sugerido Compra": Math.ceil(deficit * 1.2), "Status": (item.purchase_status || "pendente").toUpperCase(),
            "Previsão": item.delivery_forecast ? format(new Date(item.delivery_forecast), "dd/MM/yyyy") : "-",
            "Obs": item.purchase_note || ""
        };
    });

    if (type === 'excel') {
        exportToExcel(exportData, "Painel_Compras_Inteligente");
        toast.success("Excel gerado com sucesso!");
    } else {
        const columns = [ { header: "SKU", dataKey: "SKU" }, { header: "Produto", dataKey: "Produto" }, { header: "Faltam", dataKey: "Déficit" }, { header: "Sugerido", dataKey: "Sugerido Compra" }, { header: "Status", dataKey: "Status" } ];
        exportToPDF("Relatório Inteligente de Compras", columns, exportData, "Relatorio_Compras_PDF");
        toast.success("PDF gerado com sucesso!");
    }
    setSelectedItems([]);
  };

  const handleSelectAll = (checked: boolean) => checked ? setSelectedItems(filteredItems.map((i) => i.id)) : setSelectedItems([]);
  const handleSelectItem = (id: string, checked: boolean) => checked ? setSelectedItems(p => [...p, id]) : setSelectedItems(p => p.filter(i => i !== id));

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedItems.length === 0 || !lowStockItems) return;
    const promise = Promise.all(
      selectedItems.map((id) => {
        const originalItem = lowStockItems.find((i) => i.id === id);
        const isResetting = newStatus === 'pendente';
        return updateInfoMutation.mutateAsync({ id, status: newStatus, note: isResetting ? "" : (originalItem?.purchase_note || ""), date: isResetting ? null : originalItem?.delivery_forecast });
      })
    );
    toast.promise(promise, { loading: 'Processando lote...', success: () => { setSelectedItems([]); return 'Lote atualizado!'; }, error: 'Erro na atualização' });
  };

  const handleStatusChange = (item: ProductItem, newStatus: string) => {
    const isResetting = newStatus === 'pendente';
    const shouldKeepDate = !isResetting && (newStatus === 'comprado' || newStatus === 'cotacao') && item.delivery_forecast;
    updateInfoMutation.mutate({ id: item.id, status: newStatus, note: isResetting ? "" : (item.purchase_note || ""), date: shouldKeepDate ? item.delivery_forecast : null }, { onSuccess: () => toast.success("Status de compra alterado.") });
  };

  const openNoteDialog = (item: ProductItem) => {
    setNoteDialogItem(item);
    setTempNote(item.purchase_note || "");
    setTempDate(item.delivery_forecast ? item.delivery_forecast.split('T')[0] : "");
    setTempPrice(""); 
  };

  const handleSaveDialog = () => {
    if (noteDialogItem) {
      let statusToSave = noteDialogItem.purchase_status || "pendente";
      if (tempDate && statusToSave === "pendente") statusToSave = "comprado";
      updateInfoMutation.mutate({ id: noteDialogItem.id, status: statusToSave, note: tempNote, date: tempDate || null }, { onSuccess: () => { toast.success("Gerenciamento salvo!"); setNoteDialogItem(null); } });
    }
  };

  // --- RENDERS DE ESTADO LIMPOS ---
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "comprado": return "text-emerald-700 bg-emerald-50 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 shadow-sm";
      case "cotacao": return "text-blue-700 bg-blue-50 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 shadow-sm";
      case "nao_comprado": return "text-slate-600 bg-muted/50 border-border/50 dark:text-slate-400";
      default: return "text-rose-700 bg-rose-50 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 shadow-sm";
    }
  };

  const renderDeliveryDate = (dateString?: string | null) => {
    if (!dateString) return <span className="text-muted-foreground font-medium text-xs">-</span>;
    try {
      const date = new Date(dateString);
      const userDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      if (isNaN(userDate.getTime())) return <span className="text-muted-foreground font-medium text-xs">-</span>;
      
      const isLate = isPast(userDate) && !isToday(userDate);
      return (
        <div className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded border w-fit mx-auto transition-colors ${
            isLate 
            ? "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" 
            : "bg-muted/50 text-foreground border-border/50"
        }`}>
          <CalendarClock className="h-3 w-3 opacity-70" />
          {format(userDate, "dd/MM")}
          {isLate && <span className="font-bold text-red-600 dark:text-red-500 ml-0.5 animate-pulse">!</span>}
        </div>
      );
    } catch (e) {
      return <span className="text-muted-foreground font-medium text-xs">-</span>;
    }
  };

  const renderCriticalTime = (criticalSince?: string | null) => {
    const criticalDate = criticalSince ? new Date(criticalSince) : new Date();
    const days = differenceInDays(new Date(), criticalDate);
    
    let colorClass = "text-muted-foreground";
    let icon = <Clock className="w-3.5 h-3.5 opacity-60" />;
    
    if (days >= 30) {
        colorClass = "text-red-600 dark:text-red-500 font-semibold";
        icon = <TriangleAlert className="w-3.5 h-3.5" />;
    } else if (days >= 15) {
        colorClass = "text-amber-600 dark:text-amber-500 font-medium";
        icon = <AlertOctagon className="w-3.5 h-3.5" />;
    }

    return (
        <div className={`flex items-center gap-1.5 text-[11px] ${colorClass}`}>
            {icon}
            {days <= 0 ? "HOJE" : days === 1 ? "1 DIA" : `${days} DIAS`}
        </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-8 p-4 sm:p-6 lg:p-8 min-h-screen bg-background transition-colors duration-500 pb-32">
      
      {/* HEADER E TABS LIST */}
      <div className="gsap-header flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 text-foreground tracking-tight">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <ShoppingCart className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                    Central de Compras
                </h1>
                <p className="text-muted-foreground mt-2 font-medium text-sm sm:text-base">
                    Gestão analítica de reposição e alertas de stock.
                </p>
            </div>
            
            <div className="flex gap-3">
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["low-stock"] })} className="rounded-lg h-10 text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
            </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/30 border border-border/40 rounded-lg w-full sm:w-auto inline-flex h-11 p-1">
                <TabsTrigger value="dashboard" className="rounded-md font-medium text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                    <LayoutDashboard className="w-3.5 h-3.5 mr-2 opacity-70" /> Panorama
                </TabsTrigger>
                <TabsTrigger value="management" className="rounded-md font-medium text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                    <ListTodo className="w-3.5 h-3.5 mr-2 opacity-70" /> Gerir Tabela 
                    {filteredItems.length > 0 && <span className="ml-1.5 bg-primary/10 text-primary py-0.5 px-1.5 rounded-full text-[10px] font-bold">{filteredItems.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="tools" className="rounded-md font-medium text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                    <Wrench className="w-3.5 h-3.5 mr-2 opacity-70" /> Ferramentas
                </TabsTrigger>
            </TabsList>

            {/* CONTEÚDO DA ABA 1: PANORAMA GERAL */}
            <TabsContent value="dashboard" className="mt-8 space-y-8 animate-in fade-in duration-500">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard title="Itens em Rutura" value={kpis.total} subtext="Requerem atenção" icon={AlertOctagon} colorClass="text-amber-500" bgClass="bg-amber-500/10" />
                            <KPICard title="Déficit de Peças" value={kpis.deficit} subtext="Volume total a comprar" icon={TrendingDown} colorClass="text-red-500" bgClass="bg-red-500/10" />
                            <KPICard title="Crítico Máximo" value={kpis.urgent} subtext="Parados há +30 dias" icon={TriangleAlert} colorClass="text-red-600" bgClass="bg-red-600/10" customBadge={kpis.urgent > 0 ? <Badge variant="destructive" className="animate-pulse">Urgente</Badge> : undefined} />
                            <KPICard title="Progresso do Setor" value={`${kpis.progress}%`} subtext="Itens processados" icon={CheckCircle2} colorClass="text-emerald-500" bgClass="bg-emerald-500/10" />
                        </div>

                        {smartInsights.length > 0 && (
                            <div className="gsap-element flex flex-col md:flex-row gap-4 pt-4">
                                {smartInsights.map((insight, idx) => (
                                    <div key={idx} className="flex-1 flex items-start gap-4 p-5 rounded-2xl border border-border/50 bg-card shadow-sm">
                                        <div className={`p-3 rounded-xl border ${insight.bg} ${insight.color}`}>
                                            <insight.icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 mt-0.5">
                                            <h4 className="font-bold text-foreground mb-1 text-sm flex items-center gap-1.5">
                                                <BrainCircuit className="w-4 h-4 text-primary" /> Insight
                                            </h4>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{insight.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Atalho para ir para gestão */}
                        <div className="flex justify-center pt-6">
                            <Button onClick={() => setActiveTab("management")} className="rounded-full px-8 font-semibold">
                                Iniciar Gestão de Produtos <ArrowRight className="ml-2 w-4 h-4 opacity-70" />
                            </Button>
                        </div>
                    </>
                )}
            </TabsContent>

            {/* CONTEÚDO DA ABA 2: GESTÃO DE PRODUTOS */}
            <TabsContent value="management" className="mt-8 space-y-4 animate-in fade-in duration-500">
                <div className="gsap-element flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Pesquisar material, SKU ou categoria..." 
                          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 h-10 bg-background"
                      />
                    </div>

                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                      <PopoverTrigger asChild>
                          <Button variant={activeFiltersCount > 0 ? "default" : "outline"} className="h-10 px-4 gap-2">
                            <Filter className="h-4 w-4" />
                            Filtros
                            {activeFiltersCount > 0 && <span className="flex items-center justify-center bg-primary-foreground text-primary rounded-full h-5 w-5 text-[10px] font-bold">{activeFiltersCount}</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-5 shadow-xl rounded-xl" align="end">
                          <div className="space-y-5">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-sm text-foreground">Refinar Busca</h4>
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider font-bold" onClick={() => { setStatusFilter("all"); setVendorFilter(""); setCategoryFilter(""); setUrgencyFilter("all"); }}>Limpar Tudo</Button>
                            </div>
                            <Separator />
                            
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Urgência</Label>
                                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">Todos os Prazos</SelectItem>
                                      <SelectItem value="30" className="text-red-600 dark:text-red-400">🚨 Crítico (+30 Dias)</SelectItem>
                                      <SelectItem value="15" className="text-amber-600 dark:text-amber-400">⚠️ Alerta (+15 Dias)</SelectItem>
                                      <SelectItem value="recent" className="text-emerald-600 dark:text-emerald-400">✅ Recente (0-14 Dias)</SelectItem>
                                  </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">Todos os Status</SelectItem>
                                      <SelectItem value="pendente" className="text-rose-600 dark:text-rose-400">🔴 Pendente</SelectItem>
                                      <SelectItem value="cotacao" className="text-blue-600 dark:text-blue-400">🔵 Em Cotação</SelectItem>
                                      <SelectItem value="comprado" className="text-emerald-600 dark:text-emerald-400">🟢 Comprado</SelectItem>
                                      <SelectItem value="nao_comprado" className="text-muted-foreground">⚫ Cancelado</SelectItem>
                                  </SelectContent>
                                </Select>
                            </div>
                          </div>
                      </PopoverContent>
                    </Popover>
                </div>

                <div className="gsap-element flex flex-wrap gap-2 pb-2">
                    {[
                        { id: "all", label: "Todos os Itens" },
                        { id: "critical", label: "🚨 Críticos (+30 dias)" },
                        { id: "pending", label: "🔴 Sem Ação" },
                        { id: "progress", label: "🟢 Em Andamento" }
                    ].map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => setQuickFilter(chip.id)}
                            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors border ${
                                quickFilter === chip.id 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>

                {/* TABELA MINIMALISTA */}
                <div className="gsap-element border rounded-xl bg-card overflow-hidden shadow-sm">
                    <Table>
                    <TableHeader className="bg-muted/40 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[40px] text-center px-4"><Checkbox checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length} onCheckedChange={(checked) => handleSelectAll(!!checked)} /></TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10">Produto & SKU</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10 w-32">Progresso</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10 text-right">Sugerido</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10">Parado Há</TableHead>
                          <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10">Status</TableHead>
                          <TableHead className="text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10">Previsão</TableHead>
                          <TableHead className="text-right text-[10px] uppercase tracking-wider font-semibold text-muted-foreground h-10 pr-6">Ação</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading || isCleaning ? (
                        <TableRow><TableCell colSpan={8} className="text-center h-48">
                            <span className="flex flex-col items-center justify-center gap-3 text-muted-foreground font-semibold text-sm">
                            {isCleaning ? <RefreshCw className="h-6 w-6 animate-spin opacity-50"/> : <Activity className="h-6 w-6 animate-pulse opacity-50" />} 
                            {isCleaning ? "Limpando registros antigos..." : "A analisar necessidades..."}
                            </span>
                        </TableCell></TableRow>
                        ) : filteredItems.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center h-48 text-muted-foreground font-medium text-sm">Nenhum alerta de compra neste filtro.</TableCell></TableRow>
                        ) : (
                        filteredItems.map((item: ProductItem) => {
                            const minStock = Number(item.min_stock || 0);
                            const currentQty = Number(item.quantity || 0);
                            const reservedQty = Number(item.quantity_reserved || 0);
                            const disponivel = currentQty - reservedQty;
                            const deficit = minStock - disponivel;
                            const isSelected = selectedItems.includes(item.id);

                            const porcentagemSaude = minStock > 0 ? Math.max(0, Math.min(100, (disponivel / minStock) * 100)) : 0;
                            let corBarra = "bg-red-500";
                            if (porcentagemSaude > 60) corBarra = "bg-emerald-500";
                            else if (porcentagemSaude > 30) corBarra = "bg-amber-500";

                            const sugestaoCompra = Math.ceil(deficit * 1.2);

                            return (
                            <TableRow key={item.id} className={`transition-colors border-b border-border/40 ${isSelected ? "bg-muted" : "hover:bg-muted/50"}`}>
                                <TableCell className="text-center px-4">
                                  <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)} />
                                </TableCell>
                                
                                <TableCell className="py-3">
                                  <div className="flex flex-col pr-4">
                                      <span className="font-semibold text-sm text-foreground truncate max-w-[200px]">{item.name}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.sku}</span>
                                  </div>
                                </TableCell>
                                
                                <TableCell className="py-3">
                                  <div className="flex flex-col gap-1 w-full pr-4">
                                      <div className="flex justify-between items-end">
                                          <span className="text-xs font-bold text-foreground">{disponivel}</span>
                                          <span className="text-[9px] font-medium text-muted-foreground">Meta: {minStock}</span>
                                      </div>
                                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                          <div className={`h-full ${corBarra}`} style={{ width: `${porcentagemSaude}%` }} />
                                      </div>
                                  </div>
                                </TableCell>

                                <TableCell className="py-3 text-right">
                                    <div className="flex flex-col items-end" title="Sugerido +20% de margem de segurança">
                                        <span className="text-xs font-bold text-foreground">
                                            {sugestaoCompra} <span className="text-[10px] text-muted-foreground font-normal">{item.unit}</span>
                                        </span>
                                        <span className="text-[9px] text-muted-foreground font-medium mt-0.5">Déficit: {deficit}</span>
                                    </div>
                                </TableCell>
                                
                                <TableCell className="py-3">
                                    {renderCriticalTime(item.critical_since)}
                                </TableCell>

                                <TableCell className="py-3">
                                  <Select value={item.purchase_status || "pendente"} onValueChange={(val) => handleStatusChange(item, val)} disabled={!canEdit}>
                                      <SelectTrigger className={`w-[130px] h-8 text-xs font-semibold rounded-md ${getStatusColor(item.purchase_status)}`}>
                                      <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                      <SelectItem value="pendente" className="font-semibold text-xs">🔴 Pendente</SelectItem>
                                      <SelectItem value="cotacao" className="font-semibold text-xs">🔵 Em Cotação</SelectItem>
                                      <SelectItem value="comprado" className="font-semibold text-xs">🟢 Comprado</SelectItem>
                                      <SelectItem value="nao_comprado" className="font-semibold text-xs text-muted-foreground">⚫ Cancelado</SelectItem>
                                      </SelectContent>
                                  </Select>
                                </TableCell>

                                <TableCell className="text-center py-3">
                                  {renderDeliveryDate(item.delivery_forecast)}
                                </TableCell>

                                <TableCell className="text-right pr-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Solicitar Cotação">
                                                <Send className="h-3.5 w-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-48">
                                          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Enviar Cotação</DropdownMenuLabel>
                                          <DropdownMenuItem onClick={() => handleCommunicate('copy', item, deficit)} className="text-xs cursor-pointer"><Copy className="h-3.5 w-3.5 mr-2" /> Copiar Texto</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => handleCommunicate('whatsapp', item, deficit)} className="text-xs cursor-pointer text-emerald-600 dark:text-emerald-400"><MessageCircle className="h-3.5 w-3.5 mr-2" /> Via WhatsApp</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleCommunicate('email', item, deficit)} className="text-xs cursor-pointer text-blue-600 dark:text-blue-400"><Mail className="h-3.5 w-3.5 mr-2" /> Via E-mail</DropdownMenuItem>
                                          </DropdownMenuContent>
                                      </DropdownMenu>

                                      <Button variant="ghost" size="icon" className={`h-8 w-8 transition-colors ${item.purchase_note || item.delivery_forecast ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`} onClick={() => openNoteDialog(item)} title="Editar detalhes">
                                          {!canEdit && (item.purchase_note || item.delivery_forecast) ? <Eye className="h-4 w-4" /> : <FileEdit className="h-4 w-4" />}
                                      </Button>
                                  </div>
                                </TableCell>
                            </TableRow>
                            );
                        })
                        )}
                    </TableBody>
                    </Table>
                </div>
            </TabsContent>

            {/* CONTEÚDO DA ABA 3: FERRAMENTAS DE APOIO */}
            <TabsContent value="tools" className="mt-6 space-y-4 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="gsap-element border-border/50 bg-card shadow-sm">
                        <CardContent className="p-6">
                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
                                <Download className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-1">Exportação de Relatórios</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Gere documentos detalhados sobre o estado atual do estoque para enviar à gestão.
                            </p>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={() => handleExportReport('excel')} className="w-full justify-start h-10 text-sm">
                                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Planilha Excel (.xlsx)
                                </Button>
                                <Button variant="outline" onClick={() => handleExportReport('pdf')} className="w-full justify-start h-10 text-sm">
                                    <FileText className="w-4 h-4 mr-2" /> Documento PDF
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="gsap-element border-border/50 bg-card shadow-sm">
                        <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center opacity-60">
                            <Wrench className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                            <h3 className="text-base font-bold text-foreground mb-1">Mais ferramentas em breve</h3>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                Integração direta com sistemas de ERP e aprovação automática de ordens de compra em desenvolvimento.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
      </div>

      {/* BARRA FLUTUANTE DE AÇÕES (LOTE) */}
      {selectedItems.length > 0 && activeTab === "management" && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-card border border-border shadow-xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="flex items-center gap-2 border-r border-border pr-4">
            <Badge className="h-6 w-6 flex items-center justify-center p-0 rounded-full">{selectedItems.length}</Badge>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selecionados</span>
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => handleBulkStatusChange('pendente')} className="h-8 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-500/10">
                 Resetar
              </Button>
              <Button size="sm" onClick={() => handleBulkStatusChange('cotacao')} className="h-8 text-xs font-bold px-4 bg-blue-600 hover:bg-blue-700 text-white">
                Cotação
              </Button>
              <Button size="sm" onClick={() => handleBulkStatusChange('comprado')} className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                Comprado
              </Button>
            </div>
          )}
          
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setSelectedItems([])}>
              <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* DIALOG DE DETALHES + CALCULADORA (MINIMALISTA) */}
      <Dialog open={!!noteDialogItem} onOpenChange={(open) => !open && setNoteDialogItem(null)}>
        <DialogContent className="sm:max-w-lg border-border/50 bg-background shadow-lg p-0 overflow-hidden" onCloseAutoFocus={(e) => e.preventDefault()}>
          <div className="p-6 border-b border-border/40 bg-muted/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md text-primary"><ShoppingCart className="h-5 w-5"/></div>
                  {canEdit ? "Gerir Reposição" : "Detalhes da Reposição"}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5">
            <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Identificação</p>
                  <p className="text-base font-bold text-foreground leading-tight">{noteDialogItem?.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{noteDialogItem?.sku}</p>
                </div>
                <div className="bg-primary/5 text-primary px-3 py-2 rounded-md text-center border border-primary/20">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5">Comprar</p>
                    <p className="font-bold text-lg leading-none">{noteDialogItem ? Math.ceil((Number(noteDialogItem.min_stock) - (Number(noteDialogItem.quantity) - Number(noteDialogItem.quantity_reserved))) * 1.2) : 0}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Previsão de Entrega</Label>
                <Input 
                  type="date" 
                  value={tempDate} 
                  onChange={(e) => setTempDate(e.target.value)} 
                  disabled={!canEdit}
                  className="h-10 bg-background border-border shadow-sm text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 opacity-70" /> Custo Un. (Simulador)
                </Label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input 
                        type="number" 
                        placeholder="0.00"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        className="h-10 pl-8 bg-background border-border shadow-sm text-sm"
                    />
                </div>
              </div>
            </div>

            {tempPrice && Number(tempPrice) > 0 && noteDialogItem && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-top-1">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Estimado:</span>
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tempPrice) * Math.ceil((Number(noteDialogItem.min_stock) - (Number(noteDialogItem.quantity) - Number(noteDialogItem.quantity_reserved))) * 1.2))}
                    </span>
                </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs font-semibold text-muted-foreground">Anotações do Pedido</Label>
              <Textarea 
                id="note"
                placeholder={canEdit ? "Insira links, fornecedor, nº NF ou detalhes logísticos..." : "Nenhum detalhe registrado."}
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                rows={3}
                readOnly={!canEdit}
                className="resize-none bg-background border-border shadow-sm text-sm"
              />
            </div>
          </div>
          
          <div className="p-4 bg-muted/20 border-t border-border/40 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNoteDialogItem(null)} className="h-9 text-xs">Cancelar</Button>
            {canEdit && <Button onClick={handleSaveDialog} className="h-9 text-xs font-semibold px-6">Salvar Alterações</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
