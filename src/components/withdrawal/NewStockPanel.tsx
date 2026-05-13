import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

type Product = { id: string; name: string; sku: string };
type Item = { 
  id: string; 
  produto: string; 
  sku: string; 
  quantidade: string; 
  isValid: boolean 
};

function AutocompleteInput({ 
  value, 
  onChange, 
  onSelect, 
  products, 
  placeholder,
  isValid 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onSelect: (p: Product) => void; 
  products: Product[]; 
  placeholder: string;
  isValid: boolean;
}) {
  const [show, setShow] = useState(false);
  
  const suggestions = useMemo(() => {
    if (!value.trim()) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(value.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(value.toLowerCase()))
    ).slice(0, 6);
  }, [value, products]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShow(true);
          }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          className={cn(
            "border-input bg-transparent text-foreground placeholder:text-muted-foreground transition-all duration-200",
            !isValid && value.length > 0 && "border-destructive focus-visible:ring-destructive pr-10",
            isValid && "border-emerald-500/50 pr-10"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {!isValid && value.length > 0 && <AlertCircle className="size-4 text-destructive animate-in zoom-in" />}
          {isValid && <CheckCircle2 className="size-4 text-emerald-500 animate-in zoom-in" />}
        </div>
      </div>
      
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-[#1a1635]/95 border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="py-1">
            {suggestions.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelect(p);
                  setShow(false);
                }}
                className="group px-4 py-3 cursor-pointer hover:bg-[#facc15] transition-all flex flex-col gap-0.5 border-b border-white/5 last:border-0"
              >
                <span className="font-semibold text-sm text-foreground group-hover:text-[#1e1b4b]">
                  {p.name}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-[#1e1b4b]/70 font-bold">
                  SKU: {p.sku || "N/A"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const NewStockPanel = () => {
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), produto: "", sku: "", quantidade: "", isValid: false }
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/products').then(res => setProducts(response.data)).catch(() => {});
  }, []);

  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const handleSelectProduct = (id: string, product: Product) => {
    updateItem(id, { 
      produto: product.name, 
      sku: product.sku, 
      isValid: true 
    });
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
  
  const addItem = () => setItems([...items, { 
    id: crypto.randomUUID(), produto: "", sku: "", quantidade: "", isValid: false 
  }]);

  const canSubmit = items.every(i => i.isValid && Number(i.quantidade) > 0);

  const submit = async () => {
    if (!canSubmit) return toast.error("Verifique se todos os produtos existem no estoque.");

    setIsSubmitting(true);
    try {
      const payload = items.map(i => ({
        product_name: i.produto,
        sku: i.sku,
        quantity: Number(i.quantidade),
        type: 'ENTRADA_NFE'
      }));

      await api.post('/stock/entries', { entries: payload });
      toast.success("Entrada registrada com sucesso!");
      setItems([{ id: crypto.randomUUID(), produto: "", sku: "", quantidade: "", isValid: false }]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro na conexão com a base de dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px_45px] gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            <div className="space-y-2">
              {idx === 0 && <Label className="text-foreground">Produto (Busca no Estoque)</Label>}
              <AutocompleteInput
                placeholder="Digite o nome do material..."
                value={item.produto}
                isValid={item.isValid}
                onChange={(val) => updateItem(item.id, { produto: val, isValid: false })}
                onSelect={(p) => handleSelectProduct(item.id, p)}
                products={products}
              />
              {!item.isValid && item.produto.length > 2 && (
                <span className="text-[10px] text-destructive font-bold uppercase animate-pulse">
                  Errado: Produto não existe no estoque
                </span>
              )}
            </div>

            <div className="space-y-2">
              {idx === 0 && <Label className="text-foreground">SKU</Label>}
              <Input
                value={item.sku}
                readOnly
                placeholder="---"
                className="bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              {idx === 0 && <Label className="text-foreground">Qtd.</Label>}
              <Input
                type="number"
                min="1"
                value={item.quantidade}
                onChange={(e) => updateItem(item.id, { quantidade: e.target.value })}
                placeholder="0"
                className="border-input bg-transparent text-foreground focus-visible:ring-[#facc15]"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 mb-[2px]"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        
        <Button 
          variant="outline" 
          onClick={addItem} 
          className="w-full border-dashed border-white/20 bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground transition-all"
        >
          <Plus className="size-4 mr-2" /> Adicionar outro item da fatura
        </Button>
      </div>

      <div className="pt-4 border-t border-white/5">
        <Button 
          onClick={submit} 
          disabled={!canSubmit || isSubmitting}
          size="lg" 
          className="w-full bg-[#facc15] hover:bg-[#eab308] text-[#1e1b4b] font-bold shadow-[0_10px_20px_rgba(250,204,21,0.2)] transition-all disabled:opacity-50 disabled:grayscale"
        >
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            "Efetivar Entrada no Estoque"
          )}
        </Button>
      </div>
    </div>
  );
};
