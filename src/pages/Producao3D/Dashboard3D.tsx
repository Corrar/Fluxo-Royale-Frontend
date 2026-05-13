import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // <--- IMPORTAÇÃO CORRIGIDA AQUI
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, AreaChart, Area 
} from "recharts";
import { 
  Printer, Clock, Layers, CheckCircle2, 
  TrendingUp, Activity, Package, Calendar
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Utilitário para formatar minutos de forma legível
const formatMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

export default function Dashboard3D() {
  // 1. Procura o histórico real de produções
  const { data: productions = [], isLoading: loadingProd } = useQuery({
    queryKey: ["productions-3d"],
    queryFn: async () => (await api.get("/producao-3d/productions")).data,
  });

  // 2. Procura os produtos para poder cruzar nomes e imagens
  const { data: products = [], isLoading: loadingParts } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await api.get("/products")).data,
  });

  const isLoading = loadingProd || loadingParts;

  // 3. Cálculos de Métricas Globais
  const stats = useMemo(() => {
    return {
      totalPieces: productions.reduce((acc: number, p: any) => acc + p.quantity, 0),
      totalFilament: productions.reduce((acc: number, p: any) => acc + p.filamentGrams, 0),
      totalTime: productions.reduce((acc: number, p: any) => acc + p.totalMinutes, 0),
      countOrders: productions.length,
    };
  }, [productions]);

  // 4. Preparação dos dados para o Gráfico (Produção por dia)
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    });

    const dataMap: Record<string, any> = {};
    last7Days.forEach(day => dataMap[day] = { day, peças: 0, filamento: 0 });

    productions.forEach((p: any) => {
      const dateKey = new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (dataMap[dateKey]) {
        dataMap[dateKey].peças += p.quantity;
        dataMap[dateKey].filamento += p.filamentGrams;
      }
    });

    return Object.values(dataMap);
  }, [productions]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 lg:p-6 animate-in fade-in duration-700 pb-32 lg:pb-6 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Indicadores de Produção</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Visão em tempo real da performance da impressora</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-full border border-emerald-500/20">
          <Activity className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Sistema Online</span>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/10 rounded-xl"><Package className="h-5 w-5 text-blue-500" /></div>
              <Badge className="bg-blue-500/10 text-blue-500 border-none">Total Peças</Badge>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalPieces}</p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Unidades produzidas</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-xl"><Layers className="h-5 w-5 text-emerald-500" /></div>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-none">Material</Badge>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalFilament}g</p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Filamento utilizado</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-500/10 rounded-xl"><Clock className="h-5 w-5 text-amber-500" /></div>
              <Badge className="bg-amber-500/10 text-amber-500 border-none">Tempo</Badge>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{formatMinutes(stats.totalTime)}</p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Horas de impressão</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-500/10 rounded-xl"><CheckCircle2 className="h-5 w-5 text-purple-500" /></div>
              <Badge className="bg-purple-500/10 text-purple-500 border-none">Eficiência</Badge>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.countOrders}</p>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">Ordens finalizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Volume de Peças (7 Dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPieces" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="peças" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPieces)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" /> Consumo de Filamento (7 Dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: '#88888810'}}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="filamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ÚLTIMAS ATIVIDADES REAIS */}
      <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-2xl">
        <CardHeader className="border-b border-slate-100 dark:border-white/5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" /> Registo Recente de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {productions.slice(-5).reverse().map((p: any) => {
              const product = products.find((prod: any) => prod.id === p.partId);
              return (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                       {product?.image_url ? (
                         <img src={product.image_url} alt="" className="object-cover h-full w-full" />
                       ) : (
                         <Printer className="h-5 w-5 text-slate-400" />
                       )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {product?.name || "Peça Desconhecida"}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {new Date(p.date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">+{p.quantity} un.</p>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{p.filamentGrams}g gastos</p>
                  </div>
                </div>
              );
            })}
            {productions.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum registo de produção encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
