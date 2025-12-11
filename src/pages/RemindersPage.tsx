import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { RemindersBoard } from "@/components/RemindersBoard"; // Importa o novo board
import { Bell, Loader2, Trello } from "lucide-react";

export default function RemindersPage() {
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      try {
        const response = await api.get("/dashboard/stats");
        return response.data;
      } catch (e) {
        return { lowStock: 0, openRequests: 0 };
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between border-b pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <Trello className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Quadro de Gestão</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de tarefas e alertas estilo Kanban.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <RemindersBoard stats={stats} />
      </div>
    </div>
  );
}