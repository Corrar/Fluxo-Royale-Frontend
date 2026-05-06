import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  EyeOff,
  PackagePlus,
  ArrowDownUp,
  AlertCircle,
  FileText,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Search,
  Wallet,
  Clock,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Activity
} from "lucide-react";

// --- UX/Engenharia: Contador Estabilizado com Tabular Nums ---
const AnimatedCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1800; // Tempo prolongado para o efeito dramático Apple
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

  return (
    // tabular-nums é CRUCIAL aqui para a largura dos números não tremer durante a animação
    <span className="tabular-nums">
      {new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(displayValue)}
    </span>
  );
};

// --- UTILITÁRIO: Formatador Humano de Datas ---
const formatRelativeTime = (dateString: string) => {
  if (!dateString) return "Data desconhecida";
  
  const date = new Date(dateString);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const timeStr = date.toLocaleTimeString('pt-PT', timeOptions);

  if (isToday) return `Hoje, ${timeStr}`;
  if (isYesterday) return `Ontem, ${timeStr}`;
  
  return `${date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}, ${timeStr}`;
};

export default function TelaInicialPremium() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showValues, setShowValues] = useState(true);
  const [timeState, setTimeState] = useState({ greeting: "Olá", Icon: Sun });

  const canSeeValues = ['admin', 'chefe', 'compras', 'almoxarife'].includes(profile?.role || '');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setTimeState({ greeting: "Bom dia", Icon: Sunrise });
    else if (hour >= 12 && hour < 18) setTimeState({ greeting: "Boa tarde", Icon: Sun });
    else setTimeState({ greeting: "Boa noite", Icon: Moon });
  }, []);

  const { data: stats, isLoading: loadingStats, refetch: refetchStats, isRefetching: syncingStats } = useQuery({
    queryKey: ["dashboard-stats-premium"],
    queryFn: async () => {
      const response = await api.get("/dashboard/stats");
      return response.data;
    },
  });

  const { data: recentActivity = [], isLoading: loadingActivity, refetch: refetchActivity, isRefetching: syncingActivity } = useQuery({
    queryKey: ["recent-transactions"],
    queryFn: async () => {
      try {
        const response = await api.get("/transactions/recent"); 
        
        // Formata os dados vindos da API
        return response.data.map((item: any) => {
          const isEntrada = item.type === 'in' || item.type === 'ENTRADA' || item.quantidade > 0;
          const nomeProduto = item.product_name || item.produto?.nome || item.name || 'Produto Desconhecido';
          
          // Captura o SKU, mas NÃO o mistura com o título
          const skuProduto = item.product_sku || item.produto?.sku || item.sku || item.codigo || item.produto?.codigo || '';
          
          return {
            id: item.id,
            title: `${isEntrada ? 'Entrada' : 'Retirada'}: ${nomeProduto}`, // Título limpo e legível
            sku: skuProduto, // Enviamos o SKU de forma independente
            type: isEntrada ? 'in' : 'out',
            amount: Math.abs(item.amount || item.quantity || item.quantidade || 0),
            time: formatRelativeTime(item.created_at || item.createdAt || item.data)
          };
        });
      } catch (error) {
        console.error("Erro ao carregar extrato:", error);
        return []; 
      }
    },
  });

  const isSyncing = syncingStats || syncingActivity;
  const handleManualSync = () => {
    refetchStats();
    refetchActivity();
  };

  // --- UI: Botão com Glass Highlight (Borda de Vidro) ---
  const QuickAction = ({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-3 min-w-[80px] md:min-w-[96px] snap-center group outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 rounded-2xl transition-all"
    >
      <div className="h-16 w-16 md:h-[72px] md:w-[72px] rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.05)] border border-slate-200/50 dark:border-white/5 flex items-center justify-center transition-all duration-500 ease-out group-hover:bg-[#F8FAFC] dark:group-hover:bg-blue-900/20 group-hover:-translate-y-1 group-hover:shadow-[0_12px_30px_-8px_rgba(37,99,235,0.2),inset_0_1px_1px_rgba(255,255,255,1)] active:scale-[0.92] active:duration-150 relative overflow-hidden">
        <Icon className="h-[26px] w-[26px] md:h-7 md:w-7 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:text-blue-700 transition-all duration-500 ease-out relative z-10" strokeWidth={1.5} />
      </div>
      <span className="text-[12px] md:text-[13px] font-semibold text-slate-500 dark:text-slate-400 text-center leading-tight tracking-tight group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors duration-300">
        {label}
      </span>
    </button>
  );

  if (loadingStats) {
    return (
      <div className="w-full pb-24 lg:pb-8 space-y-8 md:space-y-10 animate-in fade-in duration-1000">
        <Skeleton className="h-[220px] md:h-[260px] w-full rounded-[2.5rem] bg-slate-200/50 dark:bg-slate-800/30" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <Skeleton className="h-28 w-full rounded-[2rem] bg-slate-100/80 dark:bg-slate-900/40" />
            <Skeleton className="h-64 w-full rounded-[2rem] bg-slate-100/80 dark:bg-slate-900/40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 lg:pb-8 space-y-8 md:space-y-10 bg-[#FAFAFA] dark:bg-[#050505] min-h-screen selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-100">
      
      {/* 1. O CARTÃO MASTER ULTRA PREMIUM */}
      <section className="animate-in fade-in slide-in-from-top-6 duration-1000 ease-out bg-gradient-to-br from-[#0033A0] via-[#0044CC] to-[#001A5C] dark:from-[#0A101F] dark:via-[#0F172A] dark:to-[#020617] rounded-[2.5rem] p-7 md:p-10 text-white shadow-[0_24px_48px_-12px_rgba(0,68,204,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,1),inset_0_1px_1px_rgba(255,255,255,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[220px] md:min-h-[260px] border border-blue-600/20 dark:border-white/5 group">
        
        {/* Luzes Refractivas que reagem subtilmente */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] rounded-full bg-blue-400/20 blur-[100px] pointer-events-none mix-blend-screen group-hover:bg-blue-400/30 transition-colors duration-1000" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-[400px] h-[400px] rounded-full bg-cyan-400/10 blur-[80px] pointer-events-none mix-blend-screen" />
        
        {canSeeValues ? (
          <div className="relative z-10 flex flex-col gap-8 h-full justify-between">
            <div className="flex items-center justify-between">
              
              <div className="flex items-center gap-2.5 bg-black/10 backdrop-blur-2xl px-4 py-2 rounded-full border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
                {/* UX: Ponto "Live" de ligação em tempo real */}
                <span className="relative flex h-2 w-2 mr-1">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${isSyncing ? 'duration-75' : 'duration-1000'}`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <Wallet className="h-3.5 w-3.5 text-blue-50 opacity-90" strokeWidth={2.5} />
                <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-blue-50/90 pt-0.5">
                  Património
                </h2>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleManualSync}
                  className="p-3 text-white bg-white/5 hover:bg-white/15 rounded-full transition-all duration-300 active:scale-90 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Sincronizar dados"
                >
                  <RefreshCw className={`h-[18px] w-[18px] opacity-90 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={() => setShowValues(!showValues)}
                  className="p-3 text-white bg-white/5 hover:bg-white/15 rounded-full transition-all duration-300 active:scale-90 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
                >
                  {showValues ? <Eye className="h-[18px] w-[18px] opacity-90" /> : <EyeOff className="h-[18px] w-[18px] opacity-90" />}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-blue-100/90 mb-2 opacity-90">
                <timeState.Icon className="h-4 w-4" strokeWidth={2.5} />
                <p className="text-[15px] font-semibold tracking-tight">{timeState.greeting}, {profile?.name?.split(' ')[0]}</p>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-5">
                <div className="text-[44px] sm:text-6xl md:text-[84px] font-black tracking-tighter flex items-center leading-none drop-shadow-lg h-[1em]">
                  {showValues ? (
                     <AnimatedCounter value={stats?.totalValue || 0} />
                  ) : (
                     <span className="tracking-[0.25em] text-white/50 flex items-center h-full text-5xl md:text-7xl translate-y-1 md:translate-y-2">••••••</span>
                  )}
                </div>
                
                {showValues && (
                  <div className="animate-in fade-in zoom-in duration-700 delay-500 flex items-center gap-1.5 bg-blue-500/20 text-blue-50 backdrop-blur-md px-3 py-1.5 rounded-full border border-blue-400/30 text-[11px] font-bold tracking-widest mb-2 md:mb-5 w-fit shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                    <Activity className="h-3 w-3" strokeWidth={3} />
                    <span className="uppercase pt-0.5">Operacional</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col justify-end h-full gap-3">
            <div className="flex items-center gap-2 text-blue-100/90 mb-1">
                <timeState.Icon className="h-5 w-5" strokeWidth={2.5} />
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {timeState.greeting},
                </h2>
            </div>
            <div className="text-5xl md:text-[84px] font-black text-white tracking-tighter drop-shadow-lg leading-none">
              {profile?.name?.split(' ')[0] || 'Utilizador'}
            </div>
          </div>
        )}
      </section>

      {/* 2. O GRID DE DADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-8 space-y-10">
          
          <section className="relative animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both ease-out">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5 px-2">
              Ações Rápidas
            </h3>
            
            <div className="absolute right-0 top-10 bottom-0 w-16 bg-gradient-to-l from-[#FAFAFA] dark:from-[#050505] to-transparent pointer-events-none z-10 lg:hidden" />

            <div className="flex gap-4 md:gap-5 overflow-x-auto pb-6 pt-2 px-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <QuickAction icon={ArrowDownUp} label="Movimentar" onClick={() => navigate('/withdrawal')} />
              {canSeeValues && <QuickAction icon={PackagePlus} label="Novo Item" onClick={() => navigate('/products')} />}
              <QuickAction icon={Search} label="Consultar" onClick={() => navigate('/stock-view')} />
              <QuickAction icon={FileText} label="Relatórios" onClick={() => navigate('/reports')} />
            </div>
          </section>

          <section className="space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both ease-out">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Extrato Recente</h3>
              <button 
                onClick={() => navigate('/reports')}
                className="text-blue-600 dark:text-blue-400 font-bold text-[13px] flex items-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-full transition-all active:scale-95 duration-300 ease-out outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                Ver tudo <ChevronRight className="h-4 w-4 ml-0.5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] rounded-[2rem] p-3 shadow-[0_4px_24px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] border border-slate-200/50 dark:border-white/5">
              {loadingActivity ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50 dark:border-white/5 last:border-0">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-[42px] w-[42px] rounded-2xl bg-slate-100 dark:bg-slate-800" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32 bg-slate-100 dark:bg-slate-800" />
                        <Skeleton className="h-3 w-20 bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  </div>
                ))
              ) : recentActivity.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-3xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                    <Clock className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <p className="font-semibold text-[13px] tracking-tight">O seu extrato está vazio.</p>
                </div>
              ) : (
                recentActivity.map((activity: any, index: number) => (
                  <div 
                    key={activity.id} 
                    className={`flex items-center justify-between p-4 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] rounded-[1.5rem] transition-colors duration-300 cursor-pointer group ${index !== recentActivity.length - 1 ? 'border-b border-slate-50 dark:border-white/5' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-[44px] w-[44px] flex items-center justify-center rounded-2xl transition-all duration-500 ease-out shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ${activity.type === 'in' ? 'bg-[#F0F5FF] border border-blue-100/50 text-[#2563EB] dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-400' : 'bg-slate-50 border border-slate-200/50 text-slate-500 dark:bg-slate-800/30 dark:border-slate-700/30 dark:text-slate-400'}`}>
                        {activity.type === 'in' ? <TrendingUp className="h-5 w-5 group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-500" strokeWidth={2.5} /> : <TrendingDown className="h-5 w-5 group-hover:scale-110 group-hover:translate-y-0.5 transition-transform duration-500" strokeWidth={2.5} />}
                      </div>
                      
                      <div className="flex flex-col">
                        {/* 1. O Título limpo e visível */}
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-[14px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight">{activity.title}</p>
                        
                        {/* 2. Os Meta-dados (SKU e Hora) perfeitamente alinhados */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {activity.sku && (
                            <>
                              <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500 font-mono tracking-tight">
                                SKU: {activity.sku}
                              </span>
                              <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                            </>
                          )}
                          <p className="text-[12px] text-slate-500 font-medium">{activity.time}</p>
                        </div>
                      </div>

                    </div>
                    <div className={`font-black text-[15px] tracking-tight tabular-nums ${activity.type === 'in' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-300'}`}>
                      {activity.type === 'in' ? '+' : '-'}{activity.amount}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-4 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both ease-out">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5 px-2 hidden lg:block">
            Radar Operacional
          </h3>
          
          {canSeeValues ? (
            <Card 
              onClick={() => navigate('/low-stock')}
              className="rounded-[2rem] border-none shadow-[0_16px_32px_-12px_rgba(0,68,204,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] bg-[#0044CC] dark:bg-blue-900 cursor-pointer hover:-translate-y-1 hover:shadow-[0_24px_48px_-12px_rgba(0,68,204,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all duration-500 ease-out group active:scale-[0.96] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-colors duration-700 mix-blend-screen" />
              
              <CardContent className="p-7 md:p-8 flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-blue-200">
                    <AlertCircle className="h-4 w-4 opacity-90" strokeWidth={2.5} />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-90 pt-0.5">Estoque Crítico</p>
                  </div>
                  <p className="text-6xl font-black text-white mt-3 tracking-tighter leading-none">{stats?.lowStock || 0}</p>
                  <p className="text-[13px] font-semibold text-blue-200 mt-2">Ação imediata</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors duration-500 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <ChevronRight className="h-5 w-5 text-white group-hover:translate-x-1 transition-transform duration-500 ease-out" strokeWidth={2.5} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card 
              onClick={() => navigate('/requests')}
              className="rounded-[2rem] border border-blue-100/50 dark:border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] bg-[#F8FAFC] dark:bg-[#0A0A0A] cursor-pointer hover:-translate-y-1 transition-all duration-500 ease-out group active:scale-[0.96]"
            >
              <CardContent className="p-7 md:p-8 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <TrendingUp className="h-4 w-4" strokeWidth={2.5} />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] pt-0.5">Aprovadas</p>
                  </div>
                  <p className="text-6xl font-black text-slate-900 dark:text-white mt-3 tracking-tighter leading-none">2</p>
                  <p className="text-[13px] font-semibold text-slate-500 mt-2">Prontas para retirar</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm border border-slate-100/50 dark:border-transparent group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors duration-500">
                  <ChevronRight className="h-5 w-5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform duration-500 ease-out" strokeWidth={2.5} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card 
            onClick={() => navigate('/requests')}
            className="rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] bg-white dark:bg-[#0A0A0A] cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] transition-all duration-500 ease-out group active:scale-[0.96]"
          >
            <CardContent className="p-7 md:p-8 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="h-4 w-4" strokeWidth={2.5} />
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] pt-0.5">Pendências</p>
                </div>
                <p className="text-6xl font-black text-blue-600 dark:text-blue-400 mt-3 tracking-tighter leading-none">{stats?.openRequests || stats?.pendingRequests || 0}</p>
                <p className="text-[13px] font-semibold text-slate-500 mt-2">Aguardar revisão</p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-slate-100/50 dark:border-transparent group-hover:bg-blue-50 dark:group-hover:bg-white/10 transition-colors duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-none">
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-transform duration-500 ease-out" strokeWidth={2.5} />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
