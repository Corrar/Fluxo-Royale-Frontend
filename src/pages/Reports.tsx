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
  DollarSign, AlertOctagon, AlertTriangle, Clock, BarChart3, Zap, ShieldAlert, Receipt,
  ArrowDownToLine, ArrowUpFromLine, Search, Layers, Briefcase
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas"; 
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LabelList, Cell
} from "recharts";
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// --- CONFIGURAÇÕES VISUAIS PREMIUM ---
const C_AZUL_ROYALE: [number, number, number] = [30, 58, 138]; // slate-900
const C_AMARELO_OURO: [number, number, number] = [234, 179, 8]; // amber-500
const C_TEXTO_ESCURO: [number, number, number] = [51, 65, 85]; // slate-700

const COLORS = {
    entradas: '#10b981', 
    saidas: '#6366f1',   
    manuais: '#f59e0b',  
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

// Formata moeda sem as casas decimais para caber nos Cards
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

const CustomBarTooltip = ({ active, payload, label, totalValue, isCurrency = false }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const percent = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
    
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xl text-sm z-50 backdrop-blur-xl">
        <p className="font-extrabold text-slate-800 dark:text-slate-100 mb-3 text-base">{label}</p>
        <div className="flex flex-col gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between gap-8 items-center">
                <span className="flex items-center gap-2 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: payload[0].fill}}></span>
                    {isCurrency ? 'Montante Calculado:' : 'Quantidade Total:'}
                </span>
                <span className="font-black text-slate-900 dark:text-white text-base">
                    {isCurrency ? formatCurrency(value) : value}
                </span>
            </div>
            {!isCurrency && (
                <div className="flex justify-between gap-6 items-center border-t border-slate-100 dark:border-slate-800/60 pt-3 mt-1">
                    <span className="font-medium">Impacto na Operação:</span>
                    <Badge variant="outline" className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/30 px-2.5 py-1">
                        {percent}% do Total
                    </Badge>
                </div>
            )}
        </div>
      </div>
    );
  }
  return null;
};

const SectorBarChart = ({ data, totalValue, title, icon: Icon, colorClass, barColor, isCurrency = false }: any) => {
    const processedData = useMemo(() => {
        if(!data) return [];
        return data.map((item: any) => ({
            ...item,
            labelContent: isCurrency 
                ? formatCurrency(item.value) 
                : `${item.value} (${((item.value / totalValue) * 100).toFixed(1)}%)`
        }));
    }, [data, totalValue, isCurrency]);

    return (
        <Card className="gsap-chart-card relative overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-2xl dark:shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 transition-all duration-500 bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl h-full flex flex-col rounded-[2.5rem] group">
            <CardHeader className="border-b bg-slate-50/30 dark:bg-slate-950/30 border-slate-100 dark:border-slate-800 pb-6 px-8 pt-8">
                <CardTitle className="flex items-center gap-4 text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    <div className={`p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 ${colorClass}`}>
                        {Icon && <Icon className="h-6 w-6" />}
                    </div>
                    {title}
                </CardTitle>
                <CardDescription className="flex items-center justify-between mt-3">
                    <span className="font-medium text-sm">Volume Global Analisado</span>
                    <span className="font-black text-slate-900 dark:text-white text-base bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-xl shadow-inner">
                        {isCurrency ? formatCurrency(totalValue) : totalValue}
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pt-8 pb-4 px-6 min-h-[350px]">
                {processedData && processedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={processedData} margin={{ top: 5, right: isCurrency ? 110 : 70, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.15} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12, fill: '#64748b', fontWeight: 600}} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomBarTooltip totalValue={totalValue} isCurrency={isCurrency} />} cursor={{fill: '#f8fafc', opacity: 0.05}} />
                            <Bar 
                                dataKey="value" 
                                radius={[0, 8, 8, 0]} 
                                barSize={26} 
                                isAnimationActive={true}
                                animationDuration={2000}
                                animationEasing="ease-out"
                            >
                                {processedData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={barColor} fillOpacity={0.85} className="hover:fill-opacity-100 transition-all cursor-pointer" />
                                ))}
                                <LabelList dataKey="labelContent" position="right" style={{ fill: '#64748b', fontSize: 12, fontWeight: 800 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-4 min-h-[250px] opacity-60">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse">
                            <Archive className="h-8 w-8" />
                        </div>
                        <span className="text-sm font-semibold tracking-wide">Aguardando dados...</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const KPICard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, trend, trendValue }: any) => (
    <Card className="gsap-kpi-card relative overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-2xl dark:shadow-[0_0_30px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-2 transition-all duration-500 bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl group rounded-[2.5rem]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-50 z-0 pointer-events-none"></div>
        <div className={`absolute -right-6 -top-6 p-10 rounded-full opacity-[0.03] dark:opacity-[0.04] transition-transform group-hover:scale-[1.4] group-hover:rotate-12 duration-1000 ease-out ${bgClass.replace('bg-', 'bg-current text-')} ${colorClass}`}>
            <Icon className="w-36 h-36" />
        </div>
        <CardContent className="p-7 sm:p-8 relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-[1.25rem] shadow-inner border border-white/40 dark:border-white/10 ${bgClass} ${colorClass} group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className="w-7 h-7" />
                </div>
                {trend && (
                    <Badge variant="outline" className={`font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm backdrop-blur-md flex items-center gap-1.5 border tracking-wide ${
                        trend === 'up' 
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30' 
                        : 'text-rose-700 dark:text-rose-400 bg-rose-50/90 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30'
                    }`}>
                        {trend === 'up' ? <ArrowUpRight className="w-4 h-4" strokeWidth={3} /> : <ArrowDownRight className="w-4 h-4" strokeWidth={3} />}
                        {trendValue || (trend === 'up' ? 'Alta' : 'Baixa')}
                    </Badge>
                )}
            </div>
            <div className="flex-1 flex flex-col justify-end">
                <h3 
                    className="font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-sm leading-none flex flex-wrap items-baseline gap-1"
                    style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)", wordBreak: "break-word" }}
                >
                    {value}
                </h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-3 tracking-wide uppercase">{title}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse"></span> 
                    {subtext}
                </p>
            </div>
        </CardContent>
    </Card>
);

export default function Reports() {
  const [startDate, setStartDate] = useState(startOfMonth(new Date()).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endOfMonth(new Date()).toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("insights"); 
  
  // Valores Informativos e Isolados
  const [custoReposicao, setCustoReposicao] = useState<string>("0");
  const [custoGarantia, setCustoGarantia] = useState<string>("0");

  // Filtros de Pesquisa para as listas de Histórico
  const [searchEntradas, setSearchEntradas] = useState("");
  const [searchSaidas, setSearchSaidas] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["reports-general", startDate, endDate],
    queryFn: async () => {
      const response = await api.get("/reports/general", { params: { startDate, endDate } });
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  useGSAP(() => {
    if (!isLoading && reportData) {
        gsap.from(".gsap-kpi-card", { y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: "back.out(1.2)", clearProps: "all" });
    }
  }, [isLoading, reportData]);

  useGSAP(() => {
      gsap.from(".gsap-tab-content", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out", clearProps: "all" });
  }, [activeTab]);

  const analytics = useMemo(() => {
    if (!reportData) return null;
    
    const entradas = reportData.entradas || [];
    const saidasManual = (reportData.saidas_separacoes || []).map((i: any) => ({ ...i, origem_tipo: 'MANUAL' }));
    const saidasSolicitacao = (reportData.saidas_solicitacoes || []).map((i: any) => ({ ...i, origem_tipo: 'SISTEMA' })); 
    const todasSaidas = [...saidasManual, ...saidasSolicitacao].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const todasEntradas = [...entradas].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const estoque = reportData.estoque || []; 
    const compMesAnterior = reportData.comparativo_mes_anterior || { entradas: 0, saidas: 0 };

    const valorTotalEstoque = estoque.reduce((acc: number, item: any) => acc + (Number(item.quantidade_total || item.quantidade || 0) * Number(item.preco || 0)), 0);
    
    const valorRep = Number(custoReposicao) || 0;
    const valorGar = Number(custoGarantia) || 0;

    const hoje = new Date();
    
    // Obsoletos (Sem movimentação há +90 dias ou sem registro)
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
    [...entradas, ...todasSaidas].forEach(m => {
        freqMap.set(m.produto, (freqMap.get(m.produto) || 0) + 1);
    });
    const top10Movimentados = Array.from(freqMap.entries())
        .map(([produto, count]) => ({ produto, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const valorPorSetorMap = new Map();
    saidasSolicitacao.forEach((s: any) => {
        const precoItem = s.preco_unitario || (estoque.find((e:any) => e.produto === s.produto)?.preco || 0);
        const val = Number(s.quantidade) * Number(precoItem);
        const setor = s.destino_setor || "Não Informado";
        valorPorSetorMap.set(setor, (valorPorSetorMap.get(setor) || 0) + val);
    });
    const sectorValueData = Array.from(valorPorSetorMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => a.value - b.value); 
    const totalSectorValue = sectorValueData.reduce((acc, curr) => acc + curr.value, 0);

    const timelineMap = new Map();
    const processDate = (dateStr: string, type: string) => {
      const dateKey = format(new Date(dateStr), 'dd/MM');
      if (!timelineMap.has(dateKey)) timelineMap.set(dateKey, { name: dateKey, entradas: 0, saidas_sistema: 0, saidas_manual: 0 });
      const entry = timelineMap.get(dateKey);
      if (type === 'in') entry.entradas += 1;
      else if (type === 'out_sis') entry.saidas_sistema += 1;
      else entry.saidas_manual += 1;
    };

    entradas.forEach((i: any) => processDate(i.data, 'in'));
    saidasSolicitacao.forEach((i: any) => processDate(i.data, 'out_sis'));
    saidasManual.forEach((i: any) => processDate(i.data, 'out_man'));

    const chartData = Array.from(timelineMap.values()).sort((a, b) => {
       const [d1, m1] = a.name.split('/').map(Number);
       const [d2, m2] = b.name.split('/').map(Number);
       return m1 - m2 || d1 - d2;
    });

    // Filtros Locais das Listas
    const entradasFiltradas = todasEntradas.filter((i: any) => i.produto?.toLowerCase().includes(searchEntradas.toLowerCase()));
    const saidasFiltradas = todasSaidas.filter((i: any) => i.produto?.toLowerCase().includes(searchSaidas.toLowerCase()));

    return {
      opsEntrada: entradas.length,
      opsSaidaTotal: todasSaidas.length,
      saidasSolicitacaoTotal: saidasSolicitacao.length,
      saidasManuaisTotal: saidasManual.length,
      chartData,
      sectorValueData,
      totalSectorValue,
      raw: { todasEntradas, todasSaidas, entradasFiltradas, saidasFiltradas },
      valorTotalEstoque,
      valorTotalObsoletos,
      valorRep,
      valorGar,
      obsoletos,
      estoqueCritico,
      top10Valor,
      top10Movimentados,
      comparativo: {
          entradas: entradas.length,
          saidas: todasSaidas.length,
          entradasAnt: compMesAnterior.entradas,
          saidasAnt: compMesAnterior.saidas,
      }
    };
  }, [reportData, custoReposicao, custoGarantia, searchEntradas, searchSaidas]);

  const handleExportExcel = () => {
    if (!analytics) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
        { Metrica: "Capital Físico em Estoque", Valor: analytics.valorTotalEstoque },
        { Metrica: "Total Entradas", Valor: analytics.opsEntrada },
        { Metrica: "Qtd. Solicitações via Sistema", Valor: analytics.saidasSolicitacaoTotal },
        { Metrica: "Qtd. Saídas Manuais", Valor: analytics.saidasManuaisTotal },
        { Metrica: "Valor Obsoleto / Parado", Valor: analytics.valorTotalObsoletos },
        { Metrica: "Ganhos de Venda (Reposição)", Valor: analytics.valorRep },
        { Metrica: "Perdas Operacionais (Garantia)", Valor: analytics.valorGar }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasEntradas.map(i => ({
        Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'), Produto: i.produto, Qtd: i.quantidade, Origem: i.origem || 'Fornecedor'
    }))), "Entradas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasSaidas.map(i => ({
        Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'), Tipo: i.origem_tipo === 'SISTEMA' ? 'Solicitação' : 'Manual', Produto: i.produto, Qtd: i.quantidade, Destino: i.destino_setor
    }))), "Saidas");
    
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
        // Faixa de Cor Executiva no topo
        doc.setFillColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]); 
        doc.rect(0, 0, pageWidth, 42, 'F');
        
        // Fio Dourado / Amarelo Ouro
        doc.setFillColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]); 
        doc.rect(0, 42, pageWidth, 2, 'F');
        
        // Logo Redimensionada
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
        
        // Títulos Principais
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255); 
        doc.text(title.toUpperCase(), pageWidth - margin, 20, { align: "right" });
        
        if (subtitle) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(220, 230, 240); 
            doc.text(subtitle, pageWidth - margin, 26, { align: "right" });
        }

        // Tag de Período
        doc.setFillColor(255, 255, 255, 0.15); // Branco translúcido
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
        // Fundo do Card
        doc.setFillColor(248, 250, 252); // slate-50
        doc.roundedRect(x, y, w, h, 4, 4, 'F');
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, h, 4, 4, 'D');
        
        // Tarja Lateral Colorida
        let mainColor = C_AZUL_ROYALE;
        if (type === 'success') mainColor = [16, 185, 129]; // Emerald
        if (type === 'alert') mainColor = [220, 38, 38]; // Red

        doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]); 
        // Barra indicadora na esquerda
        doc.path([
            { op: 'm', c: [x, y + 3] },
            { op: 'l', c: [x + 2.5, y + 3] },
            { op: 'l', c: [x + 2.5, y + h - 3] },
            { op: 'l', c: [x, y + h - 3] },
        ]).fill();
        
        // Título
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), x + 7, y + 8);

        // LÓGICA: Tamanho de fonte dinâmico para evitar que o valor vase do card
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

    // NOVA LÓGICA: Aceita um argumento extra "obs" para renderizar no final do cartão
    const drawAlertCard = (x: number, y: number, w: number, h: number, title: string, desc1: string, desc2: string, obs?: string) => {
        doc.setFillColor(254, 242, 242); // rose-50
        doc.roundedRect(x, y, w, h, 4, 4, 'F');
        doc.setDrawColor(254, 205, 211); // rose-200
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, h, 4, 4, 'D');

        // Ícone de Atenção (Bola vermelha)
        doc.setFillColor(225, 29, 72); // rose-600
        doc.circle(x + 12, y + 12, 4, 'F');

        doc.setFontSize(12); doc.setTextColor(159, 18, 57); doc.setFont("helvetica", "bold"); // rose-800
        doc.text(title, x + 22, y + 13.5);

        doc.setFontSize(10); doc.setTextColor(225, 29, 72); doc.setFont("helvetica", "normal"); // rose-600
        doc.text(desc1, x + 22, y + 21);
        
        doc.setFont("helvetica", "bold");
        doc.text(desc2, x + 22, y + 27);

        // Renderiza a observação logo após a descrição 2 se existir
        if (obs) {
            doc.setFontSize(9); 
            doc.setTextColor(100, 116, 139); // slate-500
            doc.setFont("helvetica", "italic");
            doc.text(obs, x + 22, y + 34);
        }
    };

    const drawSectionTitle = (text: string, yPos: number) => {
        doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), margin, yPos);
        
        // Linha divisória debaixo do título
        doc.setDrawColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.setLineWidth(1);
        doc.line(margin, yPos + 3, margin + 25, yPos + 3);
        
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin + 25, yPos + 3, pageWidth - margin, yPos + 3);
    };

    try {
        // ==========================================
        // PÁGINA 1: RESUMO EXECUTIVO E FLUXO
        // ==========================================
        drawHeader("Relatório Gerencial", "Análise de Performance e Fluxo de Estoque");
        
        drawSectionTitle("1. Indicadores Globais", 65);

        const kpiW = 41; const kpiH = 26; const kpiGap = 4;
        
        drawPremiumKpiCard(margin, 75, kpiW, kpiH, "Capital Físico", formatCurrencyNoDecimals(analytics.valorTotalEstoque), 'primary');
        drawPremiumKpiCard(margin + kpiW + kpiGap, 75, kpiW, kpiH, "Qtd de O.P (Sis)", analytics.saidasSolicitacaoTotal, 'primary');
        drawPremiumKpiCard(margin + (kpiW + kpiGap) * 2, 75, kpiW, kpiH, "Total Entradas", analytics.opsEntrada, 'primary');
        drawPremiumKpiCard(margin + (kpiW + kpiGap) * 3, 75, kpiW, kpiH, "Saídas Manuais", analytics.saidasManuaisTotal, 'primary');

        // Gráfico (Captura condicional)
        const chartY = 120;
        drawSectionTitle("2. Fluxo Temporal de Operações", chartY);
        
        const flowChart = document.getElementById('chart-flow');
        if (flowChart && activeTab === "insights") {
            try {
                const canvas = await html2canvas(flowChart, { scale: 2, backgroundColor: null });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pageWidth - (margin * 2); 
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                doc.addImage(imgData, 'PNG', margin, chartY + 10, imgWidth, imgHeight);
            } catch (err) { }
        } else {
            doc.setFontSize(9); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "italic");
            doc.text("(O gráfico só é exportado se a aba 'Visão Global' estiver aberta no sistema no momento da exportação)", margin, chartY + 15);
        }

        // ==========================================
        // PÁGINA 2: ANÁLISE FINANCEIRA E CUSTOS
        // ==========================================
        doc.addPage();
        drawHeader("Distribuição Financeira", "Impacto Setorial e Indicadores Isolados");

        drawSectionTitle("3. Valores Operacionais Secundários", 65);
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal");
        doc.text("* Estes valores não afetam o estoque físico. Servem para medição de perdas e ganhos paralelos.", margin, 71);

        const repW = 86;
        drawPremiumKpiCard(margin, 76, repW, kpiH, "Ganho de Venda (Reposição)", formatCurrencyNoDecimals(analytics.valorRep), 'success');
        drawPremiumKpiCard(margin + repW + kpiGap, 76, repW, kpiH, "Perda Operacional (Garantia)", formatCurrencyNoDecimals(analytics.valorGar), 'alert');

        drawSectionTitle("4. Custos de Saída (Por Setor)", 122);

        autoTable(doc, {
            startY: 130,
            head: [['Setor / Destino', 'Impacto', 'Custo Total Direcionado']],
            body: analytics.sectorValueData.map((item: any) => {
                const percent = analytics.totalSectorValue > 0 ? ((item.value / analytics.totalSectorValue) * 100).toFixed(1) : "0";
                return [item.name, `${percent}%`, formatCurrency(item.value)];
            }),
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' }, // slate-600
            styles: { fontSize: 9, cellPadding: 5, textColor: C_TEXTO_ESCURO, lineColor: [226, 232, 240], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 55, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin }
        });

        // ==========================================
        // PÁGINA 3: RISCO E OPERAÇÃO
        // ==========================================
        doc.addPage();
        drawHeader("Saúde de Estoque e Riscos", "Itens Estagnados e Produtos de Alto Giro");

        drawSectionTitle("5. Revisão de Estoque Parado — Decisão Necessária", 65);

        // MUDANÇA: O Card cresceu de 35 para 42 de altura e agora recebe a observação
        drawAlertCard(margin, 72, pageWidth - (margin * 2), 42, 
            "Atenção: Itens Obsoletos e Parados", 
            `O sistema identificou um total de ${analytics.obsoletos.length} produtos estagnados no almoxarifado.`,
            `Total de Capital Imobilizado sem retorno: ${formatCurrency(analytics.valorTotalObsoletos)}`,
            "* Observação: Recomenda-se análise para destinação estratégica e recuperação de liquidez."
        );
        
        const yTopMov = 125;
        drawSectionTitle("6. Rotação Operacional (Top 10 Itens c/ Maior Giro)", yTopMov);

        autoTable(doc, {
            startY: yTopMov + 10,
            head: [['Rank', 'Produto Movimentado', 'Total de Operações na Linha do Tempo']],
            body: analytics.top10Movimentados.map((item: any, idx: number) => [
                `#${idx + 1}`, item.produto, `${item.count} Registros de Fluxo`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' }, // indigo-600
            styles: { fontSize: 9, cellPadding: 5, textColor: C_TEXTO_ESCURO, lineColor: [226, 232, 240], lineWidth: 0.1 },
            alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
            columnStyles: {
                0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 70, halign: 'center', textColor: [67, 56, 202], fontStyle: 'bold' } // indigo-700
            },
            margin: { left: margin, right: margin }
        });

        // --- ASSINATURA FINAL ---
        let sigY = (doc as any).lastAutoTable.finalY + 30;
        if (sigY > pageHeight - 40) {
            doc.addPage();
            drawHeader("Validação e Assinaturas", "Verificação do Relatório Gerencial");
            sigY = 70;
        }

        // Bloco de Assinatura Elegante
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 45, sigY, pageWidth / 2 + 45, sigY);
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42); 
        doc.text("Evandro Luiz Campos", pageWidth / 2, sigY + 6, { align: "center" });
        
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 116, 139); 
        doc.text("Responsável pela Logística e Almoxarifado Royale", pageWidth / 2, sigY + 11, { align: "center" });

        // Numeração de Páginas
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

  return (
    <div ref={containerRef} className="space-y-8 p-4 sm:p-8 bg-slate-50/50 dark:bg-[#0a0f1c] min-h-screen text-slate-900 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden">
      
      {/* HEADER E FILTROS PREMIUM */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-3xl rounded-full"></div>
            <h1 className="text-4xl sm:text-5xl font-black flex items-center gap-5 text-slate-900 dark:text-white relative z-10 tracking-tighter">
                <div className="p-4 bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 rounded-[1.5rem] shadow-2xl shadow-indigo-500/30 text-white transform hover:scale-105 hover:rotate-3 transition-all duration-300 cursor-pointer">
                    <Zap className="h-8 w-8" strokeWidth={2.5} />
                </div>
                Business Intelligence
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 ml-[5.5rem] font-semibold text-sm sm:text-base relative z-10 tracking-wide uppercase">
                Análise de Performance • <span className="text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-lg">Dados Gerenciais</span>
            </p>
        </div>

        <div className="flex flex-col gap-4 w-full xl:w-auto z-10">
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-100/80 dark:bg-slate-950/80 p-2.5 rounded-[1.5rem] border border-slate-200/50 dark:border-slate-800 shadow-inner">
                
                <div className="flex items-center gap-4 px-5 py-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 w-full sm:w-auto hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors group">
                    <CalendarIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                    <Input type="date" className="h-9 w-[135px] border-none bg-transparent focus-visible:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer dark:[color-scheme:dark] p-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <div className="w-8 h-[2px] bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <Input type="date" className="h-9 w-[135px] border-none bg-transparent focus-visible:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer dark:[color-scheme:dark] p-0 text-right" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                
                <div className="flex gap-2 p-1.5 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-transparent dark:border-slate-800">
                    <Button onClick={() => setQuickDate('today')} variant="ghost" size="sm" className="h-10 px-5 text-xs font-bold hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all rounded-lg uppercase tracking-wider">Hoje</Button>
                    <Button onClick={() => setQuickDate('month')} variant="ghost" size="sm" className="h-10 px-5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 rounded-lg uppercase tracking-wider">Mês</Button>
                </div>

                <Button onClick={() => refetch()} size="icon" className="h-[3.25rem] w-[3.25rem] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                    <RefreshCw className={`h-6 w-6 ${isLoading || isRefetching ? 'animate-spin text-indigo-500' : ''}`} />
                </Button>
            </div>
        </div>
      </div>

      {/* ALERTAS CRÍTICOS (PULSO E NEON) */}
      {analytics && (analytics.obsoletos.length > 0 || analytics.estoqueCritico.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analytics.obsoletos.length > 0 && (
                <div className="gsap-kpi-card relative overflow-hidden bg-rose-50/90 dark:bg-rose-950/30 backdrop-blur-xl border border-rose-200/80 dark:border-rose-900/60 p-6 rounded-[2rem] flex items-center gap-6 shadow-xl shadow-rose-500/10 hover:-translate-y-1 transition-transform cursor-default">
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-rose-400/20 dark:bg-rose-600/20 blur-3xl rounded-full"></div>
                    <div className="bg-rose-100 dark:bg-rose-900/60 p-4 rounded-2xl shadow-inner shadow-white/50 border border-rose-200 dark:border-rose-800 relative z-10">
                        <Clock className="w-8 h-8 text-rose-600 dark:text-rose-400 animate-pulse" strokeWidth={2.5} />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-white dark:border-slate-900"></span></span>
                    </div>
                    <div className="z-10">
                        <h4 className="font-black text-rose-950 dark:text-rose-300 text-xl tracking-tight">Alerta de Obsolescência</h4>
                        <p className="text-sm text-rose-800 dark:text-rose-400/90 mt-1 font-semibold">Detectados <b className="text-rose-600 dark:text-rose-300 text-base">{analytics.obsoletos.length} itens</b> parados há +90 dias.</p>
                    </div>
                </div>
            )}
            {analytics.estoqueCritico.length > 0 && (
                <div className="gsap-kpi-card relative overflow-hidden bg-amber-50/90 dark:bg-amber-950/30 backdrop-blur-xl border border-amber-200/80 dark:border-amber-900/60 p-6 rounded-[2rem] flex items-center gap-6 shadow-xl shadow-amber-500/10 hover:-translate-y-1 transition-transform cursor-default">
                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-400/20 dark:bg-amber-600/20 blur-3xl rounded-full"></div>
                    <div className="bg-amber-100 dark:bg-amber-900/60 p-4 rounded-2xl shadow-inner shadow-white/50 border border-amber-200 dark:border-amber-800 relative z-10">
                        <AlertOctagon className="w-8 h-8 text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
                    </div>
                    <div className="z-10">
                        <h4 className="font-black text-amber-950 dark:text-amber-300 text-xl tracking-tight">Rutura Crítica</h4>
                        <p className="text-sm text-amber-800 dark:text-amber-400/90 mt-1 font-semibold"><b className="text-amber-600 dark:text-amber-300 text-base">{analytics.estoqueCritico.length} itens</b> abaixo do estoque mínimo definido.</p>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* KPIS GLOBAIS COM SKELETON LOADING E ANIMAÇÃO */}
      {isLoading || !analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[200px] w-full rounded-[2.5rem] bg-slate-200/60 dark:bg-slate-800/60 shadow-sm" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
             title="Capital Total Físico" 
             value={formatCurrencyNoDecimals(analytics.valorTotalEstoque)} 
             subtext="Valor Físico Armazenado" 
             icon={DollarSign} colorClass="text-indigo-500" bgClass="bg-indigo-500/10" 
          />
          <KPICard 
             title="Qtd. Solicitações no Mês" 
             value={analytics.saidasSolicitacaoTotal} 
             subtext="Pedidos do sistema (OPs)" 
             icon={Briefcase} colorClass="text-blue-500" bgClass="bg-blue-500/10" 
          />
          <KPICard 
             title="Qtd. Total de Entradas" 
             value={analytics.opsEntrada} 
             subtext="Lotes Recebidos" 
             icon={ArrowDownToLine} colorClass="text-emerald-500" bgClass="bg-emerald-500/10" 
          />
          <KPICard 
             title="Qtd. Total Saídas Manuais" 
             value={analytics.saidasManuaisTotal} 
             subtext="Retiradas avulsas" 
             icon={ArrowUpFromLine} colorClass="text-amber-500" bgClass="bg-amber-500/10" 
          />
        </div>
      )}

      {/* TABS SEGMENTADAS ESTILO MACOS PREMIUM */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-2 sm:p-2.5 rounded-[2rem] border border-slate-200/80 dark:border-slate-800 shadow-md">
          <TabsList className="bg-slate-200/60 dark:bg-slate-950/60 p-1.5 rounded-[1.5rem] gap-2 h-auto flex-wrap w-full sm:w-auto border border-slate-300/30 dark:border-slate-800/50 shadow-inner">
            <TabsTrigger value="insights" className="rounded-xl px-6 py-3 font-bold text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-lg transition-all uppercase tracking-wide">Visão Global</TabsTrigger>
            <TabsTrigger value="saude-estoque" className="rounded-xl px-6 py-3 font-bold text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-lg transition-all uppercase tracking-wide">Saúde de Estoque</TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-xl px-6 py-3 font-bold text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400 data-[state=active]:shadow-lg transition-all uppercase tracking-wide">Análise de Custos</TabsTrigger>
            <TabsTrigger value="reposicao" className="rounded-xl px-6 py-3 font-bold text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-rose-600 dark:data-[state=active]:text-rose-400 data-[state=active]:shadow-lg transition-all uppercase tracking-wide">Reposição e Garantia</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-3 px-4 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-500/30 transition-all font-bold shadow-sm uppercase tracking-wider text-xs px-5">
                <FileText className="w-4 h-4 mr-2" /> PDF Gerencial
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-12 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all font-bold shadow-sm uppercase tracking-wider text-xs px-5">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Dados (Excel)
            </Button>
          </div>
        </div>

        {/* TAB 1: VISÃO GERAL */}
        <TabsContent value="insights" className="gsap-tab-content space-y-8">
          <Card id="chart-flow" className="shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="pb-8 border-b border-slate-100 dark:border-slate-800 px-10 pt-10">
                <CardTitle className="text-3xl font-black flex items-center gap-4 text-slate-800 dark:text-slate-100 tracking-tight">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                        <Activity className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    Fluxo Temporal de Movimentação
                </CardTitle>
                <CardDescription className="text-base font-medium mt-3 ml-16 text-slate-500">Evolução diária de Entradas, Solicitações e Retiradas Manuais ao longo do período selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="h-[550px] w-full pt-10 px-8 pb-8">
                {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" strokeOpacity={0.2} />
                        <XAxis dataKey="name" fontSize={13} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} dy={20} />
                        <YAxis fontSize={13} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} dx={-15} />
                        <Tooltip 
                            cursor={{fill: '#f1f5f9', opacity: 0.1}} 
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', fontWeight: 'bold', padding: '16px 20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '40px', fontSize: '14px', fontWeight: 'bold' }} iconType="circle" />
                        <Bar dataKey="entradas" name="Entradas" fill={COLORS.entradas} radius={[8, 8, 0, 0]} barSize={28} isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                        <Bar dataKey="saidas_sistema" name="Solicitações" fill={COLORS.saidas} radius={[8, 8, 0, 0]} barSize={28} isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                        <Bar dataKey="saidas_manual" name="Saída Manual" fill={COLORS.manuais} radius={[8, 8, 0, 0]} barSize={28} isAnimationActive={true} animationDuration={2000} animationEasing="ease-out" />
                    </BarChart>
                </ResponsiveContainer>
                )}
            </CardContent>
          </Card>

          {/* HISTÓRICO DE ENTRADAS E SAÍDAS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* HISTÓRICO ENTRADAS */}
                <Card className="shadow-xl border border-emerald-200/50 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden flex flex-col h-[500px]">
                    <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-400 opacity-80"></div>
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 pb-4 pt-6 px-8 border-b border-emerald-100/50 dark:border-emerald-900/30">
                        <CardTitle className="text-xl flex items-center justify-between gap-4 text-emerald-950 dark:text-emerald-400 font-black tracking-tight">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white dark:bg-emerald-900/60 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100 dark:border-emerald-800/50"><ArrowDownToLine className="h-6 w-6" strokeWidth={2.5} /></div>
                                Histórico de Entradas
                            </div>
                            <div className="relative w-48 hidden sm:block">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600/50" />
                                <Input 
                                    placeholder="Buscar produto..." 
                                    className="pl-9 h-9 border-emerald-200/50 bg-white/50 focus-visible:ring-emerald-500" 
                                    value={searchEntradas}
                                    onChange={(e) => setSearchEntradas(e.target.value)}
                                />
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {/* Search mobile */}
                        <div className="relative w-full mb-4 sm:hidden">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600/50" />
                            <Input 
                                placeholder="Buscar produto..." 
                                className="pl-9 h-9 border-emerald-200/50 bg-white/50 focus-visible:ring-emerald-500" 
                                value={searchEntradas}
                                onChange={(e) => setSearchEntradas(e.target.value)}
                            />
                        </div>
                        {analytics?.raw.entradasFiltradas.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[15px] border-b border-slate-200/50 dark:border-slate-800/60 pb-4 mb-4 last:border-0 last:mb-0 hover:bg-white/50 dark:hover:bg-slate-800/40 p-3 -mx-3 rounded-2xl transition-colors">
                                <div className="flex flex-col gap-1 w-[60%]">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">Origem: {item.origem || 'Fornecedor'}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-3 py-1 rounded-xl">
                                        +{item.quantidade} un.
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">{format(new Date(item.data), 'dd/MM/yyyy HH:mm')}</span>
                                </div>
                            </div>
                        ))}
                        {analytics?.raw.entradasFiltradas.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Package className="w-10 h-10 mb-2" />
                                <p className="font-bold">Nenhuma entrada encontrada</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* HISTÓRICO SAÍDAS */}
                <Card className="shadow-xl border border-indigo-200/50 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/10 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden flex flex-col h-[500px]">
                    <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-400 opacity-80"></div>
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 pb-4 pt-6 px-8 border-b border-indigo-100/50 dark:border-indigo-900/30">
                        <CardTitle className="text-xl flex items-center justify-between gap-4 text-indigo-950 dark:text-indigo-400 font-black tracking-tight">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white dark:bg-indigo-900/60 rounded-2xl text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-800/50"><ArrowUpFromLine className="h-6 w-6" strokeWidth={2.5} /></div>
                                Histórico de Saídas
                            </div>
                            <div className="relative w-48 hidden sm:block">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-indigo-600/50" />
                                <Input 
                                    placeholder="Buscar produto..." 
                                    className="pl-9 h-9 border-indigo-200/50 bg-white/50 focus-visible:ring-indigo-500" 
                                    value={searchSaidas}
                                    onChange={(e) => setSearchSaidas(e.target.value)}
                                />
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {/* Search mobile */}
                        <div className="relative w-full mb-4 sm:hidden">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-indigo-600/50" />
                            <Input 
                                placeholder="Buscar produto..." 
                                className="pl-9 h-9 border-indigo-200/50 bg-white/50 focus-visible:ring-indigo-500" 
                                value={searchSaidas}
                                onChange={(e) => setSearchSaidas(e.target.value)}
                            />
                        </div>
                        {analytics?.raw.saidasFiltradas.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[15px] border-b border-slate-200/50 dark:border-slate-800/60 pb-4 mb-4 last:border-0 last:mb-0 hover:bg-white/50 dark:hover:bg-slate-800/40 p-3 -mx-3 rounded-2xl transition-colors">
                                <div className="flex flex-col gap-1 w-[60%]">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border-0", item.origem_tipo === 'MANUAL' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700")}>
                                            {item.origem_tipo}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground truncate">Para: {item.destino_setor || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-black text-indigo-700 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 px-3 py-1 rounded-xl">
                                        -{item.quantidade} un.
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">{format(new Date(item.data), 'dd/MM/yyyy HH:mm')}</span>
                                </div>
                            </div>
                        ))}
                        {analytics?.raw.saidasFiltradas.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Package className="w-10 h-10 mb-2" />
                                <p className="font-bold">Nenhuma saída encontrada</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
          </div>
        </TabsContent>

        {/* TAB 2: SAÚDE DO ESTOQUE */}
        <TabsContent value="saude-estoque" className="gsap-tab-content">
            {/* GRID SUPERIOR COM OBSOLETOS LARGOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Estoque Parado (Largo) */}
                <Card className="shadow-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden group hover:border-rose-300 dark:hover:border-rose-500/50 hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-500 relative flex flex-col h-[500px]">
                    <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-rose-300 via-rose-500 to-rose-400 opacity-80"></div>
                    <CardHeader className="bg-rose-50/60 dark:bg-rose-950/30 pb-6 pt-8 px-8 border-b border-rose-100/50 dark:border-rose-900/30 flex flex-row items-center justify-between">
                        <CardTitle className="text-xl flex items-center gap-4 text-rose-950 dark:text-rose-400 font-black tracking-tight">
                            <div className="p-3 bg-white dark:bg-rose-900/60 rounded-2xl text-rose-600 shadow-sm border border-rose-100 dark:border-rose-800/50"><Clock className="h-6 w-6" strokeWidth={2.5}/></div>
                            Lista de Estoque Parado (+90 dias)
                        </CardTitle>
                        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-0">{formatCurrency(analytics?.valorTotalObsoletos)} parado</Badge>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.obsoletos.map((item: any, idx: number) => {
                            const disp = Number(item.quantidade_total || item.quantidade || 0);
                            const preco = Number(item.preco || 0);
                            return (
                            <div key={idx} className="flex justify-between items-center text-[15px] border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-4 last:border-0 last:mb-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-3 -mx-3 rounded-2xl transition-colors cursor-default">
                                <div className="flex flex-col gap-1 w-[60%]">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-rose-400/50 dark:text-rose-500/30 w-5 shrink-0">{idx+1}.</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground ml-8">{item.sku}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-800/30">
                                        {disp} un.
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                                        {formatCurrency(disp * preco)}
                                    </span>
                                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                        Ult. Mov: <strong className={!item.ultima_movimentacao ? "text-rose-500" : ""}>{item.ultima_movimentacao ? format(new Date(item.ultima_movimentacao), 'dd/MM/yyyy') : 'Nunca Movimentado'}</strong>
                                    </span>
                                </div>
                            </div>
                        )})}
                        {analytics?.obsoletos.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                                <div className="p-5 bg-slate-100 dark:bg-slate-800/50 rounded-full mb-4">
                                    <Package className="w-10 h-10 opacity-40" strokeWidth={1.5} />
                                </div>
                                <p className="font-bold text-base tracking-wide uppercase">Sem Itens Parados</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Mais Movimentados */}
                <Card className="shadow-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 flex flex-col h-[500px]">
                    <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-400 opacity-80"></div>
                    <CardHeader className="bg-indigo-50/60 dark:bg-indigo-950/30 pb-6 pt-8 px-8 border-b border-indigo-100/50 dark:border-indigo-900/30 flex flex-row items-center justify-between">
                        <CardTitle className="text-xl flex items-center gap-4 text-indigo-950 dark:text-indigo-300 font-black tracking-tight">
                            <div className="p-3 bg-white dark:bg-indigo-900/60 rounded-2xl text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-800/50"><BarChart3 className="h-6 w-6" strokeWidth={2.5}/></div>
                            Top 10 Maior Giro
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
                        {analytics?.top10Movimentados.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[15px] border-b border-slate-100 dark:border-slate-800/60 pb-4 mb-4 last:border-0 last:mb-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-3 -mx-3 rounded-2xl transition-colors cursor-default">
                                <div className="flex items-center gap-4 w-3/5">
                                    <span className="text-sm font-black text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx+1}.</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                </div>
                                <Badge className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-800/70 shadow-sm border border-indigo-200 dark:border-indigo-700/50 font-black shrink-0 px-3 py-1">
                                    {item.count} ops
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* GRID INFERIOR COM MAIOR VALOR E RISCO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Maior Valor */}
                <Card className="shadow-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 flex flex-col">
                    <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-400 opacity-80"></div>
                    <CardHeader className="bg-emerald-50/60 dark:bg-emerald-950/30 pb-6 pt-8 px-8 border-b border-emerald-100/50 dark:border-emerald-900/30">
                        <CardTitle className="text-xl flex items-center gap-4 text-emerald-950 dark:text-emerald-300 font-black tracking-tight">
                            <div className="p-3 bg-white dark:bg-emerald-900/60 rounded-2xl text-emerald-600 shadow-sm border border-emerald-100 dark:border-emerald-800/50"><DollarSign className="h-6 w-6" strokeWidth={2.5} /></div>
                            Top 10 Maiores Capitais (Valor)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-8 px-8 pb-8 space-y-5 flex-1">
                        {analytics?.top10Valor.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[15px] border-b border-slate-100 dark:border-slate-800/60 pb-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -mx-2 rounded-2xl transition-colors cursor-default overflow-hidden">
                                <div className="flex items-center gap-4 w-1/2">
                                    <span className="text-sm font-black text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx+1}.</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                </div>
                                <span className="font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl shrink-0 border border-emerald-100 dark:border-emerald-800/50">
                                    {formatCurrency(item.quantidade * (item.preco || 0))}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* 2. Risco de Rutura */}
                <Card className="shadow-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden group hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 relative flex flex-col">
                    <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-400 opacity-80"></div>
                    <CardHeader className="bg-amber-50/60 dark:bg-amber-950/30 pb-6 pt-8 px-8 border-b border-amber-100/50 dark:border-amber-900/30">
                        <CardTitle className="text-xl flex items-center gap-4 text-amber-950 dark:text-amber-400 font-black tracking-tight">
                            <div className="p-3 bg-white dark:bg-amber-900/60 rounded-2xl text-amber-600 shadow-sm border border-amber-100 dark:border-amber-800/50"><AlertTriangle className="h-6 w-6" strokeWidth={2.5}/></div>
                            Itens em Risco de Rutura
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-8 px-8 pb-8 space-y-5 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                        {analytics?.estoqueCritico.map((item: any, idx: number) => {
                            const disp = (item.quantidade_total || item.quantidade) - (item.quantidade_reservada || 0);
                            return (
                            <div key={idx} className="flex justify-between items-center text-[15px] border-b border-slate-100 dark:border-slate-800/60 pb-4 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -mx-2 rounded-2xl transition-colors cursor-default overflow-hidden">
                                <div className="flex items-center gap-4 w-[55%]">
                                    <span className="text-sm font-black text-slate-400 dark:text-slate-500 w-5 shrink-0">{idx+1}.</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate" title={item.produto}>{item.produto}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                    <span className="font-black text-amber-700 dark:text-amber-400">
                                        {disp} un.
                                    </span>
                                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Mín: {item.estoque_minimo}</span>
                                </div>
                            </div>
                        )})}
                        {analytics?.estoqueCritico.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 pb-10">
                                <div className="p-5 bg-slate-100 dark:bg-slate-800/50 rounded-full mb-4">
                                    <Package className="w-10 h-10 opacity-40" strokeWidth={1.5} />
                                </div>
                                <p className="font-bold text-base tracking-wide uppercase">Estoque Saudável</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* TAB 3: FINANCEIRO E CUSTOS (Gráfico Dinâmico) */}
        <TabsContent value="financeiro" className="gsap-tab-content">
           <div className="h-[750px]">
               <SectorBarChart 
                 data={analytics?.sectorValueData} 
                 totalValue={analytics?.totalSectorValue}
                 title="Detalhamento de Custos de Saída (Por Setor)" 
                 icon={DollarSign} 
                 colorClass="text-emerald-600"
                 barColor={COLORS.entradas}
                 isCurrency={true}
               />
           </div>
        </TabsContent>

        {/* TAB NOVA: REPOSIÇÃO E GARANTIA (ISOLADOS) */}
        <TabsContent value="reposicao" className="gsap-tab-content space-y-8">
            <Card className="shadow-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="pb-8 border-b border-slate-100 dark:border-slate-800 px-10 pt-10">
                    <CardTitle className="text-3xl font-black flex items-center gap-4 text-slate-800 dark:text-slate-100 tracking-tight">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                            <ShieldAlert className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        Registo de Operações Secundárias
                    </CardTitle>
                    <CardDescription className="text-base font-medium mt-3 ml-16 text-slate-500">
                        Estes valores <strong className="text-slate-700 dark:text-slate-300">não afetam o seu estoque físico oficial</strong>. Servem apenas como métricas complementares de gestão comercial e de perdas para o relatório PDF.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-10 px-10 pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Input Reposição (Ganho de Venda) */}
                        <div className="space-y-4">
                            <Label className="text-lg font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                <Package className="w-5 h-5" /> Ganho de Venda (Reposição)
                            </Label>
                            <p className="text-sm text-slate-500 font-medium">Valores obtidos através da venda de peças para reposição no período selecionado.</p>
                            <div className="relative group">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-xl group-focus-within:text-emerald-600 transition-colors">R$</span>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={custoReposicao} 
                                    onChange={(e) => setCustoReposicao(e.target.value)} 
                                    className="pl-14 h-16 rounded-[1.5rem] border-slate-200 dark:border-slate-700 text-2xl font-black shadow-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 transition-all"
                                />
                            </div>
                        </div>

                        {/* Input Garantia (Perda) */}
                        <div className="space-y-4">
                            <Label className="text-lg font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
                                <Receipt className="w-5 h-5" /> Perda Operacional (Garantia)
                            </Label>
                            <p className="text-sm text-slate-500 font-medium">Prejuízos contabilizados com materiais danificados, trocas ou devoluções de garantia.</p>
                            <div className="relative group">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-400 font-bold text-xl group-focus-within:text-rose-600 transition-colors">R$</span>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={custoGarantia} 
                                    onChange={(e) => setCustoGarantia(e.target.value)} 
                                    className="pl-14 h-16 rounded-[1.5rem] border-slate-200 dark:border-slate-700 text-2xl font-black shadow-sm focus-visible:ring-rose-500 focus-visible:border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-100 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* DASHBOARD INFORMATIVO ISOLADO */}
            {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <Card className="shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl p-6 flex flex-col justify-center transform hover:-translate-y-1 transition-transform cursor-default">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <DollarSign className="w-4 h-4"/> Estoque Atual (Isolado)
                        </p>
                        <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(analytics.valorTotalEstoque)}</p>
                    </Card>

                    <Card className="shadow-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl p-6 flex flex-col justify-center transform hover:-translate-y-1 transition-transform cursor-default">
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4"/> Total Ganhos (Venda)
                        </p>
                        <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">+{formatCurrency(Number(custoReposicao) || 0)}</p>
                    </Card>

                    <Card className="shadow-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 rounded-3xl p-6 flex flex-col justify-center transform hover:-translate-y-1 transition-transform cursor-default">
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4"/> Total Perdas (Garantia)
                        </p>
                        <p className="text-3xl font-black text-rose-700 dark:text-rose-400">-{formatCurrency(Number(custoGarantia) || 0)}</p>
                    </Card>
                </div>
            )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
