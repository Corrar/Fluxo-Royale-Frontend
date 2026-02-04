import { CardData, Priority } from '@/types/card';
import { Pencil, Trash2, CheckCircle2, Circle, Flag, AlertTriangle, AlertCircle, Minus, Check, RotateCcw, Copy, Calendar, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InfoCardProps {
  card: CardData;
  onEdit: (card: CardData) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleChecklistItem: (cardId: string, itemId: string) => void;
  onToggleCompleted: (cardId: string) => void;
  onArchive?: (id: string) => void;
  index: number;
}

const priorityConfig: Record<Priority, { label: string; color: string; bgColor: string; glowClass: string; icon: typeof Flag }> = {
  low: { label: 'Baixa', color: 'text-priority-low', bgColor: 'bg-priority-low', glowClass: 'priority-glow-low', icon: Minus },
  medium: { label: 'Média', color: 'text-priority-medium', bgColor: 'bg-priority-medium', glowClass: 'priority-glow-medium', icon: Flag },
  high: { label: 'Alta', color: 'text-priority-high', bgColor: 'bg-priority-high', glowClass: 'priority-glow-high', icon: AlertTriangle },
  urgent: { label: 'Urgente', color: 'text-priority-urgent', bgColor: 'bg-priority-urgent', glowClass: 'priority-glow-urgent', icon: AlertCircle },
};

export const InfoCard = ({ card, onEdit, onDelete, onDuplicate, onToggleChecklistItem, onToggleCompleted, onArchive, index }: InfoCardProps) => {
  const priority = priorityConfig[card.priority];
  const PriorityIcon = priority.icon;
  const completedCount = card.checklist.filter(item => item.completed).length;
  const totalCount = card.checklist.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <article
      className={cn(
        'group relative rounded-2xl overflow-hidden border transition-all duration-500 ease-out',
        'bg-card',
        'hover-lift card-shadow hover:card-shadow-hover',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        priority.glowClass,
        card.completed && 'opacity-60 grayscale-[30%]'
      )}
      style={{ 
        animationDelay: `${index * 80}ms`,
      }}
      role="article"
      aria-label={`Card: ${card.title}, Prioridade: ${priority.label}${card.completed ? ', Concluído' : ''}`}
      tabIndex={0}
    >
      {/* Priority indicator - vertical bar */}
      <div
        className={cn(
          'absolute left-0 top-0 w-1 h-full',
          priority.bgColor
        )}
        aria-hidden="true"
      />

      {/* Image Section */}
      {card.imageUrl && (
        <div className="relative w-full h-36 overflow-hidden">
          <img 
            src={card.imageUrl} 
            alt={`Imagem do card ${card.title}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="p-5 pl-5">
        {/* Header with priority and actions */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Priority badge and due date */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide',
                  'bg-card border shadow-sm',
                  priority.color,
                  card.priority === 'urgent' && 'animate-pulse-scale'
                )}
                role="status"
                aria-label={`Prioridade: ${priority.label}`}
              >
                <PriorityIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {priority.label}
              </span>
              
              {card.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-muted text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {format(card.dueDate, 'dd MMM', { locale: ptBR })}
                </span>
              )}
            </div>

            <h3 className={cn(
              'font-bold text-card-foreground text-lg leading-tight line-clamp-2 transition-colors',
              card.completed && 'line-through opacity-70'
            )}>
              {card.title}
            </h3>
          </div>

          {/* Actions with slide-in effect */}
          <div 
            className={cn(
              'flex gap-0.5 transition-all duration-300',
              'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0',
              'group-focus-within:opacity-100 group-focus-within:translate-x-0'
            )}
            role="group"
            aria-label="Ações do card"
          >
            <button
              onClick={() => onToggleCompleted(card.id)}
              className={cn(
                'p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                'hover:scale-110 active:scale-95',
                card.completed 
                  ? 'hover:bg-secondary bg-secondary/50 text-muted-foreground' 
                  : 'hover:bg-primary/10 text-primary'
              )}
              aria-label={card.completed ? `Reabrir ${card.title}` : `Marcar ${card.title} como pronto`}
              title={card.completed ? 'Reabrir card' : 'Marcar como pronto'}
            >
              {card.completed ? (
                <RotateCcw className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => onDuplicate(card.id)}
              className="p-2 rounded-lg hover:bg-secondary/80 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              aria-label={`Duplicar ${card.title}`}
              title="Duplicar card"
            >
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => onEdit(card)}
              className="p-2 rounded-lg hover:bg-secondary/80 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              aria-label={`Editar ${card.title}`}
              title="Editar card"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
            {onArchive && (
              <button
                onClick={() => onArchive(card.id)}
                className="p-2 rounded-lg hover:bg-amber-500/10 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                aria-label={`Arquivar ${card.title}`}
                title="Arquivar card"
              >
                <Archive className="w-4 h-4 text-muted-foreground hover:text-amber-600" />
              </button>
            )}
            <button
              onClick={() => onDelete(card.id)}
              className="p-2 rounded-lg hover:bg-destructive/10 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1"
              aria-label={`Excluir ${card.title}`}
              title="Excluir card"
            >
              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>

        {card.description && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
            {card.description}
          </p>
        )}

        {/* Tags */}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {card.tags.map((tag) => (
              <span
                key={tag.id}
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white',
                  tag.color
                )}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Checklist section with enhanced visuals */}
        {card.checklist.length > 0 && (
          <div className="space-y-2">
            {/* Progress bar with shine effect */}
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={completedCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-label={`Progresso: ${completedCount} de ${totalCount} itens concluídos`}
              >
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-500 ease-out progress-fill',
                    priority.bgColor
                  )}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap tabular-nums">
                {completedCount}/{totalCount}
              </span>
            </div>

            {/* Checklist items with stagger animation */}
            <ul className="space-y-1" aria-label="Checklist">
              {card.checklist.slice(0, 4).map((item, i) => (
                <li key={item.id} style={{ animationDelay: `${i * 50}ms` }}>
                  <button
                    onClick={() => onToggleChecklistItem(card.id, item.id)}
                    className={cn(
                      'w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all duration-300',
                      'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                      'active:scale-[0.98]',
                      item.completed && 'opacity-50'
                    )}
                    aria-pressed={item.completed}
                    aria-label={`${item.completed ? 'Desmarcar' : 'Marcar como concluído'}: ${item.text}`}
                  >
                    <span className={cn(
                      'shrink-0 mt-0.5 transition-all duration-300',
                      item.completed ? 'scale-110' : 'scale-100'
                    )}>
                      {item.completed ? (
                        <CheckCircle2 className={cn('w-4 h-4', priority.color)} aria-hidden="true" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                    <span 
                      className={cn(
                        'text-sm leading-tight transition-all duration-300',
                        item.completed && 'line-through text-muted-foreground'
                      )}
                    >
                      {item.text}
                    </span>
                  </button>
                </li>
              ))}
              {card.checklist.length > 4 && (
                <li className="text-xs text-muted-foreground pl-2 py-1">
                  +{card.checklist.length - 4} mais itens
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
};
