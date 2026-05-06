import { CardData, Priority, ChecklistItem } from '@/types/card';
import { Pencil, Trash2, CheckCircle2, Circle, Flag, AlertTriangle, AlertCircle, Minus, Check, RotateCcw, Copy, Calendar, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InfoCardProps {
  card: CardData;
  onClickCard?: (card: CardData) => void; // <--- AQUI ESTÁ A CORREÇÃO DO ERRO
  onEdit?: (card: CardData) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onToggleChecklistItem?: (cardId: string, itemId: string) => void;
  onToggleCompleted?: (cardId: string) => void;
  onArchive?: (id: string) => void;
  index: number;
  readOnly?: boolean;
}

const priorityConfig: Record<Priority, { label: string; color: string; bgColor: string; glowClass: string; icon: typeof Flag }> = {
  low: { label: 'Baixa', color: 'text-priority-low', bgColor: 'bg-priority-low', glowClass: 'priority-glow-low', icon: Minus },
  medium: { label: 'Média', color: 'text-priority-medium', bgColor: 'bg-priority-medium', glowClass: 'priority-glow-medium', icon: Flag },
  high: { label: 'Alta', color: 'text-priority-high', bgColor: 'bg-priority-high', glowClass: 'priority-glow-high', icon: AlertTriangle },
  urgent: { label: 'Urgente', color: 'text-priority-urgent', bgColor: 'bg-priority-urgent', glowClass: 'priority-glow-urgent', icon: AlertCircle },
};

// Transforma os sub-itens em uma lista plana apenas para a visualização do Card e barra de progresso
const getFlatItems = (items: ChecklistItem[]): ChecklistItem[] => {
  let flat: ChecklistItem[] = [];
  items.forEach(item => {
    if (item.isGroup && item.subItems) flat = flat.concat(item.subItems);
    else if (!item.isGroup) flat.push(item);
  });
  return flat;
};

export const InfoCard = ({ 
  card, 
  onClickCard, // <--- ADICIONADO AQUI
  onEdit, 
  onDelete, 
  onDuplicate, 
  onToggleChecklistItem, 
  onToggleCompleted, 
  onArchive, 
  index,
  readOnly = false
}: InfoCardProps) => {
  const priority = priorityConfig[card.priority];
  const PriorityIcon = priority.icon;
  
  // Usamos a lista plana para contar corretamente o progresso e mostrar no resumo
  const flatChecklist = getFlatItems(card.checklist);
  const completedCount = flatChecklist.filter(item => item.completed).length;
  const totalCount = flatChecklist.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <article
      className={cn(
        'group relative rounded-2xl overflow-hidden border transition-all duration-500 ease-out text-left outline-none',
        'bg-card',
        onClickCard ? 'cursor-pointer hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40' : '',
        'hover-lift card-shadow hover:card-shadow-hover',
        priority.glowClass,
        card.completed && 'opacity-60 grayscale-[30%]'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => onClickCard?.(card)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickCard?.(card);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalhes do card: ${card.title}`}
    >
      <div className={cn('absolute left-0 top-0 w-1 h-full', priority.bgColor)} />

      {card.imageUrl && (
        <div className="relative w-full h-36 overflow-hidden">
          <img 
            src={card.imageUrl} 
            alt={`Imagem anexada: ${card.title}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      <div className="p-5 pl-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-card border shadow-sm', priority.color, card.priority === 'urgent' && 'animate-pulse-scale')}>
                <PriorityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {priority.label}
              </span>
              {card.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-muted text-muted-foreground">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  {format(card.dueDate, 'dd MMM', { locale: ptBR })}
                </span>
              )}
            </div>
            <h3 className={cn('font-bold text-card-foreground text-lg leading-tight line-clamp-2 transition-colors', card.completed && 'line-through opacity-70')}>
              {card.title}
            </h3>
          </div>

          {/* ACÇÕES COM stopPropagation() */}
          {!readOnly && (
            <div className="flex gap-0.5 transition-all duration-300 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleCompleted?.(card.id); }}
                className={cn('p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring hover:scale-110', card.completed ? 'hover:bg-secondary bg-secondary/50 text-muted-foreground' : 'hover:bg-primary/10 text-primary')}
                title={card.completed ? 'Reabrir card' : 'Marcar como pronto'}
              >
                {card.completed ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDuplicate?.(card.id); }} 
                className="p-2 rounded-lg hover:bg-secondary/80 hover:scale-110 transition-all text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                title="Duplicar card"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit?.(card); }} 
                className="p-2 rounded-lg hover:bg-secondary/80 hover:scale-110 transition-all text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                title="Editar card"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {onArchive && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onArchive(card.id); }} 
                  className="p-2 rounded-lg hover:bg-amber-500/10 hover:scale-110 transition-all text-muted-foreground hover:text-amber-600 focus:outline-none focus:ring-2 focus:ring-ring"
                  title="Arquivar card"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(card.id); }} 
                className="p-2 rounded-lg hover:bg-destructive/10 hover:scale-110 transition-all text-muted-foreground hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive"
                title="Excluir card"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {card.description && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">{card.description}</p>
        )}

        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {card.tags.map((tag) => (
              <span key={tag.id} className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white', tag.color)}>
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Pré-visualização da Checklist */}
        {card.checklist.length > 0 && (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}> {/* Impede abrir o modal ao interagir com a barra de progresso/checkbox */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-500', priority.bgColor)} style={{ width: `${progressPercentage}%` }} />
              </div>
              <span className="text-xs text-muted-foreground font-semibold tabular-nums">{completedCount}/{totalCount}</span>
            </div>

            <ul className="space-y-1">
              {flatChecklist.slice(0, 4).map((item, i) => (
                <li key={item.id} style={{ animationDelay: `${i * 50}ms` }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!readOnly) onToggleChecklistItem?.(card.id, item.id);
                    }}
                    disabled={readOnly}
                    className={cn(
                      'w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all', 
                      readOnly ? 'cursor-default' : 'hover:bg-muted/50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring', 
                      item.completed && 'opacity-50'
                    )}
                  >
                    <span className={cn('shrink-0 mt-0.5 transition-all', item.completed ? 'scale-110' : 'scale-100')}>
                      {item.completed ? <CheckCircle2 className={cn('w-4 h-4', priority.color)} /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                    </span>
                    <span className={cn('text-sm leading-tight transition-all', item.completed && 'line-through text-muted-foreground')}>{item.text}</span>
                  </button>
                </li>
              ))}
              {flatChecklist.length > 4 && (
                <li className="text-xs font-semibold text-primary/80 pl-2 py-2 flex items-center gap-1 cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onClickCard?.(card); }}>
                  <div className="w-4 h-4 flex items-center justify-center rounded bg-primary/10">+{flatChecklist.length - 4}</div>
                  itens ocultos. Clique para expandir.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
};
