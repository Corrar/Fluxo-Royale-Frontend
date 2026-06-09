import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api"; 
import { CardData, Priority, ChecklistItem, Tag } from "@/types/card";
import { useSocket } from "@/contexts/SocketContext"; 
import { useEffect } from "react";
import { toast } from "sonner";

export function useEletricaCards() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // 1. BUSCAR DADOS (Aponta para a nova rota)
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["eletrica_tasks"],
    queryFn: async () => {
      const res = await api.get('/eletrica-tasks'); // Rota atualizada
      return res.data.map((task: any) => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        createdAt: new Date(task.createdAt),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined
      }));
    },
    staleTime: 1000 * 60 * 5, 
  });

  // 2. SOCKET IO (Ouve o evento exclusivo da elétrica)
  useEffect(() => {
    if (!socket) return;
    socket.on("eletrica_tasks_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
    });
    return () => {
      socket.off("eletrica_tasks_updated");
    };
  }, [socket, queryClient]);

  // 3. ACTIONS
  const createMutation = useMutation({
    mutationFn: (newTask: any) => api.post('/eletrica-tasks', newTask), // Rota atualizada
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
      toast.success("Ordem criada na Elétrica!");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CardData> }) => 
      api.put(`/eletrica-tasks/${id}`, data), // Rota atualizada
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/eletrica-tasks/${id}`), // Rota atualizada
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
      toast.success("Ordem excluída.");
    }
  });

  // --- FUNÇÕES DE INTERFACE ---
  const addCard = (
    title: string, description: string, priority: Priority, 
    checklist: ChecklistItem[], tags: Tag[], imageUrl?: string, dueDate?: Date
  ) => {
    createMutation.mutate({
      title, description, priority, checklist, tags, imageUrl, dueDate,
      category: 'blue',
      completed: false,
    }); 
  };

  const updateCard = (
    id: string, title: string, description: string, priority: Priority, 
    checklist: ChecklistItem[], tags: Tag[], imageUrl?: string, dueDate?: Date
  ) => {
    updateMutation.mutate({ 
      id, data: { title, description, priority, checklist, tags, imageUrl, dueDate } 
    });
  };

  const deleteCard = (id: string) => deleteMutation.mutate(id);

  const duplicateCard = (id: string) => {
    const cardToDuplicate = cards.find((c: CardData) => c.id === id);
    if (cardToDuplicate) {
      addCard(
        `${cardToDuplicate.title} (Cópia)`,
        cardToDuplicate.description, cardToDuplicate.priority,
        cardToDuplicate.checklist.map((item: any) => ({ ...item, completed: false })),
        cardToDuplicate.tags, cardToDuplicate.imageUrl, cardToDuplicate.dueDate
      );
    }
  };

  const toggleChecklistItem = (cardId: string, itemId: string) => {
    const card = cards.find((c: CardData) => c.id === cardId);
    if (!card) return;
    const newChecklist = card.checklist.map((item: ChecklistItem) => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateMutation.mutate({ id: cardId, data: { checklist: newChecklist } });
  };

  const toggleCardCompleted = (id: string) => {
    const card = cards.find((c: CardData) => c.id === id);
    if (!card) return;
    updateMutation.mutate({ id, data: { completed: !card.completed } });
  };

  return { cards, isLoading, addCard, updateCard, deleteCard, duplicateCard, toggleChecklistItem, toggleCardCompleted };
}
