import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, History, RefreshCw, Loader2, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Movement {
  id: number;
  product_id: string | null;
  on_hand_before: string; on_hand_after: string;
  reserved_before: string; reserved_after: string;
  on_hand_delta: string; reserved_delta: string;
  action: string;
  source: string | null;
  db_user: string | null;
  created_at: string;
  product_name: string | null;
  product_sku: string | null;
  product_unit: string | null;
  user_name: string | null;
}

// Rótulos amigáveis para cada ação registada pelo ledger
const ACTION_LABELS: Record<string, string> = {
  SOLICITACAO_RESERVA: "Solicitação — Reserva",
  SOLICITACAO_APROVACAO: "Solicitação — Aprovação",
  SOLICITACAO_ENTREGA: "Solicitação — Entrega",
  SOLICITACAO_REJEICAO: "Solicitação — Rejeição",
  SOLICITACAO_DEVOLUCAO: "Solicitação — Devolução",
  SOLICITACAO_DEVOLUCAO_PARCIAL: "Solicitação — Devolução Parcial",
  SOLICITACAO_CANCELAMENTO: "Solicitação — Cancelamento",
  SAIDA_MANUAL: "Saída Manual",
  ENTRADA_NFE: "Entrada NFe",
  ENTRADA_REAPROVEITAMENTO: "Entrada — Reaproveitamento",
  DEVOLUCAO_OP: "Devolução de OP",
  AJUSTE_MANUAL: "Ajuste Manual de Estoque",
  SEPARACAO_RESERVA: "Separação — Reserva",
  SEPARACAO_ENTREGA: "Separação — Entrega",
  SEPARACAO_EDICAO: "Separação — Edição",
  SEPARACAO_CANCELAMENTO: "Separação — Cancelamento",
  SEPARACAO_DEVOLUCAO: "Separação — Devolução",
  REPOSICAO_RESERVA: "Reposição — Reserva",
  REPOSICAO_ENTREGA: "Reposição — Entrega",
  REPOSICAO_REVERSAO: "Reposição — Reversão",
  REPOSICAO_EDICAO: "Reposição — Edição",
  REPOSICAO_CANCELAMENTO: "Reposição — Cancelamento",
  VIAGEM_RESERVA: "Viagem — Reserva",
  VIAGEM_ACERTO: "Viagem — Acerto",
  VIAGEM_EDICAO: "Viagem — Edição",
  VIAGEM_EXCLUSAO: "Viagem — Exclusão",
  PRODUCAO_3D_ENTRADA: "Produção 3D — Entrada",
  PRODUCAO_3D_ESTORNO: "Produção 3D — Estorno",
  EXPIRACAO_AUTOMATICA: "Expiração Automática (Sistema)",
  FORA_DO_SISTEMA: "⚠️ FORA DO SISTEMA",
};

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Último ano" },
];

const fmtQty = (v: string | number) => {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
};

const DeltaBadge = ({ delta }: { delta: string }) => {
  const n = Number(delta);
  if (n === 0) return <span className="text-slate-400 dark:text-slate-600">—</span>;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-bold tabular-nums",
      n > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
    )}>
      {n > 0 ? <ArrowUpCircle className="h-3.5 w-3.5" /> : <ArrowDownCircle className="h-3.5 w-3.5" />}
      {n > 0 ? "+" : ""}{fmtQty(n)}
    </span>
  );
};

export default function StockMovements() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [days, setDays] = useState("30");

  const { data: movements = [], isLoading, isRefetching, refetch } = useQuery<Movement[]>({
    queryKey: ["stock-movements", days],
    queryFn: async () => (await api.get("/stock/movements", { params: { days, limit: 1000 } })).data,
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });

  const filtered = useMemo(() => {
    let rows = movements;
    if (actionFilter !== "all") rows = rows.filter(m => m.action === actionFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      rows = rows.filter(m =>
        m.product_name?.toLowerCase().includes(term) ||
        m.product_sku?.toLowerCase().includes(term) ||
        m.source?.toLowerCase().includes(term) ||
        m.user_name?.toLowerCase().includes(term)
      );
    }
    return rows;
  }, [movements, actionFilter, search]);

  const availableActions = useMemo(() => {
    const set = new Set(movements.map(m => m.action));
    return Array.from(set).sort();
  }, [movements]);

  const outsideCount = useMemo(() => movements.filter(m => m.action === "FORA_DO_SISTEMA").length, [movements]);

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/50 dark:bg-background space-y-6 animate-in fade-in duration-500 pb-24 md:pb-8 transition-colors">

      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-foreground tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400">
              <History className="h-6 w-6" />
            </div>
            Movimentações de Estoque
          </h1>
          <p className="text-slate-500 dark:text-muted-foreground mt-2 text-sm md:text-base font-medium">
            Histórico completo e imutável de toda alteração no estoque: quem fez, por qual fluxo e qual era o saldo antes e depois.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} className="rounded-xl h-11 font-semibold shadow-sm">
          {isRefetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {/* ALERTA DE MOVIMENTOS FORA DO SISTEMA */}
      {outsideCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">
            {outsideCount} movimento(s) no período foram feitos <strong>fora do sistema</strong> (direto no banco de dados).
            Filtre por "FORA DO SISTEMA" para ver os detalhes.
          </p>
        </div>
      )}

      {/* FILTROS */}
      <Card className="p-4 md:p-5 bg-white dark:bg-card border-0 dark:border dark:border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-3xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px_200px] gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-muted-foreground" />
            <Input
              placeholder="Buscar por produto, SKU, origem ou usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-slate-50 dark:bg-background border-slate-200 dark:border-border rounded-xl text-slate-900 dark:text-foreground"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-12 bg-slate-50 dark:bg-background border-slate-200 dark:border-border rounded-xl font-medium text-slate-900 dark:text-foreground">
              <SelectValue placeholder="Tipo de movimento" />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[320px]">
              <SelectItem value="all">Todos os tipos</SelectItem>
              {availableActions.map(a => (
                <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-12 bg-slate-50 dark:bg-background border-slate-200 dark:border-border rounded-xl font-medium text-slate-900 dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* TABELA */}
      <Card className="bg-white dark:bg-card border-0 dark:border dark:border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <History className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-muted-foreground">Nenhuma movimentação encontrada no período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-border bg-slate-50/70 dark:bg-muted/20 text-left">
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground whitespace-nowrap">Data / Hora</th>
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Produto</th>
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Movimento</th>
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground text-right whitespace-nowrap">Físico Δ</th>
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground text-right whitespace-nowrap">Reserva Δ</th>
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground text-right whitespace-nowrap">Saldo Após</th>
                  <th className="px-4 py-3.5 font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border">
                {filtered.map(m => {
                  const isOutside = m.action === "FORA_DO_SISTEMA";
                  return (
                    <tr key={m.id} className={cn(
                      "hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors",
                      isOutside && "bg-red-50/60 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30"
                    )}>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-muted-foreground tabular-nums">
                        {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 dark:text-foreground leading-tight">{m.product_name || "Produto removido"}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">SKU: {m.product_sku || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap",
                          isOutside
                            ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                            : "bg-slate-100 dark:bg-muted/60 text-slate-700 dark:text-slate-300"
                        )}>
                          {ACTION_LABELS[m.action] || m.action}
                        </span>
                        {m.source && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">{m.source}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right"><DeltaBadge delta={m.on_hand_delta} /></td>
                      <td className="px-4 py-3 text-right"><DeltaBadge delta={m.reserved_delta} /></td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300" title="Estoque físico após o movimento">
                          <Unlock className="h-3 w-3 text-slate-400" /> {fmtQty(m.on_hand_after)}
                        </span>
                        <span className="inline-flex items-center gap-1 ml-3 text-slate-500 dark:text-slate-400" title="Reservado após o movimento">
                          <Lock className="h-3 w-3 text-amber-500" /> {fmtQty(m.reserved_after)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.user_name ? (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{m.user_name}</span>
                        ) : isOutside ? (
                          <span className="font-bold text-red-600 dark:text-red-400">{m.db_user || "desconhecido"} (banco)</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Sistema</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-border text-[12px] text-slate-400 dark:text-slate-500 font-medium">
            {filtered.length} movimento(s) exibido(s) · Δ = variação · <Unlock className="inline h-3 w-3" /> físico · <Lock className="inline h-3 w-3 text-amber-500" /> reservado
          </div>
        )}
      </Card>
    </div>
  );
}
