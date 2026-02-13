import { Priority } from '@/types/card';
import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CardFiltersProps {
  priorityFilter: Priority | 'all';
  tagFilter: string;
  availableTags: string[];
  onPriorityChange: (priority: Priority | 'all') => void;
  onTagChange: (tag: string) => void;
  onClearFilters: () => void;
}

const priorities: { value: Priority | 'all'; label: string; color?: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'low', label: 'Baixa', color: 'bg-priority-low' },
  { value: 'medium', label: 'Média', color: 'bg-priority-medium' },
  { value: 'high', label: 'Alta', color: 'bg-priority-high' },
  { value: 'urgent', label: 'Urgente', color: 'bg-priority-urgent' },
];

export const CardFilters = ({
  priorityFilter,
  tagFilter,
  availableTags,
  onPriorityChange,
  onTagChange,
  onClearFilters,
}: CardFiltersProps) => {
  const hasFilters = priorityFilter !== 'all' || tagFilter !== '';
  const activeFiltersCount = (priorityFilter !== 'all' ? 1 : 0) + (tagFilter !== '' ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={cn(
              'gap-2 transition-all duration-300',
              hasFilters && 'border-primary bg-primary/5 hover:bg-primary/10'
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold animate-scale-in">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4 animate-slide-down" align="start">
          <div className="space-y-4">
            {/* Priority Filter */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Prioridade</h4>
              <div className="flex flex-wrap gap-1.5">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => onPriorityChange(p.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                      'hover:scale-105 active:scale-95',
                      priorityFilter === p.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary hover:bg-accent text-secondary-foreground'
                    )}
                  >
                    {p.color && (
                      <span className={cn('w-2 h-2 rounded-full', p.color)} />
                    )}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onTagChange('')}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                      'hover:scale-105 active:scale-95',
                      tagFilter === ''
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary hover:bg-accent text-secondary-foreground'
                    )}
                  >
                    Todas
                  </button>
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => onTagChange(tag)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                        'hover:scale-105 active:scale-95',
                        tagFilter === tag
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary hover:bg-accent text-secondary-foreground'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear Filters */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex items-center gap-1.5 animate-slide-left">
          {priorityFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs font-medium">
              <span className={cn('w-2 h-2 rounded-full', priorities.find(p => p.value === priorityFilter)?.color)} />
              {priorities.find(p => p.value === priorityFilter)?.label}
              <button
                onClick={() => onPriorityChange('all')}
                className="ml-0.5 hover:text-destructive transition-colors"
                aria-label="Remover filtro de prioridade"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {tagFilter !== '' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs font-medium">
              {tagFilter}
              <button
                onClick={() => onTagChange('')}
                className="ml-0.5 hover:text-destructive transition-colors"
                aria-label="Remover filtro de tag"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
