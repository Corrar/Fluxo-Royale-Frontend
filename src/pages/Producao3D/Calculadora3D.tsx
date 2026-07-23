import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { brl, num, computeCost, Config3D, Filament3D, Printer3D } from "@/lib/cost3d";

export default function Calculadora3D() {
  const qc = useQueryClient();
  const { data: config } = useQuery<Config3D>({ queryKey: ["config-3d"], queryFn: async () => (await api.get("/producao-3d/config")).data });
  const { data: filaments = [] } = useQuery<Filament3D[]>({ queryKey: ["filaments-3d"], queryFn: async () => (await api.get("/producao-3d/filaments")).data });
  const { data: printers = [] } = useQuery<Printer3D[]>({ queryKey: ["printers-3d"], queryFn: async () => (await api.get("/producao-3d/printers")).data });

  const [f, setF] = useState({
    horas: "", minutos: "", peso: "", unidade: "g", pecasMesa: "1",
    minAcabamento: "", quantidade: "1", filamentId: "", printerId: "",
    nome: "", sku: "",
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  // Repõe seleção quando as listas carregam
  React.useEffect(() => {
    setF((v) => ({
      ...v,
      filamentId: v.filamentId || (filaments[0]?.id || ""),
      printerId: v.printerId || (printers[0]?.id || ""),
    }));
  }, [filaments, printers]);

  const fil = filaments.find((x) => x.id === f.filamentId) || null;
  const prt = printers.find((x) => x.id === f.printerId) || null;

  const calc = useMemo(() => {
    const horasTotais = num(f.horas) + num(f.minutos) / 60;
    const gramasBase = f.unidade === "kg" ? num(f.peso) * 1000 : num(f.peso);
    const nMesa = Math.max(1, Math.round(num(f.pecasMesa)) || 1);
    const gramasUnit = gramasBase / nMesa;
    const minutesUnit = (horasTotais * 60) / nMesa;
    const piece = { filament_grams: gramasUnit, production_minutes: minutesUnit, finishing_minutes: num(f.minAcabamento) };
    const c = computeCost(piece, fil, prt, config || {} as Config3D);
    return { ...c, horasTotais, gramasBase, nMesa, gramasUnit, minutesUnit, piece };
  }, [f, fil, prt, config]);

  const qtd = num(f.quantidade) || 1;
  const temDados = calc.horasTotais > 0 || calc.gramasBase > 0;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!f.nome.trim()) throw new Error("Informe o nome da peça.");
      if (!f.sku.trim()) throw new Error("Informe o SKU da peça.");
      // 1) cria o produto 3D reutilizando o cadastro padrão do catálogo
      const created = await api.post("/products", {
        sku: f.sku.trim(), name: f.nome.trim(), unit: "un", min_stock: 0,
        is_3d: true, filament_grams: calc.gramasUnit, production_minutes: calc.minutesUnit,
        unit_price: calc.custoTotal, sales_price: calc.precoVenda,
      });
      const id = created.data?.id;
      // 2) vincula filamento/impressora/acabamento (precificação)
      if (id) {
        await api.put(`/producao-3d/costing/${id}`, {
          filament_id: f.filamentId || null, printer_id: f.printerId || null,
          finishing_minutes: num(f.minAcabamento),
        });
      }
    },
    onSuccess: () => {
      toast.success("Peça salva no catálogo com o preço calculado!");
      qc.invalidateQueries({ queryKey: ["costing-3d"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      setF({ ...f, nome: "", sku: "" });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.message || "Erro ao salvar peça."),
  });

  const Row = ({ label, valor, detalhe }: any) => (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-100 dark:border-white/5">
      <div><span className="text-[13px] text-slate-700 dark:text-slate-200">{label}</span>{detalhe && <div className="text-[11px] text-slate-400 mt-0.5">{detalhe}</div>}</div>
      <span className="font-mono text-[13px] text-slate-900 dark:text-white whitespace-nowrap ml-3">{brl(valor)}</span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Calculator className="h-7 w-7 text-indigo-500" /> Calculadora de Custo
        </h1>
        <p className="text-sm text-slate-500 mt-1">Digite o tempo e o peso da mesa. O custo e o preço de venda aparecem na hora.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* ENTRADAS */}
        <Card className="rounded-2xl"><CardContent className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Tempo da mesa — horas</Label><Input className="h-11 rounded-xl font-mono" value={f.horas} onChange={set("horas")} placeholder="2" /></div>
            <div><Label className="text-xs">Tempo da mesa — min</Label><Input className="h-11 rounded-xl font-mono" value={f.minutos} onChange={set("minutos")} placeholder="35" /></div>
            <div><Label className="text-xs">Peso da mesa</Label><Input className="h-11 rounded-xl font-mono" value={f.peso} onChange={set("peso")} placeholder="42" /></div>
            <div><Label className="text-xs">Unidade</Label>
              <Select value={f.unidade} onValueChange={(v) => setF({ ...f, unidade: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="g">gramas (g)</SelectItem><SelectItem value="kg">quilos (kg)</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Filamento</Label>
              <Select value={f.filamentId} onValueChange={(v) => setF({ ...f, filamentId: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{filaments.map((x) => <SelectItem key={x.id} value={x.id!}>{x.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Impressora</Label>
              <Select value={f.printerId} onValueChange={(v) => setF({ ...f, printerId: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{printers.map((x) => <SelectItem key={x.id} value={x.id!}>{x.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Peças na mesa</Label><Input className="h-11 rounded-xl font-mono" value={f.pecasMesa} onChange={set("pecasMesa")} placeholder="1" /></div>
            <div><Label className="text-xs">Acabamento (min/peça)</Label><Input className="h-11 rounded-xl font-mono" value={f.minAcabamento} onChange={set("minAcabamento")} placeholder="0" /></div>
            <div><Label className="text-xs">Quantidade</Label><Input className="h-11 rounded-xl font-mono" value={f.quantidade} onChange={set("quantidade")} placeholder="1" /></div>
          </div>

          {temDados && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Mesa: <b className="font-mono">{calc.horasTotais.toFixed(2)} h</b> · <b className="font-mono">{calc.gramasReais.toFixed(1)} g</b> <span className="text-slate-400">(com perda de {num(config?.perda_perc)}% · {calc.nMesa > 1 ? `${calc.nMesa} na mesa` : "1 na mesa"})</span>
              {calc.nMesa > 1 && <><br />Por peça: <b className="font-mono">{(calc.minutesUnit / 60).toFixed(3)} h</b> · <b className="font-mono">{calc.gramasUnit.toFixed(2)} g</b></>}
            </div>
          )}

          {/* Salvar como peça */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <Label className="text-xs flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Salvar este cálculo como peça no catálogo</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input className="h-10 rounded-xl" value={f.nome} onChange={set("nome")} placeholder="Nome da peça" />
              <Input className="h-10 rounded-xl font-mono" value={f.sku} onChange={set("sku")} placeholder="SKU (ex.: 5.03.099)" />
            </div>
            <Button className="w-full mt-2 h-10 rounded-xl" disabled={salvar.isPending || !temDados} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Salvar peça</>}
            </Button>
          </div>
        </CardContent></Card>

        {/* RESULTADO */}
        <Card className="rounded-2xl border-t-4 border-t-amber-400"><CardContent className="p-5">
          <h2 className="text-base font-black text-slate-900 dark:text-white mb-3">Resultado</h2>
          {!temDados ? (
            <p className="text-sm text-slate-500">Informe tempo e peso para ver a soma.</p>
          ) : (
            <>
              <Row label="Material" valor={calc.custoFilamento} detalhe={`${calc.gramasReais.toFixed(1)} g (mesa) × ${fil ? brl(num(fil.preco_kg) / 1000) : "—"}/g`} />
              <Row label="Energia elétrica" valor={calc.custoEnergia} detalhe={`${calc.horasTotais.toFixed(2)} h × ${prt ? num(prt.potencia_w) : 0} W`} />
              <Row label="Depreciação" valor={calc.custoDepreciacao} detalhe="rateio por hora de máquina" />
              <Row label="Manutenção" valor={calc.custoManutencao} detalhe="rateio por hora de uso" />
              {num(f.minAcabamento) > 0 && <Row label="Acabamento" valor={calc.custoAcabamento} detalhe={`${num(f.minAcabamento)} min × ${brl(num(config?.mao_obra_hora))}/h`} />}

              <div className="mt-4 rounded-xl bg-slate-900 dark:bg-black/40 text-white p-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">Custo por peça</span>
                  <span className="font-mono text-2xl text-amber-400 font-semibold">{brl(calc.custoTotal)}</span>
                </div>
                {qtd > 1 && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-white/10 text-[12px]">
                    <span>Total de {qtd} unidades</span><span className="font-mono font-semibold">{brl(calc.custoTotal * qtd)}</span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <Row label="Preço de venda sugerido" valor={calc.precoVenda} detalhe={`Margem ${num(config?.margem_perc)}% + imposto ${num(config?.imposto_perc)}%`} />
                <Row label="Lucro por unidade" valor={calc.lucro} />
              </div>

              {qtd > 1 && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border-l-4 border-emerald-500 flex justify-between text-[13px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Venda total ({qtd} un.)</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{brl(calc.precoVenda * qtd)}</span>
                </div>
              )}
            </>
          )}
        </CardContent></Card>
      </div>
    </div>
  );
}
