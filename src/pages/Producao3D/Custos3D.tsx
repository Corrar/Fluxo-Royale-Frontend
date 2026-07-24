import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Boxes, Printer, Percent, Layers, Plus, Trash2, Pencil, Save, X,
  DollarSign, FileText, Loader2, Search,
} from "lucide-react";
import { toast } from "sonner";
import { brl, num, computeCost, Config3D, Filament3D, Printer3D } from "@/lib/cost3d";

const formatMinutes = (m: number) => {
  const t = num(m);
  if (!t) return "0min";
  const h = Math.floor(t / 60);
  const min = Math.round(t % 60);
  return h > 0 ? `${h}h ${min}min` : `${min}min`;
};

// Abre uma janela limpa e imprime o orçamento (não afeta o layout da app)
const printHtml = (html: string) => {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) { toast.error("Permita pop-ups para imprimir o orçamento."); return; }
  w.document.write(`<html><head><title>Orçamento — Fábrica 3D</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;padding:32px;max-width:720px;margin:0 auto}
      h1{font-size:20px;margin:0 0 2px} .sub{color:#666;font-size:12px;margin:0 0 20px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin:14px 0}
      th{background:#0d1c5e;color:#fff;text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase}
      td{padding:8px 10px;border-bottom:1px solid #eee} .r{text-align:right}
      .tot{background:#f6f3ea;font-weight:700} .green{color:#2e7d32}
      .box{background:#0d1c5e;color:#fff;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:16px}
      .box .v{font-size:24px;color:#f0b429;font-weight:600}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:16px}
      .lbl{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.05em}
    </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 300);
};

export default function Custos3D() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("precos");

  const { data: config } = useQuery<Config3D>({ queryKey: ["config-3d"], queryFn: async () => (await api.get("/producao-3d/config")).data });
  const { data: filaments = [], isLoading: lf } = useQuery<Filament3D[]>({ queryKey: ["filaments-3d"], queryFn: async () => (await api.get("/producao-3d/filaments")).data });
  const { data: printers = [], isLoading: lp } = useQuery<Printer3D[]>({ queryKey: ["printers-3d"], queryFn: async () => (await api.get("/producao-3d/printers")).data });
  const { data: costing = [], isLoading: lc } = useQuery<any[]>({ queryKey: ["costing-3d"], queryFn: async () => (await api.get("/producao-3d/costing")).data });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["config-3d"] });
    qc.invalidateQueries({ queryKey: ["filaments-3d"] });
    qc.invalidateQueries({ queryKey: ["printers-3d"] });
    qc.invalidateQueries({ queryKey: ["costing-3d"] });
    qc.invalidateQueries({ queryKey: ["financial-3d"] });
    qc.invalidateQueries({ queryKey: ["products-active"] });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-emerald-500" /> Custos & Preços
        </h1>
        <p className="text-sm text-slate-500 mt-1">Custo real por peça, preço de venda sugerido e parâmetros da fábrica.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="precos" className="gap-1.5"><Boxes className="h-4 w-4" /> Precificação</TabsTrigger>
          <TabsTrigger value="filamentos" className="gap-1.5"><Layers className="h-4 w-4" /> Filamentos</TabsTrigger>
          <TabsTrigger value="impressoras" className="gap-1.5"><Printer className="h-4 w-4" /> Impressoras</TabsTrigger>
          <TabsTrigger value="parametros" className="gap-1.5"><Percent className="h-4 w-4" /> Parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="precos">
          <Precificacao costing={costing} loading={lc} filaments={filaments} printers={printers} config={config} onSaved={invalidateAll} />
        </TabsContent>
        <TabsContent value="filamentos">
          <Filamentos filaments={filaments} loading={lf} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="impressoras">
          <Impressoras printers={printers} loading={lp} config={config} onChanged={invalidateAll} />
        </TabsContent>
        <TabsContent value="parametros">
          <Parametros config={config} onChanged={invalidateAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================ PRECIFICAÇÃO ============================
function Precificacao({ costing, loading, filaments, printers, config, onSaved }: any) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [orcamento, setOrcamento] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (costing || []).filter((p: any) => !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [costing, search]);

  if (loading) return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>;

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Buscar peça ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-sm text-slate-500">Nenhuma peça 3D no catálogo. Cadastre peças no Catálogo ou pela Calculadora.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="text-left p-3">Peça</th>
                <th className="text-left p-3">Material / Máquina</th>
                <th className="text-right p-3">Peso · Tempo</th>
                <th className="text-right p-3">Custo</th>
                <th className="text-right p-3">Venda</th>
                <th className="text-right p-3">Lucro</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/[0.03]">
                  <td className="p-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</div>
                    <div className="text-[11px] font-mono text-slate-400">{p.sku}</div>
                  </td>
                  <td className="p-3 text-[12px] text-slate-500">
                    {p.filament_nome ? <>{p.filament_nome}{p.usando_filamento_padrao && <span className="text-amber-500 text-[10px]"> (padrão)</span>}</> : <span className="text-orange-500">sem filamento</span>}
                    <br />{p.printer_nome ? <>{p.printer_nome}{p.usando_impressora_padrao && <span className="text-amber-500 text-[10px]"> (padrão)</span>}</> : <span className="text-orange-500">sem impressora</span>}
                  </td>
                  <td className="p-3 text-right font-mono text-[12px] text-slate-500">
                    {num(p.filament_grams)}g · {formatMinutes(p.production_minutes)}
                  </td>
                  <td className="p-3 text-right font-mono">{brl(num(p.custo))}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{brl(num(p.preco_venda))}</td>
                  <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                    {brl(num(p.lucro))}
                    <div className="text-[10px] text-slate-400">{num(p.margem_real).toFixed(1)}%</div>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOrcamento(p)}><FileText className="h-3.5 w-3.5 mr-1" />Orçamento</Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditCosting peca={editing} filaments={filaments} printers={printers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />}
      {orcamento && <Orcamento peca={orcamento} filaments={filaments} printers={printers} config={config} onClose={() => setOrcamento(null)} />}
    </div>
  );
}

function EditCosting({ peca, filaments, printers, onClose, onSaved }: any) {
  const [f, setF] = useState({
    filament_id: peca.filament_id || "",
    printer_id: peca.printer_id || "",
    filament_grams: String(peca.filament_grams ?? ""),
    production_minutes: String(peca.production_minutes ?? ""),
    finishing_minutes: String(peca.finishing_minutes ?? "0"),
  });
  const m = useMutation({
    mutationFn: async () => api.put(`/producao-3d/costing/${peca.id}`, {
      filament_id: f.filament_id || null,
      printer_id: f.printer_id || null,
      filament_grams: num(f.filament_grams),
      production_minutes: num(f.production_minutes),
      finishing_minutes: num(f.finishing_minutes),
    }),
    onSuccess: () => { toast.success("Custos da peça atualizados."); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erro ao salvar."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogTitle>Custos — {peca.name}</DialogTitle>
        <div className="grid gap-4 mt-2">
          <div>
            <Label className="text-xs">Filamento</Label>
            <Select value={f.filament_id} onValueChange={(v) => setF({ ...f, filament_id: v })}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{filaments.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome} — {brl(num(x.preco_kg))}/kg</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Impressora</Label>
            <Select value={f.printer_id} onValueChange={(v) => setF({ ...f, printer_id: v })}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{printers.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Peso (g)</Label><Input className="h-10 rounded-xl" value={f.filament_grams} onChange={(e) => setF({ ...f, filament_grams: e.target.value })} /></div>
            <div><Label className="text-xs">Tempo (min)</Label><Input className="h-10 rounded-xl" value={f.production_minutes} onChange={(e) => setF({ ...f, production_minutes: e.target.value })} /></div>
            <div><Label className="text-xs">Acab. (min)</Label><Input className="h-10 rounded-xl" value={f.finishing_minutes} onChange={(e) => setF({ ...f, finishing_minutes: e.target.value })} /></div>
          </div>
          <Button className="w-full h-11 rounded-xl" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Salvar custos</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Orcamento({ peca, filaments, printers, config, onClose }: any) {
  const [qtd, setQtd] = useState("70");
  // fallback para o padrão (1º cadastrado) quando a peça não tem vínculo
  const fil = filaments.find((x: any) => x.id === peca.filament_id) || filaments[0];
  const prt = printers.find((x: any) => x.id === peca.printer_id) || printers[0];
  const c = computeCost(peca, fil, prt, config || {});
  const q = num(qtd) || 1;

  const linhas: [string, number][] = [
    ["Filamento", c.custoFilamento],
    ["Energia elétrica", c.custoEnergia],
    ["Depreciação da máquina", c.custoDepreciacao],
    ["Manutenção", c.custoManutencao],
    ["Acabamento (mão de obra)", c.custoAcabamento],
  ];

  const imprimir = () => {
    const rows = linhas.map(([nome, v]) => `<tr><td>${nome}</td><td class="r">${brl(v)}</td><td class="r">${brl(v * q)}</td></tr>`).join("");
    printHtml(`
      <h1>ORÇAMENTO / ORDEM DE PRODUÇÃO</h1>
      <p class="sub">Royale Equipamentos Avícolas — Fábrica 3D</p>
      <div class="meta">
        <div><div class="lbl">Peça</div>${peca.name}</div>
        <div><div class="lbl">SKU</div>${peca.sku || "—"}</div>
        <div><div class="lbl">Material</div>${fil?.nome || "—"}</div>
        <div><div class="lbl">Máquina</div>${prt?.nome || "—"}</div>
        <div><div class="lbl">Peso unitário</div>${num(peca.filament_grams)} g</div>
        <div><div class="lbl">Quantidade</div>${q} un.</div>
      </div>
      <table><thead><tr><th>Composição de custo</th><th class="r">Unitário</th><th class="r">Total (${q})</th></tr></thead>
        <tbody>${rows}
          <tr class="tot"><td>Custo total</td><td class="r">${brl(c.custoTotal)}</td><td class="r">${brl(c.custoTotal * q)}</td></tr>
          <tr><td>Impostos</td><td class="r">${brl(c.valorImposto)}</td><td class="r">${brl(c.valorImposto * q)}</td></tr>
          <tr class="green"><td>Lucro</td><td class="r">${brl(c.lucro)}</td><td class="r">${brl(c.lucro * q)}</td></tr>
        </tbody></table>
      <div class="box"><div><div class="lbl" style="color:#9aa4cc">Preço de venda</div>${brl(c.precoVenda)} / un.</div>
        <div style="text-align:right"><div class="lbl" style="color:#9aa4cc">Total do pedido</div><div class="v">${brl(c.precoVenda * q)}</div></div></div>
    `);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogTitle>Orçamento — {peca.name}</DialogTitle>
        <div className="mt-2">
          <div className="flex items-end gap-3 mb-4">
            <div><Label className="text-xs">Quantidade</Label><Input className="h-10 rounded-xl w-28" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {linhas.map(([nome, v]) => (
                  <tr key={nome} className="border-b border-slate-100 dark:border-white/5">
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{nome}</td>
                    <td className="p-2.5 text-right font-mono">{brl(v)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-400">{brl(v * q)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-white/5 font-bold"><td className="p-2.5">Custo total</td><td className="p-2.5 text-right font-mono">{brl(c.custoTotal)}</td><td className="p-2.5 text-right font-mono">{brl(c.custoTotal * q)}</td></tr>
                <tr className="text-emerald-600 dark:text-emerald-400"><td className="p-2.5">Lucro</td><td className="p-2.5 text-right font-mono">{brl(c.lucro)}</td><td className="p-2.5 text-right font-mono">{brl(c.lucro * q)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl bg-slate-900 dark:bg-black/40 text-white p-4 flex justify-between items-center">
            <div><div className="text-[10px] uppercase text-slate-400">Preço de venda</div><div className="font-mono text-sm">{brl(c.precoVenda)} / un.</div></div>
            <div className="text-right"><div className="text-[10px] uppercase text-slate-400">Total do pedido</div><div className="font-mono text-2xl text-amber-400 font-semibold">{brl(c.precoVenda * q)}</div></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button className="flex-1 h-11 rounded-xl" onClick={imprimir}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
            <Button variant="secondary" className="h-11 rounded-xl" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================ FILAMENTOS ============================
function Filamentos({ filaments, loading, onChanged }: any) {
  const vazio = { nome: "", marca: "", preco_kg: "", densidade: "", cor: "" };
  const [f, setF] = useState<any>(vazio);
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => editId ? api.put(`/producao-3d/filaments/${editId}`, f) : api.post("/producao-3d/filaments", f),
    onSuccess: () => { toast.success(editId ? "Filamento atualizado." : "Filamento adicionado."); setF(vazio); setEditId(null); onChanged(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erro ao salvar filamento."),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producao-3d/filaments/${id}`),
    onSuccess: () => { toast.success("Filamento excluído."); onChanged(); },
    onError: () => toast.error("Erro ao excluir."),
  });

  return (
    <div>
      <Card className="mb-5 rounded-2xl"><CardContent className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div><Label className="text-xs">Nome</Label><Input className="h-10 rounded-xl" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="PETG Royale" /></div>
          <div><Label className="text-xs">Marca</Label><Input className="h-10 rounded-xl" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} placeholder="Bambu Lab" /></div>
          <div><Label className="text-xs">Preço/kg (R$)</Label><Input className="h-10 rounded-xl" value={f.preco_kg} onChange={(e) => setF({ ...f, preco_kg: e.target.value })} placeholder="114" /></div>
          <div><Label className="text-xs">Densidade</Label><Input className="h-10 rounded-xl" value={f.densidade} onChange={(e) => setF({ ...f, densidade: e.target.value })} placeholder="1.27" /></div>
          <div><Label className="text-xs">Cor</Label><Input className="h-10 rounded-xl" value={f.cor} onChange={(e) => setF({ ...f, cor: e.target.value })} placeholder="Branco" /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="rounded-xl" disabled={save.isPending || !f.nome.trim()} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />{editId ? "Salvar" : "Adicionar"}</>}
          </Button>
          {editId && <Button variant="secondary" className="rounded-xl" onClick={() => { setEditId(null); setF(vazio); }}><X className="h-4 w-4 mr-1" />Cancelar</Button>}
        </div>
      </CardContent></Card>

      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="bg-slate-50 dark:bg-white/5 text-slate-500 text-[11px] uppercase"><th className="text-left p-3">Nome</th><th className="text-left p-3">Marca</th><th className="text-right p-3">Preço/kg</th><th className="text-right p-3">Densidade</th><th className="text-left p-3">Cor</th><th></th></tr></thead>
            <tbody>
              {filaments.map((x: any) => (
                <tr key={x.id} className="border-t border-slate-100 dark:border-white/5">
                  <td className="p-3 font-semibold">{x.nome}</td>
                  <td className="p-3 text-slate-500">{x.marca || "—"}</td>
                  <td className="p-3 text-right font-mono">{brl(num(x.preco_kg))}</td>
                  <td className="p-3 text-right font-mono text-slate-500">{x.densidade ?? "—"}</td>
                  <td className="p-3 text-slate-500">{x.cor || "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setEditId(x.id); setF({ nome: x.nome, marca: x.marca || "", preco_kg: String(x.preco_kg ?? ""), densidade: String(x.densidade ?? ""), cor: x.cor || "" }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-red-500" onClick={() => del.mutate(x.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================ IMPRESSORAS ============================
function Impressoras({ printers, loading, config, onChanged }: any) {
  const vazio = { nome: "", valor: "", vida_horas: "15000", potencia_w: "350", manutencao_ano: "", horas_ano: "4000" };
  const [f, setF] = useState<any>(vazio);
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => editId ? api.put(`/producao-3d/printers/${editId}`, f) : api.post("/producao-3d/printers", f),
    onSuccess: () => { toast.success(editId ? "Impressora atualizada." : "Impressora adicionada."); setF(vazio); setEditId(null); onChanged(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erro ao salvar impressora."),
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producao-3d/printers/${id}`),
    onSuccess: () => { toast.success("Impressora excluída."); onChanged(); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const custoHora = (x: any) => {
    const dep = num(x.valor) / (num(x.vida_horas) || 1);
    const man = num(x.manutencao_ano) / (num(x.horas_ano) || 1);
    const ene = (num(x.potencia_w) / 1000) * num(config?.energia_kwh);
    return dep + man + ene;
  };

  const campos: [string, string, string][] = [
    ["nome", "Nome", "H2S — Máquina 03"], ["valor", "Valor (R$)", "22000"], ["vida_horas", "Vida útil (h)", "15000"],
    ["potencia_w", "Potência (W)", "350"], ["manutencao_ano", "Manut./ano (R$)", "1800"], ["horas_ano", "Horas/ano", "4000"],
  ];

  return (
    <div>
      <Card className="mb-5 rounded-2xl"><CardContent className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {campos.map(([k, l, ph]) => (
            <div key={k}><Label className="text-xs">{l}</Label><Input className="h-10 rounded-xl" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} /></div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="rounded-xl" disabled={save.isPending || !f.nome.trim()} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />{editId ? "Salvar" : "Adicionar"}</>}
          </Button>
          {editId && <Button variant="secondary" className="rounded-xl" onClick={() => { setEditId(null); setF(vazio); }}><X className="h-4 w-4 mr-1" />Cancelar</Button>}
        </div>
      </CardContent></Card>

      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm min-w-[680px]">
            <thead><tr className="bg-slate-50 dark:bg-white/5 text-slate-500 text-[11px] uppercase"><th className="text-left p-3">Máquina</th><th className="text-right p-3">Valor</th><th className="text-right p-3">Vida (h)</th><th className="text-right p-3">Potência</th><th className="text-right p-3">Manut./ano</th><th className="text-right p-3">Custo/hora</th><th></th></tr></thead>
            <tbody>
              {printers.map((x: any) => (
                <tr key={x.id} className="border-t border-slate-100 dark:border-white/5">
                  <td className="p-3 font-semibold">{x.nome}</td>
                  <td className="p-3 text-right font-mono">{brl(num(x.valor))}</td>
                  <td className="p-3 text-right font-mono text-slate-500">{num(x.vida_horas)}</td>
                  <td className="p-3 text-right font-mono text-slate-500">{num(x.potencia_w)}W</td>
                  <td className="p-3 text-right font-mono text-slate-500">{brl(num(x.manutencao_ano))}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{brl(custoHora(x))}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setEditId(x.id); setF({ nome: x.nome, valor: String(x.valor ?? ""), vida_horas: String(x.vida_horas ?? ""), potencia_w: String(x.potencia_w ?? ""), manutencao_ano: String(x.manutencao_ano ?? ""), horas_ano: String(x.horas_ano ?? "") }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-red-500" onClick={() => del.mutate(x.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================ PARÂMETROS ============================
function Parametros({ config, onChanged }: any) {
  const [f, setF] = useState<any>(null);
  React.useEffect(() => { if (config && !f) setF({ energia_kwh: String(config.energia_kwh ?? ""), imposto_perc: String(config.imposto_perc ?? ""), margem_perc: String(config.margem_perc ?? ""), mao_obra_hora: String(config.mao_obra_hora ?? ""), perda_perc: String(config.perda_perc ?? "") }); }, [config]);

  const save = useMutation({
    mutationFn: async () => api.put("/producao-3d/config", f),
    onSuccess: () => { toast.success("Parâmetros salvos. Todos os preços foram recalculados."); onChanged(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erro ao salvar."),
  });

  if (!f) return <Skeleton className="h-48 w-full rounded-xl" />;

  const campos: [string, string, string][] = [
    ["energia_kwh", "Energia (R$/kWh)", "0.92"], ["imposto_perc", "Imposto (%)", "6"], ["margem_perc", "Margem de lucro (%)", "45"],
    ["mao_obra_hora", "Mão de obra (R$/h)", "28"], ["perda_perc", "Perda de filamento (%)", "5"],
  ];

  return (
    <Card className="rounded-2xl max-w-2xl"><CardContent className="p-6">
      <p className="text-sm text-slate-500 mb-5">Estes parâmetros valem para toda a fábrica e recalculam automaticamente o custo e o preço de todas as peças.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {campos.map(([k, l, ph]) => (
          <div key={k}><Label className="text-xs">{l}</Label><Input className="h-11 rounded-xl" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} /></div>
        ))}
      </div>
      <Button className="mt-6 h-11 rounded-xl" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Salvar parâmetros</>}
      </Button>
    </CardContent></Card>
  );
}
