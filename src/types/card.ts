export type CategoryColor = 'blue' | 'green' | 'orange' | 'pink' | 'purple' | 'teal';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  // --- NOVAS PROPRIEDADES PARA OS GRUPOS (DROPDOWNS) ---
  isGroup?: boolean;
  subItems?: ChecklistItem[];
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
  tags: Tag[];          
  imageUrl?: string;    
  dueDate?: Date;       
  createdAt: Date;
  completed: boolean;
  completedAt?: Date;
}
