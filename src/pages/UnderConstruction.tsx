import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function UnderConstruction() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="max-w-md w-full text-center space-y-6">
        
        {/* Ícone Animado */}
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping opacity-75" />
          <div className="relative bg-background border-2 border-yellow-500/50 rounded-full p-5 shadow-xl">
            <Construction className="w-full h-full text-yellow-500" />
          </div>
        </div>

        {/* Textos */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Em Construção</h1>
          <p className="text-muted-foreground">
            Estamos a preparar algo incrível para o novo Fluxo de Produção.
            Esta funcionalidade estará disponível em breve.
          </p>
        </div>

        {/* Barra de Progresso Decorativa */}
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-yellow-500 w-2/3 animate-pulse rounded-full" />
        </div>

        {/* Botão de Voltar */}
        <div className="pt-4">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para o início
          </Button>
        </div>
      </div>
    </div>
  );
}
