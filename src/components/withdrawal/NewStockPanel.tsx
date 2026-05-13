import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackagePlus } from "lucide-react";

export const NewStockPanel = () => {
  return (
    <Card className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
          <PackagePlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Entrada de Produtos Novos</h2>
          <p className="text-sm text-muted-foreground">
            Registe a entrada de material recém-comprado (Faturas/Fornecedores).
          </p>
        </div>
      </div>
      
      <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 mt-6">
        <PackagePlus className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-medium">Formulário em construção</p>
        <p className="text-sm text-center max-w-sm mt-1">
          Em breve poderá bipar produtos, inserir o preço de custo e a quantidade da fatura aqui.
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <Button disabled>Registar Entrada</Button>
      </div>
    </Card>
  );
};
