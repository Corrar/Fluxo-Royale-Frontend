import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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

  // --- COMPONENTE DE ANIMAÇÃO MELHORADO ---
  const AnimatedCounter = ({
    value,
    isCurrency = true,
  }: {
    value: number;
    isCurrency?: boolean;
  }) => {
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

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }, [value]);

    if (isCurrency) {
      return <>{formatCurrency(displayValue)}</>;
    }

    // Para números inteiros (Quantidade)
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

  // --- SKELETON LOADING (Corrigido para Dark Mode) ---
  const DashboardSkeleton = () => (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-transparent min-h-[85vh] rounded-2xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-4 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 md:w-96 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-48 bg-slate-200 dark:bg-slate-800" />
        </div>
        <Skeleton className="h-8 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24 bg-slate-100 dark:bg-slate-800" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2 bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-3 w-20 bg-slate-100 dark:bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border shadow-sm rounded-2xl">
          <CardHeader>
            <Skeleton className="h-5 w-48 bg-slate-100 dark:bg-slate-800" />
          </CardHeader>
          <CardContent className="h-[300px] flex items-end justify-between p-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton
                key={i}
                className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md"
                style={{ height: `${Math.random() * 100}%` }}
              />
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 border-border shadow-sm rounded-2xl">
          <CardHeader>
            <Skeleton className="h-5 w-32 bg-slate-100 dark:bg-slate-800" />
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <Skeleton className="h-48 w-48 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-background shadow-sm" />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // --- CARD FINANCEIRO PREMIUM ---
  const PremiumValueCard = () => (
    <Card className="bg-card text-card-foreground shadow-sm hover:shadow-md border-border rounded-2xl transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
      {/* Efeito sutil de brilho ao fundo */}
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

  // --- DASHBOARD DO CHEFE ---
  const renderChefeDashboard = () => {
    const volumeData = [
      { name: "Produtos", value: stats?.totalProducts || 0, color: "#8b5cf6" }, // Roxo moderno
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
      <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-transparent min-h-[85vh] rounded-2xl animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-4 gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-emerald-500" />
              {getGreeting()}, {profile?.name}.
            </h1>
            <p className="text-muted-foreground text-sm md:text-base mt-2 font-light">
              Visão estratégica e indicadores de performance.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-secondary/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-secondary-foreground border border-border shadow-sm self-start md:self-auto">
            <Calendar className="h-4 w-4 opacity-70" />
            <span className="capitalize">{today}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <PremiumValueCard />
          <Card className="bg-card text-card-foreground shadow-sm hover:shadow-md border-border rounded-2xl transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Estoque Crítico
              </CardTitle>
              <div className="p-2 bg-rose-100 dark:bg-rose-500/10 rounded-full">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                {stats?.lowStock || 0}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-2">
                Produtos abaixo do mínimo
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card text-card-foreground shadow-sm hover:shadow-md border-border rounded-2xl transition-all hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Pendências
              </CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-full">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                {stats?.openRequests || 0}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-2">
                Solicitações em aberto
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4 bg-card shadow-sm border-border rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Volume de Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={volumeData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#888888" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#888888" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "currentColor", opacity: 0.05 }}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      color: "var(--foreground)",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                    {volumeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 bg-card shadow-sm border-border rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Saúde do Estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stockHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "12px",
                      color: "var(--foreground)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '14px', color: '#888888' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // --- DASHBOARDS ESPECÍFICOS ---

  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Admin</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <PremiumValueCard />
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalProducts}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {stats?.lowStock}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solicitações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalRequests}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAlmoxarifeDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Almoxarifado</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {/* CARD FINANCEIRO */}
        <PremiumValueCard />

        {/* --- CARD PERSONALIZADO: PRODUTOS CADASTRADOS --- */}
        <Card className="bg-blue-600 dark:bg-blue-700 text-white shadow-lg border-blue-500 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-white/90 tracking-wider">
              PRODUTOS CADASTRADOS
            </CardTitle>
            <Package className="h-5 w-5 text-white/80" />
          </CardHeader>
          <CardContent>
            {/* EFEITO ANIMADO DE CONTAGEM */}
            <div className="text-4xl font-extrabold text-white drop-shadow-md">
              <AnimatedCounter
                value={stats?.totalProducts || 0}
                isCurrency={false}
              />
            </div>
            <p className="text-xs text-blue-100 mt-1 font-medium opacity-90">
              Total de itens no catálogo
            </p>
          </CardContent>
        </Card>

        {/* Demais cards */}
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solicitações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalRequests}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Separações</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalSeparations}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSetorDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Setor</h1>
      </div>
      <Card className="rounded-2xl border-border">
        <CardHeader>
          <CardTitle>Minhas Solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Acesse o menu lateral para ver suas solicitações.</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderComprasDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Compras</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <PremiumValueCard />
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {stats?.lowStock}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (isLoading) return <DashboardSkeleton />;

    switch (profile?.role) {
      case "admin":
        return renderAdminDashboard();
      case "chefe":
        return renderChefeDashboard();
      case "almoxarife":
        return renderAlmoxarifeDashboard();
      case "setor":
        return renderSetorDashboard();
      case "compras":
        return renderComprasDashboard();
      default:
        return <div className="p-8 text-center text-muted-foreground">Perfil não reconhecido.</div>;
    }
  };

  return <div className="p-2 md:p-6 bg-background text-foreground min-h-screen">{renderDashboard()}</div>;
}
