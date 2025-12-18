import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Download, FileSpreadsheet, FileText, 
  TrendingUp, TrendingDown, RefreshCw, Info, CalendarDays, Activity,
  PieChart as PieChartIcon, BarChart3, Layers, Package
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from "recharts";
import { toast } from "sonner";

// Cores vibrantes para o gráfico
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

// Tooltip customizado para o gráfico de pizza
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    // Recharts injeta 'percent' quando usado em Pie
    const percent = data.payload.percent ? (data.payload.percent * 100).toFixed(1) : 0;
    
    return (
      <div className="bg-card border border-border p-3 rounded shadow-lg text-sm">
        <p className="font-bold mb-1">{data.name}</p>
        <div className="flex gap-4 justify-between">
          <span className="text-muted-foreground">Operações:</span>
          <span className="font-mono font-medium">{data.value}</span>
        </div>
        {/* Nota: O cálculo de porcentagem exato depende do componente pai injetar, 
            mas o visual limpo já ajuda muito */}
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const [startDate, setStartDate] = useState(subDays(new Date(), 30).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("insights"); 

  // 1. LIMITES DE DATA
  const { data: dateLimits } = useQuery({
    queryKey: ["available-dates"],
    queryFn: async () => (await api.get("/reports/available-dates")).data,
  });

  // 2. BUSCAR DADOS
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ["reports-general", startDate, endDate],
    queryFn: async () => {
      const response = await api.get("/reports/general", { params: { startDate, endDate } });
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  // 3. INTELIGÊNCIA DE DADOS (BI)
  const analytics = useMemo(() => {
    if (!reportData) return null;

    const entradas = reportData.entradas || [];
    const saidasSep = reportData.saidas_separacoes || [];
    const saidasSol = reportData.saidas_solicitacoes || [];
    const todasSaidas = [...saidasSep, ...saidasSol];

    // --- KPIs GERAIS ---
    const opsEntrada = entradas.length;
    const opsSaida = todasSaidas.length;
    const saldoOps = opsEntrada - opsSaida;
    
    const volItensEntrada = entradas.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0);
    const volItensSaida = todasSaidas.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0);

    // --- GRÁFICO TEMPORAL ---
    const timelineMap = new Map();
    const processDate = (dateStr: string, type: 'in' | 'out') => {
      const dateKey = format(new Date(dateStr), 'dd/MM');
      if (!timelineMap.has(dateKey)) timelineMap.set(dateKey, { name: dateKey, entradas: 0, saidas: 0 });
      const entry = timelineMap.get(dateKey);
      if (type === 'in') entry.entradas += 1; else entry.saidas += 1;
    };
    entradas.forEach((i: any) => processDate(i.data, 'in'));
    todasSaidas.forEach((i: any) => processDate(i.data, 'out'));
    const chartData = Array.from(timelineMap.values()).sort((a, b) => {
       const [d1, m1] = a.name.split('/').map(Number);
       const [d2, m2] = b.name.split('/').map(Number);
       return m1 - m2 || d1 - d2;
    });

    // --- TOP PRODUTOS ---
    const productMap = new Map();
    todasSaidas.forEach((i: any) => {
      const key = i.produto;
      const current = productMap.get(key) || 0;
      productMap.set(key, current + 1); 
    });
    const topProducts = Array.from(productMap.entries())
      .map(([name, qtd]) => ({ name, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);

    // --- DISTRIBUIÇÃO POR SETOR (COM AGRUPAMENTO DE "OUTROS") ---
    const sectorMap = new Map();
    todasSaidas.forEach((i: any) => {
      if (i.tipo === 'Saída - Separação') return;
      let setor = i.destino_setor || "Não Informado";
      if (setor === '-') setor = "Avulso";
      const current = sectorMap.get(setor) || 0;
      sectorMap.set(setor, current + 1); 
    });
    
    let sectorDataRaw = Array.from(sectorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Lógica de Agrupamento
    const sectorData = [];
    if (sectorDataRaw.length > 5) {
        const top5 = sectorDataRaw.slice(0, 5);
        const othersValue = sectorDataRaw.slice(5).reduce((acc, curr) => acc + curr.value, 0);
        sectorData.push(...top5);
        if (othersValue > 0) {
            sectorData.push({ name: "Outros", value: othersValue });
        }
    } else {
        sectorData.push(...sectorDataRaw);
    }

    return {
      opsEntrada, opsSaida, saldoOps, volItensEntrada, volItensSaida,
      chartData, topProducts, sectorData,
      raw: { entradas, saidasSep, saidasSol, todasSaidas }
    };
  }, [reportData]);

  // --- EXPORTAÇÃO ---
  const handleExportExcel = () => {
    if (!analytics) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.entradas), "Entradas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasSaidas), "Saídas Gerais");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.topProducts), "Ranking Frequência");
    XLSX.writeFile(wb, `Relatorio_BI_${startDate}.xlsx`);
    toast.success("Excel gerado!");
  };

  const handleExportPDF = () => {
    if (!analytics) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("Relatório Gerencial de Estoque", 14, 20);
    doc.setFontSize(10); doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 26);
    
    autoTable(doc, {
      startY: 35,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total Saídas (Operações)', analytics.opsSaida],
        ['Produto Mais Frequente', analytics.topProducts[0]?.name || '-'],
        ['Setor Mais Ativo', analytics.sectorData[0]?.name || '-']
      ],
      theme: 'striped',
      headStyles: { fillColor: [60, 60, 60] }
    });

    doc.save(`Relatorio_PDF_${startDate}.pdf`);
    toast.success("PDF gerado!");
  };

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
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER & CONTROLES */}
      <Card className="border shadow-sm bg-card">
        <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-8 w-8 text-primary" />
                        Intelligence & Relatórios
                    </h1>
                    <p className="text-muted-foreground">Análise de performance e movimentação.</p>
                </div>
                
                {/* INFO DE DADOS REAIS */}
                {dateLimits?.min_date && (
                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800 text-xs md:text-sm">
                        <Info className="h-4 w-4 shrink-0" />
                        <div className="flex flex-col md:flex-row gap-1 md:gap-4">
                            <span><strong>Histórico:</strong> {format(new Date(dateLimits.min_date), 'dd/MM/yyyy')}</span>
                            <span className="hidden md:inline">até</span>
                            <span>{format(new Date(dateLimits.max_date || new Date()), 'dd/MM/yyyy')}</span>
                        </div>
                    </div>
                )}
            </div>
        </CardHeader>

        <CardContent>
            <div className="flex flex-col xl:flex-row gap-4 items-end">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full xl:w-auto">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Início</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="date" className="pl-9" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Fim</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="date" className="pl-9" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 w-full xl:w-auto">
                    <Button variant="outline" onClick={() => setQuickDate('last30')} className="flex-1">30 Dias</Button>
                    <Button variant="outline" onClick={() => setQuickDate('month')} className="flex-1">Mês Atual</Button>
                    <Button onClick={() => refetch()} variant="secondary" size="icon"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* KPIS PRINCIPAIS */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm bg-card hover:bg-muted/5 transition-colors">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Operações de Entrada</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-3xl font-bold text-emerald-600">{analytics.opsEntrada}</h3>
                    <span className="text-xs text-muted-foreground">registros</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Vol. Itens: {analytics.volItensEntrada}</p>
                </div>
                <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 shadow-sm bg-card hover:bg-muted/5 transition-colors">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Operações de Saída</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-3xl font-bold text-red-600">{analytics.opsSaida}</h3>
                    <span className="text-xs text-muted-foreground">registros</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Vol. Itens: {analytics.volItensSaida}</p>
                </div>
                <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600">
                  <TrendingDown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm bg-card hover:bg-muted/5 transition-colors">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fluxo Líquido (Ops)</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className={`text-3xl font-bold ${analytics.saldoOps >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {analytics.saldoOps > 0 ? '+' : ''}{analytics.saldoOps}
                    </h3>
                    <span className="text-xs text-muted-foreground">movimentações</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Balanço de atividades</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600">
                  <Activity className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ÁREA DE CONTEÚDO (TABS) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <TabsList className="w-full sm:w-auto h-12 p-1">
            <TabsTrigger value="insights" className="h-10 px-4"><PieChartIcon className="w-4 h-4 mr-2" /> Insights & BI</TabsTrigger>
            <TabsTrigger value="overview" className="h-10 px-4"><BarChart3 className="w-4 h-4 mr-2" /> Fluxo Diário</TabsTrigger>
            <TabsTrigger value="data" className="h-10 px-4"><FileText className="w-4 h-4 mr-2" /> Dados Brutos</TabsTrigger>
          </TabsList>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="gap-2 flex-1" onClick={handleExportPDF}>
              <FileText className="h-4 w-4 text-red-600" /> PDF
            </Button>
            <Button variant="default" className="gap-2 bg-green-600 hover:bg-green-700 flex-1" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        {/* --- TAB 1: INSIGHTS & BI --- */}
        <TabsContent value="insights" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* GRÁFICO DE SETORES (DONUT CHART) */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Distribuição por Setor</CardTitle>
                <CardDescription>Principais destinos das saídas (exceto separações internas).</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] w-full flex justify-center">
                {analytics && analytics.sectorData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {analytics.sectorData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        wrapperStyle={{ fontSize: '12px', paddingLeft: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados de setor no período.</div>
                )}
              </CardContent>
            </Card>

            {/* TOP 5 PRODUTOS */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Top 5 Produtos (Frequência)</CardTitle>
                <CardDescription>Produtos com maior número de retiradas.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics && analytics.topProducts.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topProducts.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-sm truncate max-w-[200px]">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${(item.qtd / analytics.topProducts[0].qtd) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold w-12 text-right">{item.qtd} ops</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">Sem movimentação de produtos.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- TAB 2: FLUXO DIÁRIO --- */}
        <TabsContent value="overview">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Timeline de Operações</CardTitle>
              <CardDescription>Frequência diária de entradas vs saídas.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{fill: 'hsl(var(--muted)/0.3)'}} contentStyle={{ borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 3: DADOS BRUTOS (TABELAS) --- */}
        <TabsContent value="data">
          <Card>
            <CardHeader><CardTitle>Últimas Movimentações</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Detalhe</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics?.raw.todasSaidas.slice(0, 10).map((i: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{format(new Date(i.data), "dd/MM HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline" className="text-red-600 border-red-200">Saída</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{i.produto}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.destino_setor}</TableCell>
                      <TableCell className="text-right font-bold">-{i.quantidade}</TableCell>
                    </TableRow>
                  ))}
                  {analytics?.raw.entradas.slice(0, 10).map((i: any, idx: number) => (
                    <TableRow key={`in-${idx}`}>
                      <TableCell className="font-mono text-xs">{format(new Date(i.data), "dd/MM HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline" className="text-green-600 border-green-200">Entrada</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{i.produto}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.origem}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">+{i.quantidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}