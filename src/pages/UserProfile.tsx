import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ModeToggle } from '../components/mode-toggle';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Calendar } from '../components/ui/calendar';

// Ícones Premium do Lucide
import { 
  User, Bell, ShieldCheck, MessageCircle, Smartphone, Mail, Lock, Laptop, 
  MonitorSmartphone, Clock, Activity, Fingerprint, ChevronRight, Zap, 
  DownloadCloud, AlertOctagon, CheckCircle2, LayoutGrid, Palette, 
  Database, ShieldAlert, Globe, MapPin, MousePointer2, TrendingUp,
  CalendarDays, Plus, Trash2, KeyRound
} from 'lucide-react';

export default function UserProfile() {
  const { user, profile } = useAuth();
  
  // ==========================================
  // ESTADOS DE PREFERÊNCIAS AVANÇADAS
  // ==========================================
  const [accentColor, setAccentColor] = useState('purple');
  const [offlineSync, setOfflineSync] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [profileProgress, setProfileProgress] = useState(0);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [appNotifications, setAppNotifications] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  // ==========================================
  // ESTADOS DA AGENDA (Google Calendar Lite)
  // ==========================================
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('09:00');
  
  // Banco de dados simulado de eventos
  const [events, setEvents] = useState([
    { id: 1, date: new Date(), title: "Revisão de Estoque", time: "10:00", type: "tarefa" },
    { id: 2, date: new Date(), title: "Reunião de Alinhamento", time: "14:30", type: "reuniao" },
    { id: 3, date: new Date(new Date().setDate(new Date().getDate() + 1)), title: "Manutenção Preventiva", time: "09:00", type: "operacional" }
  ]);

  // Filtra os eventos apenas para o dia selecionado
  const dayEvents = events.filter(e => 
    selectedDate && e.date.toDateString() === selectedDate.toDateString()
  ).sort((a, b) => a.time.localeCompare(b.time));

  // ==========================================
  // FUNÇÕES DE AÇÃO
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => setProfileProgress(88), 500);
    return () => clearTimeout(timer);
  }, []);

  const adminWhatsApp = "5511999999999"; 

  const handleSupportClick = () => {
    const saudacao = `Olá! O meu nome é *${profile?.name || 'Utilizador'}*.`;
    const mensagem = `Estou a aceder à app Fluxo Royale e preciso de ajuda com as minhas configurações.`;
    const textEncoded = encodeURIComponent(`${saudacao}\n${mensagem}`);
    window.open(`https://wa.me/${adminWhatsApp}?text=${textEncoded}`, '_blank');
  };

  const handleAction = (title: string) => {
    toast.success('Configuração guardada', { description: `${title} atualizado com sucesso.` });
  };

  const handleAddEvent = () => {
    if (!newEventTitle.trim() || !selectedDate) return;
    
    const newEvent = {
      id: Date.now(),
      date: selectedDate,
      title: newEventTitle,
      time: newEventTime,
      type: "pessoal"
    };

    setEvents([...events, newEvent]);
    setNewEventTitle('');
    setShowEventForm(false);
    toast.success('Compromisso Agendado!', { description: `${newEventTitle} marcado para as ${newEventTime}.` });
  };

  const handleDeleteEvent = (id: number) => {
    setEvents(events.filter(e => e.id !== id));
    toast.success('Compromisso removido.');
  };

  const handleExportData = () => {
    toast.info('A processar pedido', {
      description: 'A preparar os teus dados. Vais receber um e-mail em breve com o relatório.',
    });
  };

  const handleDisconnectDevice = (device: string) => {
    toast.success('Sessão terminada', {
      description: `O dispositivo ${device} foi desligado da tua conta.`,
    });
  };

  // ==========================================
  // VARIÁVEIS DE INTERFACE (Cores e Temas)
  // ==========================================
  const firstName = profile?.name?.split(' ')[0] || 'Utilizador';
  const initial = firstName.charAt(0).toUpperCase();

  const accents: Record<string, string> = {
    purple: "from-[#8A05BE] to-[#B642E5] bg-[#8A05BE] text-[#8A05BE]",
    blue: "from-blue-600 to-indigo-500 bg-blue-600 text-blue-600",
    emerald: "from-emerald-600 to-teal-500 bg-emerald-600 text-emerald-600"
  };

  const currentAccent = accents[accentColor] || accents.purple;
  const accentHex = accentColor === 'purple' ? '#8A05BE' : accentColor === 'blue' ? '#2563eb' : '#059669';

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#F8FAFC] dark:bg-[#000000] animate-in fade-in duration-700">
      
      {/* HEADER INTEGRADO NA TELA TODA */}
      <div className="w-full bg-white dark:bg-[#0A0A0A] border-b border-slate-200 dark:border-white/5 p-8 md:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          
          <div className="flex items-center gap-8">
            <div className="relative">
              <Avatar className="w-32 h-32 border-[6px] border-slate-100 dark:border-[#1A1A1A] shadow-2xl ring-2 ring-[#8A05BE]/20" style={{ '--tw-ring-color': accentHex } as React.CSSProperties}>
                <AvatarFallback className={`text-5xl font-black bg-gradient-to-tr ${currentAccent.split(' ')[0]} ${currentAccent.split(' ')[1]} text-white`}>
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full border-4 border-white dark:border-[#0A0A0A] shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white">
                  {firstName}
                </h1>
                <Badge className={`${currentAccent.split(' ')[2]} text-white border-none px-4 py-1 rounded-full text-xs font-black uppercase tracking-tighter`}>
                  PRO VERIFIED
                </Badge>
              </div>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium flex items-center gap-3">
                <Globe className="w-5 h-5 opacity-50" /> {profile?.role?.replace('_', ' ') || 'Utilizador'} • ID: {profile?.id?.slice(0,8) || '0000'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full md:w-80">
            <div className="flex justify-between items-end">
              <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Nível de Operação</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{profileProgress}%</span>
            </div>
            {/* Correção do Progress (usando div nativa) */}
            <div className="w-full h-4 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${currentAccent.split(' ')[0]} ${currentAccent.split(' ')[1]} transition-all duration-1000 ease-out`} 
                style={{ width: `${profileProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 font-bold">Próximo objetivo: Verificação Completa</p>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL EM GRID */}
      <div className="max-w-[1600px] mx-auto w-full p-4 md:p-12 flex flex-col md:flex-row gap-12">
        
        {/* SIDEBAR DE CONFIGURAÇÃO */}
        <Tabs defaultValue="overview" className="flex flex-col md:flex-row gap-12 w-full">
          <TabsList className="flex md:flex-col justify-start items-start w-full md:w-80 bg-transparent h-auto p-0 gap-2 shrink-0">
            <p className="hidden md:block text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-4 ml-4">Centro de Comando</p>
            
            <TabsTrigger value="overview" className="w-full justify-between rounded-2xl px-6 py-5 text-slate-500 dark:text-slate-400 font-black text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/10 group">
              <div className="flex items-center"><LayoutGrid className="w-5 h-5 mr-4 transition-colors" style={{ color: 'inherit' }} /> Visão Geral</div>
              <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger value="agenda" className="w-full justify-between rounded-2xl px-6 py-5 text-slate-500 dark:text-slate-400 font-black text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/10 group">
              <div className="flex items-center"><CalendarDays className="w-5 h-5 mr-4 transition-colors" style={{ color: 'inherit' }} /> Minha Agenda</div>
              <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger value="personalize" className="w-full justify-between rounded-2xl px-6 py-5 text-slate-500 dark:text-slate-400 font-black text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/10 group">
              <div className="flex items-center"><Palette className="w-5 h-5 mr-4 transition-colors" style={{ color: 'inherit' }} /> Personalização</div>
              <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger value="security" className="w-full justify-between rounded-2xl px-6 py-5 text-slate-500 dark:text-slate-400 font-black text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/10 group">
              <div className="flex items-center"><ShieldCheck className="w-5 h-5 mr-4 transition-colors" style={{ color: 'inherit' }} /> Segurança</div>
              <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger value="sessions" className="w-full justify-between rounded-2xl px-6 py-5 text-slate-500 dark:text-slate-400 font-black text-sm data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:shadow-2xl transition-all border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-white/10 group">
              <div className="flex items-center"><MonitorSmartphone className="w-5 h-5 mr-4 transition-colors" style={{ color: 'inherit' }} /> Sessões e Logs</div>
              <ChevronRight className="w-4 h-4 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>
          </TabsList>

          {/* ÁREA DINÂMICA (RIGHT SIDE) */}
          <div className="flex-1 min-w-0">
            
            {/* ================================================= */}
            {/* ABA 1: VISÃO GERAL (DASHBOARD)                    */}
            {/* ================================================= */}
            <TabsContent value="overview" className="mt-0 space-y-8 outline-none animate-in slide-in-from-right-8 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Tarefas Concluídas</p>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">124</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#0A0A0A] p-8 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Requisições OK</p>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">98%</p>
                  </div>
                </div>
                <div className={`bg-white dark:bg-[#0A0A0A] p-8 rounded-[32px] border border-slate-200 dark:border-white/5 shadow-sm space-y-4 text-white bg-gradient-to-br ${currentAccent.split(' ')[0]} ${currentAccent.split(' ')[1]}`}>
                  <Zap className="w-10 h-10 text-white fill-white/20" />
                  <div>
                    <p className="text-sm font-black text-white/60 uppercase tracking-widest">Desempenho</p>
                    <p className="text-3xl font-black uppercase tracking-tighter italic">EXCELENTE</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0A0A0A] rounded-[40px] p-10 border border-slate-200 dark:border-white/5">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-8">Informações de Registo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</Label>
                    <div className="flex items-center justify-between h-16 px-6 rounded-2xl bg-slate-50 dark:bg-[#111111] font-bold text-slate-700 dark:text-slate-200">
                      {user?.email || 'N/A'} <Lock className="w-4 h-4 opacity-30" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Setor de Atuação</Label>
                    <div className="flex items-center justify-between h-16 px-6 rounded-2xl bg-slate-50 dark:bg-[#111111] font-bold text-slate-700 dark:text-slate-200">
                      {profile?.sector || 'Geral'} <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">ATIVO</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ================================================= */}
            {/* ABA 2: MINHA AGENDA (GOOGLE CALENDAR LITE)        */}
            {/* ================================================= */}
            <TabsContent value="agenda" className="mt-0 space-y-8 outline-none animate-in slide-in-from-right-8 duration-500">
              <div className="bg-white dark:bg-[#0A0A0A] rounded-[40px] p-6 md:p-10 border border-slate-200 dark:border-white/5 space-y-8">
                
                {/* Header da Agenda */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                      <CalendarDays className="w-7 h-7" style={{ color: accentHex }} /> A Minha Agenda
                    </h3>
                    <p className="text-slate-500 font-medium">Acompanhe e organize os seus compromissos futuros.</p>
                  </div>
                  <Button 
                    onClick={() => setShowEventForm(!showEventForm)} 
                    className={`rounded-2xl h-12 px-6 font-black text-white shadow-lg transition-transform active:scale-95 ${currentAccent.split(' ')[2]}`}
                  >
                    <Plus className="w-5 h-5 mr-2" /> Novo Compromisso
                  </Button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  
                  {/* Calendário Miniatura */}
                  <div className="xl:col-span-5 bg-slate-50 dark:bg-[#111111] p-4 md:p-6 rounded-[32px] border border-slate-100 dark:border-white/5 flex flex-col items-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => { if(date) setSelectedDate(date); }}
                      className="rounded-xl w-full flex justify-center scale-110 origin-top transform-gpu mt-4"
                      classNames={{
                        day_selected: `${currentAccent.split(' ')[2]} text-white hover:bg-opacity-90 focus:bg-opacity-90`,
                        day_today: "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white"
                      }}
                    />
                  </div>

                  {/* Lista de Eventos do Dia */}
                  <div className="xl:col-span-7 space-y-6">
                    
                    <h4 className="text-xl font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-white/10 pb-4 capitalize">
                      {selectedDate ? new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate) : 'Selecione uma data'}
                    </h4>

                    {/* Formulário Embutido */}
                    {showEventForm && (
                      <div className="p-6 rounded-[24px] border space-y-4 animate-in fade-in zoom-in duration-300 shadow-sm" style={{ backgroundColor: `${accentHex}10`, borderColor: `${accentHex}30` }}>
                        <Label className="text-xs font-black uppercase tracking-widest" style={{ color: accentHex }}>Adicionar para {selectedDate?.toLocaleDateString('pt-PT')}</Label>
                        <Input 
                          placeholder="Ex: Reunião de equipa..." 
                          value={newEventTitle} 
                          onChange={e => setNewEventTitle(e.target.value)} 
                          className="bg-white dark:bg-[#1A1A1A] border-none h-12 rounded-xl font-medium text-slate-900 dark:text-white" 
                        />
                        <div className="flex gap-4">
                          <Input 
                            type="time" 
                            value={newEventTime} 
                            onChange={e => setNewEventTime(e.target.value)} 
                            className="bg-white dark:bg-[#1A1A1A] border-none h-12 rounded-xl w-32 font-bold" 
                          />
                          <Button 
                            onClick={handleAddEvent} 
                            className={`h-12 rounded-xl flex-1 font-black text-white ${currentAccent.split(' ')[2]}`}
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="space-y-4">
                      {dayEvents.length > 0 ? dayEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] hover:bg-slate-50 dark:hover:bg-[#222] transition-colors border border-slate-100 dark:border-white/5 shadow-sm group">
                          
                          <div className="w-16 text-center shrink-0">
                            <p className="text-lg font-black" style={{ color: accentHex }}>{event.time}</p>
                          </div>
                          
                          <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: accentHex }} />
                          
                          <div className="flex-1">
                            <p className="font-bold text-slate-800 dark:text-white text-lg leading-tight">{event.title}</p>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">{event.type}</p>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteEvent(event.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-xl shrink-0"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      )) : (
                        <div className="py-16 text-center bg-slate-50 dark:bg-[#111111] rounded-[32px] border border-dashed border-slate-200 dark:border-white/10">
                          <div className="w-16 h-16 mx-auto bg-white dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Dia livre!</p>
                          <p className="text-slate-500 font-medium">Nenhum compromisso agendado para esta data.</p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ================================================= */}
            {/* ABA 3: PERSONALIZAÇÃO                             */}
            {/* ================================================= */}
            <TabsContent value="personalize" className="mt-0 space-y-8 outline-none animate-in slide-in-from-right-8 duration-500">
              <div className="bg-white dark:bg-[#0A0A0A] rounded-[40px] p-10 border border-slate-200 dark:border-white/5 space-y-12">
                
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                    <Palette className="w-7 h-7" style={{ color: accentHex }} /> Cor de Destaque
                  </h3>
                  <p className="text-slate-500 mb-8 font-medium">Escolha a paleta de cores principal do seu Fluxo Royale.</p>
                  
                  <div className="flex gap-4">
                    {['purple', 'blue', 'emerald'].map((color) => (
                      <button 
                        key={color}
                        onClick={() => { setAccentColor(color); handleAction('Cor de destaque'); }}
                        className={`w-16 h-16 rounded-3xl transition-all flex items-center justify-center ${accents[color].split(' ')[0]} ${accentColor === color ? 'ring-offset-4 ring-4 ring-slate-200 dark:ring-slate-800 scale-110' : 'opacity-40 hover:opacity-100'}`}
                      >
                        {accentColor === color && <CheckCircle2 className="w-6 h-6 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Tema Global (Dark/Light) */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-8 rounded-3xl bg-slate-50 dark:bg-[#111111] border border-slate-100 dark:border-white/5 gap-4">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm shrink-0">
                        <MonitorSmartphone className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">Aparência do Sistema</p>
                        <p className="text-sm text-slate-500 font-medium">Mude entre o modo Claro e Escuro.</p>
                      </div>
                    </div>
                    <ModeToggle />
                  </div>

                  {/* Sincronização Offline */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-8 rounded-3xl bg-slate-50 dark:bg-[#111111] border border-slate-100 dark:border-white/5 gap-4">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm shrink-0">
                        <Database className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">Sincronização Offline</p>
                        <p className="text-sm text-slate-500 font-medium">Guardar dados localmente para uso sem internet.</p>
                      </div>
                    </div>
                    <Switch checked={offlineSync} onCheckedChange={(v) => { setOfflineSync(v); handleAction('Sincronização'); }} style={{ backgroundColor: offlineSync ? accentHex : undefined }} />
                  </div>

                  {/* Suporte WhatsApp */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-8 rounded-3xl bg-slate-50 dark:bg-[#111111] border border-slate-100 dark:border-white/5 gap-4">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1A1A1A] flex items-center justify-center shadow-sm shrink-0">
                        <MessageCircle className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">Apoio via WhatsApp</p>
                        <p className="text-sm text-slate-500 font-medium">Link direto para o suporte técnico.</p>
                      </div>
                    </div>
                    <Button onClick={handleSupportClick} variant="outline" className="rounded-2xl h-12 font-black border-slate-200 hover:bg-slate-100 dark:hover:bg-[#222] transition-all group">
                      CONECTAR <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>

              </div>
            </TabsContent>

            {/* ================================================= */}
            {/* ABA 4: SEGURANÇA E ACESSO                         */}
            {/* ================================================= */}
            <TabsContent value="security" className="mt-0 space-y-8 outline-none animate-in slide-in-from-right-8 duration-500">
               <div className="bg-white dark:bg-[#0A0A0A] rounded-[40px] p-10 border border-slate-200 dark:border-white/5 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white">Proteção da Conta</h3>
                      <p className="text-slate-500 font-medium">Configurações de segurança de nível empresarial.</p>
                    </div>
                    <ShieldAlert className="w-10 h-10 text-amber-500 opacity-20 hidden md:block" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 rounded-[32px] border-2" style={{ borderColor: `${accentHex}30`, backgroundColor: `${accentHex}05` }}>
                      <Fingerprint className="w-10 h-10 mb-4" style={{ color: accentHex }} />
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-lg font-black text-slate-900 dark:text-white">Biometria / FaceID</p>
                        <Switch checked={biometrics} onCheckedChange={(v) => { setBiometrics(v); handleAction('Biometria'); }} style={{ backgroundColor: biometrics ? accentHex : undefined }} />
                      </div>
                      <p className="text-xs text-slate-500 font-bold leading-relaxed uppercase tracking-tighter">Aceder à app usando o leitor nativo.</p>
                    </div>

                    <div className="p-8 rounded-[32px] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111111] space-y-4">
                      <KeyRound className="w-10 h-10 text-slate-400" />
                      <p className="text-lg font-black text-slate-900 dark:text-white">Alterar Palavra-passe</p>
                      <Button variant="link" className="p-0 h-auto font-black hover:no-underline" style={{ color: accentHex }}>INICIAR <ChevronRight className="w-4 h-4 ml-1" /></Button>
                      <p className="text-xs text-slate-500 font-bold leading-relaxed uppercase tracking-tighter">Última alteração há 42 dias.</p>
                    </div>
                  </div>
               </div>

               {/* ZONA DE PERIGO */}
               <div className="bg-red-500/5 border border-red-500/20 rounded-[32px] p-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-red-600 dark:text-red-500 uppercase tracking-tighter">Zona Crítica</h4>
                    <p className="text-slate-500 font-medium">Apagar permanentemente a sua conta e todos os logs associados.</p>
                  </div>
                  <Button variant="destructive" className="rounded-2xl h-14 px-10 font-black shadow-xl shadow-red-500/20">ELIMINAR CONTA</Button>
               </div>
            </TabsContent>

            {/* ================================================= */}
            {/* ABA 5: SESSÕES E LOGS                             */}
            {/* ================================================= */}
            <TabsContent value="sessions" className="mt-0 space-y-8 outline-none animate-in slide-in-from-right-8 duration-500">
               
               <div className="bg-white dark:bg-[#0A0A0A] rounded-[40px] p-10 border border-slate-200 dark:border-white/5 space-y-10">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <MonitorSmartphone className="w-7 h-7" style={{ color: accentHex }} /> Dispositivos Ativos
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 md:p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 gap-4">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[24px] bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 shrink-0">
                          <Laptop className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xl font-black text-slate-900 dark:text-white">Windows PC <Badge className="ml-2 bg-emerald-500 text-white border-none text-[10px]">ESTA SESSÃO</Badge></p>
                          <div className="flex flex-wrap gap-x-4 text-sm text-slate-500 font-bold">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> São Paulo, BR</span>
                            <span className="flex items-center gap-1"><MousePointer2 className="w-3 h-3" /> Chrome</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>

               <div className="bg-white dark:bg-[#0A0A0A] rounded-[40px] p-10 border border-slate-200 dark:border-white/5 space-y-10">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                      <Activity className="w-7 h-7" style={{ color: accentHex }} /> Registo de Atividades
                    </h3>
                    <Button onClick={handleExportData} variant="outline" className="rounded-xl border-slate-200 dark:border-white/10">
                      <DownloadCloud className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Exportar</span>
                    </Button>
                  </div>
                  
                  <div className="relative border-l-2 border-slate-100 dark:border-white/10 ml-4 space-y-10 pb-4">
                    <div className="relative pl-8 group">
                      <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white dark:border-[#111111] group-hover:scale-125 transition-transform" style={{ backgroundColor: accentHex }} />
                      <p className="text-sm text-slate-400 font-bold mb-1 flex items-center gap-2"><Clock className="w-4 h-4"/> Há 5 minutos</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">Sessão Iniciada</p>
                      <p className="text-slate-500 text-sm mt-1">Acesso ao painel administrativo.</p>
                    </div>

                    <div className="relative pl-8 group">
                      <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-700 border-4 border-white dark:border-[#111111] group-hover:scale-125 transition-transform" />
                      <p className="text-sm text-slate-400 font-bold mb-1 flex items-center gap-2"><Clock className="w-4 h-4"/> Hoje, 08:30</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">Tarefa Concluída</p>
                      <p className="text-slate-500 text-sm mt-1">Cartão "Revisão Eletrica" movido para Concluído.</p>
                    </div>
                  </div>
               </div>

            </TabsContent>

          </div>
        </Tabs>
      </div>

    </div>
  );
}
