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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Novo componente importado
import { 
  ShoppingCart, Eye, Search, X, Filter, CalendarClock, Truck, AlertOctagon,
  Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, 
  Copy, CheckCircle2, TrendingDown, Clock, Activity, TrendingUp,
  BrainCircuit, Lightbulb, Target, MessageCircle, Mail, Calculator, Send, LayoutDashboard, ListTodo, Wrench
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
  <Card className="gsap-element relative overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-2xl dark:shadow-[0_0_30px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 transition-all duration-500 bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl group rounded-[2rem]">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-700 to-transparent opacity-30 group-hover:opacity-100 transition-opacity"></div>
      <div className={`absolute -right-6 -top-6 p-10 rounded-full opacity-[0.03] dark:opacity-[0.04] transition-transform group-hover:scale-[1.3] group-hover:rotate-12 duration-1000 ease-out ${bgClass.replace('bg-', 'bg-current text-')} ${colorClass}`}>
          <Icon className="w-32 h-32" />
      </div>
      <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-4">
              <div className={`p-3.5 rounded-2xl shadow-inner border border-white/40 dark:border-white/10 ${bgClass} ${colorClass}`}>
                  <Icon className="w-6 h-6" />
              </div>
              {customBadge}
          </div>
          <div className="flex-1 flex flex-col justify-end">
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm truncate">{value}</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{title}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse shrink-0"></span> 
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
  
  const [activeTab, setActiveTab] = useState("dashboard"); // Estado para controlar a aba atual
  
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

  // Re-executa as animações quando a aba muda
  useGSAP(() => {
    if (!isLoading) {
        gsap.from(".gsap-element", { 
            y: 20, 
            opacity: 0, 
            duration: 0.6, 
            stagger: 0.05, 
            ease: "back.out(1.1)", 
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
      insights.push({ icon: TriangleAlert, color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-900/30", text: `Foco Imediato: Você tem ${kpis.urgent} itens parados no vermelho há mais de 30 dias. Priorize o contato com esses fornecedores hoje.` });
    }
    const pendentes = filteredItems.filter(i => !i.purchase_status || i.purchase_status === 'pendente').length;
    if (pendentes > (filteredItems.length / 2)) {
      insights.push({ icon: Target, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", text: `Oportunidade de Lote: ${pendentes} itens estão sem ação. Selecione vários itens na tabela e use o botão "Em Cotação" para processar em massa.` });
    } else if (kpis.progress > 50) {
      insights.push({ icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: `Ótimo trabalho! O setor de compras já encaminhou ${kpis.progress}% das necessidades de estoque.` });
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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "comprado": return "text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 shadow-sm";
      case "cotacao": return "text-indigo-700 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 shadow-sm";
      case "nao_comprado": return "text-slate-600 dark:text-slate-400 font-extrabold bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700";
      default: return "text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.1)]";
    }
  };

  const renderDeliveryDate = (dateString?: string | null) => {
    if (!dateString) return <span className="text-slate-400 dark:text-slate-600 font-medium text-xs">-</span>;
    try {
      const date = new Date(dateString);
      const userDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      if (isNaN(userDate.getTime())) return <span className="text-slate-400 dark:text-slate-600 font-medium text-xs">-</span>;
      
      const isLate = isPast(userDate) && !isToday(userDate);
      return (
        <div className={`flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-sm w-fit mx-auto transition-colors ${
            isLate 
            ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50" 
            : "bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/50"
        }`}>
          <CalendarClock className="h-3.5 w-3.5" />
          {format(userDate, "dd/MM")}
          {isLate && <span className="font-black ml-0.5 animate-pulse">!</span>}
        </div>
      );
    } catch (e) {
      return <span className="text-slate-400 font-medium text-xs">-</span>;
    }
  };

  const renderCriticalTime = (criticalSince?: string | null) => {
    const criticalDate = criticalSince ? new Date(criticalSince) : new Date();
    const days = differenceInDays(new Date(), criticalDate);
    
    let colorClass = "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800";
    let icon = <Clock className="w-3.5 h-3.5" />;
    let anim = "";
    
    if (days >= 30) {
        colorClass = "bg-rose-600 text-white border-rose-700 dark:border-rose-500 shadow-md shadow-rose-500/30 animate-pulse";
        icon = <TriangleAlert className="w-3.5 h-3.5" strokeWidth={3} />;
        anim = "animate-pulse";
    } else if (days >= 15) {
        colorClass = "bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800";
        icon = <AlertOctagon className="w-3.5 h-3.5" />;
    } else if (days > 7) {
        colorClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800";
    }

    return (
        <div className={`flex items-center gap-2 text-[11px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider w-fit ${colorClass} ${anim}`}>
            {icon}
            {days <= 0 ? "HOJE" : days === 1 ? "1 DIA" : `${days} DIAS`}
        </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-8 p-4 sm:p-8 bg-slate-50/50 dark:bg-[#0a0f1c] min-h-screen transition-colors duration-500 pb-32 overflow-x-hidden">
      
      {/* HEADER E TABS LIST */}
      <div className="gsap-header flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
            <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-sky-500/20 to-indigo-500/20 blur-3xl rounded-full"></div>
                <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-4 text-slate-900 dark:text-white relative z-10 tracking-tight">
                    <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-[1.25rem] shadow-xl shadow-sky-500/30 text-white transform hover:scale-105 transition-transform">
                        <ShoppingCart className="h-7 w-7" strokeWidth={2.5} />
                    </div>
                    Central de Compras
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 ml-[4.5rem] font-semibold text-sm sm:text-base relative z-10 tracking-wide">
                    Gestão analítica de reposição e alertas de stock.
                </p>
            </div>
            
            <div className="flex gap-3 relative z-10">
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["low-stock"] })} className="rounded-xl font-bold h-12 shadow-sm border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
            </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl w-full sm:w-auto flex flex-wrap h-auto">
                <TabsTrigger value="dashboard" className="rounded-xl flex-1 sm:flex-none font-bold py-2.5 px-6 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-slate-500">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Panorama Global
                </TabsTrigger>
                <TabsTrigger value="management" className="rounded-xl flex-1 sm:flex-none font-bold py-2.5 px-6 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-slate-500">
                    <ListTodo className="w-4 h-4 mr-2" /> Gerir Produtos {filteredItems.length > 0 && <span className="ml-2 bg-slate-200/50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 py-0.5 px-2 rounded-full text-[10px]">{filteredItems.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="tools" className="rounded-xl flex-1 sm:flex-none font-bold py-2.5 px-6 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all text-slate-500">
                    <Wrench className="w-4 h-4 mr-2" /> Ferramentas de Apoio
                </TabsTrigger>
            </TabsList>

            {/* CONTEÚDO DA ABA 1: PANORAMA GERAL */}
            <TabsContent value="dashboard" className="mt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-[2rem] bg-slate-200/60 dark:bg-slate-800/60" />)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <KPICard title="Itens em Rutura" value={kpis.total} subtext="Requerem atenção" icon={AlertOctagon} colorClass="text-amber-500" bgClass="bg-amber-500/10" />
                            <KPICard title="Déficit de Peças" value={kpis.deficit} subtext="Volume total a comprar" icon={TrendingDown} colorClass="text-rose-500" bgClass="bg-rose-500/10" />
                            <KPICard title="Crítico Máximo" value={kpis.urgent} subtext="Parados há +30 dias" icon={TriangleAlert} colorClass="text-red-600" bgClass="bg-red-600/10" customBadge={kpis.urgent > 0 ? <Badge className="bg-red-600 animate-pulse">Urgente</Badge> : undefined} />
                            <KPICard title="Progresso do Setor" value={`${kpis.progress}%`} subtext="Itens processados" icon={CheckCircle2} colorClass="text-emerald-500" bgClass="bg-emerald-500/10" />
                        </div>

                        {smartInsights.length > 0 && (
                            <div className="gsap-element flex flex-col md:flex-row gap-4">
                                {smartInsights.map((insight, idx) => (
                                    <div key={idx} className={`flex-1 flex items-start gap-4 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm`}>
                                        <div className={`p-4 rounded-2xl ${insight.bg} ${insight.color} shadow-inner`}>
                                            <insight.icon className="w-6 h-6" strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 mt-1">
                                            <h4 className="font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2 text-lg">
                                                <BrainCircuit className="w-5 h-5 text-indigo-500" /> Assistente Inteligente
                                            </h4>
                                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">{insight.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Atalho para ir para gestão */}
                        <div className="flex justify-center pt-4">
                            <Button onClick={() => setActiveTab("management")} className="rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-8 h-12 shadow-lg shadow-indigo-500/30">
                                Iniciar Gestão de Produtos <Target className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </>
                )}
            </TabsContent>

            {/* CONTEÚDO DA ABA 2: GESTÃO DE PRODUTOS */}
            <TabsContent value="management" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="gsap-element flex flex-col sm:flex-row gap-4 bg-white/50 dark:bg-slate-900/30 p-3 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-sm">
                    <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-indigo-400" />
                    <Input 
                        placeholder="Pesquisar material, SKU ou categoria..." 
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm font-bold text-slate-700 dark:text-slate-200 focus-visible:ring-indigo-500"
                    />
                    </div>

                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant={activeFiltersCount > 0 ? "secondary" : "outline"} className={`h-12 px-6 rounded-xl gap-3 font-black tracking-wide shadow-sm transition-all ${activeFiltersCount === 0 ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300" : "bg-indigo-600 text-white hover:bg-indigo-700 border-none"}`}>
                        <Filter className="h-5 w-5" />
                        Filtros Avançados
                        {activeFiltersCount > 0 && <span className="flex items-center justify-center bg-white text-indigo-700 rounded-full h-6 w-6 text-xs">{activeFiltersCount}</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[340px] p-6 shadow-2xl rounded-[2rem] dark:bg-slate-900 dark:border-slate-800" align="end">
                        <div className="space-y-5">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-lg tracking-tight text-slate-800 dark:text-slate-200">Refinar Tabela</h4>
                            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider" onClick={() => { setStatusFilter("all"); setVendorFilter(""); setCategoryFilter(""); setUrgencyFilter("all"); }}>Limpar Tudo</Button>
                        </div>
                        <Separator className="dark:bg-slate-800" />
                        
                        <div className="space-y-2">
                            <Label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Urgência de Compra</Label>
                            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                            <SelectTrigger className="h-11 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                                <SelectItem value="all" className="font-bold">Todos os Prazos</SelectItem>
                                <SelectItem value="30" className="font-black text-rose-600 dark:text-rose-400">🚨 Crítico (+30 Dias)</SelectItem>
                                <SelectItem value="15" className="font-bold text-orange-600 dark:text-orange-400">⚠️ Alerta (+15 Dias)</SelectItem>
                                <SelectItem value="recent" className="font-bold text-sky-600 dark:text-sky-400">✅ Recente (0-14 Dias)</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status da Compra</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-11 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                                <SelectItem value="all" className="font-bold">Todos os Status</SelectItem>
                                <SelectItem value="pendente" className="font-bold text-rose-600 dark:text-rose-400">🔴 Pendente</SelectItem>
                                <SelectItem value="cotacao" className="font-bold text-indigo-600 dark:text-indigo-400">🔵 Em Cotação</SelectItem>
                                <SelectItem value="comprado" className="font-bold text-emerald-600 dark:text-emerald-400">🟢 Comprado</SelectItem>
                                <SelectItem value="nao_comprado" className="font-bold text-slate-500">⚫ Cancelado</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        </div>
                    </PopoverContent>
                    </Popover>
                </div>

                <div className="gsap-element flex flex-wrap gap-2 px-2 pb-2">
                    {[
                        { id: "all", label: "Todos os Itens" },
                        { id: "critical", label: "🚨 Críticos (+30 dias)" },
                        { id: "pending", label: "🔴 Sem Ação Iniciada" },
                        { id: "progress", label: "🟢 Em Andamento" }
                    ].map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => setQuickFilter(chip.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 border ${
                                quickFilter === chip.id 
                                ? "bg-slate-800 text-white border-slate-800 dark:bg-indigo-500 dark:border-indigo-500 shadow-md transform scale-105" 
                                : "bg-white/50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700 dark:bg-slate-900/30 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-400"
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>

                <div className="gsap-element border border-slate-200/80 dark:border-slate-800/80 rounded-[2.5rem] bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl overflow-hidden shadow-2xl dark:shadow-[0_0_50px_-15px_rgba(0,0,0,0.4)]">
                    <Table>
                    <TableHeader className="bg-slate-100/50 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800/80">
                        <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[60px] text-center px-4 py-6">
                            <Checkbox 
                            checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            className="rounded-[4px] dark:border-slate-500 dark:data-[state=checked]:bg-indigo-500"
                            />
                        </TableHead>
                        <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Produto & SKU</TableHead>
                        <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px] w-32">Saúde do Estoque</TableHead>
                        <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Meta Compra</TableHead>
                        <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Em Falta</TableHead>
                        <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Status</TableHead>
                        <TableHead className="text-center font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Previsão</TableHead>
                        <TableHead className="text-right font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px] pr-8">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading || isCleaning ? (
                        <TableRow><TableCell colSpan={8} className="text-center h-48">
                            <span className="flex flex-col items-center justify-center gap-3 text-slate-400 font-bold tracking-widest uppercase text-xs">
                            {isCleaning ? <RefreshCw className="h-8 w-8 animate-spin text-indigo-500"/> : <Activity className="h-8 w-8 animate-pulse text-indigo-500" />} 
                            {isCleaning ? "Limpando Banco..." : "A analisar necessidades..."}
                            </span>
                        </TableCell></TableRow>
                        ) : filteredItems.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center h-48 text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-xs">Nenhum alerta de compra neste filtro.</TableCell></TableRow>
                        ) : (
                        filteredItems.map((item: ProductItem) => {
                            const minStock = Number(item.min_stock || 0);
                            const currentQty = Number(item.quantity || 0);
                            const reservedQty = Number(item.quantity_reserved || 0);
                            const disponivel = currentQty - reservedQty;
                            const deficit = minStock - disponivel;
                            const isSelected = selectedItems.includes(item.id);

                            const porcentagemSaude = minStock > 0 ? Math.max(0, Math.min(100, (disponivel / minStock) * 100)) : 0;
                            let corBarra = "bg-rose-500";
                            if (porcentagemSaude > 60) corBarra = "bg-emerald-500";
                            else if (porcentagemSaude > 30) corBarra = "bg-amber-500";

                            const sugestaoCompra = Math.ceil(deficit * 1.2);

                            return (
                            <TableRow key={item.id} className={`gsap-table-row transition-all duration-300 border-b border-slate-100 dark:border-slate-800/60 ${isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/20 shadow-inner" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 hover:shadow-sm"}`}>
                                <TableCell className="text-center px-4">
                                <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)} className="rounded-[4px] dark:border-slate-500 dark:data-[state=checked]:bg-indigo-500" />
                                </TableCell>
                                
                                <TableCell className="py-5">
                                <div className="flex flex-col gap-1 pr-4">
                                    <span className="font-bold text-[15px] text-slate-800 dark:text-slate-200 leading-tight">{item.name}</span>
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tracking-widest uppercase">{item.sku}</span>
                                </div>
                                </TableCell>
                                
                                <TableCell>
                                <div className="flex flex-col gap-2 w-full pr-4">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{disponivel}</span>
                                        <span className="text-[10px] font-bold text-slate-400">Meta: {minStock}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full ${corBarra} transition-all duration-1000`} style={{ width: `${porcentagemSaude}%` }} />
                                    </div>
                                </div>
                                </TableCell>

                                <TableCell>
                                    <div className="flex flex-col items-start gap-1" title="Sugerido +20% de margem de segurança">
                                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                            {sugestaoCompra} {item.unit}
                                        </span>
                                        <span className="text-[9px] text-slate-400 uppercase font-bold">(Déficit: {deficit})</span>
                                    </div>
                                </TableCell>
                                
                                <TableCell>
                                    {renderCriticalTime(item.critical_since)}
                                </TableCell>

                                <TableCell>
                                <Select value={item.purchase_status || "pendente"} onValueChange={(val) => handleStatusChange(item, val)} disabled={!canEdit}>
                                    <SelectTrigger className={`w-[140px] h-10 rounded-xl focus:ring-indigo-500 ${getStatusColor(item.purchase_status)}`}>
                                    <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-xl">
                                    <SelectItem value="pendente" className="font-bold py-2.5">🔴 Pendente</SelectItem>
                                    <SelectItem value="cotacao" className="font-bold py-2.5">🔵 Em Cotação</SelectItem>
                                    <SelectItem value="comprado" className="font-bold py-2.5">🟢 Comprado</SelectItem>
                                    <SelectItem value="nao_comprado" className="font-bold py-2.5">⚫ Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                                </TableCell>

                                <TableCell className="text-center">
                                {renderDeliveryDate(item.delivery_forecast)}
                                </TableCell>

                                <TableCell className="text-right pr-6">
                                <div className="flex items-center justify-end gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-indigo-900/30 transition-all shadow-sm" title="Solicitar Cotação">
                                            <Send className="h-4 w-4" />
                                        </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-2 shadow-2xl">
                                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 py-1.5">Enviar Cotação</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleCommunicate('copy', item, deficit)} className="gap-3 cursor-pointer dark:focus:bg-slate-800 rounded-lg p-3 font-semibold text-slate-600 dark:text-slate-300">
                                            <Copy className="h-4 w-4 text-slate-400" /> Copiar Texto
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="dark:bg-slate-800 my-1" />
                                        <DropdownMenuItem onClick={() => handleCommunicate('whatsapp', item, deficit)} className="gap-3 cursor-pointer dark:focus:bg-slate-800 rounded-lg p-3 font-semibold text-emerald-600">
                                            <MessageCircle className="h-4 w-4" /> Via WhatsApp
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleCommunicate('email', item, deficit)} className="gap-3 cursor-pointer dark:focus:bg-slate-800 rounded-lg p-3 font-semibold text-sky-600">
                                            <Mail className="h-4 w-4" /> Via E-mail
                                        </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Button variant="outline" size="icon" className={`h-10 w-10 rounded-xl shadow-sm transition-all ${item.purchase_note || item.delivery_forecast ? "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" : "border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800"}`} onClick={() => openNoteDialog(item)} title="Editar detalhes">
                                        {!canEdit && (item.purchase_note || item.delivery_forecast) ? <Eye className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
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
            <TabsContent value="tools" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="gsap-element rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
                        <CardContent className="p-8">
                            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
                                <Download className="w-7 h-7" strokeWidth={2} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">Exportação de Relatórios</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
                                Gere documentos detalhados sobre o estado atual do estoque para enviar à gestão ou contabilidade.
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button onClick={() => handleExportReport('excel')} className="w-full justify-start h-14 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 font-bold border border-emerald-200 dark:border-emerald-800/50">
                                    <FileSpreadsheet className="w-5 h-5 mr-3" /> Gerar Planilha Excel (.xlsx)
                                </Button>
                                <Button onClick={() => handleExportReport('pdf')} className="w-full justify-start h-14 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 font-bold border border-rose-200 dark:border-rose-800/50">
                                    <FileText className="w-5 h-5 mr-3" /> Gerar Documento PDF
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="gsap-element rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg">
                        <CardContent className="p-8 h-full flex flex-col items-center justify-center text-center opacity-60">
                            <Wrench className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                            <h3 className="text-xl font-black text-slate-600 dark:text-slate-400 mb-2">Mais ferramentas em breve</h3>
                            <p className="text-slate-500 font-medium max-w-sm">
                                Integração direta com sistemas de ERP e aprovação automática de ordens de compra em desenvolvimento.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
      </div>

      {/* BARRA FLUTUANTE DE AÇÕES (LOTE) - Mantida para a aba de gestão */}
      {selectedItems.length > 0 && activeTab === "management" && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200/80 dark:border-slate-700 shadow-[0_30px_60px_-10px_rgba(0,0,0,0.5)] rounded-full px-8 py-4 flex items-center gap-5 z-50 animate-in slide-in-from-bottom-12 fade-in duration-500">
          <div className="flex items-center gap-3 border-r border-slate-200 dark:border-slate-700 pr-5">
            <Badge variant="default" className="rounded-full h-8 w-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg text-sm p-0 font-black">{selectedItems.length}</Badge>
            <span className="text-[13px] font-black uppercase tracking-widest whitespace-nowrap text-slate-800 dark:text-slate-200">Selecionados</span>
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('pendente')} className="rounded-[1rem] font-bold h-11 px-5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20 shadow-sm">
                 Resetar Erro
              </Button>
              <Button size="sm" onClick={() => handleBulkStatusChange('cotacao')} className="rounded-[1rem] font-black uppercase tracking-wider text-[11px] h-11 px-6 bg-indigo-500 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-0.5">
                Em Cotação
              </Button>
              <Button size="sm" onClick={() => handleBulkStatusChange('comprado')} className="rounded-[1rem] font-black uppercase tracking-wider text-[11px] h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-0.5">
                Marcar Comprado
              </Button>
            </div>
          )}
          
          <Button size="icon" variant="ghost" className="rounded-full h-11 w-11 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:bg-slate-800 border ml-2 border-transparent hover:border-rose-200 transition-colors" onClick={() => setSelectedItems([])}>
              <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* DIALOG DE DETALHES + CALCULADORA */}
      <Dialog open={!!noteDialogItem} onOpenChange={(open) => !open && setNoteDialogItem(null)}>
        <DialogContent className="sm:max-w-lg dark:bg-slate-900 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600"><ShoppingCart className="h-6 w-6"/></div>
                {canEdit ? "Gerir Reposição" : "Detalhes da Reposição"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
              <p className="text-[11px] text-indigo-500 dark:text-indigo-400 uppercase font-black tracking-widest mb-1.5">Identificação do Material</p>
              <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">{noteDialogItem?.name}</p>
                    <p className="text-sm text-slate-500 font-mono mt-1.5">{noteDialogItem?.sku}</p>
                  </div>
                  <div className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-3 py-2 rounded-xl text-center border border-indigo-200 dark:border-indigo-800">
                      <p className="text-[9px] font-black uppercase tracking-widest mb-0.5">Comprar</p>
                      <p className="font-bold text-lg">{noteDialogItem ? Math.ceil((Number(noteDialogItem.min_stock) - (Number(noteDialogItem.quantity) - Number(noteDialogItem.quantity_reserved))) * 1.2) : 0}</p>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Previsão de Entrega</Label>
                <Input 
                  type="date" 
                  value={tempDate} 
                  onChange={(e) => setTempDate(e.target.value)} 
                  disabled={!canEdit}
                  className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-bold px-4 ${tempDate && new Date(tempDate) < new Date(new Date().setHours(0,0,0,0)) ? "border-rose-300 text-rose-600 focus-visible:ring-rose-500 bg-rose-50 dark:bg-rose-900/20" : "focus-visible:ring-indigo-500"}`}
                />
              </div>

              <div className="space-y-2.5">
                <Label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" /> Simulador de Custo (Un.)
                </Label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">R$</span>
                    <Input 
                        type="number" 
                        placeholder="0.00"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(e.target.value)}
                        className="h-12 rounded-xl pl-10 border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-bold focus-visible:ring-indigo-500"
                    />
                </div>
              </div>
            </div>

            {tempPrice && Number(tempPrice) > 0 && noteDialogItem && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Investimento Total Estimado:</span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tempPrice) * Math.ceil((Number(noteDialogItem.min_stock) - (Number(noteDialogItem.quantity) - Number(noteDialogItem.quantity_reserved))) * 1.2))}
                    </span>
                </div>
            )}
            
            <div className="space-y-2.5">
              <Label htmlFor="note" className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Anotações / Fornecedor / Links</Label>
              <Textarea 
                id="note"
                placeholder={canEdit ? "Insira links, e-mails, nº NF ou detalhes logísticos..." : "Nenhum detalhe registrado."}
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                rows={4}
                readOnly={!canEdit}
                className="resize-none rounded-2xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-medium p-4 focus-visible:ring-indigo-500"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setNoteDialogItem(null)} className="rounded-xl font-bold px-6 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 h-12">Fechar Janela</Button>
              {canEdit && <Button onClick={handleSaveDialog} className="rounded-xl font-black uppercase tracking-wider text-[11px] px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/30 h-12 hover:-translate-y-0.5 transition-all">Registrar Alteração</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
