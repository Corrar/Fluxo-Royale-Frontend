import React, { useState, useMemo } from "react";
// Importamos o nosso "Cérebro" do Módulo 3D
import { useStore, formatMinutes, type Material, type Part } from "../../contexts/Store3DContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, Clock, Layers, Package } from "lucide-react";
import { toast } from "sonner"; // Ou use o useToast() do seu projeto, se preferir

const MATERIALS: Material[] = ["PLA", "ABS", "PETG", "TPU", "Nylon"];
const PLACEHOLDER = "https://images.unsplash.com/photo-1581090700227-1e37b190418e?w=600&q=80&auto=format&fit=crop";

function PartFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Part;
  onSubmit: (p: Omit<Part, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<Part, "id">>(
    initial ?? { code: "", name: "", image: PLACEHOLDER, productionMinutes: 60, filamentGrams: 30, material: "PLA", description: "" }
  );

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar peça" : "Nova peça"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>Material</Label>
              <Select value={form.material} onValueChange={(v) => setForm({ ...form, material: v as Material })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tempo (min)</Label>
              <Input type="number" min={1} value={form.productionMinutes} onChange={(e) => setForm({ ...form, productionMinutes: +e.target.value })} />
            </div>
            <div>
              <Label>Filamento (g)</Label>
              <Input type="number" min={1} value={form.filamentGrams} onChange={(e) => setForm({ ...form, filamentGrams: +e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Imagem</Label>
            <Input type="file" accept="image/*" onChange={handleImage} />
            {form.image && <img src={form.image} alt="" className="mt-2 h-24 w-24 rounded-lg object-cover border border-border" />}
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => {
            if (!form.code || !form.name) { toast.error("Código e nome são obrigatórios"); return; }
            onSubmit(form);
            onOpenChange(false);
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Catalogo3D() {
  const { parts, addPart, updatePart, deletePart } = useStore();
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      const matchSearch = (p.name + p.code).toLowerCase().includes(search.toLowerCase());
      const matchMat = materialFilter === "all" || p.material === materialFilter;
      return matchSearch && matchMat;
    });
  }, [parts, search, materialFilter]);

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Catálogo de peças</h1>
          <p className="text-sm text-muted-foreground mt-1">{parts.length} peças cadastradas</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Nova peça
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-white dark:bg-black/20" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={materialFilter} onValueChange={setMaterialFilter}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-black/20"><SelectValue placeholder="Material" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos materiais</SelectItem>
            {MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border bg-transparent">
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma peça encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <Card key={p.id} className="border-border/60 overflow-hidden group hover:shadow-md transition-all bg-white dark:bg-[#1A1A1A]">
              <div className="aspect-video bg-muted overflow-hidden">
                <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                    <h3 className="font-semibold truncate text-slate-800 dark:text-slate-100">{p.name}</h3>
                  </div>
                  <Badge variant="outline" className="shrink-0">{p.material}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {formatMinutes(p.productionMinutes)}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" /> {p.filamentGrams}g
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => { deletePart(p.id); toast.success("Peça removida"); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <PartFormDialog open={creating} onOpenChange={setCreating} onSubmit={(p) => { addPart(p); toast.success("Peça criada"); }} />
      )}
      {editing && (
        <PartFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} initial={editing} onSubmit={(p) => { updatePart(editing.id, p); toast.success("Peça atualizada"); setEditing(null); }} />
      )}
    </div>
  );
}