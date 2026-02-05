import { useState, useMemo } from 'react';
import { Plus, Sparkles, CheckCircle, RotateCcw } from 'lucide-react';
import { useCards } from '@/hooks/useCards';
import { InfoCard } from '@/components/cards/InfoCard';
import { CardModal } from '@/components/cards/CardModal';
import { CardFilters } from '@/components/cards/CardFilters';
import { EmptyState } from '@/components/cards/EmptyState';
import { CardData, Priority, ChecklistItem, Tag } from '@/types/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

const TasksBoard = () => {
  const { profile } = useAuth(); 
  
  // Define quem tem permissão de GERÊNCIA (Criar, Editar, Excluir)
  const isManager = profile?.role === 'gerente' || profile?.role === 'admin'; 

  const { cards, isLoading, addCard, updateCard, deleteCard, duplicateCard, toggleChecklistItem, toggleCardCompleted } = useCards();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  
  // Filtros
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    cards.forEach((card: CardData) => {
      card.tags?.forEach(tag => tags.add(tag.name));
    });
    return Array.from(tags);
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card: CardData) => {
      if (activeTab === 'active' && card.completed) return false;
      if (activeTab === 'completed' && !card.completed) return false;
      if (priorityFilter !== 'all' && card.priority !== priorityFilter) return false;
      if (tagFilter && tagFilter !== 'all_tags_reset_value' && !card.tags?.some(t => t.name === tagFilter)) return false;
      return true;
    });
  }, [cards, activeTab, priorityFilter, tagFilter]);

  // --- Ações ---

  const handleOpenCreate = () => {
    if (!isManager) return;
    setEditingCard(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: CardData) => {
    // Esta função abre o modal.
    // Se não for gerente, o modal abrirá em modo "readOnly" (ver abaixo no JSX)
    setEditingCard(card);
    setIsModalOpen(true);
  };

  const handleSave = (
    title: string, 
    description: string, 
    priority: Priority, 
    checklist: ChecklistItem[],
    tags: Tag[],
    imageUrl?: string,
    dueDate?: Date
  ) => {
    if (!isManager) return; // Segurança dupla
    if (editingCard) {
      updateCard(editingCard.id, title, description, priority, checklist, tags, imageUrl, dueDate);
    } else {
      addCard(title, description, priority, checklist, tags, imageUrl, dueDate);
    }
  };

  const clearFilters = () => {
    setPriorityFilter('all');
    setTagFilter('');
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 animate-in fade-in duration-500">
      <header className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
              <Sparkles className="w-6 h-6 text-primary animate-pulse-scale" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestão de Tarefas</h1>
              <p className="text-sm text-muted-foreground">
                Fluxo de Produção - {activeTab === 'active' ? 'Ativas' : 'Histórico'}
              </p>
            </div>
          </div>

          {/* Botão Nova Tarefa apenas para Gerentes */}
          {isManager && (
            <Button onClick={handleOpenCreate} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95">
              <Plus className="w-5 h-5" /> Nova Tarefa
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/50 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="active">Ativas</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
            </TabsList>
          </Tabs>

          <CardFilters 
            priorityFilter={priorityFilter}
            tagFilter={tagFilter}
            availableTags={availableTags}
            onPriorityChange={setPriorityFilter}
            onTagChange={setTagFilter}
            onClearFilters={clearFilters}
          />
        </div>
      </header>

      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger-animation">
            {filteredCards.map((card, index) => (
              <InfoCard
                key={card.id}
                card={card}
                index={index}
                // --- ALTERAÇÃO IMPORTANTE ---
                // Se não for gerente, passamos 'undefined' para onEdit, onDelete, etc.
                // Isso deve forçar o InfoCard a esconder os botões de ação.
                onEdit={isManager ? handleOpenEdit : undefined}
                onDelete={isManager ? deleteCard : undefined}
                onDuplicate={isManager ? duplicateCard : undefined}
                onToggleChecklistItem={isManager ? toggleChecklistItem : undefined}
                onToggleCompleted={isManager ? toggleCardCompleted : undefined}
                
                readOnly={!isManager}
                
                // Caso os usuários precisem APENAS ver os detalhes (sem editar), 
                // e o lápis sumiu, podemos tentar passar a função de abrir no onClick (se o componente suportar)
                // onClick={() => handleOpenEdit(card)} 
              />
            ))}
          </div>
        ) : (
          <div className="flex justify-center py-10">
             {activeTab === 'active' && priorityFilter === 'all' && tagFilter === '' ? (
                isManager ? (
                  <EmptyState onCreateClick={handleOpenCreate} />
                ) : (
                  <div className="text-center py-20 w-full text-muted-foreground">
                    <p>Nenhuma tarefa ativa no momento.</p>
                  </div>
                )
             ) : (
               <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border w-full">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      {activeTab === 'active' ? <CheckCircle className="w-8 h-8 text-muted-foreground/50" /> : <RotateCcw className="w-8 h-8 text-muted-foreground/50" />}
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Lista Vazia</h3>
                  <p className="text-muted-foreground">Nenhuma tarefa encontrada com esses critérios.</p>
                  {(priorityFilter !== 'all' || tagFilter !== '') && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
               </div>
             )}
          </div>
        )}
      </div>

      <CardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingCard={editingCard}
        readOnly={!isManager} // Garante que o modal abra bloqueado para não-gerentes
      />
    </div>
  );
};

export default TasksBoard;
