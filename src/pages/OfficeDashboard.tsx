import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext"; 
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toast } from "sonner"; 
import { 
  Search, Filter, Briefcase, Tag, CalendarDays, 
  Clock, UserCircle, AlertCircle, Package, ArrowUpRight, X, LayoutGrid, 
  Check, Loader2
} from "lucide-react"; 
import { cn } from "@/lib/utils";

export default function OfficeDashboard() {
  const { profile, canAccess } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  const hasPermission = canAccess("office_dashboard") || profile?.role === "admin";

  const { data: exits, isLoading } = useQuery({
    queryKey: ["office-exits"],
    queryFn: async () => (await api.get("/office/exits")).data,
    staleTime: 60000, 
    enabled: hasPermission,
  });

  const allTags = useMemo(() => {
    if (!exits) return [];
    const tags = new Set<string>();
    exits.forEach((exit: any) => {
      let pTags = exit.product_tags;
      if (typeof pTags === 'string') { try { pTags = JSON.parse(pTags); } catch(e) { pTags = []; } }
      if (Array.isArray(pTags)) pTags.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [exits]);

  const filteredExits = useMemo(() => {
    if (!exits) return [];
    return exits.filter((exit: any) => {
      let pTags = exit.product_tags;
      if (typeof pTags === 'string') { try { pTags = JSON.parse(pTags); } catch(e) { pTags = []; } }
      const parsedTags = Array.isArray(pTags) ? pTags : [];

      const matchesTag = selectedTag === "all" || parsedTags.includes(selectedTag);
      const matchesType = typeFilter === "all" || exit.type === typeFilter;
      const matchesSearch = 
        searchTerm === "" ||
        exit.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exit.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exit.requester?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTag && matchesSearch && matchesType;
    });
  }, [exits, searchTerm, selectedTag, typeFilter]);

  const handleToggleEpiCheck = async (exitId: string, currentStatus: boolean) => {
    if (!exitId) return;

    const newStatus = !currentStatus;

    try {
      setUpdatingIds(prev => [...prev, exitId]); 

      queryClient.setQueryData(["office-exits"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((exit: any) =>
          exit.id === exitId ? { ...exit, epi_recorded: newStatus } : exit
        );
      });

      await api.patch(`/office/exits/${exitId}/check-epi`, { 
        epi_recorded: newStatus 
      });

      toast.success(newStatus ? "Marcado como registado!" : "Marcação removida.");

    } catch (error: any) {
      console.error(error);
      
      queryClient.setQueryData(["office-exits"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((exit: any) =>
          exit.id === exitId ? { ...exit, epi_recorded: currentStatus } : exit
        );
      });

      toast.error("Erro ao atualizar. Tente novamente.");
    } finally {
      setUpdatingIds(prev => prev.filter(id => id !== exitId)); 
      queryClient.invalidateQueries({ queryKey: ["office-exits"] });
    }
  };

  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in">
        <AlertCircle className="h-16 w-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">Acesso Negado</h1>
        <p className="text-slate-500 mt-2">Não tem permissões suficientes para visualizar o Controle de Saída.</p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 animate-in fade-in duration-1000 pb-32 min-h-screen bg-[#F8FAFC] dark:bg-black">
      
      <div className="flex flex-col mb-2 sm:mb-4">
        <h1 className="text-2xl sm:text-3xl md:text-[44px] font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3 leading-none mb-2 sm:mb-3">
            <div className="p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl sm:rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
                <Briefcase className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} /> 
            </div>
            Controle de Saída
        </h1>
        <p className="text-xs sm:text-sm md:text-[15px] font-medium text-slate-500 dark:text-slate-400 max-w-3xl leading-snug">
          Acompanhamento detalhado de todos os materiais levantados (Solicitações via Sistema e Saídas Manuais).
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full mb-6 sm:mb-8 bg-white/60 dark:bg-[#111]/60 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 dark:border-white/5 backdrop-blur-xl shadow-sm">
        
        <div className="flex flex-col xl:flex-row gap-3 w-full">
          <div className="relative w-full xl:max-w-lg group shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" strokeWidth={2.5} />
              <Input 
                  placeholder="Procurar produto, setor ou pessoa..." 
                  className="pl-12 pr-12 h-14 bg-white dark:bg-[#1A1A1A] border border-slate-200/80 dark:border-white/10 rounded-[1.25rem] font-semibold text-[14px] w-full shadow-sm focus-visible:ring-indigo-500/20 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 p-1.5 rounded-full transition-all animate-in zoom-in-95"
                >
                  <X className="h-4 w-4" strokeWidth={3} />
                </button>
              )}
          </div>
          
          <div className="flex bg-slate-100/80 dark:bg-black/50 p-1.5 rounded-[1.25rem] w-full xl:w-auto border border-slate-200/50 dark:border-white/5 shadow-inner overflow-x-auto custom-scrollbar">
              {['all', 'Solicitação', 'Saída Manual'].map(t => (
                  <button 
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                          "flex-1 px-4 sm:px-6 py-3 text-[13px] font-bold rounded-xl transition-all tracking-wide whitespace-nowrap outline-none",
                          typeFilter === t 
                            ? "bg-white dark:bg-[#222] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-white/5" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white border border-transparent"
                      )}
                  >
                      {t === 'all' ? 'Todas as Origens' : t}
                  </button>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-1 custom-scrollbar w-full">
            <div className="flex items-center gap-1.5 shrink-0 text-slate-400 mr-2 bg-slate-100 dark:bg-white/5 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-white/5">
                <Filter className="h-4 w-4" strokeWidth={2.5} />
                <span className="text-[11px] font-black uppercase tracking-wider">Etiquetas:</span>
            </div>
            
            <Badge 
                variant={selectedTag === "all" ? "default" : "outline"}
                onClick={() => setSelectedTag("all")}
                className={cn(
                  "cursor-pointer px-4 py-2.5 text-xs font-bold transition-all shrink-0 rounded-xl border",
                  selectedTag === "all" 
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md border-indigo-600' 
                    : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-white/5'
                )}
            >
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5 opacity-70" /> Todas
            </Badge>

            {allTags.map(tag => (
                <Badge 
                    key={tag}
                    variant={selectedTag === tag ? "default" : "outline"}
                    onClick={() => setSelectedTag(tag)}
                    className={cn(
                      "cursor-pointer px-4 py-2.5 text-xs font-bold transition-all shrink-0 rounded-xl border",
                      selectedTag === tag 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md border-indigo-600' 
                        : 'bg-white dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-white/5'
                    )}
                >
                    <Tag className="w-3 h-3 mr-1.5 opacity-50" /> {tag}
                </Badge>
            ))}
        </div>
      </div>

      <div className="w-full">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 sm:h-24 w-full rounded-[1.5rem] bg-white/50 dark:bg-white/5" />
            ))}
          </div>
        ) : filteredExits.length === 0 ? (
          <Card className="border border-dashed border-slate-300 dark:border-white/10 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
              <div className="h-16 w-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Nenhum registo encontrado</h3>
              <p className="text-sm text-slate-500 max-w-sm">Tente ajustar os filtros de pesquisa ou remover a etiqueta selecionada.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ========================================== */}
            {/* VISÃO DESKTOP E TABLET                     */}
            {/* ========================================== */}
            <Card className="hidden lg:block border-slate-200/60 dark:border-white/5 shadow-sm overflow-hidden bg-white/50 dark:bg-[#0A0A0A]/50 backdrop-blur-xl rounded-[2rem]">
              <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-white/5">
                    <TableRow className="border-slate-100 dark:border-white/5">
                      <TableHead className="w-[180px] font-bold text-slate-500">Data e Origem</TableHead>
                      <TableHead className="w-[200px] font-bold text-slate-500">Destino</TableHead>
                      <TableHead className="font-bold text-slate-500">Material e Detalhes</TableHead>
                      <TableHead className="w-[120px] text-right font-bold text-slate-500 pr-6">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExits.map((exit: any, i: number) => {
                      let pTags = exit.product_tags;
                      if (typeof pTags === 'string') { try { pTags = JSON.parse(pTags); } catch(e) { pTags = []; } }
                      const parsedTags = Array.isArray(pTags) ? pTags : [];
                      
                      // Agora verifica EPI ou FERRAMENTAS para habilitar a lógica de check
                      const isRequiredCheck = parsedTags.some((t: string) => ['EPI', 'FERRAMENTAS'].includes(t.toUpperCase()));
                      const isUpdating = updatingIds.includes(exit.id);

                      return (
                        <TableRow key={exit.id || i} className="hover:bg-slate-50 dark:hover:bg-white/5 border-slate-100 dark:border-white/5 group">
                          
                          <TableCell className="p-5 align-top">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 text-slate-400" /> {format(new Date(exit.date), "dd/MM/yyyy")}
                              </span>
                              <span className="text-xs text-slate-500 font-bold flex items-center gap-2 ml-0.5">
                                <Clock className="h-3.5 w-3.5" /> {format(new Date(exit.date), "HH:mm")}
                              </span>
                              <Badge variant="outline" className={`w-fit mt-2 text-[10px] uppercase font-black tracking-wider border-0 px-2 py-0.5 ${exit.type === 'Saída Manual' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                {exit.type}
                              </Badge>
                            </div>
                          </TableCell>

                          <TableCell className="p-5 align-top">
                            <div className="flex items-start gap-3">
                              <UserCircle className="h-8 w-8 text-slate-300 mt-0.5 shrink-0" strokeWidth={1.5} />
                              <div className="flex flex-col min-w-0">
                                <span className="font-black text-[15px] text-slate-800 dark:text-slate-200 truncate" title={exit.requester}>{exit.requester}</span>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate" title={exit.sector}>{exit.sector}</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="p-5 align-top">
                            <div className="flex flex-col gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-[15px] leading-snug">{exit.product_name}</span>
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-[10px] text-slate-500 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded shadow-sm border border-slate-200 dark:border-white/5">SKU: {exit.product_sku || '-'}</span>
                                {parsedTags.map((tag: string) => (
                                  <span key={tag} className="text-[10px] flex items-center gap-1 text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30 px-1.5 py-0.5 rounded font-black uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                                    <Tag className="h-2.5 w-2.5" /> {tag}
                                  </span>
                                ))}
                              </div>

                              {exit.observation && (
                                <div className={`mt-2 p-3 rounded-xl border flex items-center justify-between gap-3 ${isRequiredCheck ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50 text-amber-800 dark:text-amber-300' : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10 text-slate-600 dark:text-slate-300'}`}>
                                  
                                  <div className="flex items-start gap-2.5">
                                    {isRequiredCheck ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" /> : <Briefcase className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />}
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-0.5">Destinatário / Obs:</span>
                                      <span className="text-sm font-bold leading-tight">{exit.observation}</span>
                                    </div>
                                  </div>

                                  {isRequiredCheck && (profile?.role === 'escritorio' || profile?.role === 'admin') && (
                                    <button
                                      type="button" 
                                      onClick={(e) => {
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        handleToggleEpiCheck(exit.id, exit.epi_recorded);
                                      }}
                                      disabled={isUpdating}
                                      className={cn(
                                        "flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300 shrink-0 outline-none border-2",
                                        isUpdating ? "opacity-70 cursor-wait border-slate-200" : "cursor-pointer active:scale-90",
                                        exit.epi_recorded 
                                          ? "bg-green-500 border-green-500 text-white shadow-sm hover:bg-green-600 hover:border-green-600 dark:bg-green-600 dark:border-green-600" 
                                          : "bg-white dark:bg-transparent border-slate-300 dark:border-slate-600 hover:border-green-400"
                                      )}
                                    >
                                      {isUpdating ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                      ) : exit.epi_recorded ? (
                                        <Check className="h-5 w-5" strokeWidth={3} />
                                      ) : null}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="p-5 align-top text-right pr-6">
                            <div className="inline-flex items-baseline bg-slate-100 dark:bg-white/10 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/20 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-colors">
                              <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                {exit.quantity}
                              </span>
                              <span className="text-xs font-bold text-slate-500 ml-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 uppercase">
                                {exit.product_unit}
                              </span>
                            </div>
                          </TableCell>

                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ========================================== */}
            {/* VISÃO MOBILE                               */}
            {/* ========================================== */}
            <div className="lg:hidden flex flex-col gap-4">
              {filteredExits.map((exit: any, i: number) => {
                let pTags = exit.product_tags;
                if (typeof pTags === 'string') { try { pTags = JSON.parse(pTags); } catch(e) { pTags = []; } }
                const parsedTags = Array.isArray(pTags) ? pTags : [];
                
                // Agora verifica EPI ou FERRAMENTAS para habilitar a lógica de check
                const isRequiredCheck = parsedTags.some((t: string) => ['EPI', 'FERRAMENTAS'].includes(t.toUpperCase()));
                const isUpdating = updatingIds.includes(exit.id);

                return (
                  <div key={exit.id || i} className="flex flex-col bg-white dark:bg-[#111] rounded-[1.5rem] p-4 sm:p-5 border border-slate-200/60 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
                    
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 dark:border-white/5 pb-3">
                      <Badge variant="outline" className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border-0 ${exit.type === 'Saída Manual' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                        {exit.type}
                      </Badge>
                      <div className="flex flex-col items-end">
                        <span className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">{format(new Date(exit.date), "dd MMM, yy")}</span>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400">{format(new Date(exit.date), "HH:mm")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center shrink-0">
                        <UserCircle className="h-6 w-6 text-slate-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-sm sm:text-[15px] text-slate-800 dark:text-slate-200 truncate leading-tight">{exit.requester}</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate">{exit.sector}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 dark:bg-[#0A0A0A] p-3 rounded-xl border border-slate-100 dark:border-white/5 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0"><Package className="h-5 w-5 text-slate-400" /></div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-[14px] text-slate-900 dark:text-white leading-snug">{exit.product_name}</span>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="font-mono font-bold text-[9px] sm:text-[10px] text-slate-500 bg-white dark:bg-[#222] px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-white/10 shadow-sm">SKU: {exit.product_sku || '-'}</span>
                            {parsedTags.map((tag: string) => (
                              <span key={tag} className="text-[9px] sm:text-[10px] flex items-center gap-1 text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30 px-1.5 py-0.5 rounded font-black uppercase border border-blue-200 dark:border-blue-800/50">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {exit.observation && (
                      <div className={`mb-3 p-3 rounded-xl border flex items-center justify-between gap-3 ${isRequiredCheck ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50 text-amber-800 dark:text-amber-300' : 'bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-white/10 text-slate-600 dark:text-slate-300'}`}>
                        
                        <div className="flex items-start gap-2">
                          {isRequiredCheck ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" /> : <Briefcase className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />}
                          <div className="flex flex-col">
                            <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest opacity-60 mb-0.5">Para quem é?</span>
                            <span className="text-[13px] sm:text-sm font-bold leading-tight">{exit.observation}</span>
                          </div>
                        </div>

                        {isRequiredCheck && (profile?.role === 'escritorio' || profile?.role === 'admin') && (
                          <button
                            type="button" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation(); 
                              handleToggleEpiCheck(exit.id, exit.epi_recorded);
                            }}
                            disabled={isUpdating}
                            className={cn(
                              "flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300 shrink-0 outline-none border-2",
                              isUpdating ? "opacity-70 cursor-wait border-slate-200" : "cursor-pointer active:scale-90",
                              exit.epi_recorded 
                                ? "bg-green-500 border-green-500 text-white shadow-sm hover:bg-green-600 hover:border-green-600 dark:bg-green-600 dark:border-green-600" 
                                : "bg-white dark:bg-transparent border-slate-300 dark:border-slate-600 hover:border-green-400"
                            )}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            ) : exit.epi_recorded ? (
                              <Check className="h-5 w-5" strokeWidth={3} />
                            ) : null}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-auto flex justify-between items-end pt-2">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                         <ArrowUpRight className="h-4 w-4" /> Movimentação
                       </span>
                       <div className="bg-slate-100 dark:bg-white/10 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/5 flex items-baseline">
                         <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{exit.quantity}</span>
                         <span className="text-xs font-bold text-slate-500 ml-1 uppercase">{exit.product_unit}</span>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
