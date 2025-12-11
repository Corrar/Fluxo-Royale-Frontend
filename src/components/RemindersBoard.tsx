import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle2, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RemindersBoardProps {
  stats: any;
}

export function RemindersBoard({ stats }: RemindersBoardProps) {
  // Dados simulados para o exemplo (você pode conectar com uma API real depois)
  const columns = [
    {
      id: "alerts",
      title: "Alertas Críticos",
      color: "bg-red-50 border-red-200",
      icon: <AlertCircle className="h-4 w-4 text-red-600" />,
      items: [
        stats?.lowStock > 0 && {
          id: 1,
          title: "Estoque Baixo",
          desc: `${stats.lowStock} produtos abaixo do mínimo.`,
          tag: "Urgente",
          tagColor: "bg-red-100 text-red-700"
        },
      ].filter(Boolean)
    },
    {
      id: "pending",
      title: "Pendências",
      color: "bg-amber-50 border-amber-200",
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      items: [
        stats?.openRequests > 0 && {
          id: 2,
          title: "Novas Solicitações",
          desc: `${stats.openRequests} pedidos aguardando aprovação.`,
          tag: "Ação",
          tagColor: "bg-amber-100 text-amber-700"
        },
        {
          id: 3,
          title: "Inventário Mensal",
          desc: "Iniciar contagem do setor A.",
          tag: "Rotina",
          tagColor: "bg-blue-100 text-blue-700"
        }
      ].filter(Boolean)
    },
    {
      id: "done",
      title: "Concluído / Histórico",
      color: "bg-slate-50 border-slate-200",
      icon: <CheckCircle2 className="h-4 w-4 text-slate-600" />,
      items: [
        {
          id: 4,
          title: "Fechamento Agosto",
          desc: "Relatório enviado para diretoria.",
          tag: "Finalizado",
          tagColor: "bg-green-100 text-green-700"
        }
      ]
    }
  ];

  return (
    <div className="flex h-full overflow-x-auto gap-4 pb-4">
      {columns.map((col) => (
        <div key={col.id} className={`flex-shrink-0 w-80 flex flex-col rounded-xl border ${col.color} h-full max-h-full`}>
          {/* Header da Coluna */}
          <div className="p-3 flex items-center justify-between border-b border-black/5 bg-white/50 rounded-t-xl">
            <div className="flex items-center gap-2 font-semibold text-sm">
              {col.icon}
              {col.title}
              <Badge variant="secondary" className="ml-1 text-[10px] h-5 min-w-5 flex justify-center bg-white/80">
                {col.items.length}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </Button>
          </div>

          {/* Área de Cards (Scrollável) */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto">
            {col.items.map((item: any) => (
              <Card key={item.id} className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer group border-slate-100">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={`text-[10px] px-1.5 py-0 rounded-sm font-normal border-none ${item.tagColor}`}>
                      {item.tag}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-1 leading-snug">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
            
            {/* Botão de Adicionar (Visual) */}
            <Button variant="ghost" className="w-full justify-start text-xs text-slate-500 hover:bg-black/5 h-8">
              <Plus className="h-3 w-3 mr-2" /> Adicionar cartão
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}