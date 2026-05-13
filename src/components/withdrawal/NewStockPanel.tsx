import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/services/api";

type Item = { id: string; produto: string; quantidade: string; product_id?: string };
type Product = { id: string; name: string; sku: string };

function AutocompleteInput({ value, onChange, onSelectProduct, products, placeholder }: { value: string, onChange: (v: string) => void, onSelectProduct: (id: string) => void, products: Product[], placeholder: string }) {
  const [show, setShow] = useState(false);
  
  const suggestions = products.filter(p => 
    value.trim().length > 0 && 
    (p.name.toLowerCase().includes(value.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(value.toLowerCase())))
  ).slice(0, 6);

  return (
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
        className="border-input bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full"
      />
      
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-2xl overflow-hidden backdrop-blur-xl">
          {suggestions.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                onChange(s.name);
                onSelectProduct(s.id);
                setShow(false);
              }}
              className="px-3 py-2 cursor-pointer text-card-foreground hover:bg-primary hover:text-primary-foreground transition-colors flex justify-between items-center"
            >
              <span className="font-medium text-sm truncate">{s.name}</span>
              {s.sku && <span className="text-xs opacity-75 ml-2 shrink-0">{s.sku}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const NewStockPanel = () => {
  const [items, setItems] = useState<Item[]>([{ id: crypto.randomUUID(), produto: "", quantidade: "", product_id: "" }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products');
        setProducts(response.data);
      } catch (error) {
        console.error("Erro ao carregar lista de produtos:", error);
      }
    };
    fetchProducts();
  }, []);

  const update = (id: string, patch: Partial<Item>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));
  
  const add = () =>
    setItems([...items, { id: crypto.randomUUID(), produto: "", quantidade: "", product_id: "" }]);

  const submit = async () => {
    const valid = items.filter((i) => i.produto && i.quantidade);
    if (!valid.length) return toast.error("Adicione ao menos um produto válido com quantidade.");

    setIsSubmitting(true);
    try {
      const payload = valid.map(item => ({
        product_id: item.product_id || null, // Importante: enviar ID se existir, ou nome
        product_name: item.produto, 
        quantity: Number(item.quantidade),
        type: 'ENTRADA_NFE'
      }));

      await api.post('/stock/entries', { entries: payload });
      
      toast.success(`${valid.length} produto(s) novos registrados no estoque!`);
      setItems([{ id: crypto.randomUUID(), produto: "", quantidade: "", product_id: "" }]); 
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao registrar a entrada na base de dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="flex gap-3 items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            <div className="flex-1">
              {idx === 0 && <Label className="mb-2 block text-foreground font-medium">Produto</Label>}
              <AutocompleteInput
                placeholder="Nome ou SKU do produto"
                value={item.produto}
                onChange={(val) => update(item.id, { produto: val })}
                onSelectProduct={(productId) => update(item.id, { product_id: productId })}
                products={products}
              />
            </div>

            <div className="w-32">
              {idx === 0 && <Label className="mb-2 block text-foreground font-medium">Quantidade</Label>}
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={item.quantidade}
                onChange={(e) => update(item.id, { quantidade: e.target.value })}
                className="border-input bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(item.id)}
              disabled={items.length === 1}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        
        <Button 
          variant="outline" 
          onClick={add} 
          className="w-full border-input bg-transparent text-foreground hover:bg-muted hover:text-foreground mt-2"
        >
          <Plus className="size-4 mr-2" /> Adicionar produto à Fatura
        </Button>
      </div>

      <Button 
        onClick={submit} 
        disabled={isSubmitting}
        size="lg" 
        className="w-full bg-[#facc15] hover:bg-[#eab308] text-[#1e1b4b] font-bold shadow-lg transition-all"
      >
        {isSubmitting ? <Loader2 className="size-5 mr-2 animate-spin" /> : null}
        Registrar Entrada NFe
      </Button>
    </div>
  );
};
