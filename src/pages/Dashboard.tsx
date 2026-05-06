import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  FileText,
  ClipboardList,
  AlertTriangle,
  Activity,
  TrendingUp,
  Calendar,
  Wallet,
  Sun,
  Moon,
  Sunrise,
  ChevronRight,
  Eye,
  EyeOff,
  BarChart3,
  PackagePlus // Adicionado para o dashboard do setor
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

// --- UX: Contador Fluido com Tabular Nums ---
const AnimatedCounter = ({ value, isCurrency = true, isHidden = false }: { value: number; isCurrency?: boolean; isHidden?: boolean }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1600;
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(startValue + (value - startValue) * ease);

      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value]);

  if (isHidden) {
    return <span className="tracking-[0.25em] opacity-50 flex items-center h-full translate-y-1">••••••</span>;
  }

  return (
    <span className="tabular-nums transition-all duration-300">
      {isCurrency
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(displayValue)
        : Math.round(displayValue)}
    </span>
  );
};

// --- CUSTOM TOOLTIP NUBANK STYLE ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-[#111]/90 backdrop-blur-xl p-4 rounded-[1.25rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200/50 dark:border-white/5 relative z-50">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] mb-1.5">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter leading-none">
          {payload[0].value} <span className="text-[13px] font-semibold text-slate-500 font-sans tracking-normal ml-0.5">un</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [timeState, setTimeState] = useState({ greeting: "Olá", Icon: Sun });
  const [showValues, setShowValues] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setTimeState({ greeting: "Bom dia", Icon: Sunrise });
    else if (hour >= 12 && hour < 18) setTimeState({ greeting: "Boa tarde", Icon: Sun });
    else setTimeState({ greeting: "Boa noite", Icon: Moon });
  }, []);

  const { data: stats, isLoading, isRefetching } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await api.get("/dashboard/stats");
      return response.data;
    },
  });

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // --- SKELETON RESPONSIVO BENTO GRID ---
  const DashboardSkeleton = () => (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 bg-[#FAFAFA] dark:bg-[#020202] min-h-screen pb-24 lg:pb-8 animate-in fade-in duration-1000">
      <div className="flex flex-col gap-2 mb-8">
        <Skeleton className="h-10 w-3/4 max-w-sm rounded-2xl bg-slate-200/60 dark:bg-white/5" />
        <Skeleton className="h-5 w-1/2 max-w-xs rounded-xl bg-slate-200/60 dark:bg-white/5" />
      </div>
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="md:col-span-2 h-[240px] rounded-[2.5rem] bg-slate-200/60 dark:bg-white/5" />
        <Skeleton className="h-[240px] rounded-[2.5rem] bg-slate-200/60 dark:bg-white/5" />
        <Skeleton className="h-[240px] rounded-[2.5rem] bg-slate-200/60 dark:bg-white/5" />
      </div>
      <div className="grid gap-4 md:gap-6 grid-cols-1 xl:grid-cols-3">
        <Skeleton className="xl:col-span-2 h-[380px] rounded-[2.5rem] bg-slate-200/60 dark:bg-white/5" />
        <Skeleton className="h-[380px] rounded-[2.5rem] bg-slate-200/60 dark:bg-white/5" />
      </div>
    </div>
  );

  // --- COMPONENTES REUTILIZÁVEIS (Spatial UI) ---
  const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6 md:mb-8 animate-in fade-in slide-in-from-top-6 duration-1000 ease-out">
      <div>
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-2 opacity-90">
          <timeState.Icon className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-sm font-bold tracking-tight">{timeState.greeting}</span>
        </div>
        <h1 className="text-3xl md:text-[44px] font-black text-slate-900 dark:text-white tracking-tighter leading-none">
          {title}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base mt-3 font-medium tracking-tight">
          {subtitle}
        </p>
      </div>
      <div className="hidden md:flex items-center gap-2 bg-white/60 dark:bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-2xl text-[13px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 shadow-sm">
        <Calendar className="h-4 w-4 text-blue-500" strokeWidth={2.5} />
        <span className="capitalize">{today}</span>
      </div>
    </div>
  );

  const PremiumValueCard = ({ className = "" }: { className?: string }) => (
    <Card className={`rounded-[2.5rem] border-none shadow-[0_24px_48px_-12px_rgba(0,51,160,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,1)] bg-gradient-to-br from-[#050B14] via-[#0A1931] to-[#001A5C] relative overflow-hidden flex flex-col justify-between group hover:-translate-y-1.5 transition-all duration-500 ease-out cursor-pointer active:scale-[0.98] ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform -translate-x-full group-hover:translate-x-full ease-in-out" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full bg-blue-500/20 blur-[80px] pointer-events-none mix-blend-screen group-hover:bg-blue-500/30 transition-colors duration-1000" />
      
      <CardContent className="p-7 md:p-8 flex flex-col h-full justify-between relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${isRefetching ? 'duration-75' : 'duration-1000'}`}></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <Wallet className="h-4 w-4 text-blue-50 opacity-90" strokeWidth={2.5} />
            <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase text-blue-100/90 pt-0.5">
              Património
            </h2>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setShowValues(!showValues); }}
            className="p-3 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all duration-300 active:scale-90 backdrop-blur-xl border border-white/5 focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        
        <div className="mt-8 flex flex-col">
          <div className="text-[40px] md:text-[56px] font-black text-white tracking-tighter leading-none flex items-center drop-shadow-md">
            <AnimatedCounter value={stats?.totalValue || 0} isCurrency={true} isHidden={!showValues} />
          </div>
          <p className="text-[13px] font-semibold text-blue-200/60 mt-3 tracking-wide uppercase">
            Capital Imobilizado
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const MetricCard = ({ title, value, icon: Icon, colorClass, desc, onClick, className = "" }: any) => (
    <Card onClick={onClick} className={`bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200/60 dark:border-white/5 rounded-[2.5rem] cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all duration-500 ease-out group active:scale-[0.96] overflow-hidden ${className}`}>
      <CardContent className="p-7 md:p-8 flex flex-col justify-between h-full relative z-10">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2.5 ${colorClass.bg} px-3 py-1.5 rounded-xl border ${colorClass.border}`}>
            <Icon className={`h-4 w-4 ${colorClass.text}`} strokeWidth={2.5} />
            <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${colorClass.text} pt-0.5`}>{title}</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center group-hover:bg-slate-100 dark:group-hover:bg-white/10 transition-colors duration-500">
            <ChevronRight className={`h-5 w-5 ${colorClass.text} transition-transform duration-500 ease-out group-hover:translate-x-0.5`} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-8">
          <div className="text-[44px] md:text-[52px] font-black text-slate-900 dark:text-white tracking-tighter leading-none">
            <AnimatedCounter value={value} isCurrency={false} />
          </div>
          <p className="text-[13px] font-medium text-slate-500 mt-2">
            {desc}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // --- DASHBOARD DO CHEFE / ADMIN (BENTO GRID MASTER) ---
  const renderBentoDashboard = (isAdmin = false) => {
    const volumeData = [
      { name: "Catálogo", value: stats?.totalProducts || 0, color: "#3B82F6" },
      { name: "Pedidos", value: stats?.totalRequests || 0, color: "#8B5CF6" },
      { name: "Saídas", value: stats?.totalSeparations || 0, color: "#0EA5E9" },
    ];
    
    const totalStock = stats?.totalProducts || 1;
    const lowStock = stats?.lowStock || 0;
    const healthyStock = totalStock - lowStock;
    const stockHealthData = [
      { name: "Regular", value: healthyStock, color: "#3B82F6" },
      { name: "Crítico", value: lowStock > 0 ? lowStock : 0.01, color: "#1E293B" },
    ];

    return (
      <div className="p-4 md:p-6 lg:p-8 bg-[#FAFAFA] dark:bg-[#020202] min-h-screen pb-24 lg:pb-8 selection:bg-blue-500/30">
        <Header 
          title={isAdmin ? "Dashboard Global" : "Visão Executiva"} 
          subtitle="O seu painel de controlo estratégico." 
        />

        {/* BENTO GRID LEVEL 1 */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both ease-out mb-4 md:mb-6">
          <PremiumValueCard className="md:col-span-2 min-h-[220px] md:min-h-[240px]" />
          
          <MetricCard 
            title="Ruptura" value={stats?.lowStock || 0} icon={AlertTriangle} 
            desc="Itens requerem atenção" onClick={() => navigate('/low-stock')}
            colorClass={{ bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-100 dark:border-rose-500/20', text: 'text-rose-500' }}
          />
          
          <MetricCard 
            title="A Rever" value={stats?.openRequests || 0} icon={Activity} 
            desc="Pedidos pendentes" onClick={() => navigate('/requests')}
            colorClass={{ bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20', text: 'text-blue-500' }}
          />
        </div>

        {/* BENTO GRID LEVEL 2 (CHARTS) */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both ease-out">
          
          {/* BAR CHART */}
          <Card className="xl:col-span-2 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200/60 dark:border-white/5 rounded-[2.5rem]">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-2 mb-8">
                <BarChart3 className="h-5 w-5 text-slate-400" />
                <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-0.5">
                  Volume Operacional
                </h3>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 600 }} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={15}
                    />
                    <Tooltip cursor={{ fill: "currentColor", opacity: 0.03 }} content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[12, 12, 12, 12]} maxBarSize={45}>
                      {volumeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity duration-300 cursor-pointer" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* PIE CHART (Donut) */}
          <Card className="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200/60 dark:border-white/5 rounded-[2.5rem]">
            <CardContent className="p-6 md:p-8 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-slate-400" />
                <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] pt-0.5">
                  Índice de Saúde
                </h3>
              </div>
              <div className="flex-1 min-h-[280px] relative flex items-center justify-center">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[40px] font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                    {Math.round((healthyStock / totalStock) * 100)}<span className="text-2xl">%</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Saudável</span>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stockHealthData}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={105}
                      paddingAngle={6}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={20}
                    >
                      {stockHealthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-sm" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // --- OUTROS PERFIS ---

  const renderAlmoxarifeDashboard = () => (
    <div className="p-4 md:p-6 lg:p-8 bg-[#FAFAFA] dark:bg-[#020202] min-h-screen pb-24 lg:pb-8 selection:bg-blue-500/30">
      <Header title="Almoxarifado" subtitle="Controlo operacional diário." />
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both ease-out">
        <PremiumValueCard className="md:col-span-2 min-h-[220px]" />
        <MetricCard 
          title="Catálogo" value={stats?.totalProducts || 0} icon={Package} 
          desc="Produtos cadastrados" onClick={() => navigate('/products')}
          colorClass={{ bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-100 dark:border-indigo-500/20', text: 'text-indigo-500' }}
        />
        <MetricCard 
          title="Separações" value={stats?.totalSeparations || 0} icon={ClipboardList} 
          desc="Saídas processadas" onClick={() => navigate('/separations')}
          colorClass={{ bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-100 dark:border-blue-500/20', text: 'text-blue-500' }}
        />
      </div>
    </div>
  );

  const renderComprasDashboard = () => (
    <div className="p-4 md:p-6 lg:p-8 bg-[#FAFAFA] dark:bg-[#020202] min-h-screen pb-24 lg:pb-8 selection:bg-blue-500/30">
      <Header title="Compras" subtitle="Gestão de aquisições e alertas." />
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both ease-out">
        <PremiumValueCard className="md:col-span-2 min-h-[220px]" />
        <MetricCard 
          title="Ruptura" value={stats?.lowStock || 0} icon={AlertTriangle} 
          desc="Reposição urgente" onClick={() => navigate('/low-stock')}
          colorClass={{ bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-100 dark:border-rose-500/20', text: 'text-rose-500' }}
        />
      </div>
    </div>
  );

  // --- NOVA INTERFACE DO SETOR COM ORIENTAÇÃO CLARA ---
  const renderSetorDashboard = () => (
    <div className="p-4 md:p-6 lg:p-8 bg-[#FAFAFA] dark:bg-[#020202] min-h-screen pb-24 lg:pb-8 selection:bg-blue-500/30">
      <Header title={`Bem-vindo, ${profile?.name?.split(' ')[0]}`} subtitle="O que precisa de solicitar hoje?" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
        
        {/* 1. BOTÃO GIGANTE DE NOVA SOLICITAÇÃO (Foco Principal) */}
        <Card 
          onClick={() => navigate('/search')} // Direciona para a página de pesquisa de materiais
          className="bg-blue-600 dark:bg-blue-700 text-white cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(37,99,235,0.4)] transition-all duration-300 active:scale-95 border-none rounded-[2.5rem] overflow-hidden relative group"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-3xl group-hover:bg-white/30 transition-colors duration-700 pointer-events-none" />
          <CardContent className="p-8 md:p-10 flex flex-col items-center justify-center text-center h-full relative z-10">
            <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm shadow-inner group-hover:scale-110 transition-transform duration-500">
              <PackagePlus className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-2">Pedir Peças</h2>
            <p className="text-blue-100 font-medium text-sm md:text-base">
              Toque aqui para procurar materiais e fazer uma nova solicitação para o seu setor.
            </p>
          </CardContent>
        </Card>

        {/* 2. ACESSO RÁPIDO AOS PEDIDOS EM ANDAMENTO */}
        <Card 
          onClick={() => navigate('/my-requests')}
          className="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition-all duration-300 active:scale-95 border border-slate-200/60 dark:border-white/5 rounded-[2.5rem] shadow-sm group"
        >
          <CardContent className="p-8 md:p-10 flex flex-col items-center justify-center text-center h-full">
            <div className="h-16 w-16 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-full flex items-center justify-center mb-6 group-hover:bg-slate-200 dark:group-hover:bg-white/10 transition-colors">
              <ClipboardList className="h-8 w-8" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Meus Pedidos</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
              Acompanhe o estado das suas solicitações e verifique as entregas.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );

  const renderDashboard = () => {
    if (isLoading) return <DashboardSkeleton />;

    switch (profile?.role) {
      case "admin": return renderBentoDashboard(true);
      case "chefe": return renderBentoDashboard(false);
      case "almoxarife": return renderAlmoxarifeDashboard();
      case "compras": return renderComprasDashboard();
      case "setor": return renderSetorDashboard();
      default: return <div className="p-8 text-center text-slate-500 font-medium">A carregar perfil...</div>;
    }
  };

  return renderDashboard();
}
