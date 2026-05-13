import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Recycle } from "lucide-react";

export const ReusedStockPanel = () => {
  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg dark:bg-emerald-900/30 dark:text-emerald-400">
          <Recycle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Material Reaproveitado</h2>
          <p className="text-sm text-muted-foreground">
            Registe peças retiradas de sucatas ou recuperadas (Custo zero).
          </p>
        </div>
      </div>
      
      <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 mt-6">
        <Recycle className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-medium">Formulário em construção</p>
        <p className="text-sm text-center max-w-sm mt-1">
          Este módulo permitirá dar entrada de peças antigas no stock sem afetar o preço médio de custo.
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <Button disabled>Registar Reaproveitamento</Button>
      </div>
    </Card>
  );
};
