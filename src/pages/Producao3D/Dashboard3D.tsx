// src/pages/Producao3D/Dashboard3D.tsx

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area 
} from "recharts";
import { 
  Printer, Clock, Layers, CheckCircle2, 
  TrendingUp, Activity, Package, Calendar, Filter
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

// Utilitário para formatar minutos de forma legível
const formatMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

// 🎨 TOOLTIP CUSTOMIZADA PARA OS GRÁFICOS
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-100 dark:border-slate-800 p-3 sm:p-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)]">
        <p className="font-black text-slate-900 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-sm">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm font-medium">
              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500 dark:text-slate-400 capitalize">{entry.name}:</span>
              <span className="text-slate-900 dark:text-white font-bold">
                {entry.value}{entry.name === 'filamento' ? 'g' : ' un.'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard3D() {
  // 🟢 ESTADO PARA O FILTRO DE PERÍODO (7, 15, 30, 90 dias)
  const [periodDays, setPeriodDays] = useState<number>(7);

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

  // 🟢 FILTRA AS PRODUÇÕES COM BASE NO PERÍODO SELECIONADO
  const filteredProductions = useMemo(() => {
    const cutoffDate = startOfDay(subDays(new Date(), periodDays - 1));
    return productions.filter((p: any) => new Date(p.date) >= cutoffDate);
  }, [productions, periodDays]);

  // 3. Cálculos de Métricas Globais (Baseado no filtro)
  const stats = useMemo(() => {
    return {
      totalPieces: filteredProductions.reduce((acc: number, p: any) => acc + p.quantity, 0),
      totalFilament: filteredProductions.reduce((acc: number, p: any) => acc + p.filamentGrams, 0),
      totalTime: filteredProductions.reduce((acc: number, p: any) => acc + p.totalMinutes, 0),
      countOrders: filteredProductions.length,
    };
  }, [filteredProductions]);

  // 4. Preparação dos dados para o Gráfico (Eixo X dinâmico e contínuo)
  const chartData = useMemo(() => {
    const endDate = new Date();
    const startDate = startOfDay(subDays(endDate, periodDays - 1));
    
    // Cria um array com TODOS os dias do período (para não haver "buracos" no gráfico se não houver produção num dia)
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const dataMap: Record<string, any> = {};
    
    dateRange.forEach(d => {
      // Usamos dd/MMM para formato curto (ex: 12/Jun)
      const label = format(d, "dd MMM", { locale: ptBR }); 
      // Usamos YYYY-MM-DD como chave real para o cruzamento exato
      const key = format(d, "yyyy-MM-dd"); 
      dataMap[key] = { label, dayFormat: d, peças: 0, filamento: 0 };
    });

    filteredProductions.forEach((p: any) => {
      const pDate = new Date(p.date);
      const key = format(pDate, "yyyy-MM-dd");
      if (dataMap[key]) {
        dataMap[key].peças += p.quantity;
        dataMap[key].filamento += p.filamentGrams;
      }
    });

    return Object.values(dataMap).sort((a: any, b: any) => a.dayFormat.getTime() - b.dayFormat.getTime());
  }, [filteredProductions, periodDays]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-[24px]" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-[32px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 animate-in fade-in duration-700 pb-32 lg:pb-6 max-w-7xl mx-auto">
      
      {/* HEADER & FILTROS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-emerald-500" />
            Indicadores de Produção
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Visão de performance da fábrica 3D
          </p>
        </div>
        
        {/* 🟢 SELETOR DE PERÍODO ELEGANTE */}
        <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#1A1A1A] border border-slate-200/60 dark:border-white/5 rounded-full shadow-sm">
          <div className="pl-3 pr-1 text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 hidden sm:flex">
             <Filter className="h-3 w-3" /> Período
          </div>
          {[7, 15, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setPeriodDays(days)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 active:scale-95 ${
                periodDays === days 
                ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-md" 
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              {days} Dias
            </button>
          ))}
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-[14px]"><Package className="h-5 w-5 text-blue-600 dark:text-blue-500" /></div>
              <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-none font-bold">Total Peças</Badge>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.totalPieces}</p>
            <p className="text-[11px] text-slate-500 mt-1.5 uppercase font-bold tracking-widest">Unidades produzidas</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-[14px]"><Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-500" /></div>
              <Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-none font-bold">Material</Badge>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.totalFilament}<span className="text-xl text-slate-400 ml-0.5">g</span></p>
            <p className="text-[11px] text-slate-500 mt-1.5 uppercase font-bold tracking-widest">Filamento utilizado</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-[14px]"><Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" /></div>
              <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-none font-bold">Tempo</Badge>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{formatMinutes(stats.totalTime)}</p>
            <p className="text-[11px] text-slate-500 mt-1.5 uppercase font-bold tracking-widest">Horas de impressão</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-[14px]"><CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-500" /></div>
              <Badge className="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border-none font-bold">Eficiência</Badge>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.countOrders}</p>
            <p className="text-[11px] text-slate-500 mt-1.5 uppercase font-bold tracking-widest">Ordens finalizadas</p>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS PREMIUM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm">
          <CardHeader className="p-6 sm:p-8 pb-2">
            <CardTitle className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-widest">
              <TrendingUp className="h-5 w-5 text-emerald-500" /> Volume de Peças ({periodDays} Dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="h-[280px] sm:h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPieces" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888'}} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888'}} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="peças" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorPieces)" activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm">
          <CardHeader className="p-6 sm:p-8 pb-2">
            <CardTitle className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-widest">
              <Layers className="h-5 w-5 text-blue-500" /> Consumo de Filamento ({periodDays} Dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="h-[280px] sm:h-[320px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888'}} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#888'}} />
                  {/* 🟢 REMOVIDO o radius: [8,8,0,0] daqui para corrigir o erro TypeScript */}
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#88888810' }} />
                  <Bar dataKey="filamento" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ÚLTIMAS ATIVIDADES REAIS (Apenas do período filtrado) */}
      <Card className="border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1A1A] rounded-[24px] shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-white/5 p-6 sm:p-8">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-slate-800 dark:text-white">
            <Calendar className="h-5 w-5 text-slate-400" /> Registo de Produção ({periodDays} Dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {[...filteredProductions]
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5) // Mostra sempre os 5 mais recentes DENTRO DO PERÍODO selecionado
              .map((p: any) => {
              const product = products.find((prod: any) => prod.id === p.partId);
              return (
                <div key={p.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-[14px] bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                       {product?.image_url ? (
                         <img src={product.image_url} alt="" className="object-cover h-full w-full" />
                       ) : (
                         <Printer className="h-6 w-6 text-slate-400" />
                       )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] sm:text-[16px] font-black text-slate-900 dark:text-white leading-tight truncate">
                        {product?.name || "Peça Desconhecida"}
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5">
                        {format(new Date(p.date), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] sm:text-[17px] font-black text-emerald-600 dark:text-emerald-400">+{p.quantity} <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold ml-0.5">un</span></p>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{p.filamentGrams}g gastos</p>
                  </div>
                </div>
              );
            })}
            {filteredProductions.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center">
                 <Package className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                 <p className="font-bold text-slate-800 dark:text-white text-lg">Sem produção no período</p>
                 <p className="text-slate-500 text-sm mt-1">Não foram registadas peças nos últimos {periodDays} dias.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
