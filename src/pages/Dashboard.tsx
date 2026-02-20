import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  FileText,
  ClipboardList,
  AlertTriangle,
  DollarSign,
  Activity,
  TrendingUp,
  Calendar,
  Plus,
  ArrowRight,
  AlertCircle,
  History,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await api.get("/dashboard/stats");
      return response.data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // --- ANIMAÇÃO DE NÚMEROS ---
  const AnimatedCounter = ({ value, isCurrency = true }: { value: number; isCurrency?: boolean }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      let startTimestamp: number | null = null;
      const duration = 2000;
      const startValue = 0;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = startValue + (value - startValue) * ease;
        setDisplayValue(current);

        if (progress < 1) window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    }, [value]);

    if (isCurrency) return <>{formatCurrency(displayValue)}</>;
    return <>{Math.round(displayValue)}</>;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // --- MOCKS DE DADOS REFINADOS ---
  const mockRecentSeparations = [
    { id: "SEP-1042", client: "TechCorp Solutions", items: 124, progress: 85, value: 14500.00, status: "Em andamento", color: "bg-blue-500" },
    { id: "SEP-1041", client: "Construtora Alfa", items: 45, progress: 100, value: 3250.90, status: "Concluído", color: "bg-emerald-500" },
    { id: "SEP-1040", client: "Clínica Vida Plena", items: 12, progress: 30, value: 890.50, status: "Iniciando", color: "bg-amber-500" },
  ];

  const mockCriticalProducts = [
    { name: "Cartucho de Toner Preto", stock: 2, min: 10, days: 15 },
    { name: "Papel A4 Resma", stock: 5, min: 50, days: 8 },
    { name: "Filtro de Ar Condicionado", stock: 0, min: 5, days: 21 },
  ];

  // --- COMPONENTES AUXILIARES UI ---
  
  // Botão de Acesso Rápido - Estilo Nubank (Ícone no quadrado colorido, texto embaixo)
  const QuickAccessBtn = ({ icon: Icon, label, onClick, bgGradient }: any) => (
    <div className="flex flex-col items-center gap-3 cursor-pointer group" onClick={onClick}>
      <div className={`w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-[1.25rem] shadow-sm transform transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg ${bgGradient}`}>
        <Icon className="h-7 w-7 md:h-8 md:w-8 text-white drop-shadow-sm" />
      </div>
      <span className="text-[11px] md:text-xs font-semibold text-muted-foreground group-hover:text-foreground text-center max-w-[80px] leading-tight transition-colors">
        {label}
      </span>
    </div>
  );

  const PremiumValueCard = () => (
    <Card className="bg-card text-card-foreground shadow-sm hover:shadow-md border-border rounded-2xl transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Valor em Estoque
        </CardTitle>
        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-full">
          <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
          <AnimatedCounter value={stats?.totalValue || 0} isCurrency={true} />
        </div>
        <p className="text-xs font-medium text-muted-foreground mt-2">
          Capital imobilizado total
        </p>
      </CardContent>
    </Card>
  );

  // --- DASHBOARD DO CHEFE (NÍVEL PREMIUM) ---
  const renderChefeDashboard = () => {
    const volumeData = [
      { name: "Produtos", value: stats?.totalProducts || 0, color: "#8b5cf6" },
      { name: "Solicitações", value: stats?.totalRequests || 0, color: "#f59e0b" },
      { name: "Separações", value: stats?.totalSeparations || 0, color: "#10b981" },
    ];
    const totalStock = stats?.totalProducts || 1;
    const lowStock = stats?.lowStock || 0;
    const healthyStock = totalStock - lowStock;
    const stockHealthData = [
      { name: "Saudável", value: healthyStock, color: "#10b981" },
      { name: "Crítico", value: lowStock, color: "#ef4444" },
    ];

    return (
      <div className="space-y-10 animate-in fade-in duration-700 pb-10">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-emerald-500" />
              {getGreeting()}, {profile?.name}.
            </h1>
            <p className="text-muted-foreground text-base mt-2 font-light">
              Seu resumo estratégico operacional de hoje.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-muted-foreground border border-border shadow-sm">
            <Calendar className="h-4 w-4" />
            <span className="capitalize">{today}</span>
          </div>
        </div>

        {/* --- ACESSO RÁPIDO (GRID DE ÍCONES) --- */}
        <section>
          <div className="flex flex-wrap gap-6 md:gap-8 items-start">
            <QuickAccessBtn 
              icon={Plus} 
              label="Nova Solicitação" 
              bgGradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
              onClick={() => navigate('/solicitacoes')} 
            />
            <QuickAccessBtn 
              icon={Package} 
              label="Cadastrar Produto" 
              bgGradient="bg-gradient-to-br from-blue-400 to-blue-600"
              onClick={() => navigate('/produtos')} 
            />
            <QuickAccessBtn 
              icon={History} 
              label="Histórico Separações" 
              bgGradient="bg-gradient-to-br from-purple-400 to-purple-600"
              onClick={() => navigate('/separacoes')} 
            />
            <QuickAccessBtn 
              icon={FileText} 
              label="Relatórios Gerenciais" 
              bgGradient="bg-gradient-to-br from-amber-400 to-amber-600"
              onClick={() => navigate('/relatorios')} 
            />
          </div>
        </section>

        {/* --- KPI DESTAQUES --- */}
        <section className="grid gap-4 md:grid-cols-3">
          <PremiumValueCard />
          
          <Card className="bg-card text-card-foreground shadow-sm hover:shadow-md border-border rounded-2xl transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Estoque Crítico
              </CardTitle>
              <div className="p-2 bg-rose-100 dark:bg-rose-500/10 rounded-full">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                <AnimatedCounter value={stats?.lowStock || 0} isCurrency={false} />
              </div>
              <p className="text-xs font-medium text-rose-500 mt-2 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> Requer atenção imediata
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card text-card-foreground shadow-sm hover:shadow-md border-border rounded-2xl transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Pendências Abertas
              </CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-full">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                <AnimatedCounter value={stats?.openRequests || 0} isCurrency={false} />
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-2">
                Aguardando ação da equipe
              </p>
            </CardContent>
          </Card>
        </section>

        {/* --- ÁREA DE DETALHAMENTO: Gráficos + Listas --- */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-12">
          
          {/* Lado Esquerdo: Últimas Separações e Gráfico (Ocupa 7 colunas) */}
          <div className="space-y-6 lg:col-span-7">
            
            {/* NOVO: CARDS DE ÚLTIMAS SEPARAÇÕES */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Acompanhamento de Separações</h2>
                <button 
                  onClick={() => navigate('/separacoes')}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  Ver todas <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              
              <div className="grid gap-4">
                {mockRecentSeparations.map((sep, idx) => (
                  <Card key={idx} className="p-5 bg-card border-border shadow-sm rounded-2xl hover:shadow-md transition-shadow group cursor-pointer">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Info do Cliente e Itens */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-base text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {sep.client}
                          </h3>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {sep.id}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sep.items} itens • <span className="font-medium">{sep.status}</span>
                        </p>
                      </div>

                      {/* Progresso e Valor */}
                      <div className="flex items-center gap-6 md:min-w-[280px] justify-between md:justify-end">
                        <div className="w-24 space-y-1.5">
                          <div className="flex justify-between text-xs font-medium text-muted-foreground">
                            <span>Progresso</span>
                            <span className="text-foreground">{sep.progress}%</span>
                          </div>
                          {/* Barra de Progresso Customizada */}
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${sep.color}`} 
                              style={{ width: `${sep.progress}%` }} 
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Valor Bruto</p>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">
                            {formatCurrency(sep.value)}
                          </p>
                        </div>
                      </div>

                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Gráfico de Barras */}
            <Card className="bg-card shadow-sm border-border rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">Volume de Movimentações</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#888888" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#888888" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "currentColor", opacity: 0.05 }} contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {volumeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Lado Direito: Alertas e Gráfico de Pizza (Ocupa 5 colunas) */}
          <div className="space-y-6 lg:col-span-5">
            
            {/* Lista: Produtos Críticos há muito tempo */}
            <Card className="bg-card shadow-sm border-rose-200 dark:border-rose-900/50 rounded-2xl overflow-hidden flex flex-col">
              <div className="bg-rose-50 dark:bg-rose-950/20 p-4 border-b border-rose-100 dark:border-rose-900/30">
                <CardTitle className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" /> Alerta Prolongado
                </CardTitle>
                <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1">Produtos no crítico há mais de 7 dias.</p>
              </div>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {mockCriticalProducts.map((prod, idx) => (
                    <div key={idx} className="p-4 flex justify-between items-center hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{prod.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">Estoque: {prod.stock} / Mín: {prod.min}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-1 bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-md">
                          Há {prod.days} dias
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => navigate('/estoque-baixo')}
                  className="w-full p-3 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center justify-center gap-1"
                >
                  Ver todos os alertas <ChevronRight className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-sm border-border rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">Saúde Geral do Estoque</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stockHealthData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {stockHealthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)", borderRadius: "12px" }} />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '14px', color: '#888888' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERS DOS OUTROS PERFIS ---
  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <PremiumValueCard />
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalProducts}</div></CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-200 dark:border-rose-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-600">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-rose-600">{stats?.lowStock}</div></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solicitações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalRequests}</div></CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAlmoxarifeDashboard = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Almoxarifado</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <PremiumValueCard />
        <Card className="bg-blue-600 dark:bg-blue-700 text-white shadow-lg border-blue-500 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-white/90 tracking-wider">PRODUTOS CADASTRADOS</CardTitle>
            <Package className="h-5 w-5 text-white/80" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-white drop-shadow-md">
              <AnimatedCounter value={stats?.totalProducts || 0} isCurrency={false} />
            </div>
            <p className="text-xs text-blue-100 mt-1 font-medium opacity-90">Total de itens no catálogo</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solicitações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalRequests}</div></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Separações</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats?.totalSeparations}</div></CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSetorDashboard = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Setor</h1>
      <Card className="rounded-2xl border-border">
        <CardHeader><CardTitle>Minhas Solicitações</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Acesse o menu lateral para ver suas solicitações.</p></CardContent>
      </Card>
    </div>
  );

  const renderComprasDashboard = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Compras</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <PremiumValueCard />
        <Card className="rounded-2xl border-rose-200 dark:border-rose-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-600">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-rose-600">{stats?.lowStock}</div></CardContent>
        </Card>
      </div>
    </div>
  );

  // --- CONTROLE PRINCIPAL DE RENDER ---
  const DashboardSkeleton = () => (
    <div className="p-6 space-y-6 bg-transparent rounded-2xl animate-pulse">
      <Skeleton className="h-10 w-64 md:w-96 bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />)}
      </div>
      <Skeleton className="h-[400px] w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );

  if (isLoading) return <div className="p-4 md:p-8 min-h-screen bg-background"><DashboardSkeleton /></div>;

  const content = () => {
    switch (profile?.role) {
      case "admin": return renderAdminDashboard();
      case "chefe": return renderChefeDashboard();
      case "almoxarife": return renderAlmoxarifeDashboard();
      case "setor": return renderSetorDashboard();
      case "compras": return renderComprasDashboard();
      default: return <div className="p-8 text-center text-muted-foreground">Perfil não reconhecido.</div>;
    }
  };

  return <div className="p-4 md:p-8 bg-background text-foreground min-h-screen">{content()}</div>;
}
