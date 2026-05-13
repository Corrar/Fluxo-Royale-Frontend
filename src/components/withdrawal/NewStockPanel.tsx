import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Item = { id: string; produto: string; quantidade: string };

export const NewStockPanel = () => {
  const [items, setItems] = useState<Item[]>([{ id: crypto.randomUUID(), produto: "", quantidade: "" }]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));
  
  const add = () =>
    setItems([...items, { id: crypto.randomUUID(), produto: "", quantidade: "" }]);

  const submit = () => {
    const valid = items.filter((i) => i.produto && i.quantidade);
    if (!valid.length) return toast.error("Adicione ao menos um produto válido");
    
    // Futura integração com a tua API para Novos Produtos (Faturas)
    toast.success(`${valid.length} produto(s) novos registrados via NFe`);
    setItems([{ id: crypto.randomUUID(), produto: "", quantidade: "" }]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="flex gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-1">
              {idx === 0 && <Label className="mb-2 block text-muted-foreground">Produto (Nome ou Código)</Label>}
              <Input
                placeholder="Ex: Motor Trifásico 2cv"
                value={item.produto}
                onChange={(e) => update(item.id, { produto: e.target.value })}
                className="bg-background/50 focus:bg-background transition-colors"
              />
            </div>
            <div className="w-32">
              {idx === 0 && <Label className="mb-2 block text-muted-foreground">Quantidade</Label>}
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={item.quantidade}
                onChange={(e) => update(item.id, { quantidade: e.target.value })}
                className="bg-background/50 focus:bg-background transition-colors"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(item.id)}
              disabled={items.length === 1}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        
        <Button variant="outline" onClick={add} className="w-full border-dashed mt-2">
          <Plus className="size-4 mr-2" /> Adicionar mais produtos da Fatura
        </Button>
      </div>

      <Button 
        onClick={submit} 
        size="lg" 
        className="w-full bg-[#facc15] hover:bg-[#eab308] text-[#1e1b4b] font-bold text-base shadow-lg hover:shadow-xl transition-all"
      >
        Registrar Entrada NFe
      </Button>
    </div>
  );
};
