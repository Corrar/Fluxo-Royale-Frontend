import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api"; 
import { CardData, Priority, ChecklistItem, Tag } from "@/types/card";
import { useSocket } from "@/contexts/SocketContext"; 
import { useEffect } from "react";
import { toast } from "sonner";

export function useCards() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // 1. BUSCAR DADOS
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await api.get('/tasks');
      // Converter strings de data ISO para objetos Date
      return res.data.map((task: any) => ({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        createdAt: new Date(task.createdAt),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined
      }));
    },
    staleTime: 1000 * 60 * 5, 
  });

  // 2. SOCKET IO
  useEffect(() => {
    if (!socket) return;
    socket.on("tasks_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });
    return () => {
      socket.off("tasks_updated");
    };
  }, [socket, queryClient]);

  // 3. ACTIONS
  const createMutation = useMutation({
    mutationFn: (newTask: any) => api.post('/tasks', newTask),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      socket?.emit("tasks_change");
      toast.success("Tarefa criada!");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CardData> }) => 
      api.put(`/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      socket?.emit("tasks_change");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      socket?.emit("tasks_change");
      toast.success("Tarefa excluída.");
    }
  });

  // --- FUNÇÕES DE INTERFACE ---

  const addCard = (
    title: string, 
    description: string, 
    priority: Priority, 
    checklist: ChecklistItem[], 
    tags: Tag[], 
    imageUrl?: string, 
    dueDate?: Date
  ) => {
    createMutation.mutate({
      title, description, priority, checklist, tags, imageUrl, dueDate,
      category: 'blue', // Mantém compatibilidade
      completed: false,
    }); 
  };

  const updateCard = (
    id: string, 
    title: string, 
    description: string, 
    priority: Priority, 
    checklist: ChecklistItem[],
    tags: Tag[],
    imageUrl?: string,
    dueDate?: Date
  ) => {
    updateMutation.mutate({ 
      id, 
      data: { title, description, priority, checklist, tags, imageUrl, dueDate } 
    });
  };

  const deleteCard = (id: string) => deleteMutation.mutate(id);

  const duplicateCard = (id: string) => {
    const cardToDuplicate = cards.find((c: CardData) => c.id === id);
    if (cardToDuplicate) {
      
      // Função recursiva para desmarcar todos os itens e sub-itens na cópia
      const resetChecklist = (items: ChecklistItem[]): ChecklistItem[] => {
        return items.map(item => {
          if (item.isGroup && item.subItems) {
            return { ...item, completed: false, subItems: resetChecklist(item.subItems) };
          }
          return { ...item, completed: false };
        });
      };

      addCard(
        `${cardToDuplicate.title} (Cópia)`,
        cardToDuplicate.description,
        cardToDuplicate.priority,
        resetChecklist(cardToDuplicate.checklist), // Aplica o reset profundo
        cardToDuplicate.tags,
        cardToDuplicate.imageUrl,
        cardToDuplicate.dueDate
      );
    }
  };

  const toggleChecklistItem = (cardId: string, itemId: string) => {
    const card = cards.find((c: CardData) => c.id === cardId);
    if (!card) return;
    
    // Função recursiva para procurar e alterar o item, mesmo dentro de grupos
    const toggleRecursive = (items: ChecklistItem[]): ChecklistItem[] => {
      return items.map(item => {
        if (item.id === itemId) return { ...item, completed: !item.completed };
        if (item.isGroup && item.subItems) {
          return { ...item, subItems: toggleRecursive(item.subItems) };
        }
        return item;
      });
    };

    const newChecklist = toggleRecursive(card.checklist);
    updateMutation.mutate({ id: cardId, data: { checklist: newChecklist } });
  };

  const toggleCardCompleted = (id: string) => {
    const card = cards.find((c: CardData) => c.id === id);
    if (!card) return;
    
    updateMutation.mutate({ id, data: { completed: !card.completed } });
  };

  return { cards, isLoading, addCard, updateCard, deleteCard, duplicateCard, toggleChecklistItem, toggleCardCompleted };
}
