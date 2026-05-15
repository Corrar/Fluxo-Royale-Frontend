// src/pages/Reports.tsx

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileSpreadsheet, FileText, 
  TrendingDown, TrendingUp, RefreshCw, Activity,
  Package, ArrowUpRight, ArrowDownRight, Archive, Calendar as CalendarIcon,
  DollarSign, Clock, BarChart3, Zap, ShieldAlert, Receipt,
  ArrowDownToLine, ArrowUpFromLine, Search, Briefcase, Construction, Layers, Plane,
  AlertTriangle, AlertOctagon, Lock, Recycle, FileBox,
  Printer, CheckCircle2, Truck, ListChecks 
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas"; 
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line
} from "recharts";
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// --- CONFIGURAÇÕES VISUAIS PREMIUM ---
const C_AZUL_ROYALE: [number, number, number] = [30, 58, 138]; 
const C_AMARELO_OURO: [number, number, number] = [234, 179, 8]; 
const C_TEXTO_ESCURO: [number, number, number] = [51, 65, 85]; 

const COLORS = {
  entradas: '#10b981', // Emerald
  saidas: '#6366f1',   // Indigo
  manuais: '#f59e0b',  // Amber
  prod3d: '#3b82f6',   // Blue
  reposicoes: '#8b5cf6'// Purple
};

const CHART_PALETTE = [
  '#820ad1', '#06b6d4', '#f59e0b', '#ec4899', '#3b82f6', 
  '#10b981', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316',
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatCurrencyNoDecimals = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

const getBase64FromUrl = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result ? reader.result as string : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return ""; 
  }
};

// --- COMPONENTES UI REFINADOS ---

// Tooltip Glassmorphism Premium para o Gráfico de Barras Principal
const GlassTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-2xl shadow-2xl z-50 min-w-[220px]">
                <p className="font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-200 dark:border-slate-800">{label}</p>
                <div className="flex flex-col gap-3">
                    {payload.map((entry: any, index: number) => {
                        // Extrai a cor base para evitar passar "url(#id)" para o style de background
                        let bgColor = entry.fill;
                        if (bgColor.includes('url(#colorEntradas)')) bgColor = COLORS.entradas;
                        if (bgColor.includes('url(#colorSaidas)')) bgColor = COLORS.saidas;
                        if (bgColor.includes('url(#colorManuais)')) bgColor = COLORS.manuais;
                        if (bgColor.includes('url(#colorProd3D)')) bgColor = COLORS.prod3d;
                        if (bgColor.includes('url(#colorReposicoes)')) bgColor = COLORS.reposicoes;

                        return (
                            <div key={index} className="flex justify-between items-center gap-6">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: bgColor }}></div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{entry.name}</span>
                                </div>
                                <span className="font-black text-slate-900 dark:text-white text-sm">{entry.value}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

const CustomLineTooltip = ({ active, payload, label, isCurrency = true }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const value = data.value;
      const name = data.dataKey;
      const color = data.stroke || data.fill;
      
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-[1rem] shadow-2xl text-sm z-50 ring-1 ring-black/5 dark:ring-white/5">
          <p className="font-bold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-[0.2em] text-[10px]">{label}</p>
          <div className="flex justify-between gap-8 items-center">
              <span className="flex items-center gap-2.5 font-semibold text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }}></span>
                  {name === 'Total' ? 'Visão Global' : name}
              </span>
              <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">
                  {isCurrency ? formatCurrency(value) : value}
              </span>
          </div>
        </div>
      );
    }
    return null;
  };

const NubankLineChart = ({ timelineData, sectorTotals, totalValue, title, icon: Icon }: any) => {
    const [activeSector, setActiveSector] = useState<string | null>(null);

    const currentTotal = activeSector 
        ? (sectorTotals.find((s: any) => s.name === activeSector)?.value || 0)
        : totalValue;

    const currentColor = activeSector
        ? (sectorTotals.find((s: any) => s.name === activeSector)?.fill || '#820ad1')
        : '#820ad1'; 

    const dataKey = activeSector || "Total";

    return (
        <Card className="gsap-chart-card shadow-lg border border-white/40 dark:border-slate-800/60 flex flex-col h-full rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl hover:shadow-xl transition-all duration-500 overflow-hidden w-full mx-auto relative group">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none transition-all duration-700 group-hover:bg-indigo-500/10" style={{ backgroundColor: `${currentColor}1A` }} />
            
            <CardHeader className="pb-0 pt-10 px-8 sm:px-12 border-none flex flex-col gap-1 items-start relative z-10">
                <CardTitle className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2.5">
                    {Icon && <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md"><Icon className="h-4 w-4" /></div>} 
                    {title} {activeSector ? <span className="text-slate-400 font-medium tracking-normal capitalize ml-1">• {activeSector}</span> : <span className="text-slate-400 font-medium tracking-normal capitalize ml-1">• Visão Global</span>}
                </CardTitle>
                <div className="text-5xl sm:text-6xl font-black tracking-tighter text-slate-900 dark:text-white mt-3 transition-colors duration-500" style={{ color: activeSector ? currentColor : undefined }}>
                    {formatCurrency(currentTotal)}
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 pt-10 pb-8 px-6 sm:px-10 flex flex-col lg:flex-row gap-8 relative z-10">
                <div className="flex-1 min-h-[350px] sm:min-h-[450px]">
                    {timelineData && timelineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.2} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 500}} dy={15} />
                                <Tooltip content={<CustomLineTooltip isCurrency={true} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Line 
                                    key={dataKey}
                                    type="monotone" 
                                    dataKey={dataKey} 
                                    stroke={currentColor} 
                                    strokeWidth={5}
                                    dot={false}
                                    activeDot={{ r: 8, fill: currentColor, stroke: '#ffffff', strokeWidth: 3, className: "shadow-xl" }}
                                    isAnimationActive={true}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-full"><Activity className="h-8 w-8 opacity-40" /></div>
                            <span className="text-sm font-medium tracking-wide">Sem dados na linha do tempo</span>
                        </div>
                    )}
                </div>
                
                <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto max-h-[350px] sm:max-h-[450px] custom-scrollbar pr-3 shrink-0">
                    <div 
                        onClick={() => setActiveSector(null)}
                        className="p-5 rounded-[1.25rem] cursor-pointer border transition-all duration-300 flex items-center justify-between group/btn hover:scale-[1.02]"
                        style={{
                            borderColor: activeSector === null ? '#820ad1' : 'transparent',
                            backgroundColor: activeSector === null ? 'rgba(130, 10, 209, 0.08)' : 'rgba(241, 245, 249, 0.5)'
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center border-[3px] transition-all", activeSector === null ? "border-[#820ad1]" : "border-slate-300 dark:border-slate-600")}>
                                {activeSector === null && <div className="w-2.5 h-2.5 rounded-full bg-[#820ad1]"></div>}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">Visão Global</span>
                        </div>
                        <span className="font-black text-[#820ad1] text-sm">{formatCurrency(totalValue)}</span>
                    </div>

                    {sectorTotals.map((sector: any) => {
                        const isActive = activeSector === sector.name;
                        const percent = totalValue > 0 ? ((sector.value / totalValue) * 100).toFixed(1) : 0;
                        const bgRgba = `${sector.fill}1A`; 

                        return (
                        <div 
                            key={sector.name}
                            onClick={() => setActiveSector(sector.name)}
                            className="p-4 rounded-[1.25rem] cursor-pointer border border-transparent transition-all duration-300 flex items-center justify-between group/btn hover:scale-[1.02] hover:bg-slate-100 dark:hover:bg-slate-800/80"
                            style={{
                                borderColor: isActive ? sector.fill : 'transparent',
                                backgroundColor: isActive ? bgRgba : undefined
                            }}
                        >
                            <div className="flex items-center gap-3 overflow-hidden pr-2 w-full">
                                <div className={cn("w-4 h-4 shrink-0 rounded-full flex items-center justify-center border-2 transition-all", isActive ? "" : "border-slate-300 dark:border-slate-600")} style={{ borderColor: isActive ? sector.fill : undefined }}>
                                    {isActive && <div className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: sector.fill }}></div>}
                                </div>
                                <div className="flex flex-col truncate">
                                    <span className={cn("font-bold truncate text-[13px] transition-colors", isActive ? "dark:text-white text-slate-900" : "text-slate-600 dark:text-slate-300")} title={sector.name}>{sector.name}</span>
                                    <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">{percent}% do total</span>
                                </div>
                            </div>
                            <span className={cn("font-black text-sm shrink-0 transition-colors", isActive ? "" : "text-slate-500 dark:text-slate-400")} style={{ color: isActive ? sector.fill : undefined }}>
                                {formatCurrency(sector.value)}
                            </span>
                        </div>
                    )})}
                </div>
            </CardContent>
        </Card>
    );
};

const KPICard = ({ title, value, subtext, icon: Icon, iconColor, trend, trendValue, gradientClass }: any) => (
    <Card className="gsap-kpi-card relative overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-500 border-white/40 dark:border-slate-800/50 rounded-[1.5rem] bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl">
        {/* Efeito Glow no fundo do cartão */}
        <div className={cn("absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[40px] opacity-40 group-hover:scale-150 transition-transform duration-700 pointer-events-none", gradientClass || "bg-slate-300 dark:bg-slate-700")} />
        
        <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between pb-4">
                <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">{title}</p>
                <div className={`p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 transition-transform group-hover:scale-110 duration-300 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="flex flex-col mt-1">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</span>
                
                <div className="flex items-center gap-2.5 mt-3">
                    {trend && (
                        <Badge variant="outline" className={cn(
                            "px-2 py-0.5 text-[11px] font-bold border-0 shadow-sm",
                            trend === 'up' ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" 
                                           : "bg-rose-100/80 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                        )}>
                            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                            {trendValue}
                        </Badge>
                    )}
                    {subtext && <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{subtext}</span>}
                </div>
            </div>
        </CardContent>
    </Card>
);

const AlertCard = ({ icon: Icon, title, desc, variant }: any) => (
    <div className={`relative p-5 rounded-[1.5rem] border flex items-start gap-5 shadow-lg backdrop-blur-xl overflow-hidden group transition-all duration-300 hover:scale-[1.01] ${
        variant === 'rose' 
            ? 'bg-rose-50/80 border-rose-200/60 dark:bg-rose-950/40 dark:border-rose-900/50' 
            : 'bg-amber-50/80 border-amber-200/60 dark:bg-amber-950/40 dark:border-amber-900/50'
    }`}>
        {/* Brilho animado de fundo */}
        <div className={`absolute top-0 right-0 w-full h-full bg-gradient-to-r from-transparent opacity-20 pointer-events-none ${variant === 'rose' ? 'to-rose-400' : 'to-amber-400'}`} />
        
        <div className={`p-3 rounded-2xl shrink-0 shadow-sm ${variant === 'rose' ? 'bg-white dark:bg-rose-900/80 text-rose-600' : 'bg-white dark:bg-amber-900/80 text-amber-600'}`}>
            <Icon className="w-6 h-6 animate-pulse" />
        </div>
        <div className="z-10">
            <h4 className={`text-base font-bold tracking-tight ${variant === 'rose' ? 'text-rose-900 dark:text-rose-200' : 'text-amber-900 dark:text-amber-200'}`}>{title}</h4>
            <p className={`text-sm mt-1 font-medium ${variant === 'rose' ? 'text-rose-700/80 dark:text-rose-300/80' : 'text-amber-700/80 dark:text-amber-300/80'}`}>{desc}</p>
        </div>
    </div>
);

export default function Reports() {
  const [startDate, setStartDate] = useState(startOfMonth(new Date()).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endOfMonth(new Date()).toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("visao-global"); 
  
  // 🟢 ESTADO PARA O FILTRO DO GRÁFICO
  const [chartFilter, setChartFilter] = useState<string>('all');
  
  const [custoReposicao, setCustoReposicao] = useState<string>("0");
  const [custoGarantia, setCustoGarantia] = useState<string>("0");

  const [searchEntradas, setSearchEntradas] = useState("");
  const [filtroCategoriaEntrada, setFiltroCategoriaEntrada] = useState("");

  const [searchSaidas, setSearchSaidas] = useState("");
  const [filtroCategoriaSaida, setFiltroCategoriaSaida] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["reports-general", startDate, endDate],
    queryFn: async () => {
      const response = await api.get("/reports/general", { params: { startDate, endDate, includeAllTimeOps: true } });
      return response.data;
    },
    refetchOnMount: true,
    staleTime: 0
  });

  const { data: travelOrders = [] } = useQuery({
      queryKey: ["travel-orders-for-reports"],
      queryFn: async () => {
          try {
              const res = await api.get("/travel-orders");
              return res.data;
          } catch {
              return [];
          }
      },
      refetchOnWindowFocus: false
  });

  const { data: productions3D = [] } = useQuery({
    queryKey: ["productions-3d-all"],
    queryFn: async () => (await api.get("/producao-3d/productions")).data,
    refetchOnWindowFocus: false
  });

  const { data: replenishments = [] } = useQuery({
    queryKey: ["replenishments-all"],
    queryFn: async () => (await api.get("/replenishments")).data,
    refetchOnWindowFocus: false
  });

  const metricsReplenishments = useMemo(() => {
    const sDate = new Date(startDate); sDate.setHours(0,0,0,0);
    const eDate = new Date(endDate); eDate.setHours(23,59,59,999);

    const filtered = replenishments.filter((r: any) => {
      const d = new Date(r.created_at);
      return d >= sDate && d <= eDate;
    });

    const total = filtered.length;
    const pendentes = filtered.filter((r: any) => r.status === 'pendente').length;
    const emPreparo = filtered.filter((r: any) => r.status === 'em_preparo').length;
    const concluidos = filtered.filter((r: any) => r.status === 'concluido').length;
    
    const valorTotalConcluido = filtered
      .filter((r: any) => r.status === 'concluido')
      .reduce((acc: number, r: any) => acc + (Number(r.total_value) || 0), 0);

    return { total, pendentes, emPreparo, concluidos, valorTotalConcluido };
  }, [replenishments, startDate, endDate]);

  const metrics3D = useMemo(() => {
    const sDate = new Date(startDate); sDate.setHours(0,0,0,0);
    const eDate = new Date(endDate); eDate.setHours(23,59,59,999);

    const filtered = productions3D.filter((p: any) => {
      const d = new Date(p.date || p.created_at);
      return d >= sDate && d <= eDate;
    });

    const totalPieces = filtered.reduce((acc: number, p: any) => acc + Number(p.quantity || 0), 0);
    const totalFilament = filtered.reduce((acc: number, p: any) => acc + p.filamentGrams, 0);
    const totalTimeMinutes = filtered.reduce((acc: number, p: any) => acc + p.totalMinutes, 0);
    
    const horas = Math.floor(totalTimeMinutes / 60);
    const min = totalTimeMinutes % 60;
    const tempoFormatado = horas > 0 ? `${horas}h ${min}m` : `${min}m`;

    return { totalPieces, totalFilament, tempoFormatado, ordensFinalizadas: filtered.length };
  }, [productions3D, startDate, endDate]);

  // 🟢 GSAP: ANIMAÇÕES PREMIUM PARA A ABA VISÃO GLOBAL
  useGSAP(() => {
    if (!isLoading && reportData && activeTab === "visao-global") {
        gsap.fromTo(".visao-anim-item", 
            { y: 40, opacity: 0, scale: 0.98 }, 
            { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.1, ease: "power3.out", clearProps: "all" }
        );
    }
  }, [isLoading, reportData, activeTab]);

  useGSAP(() => {
      if(activeTab !== 'visao-global') {
          gsap.from(".gsap-tab-content", { y: 15, opacity: 0, duration: 0.4, ease: "power2.out", clearProps: "all" });
      }
  }, [activeTab]);

  const obterCategoriaSaida = (item: any) => {
    if (item.origem_tipo === 'CONFRONTO') return 'viagem';
    if (item.order_number) return 'reposicao'; 
    if (item.op_code) return 'separacao';      

    const tipoAdivinhado = String(item.tipo_saida || item.tipo || item.categoria || item.motivo || '').toLowerCase();
    if (tipoAdivinhado.includes('reposi')) return 'reposicao';
    if (tipoAdivinhado.includes('separa')) return 'separacao';
    if (tipoAdivinhado.includes('manual')) return 'manual';
    if (tipoAdivinhado.includes('solicita')) return 'solicitacao';

    if (item.origem_tipo === 'SISTEMA') return 'solicitacao';
    if (item.origem_tipo === 'MANUAL') return 'manual';

    return 'outros';
  };

  const obterCategoriaEntrada = (item: any) => {
      const origemNome = String(item.origem_nome || item.origem || item.file_name || "").toLowerCase();
      
      if (origemNome.includes("reaproveitamento") || origemNome.includes("reuso") || item.origem_tipo === 'REAPROVEITAMENTO') {
          return 'reaproveitamento';
      }
      if (origemNome.includes("nfe") || origemNome.includes("fatura") || item.origem_tipo === 'ENTRADA_NFE') {
          return 'nfe';
      }
      if (item.origem_tipo === 'CONFRONTO') {
          return 'viagem';
      }
      
      return 'manual'; 
  };

  const analytics = useMemo(() => {
    if (!reportData) return null;

    const entradasPuras = reportData.entradas || [];
    const saidasManuaisPuras = (reportData.saidas_separacoes || []).map((i: any) => ({ ...i, origem_tipo: 'MANUAL' }));
    const saidasSistemaPuras = (reportData.saidas_solicitacoes || []).map((i: any) => ({ ...i, origem_tipo: 'SISTEMA' })); 
    
    let entradasComConfronto = [...entradasPuras];
    let saidasComConfronto = [...saidasManuaisPuras, ...saidasSistemaPuras];

    const sDate = new Date(startDate); sDate.setHours(0,0,0,0);
    const eDate = new Date(endDate); eDate.setHours(23,59,59,999);

    const reconciledOrders = travelOrders.filter((order: any) => {
        if (order.status !== 'reconciled') return false;
        const d = new Date(order.updated_at);
        return d >= sDate && d <= eDate;
    });

    reconciledOrders.forEach((order: any) => {
        if (!order.items) return;
        order.items.forEach((item: any) => {
            const qOut = Number(item.quantity_out || 0);
            const qRet = Number(item.quantity_returned || 0);
            
            const consumed = Math.max(0, qOut - qRet);
            const returned = Math.min(qOut, qRet);
            const extra = Math.max(0, qRet - qOut);

            const prodName = item.products?.name || item.name || `SKU: ${item.products?.sku || item.sku}`;

            if (returned > 0) {
                entradasComConfronto.push({
                    data: order.updated_at,
                    produto: prodName,
                    quantidade: returned,
                    origem: 'SISTEMA',
                    origem_tipo: 'CONFRONTO',
                    detalhes_confronto: { travelOrderId: order.id, city: order.city, technicians: order.technicians, tipo_confronto: 'Devolvido' }
                });
            }

            if (extra > 0) {
                entradasComConfronto.push({
                    data: order.updated_at,
                    produto: prodName,
                    quantidade: extra,
                    origem: 'SISTEMA',
                    origem_tipo: 'CONFRONTO',
                    detalhes_confronto: { travelOrderId: order.id, city: order.city, technicians: order.technicians, tipo_confronto: 'Extra' }
                });
            }

            if (consumed > 0) {
                saidasComConfronto.push({
                    data: order.updated_at,
                    produto: prodName,
                    quantidade: consumed,
                    destino_setor: 'Consumo na Viagem',
                    origem_tipo: 'CONFRONTO',
                    detalhes_confronto: { travelOrderId: order.id, city: order.city, technicians: order.technicians, tipo_confronto: 'Consumido' }
                });
            }
        });
    });

    const todasSaidas = saidasComConfronto.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const todasEntradas = entradasComConfronto.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const estoque = reportData.estoque || []; 
    const compMesAnterior = reportData.comparativo_mes_anterior || { entradas: 0, saidas: 0 };

    const getPrecoEstoque = (produtoNome: string) => {
        const itemEstoque = estoque.find((e:any) => 
            e.produto?.trim().toLowerCase() === produtoNome?.trim().toLowerCase() || 
            e.name?.trim().toLowerCase() === produtoNome?.trim().toLowerCase()
        );
        return Number(itemEstoque?.preco) || 0;
    };

    const valorTotalEstoque = estoque.reduce((acc: number, item: any) => acc + (Number(item.quantidade_total || item.quantidade || 0) * Number(item.preco || 0)), 0);
    
    let valorEntradasNFe = 0;
    let valorEntradasReuso = 0;
    let valorEntradasManuais = 0;

    todasEntradas.forEach((cur: any) => {
        const preco = Number(cur.preco_unitario) || getPrecoEstoque(cur.produto);
        const valTotalItem = Number(cur.quantidade) * preco;
        const categoria = obterCategoriaEntrada(cur);

        if (categoria === 'nfe') valorEntradasNFe += valTotalItem;
        else if (categoria === 'reaproveitamento') valorEntradasReuso += valTotalItem;
        else valorEntradasManuais += valTotalItem;
    });

    const valorTotalEntradas = valorEntradasNFe + valorEntradasReuso + valorEntradasManuais;

    const valorTotalSaidas = todasSaidas.reduce((acc: number, cur: any) => {
        const preco = Number(cur.preco_unitario) || getPrecoEstoque(cur.produto);
        return acc + (Number(cur.quantidade) * preco);
    }, 0);

    const valorRep = Number(custoReposicao) || 0;
    const valorGar = Number(custoGarantia) || 0;

    const hoje = new Date();
    
    const obsoletos = estoque.filter((item: any) => {
        const qTotal = Number(item.quantidade_total || item.quantidade || 0);
        if (qTotal <= 0) return false; 
        if (!item.ultima_movimentacao) return true;
        return differenceInDays(hoje, new Date(item.ultima_movimentacao)) > 90;
    }).sort((a: any, b: any) => {
        if (!a.ultima_movimentacao) return -1;
        if (!b.ultima_movimentacao) return 1;
        return new Date(a.ultima_movimentacao).getTime() - new Date(b.ultima_movimentacao).getTime();
    });

    const valorTotalObsoletos = obsoletos.reduce((acc: number, item: any) => {
        const qtd = Number(item.quantidade_total || item.quantidade || 0);
        const preco = Number(item.preco || 0);
        return acc + (qtd * preco);
    }, 0);

    const estoqueCritico = estoque.filter((i: any) => {
        const minStock = Number(i.estoque_minimo || 0);
        if (minStock <= 0) return false; 
        const disponivel = Number(i.quantidade_total || i.quantidade || 0) - Number(i.quantidade_reservada || 0);
        return disponivel < minStock; 
    });
    
    const top10Valor = [...estoque]
        .sort((a, b) => {
            const valA = Number(a.quantidade_total || a.quantidade || 0) * Number(a.preco || 0);
            const valB = Number(b.quantidade_total || b.quantidade || 0) * Number(b.preco || 0);
            return valB - valA;
        })
        .slice(0, 10);

    const freqMap = new Map();
    [...entradasComConfronto, ...todasSaidas].forEach(m => {
        freqMap.set(m.produto, (freqMap.get(m.produto) || 0) + 1);
    });
    const top10Movimentados = Array.from(freqMap.entries())
        .map(([produto, count]) => ({ produto, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const valorPorSetorMap = new Map();
    const saidasParaSetor = [...saidasSistemaPuras, ...saidasManuaisPuras];

    saidasParaSetor.forEach((s: any) => {
        const precoItem = Number(s.preco_unitario) || getPrecoEstoque(s.produto);
        const val = Number(s.quantidade || 0) * precoItem;
        const setor = s.destino_setor || "Não Informado";
        valorPorSetorMap.set(setor, (valorPorSetorMap.get(setor) || 0) + val);
    });

    const sectorValueData = Array.from(valorPorSetorMap.entries())
        .map(([name, value], index) => ({ 
            name, 
            value,
            fill: CHART_PALETTE[index % CHART_PALETTE.length] 
        }))
        .sort((a, b) => b.value - a.value); 
        
    const totalSectorValue = sectorValueData.reduce((acc, curr) => acc + curr.value, 0);

    const saidasParaOp = reportData.saidas_ops_all_time || saidasParaSetor.filter((s: any) => s.op_code);

    const valorPorOpMap = new Map();
    const qtdItensPorOpMap = new Map();
    const itemsPorOpMap = new Map();
    const statusPorOpMap = new Map();

    saidasParaOp.forEach((s: any) => {
        if (s.op_code) {
            const precoItem = Number(s.preco_unitario) || getPrecoEstoque(s.produto);
            const valTotalDoItem = Number(s.quantidade || 0) * precoItem;
            
            valorPorOpMap.set(s.op_code, (valorPorOpMap.get(s.op_code) || 0) + valTotalDoItem);
            qtdItensPorOpMap.set(s.op_code, (qtdItensPorOpMap.get(s.op_code) || 0) + Number(s.quantidade || 0));
            
            if (s.op_status) statusPorOpMap.set(s.op_code, s.op_status);

            if (!itemsPorOpMap.has(s.op_code)) {
                itemsPorOpMap.set(s.op_code, []);
            }
            itemsPorOpMap.get(s.op_code).push({
                produto: s.produto,
                quantidade: Number(s.quantidade || 0),
                preco_unitario: precoItem,
                total: valTotalDoItem,
                destino_setor: s.destino_setor || 'N/A',
                data: s.data
            });
        }
    });

    const opValueData = Array.from(valorPorOpMap.entries())
        .map(([op_code, totalValue]) => ({ 
            op_code, 
            status: statusPorOpMap.get(op_code) || 'aberta',
            totalValue,
            totalItems: qtdItensPorOpMap.get(op_code),
            items: itemsPorOpMap.get(op_code) || []
        }))
        .sort((a, b) => b.totalValue - a.totalValue); 

    // ==========================================
    // 🟢 MAPA DA LINHA DO TEMPO ATUALIZADO
    // ==========================================
    const timelineMap = new Map();
    
    // Função auxiliar para inicializar e somar
    const processDateTimeline = (dateStr: string, type: string, amount: number = 1) => {
      if (!dateStr) return;
      const dateKey = format(new Date(dateStr), 'dd/MM');
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { 
            name: dateKey, 
            entradas: 0, 
            saidas_sistema: 0, 
            saidas_manual: 0,
            producao_3d: 0, 
            reposicoes: 0 
        });
      }
      const entry = timelineMap.get(dateKey);
      if (type === 'in') entry.entradas += amount;
      else if (type === 'out_sis') entry.saidas_sistema += amount;
      else if (type === 'out_man') entry.saidas_manual += amount;
      else if (type === 'prod_3d') entry.producao_3d += amount;
      else if (type === 'rep') entry.reposicoes += amount;
    };

    // 1. Entradas (Agrupadas: material novo, reaproveitado, devoluções) -> Usa 'todasEntradas'
    todasEntradas.forEach((i: any) => {
        const d = new Date(i.data || i.created_at);
        if (d >= sDate && d <= eDate) {
            processDateTimeline(i.data || i.created_at, 'in', 1);
        }
    });

    // 2. Solicitações -> Apenas as definidas/marcadas como "entregue"
    const uniqueRequestsCounted = new Set();
    saidasSistemaPuras.forEach((i: any) => {
        const d = new Date(i.data || i.created_at);
        const statusField = String(i.status || i.op_status || i.request_status || i.status_solicitacao || '').toLowerCase();
        const isEntregue = statusField.includes('entregue');
        
        if (d >= sDate && d <= eDate && isEntregue) {
            // Conta solicitações únicas por dia (se tiver IDs) ou então cada ação atrelada à solicitação
            const reqId = i.request_id || i.op_code || i.order_number || i.id || Math.random().toString();
            const uniqKey = `${format(d, 'dd/MM')}-${reqId}`;
            
            if (!uniqueRequestsCounted.has(uniqKey)) {
                uniqueRequestsCounted.add(uniqKey);
                processDateTimeline(i.data || i.created_at, 'out_sis', 1);
            }
        }
    });

    // 3. Saída Manual -> Quantidade de ações feitas
    saidasManuaisPuras.forEach((i: any) => {
        const d = new Date(i.data || i.created_at);
        if (d >= sDate && d <= eDate) {
            processDateTimeline(i.data || i.created_at, 'out_man', 1);
        }
    }); 
    
    // 4. Produção 3D -> Mostra a quantidade de PEÇAS produzidas
    productions3D.forEach((p: any) => {
        const d = new Date(p.date || p.created_at);
        if (d >= sDate && d <= eDate) {
            processDateTimeline(p.date || p.created_at, 'prod_3d', Number(p.quantity || 1));
        }
    });

    // 5. Pedidos de Reposição -> Apenas reposições marcadas como "concluido"
    replenishments.forEach((r: any) => {
        const d = new Date(r.created_at);
        if (d >= sDate && d <= eDate && String(r.status).toLowerCase() === 'concluido') {
            processDateTimeline(r.created_at, 'rep', 1);
        }
    });

    const chartData = Array.from(timelineMap.values()).sort((a, b) => {
       const [d1, m1] = a.name.split('/').map(Number);
       const [d2, m2] = b.name.split('/').map(Number);
       return m1 - m2 || d1 - d2;
    });
    // ==========================================

    const sectorTimelineMap = new Map();
    const setoresDisponiveis = sectorValueData.map(s => s.name);

    let currentDate = new Date(sDate);
    while (currentDate <= eDate) {
        const dateKey = format(currentDate, 'dd/MM');
        const dayEntry: any = { name: dateKey, Total: 0 };
        setoresDisponiveis.forEach(setor => { dayEntry[setor] = 0; });
        sectorTimelineMap.set(dateKey, dayEntry);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    saidasParaSetor.forEach((s: any) => {
        const precoItem = Number(s.preco_unitario) || getPrecoEstoque(s.produto);
        const val = Number(s.quantidade || 0) * precoItem;
        const setor = s.destino_setor || "Não Informado";
        const dateObj = new Date(s.data);
        if(!isNaN(dateObj.getTime())) {
             const dateKey = format(dateObj, 'dd/MM');
             if (sectorTimelineMap.has(dateKey)) {
                 const entry = sectorTimelineMap.get(dateKey);
                 entry[setor] += val;
                 entry.Total += val;
             }
        }
    });

    const sectorTimelineData = Array.from(sectorTimelineMap.values());
    const entradasFiltradas = todasEntradas.filter((i: any) => i.produto?.toLowerCase().includes(searchEntradas.toLowerCase()));
    const saidasFiltradas = todasSaidas.filter((i: any) => i.produto?.toLowerCase().includes(searchSaidas.toLowerCase()));

    return {
      opsEntrada: todasEntradas.filter(i => new Date(i.data || i.created_at) >= sDate && new Date(i.data || i.created_at) <= eDate).length, 
      opsSaidaTotal: saidasManuaisPuras.length + saidasSistemaPuras.length, 
      saidasSolicitacaoTotal: saidasSistemaPuras.length,
      saidasManuaisTotal: saidasManuaisPuras.length, 
      valorEntradasNFe,
      valorEntradasReuso,
      valorEntradasManuais,
      valorTotalEntradas,
      valorTotalSaidas,   
      chartData,
      sectorTimelineData, 
      sectorValueData,    
      totalSectorValue,
      opValueData, 
      raw: { todasEntradas, todasSaidas, entradasFiltradas, saidasFiltradas },
      valorTotalEstoque,
      valorTotalObsoletos,
      valorRep,
      valorGar,
      obsoletos,
      estoqueCritico,
      top10Valor,
      top10Movimentados,
      getPrecoEstoque, 
      comparativo: {
          entradas: entradasPuras.length,
          saidas: saidasManuaisPuras.length + saidasSistemaPuras.length,
          entradasAnt: compMesAnterior.entradas,
          saidasAnt: compMesAnterior.saidas,
      }
    };
  }, [reportData, travelOrders, custoReposicao, custoGarantia, searchEntradas, searchSaidas, startDate, endDate, productions3D, replenishments]);

  const handleExportExcel = () => {
    if (!analytics) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
        { Metrica: "Capital Físico em Estoque", Valor: analytics.valorTotalEstoque },
        { Metrica: "Total Entradas (Sem Acertos)", Valor: analytics.opsEntrada },
        { Metrica: "Qtd. Solicitações via Sistema", Valor: analytics.saidasSolicitacaoTotal },
        { Metrica: "Qtd. Saídas Manuais", Valor: analytics.saidasManuaisTotal },
        { Metrica: "Valor Obsoleto / Parado", Valor: analytics.valorTotalObsoletos },
        { Metrica: "Ganhos de Venda (Reposição)", Valor: analytics.valorRep },
        { Metrica: "Perdas Operacionais (Garantia)", Valor: analytics.valorGar }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasEntradas.map(i => {
        const preco = Number(i.preco_unitario) || analytics.getPrecoEstoque(i.produto);
        const total = Number(i.quantidade) * preco;
        return {
            Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'), 
            Produto: i.produto, 
            Qtd: i.quantidade, 
            'Valor Unitário (R$)': preco, 
            'Valor Total (R$)': total,
            Origem: i.origem || 'Fornecedor', 
            Detalhe: i.origem_tipo === 'CONFRONTO' ? `Acerto Viagem: ${i.detalhes_confronto?.city} (${i.detalhes_confronto?.technicians})` : '-'
        };
    })), "Entradas Completas");
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasSaidas.map(i => {
        const categoria = obterCategoriaSaida(i);
        let tipoDisplay = 'Manual';
        
        if (categoria === 'reposicao') tipoDisplay = 'Pedido de Reposição';
        else if (categoria === 'separacao') tipoDisplay = 'Separação';
        else if (categoria === 'viagem') tipoDisplay = `Acerto Viagem: ${i.detalhes_confronto?.city}`;
        else if (categoria === 'solicitacao') tipoDisplay = 'Solicitação';

        const preco = Number(i.preco_unitario) || analytics.getPrecoEstoque(i.produto);
        const total = Number(i.quantidade) * preco;

        return {
            Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'),
            Tipo: tipoDisplay,
            Produto: i.produto,
            Qtd: i.quantidade,
            'Valor Unitário (R$)': preco,
            'Valor Total (R$)': total,
            Destino: i.destino_setor || i.client_service || '-',
            'OP/Pedido/OS': i.op_code || i.order_number || '-'
        };
    })), "Saidas Completas");
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.obsoletos.map((i:any) => ({
        Produto: i.produto,
        SKU: i.sku,
        Quantidade: Number(i.quantidade_total || i.quantidade || 0),
        'Valor Total (R$)': Number(i.quantidade_total || i.quantidade || 0) * Number(i.preco || 0),
        'Última Movimentação': i.ultima_movimentacao ? format(new Date(i.ultima_movimentacao), 'dd/MM/yyyy') : 'Sem registro'
    }))), "Estoque Parado");

    XLSX.writeFile(wb, "Relatório Gerencial - Royale.xlsx");
    toast.success("Excel gerado com sucesso!");
  };

  const handleExportPDF = async () => {
    if (!analytics) return toast.error("Dados não disponíveis para gerar o PDF.");
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    
    toast.loading("Construindo Relatório Executivo PDF...");
    const logoBase64 = await getBase64FromUrl('/logo-royale.png');

    const drawHeader = (title: string, subtitle: string = "") => {
        doc.setFillColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]); 
        doc.rect(0, 0, pageWidth, 42, 'F');
        
        doc.setFillColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]); 
        doc.rect(0, 42, pageWidth, 2, 'F');
        
        if (logoBase64 && logoBase64.length > 50) {
            try {
                const imgProps = doc.getImageProperties(logoBase64);
                const imgWidth = 40; 
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                doc.addImage(logoBase64, 'PNG', margin, (42 - imgHeight) / 2, imgWidth, imgHeight);
            } catch (err) {}
        } else {
            doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.text("FLUXO ROYALE", margin, 26);
        }
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255); 
        doc.text(title.toUpperCase(), pageWidth - margin, 20, { align: "right" });
        
        if (subtitle) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(220, 230, 240); 
            doc.text(subtitle, pageWidth - margin, 26, { align: "right" });
        }

        doc.setFillColor(255, 255, 255, 0.15);
        doc.roundedRect(pageWidth - margin - 75, 30, 75, 7, 2, 2, 'F');
        doc.setFontSize(8); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold");
        doc.text(`PERÍODO: ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`, pageWidth - margin - 37.5, 34.5, { align: "center" });
    };

    const drawFooter = (pageNumber: number) => {
        doc.setDrawColor(200, 210, 220); doc.setLineWidth(0.5); doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140, 150, 160); 
        doc.text(`Sistema de Gestão Royale • Documento Confidencial`, margin, pageHeight - 10);
        doc.setFont("helvetica", "bold"); doc.setTextColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
        doc.text(`Pág. ${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    };

    const drawPremiumKpiCard = (x: number, y: number, w: number, h: number, title: string, value: string | number, type: 'primary' | 'alert' | 'success') => {
        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(x, y, w, h, 4, 4, 'F');
        doc.setDrawColor(226, 232, 240); 
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, h, 4, 4, 'D');
        
        let mainColor = C_AZUL_ROYALE;
        if (type === 'success') mainColor = [16, 185, 129]; 
        if (type === 'alert') mainColor = [220, 38, 38]; 

        doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]); 
        doc.path([
            { op: 'm', c: [x, y + 3] },
            { op: 'l', c: [x + 2.5, y + 3] },
            { op: 'l', c: [x + 2.5, y + h - 3] },
            { op: 'l', c: [x, y + h - 3] },
        ]).fill();
        
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), x + 7, y + 8);

        const strValue = String(value);
        let valFontSize = 14; 
        
        if (strValue.length > 13) {
            valFontSize = 9; 
        } else if (strValue.length > 10) {
            valFontSize = 11; 
        }

        doc.setFontSize(valFontSize); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text(strValue, x + 7, y + 18);
    };

    try {
        drawHeader("Relatório Gerencial", "Análise de Performance e Fluxo de Estoque");
        
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("1. INDICADORES GLOBAIS", margin, 65);
        doc.setDrawColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.setLineWidth(1); doc.line(margin, 68, margin + 25, 68);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin + 25, 68, pageWidth - margin, 68);

        const kpiW = 41; const kpiH = 26; const kpiGap = 4;
        drawPremiumKpiCard(margin, 75, kpiW, kpiH, "Capital Físico", formatCurrencyNoDecimals(analytics.valorTotalEstoque), 'primary');
        drawPremiumKpiCard(margin + kpiW + kpiGap, 75, kpiW, kpiH, "Qtd de O.P (Sis)", analytics.saidasSolicitacaoTotal, 'primary');
        drawPremiumKpiCard(margin + (kpiW + kpiGap) * 2, 75, kpiW, kpiH, "Total Entradas", analytics.opsEntrada, 'primary');
        drawPremiumKpiCard(margin + (kpiW + kpiGap) * 3, 75, kpiW, kpiH, "Saídas Manuais", analytics.saidasManuaisTotal, 'primary');

        const chartY = 120;
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("2. FLUXO TEMPORAL DE OPERAÇÕES", margin, chartY);
        doc.setDrawColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.setLineWidth(1); doc.line(margin, chartY + 3, margin + 25, chartY + 3);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin + 25, chartY + 3, pageWidth - margin, chartY + 3);
        
        const flowChart = document.getElementById('chart-flow');
        if (flowChart && activeTab === "visao-global") {
            try {
                const canvas = await html2canvas(flowChart, { scale: 2, backgroundColor: null });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pageWidth - (margin * 2); 
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                doc.addImage(imgData, 'PNG', margin, chartY + 10, imgWidth, imgHeight);
            } catch (err) { }
        } else {
            doc.setFontSize(9); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "italic");
            doc.text("(O gráfico só é exportado se a aba 'Visão Global' estiver aberta no momento da exportação)", margin, chartY + 15);
        }

        doc.addPage();
        drawHeader("Distribuição Financeira", "Impacto Setorial e Indicadores Isolados");

        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("3. VALORES OPERACIONAIS SECUNDÁRIOS", margin, 65);
        doc.setDrawColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.setLineWidth(1); doc.line(margin, 68, margin + 25, 68);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin + 25, 68, pageWidth - margin, 68);
        
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
        doc.text("* Estes valores não afetam o estoque físico. Servem para medição de perdas e ganhos paralelos.", margin, 74);

        const repW = 86;
        drawPremiumKpiCard(margin, 80, repW, kpiH, "Ganho de Venda (Reposição)", formatCurrencyNoDecimals(analytics.valorRep), 'success');
        drawPremiumKpiCard(margin + repW + kpiGap, 80, repW, kpiH, "Perda Operacional (Garantia)", formatCurrencyNoDecimals(analytics.valorGar), 'alert');

        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("4. CUSTOS DE SAÍDA (POR SETOR)", margin, 125);
        doc.setDrawColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.setLineWidth(1); doc.line(margin, 128, margin + 25, 128);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin + 25, 128, pageWidth - margin, 128);

        autoTable(doc, {
            startY: 134,
            head: [['Setor / Destino', 'Impacto', 'Custo Total Direcionado']],
            body: analytics.sectorValueData.map((item: any) => {
                const percent = analytics.totalSectorValue > 0 ? ((item.value / analytics.totalSectorValue) * 100).toFixed(1) : "0";
                return [item.name, `${percent}%`, formatCurrency(item.value)];
            }),
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' }, 
            styles: { fontSize: 9, cellPadding: 5, textColor: C_TEXTO_ESCURO, lineColor: [226, 232, 240], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 55, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        });

        const totalPages = (doc.internal as any).getNumberOfPages();
        for(let i=1; i <= totalPages; i++) {
            doc.setPage(i); drawFooter(i);
        }

        doc.save("Relatório Gerencial - Royale.pdf");
        toast.dismiss(); toast.success("Dossiê Executivo PDF exportado com sucesso!");

    } catch (error) {
        console.error(error);
        toast.dismiss(); toast.error("Erro ao processar o PDF.");
    }
  };

  const handleExportOpPDF = async (op: any) => {
    try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 16;

        toast.loading(`A gerar PDF da OP ${op.op_code}...`);
        const logoBase64 = await getBase64FromUrl('/logo-royale.png');

        doc.setFillColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
        doc.rect(0, 0, pageWidth, 42, 'F');
        doc.setFillColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.rect(0, 42, pageWidth, 2, 'F');

        if (logoBase64 && logoBase64.length > 50) {
            const imgProps = doc.getImageProperties(logoBase64);
            const imgWidth = 40;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            doc.addImage(logoBase64, 'PNG', margin, (42 - imgHeight) / 2, imgWidth, imgHeight);
        }

        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
        doc.text(`EXTRATO DE OP`, pageWidth - margin, 20, { align: "right" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(220, 230, 240);
        doc.text(`Ordem de Produção: ${op.op_code} (${op.status.toUpperCase()})`, pageWidth - margin, 26, { align: "right" });

        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text(`ITENS ATRELADOS À OP ${op.op_code}`, margin, 60);
        
        doc.setDrawColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.setLineWidth(1); doc.line(margin, 63, margin + 25, 63);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin + 25, 63, pageWidth - margin, 63);

        autoTable(doc, {
            startY: 70,
            head: [['Produto', 'Setor/Destino', 'Data Saída', 'Qtd', 'Val. Unit.', 'Subtotal']],
            body: op.items.map((item: any) => [
                item.produto,
                item.destino_setor,
                format(new Date(item.data), 'dd/MM/yyyy HH:mm'),
                item.quantidade,
                formatCurrency(item.preco_unitario),
                formatCurrency(item.total)
            ]),
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 4, textColor: C_TEXTO_ESCURO, lineColor: [226, 232, 240], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] }
            },
            margin: { left: margin, right: margin }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(pageWidth - margin - 85, finalY, 85, 22, 3, 3, 'FD');

        doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text("CUSTO TOTAL DA OP:", pageWidth - margin - 80, finalY + 8);

        doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(op.totalValue), pageWidth - margin - 5, finalY + 16, { align: "right" });

        doc.save(`OP_${op.op_code}_Relatorio.pdf`);
        toast.dismiss();
        toast.success(`PDF da OP ${op.op_code} gerado com sucesso!`);
    } catch (error) {
        console.error(error);
        toast.dismiss();
        toast.error("Falha ao gerar o PDF da OP.");
    }
  };

  const setQuickDate = (type: 'month' | 'last30' | 'today' | 'week') => {
    const now = new Date();
    if (type === 'month') {
      setStartDate(startOfMonth(now).toISOString().split('T')[0]);
      setEndDate(endOfMonth(now).toISOString().split('T')[0]);
    } else if (type === 'today') {
        setStartDate(now.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'week') {
        setStartDate(subDays(now, 7).toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }
  };

  const saidasExibidas = analytics?.raw.saidasFiltradas.filter((item: any) => {
    if (!filtroCategoriaSaida) return true;
    return obterCategoriaSaida(item) === filtroCategoriaSaida;
  }) || [];

  const entradasExibidas = analytics?.raw.entradasFiltradas.filter((item: any) => {
    if (!filtroCategoriaEntrada) return true;
    return obterCategoriaEntrada(item) === filtroCategoriaEntrada;
  }) || [];

  const tabContentClass = "space-y-8 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-8 duration-700 ease-out";

  return (
    <div ref={containerRef} className="space-y-8 p-4 sm:p-8 bg-slate-50/30 dark:bg-[#0a0f1c] min-h-screen text-slate-900 dark:text-slate-100 transition-colors font-sans">
      
      {/* HEADER DE CONTROLO PREMIUM */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-4">
        <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-2xl">
                    <Zap className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                Business Intelligence
            </h1>
            <p className="text-muted-foreground mt-2 ml-14 text-sm font-medium tracking-wide">
                Análise de Performance Operacional e Fluxo Gerencial
            </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-2 rounded-[1.25rem] border border-slate-200/60 dark:border-slate-800 shadow-sm w-full lg:w-auto">
            <div className="flex items-center px-4 gap-2 border-r border-slate-200 dark:border-slate-800">
                <CalendarIcon className="w-4 h-4 text-indigo-500" />
                <Input 
                    type="date" 
                    className="h-9 w-[120px] border-0 bg-transparent focus-visible:ring-0 text-xs font-bold p-0 cursor-pointer text-slate-700 dark:text-slate-200" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                />
                <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>
                <Input 
                    type="date" 
                    className="h-9 w-[120px] border-0 bg-transparent focus-visible:ring-0 text-xs font-bold p-0 cursor-pointer text-right text-slate-700 dark:text-slate-200" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                />
            </div>
            
            <div className="flex gap-1.5 px-2">
                <Button onClick={() => setQuickDate('today')} variant="ghost" size="sm" className="h-9 text-[11px] font-bold px-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">Hoje</Button>
                <Button onClick={() => setQuickDate('month')} variant="secondary" size="sm" className="h-9 text-[11px] font-bold px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">Mês</Button>
                <Button onClick={() => refetch()} variant="outline" size="icon" className="h-9 w-9 ml-2 rounded-xl border-slate-200 dark:border-slate-700 shadow-sm">
                    <RefreshCw className={`h-4 w-4 text-indigo-500 ${isLoading || isRefetching ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
      </div>

      {analytics && (analytics.obsoletos.length > 0 || analytics.estoqueCritico.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analytics.obsoletos.length > 0 && (
                <AlertCard 
                    icon={Clock} 
                    title="Alerta de Obsolescência" 
                    desc={`Detectados ${analytics.obsoletos.length} itens parados há mais de 90 dias sem movimentação.`} 
                    variant="rose" 
                />
            )}
            {analytics.estoqueCritico.length > 0 && (
                <AlertCard 
                    icon={AlertOctagon} 
                    title="Rutura de Estoque Crítica" 
                    desc={`${analytics.estoqueCritico.length} itens encontram-se atualmente abaixo do volume mínimo definido.`} 
                    variant="amber" 
                />
            )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        
        <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 w-full">
            <TabsList className="flex flex-wrap md:flex-nowrap w-full md:w-auto h-auto p-1.5 gap-1.5 bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur-md rounded-[1.25rem] border border-slate-200/50 dark:border-slate-800/50">
                <TabsTrigger value="visao-global" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Visão Global</TabsTrigger>
                <TabsTrigger value="movimentacoes" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Movimentações</TabsTrigger>
                <TabsTrigger value="saude-estoque" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Saúde do Estoque</TabsTrigger>
                <TabsTrigger value="custos-setor" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Custos & Setores</TabsTrigger>
                <TabsTrigger value="valor-op" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Valor por OP</TabsTrigger>
                <TabsTrigger value="reposicao-garantia" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Garantias</TabsTrigger>
                <TabsTrigger value="pedidos-reposicao" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Pedidos Reposição</TabsTrigger>
                <TabsTrigger value="producao-3d" className="rounded-xl text-[11px] font-bold uppercase tracking-wider py-2.5 px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm transition-all">Produção 3D</TabsTrigger>
            </TabsList>

            <div className="flex gap-3 w-full md:w-auto shrink-0 justify-end">
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-10 rounded-xl font-bold tracking-wide shadow-sm text-xs border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    <FileText className="w-4 h-4 mr-2 text-rose-500" /> Relatório Executivo PDF
                </Button>
                <Button variant="default" size="sm" onClick={handleExportExcel} className="h-10 rounded-xl font-bold tracking-wide shadow-sm text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all">
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Base de Dados Excel
                </Button>
            </div>
        </div>

        {/* ========================================================================= */}
        {/* ===================== ABA: VISÃO GLOBAL (MODERNA) ======================= */}
        {/* ========================================================================= */}
        <TabsContent value="visao-global" className={tabContentClass}>
          {isLoading || !analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[140px] w-full rounded-[1.5rem]" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="visao-anim-item"><KPICard title="Capital Físico" value={formatCurrencyNoDecimals(analytics.valorTotalEstoque)} subtext="Valor armazenado em estoque" icon={DollarSign} iconColor="text-indigo-600 dark:text-indigo-400" gradientClass="bg-indigo-500/20" /></div>
              <div className="visao-anim-item"><KPICard title="Solicitações" value={analytics.saidasSolicitacaoTotal} subtext="Pedidos processados via sistema" icon={Briefcase} iconColor="text-blue-600 dark:text-blue-400" gradientClass="bg-blue-500/20" /></div>
              <div className="visao-anim-item"><KPICard title="Entradas" value={analytics.opsEntrada} subtext="Lotes e acertos recebidos" icon={ArrowDownToLine} iconColor="text-emerald-600 dark:text-emerald-400" gradientClass="bg-emerald-500/20" /></div>
              <div className="visao-anim-item"><KPICard title="Saídas Manuais" value={analytics.saidasManuaisTotal} subtext="Retiradas avulsas registadas" icon={ArrowUpFromLine} iconColor="text-amber-600 dark:text-amber-400" gradientClass="bg-amber-500/20" /></div>
            </div>
          )}

          <div className="visao-anim-item">
              <Card id="chart-flow" className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl overflow-hidden relative">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                <CardHeader className="pb-6 pt-8 px-8 relative z-10">
                    <CardTitle className="text-lg font-bold flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-3 uppercase tracking-widest text-sm text-slate-500 dark:text-slate-400">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><Activity className="h-5 w-5 text-indigo-500" /></div>
                            Fluxo Temporal de Movimentação
                        </div>
                        <div className="flex flex-wrap items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                            <Button variant={chartFilter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setChartFilter('all')} className={cn("text-[11px] h-8 px-4 rounded-xl font-bold transition-all", chartFilter === 'all' && "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900")}>Todas</Button>
                            <Button variant={chartFilter === 'entradas' ? 'default' : 'ghost'} size="sm" onClick={() => setChartFilter('entradas')} className={cn("text-[11px] h-8 px-4 rounded-xl font-bold transition-all", chartFilter === 'entradas' && "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20")}>Entradas</Button>
                            <Button variant={chartFilter === 'solicitacoes' ? 'default' : 'ghost'} size="sm" onClick={() => setChartFilter('solicitacoes')} className={cn("text-[11px] h-8 px-4 rounded-xl font-bold transition-all", chartFilter === 'solicitacoes' && "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md shadow-indigo-500/20")}>Solicitações (Entregues)</Button>
                            <Button variant={chartFilter === 'saidas_manual' ? 'default' : 'ghost'} size="sm" onClick={() => setChartFilter('saidas_manual')} className={cn("text-[11px] h-8 px-4 rounded-xl font-bold transition-all", chartFilter === 'saidas_manual' && "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20")}>Saída Manual</Button>
                            <Button variant={chartFilter === 'producao_3d' ? 'default' : 'ghost'} size="sm" onClick={() => setChartFilter('producao_3d')} className={cn("text-[11px] h-8 px-4 rounded-xl font-bold transition-all", chartFilter === 'producao_3d' && "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20")}>Produção 3D (Peças)</Button>
                            <Button variant={chartFilter === 'reposicoes' ? 'default' : 'ghost'} size="sm" onClick={() => setChartFilter('reposicoes')} className={cn("text-[11px] h-8 px-4 rounded-xl font-bold transition-all", chartFilter === 'reposicoes' && "bg-purple-500 hover:bg-purple-600 text-white shadow-md shadow-purple-500/20")}>Reposições</Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[420px] w-full pt-4 pb-6 px-8 relative z-10">
                    {analytics && (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            {/* 🟢 GRADIENTES PREMIUM PARA AS BARRAS */}
                            <defs>
                                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.entradas} stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor={COLORS.entradas} stopOpacity={0.4}/>
                                </linearGradient>
                                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.saidas} stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor={COLORS.saidas} stopOpacity={0.4}/>
                                </linearGradient>
                                <linearGradient id="colorManuais" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.manuais} stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor={COLORS.manuais} stopOpacity={0.4}/>
                                </linearGradient>
                                <linearGradient id="colorProd3D" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.prod3d} stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor={COLORS.prod3d} stopOpacity={0.4}/>
                                </linearGradient>
                                <linearGradient id="colorReposicoes" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.reposicoes} stopOpacity={0.9}/>
                                    <stop offset="95%" stopColor={COLORS.reposicoes} stopOpacity={0.4}/>
                                </linearGradient>
                            </defs>
                            
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.3} />
                            <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 600}} dy={15} />
                            <YAxis fontSize={12} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 600}} dx={-10} />
                            <Tooltip content={<GlassTooltip />} cursor={{fill: '#f8fafc', opacity: 0.5}} />
                            <Legend wrapperStyle={{ paddingTop: '30px', fontSize: '12px', fontWeight: 600 }} iconType="circle" />
                            
                            {(chartFilter === 'all' || chartFilter === 'entradas') && (
                                <Bar dataKey="entradas" name="Entradas (Todas)" fill="url(#colorEntradas)" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                            )}
                            {(chartFilter === 'all' || chartFilter === 'solicitacoes') && (
                                <Bar dataKey="saidas_sistema" name="Solicitações (Entregues)" fill="url(#colorSaidas)" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                            )}
                            {(chartFilter === 'all' || chartFilter === 'producao_3d') && (
                                <Bar dataKey="producao_3d" name="Produção 3D (Qtd. Peças)" fill="url(#colorProd3D)" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                            )}
                            {(chartFilter === 'all' || chartFilter === 'reposicoes') && (
                                <Bar dataKey="reposicoes" name="Pedidos Reposição (Concluídos)" fill="url(#colorReposicoes)" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                            )}
                            {(chartFilter === 'all' || chartFilter === 'saidas_manual') && (
                                <Bar dataKey="saidas_manual" name="Saída Manual (Ações)" fill="url(#colorManuais)" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                    )}
                </CardContent>
              </Card>
          </div>
        </TabsContent>

        {/* ... OUTRAS ABAS (Mantêm o design refinado herdado) ... */}
        <TabsContent value="movimentacoes" className={tabContentClass}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard 
                  title="Entradas NFe" 
                  value={formatCurrency(analytics?.valorEntradasNFe || 0)} 
                  subtext="Volume de compras faturadas" 
                  icon={Receipt} iconColor="text-emerald-600 dark:text-emerald-400" 
                  trend="up" trendValue="Custo Fixo"
                  gradientClass="bg-emerald-500/20"
              />
              <KPICard 
                  title="Valor Poupado (Reuso)" 
                  value={formatCurrency(analytics?.valorEntradasReuso || 0)} 
                  subtext="Reaproveitamentos do sistema" 
                  icon={Recycle} iconColor="text-amber-600 dark:text-amber-500" 
                  trend="up" trendValue="Economia Direta"
                  gradientClass="bg-amber-500/20"
              />
              <KPICard 
                  title="Entradas Manuais" 
                  value={formatCurrency(analytics?.valorEntradasManuais || 0)} 
                  subtext="Origens alternativas e avulsas" 
                  icon={FileBox} iconColor="text-blue-600 dark:text-blue-400" 
                  gradientClass="bg-blue-500/20"
              />
              <KPICard 
                  title="Custo de Saída" 
                  value={formatCurrency(analytics?.valorTotalSaidas || 0)} 
                  subtext="Materiais faturados/expedidos" 
                  icon={ArrowUpFromLine} iconColor="text-rose-600 dark:text-rose-400" 
                  trend="down" trendValue="Consumo Operacional"
                  gradientClass="bg-rose-500/20"
              />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                
                <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[650px] overflow-hidden">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8">
                        <CardTitle className="text-base flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 font-bold tracking-tight">
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                                    <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Histórico de Entradas
                            </div>
                            
                            <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                <select 
                                    value={filtroCategoriaEntrada}
                                    onChange={(e) => setFiltroCategoriaEntrada(e.target.value)}
                                    className="flex-1 sm:flex-none h-10 text-xs font-semibold border-0 ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl bg-white/80 dark:bg-slate-900/80 px-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-all"
                                >
                                    <option value="">Todas as Fontes</option>
                                    <option value="nfe">Fornecedor (NFe)</option>
                                    <option value="reaproveitamento">Reaproveitamentos</option>
                                    <option value="manual">Lançamento Manual</option>
                                    <option value="viagem">Acertos de Viagem</option>
                                </select>
                                <div className="relative flex-1 sm:flex-none max-w-[10rem] sm:max-w-[12rem]">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Buscar item..." className="pl-9 h-10 text-xs font-semibold border-0 ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl bg-white/80 dark:bg-slate-900/80 shadow-sm" value={searchEntradas} onChange={(e) => setSearchEntradas(e.target.value)} />
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {entradasExibidas.map((item: any, idx: number) => {
                            const categoria = obterCategoriaEntrada(item);
                            
                            let corDestaque = "hover:bg-slate-50 dark:hover:bg-slate-800/40";
                            let BadgeIcon = ArrowDownToLine;
                            let badgeLabel = "Entrada Padrão";
                            let badgeClasses = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                            switch (categoria) {
                                case 'reaproveitamento':
                                    BadgeIcon = Recycle;
                                    badgeLabel = "Reuso (Custo Zero)";
                                    badgeClasses = "bg-amber-100/50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/50";
                                    break;
                                case 'nfe':
                                    BadgeIcon = Receipt;
                                    badgeLabel = "Fatura NFe";
                                    badgeClasses = "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/50";
                                    break;
                                case 'viagem':
                                    BadgeIcon = Plane;
                                    badgeLabel = `Retorno: ${item.detalhes_confronto?.city}`;
                                    badgeClasses = "bg-violet-100/50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200/50 dark:border-violet-900/50";
                                    break;
                                case 'manual':
                                    BadgeIcon = FileBox;
                                    badgeLabel = "Lançamento Manual";
                                    badgeClasses = "bg-blue-100/50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/50";
                                    break;
                            }

                            return (
                                <div key={idx} className={cn(
                                    "flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-4 last:border-0 p-4 -mx-4 rounded-[1.25rem] transition-colors duration-300 group/item",
                                    corDestaque
                                )}>
                                    <div className="flex flex-col gap-1.5 w-[70%]">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate tracking-tight text-[15px]" title={item.produto}>{item.produto}</span>
                                        <Badge variant="outline" className={cn("mt-1 gap-1.5 px-2.5 py-0.5 w-max shadow-sm", badgeClasses)}>
                                            <BadgeIcon className="w-3.5 h-3.5" /> {badgeLabel}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">+{item.quantidade} un.</span>
                                        <span className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{format(new Date(item.data || item.created_at), 'dd/MM HH:mm')}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {entradasExibidas.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Archive className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm font-semibold tracking-wide">Nenhuma entrada registada nesta vista.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[650px] overflow-hidden">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8">
                        <CardTitle className="text-base flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 font-bold tracking-tight">
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                                    <ArrowUpFromLine className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                </div>
                                Histórico de Saídas
                            </div>
                            
                            <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                <select 
                                    value={filtroCategoriaSaida}
                                    onChange={(e) => setFiltroCategoriaSaida(e.target.value)}
                                    className="flex-1 sm:flex-none h-10 text-xs font-semibold border-0 ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl bg-white/80 dark:bg-slate-900/80 px-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
                                >
                                    <option value="">Todas as Categorias</option>
                                    <option value="solicitacao">Pedidos Internos</option>
                                    <option value="separacao">Ordens Produção</option>
                                    <option value="reposicao">Pedidos Reposição</option>
                                    <option value="viagem">Consumo Viagem</option>
                                    <option value="manual">Retirada Manual</option>
                                </select>
                                <div className="relative flex-1 sm:flex-none max-w-[10rem] sm:max-w-[12rem]">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Buscar item..." className="pl-9 h-10 text-xs font-semibold border-0 ring-1 ring-slate-200 dark:ring-slate-800 rounded-xl bg-white/80 dark:bg-slate-900/80 shadow-sm" value={searchSaidas} onChange={(e) => setSearchSaidas(e.target.value)} />
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {saidasExibidas.map((item: any, idx: number) => {
                            const categoria = obterCategoriaSaida(item);
                            
                            let corDestaque = "hover:bg-slate-50 dark:hover:bg-slate-800/40";
                            let BadgeIcon = ArrowUpFromLine;
                            let badgeLabel = "Saída Padrão";
                            let badgeClasses = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                            switch (categoria) {
                                case 'manual':
                                    badgeLabel = "Saída Manual";
                                    badgeClasses = "bg-amber-100/50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/50";
                                    break;
                                case 'solicitacao':
                                    badgeLabel = "Pedido Interno";
                                    badgeClasses = "bg-blue-100/50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/50 dark:border-blue-900/50";
                                    break;
                                case 'separacao':
                                    badgeLabel = item.op_code ? `Ordem: ${item.op_code}` : "Ordem Produção";
                                    badgeClasses = "bg-purple-100/50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200/50 dark:border-purple-900/50";
                                    break;
                                case 'reposicao':
                                    badgeLabel = item.order_number ? `Reposição Nº ${item.order_number}` : "Reposição Cliente";
                                    badgeClasses = "bg-teal-100/50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 border-teal-200/50 dark:border-teal-900/50";
                                    break;
                                case 'viagem':
                                    BadgeIcon = Plane;
                                    badgeLabel = `Aplicado em: ${item.detalhes_confronto?.city}`;
                                    badgeClasses = "bg-violet-100/50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200/50 dark:border-violet-900/50";
                                    break;
                            }

                            return (
                                <div key={idx} className={cn(
                                    "flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-4 last:border-0 p-4 -mx-4 rounded-[1.25rem] transition-colors duration-300",
                                    corDestaque
                                )}>
                                    <div className="flex flex-col gap-1.5 w-[70%]">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate tracking-tight text-[15px]" title={item.produto}>{item.produto}</span>
                                        <Badge variant="outline" className={cn("mt-1 gap-1.5 px-2.5 py-0.5 w-max shadow-sm", badgeClasses)}>
                                            <BadgeIcon className="w-3.5 h-3.5" /> {badgeLabel}
                                        </Badge>
                                        
                                        {categoria !== 'viagem' && (
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-1">Destino: <span className="text-slate-700 dark:text-slate-300">{item.destino_setor || item.client_service || 'Não especificado'}</span></span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="font-black text-rose-600 dark:text-rose-400 text-lg">-{item.quantidade} un.</span>
                                        <span className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">{format(new Date(item.data), 'dd/MM HH:mm')}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {saidasExibidas.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Archive className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm font-semibold tracking-wide">Nenhuma saída registada nesta vista.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
          </div>
        </TabsContent>

        <TabsContent value="saude-estoque" className={tabContentClass}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[450px]">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-3 tracking-tight">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><Clock className="h-4 w-4 text-slate-500 dark:text-slate-400"/></div>
                            Inventário Inativo (+90 dias)
                        </CardTitle>
                        <Badge variant="outline" className="font-bold text-xs bg-rose-50 text-rose-600 border-rose-200 shadow-sm dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 py-1 px-3 rounded-lg">
                            {formatCurrency(analytics?.valorTotalObsoletos)} Retido
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.obsoletos.map((item: any, idx: number) => {
                            const disp = Number(item.quantidade_total || item.quantidade || 0);
                            return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-4 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 p-2 -mx-2 rounded-xl transition-all">
                                <div className="flex flex-col gap-1 w-[65%]">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                    <span className="text-[11px] font-semibold text-slate-400 tracking-wider">SKU: {item.sku}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-black text-slate-900 dark:text-slate-100 text-base">{disp} un.</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Últ. Mov: {item.ultima_movimentacao ? format(new Date(item.ultima_movimentacao), 'dd/MM/yyyy') : 'Nunca'}</span>
                                </div>
                            </div>
                        )})}
                        {analytics?.obsoletos.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-emerald-500">
                                <Package className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm font-bold tracking-wide">Estoque 100% ativo e circulante.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[450px]">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8">
                        <CardTitle className="text-base font-bold flex items-center gap-3 tracking-tight">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><BarChart3 className="h-4 w-4 text-slate-500 dark:text-slate-400"/></div>
                            Top 10: Mais Movimentados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.top10Movimentados.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-4 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 p-2 -mx-2 rounded-xl transition-all">
                                <div className="flex items-center gap-4 w-3/4">
                                    <span className="text-xs font-black text-slate-300 dark:text-slate-600 w-5">{idx+1}.</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                </div>
                                <Badge variant="secondary" className="font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">{item.count} ops</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[450px]">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8">
                        <CardTitle className="text-base font-bold flex items-center gap-3 tracking-tight">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><DollarSign className="h-4 w-4 text-slate-500 dark:text-slate-400"/></div>
                            Top 10: Maior Capital Alocado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.top10Valor.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-4 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 p-2 -mx-2 rounded-xl transition-all">
                                <div className="flex items-center gap-4 w-[60%]">
                                    <span className="text-xs font-black text-slate-300 dark:text-slate-600 w-5">{idx+1}.</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                </div>
                                <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0 text-base">
                                    {formatCurrency((item.quantidade_total || item.quantidade) * (item.preco || 0))}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[450px]">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8">
                        <CardTitle className="text-base font-bold flex items-center gap-3 tracking-tight">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500"/></div>
                            Itens em Risco de Rutura
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.estoqueCritico.map((item: any, idx: number) => {
                            const disp = (item.quantidade_total || item.quantidade) - (item.quantidade_reservada || 0);
                            return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/50 pb-4 mb-4 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 p-2 -mx-2 rounded-xl transition-all">
                                <div className="flex items-center gap-4 w-[60%]">
                                    <span className="text-xs font-black text-slate-300 dark:text-slate-600 w-5">{idx+1}.</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-black text-amber-600 dark:text-amber-400 text-base">{disp} un.</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Mínimo: {item.estoque_minimo}</span>
                                </div>
                            </div>
                        )})}
                        {analytics?.estoqueCritico.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-emerald-500">
                                <Package className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm font-bold tracking-wide">Nenhuma rutura iminente.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="custos-setor" className={tabContentClass}>
           <div className="w-full">
               <NubankLineChart 
                 timelineData={analytics?.sectorTimelineData}
                 sectorTotals={analytics?.sectorValueData}
                 totalValue={analytics?.totalSectorValue}
                 title="Custos Operacionais por Setor Interno" 
                 icon={Layers} 
                 isCurrency={true}
               />
           </div>
        </TabsContent>

        <TabsContent value="valor-op" className={tabContentClass}>
            <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl flex flex-col h-[650px] overflow-hidden">
                <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-6 px-8">
                    <CardTitle className="text-base font-bold flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><Briefcase className="h-4 w-4 text-slate-500 dark:text-slate-400"/></div>
                        Custo Acumulado Histórico por OP
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                    {analytics?.opValueData && analytics.opValueData.length > 0 ? (
                        <div className="space-y-4">
                            {analytics.opValueData.map((op: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm border border-slate-100 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 p-5 rounded-[1.5rem] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                    <div className="flex flex-col gap-2 w-[60%]">
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-slate-800 dark:text-slate-200 text-lg tracking-tight">OP: {op.op_code}</span>
                                            {op.status === 'finalizada' || op.status === 'encerrada' ? (
                                                <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[10px] py-0.5 px-2 flex items-center gap-1.5 shadow-none rounded-md">
                                                    <Lock className="w-3 h-3" /> Finalizada
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-blue-50/80 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400 text-[10px] py-0.5 px-2 flex items-center gap-1.5 shadow-none rounded-md">
                                                    <Activity className="w-3 h-3" /> Em Andamento
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-[12px] font-semibold text-slate-400">{op.totalItems} peças / itens separados no total</span>
                                    </div>
                                    <div className="flex items-center gap-6 shrink-0">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-2xl tracking-tighter">
                                            {formatCurrency(op.totalValue)}
                                        </span>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleExportOpPDF(op)}
                                            className="h-10 rounded-xl font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors shadow-sm"
                                            title="Exportar Extrato da OP"
                                        >
                                            <FileText className="w-4 h-4 mr-2 text-indigo-500" /> Extrato PDF
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Archive className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-semibold tracking-wide">Nenhuma OP com custos alocados no momento.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="reposicao-garantia" className={tabContentClass}>
            <Card className="shadow-lg border-white/40 dark:border-slate-800/60 rounded-[2rem] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 pb-5 pt-8 px-8 relative z-10">
                    <CardTitle className="text-xl font-bold flex items-center gap-3 tracking-tight">
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl"><ShieldAlert className="h-5 w-5 text-slate-500 dark:text-slate-400" /></div>
                        Registo Analítico de Ocorrências
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold mt-1.5 tracking-wide">Lançamento de valores virtuais para demonstrações de resultados operacionais.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8 px-8 pb-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] shadow-sm">
                            <Label className="text-sm font-bold flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><Package className="w-4 h-4" /></div> Ganho de Venda (Reposição)
                            </Label>
                            <p className="text-[11px] text-slate-400 font-semibold mb-2">Simulação de lucro associado a reposições de inventário.</p>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">R$</span>
                                <Input 
                                    type="number" 
                                    value={custoReposicao} 
                                    onChange={(e) => setCustoReposicao(e.target.value)} 
                                    className="pl-14 h-14 text-xl font-black rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-inner focus-visible:ring-emerald-500" 
                                />
                            </div>
                        </div>
                        <div className="space-y-4 p-6 bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] shadow-sm">
                            <Label className="text-sm font-bold flex items-center gap-2.5 text-rose-700 dark:text-rose-400 uppercase tracking-widest">
                                <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg"><Receipt className="w-4 h-4" /></div> Perda Operacional (Garantia)
                            </Label>
                            <p className="text-[11px] text-slate-400 font-semibold mb-2">Deficiências e quebras cobertas pela garantia do sistema.</p>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">R$</span>
                                <Input 
                                    type="number" 
                                    value={custoGarantia} 
                                    onChange={(e) => setCustoGarantia(e.target.value)} 
                                    className="pl-14 h-14 text-xl font-black rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-inner focus-visible:ring-rose-500" 
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-white/40 dark:border-slate-800/60 rounded-[1.5rem] bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-lg">
                    <CardContent className="p-8 flex flex-col justify-center h-full">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-2">Capital Referência</p>
                        <p className="text-3xl font-black tracking-tighter">{formatCurrency(analytics?.valorTotalEstoque || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="border-emerald-200/50 dark:border-emerald-900/30 bg-emerald-50/70 dark:bg-emerald-950/20 backdrop-blur-xl rounded-[1.5rem] shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-bl-full pointer-events-none" />
                    <CardContent className="p-8 flex flex-col justify-center h-full relative z-10">
                        <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-500 uppercase tracking-[0.15em] mb-2">Projeção Ganhos</p>
                        <p className="text-3xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">+{formatCurrency(Number(custoReposicao) || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="border-rose-200/50 dark:border-rose-900/30 bg-rose-50/70 dark:bg-rose-950/20 backdrop-blur-xl rounded-[1.5rem] shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-400/10 rounded-bl-full pointer-events-none" />
                    <CardContent className="p-8 flex flex-col justify-center h-full relative z-10">
                        <p className="text-xs font-bold text-rose-600/80 dark:text-rose-500 uppercase tracking-[0.15em] mb-2">Projeção Perdas</p>
                        <p className="text-3xl font-black tracking-tighter text-rose-600 dark:text-rose-400">-{formatCurrency(Number(custoGarantia) || 0)}</p>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="pedidos-reposicao" className={tabContentClass}>
          <div className="mb-6 pl-2">
             <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
                 <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl"><Truck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" /></div>
                 Métricas de Pedidos de Reposição
             </h2>
             <p className="text-sm font-medium text-slate-500 tracking-wide mt-2 ml-14">Análise de desempenho e status do fluxo de atendimento de reposições no período.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
                title="Total de Pedidos" 
                value={metricsReplenishments.total} 
                subtext="Pedidos emitidos no período" 
                icon={ListChecks} iconColor="text-slate-600 dark:text-slate-400" 
                gradientClass="bg-slate-400/20"
            />
            <KPICard 
                title="Aguardando (Pendente)" 
                value={metricsReplenishments.pendentes} 
                subtext="Requerem ação do backoffice" 
                icon={Clock} iconColor="text-amber-600 dark:text-amber-400" 
                gradientClass="bg-amber-500/20"
            />
            <KPICard 
                title="Em Preparo" 
                value={metricsReplenishments.emPreparo} 
                subtext="Sendo separados no armazém" 
                icon={Package} iconColor="text-blue-600 dark:text-blue-400" 
                gradientClass="bg-blue-500/20"
            />
            <KPICard 
                title="Finalizados" 
                value={metricsReplenishments.concluidos} 
                subtext={`Faturação: ${formatCurrency(metricsReplenishments.valorTotalConcluido)}`} 
                icon={CheckCircle2} iconColor="text-emerald-600 dark:text-emerald-400" 
                gradientClass="bg-emerald-500/20"
            />
          </div>
        </TabsContent>

        <TabsContent value="producao-3d" className={tabContentClass}>
          <div className="mb-6 pl-2">
             <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl"><Printer className="h-6 w-6 text-blue-600 dark:text-blue-400" /></div>
                 Métricas de Produção 3D
             </h2>
             <p className="text-sm font-medium text-slate-500 tracking-wide mt-2 ml-14">Desempenho da manufatura aditiva, tempos operacionais e volume de material.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
                title="Peças Manufaturadas" 
                value={metrics3D.totalPieces} 
                subtext="Volume bruto expedido" 
                icon={Package} iconColor="text-blue-600 dark:text-blue-400" 
                gradientClass="bg-blue-500/20"
            />
            <KPICard 
                title="Matéria-Prima Usada" 
                value={`${metrics3D.totalFilament}g`} 
                subtext="Consumo bruto em filamento" 
                icon={Layers} iconColor="text-emerald-600 dark:text-emerald-400" 
                gradientClass="bg-emerald-500/20"
            />
            <KPICard 
                title="Carga de Máquina" 
                value={metrics3D.tempoFormatado} 
                subtext="Horas reais operacionais" 
                icon={Clock} iconColor="text-amber-600 dark:text-amber-400" 
                gradientClass="bg-amber-500/20"
            />
            <KPICard 
                title="Lotes Finalizados" 
                value={metrics3D.ordensFinalizadas} 
                subtext="Ordens de impressão" 
                icon={CheckCircle2} iconColor="text-purple-600 dark:text-purple-400" 
                gradientClass="bg-purple-500/20"
            />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
