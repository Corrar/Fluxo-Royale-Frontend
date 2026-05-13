import { useState, useMemo, useEffect } from 'react';
import { Plus, Zap, CheckCircle, RotateCcw } from 'lucide-react'; 
import { useEletricaCards } from '@/hooks/useEletricaCards';
import { InfoCard } from '@/components/cards/InfoCard';
import { CardModal } from '@/components/cards/CardModal';
import { CardFilters } from '@/components/cards/CardFilters';
import { EmptyState } from '@/components/cards/EmptyState';
import { CardData, Priority, ChecklistItem, Tag } from '@/types/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const EletricaBoard = () => {
  const { profile, canAccess } = useAuth(); // profile voltou para checar o setor
  const navigate = useNavigate();
  
  // VERIFICAÇÃO DE SEGURANÇA: RBAC ou Setor Elétrica
  const isEletrica = profile?.sector?.toLowerCase() === 'elétrica' || profile?.sector?.toLowerCase() === 'eletrica';
  const isAuthorized = canAccess('tarefas_eletrica') || isEletrica;

  // Redireciona usuários não autorizados para o início
  useEffect(() => {
    if (!isAuthorized) {
      navigate('/inicio');
    }
  }, [isAuthorized, navigate]);

  // Quem tem acesso à página tem permissão de gerenciar as tarefas dela
  const isManager = isAuthorized; 

  const { cards, isLoading, addCard, updateCard, deleteCard, duplicateCard, toggleChecklistItem, toggleCardCompleted } = useEletricaCards();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    cards.forEach((card: CardData) => card.tags?.forEach(tag => tags.add(tag.name)));
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

  const handleOpenCreate = () => {
    if (!isManager) return;
    setEditingCard(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: CardData) => {
    setEditingCard(card);
    setIsModalOpen(true);
  };

  const handleSave = (title: string, description: string, priority: Priority, checklist: ChecklistItem[], tags: Tag[], imageUrl?: string, dueDate?: Date) => {
    if (!isManager) return; 
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

  // Previne a renderização enquanto redireciona um intruso
  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 animate-in fade-in duration-500">
      <header className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center shadow-sm border border-yellow-500/20">
              <Zap className="w-6 h-6 text-yellow-500 animate-pulse-scale" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Quadro - Elétrica</h1>
              <p className="text-sm text-muted-foreground">
                Fluxo de Serviço - {activeTab === 'active' ? 'Pendentes' : 'Concluídas'}
              </p>
            </div>
          </div>

          {isManager && (
            <Button onClick={handleOpenCreate} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 bg-yellow-600 hover:bg-yellow-700 text-white">
              <Plus className="w-5 h-5" /> Nova Ordem
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
            priorityFilter={priorityFilter} tagFilter={tagFilter} availableTags={availableTags}
            onPriorityChange={setPriorityFilter} onTagChange={setTagFilter} onClearFilters={clearFilters}
          />
        </div>
      </header>

      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (<div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />))}
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger-animation">
            {filteredCards.map((card, index) => (
              <InfoCard
                key={card.id} card={card} index={index}
                // --- NOVA PROPRIEDADE: Clicar no card abre a vista de detalhes ---
                onClickCard={(c) => handleOpenEdit(c)}
                // ---------------------------------------------------------------
                onEdit={isManager ? handleOpenEdit : undefined}
                onDelete={isManager ? deleteCard : undefined}
                onDuplicate={isManager ? duplicateCard : undefined}
                onToggleChecklistItem={isManager ? toggleChecklistItem : undefined}
                onToggleCompleted={isManager ? toggleCardCompleted : undefined}
                readOnly={!isManager}
              />
            ))}
          </div>
        ) : (
          <div className="flex justify-center py-10">
             {activeTab === 'active' && priorityFilter === 'all' && tagFilter === '' ? (
                isManager ? (
                  <EmptyState onCreateClick={handleOpenCreate} />
                ) : (
                  <div className="text-center py-20 w-full text-muted-foreground"><p>Nenhuma tarefa ativa no momento.</p></div>
                )
             ) : (
               <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border w-full">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      {activeTab === 'active' ? <CheckCircle className="w-8 h-8 text-muted-foreground/50" /> : <RotateCcw className="w-8 h-8 text-muted-foreground/50" />}
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Lista Vazia</h3>
                  <p className="text-muted-foreground">Nenhuma tarefa encontrada com esses critérios.</p>
                  <Button variant="link" onClick={clearFilters} className="mt-2">Limpar filtros</Button>
               </div>
             )}
          </div>
        )}
      </div>

      <CardModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        onSave={handleSave} editingCard={editingCard} readOnly={!isManager}
      />
    </div>
  );
};

export default EletricaBoard;
