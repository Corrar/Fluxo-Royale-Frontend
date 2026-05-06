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
  AlertTriangle, AlertOctagon, Lock
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

// --- CONFIGURAÇÕES VISUAIS ---
const C_AZUL_ROYALE: [number, number, number] = [30, 58, 138]; 
const C_AMARELO_OURO: [number, number, number] = [234, 179, 8]; 
const C_TEXTO_ESCURO: [number, number, number] = [51, 65, 85]; 

const COLORS = {
    entradas: '#10b981', 
    saidas: '#6366f1',   
    manuais: '#f59e0b',  
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

const CustomLineTooltip = ({ active, payload, label, isCurrency = true }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const value = data.value;
      const name = data.dataKey;
      const color = data.stroke;
      
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xl text-sm z-50">
          <p className="font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider text-xs">{label}</p>
          <div className="flex justify-between gap-6 items-center">
              <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                  {name === 'Total' ? 'Visão Global' : name}
              </span>
              <span className="font-black text-lg text-slate-900 dark:text-white">
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
        <Card className="gsap-chart-card shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col h-full rounded-[2.5rem] bg-white dark:bg-[#0a0f1c] hover:shadow-xl transition-all duration-500 overflow-hidden w-full mx-auto">
            <CardHeader className="pb-0 pt-8 px-6 sm:px-10 border-none flex flex-col gap-1 items-start">
                <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />} {title} {activeSector ? `- ${activeSector}` : '- Visão Global'}
                </CardTitle>
                <div className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 dark:text-white mt-1 transition-colors duration-500" style={{ color: activeSector ? currentColor : undefined }}>
                    {formatCurrency(currentTotal)}
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 pt-8 pb-8 px-4 sm:px-8 flex flex-col lg:flex-row gap-8">
                
                <div className="flex-1 min-h-[350px] sm:min-h-[450px]">
                    {timelineData && timelineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                                <Tooltip content={<CustomLineTooltip isCurrency={true} />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Line 
                                    key={dataKey}
                                    type="monotone" 
                                    dataKey={dataKey} 
                                    stroke={currentColor} 
                                    strokeWidth={4}
                                    dot={false}
                                    activeDot={{ r: 7, fill: currentColor, stroke: '#fff', strokeWidth: 3 }}
                                    isAnimationActive={true}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Activity className="h-10 w-10 opacity-30" />
                            <span className="text-sm font-medium tracking-wide">Sem dados na linha do tempo</span>
                        </div>
                    )}
                </div>
                
                <div className="w-full lg:w-80 flex flex-col gap-2 overflow-y-auto max-h-[350px] sm:max-h-[450px] custom-scrollbar pr-2 shrink-0">
                    <div 
                        onClick={() => setActiveSector(null)}
                        className="p-4 rounded-2xl cursor-pointer border transition-all flex items-center justify-between group"
                        style={{
                            borderColor: activeSector === null ? '#820ad1' : 'transparent',
                            backgroundColor: activeSector === null ? 'rgba(130, 10, 209, 0.08)' : 'transparent'
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn("w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all", activeSector === null ? "border-[#820ad1]" : "border-slate-300 dark:border-slate-600")}>
                                {activeSector === null && <div className="w-2 h-2 rounded-full bg-[#820ad1]"></div>}
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
                            className="p-4 rounded-2xl cursor-pointer border transition-all flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50"
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
                                    <span className={cn("font-bold truncate text-sm transition-colors", isActive ? "dark:text-white text-slate-900" : "text-slate-700 dark:text-slate-300")} title={sector.name}>{sector.name}</span>
                                    <span className="text-[10px] text-slate-500 font-semibold">{percent}% do total mensal</span>
                                </div>
                            </div>
                            <span className={cn("font-black text-sm shrink-0 transition-colors", isActive ? "" : "text-slate-600 dark:text-slate-400")} style={{ color: isActive ? sector.fill : undefined }}>
                                {formatCurrency(sector.value)}
                            </span>
                        </div>
                    )})}
                </div>
            </CardContent>
        </Card>
    );
};

const KPICard = ({ title, value, subtext, icon: Icon, iconColor, trend, trendValue }: any) => (
    <Card className="gsap-kpi-card hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800 rounded-2xl">
        <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
                <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="flex flex-col mt-2">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
                
                <div className="flex items-center gap-2 mt-2">
                    {trend && (
                        <Badge variant="outline" className={cn(
                            "px-1.5 py-0 text-[10px] font-bold border-0",
                            trend === 'up' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                           : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                            {trendValue}
                        </Badge>
                    )}
                    {subtext && <span className="text-xs text-muted-foreground font-medium">{subtext}</span>}
                </div>
            </div>
        </CardContent>
    </Card>
);

const AlertCard = ({ icon: Icon, title, desc, variant }: any) => (
    <div className={`p-4 rounded-xl border flex items-start gap-4 shadow-sm ${
        variant === 'rose' 
            ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50' 
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50'
    }`}>
        <div className={`p-2 rounded-lg ${variant === 'rose' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <h4 className={`font-bold ${variant === 'rose' ? 'text-rose-900 dark:text-rose-300' : 'text-amber-900 dark:text-amber-300'}`}>{title}</h4>
            <p className={`text-sm mt-0.5 ${variant === 'rose' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>{desc}</p>
        </div>
    </div>
);

export default function Reports() {
  const [startDate, setStartDate] = useState(startOfMonth(new Date()).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endOfMonth(new Date()).toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("visao-global"); 
  
  const [custoReposicao, setCustoReposicao] = useState<string>("0");
  const [custoGarantia, setCustoGarantia] = useState<string>("0");

  const [searchEntradas, setSearchEntradas] = useState("");
  const [searchSaidas, setSearchSaidas] = useState("");
  const [filtroCategoriaSaida, setFiltroCategoriaSaida] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["reports-general", startDate, endDate],
    queryFn: async () => {
      const response = await api.get("/reports/general", { params: { startDate, endDate, includeAllTimeOps: true } });
      return response.data;
    },
    refetchOnWindowFocus: false
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

  useGSAP(() => {
    if (!isLoading && reportData) {
        gsap.from(".gsap-kpi-card", { y: 20, opacity: 0, duration: 0.5, stagger: 0.05, ease: "power2.out", clearProps: "all" });
    }
  }, [isLoading, reportData]);

  useGSAP(() => {
      gsap.from(".gsap-tab-content", { y: 15, opacity: 0, duration: 0.4, ease: "power2.out", clearProps: "all" });
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

    const valorTotalEstoque = estoque.reduce((acc: number, item: any) => acc + (Number(item.quantidade_total || item.quantidade || 0) * Number(item.preco || 0)), 0);
    
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

    const getPrecoEstoque = (produtoNome: string) => {
        const itemEstoque = estoque.find((e:any) => 
            e.produto?.trim().toLowerCase() === produtoNome?.trim().toLowerCase() || 
            e.name?.trim().toLowerCase() === produtoNome?.trim().toLowerCase()
        );
        return Number(itemEstoque?.preco) || 0;
    };

    const valorTotalEntradas = todasEntradas.reduce((acc: number, cur: any) => {
        const preco = Number(cur.preco_unitario) || getPrecoEstoque(cur.produto);
        return acc + (Number(cur.quantidade) * preco);
    }, 0);

    const valorTotalSaidas = todasSaidas.reduce((acc: number, cur: any) => {
        const preco = Number(cur.preco_unitario) || getPrecoEstoque(cur.produto);
        return acc + (Number(cur.quantidade) * preco);
    }, 0);

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

    const timelineMap = new Map();
    const processDate = (dateStr: string, type: string) => {
      const dateKey = format(new Date(dateStr), 'dd/MM');
      if (!timelineMap.has(dateKey)) timelineMap.set(dateKey, { name: dateKey, entradas: 0, saidas_sistema: 0, saidas_manual: 0 });
      const entry = timelineMap.get(dateKey);
      if (type === 'in') entry.entradas += 1;
      else if (type === 'out_sis') entry.saidas_sistema += 1;
      else entry.saidas_manual += 1;
    };

    entradasPuras.forEach((i: any) => processDate(i.data, 'in'));
    saidasSistemaPuras.forEach((i: any) => processDate(i.data, 'out_sis'));
    saidasManuaisPuras.forEach((i: any) => processDate(i.data, 'out_man')); 

    const chartData = Array.from(timelineMap.values()).sort((a, b) => {
       const [d1, m1] = a.name.split('/').map(Number);
       const [d2, m2] = b.name.split('/').map(Number);
       return m1 - m2 || d1 - d2;
    });

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
      opsEntrada: entradasPuras.length, 
      opsSaidaTotal: saidasManuaisPuras.length + saidasSistemaPuras.length, 
      saidasSolicitacaoTotal: saidasSistemaPuras.length,
      saidasManuaisTotal: saidasManuaisPuras.length, 
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
      getPrecoEstoque, // 🟢 AQUI: Expomos a função para ser usada pelo Excel
      comparativo: {
          entradas: entradasPuras.length,
          saidas: saidasManuaisPuras.length + saidasSistemaPuras.length,
          entradasAnt: compMesAnterior.entradas,
          saidasAnt: compMesAnterior.saidas,
      }
    };
  }, [reportData, travelOrders, custoReposicao, custoGarantia, searchEntradas, searchSaidas, startDate, endDate]);

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

    // 🟢 AQUI: Adicionamos as colunas de "Valor Unitário" e "Valor Total" nas Entradas
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
    
    // 🟢 AQUI: Adicionamos as colunas de "Valor Unitário" e "Valor Total" nas Saídas
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

  const tabContentClass = "space-y-6 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-4 duration-500 ease-out";

  return (
    <div ref={containerRef} className="space-y-6 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-2">
        <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <Zap className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                Business Intelligence
            </h1>
            <p className="text-muted-foreground mt-1 ml-11 text-sm">
                Análise de Performance e Dados Gerenciais
            </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-xl border shadow-sm w-full lg:w-auto">
            <div className="flex items-center px-3 gap-2 border-r border-slate-200 dark:border-slate-800">
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <Input 
                    type="date" 
                    className="h-8 w-[120px] border-0 bg-transparent focus-visible:ring-0 text-xs font-semibold p-0 cursor-pointer" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                />
                <span className="text-slate-300">-</span>
                <Input 
                    type="date" 
                    className="h-8 w-[120px] border-0 bg-transparent focus-visible:ring-0 text-xs font-semibold p-0 cursor-pointer text-right" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                />
            </div>
            
            <div className="flex gap-1 pr-2">
                <Button onClick={() => setQuickDate('today')} variant="ghost" size="sm" className="h-8 text-xs px-3">Hoje</Button>
                <Button onClick={() => setQuickDate('month')} variant="secondary" size="sm" className="h-8 text-xs px-3">Mês</Button>
                <Button onClick={() => refetch()} variant="ghost" size="icon" className="h-8 w-8 ml-1">
                    <RefreshCw className={`h-4 w-4 ${isLoading || isRefetching ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
      </div>

      {analytics && (analytics.obsoletos.length > 0 || analytics.estoqueCritico.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analytics.obsoletos.length > 0 && (
                <AlertCard 
                    icon={Clock} 
                    title="Alerta de Obsolescência" 
                    desc={`Detectados ${analytics.obsoletos.length} itens parados há +90 dias.`} 
                    variant="rose" 
                />
            )}
            {analytics.estoqueCritico.length > 0 && (
                <AlertCard 
                    icon={AlertOctagon} 
                    title="Rutura Crítica" 
                    desc={`${analytics.estoqueCritico.length} itens abaixo do estoque mínimo.`} 
                    variant="amber" 
                />
            )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        
        <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9 font-medium shadow-sm text-xs">
                <FileText className="w-4 h-4 mr-2 text-rose-500" /> PDF Geral
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 font-medium shadow-sm text-xs">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> Excel
            </Button>
        </div>

        <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 w-full h-auto p-1 gap-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl">
            <TabsTrigger value="visao-global" className="rounded-lg text-xs md:text-sm py-2">Visão Global</TabsTrigger>
            <TabsTrigger value="movimentacoes" className="rounded-lg text-xs md:text-sm py-2">Movimentações</TabsTrigger>
            <TabsTrigger value="saude-estoque" className="rounded-lg text-xs md:text-sm py-2">Saúde do Estoque</TabsTrigger>
            <TabsTrigger value="custos-setor" className="rounded-lg text-xs md:text-sm py-2">Custos & Setores</TabsTrigger>
            <TabsTrigger value="valor-op" className="rounded-lg text-xs md:text-sm py-2">Valor por OP</TabsTrigger>
            <TabsTrigger value="reposicao-garantia" className="rounded-lg text-xs md:text-sm py-2">Reposição</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-global" className={tabContentClass}>
          {isLoading || !analytics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Capital Físico" value={formatCurrencyNoDecimals(analytics.valorTotalEstoque)} subtext="Valor armazenado" icon={DollarSign} iconColor="text-indigo-600 dark:text-indigo-400" />
              <KPICard title="Solicitações" value={analytics.saidasSolicitacaoTotal} subtext="Via sistema" icon={Briefcase} iconColor="text-blue-600 dark:text-blue-400" />
              <KPICard title="Entradas" value={analytics.opsEntrada} subtext="Lotes recebidos" icon={ArrowDownToLine} iconColor="text-emerald-600 dark:text-emerald-400" />
              <KPICard title="Saídas Manuais" value={analytics.saidasManuaisTotal} subtext="Retiradas avulsas" icon={ArrowUpFromLine} iconColor="text-amber-600 dark:text-amber-400" />
            </div>
          )}

          <Card id="chart-flow" className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    Fluxo Temporal de Movimentação
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[380px] w-full pt-4">
                {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                        <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                        <YAxis fontSize={12} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} />
                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} iconType="circle" />
                        <Bar dataKey="entradas" name="Entradas" fill={COLORS.entradas} radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="saidas_sistema" name="Solicitações" fill={COLORS.saidas} radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="saidas_manual" name="Saída Manual" fill={COLORS.manuais} radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentacoes" className={tabContentClass}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KPICard 
                  title="Valor Movimentado (Entrada)" 
                  value={formatCurrency(analytics?.valorTotalEntradas || 0)} 
                  subtext="Custo total de produtos recebidos" 
                  icon={ArrowDownToLine} iconColor="text-emerald-600 dark:text-emerald-400" 
                  trend="up" trendValue="Positivo"
              />
              <KPICard 
                  title="Valor Movimentado (Saída)" 
                  value={formatCurrency(analytics?.valorTotalSaidas || 0)} 
                  subtext="Custo total de produtos expedidos" 
                  icon={ArrowUpFromLine} iconColor="text-rose-600 dark:text-rose-400" 
                  trend="down" trendValue="Consumo"
              />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[600px]">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6">
                        <CardTitle className="text-base flex items-center justify-between gap-4 font-bold">
                            <div className="flex items-center gap-2 shrink-0">
                                <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                                Entradas Registradas
                            </div>
                            <div className="relative w-full max-w-[12rem] hidden sm:block">
                                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Buscar produto..." className="pl-8 h-8 text-xs bg-white dark:bg-slate-950" value={searchEntradas} onChange={(e) => setSearchEntradas(e.target.value)} />
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.raw.entradasFiltradas.map((item: any, idx: number) => {
                            const isConfronto = item.origem_tipo === 'CONFRONTO';
                            return (
                                <div key={idx} className={cn(
                                    "flex justify-between items-start text-sm border-b pb-3 mb-3 last:border-0 p-3 -mx-3 rounded-2xl transition-colors",
                                    isConfronto ? "bg-violet-50/80 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/30 shadow-sm" : "border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                )}>
                                    <div className="flex flex-col gap-0.5 w-[70%]">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                        {isConfronto ? (
                                            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-300 border-0 mt-1 gap-1 px-2 py-0 w-max shadow-none">
                                                <Plane className="w-3 h-3" /> Acerto Viagem: {item.detalhes_confronto?.city}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Origem: {item.origem || 'Fornecedor'}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">+{item.quantidade} un.</span>
                                        <span className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(item.data), 'dd/MM/yyyy HH:mm')}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[600px]">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6">
                        <CardTitle className="text-base flex flex-wrap items-center justify-between gap-4 font-bold">
                            <div className="flex items-center gap-2 shrink-0">
                                <ArrowUpFromLine className="h-4 w-4 text-rose-500" />
                                Saídas Registradas
                            </div>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <select 
                                    value={filtroCategoriaSaida}
                                    onChange={(e) => setFiltroCategoriaSaida(e.target.value)}
                                    className="flex-1 sm:flex-none h-8 text-xs border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-950 px-2 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow"
                                >
                                    <option value="">Todas Categorias</option>
                                    <option value="solicitacao">Por Solicitação</option>
                                    <option value="manual">Manuais</option>
                                    <option value="separacao">Por Separação</option>
                                    <option value="reposicao">Pedido Reposição</option>
                                    <option value="viagem">Saída de Viagem</option>
                                </select>
                                <div className="relative flex-1 sm:flex-none max-w-[8rem] sm:max-w-[10rem]">
                                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Buscar..." className="pl-8 h-8 text-xs bg-white dark:bg-slate-950" value={searchSaidas} onChange={(e) => setSearchSaidas(e.target.value)} />
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        {saidasExibidas.map((item: any, idx: number) => {
                            const categoria = obterCategoriaSaida(item);
                            
                            let corDestaque = "border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40";
                            let BadgeIcon = ArrowUpFromLine;
                            let badgeLabel = "Saída Padrão";
                            let badgeClasses = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                            switch (categoria) {
                                case 'manual':
                                    corDestaque = "bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 shadow-sm";
                                    badgeLabel = "Saída Manual";
                                    badgeClasses = "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300";
                                    break;
                                case 'solicitacao':
                                    corDestaque = "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 shadow-sm";
                                    badgeLabel = "Solicitação";
                                    badgeClasses = "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300";
                                    break;
                                case 'separacao':
                                    corDestaque = "bg-purple-50/50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30 shadow-sm";
                                    badgeLabel = item.op_code ? `Separação (OP: ${item.op_code})` : "Separação";
                                    badgeClasses = "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300";
                                    break;
                                case 'reposicao':
                                    corDestaque = "bg-teal-50/50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/30 shadow-sm";
                                    badgeLabel = item.order_number ? `Pedido de Reposição (Nº ${item.order_number})` : "Pedido de Reposição";
                                    badgeClasses = "bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/50 dark:text-teal-300";
                                    break;
                                case 'viagem':
                                    corDestaque = "bg-violet-50/80 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/30 shadow-sm";
                                    BadgeIcon = Plane;
                                    badgeLabel = `Consumo Viagem: ${item.detalhes_confronto?.city}`;
                                    badgeClasses = "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-300";
                                    break;
                            }

                            return (
                                <div key={idx} className={cn(
                                    "flex justify-between items-start text-sm border-b pb-3 mb-3 last:border-0 p-3 -mx-3 rounded-2xl transition-colors",
                                    corDestaque
                                )}>
                                    <div className="flex flex-col gap-0.5 w-[70%]">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                        <Badge className={cn("border-0 mt-1 gap-1 px-2 py-0 w-max shadow-none", badgeClasses)}>
                                            <BadgeIcon className="w-3 h-3" /> {badgeLabel}
                                        </Badge>
                                        
                                        {categoria !== 'viagem' && (
                                            <span className="text-xs text-muted-foreground truncate mt-0.5">Para: {item.destino_setor || item.client_service || 'N/A'}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="font-bold text-rose-600 dark:text-rose-400">-{item.quantidade} un.</span>
                                        <span className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(item.data), 'dd/MM/yyyy HH:mm')}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {saidasExibidas.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Archive className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-sm font-medium">Nenhuma saída encontrada nesta categoria.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
          </div>
        </TabsContent>

        <TabsContent value="saude-estoque" className={tabContentClass}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[400px]">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground"/>
                            Estoque Parado (+90 dias)
                        </CardTitle>
                        <Badge variant="outline" className="font-semibold">{formatCurrency(analytics?.valorTotalObsoletos)} imobilizado</Badge>
                    </CardHeader>
                    <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.obsoletos.map((item: any, idx: number) => {
                            const disp = Number(item.quantidade_total || item.quantidade || 0);
                            return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 last:border-0">
                                <div className="flex flex-col gap-0.5 w-[65%]">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                    <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{disp} un.</span>
                                    <span className="text-[10px] text-muted-foreground">Últ. Mov: {item.ultima_movimentacao ? format(new Date(item.ultima_movimentacao), 'dd/MM/yyyy') : 'Nunca'}</span>
                                </div>
                            </div>
                        )})}
                        {analytics?.obsoletos.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Package className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm font-medium">Estoque limpo</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[400px]">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground"/>
                            Top 10 Maior Giro
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.top10Movimentados.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 last:border-0">
                                <div className="flex items-center gap-3 w-3/4">
                                    <span className="text-xs font-bold text-muted-foreground w-4">{idx+1}.</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                </div>
                                <Badge variant="secondary" className="font-bold shrink-0">{item.count} ops</Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[400px]">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground"/>
                            Top 10 Maior Valor Armazenado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.top10Valor.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 last:border-0">
                                <div className="flex items-center gap-3 w-[60%]">
                                    <span className="text-xs font-bold text-muted-foreground w-4">{idx+1}.</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                </div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    {formatCurrency((item.quantidade_total || item.quantidade) * (item.preco || 0))}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[400px]">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground"/>
                            Itens em Risco de Rutura
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.estoqueCritico.map((item: any, idx: number) => {
                            const disp = (item.quantidade_total || item.quantidade) - (item.quantidade_reservada || 0);
                            return (
                            <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 last:border-0">
                                <div className="flex items-center gap-3 w-[60%]">
                                    <span className="text-xs font-bold text-muted-foreground w-4">{idx+1}.</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.produto}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-bold text-amber-600 dark:text-amber-400">{disp} un.</span>
                                    <span className="text-[10px] text-muted-foreground">Mín: {item.estoque_minimo}</span>
                                </div>
                            </div>
                        )})}
                        {analytics?.estoqueCritico.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Package className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm font-medium">Estoque saudável</p>
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
                 title="Custos por Setor Interno" 
                 icon={Layers} 
                 isCurrency={true}
               />
           </div>
        </TabsContent>

        {/* 🟢 ABA: VALOR POR OP */}
        <TabsContent value="valor-op" className={tabContentClass}>
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col h-[600px]">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 pb-4 pt-5 px-6">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground"/>
                        Custo Acumulado Histórico por OP
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 px-6 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                    {analytics?.opValueData && analytics.opValueData.length > 0 ? (
                        <div className="space-y-4">
                            {analytics.opValueData.map((op: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800/60 pb-3 mb-3 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -mx-2 rounded-lg transition-colors">
                                    <div className="flex flex-col gap-1 w-[60%]">
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-base">OP: {op.op_code}</span>
                                            {op.status === 'finalizada' || op.status === 'encerrada' ? (
                                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[10px] py-0 flex items-center gap-1 shadow-none">
                                                    <Lock className="w-3 h-3" /> Finalizada (Congelada)
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 text-[10px] py-0 flex items-center gap-1 shadow-none">
                                                    <Activity className="w-3 h-3" /> Em Andamento
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{op.totalItems} peças/itens separados no total</span>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-lg">
                                            {formatCurrency(op.totalValue)}
                                        </span>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleExportOpPDF(op)}
                                            className="h-8 bg-white dark:bg-slate-950 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                                            title="Exportar Extrato da OP"
                                        >
                                            <FileText className="w-4 h-4 mr-2 text-rose-500" /> PDF
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Archive className="w-10 h-10 mb-2 opacity-30" />
                            <p className="text-sm font-medium">Nenhuma OP encontrada ou backend pendente de atualização.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="reposicao-garantia" className={tabContentClass}>
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 pt-6 px-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                        Registo de Operações Secundárias
                    </CardTitle>
                    <CardDescription>Valores paralelos para cálculo de lucro e perda (não afeta estoque físico).</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 px-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                                <Package className="w-4 h-4" /> Ganho de Venda (Reposição)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                                <Input 
                                    type="number" 
                                    value={custoReposicao} 
                                    onChange={(e) => setCustoReposicao(e.target.value)} 
                                    className="pl-10 h-12 text-lg font-bold bg-slate-50 dark:bg-slate-900" 
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                                <Receipt className="w-4 h-4" /> Perda Operacional (Garantia)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                                <Input 
                                    type="number" 
                                    value={custoGarantia} 
                                    onChange={(e) => setCustoGarantia(e.target.value)} 
                                    className="pl-10 h-12 text-lg font-bold bg-slate-50 dark:bg-slate-900" 
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Estoque Atual</p>
                        <p className="text-2xl font-bold">{formatCurrency(analytics?.valorTotalEstoque || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl shadow-sm">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase mb-1">Total Ganhos</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">+{formatCurrency(Number(custoReposicao) || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl shadow-sm">
                    <CardContent className="p-6 flex flex-col justify-center h-full">
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-500 uppercase mb-1">Total Perdas</p>
                        <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">-{formatCurrency(Number(custoGarantia) || 0)}</p>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
