import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, FileText, 
  TrendingDown, TrendingUp, RefreshCw, Activity,
  BarChart3, Package, ClipboardCheck, ArrowUpRight, ArrowDownRight, Archive, MapPin
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Sector
} from "recharts";
import { toast } from "sonner";

// Cores profissionais
const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#84cc16', 
  '#a855f7', '#d946ef', '#64748b', '#334155'
];

// --- COMPONENTE: Renderização da Fatia Ativa ---
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  
  return (
    <g>
      <text x={cx} y={cy} dy={-20} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={500}>
        {payload.name.length > 15 ? `${payload.name.substring(0, 15)}...` : payload.name}
      </text>
      <text x={cx} y={cy} dy={10} textAnchor="middle" fill="#0f172a" fontWeight="bold" fontSize={20}>
        {value}
      </text>
      <text x={cx} y={cy} dy={30} textAnchor="middle" fill="#94a3b8" fontSize={12}>
        {`${(percent * 100).toFixed(1)}%`}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={innerRadius - 6}
        outerRadius={outerRadius + 12}
        fill={fill}
        fillOpacity={0.1}
      />
    </g>
  );
};

// --- COMPONENTE: Tooltip Customizado ---
const CustomPieTooltip = ({ active, payload, totalValue }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const percent = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : 0;

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-sm min-w-[160px] z-50">
        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: data.payload.fill }}></div>
            <p className="font-bold text-slate-800 dark:text-slate-100 max-w-[150px] truncate">{data.name}</p>
        </div>
        <div className="space-y-1.5">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Qtd:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{data.value}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>% Total:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{percent}%</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

// --- COMPONENTE: Legenda Lateral ---
const ScrollableLegend = ({ data }: any) => {
    if (!data || data.length === 0) return null;
    return (
        <div className="h-[250px] overflow-y-auto pr-2 flex flex-col gap-2 custom-scrollbar">
            {data.map((entry: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-xs group hover:bg-muted/50 p-1.5 rounded-md transition-colors cursor-default">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ring-1 ring-white dark:ring-slate-900" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                        />
                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[130px] font-medium" title={entry.name}>
                            {entry.name}
                        </span>
                    </div>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

// --- COMPONENTE: KPI Card ---
const KPICard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, trend }: any) => (
    <Card className="relative overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 bg-white dark:bg-slate-950 group">
        <div className={`absolute -right-6 -top-6 p-8 rounded-full opacity-[0.05] transition-transform group-hover:scale-110 duration-500 ${bgClass.replace('bg-', 'bg-current text-')}`}>
            <Icon className="w-32 h-32" />
        </div>
        <CardContent className="p-6 relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl shadow-sm ${bgClass} ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend && (
                    <Badge variant="secondary" className={`font-medium px-2 py-0.5 ${trend === 'up' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-blue-700 bg-blue-50 border-blue-100'} border`}>
                        {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {trend === 'up' ? 'Entrada' : 'Saída'}
                    </Badge>
                )}
            </div>
            <div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">{value}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{title}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">{subtext}</p>
            </div>
        </CardContent>
    </Card>
);

// --- COMPONENTE: Gráfico de Pizza Reutilizável ---
const SectorPieChart = ({ data, totalValue, title, icon: Icon, activeIndex, onEnter }: any) => (
    <Card className="shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-full flex flex-col">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200">
                {Icon && <Icon className="h-5 w-5 text-indigo-500" />} {title}
            </CardTitle>
            <CardDescription>Distribuição percentual por destino</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-6 min-h-[300px]">
            {data && data.length > 0 ? (
                <div className="flex flex-col md:flex-row items-center h-full gap-6">
                    {/* Gráfico */}
                    <div className="relative w-full md:w-1/2 h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    activeIndex={activeIndex}
                                    activeShape={renderActiveShape}
                                    data={data}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={85} 
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                    onMouseEnter={onEnter}
                                >
                                    {data.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomPieTooltip totalValue={totalValue} />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    
                    {/* Legenda */}
                    <div className="w-full md:w-1/2 h-full border-l border-slate-100 dark:border-slate-800 pl-6 flex flex-col justify-center">
                        <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Geral</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{totalValue}</span>
                                <span className="text-sm text-slate-500 font-medium">registros</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <span className="text-xs font-semibold text-slate-400 block mb-2">Detalhamento:</span>
                            <ScrollableLegend data={data} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[250px]">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-full"><Archive className="h-8 w-8 opacity-50" /></div>
                    <span className="text-sm font-medium">Sem dados registrados.</span>
                </div>
            )}
        </CardContent>
    </Card>
);

// --- COMPONENTE PRINCIPAL ---
export default function Reports() {
  const [startDate, setStartDate] = useState(startOfMonth(new Date()).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endOfMonth(new Date()).toISOString().split('T')[0]);
  
  const [activeTab, setActiveTab] = useState("insights"); 
  
  const [activeIndexPie1, setActiveIndexPie1] = useState(0);
  const [activeIndexPie2, setActiveIndexPie2] = useState(0);

  const onPieEnter1 = useCallback((_: any, index: number) => {
    setActiveIndexPie1(index);
  }, []);

  const onPieEnter2 = useCallback((_: any, index: number) => {
    setActiveIndexPie2(index);
  }, []);

  const { data: dateLimits } = useQuery({
    queryKey: ["available-dates"],
    queryFn: async () => (await api.get("/reports/available-dates")).data,
  });

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ["reports-general", startDate, endDate],
    queryFn: async () => {
      const response = await api.get("/reports/general", { params: { startDate, endDate } });
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  const analytics = useMemo(() => {
    if (!reportData) return null;

    const entradas = reportData.entradas || [];
    const saidasManual = (reportData.saidas_separacoes || []).map((i: any) => ({ ...i, origem_tipo: 'MANUAL' }));
    const saidasSolicitacao = (reportData.saidas_solicitacoes || []).map((i: any) => ({ ...i, origem_tipo: 'SISTEMA' })); 
    
    const todasSaidas = [...saidasManual, ...saidasSolicitacao].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const todasEntradas = [...entradas].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // KPIs
    const opsEntrada = entradas.length;
    const opsSaidaTotal = todasSaidas.length;
    const opsSaidaSistema = saidasSolicitacao.length; 
    const opsSaidaManual = saidasManual.length;  
    const volItensEntrada = entradas.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0);
    const volItensSaida = todasSaidas.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0);

    // Gráfico de Barras
    const timelineMap = new Map();
    const processDate = (dateStr: string, type: 'in' | 'out_sis' | 'out_man') => {
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

    // Helper: Processar Setores
    const processSectors = (dataList: any[], shouldGroup: boolean) => {
        const sectorMap = new Map();
        dataList.forEach((i: any) => {
            let setor = i.destino_setor || "Não Informado";
            if (setor === '-' || setor === '') setor = "Avulso / Balcão";
            sectorMap.set(setor, (sectorMap.get(setor) || 0) + 1); 
        });
        
        const raw = Array.from(sectorMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        if (!shouldGroup) return raw;

        const final = [];
        if (raw.length > 6) {
            final.push(...raw.slice(0, 6));
            const others = raw.slice(6).reduce((acc, curr) => acc + curr.value, 0);
            if (others > 0) final.push({ name: "Outros", value: others });
        } else {
            final.push(...raw);
        }
        return final;
    };

    const sectorDataSolicitacao = processSectors(saidasSolicitacao, true);
    const sectorDataManual = processSectors(saidasManual, false);

    // Helpers Top Produtos
    const getTopProducts = (list: any[]) => {
        const pMap = new Map();
        list.forEach((i: any) => {
            const key = i.produto;
            pMap.set(key, (pMap.get(key) || 0) + Number(i.quantidade)); 
        });
        return Array.from(pMap.entries())
            .map(([name, qtd]) => ({ name, qtd }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5);
    };

    const topProductsSaida = getTopProducts(todasSaidas);
    const topProductsEntrada = getTopProducts(entradas);

    return {
      opsEntrada, opsSaidaTotal, opsSaidaSistema, opsSaidaManual,
      volItensEntrada, volItensSaida,
      chartData, 
      sectorDataSolicitacao, sectorDataManual,
      topProductsSaida, topProductsEntrada,
      raw: { todasEntradas, todasSaidas },
      totalSolicitacao: saidasSolicitacao.length,
      totalManual: saidasManual.length
    };
  }, [reportData]);

  const handleExportExcel = () => {
    if (!analytics) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
        { Metrica: "Total Saídas", Valor: analytics.opsSaidaTotal },
        { Metrica: "Total Entradas", Valor: analytics.opsEntrada },
        { Metrica: "Volume Saída", Valor: analytics.volItensSaida },
        { Metrica: "Volume Entrada", Valor: analytics.volItensEntrada }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasEntradas.map((i: any) => ({
        Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'),
        Produto: i.produto, Qtd: i.quantidade, Origem: i.origem || 'Fornecedor'
    }))), "Entradas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasSaidas.map((i: any) => ({
        Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'),
        Tipo: i.origem_tipo === 'SISTEMA' ? 'Solicitação' : 'Manual',
        Produto: i.produto, Qtd: i.quantidade, Destino: i.destino_setor
    }))), "Saidas");
    XLSX.writeFile(wb, `Relatorio_Completo_${startDate}.xlsx`);
    toast.success("Excel gerado!");
  };

  const handleExportPDF = () => { toast.info("Função PDF pronta para integrar."); };

  const setQuickDate = (type: 'month' | 'last30') => {
    const now = new Date();
    if (type === 'month') {
      setStartDate(startOfMonth(now).toISOString().split('T')[0]);
      setEndDate(endOfMonth(now).toISOString().split('T')[0]);
    } else {
      setStartDate(subDays(now, 30).toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 p-1 md:p-0">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-slate-900 dark:text-slate-100">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl"><Activity className="h-8 w-8 text-indigo-600 dark:text-indigo-400" /></div>
                Relatórios Gerenciais
            </h1>
            <p className="text-slate-500 mt-2 ml-16">
                Intelligence de dados: <span className="font-bold text-indigo-600">Visão do Mês Atual</span>
            </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border shadow-sm">
                <Input type="date" className="h-9 w-32 border-none focus-visible:ring-0 text-xs md:text-sm bg-transparent" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="text-slate-400 font-bold">→</span>
                <Input type="date" className="h-9 w-32 border-none focus-visible:ring-0 text-xs md:text-sm bg-transparent" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <Button onClick={() => setQuickDate('month')} variant="ghost" size="sm" className="h-full font-medium hover:bg-white dark:hover:bg-slate-800 shadow-sm">Mês Atual</Button>
                <Button onClick={() => refetch()} size="icon" className="h-full w-10 shadow-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></Button>
            </div>
        </div>
      </div>

      {/* KPIS */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard title="Total Saídas" value={analytics.opsSaidaTotal} subtext="Operações realizadas" icon={TrendingDown} colorClass="text-blue-600" bgClass="bg-blue-100" trend="down" />
          <KPICard title="Total Entradas" value={analytics.opsEntrada} subtext="Materiais recebidos" icon={TrendingUp} colorClass="text-emerald-600" bgClass="bg-emerald-100" trend="up" />
          <KPICard title="Solicitações" value={analytics.opsSaidaSistema} subtext="Pedidos via sistema" icon={ClipboardCheck} colorClass="text-violet-600" bgClass="bg-violet-100" />
          <KPICard title="Saída Manual" value={analytics.opsSaidaManual} subtext="Baixas avulsas" icon={Package} colorClass="text-amber-600" bgClass="bg-amber-100" />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
          <TabsList className="bg-transparent p-0 h-auto gap-2">
            <TabsTrigger value="insights" className="rounded-full border border-transparent data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:border-indigo-100 px-4 py-2">Visão Geral</TabsTrigger>
            <TabsTrigger value="entradas" className="rounded-full border border-transparent data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-100 px-4 py-2">Entradas</TabsTrigger>
            <TabsTrigger value="saidas" className="rounded-full border border-transparent data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-100 px-4 py-2">Saídas</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="border-dashed"><FileText className="w-4 h-4 mr-2 text-red-500" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="border-dashed"><FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel</Button>
          </div>
        </div>

        {/* VISÃO GERAL */}
        <TabsContent value="insights" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="shadow-sm border border-slate-100 dark:border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Fluxo de Movimentação</CardTitle>
                <CardDescription>Volume diário de entradas e saídas.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] w-full pt-4">
                {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} dy={10} tick={{fill: '#64748b'}} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} dx={-10} tick={{fill: '#64748b'}} />
                        <Tooltip cursor={{fill: '#f1f5f9', radius: 4}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar dataKey="saidas_sistema" name="Solicitações" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar dataKey="saidas_manual" name="Saída Manual" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                </ResponsiveContainer>
                )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <SectorPieChart 
                data={analytics?.sectorDataSolicitacao} 
                totalValue={analytics?.totalSolicitacao}
                title="Solicitações por Setor" 
                icon={ClipboardCheck} 
                activeIndex={activeIndexPie1}
                onEnter={onPieEnter1}
             />
             <SectorPieChart 
                data={analytics?.sectorDataManual} 
                totalValue={analytics?.totalManual}
                title="Saídas Manuais por Destino" 
                icon={Package} 
                activeIndex={activeIndexPie2}
                onEnter={onPieEnter2}
             />
          </div>
        </TabsContent>

        {/* ENTRADAS */}
        <TabsContent value="entradas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 shadow-sm border border-slate-100 dark:border-slate-800 h-fit">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                        <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> Mais Comprados</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-5">
                            {analytics?.topProductsEntrada.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="h-6 w-6 rounded flex items-center justify-center font-bold bg-emerald-100 text-emerald-700 text-xs">{idx + 1}</div>
                                        <span className="text-sm font-medium truncate max-w-[140px] text-slate-700 dark:text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600">+{item.qtd}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2 shadow-sm border border-slate-100 dark:border-slate-800">
                    <CardHeader><CardTitle>Histórico de Entradas</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-slate-50/50 dark:bg-slate-900/50">
                                    <TableHead>Data</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Origem</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics?.raw.todasEntradas.map((i: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                        <TableCell className="font-mono text-xs text-slate-500">{format(new Date(i.data), "dd/MM HH:mm")}</TableCell>
                                        <TableCell className="font-medium text-sm text-slate-700 dark:text-slate-200">{i.produto}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{i.origem || '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">+{i.quantidade}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* SAÍDAS */}
        <TabsContent value="saidas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 shadow-sm border border-slate-100 dark:border-slate-800 h-fit">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
                        <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /> Mais Retirados</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-5">
                            {analytics?.topProductsSaida.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="h-6 w-6 rounded flex items-center justify-center font-bold bg-red-100 text-red-700 text-xs">{idx + 1}</div>
                                        <span className="text-sm font-medium truncate max-w-[140px] text-slate-700 dark:text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-red-600">-{item.qtd}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2 shadow-sm border border-slate-100 dark:border-slate-800">
                    <CardHeader><CardTitle>Histórico de Saídas</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent bg-slate-50/50 dark:bg-slate-900/50">
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Destino</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics?.raw.todasSaidas.map((i: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                        <TableCell className="font-mono text-xs text-slate-500">{format(new Date(i.data), "dd/MM HH:mm")}</TableCell>
                                        <TableCell>
                                            {i.origem_tipo === 'SISTEMA' ? 
                                                <Badge className="bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100 shadow-none font-normal">Solicitação</Badge> : 
                                                <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 shadow-none font-normal">Manual</Badge>
                                            }
                                        </TableCell>
                                        <TableCell className="font-medium text-sm text-slate-700 dark:text-slate-200">{i.produto}</TableCell>
                                        <TableCell className="text-sm text-slate-500">{i.destino_setor || '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">-{i.quantidade}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
