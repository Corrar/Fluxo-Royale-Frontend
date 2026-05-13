import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Recycle } from "lucide-react";
import { toast } from "sonner";

type Item = { id: string; produto: string; quantidade: string };

export const ReusedStockPanel = () => {
  const [items, setItems] = useState<Item[]>([{ id: crypto.randomUUID(), produto: "", quantidade: "" }]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));
  
  const add = () =>
    setItems([...items, { id: crypto.randomUUID(), produto: "", quantidade: "" }]);

  const submit = () => {
    const valid = items.filter((i) => i.produto && i.quantidade);
    if (!valid.length) return toast.error("Adicione ao menos um produto válido");
    
    // Futura integração com a tua API para Sucatas/Reaproveitamento
    toast.success(`${valid.length} item(ns) classificados como reaproveitados no sistema`);
    setItems([{ id: crypto.randomUUID(), produto: "", quantidade: "" }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 text-sm animate-in fade-in">
        <Recycle className="size-5 shrink-0" />
        <p>Materiais inseridos aqui serão automaticamente classificados como <strong>Reaproveitados (Custo Zero)</strong>.</p>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="flex gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-1">
              {idx === 0 && <Label className="mb-2 block text-muted-foreground">Produto Resgatado</Label>}
              <Input
                placeholder="Ex: Bomba de Água Usada"
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
          <Plus className="size-4 mr-2" /> Adicionar material
        </Button>
      </div>

      <Button 
        onClick={submit} 
        size="lg" 
        className="w-full bg-[#facc15] hover:bg-[#eab308] text-[#1e1b4b] font-bold text-base shadow-lg hover:shadow-xl transition-all"
      >
        Registrar Reaproveitamento
      </Button>
    </div>
  );
};
