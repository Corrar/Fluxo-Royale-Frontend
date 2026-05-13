import { useState } from "react";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Terminal, CheckCircle, Clock, AlertTriangle, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDevTasks, createDevTask } from "@/services/api";
import { toast } from "sonner";

// 1. Configuração do Calendário para Português
const locales = {
  "pt-BR": ptBR,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function DevDashboard() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estado para o formulário de nova tarefa
  const [newTask, setNewTask] = useState({
    title: "",
    start_time: "",
    end_time: "",
    priority: "media" as "baixa" | "media" | "alta",
  });

  // 2. Buscar Tarefas Reais da API com React Query
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['devTasks'],
    queryFn: getDevTasks,
  });

  // 3. Criar Nova Tarefa com Mutação
  const mutation = useMutation({
    mutationFn: createDevTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devTasks'] });
      toast.success("Tarefa programada com sucesso!");
      setIsModalOpen(false); // Fecha o modal
      setNewTask({ title: "", start_time: "", end_time: "", priority: "media" }); // Limpa o form
    },
    onError: () => {
      toast.error("Erro ao criar a tarefa. Verifica o console.");
    }
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.start_time || !newTask.end_time) {
      toast.error("Preenche os campos obrigatórios!");
      return;
    }
    
    // Converte as datas do formato HTML datetime-local para formato aceitável pela API
    mutation.mutate({
      title: newTask.title,
      start_time: new Date(newTask.start_time).toISOString(),
      end_time: new Date(newTask.end_time).toISOString(),
      priority: newTask.priority,
      status: "pendente"
    });
  };

  // 4. Cálculos de Desempenho Diário
  const todayTasks = tasks.filter((task: any) => isSameDay(task.start, new Date()));
  const completedTasks = todayTasks.filter((task: any) => task.status === "concluida").length;
  const totalToday = todayTasks.length;
  const progressPercentage = totalToday === 0 ? 0 : Math.round((completedTasks / totalToday) * 100);

  // 5. Customização das Cores do Calendário baseado na Prioridade/Status
  const eventStyleGetter = (event: any) => {
    let backgroundColor = "#3b82f6"; // Azul padrão
    if (event.status === "concluida") {
      backgroundColor = "#10b981"; // Verde se concluído
    } else if (event.priority === "alta") {
      backgroundColor = "#ef4444"; // Vermelho se pendente e prioridade alta
    } else if (event.priority === "media") {
      backgroundColor = "#f59e0b"; // Amarelo
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
        fontWeight: "bold",
        fontSize: "12px"
      },
    };
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[calc(100vh-100px)] text-slate-500 font-medium">A carregar o teu painel...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Terminal className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Painel do Desenvolvedor</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Controle exclusivo de TI e Engenharia</p>
          </div>
        </div>

        {/* MODAL DE NOVA TAREFA */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-11 px-6 shadow-sm transition-all active:scale-95">
              <Plus className="h-5 w-5 mr-2" /> Programar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#1A1A1A] border-slate-200 dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Nova Tarefa TI</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 block">Título da Tarefa</label>
                <Input 
                  placeholder="Ex: Atualizar servidor..." 
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 block">Início</label>
                  <Input 
                    type="datetime-local" 
                    value={newTask.start_time}
                    onChange={(e) => setNewTask({...newTask, start_time: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 block">Fim</label>
                  <Input 
                    type="datetime-local" 
                    value={newTask.end_time}
                    onChange={(e) => setNewTask({...newTask, end_time: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 block">Prioridade</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-bold" disabled={mutation.isPending}>
                {mutation.isPending ? "A guardar..." : "Salvar Tarefa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* DASHBOARD SUPERIOR: DESEMPENHO DIÁRIO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#1A1A1A]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Desempenho Diário ({progressPercentage}%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercentage} className="h-4 mt-2" />
            <p className="text-sm font-medium text-slate-400 mt-3">
              Concluíste {completedTasks} de {totalToday} tarefas programadas para hoje.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-white/10 shadow-sm bg-emerald-50 dark:bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Resumo Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-500">
              {tasks.filter((t: any) => t.status === "pendente").length}
            </div>
            <p className="text-sm font-medium text-emerald-600/70 dark:text-emerald-400/70 mt-1">
              Tarefas Pendentes Totais
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ÁREA PRINCIPAL: CALENDÁRIO E LISTA DE TAREFAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CALENDÁRIO INTERATIVO */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#1A1A1A] overflow-hidden">
          <CardContent className="p-4 h-[600px]">
            <style>{`
              .rbc-calendar { font-family: inherit; }
              .rbc-header { padding: 8px; font-weight: bold; }
              .dark .rbc-month-view, .dark .rbc-time-view, .dark .rbc-header { border-color: rgba(255,255,255,0.1); }
              .dark .rbc-day-bg { border-color: rgba(255,255,255,0.05); }
              .dark .rbc-off-range-bg { background: rgba(0,0,0,0.2); }
              .dark .rbc-today { background: rgba(16, 185, 129, 0.05); }
              .dark .rbc-time-content { border-color: rgba(255,255,255,0.1); }
            `}</style>
            
            <Calendar
              localizer={localizer}
              events={tasks}
              startAccessor="start"
              endAccessor="end"
              culture="pt-BR"
              style={{ height: "100%" }}
              eventPropGetter={eventStyleGetter}
              defaultView="week"
              views={["month", "week", "day"]}
              messages={{
                next: "Próximo",
                previous: "Anterior",
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
                noEventsInRange: "Não há tarefas para este período.",
              }}
            />
          </CardContent>
        </Card>

        {/* LISTA DE TAREFAS DETALHADA */}
        <Card className="border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-[#1A1A1A] flex flex-col max-h-[635px]">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Cronograma de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto custom-scrollbar">
            <div className="space-y-4">
              {todayTasks.length > 0 ? (
                todayTasks.map((task: any) => (
                  <div 
                    key={task.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      task.status === "concluida" 
                        ? "bg-slate-50 border-slate-200 opacity-60 dark:bg-white/5 dark:border-white/5" 
                        : task.priority === "alta" 
                          ? "bg-red-50/50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 shadow-sm ring-1 ring-red-500/10" 
                          : "bg-white border-slate-200 dark:bg-[#222222] dark:border-white/10"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-bold text-sm ${task.status === "concluida" ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                        {task.title}
                      </h3>
                      <Badge variant={task.status === "concluida" ? "secondary" : task.priority === "alta" ? "destructive" : "default"}>
                        {task.priority}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" />
                      {format(task.start, "HH:mm")} - {format(task.end, "HH:mm")}
                    </div>
                    
                    {task.status === "pendente" && task.priority === "alta" && (
                      <div className="mt-3 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Atenção Requerida
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-sm font-medium text-slate-500 p-6 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                  Nenhuma tarefa programada para hoje. O teu dia está livre! 🎉
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
