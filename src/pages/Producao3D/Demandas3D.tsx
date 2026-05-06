import React, { useState, useMemo } from "react";
import {
  useStore,
  formatMinutes,
  priorityColor,
  statusColor,
  STATUS_FLOW,
  type Priority,
  type DemandStatus,
  type Demand,
  type Part,
} from "../../contexts/Store3DContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, ArrowRight, Trash2, Hash, User, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Urgente"];

function PartPicker({ parts, value, onChange }: { parts: Part[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = parts.filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar peça por nome ou código" className="pl-8 h-9" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
        {filtered.map((p) => {
          const selected = value === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => onChange(p.id)}
              className={cn(
                "relative text-left rounded-lg border bg-card overflow-hidden transition-all hover:shadow-md",
                selected ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border/60"
              )}
            >
              <div className="aspect-square bg-muted overflow-hidden">
                <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              {selected && (
                <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white rounded-full p-1 shadow">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-semibold leading-tight line-clamp-1">{p.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.code}</p>
                {p.description && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{p.material}</Badge>
                  <span className="text-[10px] text-muted-foreground">{formatMinutes(p.productionMinutes)}</span>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-xs text-muted-foreground py-6">Nenhuma peça encontrada</p>
        )}
      </div>
    </div>
  );
}

function NewDemandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { parts, addDemand } = useStore();
  const [partId, setPartId] = useState(parts[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [opNumber, setOpNumber] = useState("");
  const [priority, setPriority] = useState<Priority>("Média");
  const [requester, setRequester] = useState("");
  const [notes, setNotes] = useState("");

  const part = parts.find((p) => p.id === partId);
  const estimated = part ? part.productionMinutes * quantity : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label className="mb-2 block">Selecione a peça</Label>
            <PartPicker parts={parts} value={partId} onChange={setPartId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} />
            </div>
            <div>
              <Label>Nº OP</Label>
              <Input value={opNumber} onChange={(e) => setOpNumber(e.target.value)} placeholder="OP-XXXX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Solicitante</Label>
              <Input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Setor / nome" />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Card className="bg-slate-50 dark:bg-white/5 border-slate-200">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">Tempo estimado:</span>
              <span className="font-semibold tabular-nums">{formatMinutes(estimated)}</span>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => {
            if (!partId || !opNumber || !requester) { toast.error("Preencha peça, OP e solicitante"); return; }
            addDemand({ partId, quantity, opNumber, priority, requester, notes });
            toast.success("Demanda criada");
            onOpenChange(false);
          }}>Criar demanda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DemandCard({ demand }: { demand: Demand }) {
  const { parts, updateDemandStatus, deleteDemand } = useStore();
  const part = parts.find((p) => p.id === demand.partId);
  const idx = STATUS_FLOW.indexOf(demand.status);
  const next = STATUS_FLOW[idx + 1];
  const estimated = part ? part.productionMinutes * demand.quantity : 0;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: demand.id });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "border-border/60 hover:shadow-md transition-shadow touch-none bg-white dark:bg-[#1A1A1A]",
        isDragging && "opacity-40"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {part && (
              <img src={part.image} alt={part.name} className="w-10 h-10 rounded object-cover border border-border/60 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />{demand.opNumber}
              </div>
              <h4 className="font-semibold truncate mt-0.5">{part?.name ?? "—"}</h4>
              <p className="text-xs text-muted-foreground font-mono">{part?.code}</p>
            </div>
          </div>
          <Badge className={priorityColor[demand.priority]} variant="outline">{demand.priority}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Qtde: <span className="text-foreground font-medium">{demand.quantity}</span></div>
          <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatMinutes(estimated)}</div>
          <div className="flex items-center gap-1 col-span-2"><User className="h-3 w-3" />{demand.requester}</div>
        </div>

        {demand.notes && <p className="text-xs text-muted-foreground border-l-2 border-emerald-500 pl-2 line-clamp-2">{demand.notes}</p>}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">{format(new Date(demand.createdAt), "dd/MM HH:mm")}</span>
          <div className="flex gap-1">
            {next && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { updateDemandStatus(demand.id, next); toast.success(`Movido para ${next}`); }}>
                {next} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => deleteDemand(demand.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanColumn({ status, items }: { status: DemandStatus; items: Demand[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between px-1">
        <Badge className={statusColor[status]} variant="outline">{status}</Badge>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-3 rounded-xl p-2 min-h-[200px] border transition-colors",
          isOver ? "bg-emerald-500/10 border-emerald-500/50" : "bg-slate-50/50 dark:bg-white/5 border-border/40"
        )}
      >
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">Solte aqui</div>
        ) : items.map((d) => <DemandCard key={d.id} demand={d} />)}
      </div>
    </div>
  );
}

export default function Demandas3D() {
  const { demands, updateDemandStatus } = useStore();
  const [creating, setCreating] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(
    () => demands.filter((d) => priorityFilter === "all" || d.priority === priorityFilter),
    [demands, priorityFilter]
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as DemandStatus;
    const demand = demands.find((d) => d.id === active.id);
    if (!demand || demand.status === newStatus) return;
    updateDemandStatus(demand.id, newStatus);
    toast.success(`Movido para ${newStatus}`);
  };

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Demandas</h1>
          <p className="text-sm text-muted-foreground mt-1">Arraste os cartões entre as colunas para atualizar o status</p>
        </div>
        <div className="flex gap-2">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px] bg-white dark:bg-black/20"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-1" /> Nova demanda
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_FLOW.map((status) => (
            <KanbanColumn key={status} status={status} items={filtered.filter((d) => d.status === status)} />
          ))}
        </div>
      </DndContext>

      {creating && <NewDemandDialog open={creating} onOpenChange={setCreating} />}
    </div>
  );
}