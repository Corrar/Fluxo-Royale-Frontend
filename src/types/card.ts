export type CategoryColor = 'blue' | 'green' | 'orange' | 'pink' | 'purple' | 'teal';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface CardData {
  id: string;
  title: string;
  description: string;
  category: CategoryColor; // Mantido para compatibilidade
  priority: Priority;
  checklist: ChecklistItem[];
  tags: Tag[];          // Novo
  imageUrl?: string;    // Novo
  dueDate?: Date;       // Novo
  createdAt: Date;
  completed: boolean;
  completedAt?: Date;
}
