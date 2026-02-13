// src/services/taskService.ts
import { api } from "./api";
import { CardData } from "@/types/card";

export const taskService = {
  getAll: async () => {
    const { data } = await api.get<CardData[]>("/tasks");
    return data;
  },
  create: async (task: Partial<CardData>) => {
    const { data } = await api.post("/tasks", task);
    return data;
  },
  update: async (id: string, updates: Partial<CardData>) => {
    const { data } = await api.put(`/tasks/${id}`, updates);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/tasks/${id}`);
  }
};
