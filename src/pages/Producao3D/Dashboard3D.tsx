import React from "react";
// Importamos do contexto que acabámos de criar no Passo 1
import { useStore, formatMinutes } from "../../contexts/Store3DContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Boxes, Clock, Gauge, Package, TrendingUp, Layers } from "lucide-react";
import { format } from "date-fns";

const PIE_COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B"]; // Cores substituídas por HEX por compatibilidade

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold mt-2 text-foreground tabular-nums">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard3D() {
  const { productions, demands, parts } = useStore();

  const totalParts = productions.reduce((s, p) => s + p.quantity, 0);
  const totalFilament = productions.reduce((s, p) => s + p.filamentGrams, 0);
  const totalMinutes = productions.reduce((s, p) => s + p.totalMinutes, 0);
  const expected = productions.reduce((s, p) => {
    const part = parts.find((x) => x.id === p.partId);
    return s + (part ? part.productionMinutes * p.quantity : 0);
  }, 0);
  
  const efficiency = expected > 0 ? Math.min(100, Math.round((expected / totalMinutes) * 100)) : 0;
  const completed = demands.filter((d) => d.status === "Concluída").length;
  const pending = demands.length - completed;
  const avgPerPart = totalParts > 0 ? Math.round(totalMinutes / totalParts) : 0;

  const timeline = productions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: format(new Date(p.date), "dd/MM"),
      pecas: p.quantity,
      filamento: p.filamentGrams,
    }));

  const byStatus = ["Em análise", "Aceita", "Em desenvolvimento", "Concluída"].map((s) => ({
    name: s,
    value: demands.filter((d) => d.status === s).length,
  }));

  const topParts = parts
    .map((p) => ({
      name: p.code,
      total: productions.filter((pr) => pr.partId === p.id).reduce((s, x) => s + x.quantity, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Dashboard 3D</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da operação de impressão 3D</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Package} label="Peças produzidas" value={totalParts.toString()} hint="Período atual" />
        <Kpi icon={Layers} label="Filamento" value={`${(totalFilament / 1000).toFixed(2)} kg`} />
        <Kpi icon={Clock} label="Tempo total" value={formatMinutes(totalMinutes)} />
        <Kpi icon={Gauge} label="Eficiência" value={`${efficiency}%`} hint="Previsto vs real" />
        <Kpi icon={TrendingUp} label="Demandas" value={`${completed}/${demands.length}`} hint={`${pending} pendentes`} />
        <Kpi icon={Boxes} label="Tempo/peça" value={formatMinutes(avgPerPart)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Produção ao longo do tempo</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="pecas" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Consumo de filamento (g)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Bar dataKey="filamento" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Demandas por status</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Top peças mais produzidas</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topParts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={80} />
                <Tooltip />
                <Bar dataKey="total" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}