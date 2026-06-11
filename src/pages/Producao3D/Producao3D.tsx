// src/pages/Producao3D/Producao3D.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Minus, Clock, Factory, Weight, Package, Trash2, Search, TrendingUp,
  CalendarDays, User, Hash, LayoutGrid, List, Activity, Loader2, Calendar, 
  BookOpen, Lightbulb, MessageSquare, Layers // <-- IMPORTAÇÃO CORRIGIDA AQUI
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LabelList
} from "recharts";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// --- TIPAGENS ---
export type Production = {
  id: string;
  partId: string;
  quantity: number;
  operator: string;
  totalMinutes: number;
  filamentGrams: number;
  date: string;
  demandId?: string;
};

// --- FUNÇÕES AUXILIARES ---
const formatMinutes = (mins: number) => {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const getRelativeDayName = (dateStr: string) => {
  const date = new Date(dateStr);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM", { locale: ptBR });
};

// --- COMPONENTES FILHOS (TOOLTIPS) ---
const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl">
        <p className="font-black text-slate-900 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sm">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-500 dark:text-slate-400 capitalize">{entry.name}:</span>
              </div>
              <span className="text-slate-900 dark:text-white font-bold">
                {entry.value} {entry.dataKey === 'filamento' ? 'g' : 'un.'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl">
          <p className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest mb-1">Peça</p>
          <p className="font-black text-slate-900 dark:text-white mb-3 text-sm">{label}</p>
          <div className="flex items-center justify-between gap-4 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
            <span className="text-slate-500 dark:text-slate-400">Volume Produzido:</span>
            <span className="text-blue-600 dark:text-blue-400 font-black text-base">{payload[0].value} un.</span>
          </div>
        </div>
      );
    }
    return null;
  };

// --- MODAL: REGISTRAR PRODUÇÃO (MELHORADO) ---
function NewProductionDialog({ open, onOpenChange, parts, demands, onAdd }: any) {
  const [partId, setPartId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [operator, setOperator] = useState("");
  const [demandId, setDemandId] = useState<string>("none");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [extraMinutes, setExtraMinutes] = useState(0);

  useEffect(() => {
    if (parts.length > 0 && !partId) setPartId(String(parts[0].id));
  }, [parts, partId]);

  const part = parts.find((p: any) => String(p.id) === partId);
  const totalMinutes = part ? Number(part.productionMinutes) * quantity + extraMinutes : 0;
  const filamentGrams = part ? Number(part.filamentGrams) * quantity : 0;
  const eligibleDemands = demands.filter((d: any) => String(d.partId) === partId && d.status !== "Concluída");

  const handleSave = () => {
    if (!partId) return toast.error("Preencha a peça para registar."); 
    const agora = new Date();
    const [ano, mes, dia] = date.split('-').map(Number);
    const dataComHoraCorreta = new Date(ano, mes - 1, dia, agora.getHours(), agora.getMinutes(), agora.getSeconds());
    
    onAdd({
      partId, 
      quantity, 
      operator,
      totalMinutes, 
      filamentGrams,
      date: dataComHoraCorreta.toISOString(), 
      demandId: demandId === "none" ? null : demandId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[32px] p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800">
        <div className="bg-slate-50/80 dark:bg-slate-900/50 p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex justify-between items-center">
                <div>
                    <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Registrar Produção</DialogTitle>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Insira os dados da nova impressão 3D.</p>
                </div>
                <div className="h-12 w-12 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                    <Factory className="h-6 w-6" strokeWidth={2.5} />
                </div>
            </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Peça Selecionada Header */}
          <div className="flex gap-4 items-center p-3 rounded-[20px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80">
            {part && (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shrink-0 border border-slate-200/50 dark:border-slate-800 shadow-sm">
                    <img src={part.image || '/placeholder-3d.png'} alt={part.name} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="flex-1 min-w-0 pr-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Modelo Selecionado</Label>
                <Select value={partId} onValueChange={(v) => { setPartId(v); setDemandId("none"); }}>
                <SelectTrigger className="h-10 rounded-xl bg-transparent border-0 ring-1 ring-slate-200 dark:ring-slate-800 font-bold shadow-sm focus:ring-indigo-500 text-sm">
                    <SelectValue placeholder="Selecione uma peça" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                    {parts.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)} className="font-bold py-2.5 cursor-pointer">
                        {p.name} <span className="text-slate-400 font-mono ml-1 text-xs">({p.code})</span>
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</Label>
              <div className="flex items-center h-12 bg-slate-50 dark:bg-slate-900 rounded-[16px] border border-slate-200/60 dark:border-slate-800 shadow-inner p-1">
                 <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-full w-10 flex items-center justify-center bg-white dark:bg-slate-950 rounded-xl shadow-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 active:scale-90 transition-all"><Minus className="h-4 w-4" strokeWidth={3}/></button>
                 <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} className="flex-1 border-0 bg-transparent text-center font-black text-lg p-0 focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none" />
                 <button onClick={() => setQuantity(quantity + 1)} className="h-full w-10 flex items-center justify-center bg-indigo-600 rounded-xl shadow-sm text-white hover:bg-indigo-700 active:scale-90 transition-all"><Plus className="h-4 w-4" strokeWidth={3}/></button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-[16px] font-bold text-sm bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 focus-visible:ring-indigo-500 shadow-sm" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vincular a uma Demanda (Opcional)</Label>
            <Select value={demandId} onValueChange={setDemandId}>
              <SelectTrigger className="h-12 rounded-[16px] bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 font-bold shadow-sm focus:ring-indigo-500 text-sm">
                  <SelectValue placeholder="Sem vínculo" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="none" className="font-bold text-slate-500 py-2.5">Sem vínculo (Estoque Livre)</SelectItem>
                {eligibleDemands.map((d: any) => (
                  <SelectItem key={d.id} value={d.id} className="font-bold py-2.5 text-indigo-700 dark:text-indigo-400">
                      OP {d.opNumber} — Para: {d.requester} (Qtd: {d.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operador Responsável</Label>
              <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Automático (Sistema)" className="h-12 rounded-[16px] font-bold text-sm bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 focus-visible:ring-indigo-500 shadow-sm placeholder:font-medium" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tempo Extra (min)</Label>
              <Input type="number" min={0} value={extraMinutes} onChange={(e) => setExtraMinutes(Math.max(0, +e.target.value))} className="h-12 rounded-[16px] font-bold text-sm bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 focus-visible:ring-indigo-500 shadow-sm" />
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-[20px] p-4 flex justify-between items-center">
             <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center shadow-sm">
                     <Clock className="h-5 w-5 text-indigo-500" />
                 </div>
                 <div className="flex flex-col">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tempo Total Máq.</span>
                     <span className="font-black text-indigo-900 dark:text-indigo-200 text-lg leading-tight">{formatMinutes(totalMinutes)}</span>
                 </div>
             </div>
             <div className="h-10 w-px bg-indigo-200 dark:bg-indigo-800"></div>
             <div className="flex items-center gap-3 pr-2">
                 <div className="flex flex-col text-right">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Filamento</span>
                     <span className="font-black text-indigo-900 dark:text-indigo-200 text-lg leading-tight">{filamentGrams}g</span>
                 </div>
                 <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center shadow-sm">
                     <Weight className="h-5 w-5 text-indigo-500" />
                 </div>
             </div>
          </div>

        </div>
        <div className="p-6 sm:p-8 pt-0 flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-14 sm:flex-1 border-slate-200 dark:border-slate-800 text-slate-600">Cancelar</Button>
          <Button onClick={handleSave} className="rounded-xl font-black h-14 sm:flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20">Registrar e Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- NOVO MODAL: DIÁRIO DE MELHORIAS (AGENDA) ---
function ImprovementsLogbookDialog({ open, onOpenChange, parts }: any) {
  // Salva no localStorage para não requerer alterações no backend instantaneamente
  const [logs, setLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem("royale_3d_improvements");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [note, setNote] = useState("");
  const [partId, setPartId] = useState("geral");

  const handleSaveNote = () => {
    if (!note.trim()) return toast.error("Escreva alguma observação antes de salvar.");
    
    const newLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      partId,
      note: note.trim()
    };
    
    const updated = [newLog, ...logs];
    setLogs(updated);
    localStorage.setItem("royale_3d_improvements", JSON.stringify(updated));
    setNote("");
    toast.success("Melhoria registada no diário!");
  };

  const deleteLog = (id: string) => {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    localStorage.setItem("royale_3d_improvements", JSON.stringify(updated));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[32px] p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 flex flex-col max-h-[85vh]">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
            <div className="flex justify-between items-center">
                <div>
                    <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">Diário de Melhorias</DialogTitle>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Registe ajustes de fatiamento e ocorrências.</p>
                </div>
                <div className="h-12 w-12 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                    <Lightbulb className="h-6 w-6" strokeWidth={2.5} />
                </div>
            </div>
        </div>

        <div className="p-6 sm:p-8 bg-white dark:bg-slate-950 shrink-0 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex flex-col gap-3">
                <Select value={partId} onValueChange={setPartId}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 font-bold text-sm">
                        <SelectValue placeholder="Selecione o modelo afetado" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                        <SelectItem value="geral" className="font-bold py-2.5">Anotação Geral (Impressoras/Insumos)</SelectItem>
                        {parts.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)} className="font-bold py-2.5">
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="relative">
                    <Textarea 
                        placeholder="Ex: Aumentar temperatura do bico para 215º na próxima leva para evitar stringing..."
                        className="resize-none h-24 rounded-[16px] bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 font-medium text-sm p-4 focus-visible:ring-amber-500"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <Button onClick={handleSaveNote} size="sm" className="absolute bottom-3 right-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 shadow-lg shadow-amber-500/20">
                        Salvar Nota
                    </Button>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50 dark:bg-[#1A1A1A]">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Histórico de Anotações</h4>
            <div className="space-y-4">
                {logs.length === 0 ? (
                    <div className="text-center py-10">
                        <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-sm">O diário está vazio. Comece a documentar as suas melhorias.</p>
                    </div>
                ) : (
                    logs.map(log => {
                        const part = parts.find((p: any) => String(p.id) === log.partId);
                        return (
                            <div key={log.id} className="p-4 bg-white dark:bg-slate-900 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-800/80 group">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-none font-bold text-[10px] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                        {part ? part.name : "Geral"}
                                    </Badge>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400">{format(new Date(log.date), "dd/MM/yyyy HH:mm")}</span>
                                        <button onClick={() => deleteLog(log.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{log.note}</p>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
        
        <div className="p-4 sm:p-6 bg-white dark:bg-slate-950 shrink-0 border-t border-slate-100 dark:border-slate-800">
             <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full h-14 rounded-xl font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                Fechar Diário
             </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ icon: Icon, label, value, hint, colorClass }: any) {
  return (
    <Card className="relative overflow-hidden border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg transition-all duration-300 rounded-[24px] bg-white dark:bg-[#1A1A1A]">
      <CardContent className="relative p-6 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-4">
           <div className={cn("h-12 w-12 rounded-[16px] flex items-center justify-center shrink-0 shadow-inner", colorClass.bg)}>
             <Icon className={cn("h-6 w-6", colorClass.text)} />
           </div>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1">{label}</p>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{value}</p>
          {hint && <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1.5 truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function Producao3D() {
  const queryClient = useQueryClient();
  const { canAccess, profile } = useAuth(); 

  const [creating, setCreating] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false); // 🟢 ESTADO DA AGENDA DE MELHORIAS
  const [search, setSearch] = useState("");
  const [partFilter, setPartFilter] = useState("all");
  
  const [dateFilter, setDateFilter] = useState("currentMonth");
  const [view, setView] = useState<"cards" | "table">("cards");

  const canAdd = profile?.role === "admin" || canAccess("producao_3d:add"); 

  // === DADOS REAIS DO BACKEND ===
  const { data: parts = [] } = useQuery({ queryKey: ['producao_3d_parts'], queryFn: async () => (await api.get('/producao-3d/parts')).data });
  const { data: demands = [] } = useQuery({ queryKey: ['producao_3d_demands'], queryFn: async () => (await api.get('/producao-3d/demands')).data });
  const { data: productions = [], isLoading } = useQuery({ queryKey: ['producao_3d_history'], queryFn: async () => (await api.get('/producao-3d/productions')).data });

  // === MUTAÇÕES ===
  const addProductionMutation = useMutation({
    mutationFn: async (novaProducao: any) => (await api.post('/producao-3d/productions', novaProducao)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producao_3d_history'] });
      toast.success("Produção registrada com sucesso!");
      setCreating(false);
    },
    onError: () => toast.error("Erro ao registrar a produção. Tente novamente.")
  });

  const deleteProductionMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/producao-3d/productions/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producao_3d_history'] });
      toast.success("Produção removida.");
    }
  });

  // === CÁLCULOS E FILTROS DE TEMPO ===
  const dateRange = useMemo(() => {
    const now = new Date();
    switch(dateFilter) {
      case 'currentMonth': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth': {
        const lastM = subMonths(now, 1);
        return { start: startOfMonth(lastM), end: endOfMonth(lastM) };
      }
      case 'last3Months': return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'thisYear': return { start: startOfYear(now), end: endOfMonth(now) };
      default: return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) }; // All time
    }
  }, [dateFilter]);

  const filtered = useMemo(() => {
    return productions
      .filter((p: any) => {
        const d = new Date(p.date);
        return d >= dateRange.start && d <= dateRange.end;
      })
      .filter((p: any) => partFilter === "all" || String(p.partId) === partFilter)
      .filter((p: any) => {
        if (!search) return true;
        const part = parts.find((x: any) => String(x.id) === String(p.partId));
        const q = search.toLowerCase();
        return (
          part?.name.toLowerCase().includes(q) ||
          part?.code?.toLowerCase().includes(q) ||
          p.operator?.toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date));
  }, [productions, dateRange, partFilter, search, parts]);

  // AGRUPAR HISTÓRICO POR DIAS (Para a vista de Cartões)
  const groupedHistory = useMemo(() => {
    const groups: Record<string, Production[]> = {};
    filtered.forEach((p: Production) => {
        const dateKey = format(new Date(p.date), 'yyyy-MM-dd');
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(p);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filtered]);

  const totalQty = filtered.reduce((s: number, p: any) => s + Number(p.quantity), 0);
  const totalMin = filtered.reduce((s: number, p: any) => s + Number(p.totalMinutes), 0);
  const totalFil = filtered.reduce((s: number, p: any) => s + Number(p.filamentGrams), 0);
  
  const diasUnicos = new Set(filtered.map((p: any) => format(new Date(p.date), 'yyyy-MM-dd'))).size;
  const avgPerDay = diasUnicos > 0 ? (totalQty / diasUnicos).toFixed(1) : "0";

  const partOf = (id: string) => parts.find((p: any) => String(p.id) === String(id));
  const demandOf = (id?: string) => (id ? demands.find((d: any) => String(d.id) === String(id)) : undefined);

  const trend = useMemo(() => {
    const map = new Map<string, { date: string; pecas: number; filamento: number, timestamp: number }>();
    filtered.forEach((p: any) => {
      const d = new Date(p.date);
      const k = format(d, "dd/MM");
      const prev = map.get(k) ?? { date: k, pecas: 0, filamento: 0, timestamp: d.getTime() };
      prev.pecas += Number(p.quantity);
      prev.filamento += Number(p.filamentGrams);
      map.set(k, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [filtered]);

  const topParts = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((p: any) => {
       const partStrId = String(p.partId);
       m.set(partStrId, (m.get(partStrId) ?? 0) + Number(p.quantity));
    });
    return Array.from(m.entries())
      .map(([id, qty]) => ({ name: partOf(id)?.name ?? "?", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filtered, parts]);

  const operators = useMemo(() => {
    const m = new Map<string, { qty: number; minutes: number }>();
    filtered.forEach((p: any) => {
      const k = p.operator && p.operator.trim() !== "" ? p.operator : "Sistema";
      const prev = m.get(k) ?? { qty: 0, minutes: 0 };
      prev.qty += Number(p.quantity);
      prev.minutes += Number(p.totalMinutes);
      m.set(k, prev);
    });
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty);
  }, [filtered]);
  const maxOpQty = Math.max(1, ...operators.map((o) => o.qty));

  if (isLoading) {
    return <div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      
      {/* --- VISUAL DE CABEÇALHO PREMIUM --- */}
      <div className="relative overflow-hidden rounded-[2rem] border border-indigo-200/50 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 p-8 sm:p-10 shadow-lg">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[80px] pointer-events-none transform translate-x-1/3 -translate-y-1/3" />
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-white z-10">
          <div>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs uppercase font-bold tracking-widest text-indigo-200 mb-2">
              <Activity className="h-4 w-4" /> Diário de Operação
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-2">Linha de Produção</h1>
            <p className="text-sm sm:text-base text-indigo-100 font-medium max-w-xl">
              Lançamentos, consumos de matéria-prima e tempos de máquina da manufatura aditiva.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
              <Button 
                onClick={() => setAgendaOpen(true)} 
                variant="outline"
                className="h-14 px-6 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-black tracking-wide text-sm sm:text-base active:scale-95 transition-all w-full sm:w-auto"
              >
                <BookOpen className="h-5 w-5 mr-2" strokeWidth={2.5} /> Diário de Melhorias
              </Button>
              <Button 
                onClick={() => setCreating(true)} 
                disabled={parts.length === 0 || !canAdd} 
                className="h-14 px-6 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 shadow-xl shadow-black/10 font-black tracking-wide text-sm sm:text-base active:scale-95 transition-all w-full sm:w-auto"
              >
                <Plus className="h-5 w-5 mr-2" strokeWidth={3} /> Registrar Produção
              </Button>
          </div>
        </div>
      </div>

      {/* --- FILTRO DE TEMPO GLOBAL --- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-full shadow-sm w-max">
           <Calendar className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 shrink-0">Período:</span>
           {[
             { id: 'currentMonth', label: 'Mês Atual' },
             { id: 'lastMonth', label: 'Mês Passado' },
             { id: 'last3Months', label: '3 Meses' },
             { id: 'thisYear', label: 'Ano Atual' },
             { id: 'all', label: 'Tudo' }
           ].map((f) => (
             <button
               key={f.id}
               onClick={() => setDateFilter(f.id)}
               className={cn(
                 "px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                 dateFilter === f.id 
                 ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" 
                 : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
               )}
             >
               {f.label}
             </button>
           ))}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Package} colorClass={{bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400"}} label="Volume Produzido" value={String(totalQty)} hint={`${filtered.length} lançamentos registados`} />
        <KpiCard icon={Layers} colorClass={{bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400"}} label="Material Gasto" value={`${(totalFil / 1000).toFixed(2)} kg`} hint={`${totalFil.toLocaleString("pt-BR")} gramas totais`} />
        <KpiCard icon={Clock} colorClass={{bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400"}} label="Tempo de Máquina" value={formatMinutes(totalMin)} hint={`Média de ${formatMinutes(totalQty ? Math.round(totalMin / totalQty) : 0)} por peça`} />
        <KpiCard icon={TrendingUp} colorClass={{bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-600 dark:text-purple-400"}} label="Média Diária" value={String(avgPerDay)} hint="Peças / dia (nos dias com produção)" />
      </div>

      <div className="grid gap-5 lg:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-200/60 dark:border-white/10 rounded-[24px] shadow-sm overflow-hidden bg-white dark:bg-[#1A1A1A]">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" /> Fluxo Diário de Produção
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPecas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.2} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} dy={10} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} dx={-5} />
                <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" name="Peças" dataKey="pecas" stroke="#6366f1" strokeWidth={3} fill="url(#gradPecas)" activeDot={{ r: 6, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 dark:border-white/10 rounded-[24px] shadow-sm overflow-hidden bg-white dark:bg-[#1A1A1A]">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" /> Modelos Mais Fabricados
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topParts} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#cbd5e1" strokeOpacity={0.2} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 10, fill: '#64748b', fontWeight: 600}} />
                <Tooltip content={<CustomBarTooltip />} cursor={{fill: '#f1f5f9', opacity: 0.1}} />
                <Bar dataKey="qty" name="Qtd" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="qty" position="right" style={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {operators.length > 0 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {operators.map((op) => (
            <Card key={op.name} className="border-slate-200/60 dark:border-white/10 rounded-[20px] shadow-sm bg-white dark:bg-[#1A1A1A] hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm font-black shrink-0 border border-slate-200 dark:border-slate-700">
                                {op.name === "Sistema" ? <Factory className="h-4 w-4"/> : op.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{op.name}</span>
                        </div>
                        <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-black border-none text-sm">{op.qty}</Badge>
                    </div>
                    <Progress value={(op.qty / maxOpQty) * 100} className="h-1.5 bg-slate-100 dark:bg-slate-800 [&>div]:bg-indigo-500" />
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">{formatMinutes(op.minutes)} logados</p>
                </CardContent>
            </Card>
            ))}
        </div>
      )}

      <Card className="border-slate-200/60 dark:border-white/10 rounded-[24px] sm:rounded-[32px] shadow-sm bg-white dark:bg-[#1A1A1A] overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <CardTitle className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2.5 tracking-tight">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><List className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
                Lista de Registos 
              </CardTitle>
              
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative w-full sm:w-auto flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar peça ou op..." className="pl-9 h-10 w-full sm:w-[220px] rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500" />
                </div>
                <Select value={partFilter} onValueChange={setPartFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Filtrar peça" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as peças</SelectItem>
                    {parts.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")} className="w-full sm:w-auto">
                  <TabsList className="h-10 w-full sm:w-auto p-1 bg-slate-200/50 dark:bg-slate-800 rounded-xl">
                    <TabsTrigger value="cards" className="h-8 px-4 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                    <TabsTrigger value="table" className="h-8 px-4 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950"><List className="h-4 w-4" /></TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4"><Search className="h-6 w-6 opacity-50" /></div>
              <p className="text-lg font-black text-slate-700 dark:text-slate-300">Nenhum registo encontrado</p>
              <p className="text-sm font-medium mt-1">Tente ajustar os filtros ou o período selecionado.</p>
            </div>
          ) : view === "cards" ? (
            <div className="p-4 sm:p-6 lg:p-8 space-y-8">
              {groupedHistory.map(([dateString, items]) => (
                 <div key={dateString} className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="px-3 py-1 text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-none">
                            {getRelativeDayName(dateString)}
                        </Badge>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800/50"></div>
                    </div>
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {items.map((p: Production) => {
                            const part = partOf(p.partId);
                            const demand = demandOf(p.demandId);
                            return (
                            <div key={p.id} className="group relative rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900/50 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                <div className="flex gap-3 p-4">
                                {part && (
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700">
                                      <img src={part.image || '/placeholder-3d.png'} alt={part.name} className="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1 flex flex-col justify-center">
                                    <p className="font-bold text-[13px] sm:text-[14px] text-slate-800 dark:text-slate-200 truncate leading-tight">{part?.name ?? "—"}</p>
                                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-0.5">{part?.code}</p>
                                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-2 bg-slate-50 dark:bg-slate-800/50 w-max px-2 py-0.5 rounded-md">
                                        <User className="h-3 w-3" /> {p.operator && p.operator.trim() !== "" ? p.operator : "Sistema"}
                                    </div>
                                </div>
                                </div>
                                
                                <div className="grid grid-cols-3 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20 text-center divide-x divide-slate-100 dark:divide-slate-800/50">
                                    <div className="py-2.5">
                                        <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-widest">Qtd</p>
                                        <p className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200">{p.quantity}</p>
                                    </div>
                                    <div className="py-2.5">
                                        <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-widest">Tempo</p>
                                        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">{formatMinutes(p.totalMinutes)}</p>
                                    </div>
                                    <div className="py-2.5">
                                        <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-widest">Gasto</p>
                                        <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">{p.filamentGrams}g</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 h-12">
                                    {demand ? (
                                        <Badge variant="outline" className="font-mono font-bold text-[9px] sm:text-[10px] gap-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        OP: {demand.opNumber}
                                        </Badge>
                                    ) : <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">Sem vínculo</span>}
                                    
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onClick={() => deleteProductionMutation.mutate(p.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                 </div>
              ))}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
                <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                    <TableRow className="border-slate-100 dark:border-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 whitespace-nowrap pl-6">Data</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">Peça</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Qtd</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Tempo</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Material</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 whitespace-nowrap">Operador</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">Vínculo</TableHead>
                    <TableHead className="w-12 pr-6"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.map((p: Production) => {
                    const part = partOf(p.partId);
                    const demand = demandOf(p.demandId);
                    return (
                        <TableRow key={p.id} className="border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <TableCell className="text-xs font-semibold text-slate-500 whitespace-nowrap pl-6">{format(new Date(p.date), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3 min-w-[200px]">
                            {part && <img src={part.image || '/placeholder-3d.png'} alt={part.name} className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />}
                            <div className="min-w-0 flex flex-col justify-center">
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{part?.name ?? "—"}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{part?.code}</p>
                            </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-black text-slate-800 dark:text-slate-200 text-sm">{p.quantity}</TableCell>
                        <TableCell className="text-center font-semibold text-slate-600 dark:text-slate-300 text-sm">{formatMinutes(p.totalMinutes)}</TableCell>
                        <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400 text-sm">{p.filamentGrams}g</TableCell>
                        <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.operator && p.operator.trim() !== "" ? p.operator : "Sistema"}</TableCell>
                        <TableCell>
                            {demand ? (
                            <Badge variant="outline" className="font-mono font-bold text-[10px] whitespace-nowrap bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">OP: {demand.opNumber}</Badge>
                            ) : <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">—</span>}
                        </TableCell>
                        <TableCell className="pr-6">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg" onClick={() => deleteProductionMutation.mutate(p.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: REGISTRAR PRODUÇÃO */}
      {creating && (
        <NewProductionDialog 
          open={creating} 
          onOpenChange={setCreating} 
          parts={parts} 
          demands={demands} 
          onAdd={(data: any) => addProductionMutation.mutate(data)} 
        />
      )}

      {/* MODAL 2: DIÁRIO DE MELHORIAS */}
      {agendaOpen && (
        <ImprovementsLogbookDialog 
          open={agendaOpen} 
          onOpenChange={setAgendaOpen} 
          parts={parts}
        />
      )}
    </div>
  );
}
