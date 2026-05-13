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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Clock, Factory, Weight, Package, Trash2, Search, TrendingUp,
  CalendarDays, User, Hash, LayoutGrid, List, Activity, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext"; // <-- ADICIONADO: Importar useAuth

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

// Função auxiliar para formatar os minutos em horas
const formatMinutes = (mins: number) => {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// --- COMPONENTES FILHOS ---

function NewProductionDialog({ open, onOpenChange, parts, demands, onAdd }: any) {
  const [partId, setPartId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [operator, setOperator] = useState("");
  const [demandId, setDemandId] = useState<string>("none");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [extraMinutes, setExtraMinutes] = useState(0);

  // Garante que a primeira peça seja selecionada por padrão assim que os dados carregam
  useEffect(() => {
    if (parts.length > 0 && !partId) {
      setPartId(String(parts[0].id));
    }
  }, [parts, partId]);

  const part = parts.find((p: any) => String(p.id) === partId);
  const totalMinutes = part ? Number(part.productionMinutes) * quantity + extraMinutes : 0;
  const filamentGrams = part ? Number(part.filamentGrams) * quantity : 0;
  const eligibleDemands = demands.filter((d: any) => String(d.partId) === partId && d.status !== "Concluída");

  const handleSave = () => {
    if (!partId) { 
      toast.error("Preencha a peça para registar."); 
      return; 
    }
    
    onAdd({
      partId, 
      quantity, 
      operator, // Mesmo que o backend o sobreescreva com o utilizador logado, enviamos para evitar falhas
      totalMinutes, 
      filamentGrams,
      date: new Date(date).toISOString(),
      demandId: demandId === "none" ? null : demandId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar produção</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>Peça</Label>
            <Select value={partId} onValueChange={(v) => { setPartId(v); setDemandId("none"); }}>
              <SelectTrigger><SelectValue placeholder="Selecione uma peça" /></SelectTrigger>
              <SelectContent>
                {parts.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} <span className="text-muted-foreground font-mono ml-1">({p.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operador</Label>
              <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Tempo extra (min)</Label>
              <Input type="number" min={0} value={extraMinutes} onChange={(e) => setExtraMinutes(Math.max(0, +e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Vincular demanda (opcional)</Label>
            <Select value={demandId} onValueChange={setDemandId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                {eligibleDemands.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.opNumber} — {d.requester} (qtd {d.quantity})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="bg-accent/30 border-accent">
            <CardContent className="p-3 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Tempo:</span>
                <span className="font-semibold tabular-nums">{formatMinutes(totalMinutes)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Filamento:</span>
                <span className="font-semibold tabular-nums">{filamentGrams}g</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ icon: Icon, label, value, hint, accent }: any) {
  // Substituídos os nomes genéricos por cores explícitas do Tailwind para compatibilidade com Fluxo Royale
  const accents: Record<string, string> = {
    primary: "from-primary/15 to-primary/0 text-primary",
    info: "from-blue-500/15 to-blue-500/0 text-blue-500",
    success: "from-emerald-500/15 to-emerald-500/0 text-emerald-500",
    warning: "from-orange-500/20 to-orange-500/0 text-orange-500",
  };
  return (
    <Card className="relative overflow-hidden border-border/60 hover:shadow-md transition-shadow">
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", accents[accent])} />
      <CardContent className="relative p-5 flex items-start gap-4">
        <div className={cn("h-11 w-11 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center shrink-0 shadow-sm", accents[accent].split(" ").pop())}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// --- PÁGINA PRINCIPAL ---

export default function Producao3D() {
  const queryClient = useQueryClient();
  const { canAccess, profile } = useAuth(); // <-- ADICIONADO: Obter perfil e permissões

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [partFilter, setPartFilter] = useState("all");
  const [period, setPeriod] = useState("30");
  const [view, setView] = useState<"cards" | "table">("cards");

  // Verifica permissão para adicionar (admin tem acesso total, ou se tiver a permissão específica 'producao_3d:add')
  const canAdd = profile?.role === "admin" || canAccess("producao_3d:add"); // <-- ADICIONADO: Variável de permissão

  // === DADOS REAIS DO BACKEND (REACT QUERY) ===
  const { data: parts = [] } = useQuery({
    queryKey: ['producao_3d_parts'],
    queryFn: async () => {
      const res = await api.get('/producao-3d/parts');
      return res.data;
    }
  });

  const { data: demands = [] } = useQuery({
    queryKey: ['producao_3d_demands'],
    queryFn: async () => {
      const res = await api.get('/producao-3d/demands');
      return res.data;
    }
  });

  const { data: productions = [], isLoading } = useQuery({
    queryKey: ['producao_3d_history'],
    queryFn: async () => {
      const res = await api.get('/producao-3d/productions');
      return res.data;
    }
  });

  // === MUTAÇÕES (POST e DELETE) ===
  const addProductionMutation = useMutation({
    mutationFn: async (novaProducao: any) => {
      const res = await api.post('/producao-3d/productions', novaProducao);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producao_3d_history'] });
      toast.success("Produção registrada com sucesso!");
      setCreating(false);
    },
    onError: (err) => {
      console.error("Erro no registo:", err);
      toast.error("Erro ao registrar a produção. Tente novamente.");
    }
  });

  const deleteProductionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/producao-3d/productions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producao_3d_history'] });
      toast.success("Produção removida.");
    }
  });

  // === CÁLCULOS E FILTROS ===
  const filtered = useMemo(() => {
    const cutoff = period === "all" ? 0 : Date.now() - +period * 86400000;
    return productions
      .filter((p: any) => +new Date(p.date) >= cutoff)
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
  }, [productions, period, partFilter, search, parts]);

  const totalQty = filtered.reduce((s: number, p: any) => s + Number(p.quantity), 0);
  const totalMin = filtered.reduce((s: number, p: any) => s + Number(p.totalMinutes), 0);
  const totalFil = filtered.reduce((s: number, p: any) => s + Number(p.filamentGrams), 0);
  const avgPerDay = filtered.length && period !== "all" ? (totalQty / +period).toFixed(1) : "—";

  const partOf = (id: string) => parts.find((p: any) => String(p.id) === String(id));
  const demandOf = (id?: string) => (id ? demands.find((d: any) => String(d.id) === String(id)) : undefined);

  // Gráfico Diário
  const trend = useMemo(() => {
    const map = new Map<string, { date: string; pecas: number; filamento: number }>();
    filtered.slice().reverse().forEach((p: any) => {
      const k = format(new Date(p.date), "dd/MM");
      const prev = map.get(k) ?? { date: k, pecas: 0, filamento: 0 };
      prev.pecas += Number(p.quantity);
      prev.filamento += Number(p.filamentGrams);
      map.set(k, prev);
    });
    return Array.from(map.values());
  }, [filtered]);

  // Peças Top
  const topParts = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((p: any) => {
       const partStrId = String(p.partId);
       m.set(partStrId, (m.get(partStrId) ?? 0) + Number(p.quantity));
    });
    return Array.from(m.entries())
      .map(([id, qty]) => ({ name: partOf(id)?.code ?? "?", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filtered, parts]);

  // Ranking Operadores
  const operators = useMemo(() => {
    const m = new Map<string, { qty: number; minutes: number }>();
    filtered.forEach((p: any) => {
      const k = p.operator ?? "—";
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
    return <div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      
      {/* --- VISUAL DE CABEÇALHO IDÊNTICO AO LOVABLE --- */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-primary to-blue-600 p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)] opacity-20" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 text-white">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
              <Activity className="h-3.5 w-3.5" /> Operação em tempo real
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Produção</h1>
            <p className="text-sm opacity-90 mt-1">Histórico de impressões, consumo de filamento e desempenho da equipe</p>
          </div>
          {/* AQUI ESTAVA O PROBLEMA! O BOTÃO FICAVA SEMPRE DESATIVADO SE parts.length FOSSE 0 */}
          <Button 
            onClick={() => setCreating(true)} 
            variant="secondary" 
            className="shadow-md text-primary hover:text-primary/80" 
            disabled={parts.length === 0 || !canAdd} // <-- ADICIONADO: Bloqueia se não tiver peças OU se não tiver permissão
          >
            <Plus className="h-4 w-4 mr-1" /> Registrar produção
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Package} accent="primary" label="Peças produzidas" value={String(totalQty)} hint={`${filtered.length} registros`} />
        <KpiCard icon={Clock} accent="info" label="Tempo total" value={formatMinutes(totalMin)} hint={`Média ${formatMinutes(totalQty ? Math.round(totalMin / totalQty) : 0)} / peça`} />
        <KpiCard icon={Weight} accent="warning" label="Filamento" value={`${(totalFil / 1000).toFixed(2)} kg`} hint={`${totalFil.toLocaleString("pt-BR")} g`} />
        <KpiCard icon={TrendingUp} accent="success" label="Média / dia" value={String(avgPerDay)} hint={period === "all" ? "Período total" : `Últimos ${period} dias`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Tendência de produção
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="gradPecas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.58 0.18 235)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.58 0.18 235)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 230)" />
                <XAxis dataKey="date" stroke="oklch(0.50 0.03 240)" fontSize={11} />
                <YAxis stroke="oklch(0.50 0.03 240)" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.015 230)", fontSize: 12, backgroundColor: 'var(--background)' }} />
                <Area type="monotone" dataKey="pecas" stroke="oklch(0.58 0.18 235)" strokeWidth={2.5} fill="url(#gradPecas)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Top peças
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topParts} layout="vertical" margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.015 230)" />
                <XAxis type="number" stroke="oklch(0.50 0.03 240)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="oklch(0.50 0.03 240)" fontSize={11} width={70} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.91 0.015 230)", fontSize: 12, backgroundColor: 'var(--background)' }} />
                <Bar dataKey="qty" fill="oklch(0.72 0.16 200)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {operators.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Desempenho por operador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {operators.map((op) => (
                <div key={op.name} className="rounded-lg border border-border/60 p-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {op.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium truncate">{op.name}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{op.qty}</span>
                  </div>
                  <Progress value={(op.qty / maxOpQty) * 100} className="mt-2 h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1.5">{formatMinutes(op.minutes)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" /> Histórico de produções
          </CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 h-9 w-[200px]" />
            </div>
            <Select value={partFilter} onValueChange={setPartFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as peças</SelectItem>
                {parts.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")}>
              <TabsList className="h-9">
                <TabsTrigger value="cards" className="h-7 px-2"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                <TabsTrigger value="table" className="h-7 px-2"><List className="h-4 w-4" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Factory className="h-10 w-10 mx-auto opacity-40 mb-2" />
              <p className="text-sm">Nenhuma produção no período</p>
            </div>
          ) : view === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p: Production) => {
                const part = partOf(p.partId);
                const demand = demandOf(p.demandId);
                return (
                  <div key={p.id} className="group relative rounded-xl border border-border/60 bg-card overflow-hidden hover:shadow-md hover:border-primary/40 transition-all">
                    <div className="flex gap-3 p-3">
                      {part && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0 ring-1 ring-border/60">
                          <img src={part.image || '/placeholder-3d.png'} alt={part.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{part?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{part?.code}</p>
                          </div>
                          {part?.material && <Badge variant="outline" className="text-[10px] shrink-0">{part.material}</Badge>}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(p.date), "dd/MM/yyyy")}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <User className="h-3 w-3" /> {p.operator ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 border-t border-border/60 bg-muted/30 text-center">
                      <div className="py-2 border-r border-border/60">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Qtd</p>
                        <p className="text-sm font-semibold tabular-nums">{p.quantity}</p>
                      </div>
                      <div className="py-2 border-r border-border/60">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tempo</p>
                        <p className="text-sm font-semibold tabular-nums">{formatMinutes(p.totalMinutes)}</p>
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Filamento</p>
                        <p className="text-sm font-semibold tabular-nums">{p.filamentGrams}g</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border/60">
                      {demand ? (
                        <Badge variant="outline" className="font-mono text-[10px] gap-1">
                          <Hash className="h-3 w-3" />{demand.opNumber}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">Sem demanda</span>}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10" onClick={() => deleteProductionMutation.mutate(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead className="text-right">Filamento</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>OP</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: Production) => {
                  const part = partOf(p.partId);
                  const demand = demandOf(p.demandId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs tabular-nums">{format(new Date(p.date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          {part && <img src={part.image || '/placeholder-3d.png'} alt={part.name} className="w-8 h-8 rounded object-cover border border-border/60 shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{part?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{part?.code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{p.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatMinutes(p.totalMinutes)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{p.filamentGrams}g</TableCell>
                      <TableCell className="text-sm">{p.operator ?? "—"}</TableCell>
                      <TableCell>
                        {demand ? (
                          <Badge variant="outline" className="font-mono text-[10px]">{demand.opNumber}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteProductionMutation.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <NewProductionDialog 
          open={creating} 
          onOpenChange={setCreating} 
          parts={parts} 
          demands={demands} 
          onAdd={(data: any) => addProductionMutation.mutate(data)} 
        />
      )}
    </div>
  );
}
