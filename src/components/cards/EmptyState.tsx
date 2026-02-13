import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onCreateClick: () => void;
}

export const EmptyState = ({ onCreateClick }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Layers className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
        Nenhum card ainda
      </h2>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Comece criando seu primeiro card para organizar suas informações de forma visual.
      </p>
      <Button onClick={onCreateClick} size="lg">
        Criar primeiro card
      </Button>
    </div>
  );
};
