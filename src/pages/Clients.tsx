import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

import { 
  Users, ClipboardList, CheckCircle2, Search, Download, FileText, 
  UserPlus, Check, X, Pencil, Trash2, ChevronDown, Plus, Timer, Briefcase,
  ArrowRightLeft
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================================
// TIPOS E MAPAS DE STATUS
// ============================================================================
type FilterMode = "all" | "with-ops" | "without-ops";
type TaskStatus = "progress" | "done";

const dbToUiStatus: Record<string, TaskStatus> = {
  'pendente': 'progress', 
  'em_andamento': 'progress', 
  'concluido': 'done',
  'finalizada': 'done',
  'encerrada': 'done'
};

const uiToDbStatus: Record<TaskStatus, string> = {
  'progress': 'em_andamento', 
  'done': 'finalizada'
};

const statusConfig: Record<TaskStatus, { label: string; dot: string; pill: string }> = {
  progress: {
    label: "Em andamento",
    dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]",
    pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  },
  done: {
    label: "Finalizada",
    dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  },
};

// ============================================================================
// 1. COMPONENTE: ClientForm (Formulário para adicionar clientes)
// ============================================================================
function ClientForm({ existingIds, onAdd, isPending }: { existingIds: string[], onAdd: (id: string, name: string) => void, isPending: boolean }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = id.trim();
    const trimmedName = name.trim();
    if (!trimmedId || !trimmedName) {
      toast.error("Preencha ID e nome do cliente.");
      return;
    }
    if (existingIds.includes(trimmedId)) {
      toast.error("Já existe um cliente com este ID.");
      return;
    }
    onAdd(trimmedId, trimmedName);
    setId("");
    setName("");
  };

  return (
    <Card className="p-6 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-[1.5rem]">
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[160px_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="client-id" className="font-bold text-slate-700 dark:text-slate-300">ID do cliente</Label>
          <Input id="client-id" placeholder="Ex: 001" value={id} onChange={(e) => setId(e.target.value)} className="h-11 bg-white dark:bg-slate-950 dark:border-slate-800 font-medium" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-name" className="font-bold text-slate-700 dark:text-slate-300">Nome do cliente</Label>
          <Input id="client-name" placeholder="Ex: Indústria Alfa Ltda" value={name} onChange={(e) => setName(e.target.value)} className="h-11 bg-white dark:bg-slate-950 dark:border-slate-800 font-medium" />
        </div>
        <Button type="submit" disabled={isPending} className="md:w-auto h-11 px-6 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md">
          <UserPlus className="mr-2 h-4 w-4" strokeWidth={2.5} />
          {isPending ? "Adicionando..." : "Adicionar cliente"}
        </Button>
      </form>
    </Card>
  );
}

// ============================================================================
// 2. COMPONENTE: TaskItem (Item individual de OP)
// ============================================================================
function TaskItem({ task, onStatusChange, onRemove, onTransfer, canEdit, canDelete }: any) {
  const uiStatus = dbToUiStatus[task.status] || "progress";
  const cfg = statusConfig[uiStatus];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-4 hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-colors shadow-sm">
      
      {/* Topo: Info da OP */}
      <div className="flex items-start gap-3 w-full">
        <span className={cn("h-3 w-3 rounded-full shrink-0 mt-1.5", cfg.dot)} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-black text-slate-900 dark:text-slate-100 leading-snug break-words">
            OP {task.op_code}
          </p>
          <span className={cn("inline-block mt-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm", cfg.pill)}>
            {cfg.label}
          </span>
        </div>
      </div>
      
      {/* Base: Ações - Só exibe a borda superior se alguma das permissões for verdadeira */}
      {(canEdit || canDelete) && (
        <div className="flex flex-wrap items-center justify-between gap-2 w-full pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Apenas quem pode editar pode mudar o status da OP */}
          {canEdit && (
            <div className="flex-1">
              <Select value={uiStatus} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
                <SelectTrigger className="h-9 w-full font-bold text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="progress" className="font-bold text-blue-600 dark:text-blue-400">Em andamento</SelectItem>
                  <SelectItem value="done" className="font-bold text-emerald-600 dark:text-emerald-400">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Apenas quem pode editar pode transferir OP */}
            {canEdit && (
              <Button
                type="button" variant="ghost" size="icon" 
                className="h-9 w-9 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 rounded-full shrink-0"
                title="Transferir Movimentações desta OP para outra"
                onClick={() => onTransfer(task)}
              >
                <ArrowRightLeft className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            )}
            
            {/* Apenas quem pode excluir pode apagar OP */}
            {canDelete && (
              <Button
                type="button" variant="ghost" size="icon" 
                className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 rounded-full shrink-0"
                title="Excluir OP"
                onClick={() => { if(window.confirm("Tem a certeza que deseja remover esta OP? Lembre-se que ela não pode ter pedidos atrelados.")) onRemove(); }}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ============================================================================
// 3. COMPONENTE: ClientCard (Cartão Principal do Cliente)
// ============================================================================
function ClientCard({ client, onAddTask, onUpdateTaskStatus, onRemoveTask, onRemoveClient, onRenameClient, onTransferStart, canAdd, canEdit, canDelete }: any) {
  const [op, setOp] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(client.name);
  const [expanded, setExpanded] = useState(false);

  const tasks = Array.isArray(client.services) ? client.services : [];

  const startEdit = () => { setNameDraft(client.name); setIsEditing(true); };
  const cancelEdit = () => { setNameDraft(client.name); setIsEditing(false); };

  const saveEdit = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) { toast.error("Informe um nome válido."); return; }
    if (trimmed !== client.name) onRenameClient(trimmed);
    setIsEditing(false);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = op.trim();
    if (!trimmed) { toast.error("Informe o número da OP."); return; }
    if (tasks.some((t: any) => t.op_code === trimmed)) { toast.error("Esta OP já existe para este cliente."); return; }
    onAddTask(trimmed);
    setOp("");
  };

  const total = tasks.length;
  const done = tasks.filter((t: any) => dbToUiStatus[t.status] === "done").length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow rounded-[1.5rem]">
      <div
        role="button" tabIndex={0}
        onClick={() => { if (!isEditing) setExpanded((v) => !v); }}
        className={cn(
          "flex items-start justify-between gap-3 px-6 py-5 cursor-pointer select-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
          expanded && "border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100/50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20">
              ID {client.code}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              {done}/{total} finalizadas
            </span>
          </div>
          {isEditing ? (
            <div className="mt-2 flex flex-wrap sm:flex-nowrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Input
                autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                className="h-9 w-full sm:w-auto flex-1 bg-white dark:bg-slate-950 dark:border-slate-800 font-bold dark:text-slate-100"
              />
              <div className="flex gap-2">
                <Button size="icon" className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700" onClick={saveEdit}>
                  <Check className="h-4 w-4" strokeWidth={3} />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400" onClick={cancelEdit}>
                  <X className="h-4 w-4" strokeWidth={3} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 truncate leading-tight tracking-tight">
                {client.name}
              </h3>
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 shrink-0" onClick={(e) => { e.stopPropagation(); startEdit(); }}>
                  <Pencil className="h-4 w-4" strokeWidth={2.5} />
                </Button>
              )}
            </div>
          )}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:text-slate-500">Progresso</span>
              <span className="font-black text-xs text-slate-700 dark:text-slate-300">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-100 dark:bg-slate-800" />
          </div>

        </div>
        <div className="flex items-center gap-1">
          {canDelete && (
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); if(window.confirm("Remover cliente? Isso apagará todas as OPs dele que não possuam vínculos.")) onRemoveClient(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform duration-300 shrink-0", expanded && "rotate-180")} />
        </div>
      </div>

      {expanded && (
      <div className="space-y-4 p-4 sm:p-6 animate-in slide-in-from-top-2 fade-in duration-300 bg-slate-50/30 dark:bg-slate-900/50">
        {canAdd && (
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-2">
            <div className="relative flex-1">
               <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input placeholder="Adicionar nova OP..." value={op} onChange={(e) => setOp(e.target.value)} className="pl-9 h-11 bg-white dark:bg-slate-950 dark:border-slate-800 font-bold dark:text-slate-100" />
            </div>
            <Button type="submit" className="w-full sm:w-auto h-11 px-5 font-black bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md rounded-xl shrink-0">
              <Plus className="mr-2 h-4 w-4" strokeWidth={3} /> Nova OP
            </Button>
          </form>
        )}

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
            <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
            <span className="font-bold text-sm">Sem OPs registadas</span>
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task: any) => (
              <li key={task.id}>
                <TaskItem
                  task={task}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onStatusChange={(status: TaskStatus) => onUpdateTaskStatus(task.id, status)}
                  onRemove={() => onRemoveTask(task.id)}
                  onTransfer={(taskObj: any) => onTransferStart(taskObj, client.name)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </Card>
  );
}

// ============================================================================
// COMPONENTE SECUNDÁRIO: StatCard
// ============================================================================
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// 4. PÁGINA PRINCIPAL
// ============================================================================
export default function Clients() {
  const { canAccess } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  // DEFINIÇÃO DAS PERMISSÕES GRANULARES
  const canAdd = canAccess("clientes:add");
  const canEdit = canAccess("clientes:edit");
  const canDelete = canAccess("clientes:delete");

  // Estado para o modal de transferência
  const [transferOp, setTransferOp] = useState<{from: any, clientName: string} | null>(null);
  const [targetOpId, setTargetOpId] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const response = await api.get("/clients");
      return response.data.map((c: any) => ({
        ...c,
        services: Array.isArray(c.services) ? c.services : (typeof c.services === 'string' ? JSON.parse(c.services) : [])
      }));
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: {code: string, name: string}) => await api.post("/clients", data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["clients"] }); 
      setSearch("");
      toast.success("Cliente cadastrado!"); 
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar cliente."),
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, name }: {id: string, name: string}) => await api.put(`/clients/${id}`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente renomeado!"); },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao atualizar cliente."),
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/clients/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cliente excluído."); },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Erro ao excluir. O cliente possui OPs vinculadas que devem ser removidas primeiro.";
      toast.error(msg);
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async ({ clientId, op_code }: any) => await api.post(`/clients/${clientId}/services`, { op_code, description: "" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success("OP adicionada."); },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar OP."),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ serviceId, status }: any) => await api.patch(`/clients/services/${serviceId}/status`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success("Status atualizado!"); },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao atualizar status."),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => await api.delete(`/clients/services/${serviceId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["clients"] }); toast.success("OP removida."); },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Acesso Negado: Esta OP já possui solicitações vinculadas. Use o botão de transferir primeiro.";
      toast.error(msg);
    },
  });

  // Mutação para transferir a OP
  const transferServiceMutation = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string, toId: string }) => 
      await api.post(`/clients/services/${fromId}/transfer`, { targetServiceId: toId }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["clients"] }); 
      toast.success("Movimentações transferidas! A OP antiga já pode ser excluída."); 
      setTransferOp(null);
      setTargetOpId("");
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao transferir OP."),
  });

  const handleTransferSubmit = () => {
    if (!targetOpId) return toast.error("Selecione a OP de destino.");
    if (!transferOp) return;
    transferServiceMutation.mutate({ fromId: transferOp.from.id, toId: targetOpId });
  };

  const handleExportCsv = () => {
    if (clients.length === 0) return toast.error("Sem dados.");
    const wb = XLSX.utils.book_new();
    const data = clients.flatMap((c: any) => 
      c.services?.length > 0 
        ? c.services.map((s: any) => ({ 'ID': c.code, 'Cliente': c.name, 'OP': s.op_code, 'Status': s.status }))
        : [{ 'ID': c.code, 'Cliente': c.name, 'OP': '-', 'Status': '-' }]
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "OPs");
    XLSX.writeFile(wb, "Clientes_OPs.csv");
  };

  const handleExportPdf = () => {
    if (clients.length === 0) return toast.error("Sem dados.");
    const doc = new jsPDF();
    const tableData = clients.flatMap((c: any) => 
      c.services?.length > 0 
        ? c.services.map((s: any) => [c.code, c.name, s.op_code, s.status])
        : [[c.code, c.name, '-', '-']]
    );
    autoTable(doc, { head: [['ID', 'Cliente', 'OP', 'Status']], body: tableData });
    doc.save("Clientes_OPs.pdf");
  };

  const stats = useMemo(() => {
    const totalTasks = clients.reduce((sum: number, c: any) => sum + (c.services?.length || 0), 0);
    const doneTasks = clients.reduce((sum: number, c: any) => sum + (c.services?.filter((t: any) => dbToUiStatus[t.status] === "done").length || 0), 0);
    return { totalClients: clients.length, totalTasks, doneTasks };
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c: any) => {
      const tasks = c.services || [];
      if (filter === "with-ops" && tasks.length === 0) return false;
      if (filter === "without-ops" && tasks.length > 0) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        String(c.code).toLowerCase().includes(q) ||
        tasks.some((t: any) => t.op_code.toLowerCase().includes(q))
      );
    });
  }, [clients, search, filter]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 pb-24 selection:bg-blue-500/30">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="container py-8 px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-[40px] font-black tracking-tighter text-slate-900 dark:text-slate-100 flex items-center gap-3 leading-none">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-500" strokeWidth={3} />
                Painel de Clientes
              </h1>
              <p className="mt-3 text-sm md:text-base font-medium text-slate-500 dark:text-slate-400">
                Gestão de Clientes e Ordens de Produção (OP).
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="font-bold border-slate-200 dark:border-slate-700 dark:text-slate-300 h-11 px-5 rounded-xl" onClick={handleExportCsv}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" className="font-bold border-slate-200 dark:border-slate-700 dark:text-slate-300 h-11 px-5 rounded-xl" onClick={handleExportPdf}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard icon={<Users className="h-6 w-6" />} label="Clientes" value={stats.totalClients} />
            <StatCard icon={<ClipboardList className="h-6 w-6" />} label="OPs Totais" value={stats.totalTasks} />
            <StatCard icon={<CheckCircle2 className="h-6 w-6" />} label="OPs Finalizadas" value={stats.doneTasks} />
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 md:px-8 space-y-10">
        {canAdd && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="mb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Novo cliente
            </h2>
            <ClientForm 
              existingIds={clients.map((c: any) => String(c.code))}
              onAdd={(code, name) => createClientMutation.mutate({ code, name })}
              isPending={createClientMutation.isPending}
            />
          </section>
        )}

        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <span>Lista de Clientes</span>
            <span className="text-blue-600 bg-blue-100 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-200/50 dark:border-blue-500/20">
              {filteredClients.length} de {clients.length}
            </span>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 group">
              {/* O ERRO FOI CORRIGIDO AQUI: A variável e a função correta de estado são search e setSearch */}
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <Input
                placeholder="Buscar por nome, ID ou número da OP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-[1rem] focus:ring-2 focus:ring-blue-500/30 font-bold dark:text-slate-100"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
              <SelectTrigger className="sm:w-[220px] h-12 rounded-[1rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold dark:text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all" className="font-bold">Todos</SelectItem>
                <SelectItem value="with-ops" className="font-bold">Com OPs</SelectItem>
                <SelectItem value="without-ops" className="font-bold">Sem OPs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-20 text-center font-bold text-slate-400">
              <Timer className="h-8 w-8 mx-auto mb-3 animate-spin" />
              A carregar base de dados...
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredClients.map((client: any) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  canAdd={canAdd}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onAddTask={(op_code: string) => createServiceMutation.mutate({ clientId: client.id, op_code })}
                  onUpdateTaskStatus={(taskId: string, status: TaskStatus) => updateStatusMutation.mutate({ serviceId: taskId, status: uiToDbStatus[status] })}
                  onRemoveTask={(taskId: string) => deleteServiceMutation.mutate(taskId)}
                  onRemoveClient={() => deleteClientMutation.mutate(client.id)}
                  onRenameClient={(name: string) => updateClientMutation.mutate({ id: client.id, name })}
                  onTransferStart={(taskObj: any, clientName: string) => setTransferOp({ from: taskObj, clientName })}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* MODAL DE TRANSFERÊNCIA DE OP */}
      <Dialog 
        open={!!transferOp} 
        onOpenChange={(open) => {
          if (!open) {
            setTransferOp(null);
            setTargetOpId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[1.5rem] border-0 shadow-xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-amber-500" /> Transferir OP
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
              Isto irá redirecionar todos os pedidos atrelados à OP <b className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1 rounded">{transferOp?.from.op_code}</b> para a nova OP que escolheres abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700 dark:text-slate-300">OP de Destino</Label>
              <Select value={targetOpId} onValueChange={setTargetOpId}>
                <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold dark:text-slate-200">
                  <SelectValue placeholder="Procurar OP correta..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] dark:bg-slate-900 dark:border-slate-800">
                  {clients.map((c: any) => {
                    const ops = c.services?.filter((s: any) => {
                      const isDifferent = s.id !== transferOp?.from.id;
                      const isNotDone = dbToUiStatus[s.status] !== "done";
                      return isDifferent && isNotDone;
                    }) || [];
                    
                    if (ops.length === 0) return null;
                    
                    return (
                      <SelectGroup key={c.id}>
                        <SelectLabel className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 font-black tracking-widest text-[10px] uppercase">
                          {c.name}
                        </SelectLabel>
                        {ops.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)} className="font-bold">
                            OP {s.op_code}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 p-3 rounded-xl text-[13px] font-medium leading-tight">
              <b>Dica:</b> Se a OP correta ainda não existir, cancela, cria-a no cliente correto e volta aqui para transferir os dados.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="font-bold border-slate-200 dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
            </DialogClose>
            <Button 
              type="button" 
              onClick={handleTransferSubmit} 
              disabled={transferServiceMutation.isPending || !targetOpId}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              {transferServiceMutation.isPending ? "A transferir..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
