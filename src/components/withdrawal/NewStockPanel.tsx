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
    
    // Integração com a tua API para Novos Produtos (Faturas)
    toast.success(`${valid.length} produto(s) novos registrados via NFe`);
    setItems([{ id: crypto.randomUUID(), produto: "", quantidade: "" }]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="flex gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-1">
              {idx === 0 && <Label className="mb-2 block text-[oklch(0.97_0.02_95)] font-medium">Produto</Label>}
              <Input
                placeholder="Nome ou código do produto"
                value={item.produto}
                onChange={(e) => update(item.id, { produto: e.target.value })}
                className="border-[oklch(1_0_0/14%)] bg-transparent text-[oklch(0.97_0.02_95)] placeholder:text-[oklch(0.75_0.04_95)] focus-visible:ring-[oklch(0.86_0.17_95)]"
              />
            </div>
            <div className="w-32">
              {idx === 0 && <Label className="mb-2 block text-[oklch(0.97_0.02_95)] font-medium">Quantidade</Label>}
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={item.quantidade}
                onChange={(e) => update(item.id, { quantidade: e.target.value })}
                className="border-[oklch(1_0_0/14%)] bg-transparent text-[oklch(0.97_0.02_95)] placeholder:text-[oklch(0.75_0.04_95)] focus-visible:ring-[oklch(0.86_0.17_95)]"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(item.id)}
              disabled={items.length === 1}
              className="text-[oklch(0.75_0.04_95)] hover:text-white hover:bg-[oklch(1_0_0/10%)]"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        
        <Button 
          variant="outline" 
          onClick={add} 
          className="w-full border-[oklch(1_0_0/14%)] bg-transparent text-[oklch(0.97_0.02_95)] hover:bg-[oklch(1_0_0/10%)] hover:text-[oklch(0.97_0.02_95)] mt-2"
        >
          <Plus className="size-4 mr-2" /> Adicionar produto
        </Button>
      </div>

      <Button 
        onClick={submit} 
        size="lg" 
        className="w-full bg-[oklch(0.86_0.17_95)] hover:bg-[oklch(0.86_0.17_95)]/90 text-[oklch(0.18_0.10_264)] font-medium shadow-lg transition-all"
      >
        Registrar entrada NFe
      </Button>
    </div>
  );
};
