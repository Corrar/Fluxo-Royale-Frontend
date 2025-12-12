import { useState, useEffect } from "react"; // Adicionado useState e useEffect
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, FileText, ClipboardList, AlertTriangle, DollarSign, 
  Activity, TrendingUp, Calendar 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';

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
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // --- NOVO COMPONENTE DE ANIMAÇÃO (Efeito Caça-Níquel) ---
  const AnimatedCounter = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      let startTimestamp: number | null = null;
      const duration = 2000; // Duração da animação em ms (2 segundos)
      const startValue = 0;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function (easeOutExpo) para desacelerar elegantemente no final
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        const current = startValue + (value - startValue) * ease;
        
        setDisplayValue(current);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }, [value]);

    return <>{formatCurrency(displayValue)}</>;
  };
  // -------------------------------------------------------

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Componente Padrão (Para Admin/Almoxarife)
  const TotalValueCardDefault = () => (
    <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-emerald-800">Valor Total</CardTitle>
        <DollarSign className="h-4 w-4 text-emerald-600" />
      </CardHeader>
      <CardContent>
        {/* APLICADO EFEITO AQUI */}
        <div className="text-2xl font-bold text-emerald-700">
          <AnimatedCounter value={stats?.totalValue || 0} />
        </div>
      </CardContent>
    </Card>
  );

  // --- RENDERIZAÇÃO DO PAINEL DO CHEFE (Visual Limpo) ---
  const renderChefeDashboard = () => {
    // Dados Gráficos
    const volumeData = [
      { name: 'Produtos', value: stats?.totalProducts || 0, color: '#64748b' },
      { name: 'Solicitações', value: stats?.totalRequests || 0, color: '#f59e0b' },
      { name: 'Separações', value: stats?.totalSeparations || 0, color: '#10b981' },
    ];
    const totalStock = stats?.totalProducts || 1;
    const lowStock = stats?.lowStock || 0;
    const healthyStock = totalStock - lowStock;
    const stockHealthData = [
      { name: 'Saudável', value: healthyStock, color: '#10b981' },
      { name: 'Crítico', value: lowStock, color: '#ef4444' },
    ];

    return (
      // Container principal com fundo claro
      <div className="p-6 space-y-6 bg-slate-50/50 min-h-[85vh] rounded-xl border border-slate-100 shadow-sm">
        
        {/* CABEÇALHO (Cores escuras para fundo claro) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-emerald-600" />
              {getGreeting()}, {profile?.name}.
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Visão estratégica e indicadores de performance.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full text-xs font-medium text-slate-500 border shadow-sm">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{today}</span>
          </div>
        </div>

        {/* 1. KPIs Principais */}
        <div className="grid gap-4 md:grid-cols-3">
          
          {/* Card Financeiro (VERDE COM SOMBRA) */}
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-700 border-none text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-white" /> Valor em Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* APLICADO EFEITO AQUI */}
              <div className="text-3xl font-bold text-white">
                <AnimatedCounter value={stats?.totalValue || 0} />
              </div>
              <p className="text-xs text-emerald-100/80 mt-1">Capital imobilizado</p>
            </CardContent>
          </Card>

          {/* Alerta (Branco com detalhe Amarelo) */}
          <Card className="bg-white border-amber-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Estoque Crítico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats?.lowStock || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Produtos abaixo do mínimo</p>
            </CardContent>
          </Card>

          {/* Pendências (Branco com detalhe Azul) */}
          <Card className="bg-white border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats?.openRequests || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Solicitações em aberto</p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Gráficos (Containers Brancos) */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          
          {/* Gráfico de Barras */}
          <Card className="lg:col-span-4 bg-white shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base text-slate-800">Volume de Movimentações</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  {/* Eixos com cores mais escuras para fundo branco */}
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  {/* Tooltip claro */}
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }} 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {volumeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráfico de Pizza */}
          <Card className="lg:col-span-3 bg-white shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base text-slate-800">Saúde do Estoque</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stockHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {/* Tooltip claro */}
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>
      </div>
    );
  };

  // --- DASHBOARDS PADRÃO (Mantidos) ---
  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Dashboard Admin</h1></div>
      <div className="grid gap-4 md:grid-cols-4">
        <TotalValueCardDefault />
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Produtos</CardTitle><Package className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalProducts}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Estoque Baixo</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-600"/></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats?.lowStock}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Solicitações</CardTitle><FileText className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalRequests}</div></CardContent></Card>
      </div>
    </div>
  );

  const renderAlmoxarifeDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Almoxarifado</h1></div>
      <div className="grid gap-4 md:grid-cols-3">
        <TotalValueCardDefault />
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Solicitações</CardTitle><FileText className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalRequests}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Separações</CardTitle><ClipboardList className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalSeparations}</div></CardContent></Card>
      </div>
    </div>
  );

  const renderSetorDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Setor</h1></div>
      <Card><CardHeader><CardTitle>Minhas Solicitações</CardTitle></CardHeader><CardContent><p>Acesse o menu lateral para ver suas solicitações.</p></CardContent></Card>
    </div>
  );

  const renderComprasDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Compras</h1></div>
      <div className="grid gap-4 md:grid-cols-3">
        <TotalValueCardDefault />
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Estoque Baixo</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-600"/></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats?.lowStock}</div></CardContent></Card>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (isLoading) return <div className="p-8 text-center flex items-center justify-center h-full text-muted-foreground">Carregando indicadores...</div>;

    switch (profile?.role) {
      case "admin": return renderAdminDashboard();
      case "chefe": return renderChefeDashboard();
      case "almoxarife": return renderAlmoxarifeDashboard();
      case "setor": return renderSetorDashboard();
      case "compras": return renderComprasDashboard();
      default: return <div className="p-8 text-center">Perfil não reconhecido.</div>;
    }
  };

  return renderDashboard();
}