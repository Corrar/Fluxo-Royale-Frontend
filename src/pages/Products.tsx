import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Package,
  Search,
  Tag,
  Box,
  Pencil,
  X,
  XCircle,
  AlertCircle,
  ShoppingBag,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  CreditCard,
  Layers
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// --- 🎨 ESTILOS DE TAGS ---
const getTagStyle = (tag: string) => {
  const styles = [
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return styles[Math.abs(hash) % styles.length];
};

// --- 💀 SKELETON LOADER ---
const ProductSkeleton = () => (
  <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] animate-pulse flex flex-col h-[230px] border border-slate-100/80 dark:border-slate-800">
    <div className="flex justify-between mb-5">
      <div className="h-6 w-24 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
      <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
    </div>
    <div className="h-7 w-3/4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3"></div>
    <div className="h-5 w-1/2 bg-slate-100 dark:bg-slate-800 rounded-xl mb-auto"></div>
    <div className="flex justify-between items-end border-t border-slate-50 dark:border-slate-800/50 pt-5 mt-4">
      <div className="h-10 w-20 bg-slate-100 dark:bg-slate-800 rounded-[14px]"></div>
      <div className="h-10 w-28 bg-slate-100 dark:bg-slate-800 rounded-[14px]"></div>
    </div>
  </div>
);

// --- 🛑 SUBCAMPONENTE: CARTÃO DE PRODUTO ---
const ProductCard = ({ 
  product, isPurchaseMode, inCart, isEditingThis, 
  onEdit, onDelete, onToggleCart, onOpenPriceDialog, 
  canManage, canEditPrice, selectedTags, toggleFilterTag, isVisible, primaryColor 
}: any) => {
  const [isNew, setIsNew] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const hasPrice = product.unit_price && parseFloat(product.unit_price) > 0;
  const priceFormatted = hasPrice ? Number(product.unit_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
  const stockDisplay = product.stock?.quantity_on_hand || 0;

  useEffect(() => {
    const seen = JSON.parse(localStorage.getItem('seen_products') || '[]');
    if (!seen.includes(product.id)) setIsNew(true);
  }, [product.id]);

  useEffect(() => {
    if (!isNew) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => {
          setIsNew(false);
          const seen = JSON.parse(localStorage.getItem('seen_products') || '[]');
          if (!seen.includes(product.id)) localStorage.setItem('seen_products', JSON.stringify([...seen, product.id]));
        }, 1500);
        if (cardRef.current) observer.unobserve(cardRef.current);
      }
    }, { threshold: 0.5 });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isNew, product.id]);

  return (
    <div
      ref={cardRef}
      onClick={() => isPurchaseMode && onToggleCart(product)}
      className={`
        relative flex flex-col p-5 sm:p-6 transition-all duration-500 group overflow-hidden
        rounded-[28px] sm:rounded-[32px] cursor-default bg-white dark:bg-slate-900
        ${isEditingThis ? "ring-2 ring-amber-400 shadow-[0_20px_50px_-12px_rgba(251,191,36,0.3)] scale-[1.02] z-10" : "shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-100/80 dark:border-slate-800/80 hover:-translate-y-1.5"}
        ${isPurchaseMode ? "cursor-pointer active:scale-[0.96]" : ""}
        ${inCart ? `ring-2 ring-${primaryColor}-500 shadow-[0_20px_50px_-12px_rgba(139,92,246,0.3)] scale-[1.02] z-10 bg-${primaryColor}-50/30 dark:bg-${primaryColor}-900/10` : ""}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

      {isNew && (
        <div className="absolute top-5 right-5 z-20 flex items-center justify-center">
          <span className={`animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-${primaryColor}-400 opacity-60 duration-1000`}></span>
          <span className={`relative inline-flex rounded-full h-3 w-3 bg-${primaryColor}-500 shadow-[0_0_12px_rgba(0,0,0,0.2)]`}></span>
        </div>
      )}

      {isPurchaseMode && (
        <div className={`absolute top-4 sm:top-5 right-4 sm:right-5 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-400 z-20 ${inCart ? `bg-${primaryColor}-500 text-white shadow-lg shadow-${primaryColor}-500/40 scale-110` : "bg-slate-50 border-2 border-slate-200 text-transparent"}`}>
          <CheckCircle2 className="h-5 w-5" strokeWidth={3.5} />
        </div>
      )}

      <div className="flex justify-between items-start mb-4 pr-10 relative z-10">
        <Badge variant="outline" className="font-mono text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-1 rounded-[10px] bg-slate-50/80 text-slate-500 border-none dark:bg-slate-800 dark:text-slate-400 font-bold tracking-widest uppercase">
          {product.sku}
        </Badge>

        {canManage && !isPurchaseMode && (
          <div className={`flex gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full p-1 shadow-sm border border-slate-50 dark:border-slate-800 transition-all duration-300 ${isEditingThis ? "opacity-100" : "opacity-100 lg:opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full active:scale-90" onClick={(e) => { e.stopPropagation(); onEdit(product); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-full active:scale-90" onClick={(e) => { e.stopPropagation(); onDelete(product.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <h3 className={`font-extrabold text-[16px] sm:text-[18px] leading-tight mb-3 line-clamp-2 min-h-[44px] sm:min-h-[48px] tracking-tight relative z-10 ${isEditingThis ? "text-amber-900 dark:text-amber-100" : "text-slate-900 dark:text-white"}`} title={product.name}>
        {product.name}
      </h3>

      {product.tags && Array.isArray(product.tags) && product.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto mb-4 relative z-10">
          {product.tags.map((tag: string) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <Badge 
                key={tag} 
                className={`text-[9px] sm:text-[10px] px-2.5 sm:px-3 py-1 rounded-[8px] font-bold border-none cursor-pointer transition-all active:scale-95 ${isSelected ? `bg-${primaryColor}-500 text-white shadow-md` : "bg-slate-100/80 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}
                variant="outline"
                onClick={(e) => { e.stopPropagation(); toggleFilterTag(tag); }}
              >
                {tag}
              </Badge>
            );
          })}
        </div>
      )}

      <div className={`flex items-end justify-between mt-auto pt-4 border-t relative z-10 ${isEditingThis ? "border-amber-200/50" : "border-slate-100/80 dark:border-slate-800"}`}>
        <div className="flex flex-col">
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Disponível</span>
          <div className="flex items-baseline gap-1 text-slate-800 dark:text-slate-200">
            <span className="font-black text-xl sm:text-2xl leading-none tracking-tighter">{isVisible ? stockDisplay : "••••"}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 lowercase">{product.unit}</span>
          </div>
        </div>

        {canEditPrice && !isPurchaseMode && (
          <div className="flex flex-col items-end group/price">
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Unitário</span>
            <div 
              onClick={(e) => { e.stopPropagation(); onOpenPriceDialog(product); }}
              className={`font-black flex items-center gap-1.5 cursor-pointer px-2 sm:px-3 py-1.5 rounded-[12px] hover:bg-slate-50 dark:hover:bg-slate-800 -mr-2 sm:-mr-3 transition-colors active:scale-95 ${hasPrice ? "text-slate-900 dark:text-white text-[16px] sm:text-[18px] tracking-tighter" : `text-${primaryColor}-500 text-[14px]`}`}
            >
              {!hasPrice && <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
              {isVisible ? (hasPrice ? priceFormatted : "Definir") : "R$ ••••"}
              <div className="bg-white dark:bg-slate-900 rounded-full p-1 opacity-0 group-hover/price:opacity-100 transition-all scale-75 group-hover/price:scale-100 shadow-sm border border-slate-100 dark:border-slate-800 hidden sm:block">
                <Pencil className={`h-3 w-3 text-${primaryColor}-500`} strokeWidth={3} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function Products() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [priceDialog, setPriceDialog] = useState(false);
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<any>(null);
  const [priceValue, setPriceValue] = useState("");
  const [isPurchaseMode, setIsPurchaseMode] = useState(false);
  const [purchaseCart, setPurchaseCart] = useState<{ product: any; quantity: number }[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState({ date: "", note: "" });
  const [useAutoSku, setUseAutoSku] = useState(true);
  const [tagInput, setTagInput] = useState("");
  const [formData, setFormData] = useState({ sku: "", name: "", description: "", unit: "", min_stock: "0", quantity: "0", unit_price: "0", tags: [] as string[] });
  
  const [isVisible, setIsVisible] = useState(true);
  const [showMobileForm, setShowMobileForm] = useState(false);

  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";
  const canEditTags = profile?.role === "admin" || profile?.role === "almoxarife";
  const canEditPrice = profile?.role === "compras" || profile?.role === "admin";

  const canViewTotalValue = ["admin", "almoxarife", "chefe", "compras", "gerente"].includes(profile?.role || "");

  const primaryColor = isPurchaseMode ? "violet" : "emerald";

  const { data: products, isLoading } = useQuery<any[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data.map((p: any) => {
        let normalizedTags: string[] = [];
        if (p.tags) {
            if (Array.isArray(p.tags)) normalizedTags = p.tags;
            else if (typeof p.tags === 'string') {
               try {
                  const parsed = JSON.parse(p.tags);
                  if (Array.isArray(parsed)) normalizedTags = parsed;
               } catch {
                  if (p.tags.trim() !== "" && p.tags !== "[]") normalizedTags = p.tags.replace(/[\[\]"]/g, '').split(',').map((t: string) => t.trim()).filter((t: string) => t !== "");
               }
            }
        }
        return { ...p, tags: normalizedTags };
      });
    },
  });

  useEffect(() => {
    if (products && products.length > 0) {
      const isInitialized = localStorage.getItem('seen_products_initialized');
      if (!isInitialized) {
        localStorage.setItem('seen_products', JSON.stringify(products.map(p => p.id)));
        localStorage.setItem('seen_products_initialized', 'true');
      }
    }
  }, [products]);

  const availableTags = useMemo<string[]>(() => {
    if (!products) return [];
    return Array.from(new Set((products as any[]).flatMap((p: any) => (p.tags as string[]) || []))).sort();
  }, [products]);

  const nextSku = useMemo(() => {
    const MIN_START = 236;
    if (!products || products.length === 0) return `9.99.${(MIN_START + 1).toString().padStart(4, "0")}`;
    const maxExisting = Math.max(0, ...products.map((p: any) => p.sku?.startsWith("9.99.") ? parseInt(p.sku.split(".")[2]) || 0 : 0));
    return `9.99.${(Math.max(MIN_START, maxExisting) + 1).toString().padStart(4, "0")}`;
  }, [products]);

  const currentSkuDisplay = useAutoSku ? nextSku : formData.sku;

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.post("/products", { ...data, tags: Array.isArray(data.tags) ? data.tags : [] })).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Produto criado com sucesso!`);
      resetForm();
      setShowMobileForm(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.put(`/products/${id}`, { ...data, tags: Array.isArray(data.tags) ? data.tags : [] })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto atualizado com sucesso!");
      resetForm();
      setShowMobileForm(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído.");
      setDeleteDialog(false);
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { unit_price: price }),
    onMutate: async ({ id, price }) => {
        await queryClient.cancelQueries({ queryKey: ["products"] });
        const prev = queryClient.getQueryData<any[]>(["products"]);
        queryClient.setQueryData<any[]>(["products"], (old) => old?.map((p) => p.id === id ? { ...p, unit_price: price } : p));
        return { prev };
    },
    onError: (_err, _new, context) => {
        if (context?.prev) queryClient.setQueryData(["products"], context.prev);
        toast.error("Falha ao atualizar o preço.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onSuccess: () => { toast.success("Preço atualizado!"); setPriceDialog(false); }
  });

  const registerPurchaseMutation = useMutation({
    mutationFn: async (data: { items: any[]; date: string; note: string }) => {
      const valids = data.items.filter((i) => Number(i.quantity) > 0);
      await Promise.all(valids.map((i) => api.put(`/products/${i.product.id}/purchase-info`, {
        purchase_status: "comprado",
        purchase_note: `[Compra Avulsa] Qtd: ${i.quantity} ${i.product.unit}${data.note ? ` | ${data.note.trim()}` : ""}`,
        delivery_forecast: data.date || null,
      })));
      return valids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Pedido fechado com sucesso!");
      setPurchaseDialogOpen(false); setIsPurchaseMode(false); setPurchaseCart([]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.unit) return toast.error("Preencha Nome e Unidade");
    const data = { ...formData, sku: useAutoSku ? nextSku : formData.sku, min_stock: parseFloat(formData.min_stock) || 0, quantity: parseFloat(formData.quantity) || 0, unit_price: parseFloat(formData.unit_price) || 0 };
    editingProduct ? updateMutation.mutate({ id: editingProduct.id, data }) : createMutation.mutate(data);
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product); setUseAutoSku(false);
    setFormData({ sku: product.sku, name: product.name, description: product.description || "", unit: product.unit, min_stock: product.min_stock?.toString() || "0", quantity: (product.stock?.quantity_on_hand || "0").toString(), unit_price: product.unit_price?.toString() || "0", tags: product.tags || [] });
    setShowMobileForm(true);
  };

  const resetForm = () => { setFormData({ sku: "", name: "", description: "", unit: "", min_stock: "0", quantity: "0", unit_price: "0", tags: [] }); setEditingProduct(null); setUseAutoSku(true); setTagInput(""); };
  
  const handleConfirmPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForPrice) return;
    const numericPrice = parseFloat(priceValue.replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice < 0) return toast.error("Insira um valor válido.");
    updatePriceMutation.mutate({ id: selectedProductForPrice.id, price: numericPrice });
  };

  const handleAddTag = () => {
    const cleanTag = tagInput.trim();
    if (cleanTag && !formData.tags.includes(cleanTag)) { setFormData(f => ({ ...f, tags: [...f.tags, cleanTag] })); setTagInput(""); }
  };

  const toggleFilterTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    setCurrentPage(1); 
  };

  const toggleProductInCart = (product: any) => setPurchaseCart(prev => prev.find(i => i.product.id === product.id) ? prev.filter(i => i.product.id !== product.id) : [...prev, { product, quantity: 0 }]);
  const updateCartQuantity = (productId: string, qty: number) => setPurchaseCart(purchaseCart.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item)));
  const handleFinalizePurchase = () => registerPurchaseMutation.mutate({ items: purchaseCart, date: purchaseDetails.date, note: purchaseDetails.note });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;

    if (searchTerm) {
      const normalizeStr = (str: string) => 
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

      const normalizedSearchTerm = normalizeStr(searchTerm);
      const rawSearchTerm = normalizedSearchTerm.replace(/\./g, "");
      const searchWords = normalizedSearchTerm.split(" ").filter(w => w.length > 0);

      result = result.filter((p: any) => {
        const normalizedName = normalizeStr(p.name);
        const normalizedSku = normalizeStr(p.sku).replace(/\./g, "");
        const tagsString = normalizeStr((p.tags || []).join(" "));

        if (normalizedSku.includes(rawSearchTerm)) return true;

        return searchWords.every(word => 
          normalizedName.includes(word) || tagsString.includes(word)
        );
      });
    }

    if (selectedTags.length > 0) {
      result = result.filter((p: any) => p.tags && selectedTags.every((t) => p.tags.includes(t)));
    }
    
    return result;
  }, [products, searchTerm, selectedTags]);

  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredProducts, currentPage]);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const totalItems = products?.length || 0;
  const totalValue = products?.reduce((acc, p) => acc + (parseFloat(p.unit_price || "0") * parseFloat(p.stock?.quantity_on_hand || "0")), 0) || 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-slate-950 font-sans pb-28 sm:pb-24 transition-colors duration-500">
      
      {/* --- HEADER DE CONTEXTO DINÂMICO --- */}
      <div className={`pt-10 pb-20 px-4 sm:px-6 relative z-10 shrink-0 rounded-b-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-700 ${isPurchaseMode ? 'bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700' : 'bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600'}`}>
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-white/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className={`absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] ${isPurchaseMode ? 'bg-fuchsia-400/20' : 'bg-teal-300/20'} blur-[80px] rounded-full pointer-events-none transition-colors duration-700`}></div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8 relative z-10">
          <div className="flex flex-col gap-1.5 text-white">
            <div className="flex items-center gap-2 font-bold text-[11px] sm:text-[12px] uppercase tracking-widest mb-1 opacity-80">
              {isPurchaseMode ? <ShoppingBag className="h-4 w-4" /> : (canViewTotalValue ? <TrendingUp className="h-4 w-4" /> : <Package className="h-4 w-4" />)}
              <span>{isPurchaseMode ? "Área de Compras" : (canViewTotalValue ? "Patrimônio Total" : "Produtos Cadastrados")}</span>
              {!isPurchaseMode && (
                <button onClick={() => setIsVisible(!isVisible)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors ml-1 active:scale-90">
                  {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              )}
            </div>
            
            <div className="flex items-baseline gap-1 sm:gap-2 drop-shadow-sm">
              {!isPurchaseMode && canViewTotalValue && <span className="text-xl sm:text-2xl font-medium opacity-90">R$</span>}
              <h1 className="text-4xl sm:text-5xl md:text-[64px] leading-none font-black tracking-tighter">
                {isPurchaseMode 
                  ? "Catálogo" 
                  : (canViewTotalValue 
                      ? (isVisible ? totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "••••")
                      : (isVisible ? totalItems : "••") 
                    )}
              </h1>
            </div>
            
            <p className="font-medium sm:font-semibold text-sm sm:text-[15px] mt-1 sm:mt-2 opacity-90">
              {isPurchaseMode 
                ? "Toque nos produtos para adicionar ao carrinho." 
                : (canViewTotalValue 
                    ? `Controle absoluto sobre ${isVisible ? totalItems : "••"} itens.` 
                    : "Catálogo de itens e produtos disponíveis."
                  )}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            {canEditPrice && !canManage && (
              <Button
                variant="outline"
                className={`rounded-[16px] sm:rounded-[20px] h-12 sm:h-14 w-full sm:w-auto px-5 sm:px-7 font-black text-sm sm:text-base border-none transition-all shadow-lg active:scale-95 ${isPurchaseMode ? "bg-white text-violet-600 shadow-white/20 hover:scale-105" : "bg-white/20 text-white hover:bg-white/30 backdrop-blur-md"}`}
                onClick={() => { setIsPurchaseMode(!isPurchaseMode); setPurchaseCart([]); }}
              >
                {isPurchaseMode ? <X className="h-4 sm:h-5 w-4 sm:w-5 mr-2" /> : <ShoppingBag className="h-4 sm:h-5 w-4 sm:w-5 mr-2" />}
                {isPurchaseMode ? "Cancelar" : "Iniciar Compra"}
              </Button>
            )}

            {canManage && canEditPrice && (
              <Button
                variant="secondary"
                className={`rounded-[16px] sm:rounded-[20px] h-12 sm:h-14 w-full sm:w-auto px-5 sm:px-7 font-black text-sm sm:text-base border-none transition-all shadow-lg active:scale-95 ${isPurchaseMode ? "bg-white text-violet-600 shadow-white/20 hover:scale-105" : "bg-white text-emerald-600 hover:bg-slate-50 hover:scale-105"}`}
                onClick={() => { setIsPurchaseMode(!isPurchaseMode); setEditingProduct(null); setPurchaseCart([]); }}
              >
                {isPurchaseMode ? <X className="h-4 sm:h-5 w-4 sm:w-5 mr-2" /> : <ShoppingBag className="h-4 sm:h-5 w-4 sm:w-5 mr-2" />}
                {isPurchaseMode ? "Sair da Compra" : "Modo Compra"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* --- CORPO PRINCIPAL --- */}
      <div className="flex-1 -mt-10 sm:-mt-12 relative z-20 px-3 sm:px-4 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Formulário - Drawer no Mobile / Card Fixo Otimizado no Desktop */}
        {canManage && !isPurchaseMode && (
          <>
            <div 
              className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[998] transition-opacity duration-300 lg:hidden ${showMobileForm ? "opacity-100" : "opacity-0 pointer-events-none"}`} 
              onClick={() => setShowMobileForm(false)} 
            />

            <div className={`fixed inset-x-0 bottom-0 z-[999] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showMobileForm ? "translate-y-0" : "translate-y-full"} lg:static lg:translate-y-0 lg:z-auto lg:block lg:col-span-4 xl:col-span-4 lg:h-fit lg:sticky lg:top-6`}>
              <div className={`bg-white dark:bg-slate-900 rounded-t-[40px] lg:rounded-[32px] p-6 pb-28 lg:p-5 lg:pb-5 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.1)] lg:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border-t border-slate-100/80 lg:border dark:border-slate-800 flex flex-col max-h-[90vh] lg:max-h-none overflow-y-auto custom-scrollbar transition-all duration-500 ${editingProduct ? "ring-0 lg:ring-2 ring-amber-400/50" : ""}`}>
                
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5 lg:hidden shrink-0"></div>

                <div className="flex items-center justify-between mb-5 shrink-0">
                  <h2 className={`text-xl lg:text-lg font-black tracking-tight flex items-center gap-3 lg:gap-2 ${editingProduct ? "text-amber-500" : "text-slate-800 dark:text-white"}`}>
                    {editingProduct ? <Pencil className="h-5 w-5" /> : <div className={`h-10 w-10 lg:h-8 lg:w-8 bg-${primaryColor}-50 text-${primaryColor}-500 rounded-[12px] flex items-center justify-center shadow-inner`}><Plus className="h-6 w-6 lg:h-5 lg:w-5" strokeWidth={3} /></div>}
                    {editingProduct ? "Editando Produto" : "Novo Produto"}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={() => { resetForm(); setShowMobileForm(false); }} className="h-10 w-10 lg:h-8 lg:w-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 active:scale-90 transition-transform">
                    <X className="h-5 w-5 lg:h-4 lg:w-4" strokeWidth={3} />
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 lg:ml-1">Nome do Produto</Label>
                    <Input
                      placeholder="Ex: Parafuso Sextavado M8"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`font-bold text-sm bg-slate-50/80 border-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-${primaryColor}-500/30 rounded-[16px] lg:rounded-[12px] h-12 lg:h-10 px-4 shadow-inner transition-all dark:bg-slate-800`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 lg:ml-1">Unidade</Label>
                      <Select value={formData.unit} onValueChange={(val) => setFormData({ ...formData, unit: val })}>
                        <SelectTrigger className={`font-bold bg-slate-50/80 border-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-${primaryColor}-500/30 rounded-[16px] lg:rounded-[12px] h-12 lg:h-10 px-4 shadow-inner dark:bg-slate-800 text-sm transition-all`}><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent className="rounded-[20px] p-2 border-none shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
                          {["UN", "KG", "M", "CX", "PCT", "L", "PAR", "JG"].map((u) => <SelectItem key={u} value={u} className="rounded-xl lg:rounded-lg font-bold py-2.5 cursor-pointer">{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 lg:ml-1">Mínimo</Label>
                      <Input
                        type="number" step="0.01"
                        value={formData.min_stock}
                        onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                        className={`font-bold text-base text-center bg-slate-50/80 border-transparent hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-${primaryColor}-500/30 rounded-[16px] lg:rounded-[12px] h-12 lg:h-10 shadow-inner dark:bg-slate-800 transition-all [&::-webkit-inner-spin-button]:appearance-none`}
                      />
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-[11px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 lg:ml-1">{editingProduct ? "Ajustar Estoque" : "Estoque Inicial"}</Label>
                      <Input
                        type="number" step="0.01"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className={`h-14 lg:h-12 text-2xl lg:text-xl text-center font-black rounded-[18px] lg:rounded-[14px] shadow-inner transition-all duration-300 focus:ring-2 [&::-webkit-inner-spin-button]:appearance-none ${editingProduct ? "bg-amber-50 text-amber-600 focus:ring-amber-500/40 focus:bg-white" : `bg-slate-50/80 border-transparent text-slate-800 focus:ring-${primaryColor}-500/30 focus:bg-white dark:bg-slate-800 dark:text-white`}`}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {canEditTags && (
                    <div className="space-y-3 bg-slate-50/50 dark:bg-slate-800/30 p-4 lg:p-3 rounded-[20px] lg:rounded-[16px] border border-slate-100/50 dark:border-slate-800/50">
                      <Label className="text-[10px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <Tag className="h-3 w-3" /> Etiquetas Rápidas
                      </Label>
                      <div className="flex gap-2 relative">
                        <Input
                          placeholder="Nome da tag..."
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                          className={`font-bold text-sm bg-white border-transparent rounded-[14px] lg:rounded-[10px] h-12 lg:h-10 pr-12 shadow-sm focus:ring-2 focus:ring-${primaryColor}-500/30 dark:bg-slate-900 transition-all`}
                        />
                        <Button type="button" onClick={handleAddTag} className={`absolute right-1.5 top-1.5 bottom-1.5 h-9 w-9 lg:h-7 lg:w-7 rounded-xl lg:rounded-lg bg-slate-100 text-slate-600 hover:text-${primaryColor}-600 hover:bg-slate-200 shadow-none p-0 active:scale-90 transition-all`}>
                          <Plus className="h-5 w-5 lg:h-4 lg:w-4" strokeWidth={3} />
                        </Button>
                      </div>
                      {formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {formData.tags.map((tag) => (
                            <Badge key={tag} className={`flex items-center gap-1 pl-2.5 pr-1 py-1 font-bold rounded-xl lg:rounded-lg ${getTagStyle(tag)} border-none shadow-sm text-[10px]`} variant="outline">
                              {tag}
                              <div onClick={() => setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })} className="bg-black/5 hover:bg-black/10 rounded-lg lg:rounded-md p-0.5 cursor-pointer active:scale-90 transition-transform">
                                <X className="h-3 w-3" strokeWidth={3} />
                              </div>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 p-3.5 lg:p-2.5 rounded-[16px] lg:rounded-[12px]">
                    <div className="flex flex-col">
                      <Label className="text-[10px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 lg:mb-0">Código SKU</Label>
                      <span className="font-mono font-black text-slate-700 dark:text-slate-300 tracking-wider text-xs">{currentSkuDisplay}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-black text-${primaryColor}-500 uppercase tracking-widest`}>Auto</span>
                      <Switch checked={useAutoSku} onCheckedChange={setUseAutoSku} className={`data-[state=checked]:bg-${primaryColor}-500 shadow-sm scale-75 lg:scale-50`} />
                    </div>
                  </div>
                  {!useAutoSku && (
                      <Input
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                          className={`font-mono text-center font-bold text-sm tracking-widest rounded-[14px] lg:rounded-[10px] h-12 lg:h-10 bg-white shadow-sm border-2 border-${primaryColor}-500/20 focus:border-${primaryColor}-500 focus:ring-2 focus:ring-${primaryColor}-500/20 transition-all`}
                          placeholder="SKU manual"
                      />
                  )}

                  <div className="pt-2 lg:pt-1">
                    <Button
                      type="submit"
                      className={`w-full h-14 lg:h-12 rounded-[20px] lg:rounded-[14px] font-black text-[16px] lg:text-[14px] shadow-lg transition-all active:scale-[0.97] hover:-translate-y-0.5 ${editingProduct ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 ring-2 ring-amber-500/10" : `bg-${primaryColor}-500 hover:bg-${primaryColor}-600 text-white shadow-${primaryColor}-500/30 ring-2 ring-${primaryColor}-500/10`}`}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingProduct ? (updateMutation.isPending ? "Salvando..." : "Salvar Edição") : (
                        <><Plus className="h-5 w-5 lg:h-4 lg:w-4 mr-2" strokeWidth={3} /> {createMutation.isPending ? "Criando..." : "Cadastrar"}</>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* FAB (Floating Action Button) para Cadastrar no Mobile */}
        {canManage && !isPurchaseMode && !showMobileForm && (
            <button
              onClick={() => { resetForm(); setShowMobileForm(true); }}
              className={`lg:hidden fixed bottom-28 right-5 h-16 w-16 bg-${primaryColor}-500 text-white rounded-[24px] shadow-[0_10px_30px_rgba(16,185,129,0.4)] flex items-center justify-center z-[90] active:scale-90 transition-transform`}
            >
              <Plus className="h-8 w-8" strokeWidth={3} />
            </button>
        )}

        {/* --- ÁREA PRINCIPAL (Busca Inteligente e Lista) --- */}
        <div className={`${canManage && !isPurchaseMode ? "lg:col-span-8 xl:col-span-8" : "lg:col-span-12"} flex flex-col h-full`}>
          
          {/* Super Search Bar */}
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[24px] sm:rounded-[32px] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100/50 dark:border-slate-800 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center gap-2 relative z-10">
            <div className="relative w-full flex-1">
              <Search className={`absolute left-5 sm:left-6 top-1/2 transform -translate-y-1/2 h-5 sm:h-6 w-5 sm:w-6 text-slate-400 group-focus-within:text-${primaryColor}-500 transition-colors duration-300`} strokeWidth={2.5} />
              <Input
                placeholder="Busque por nome, SKU ou tag..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className={`pl-12 sm:pl-16 pr-12 bg-transparent border-none rounded-[20px] sm:rounded-[28px] h-14 sm:h-16 text-[16px] sm:text-[18px] font-bold shadow-none focus-visible:ring-0 w-full placeholder:text-slate-400 placeholder:font-semibold text-slate-800 dark:text-white transition-all`}
              />
              {searchTerm && (
                <button 
                  onClick={() => { setSearchTerm(""); setCurrentPage(1); }} 
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors active:scale-90 p-1"
                >
                  <XCircle className="h-6 w-6" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {availableTags.length > 0 && (
            <div className="flex gap-2.5 items-center mb-6 sm:mb-8 px-1 sm:px-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 shrink-0"><Layers className="h-4 w-4" /> Filtros:</span>
              {availableTags.map((tag: string) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge 
                    key={tag} 
                    variant="outline"
                    className={`shrink-0 cursor-pointer transition-all duration-300 rounded-[12px] sm:rounded-[14px] px-3 sm:px-4 py-2 border-none font-bold text-[12px] sm:text-[13px] active:scale-95 ${isSelected ? `bg-${primaryColor}-500 text-white shadow-lg shadow-${primaryColor}-500/30 scale-105` : `bg-white/80 text-slate-600 hover:bg-white shadow-[0_2px_15px_rgba(0,0,0,0.04)] border border-slate-100/50 dark:bg-slate-800 dark:text-slate-300`}`}
                    onClick={() => toggleFilterTag(tag)}
                  >
                    {tag}
                  </Badge>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-1 sm:pr-3 custom-scrollbar pb-10">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                 <ProductSkeleton /><ProductSkeleton /><ProductSkeleton /><ProductSkeleton />
              </div>
            ) : filteredProducts?.length === 0 ? (
              <div className="h-[40vh] sm:h-[50vh] flex flex-col items-center justify-center text-slate-500 bg-white/40 dark:bg-slate-900/40 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800 mx-1">
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-[32px] mb-6 shadow-sm">
                  <Search className="h-10 w-10 sm:h-14 sm:w-14 text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="font-black text-2xl sm:text-3xl tracking-tight text-slate-800 dark:text-slate-200 text-center px-4">
                  Nenhum resultado
                </p>
                <p className="text-base sm:text-lg mt-2 font-medium text-slate-400 text-center px-4 max-w-sm">
                  {searchTerm ? `Não encontramos nada parecido com "${searchTerm}".` : "Verifique os filtros aplicados."}
                </p>
                {(searchTerm || selectedTags.length > 0) && (
                  <Button 
                    variant="ghost" 
                    onClick={() => { setSearchTerm(""); setSelectedTags([]); }} 
                    className="mt-6 rounded-[20px] font-bold h-12 sm:h-14 px-8 bg-slate-800 text-white hover:bg-slate-700 shadow-xl shadow-slate-800/20 active:scale-95"
                  >
                    Limpar Busca
                  </Button>
                )}
              </div>
            ) : (
              <div className={`grid grid-cols-1 gap-5 sm:gap-6 ${canManage && !isPurchaseMode ? "md:grid-cols-2 xl:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                {paginatedProducts.map((product: any) => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    isPurchaseMode={isPurchaseMode}
                    inCart={purchaseCart.some((i) => i.product.id === product.id)}
                    isEditingThis={editingProduct?.id === product.id}
                    onEdit={handleEdit}
                    onDelete={() => { setProductToDelete(product.id); setDeleteDialog(true); }}
                    onToggleCart={toggleProductInCart}
                    onOpenPriceDialog={() => {
                        setSelectedProductForPrice(product);
                        setPriceValue(product.unit_price ? product.unit_price.toString() : "");
                        setPriceDialog(true);
                    }}
                    canManage={canManage}
                    canEditPrice={canEditPrice}
                    selectedTags={selectedTags}
                    toggleFilterTag={toggleFilterTag}
                    isVisible={isVisible}
                    primaryColor={primaryColor}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Paginação Pílula Flutuante Apple Style */}
          {filteredProducts.length > ITEMS_PER_PAGE && (
            <div className="mt-2 flex justify-center pb-4">
              <div className="bg-white/90 dark:bg-slate-900/90 p-1.5 sm:p-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100/50 dark:border-slate-800 inline-flex items-center gap-1 backdrop-blur-2xl">
                <Button variant="ghost" className="rounded-full h-12 sm:h-14 px-5 sm:px-7 font-black text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all text-sm sm:text-[15px]" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Voltar
                </Button>
                <div className="px-2 sm:px-4">
                  <span className="text-[15px] sm:text-[16px] font-black text-slate-800 dark:text-slate-200">{currentPage} <span className="text-slate-300 mx-1 sm:mx-2">/</span> {totalPages}</span>
                </div>
                <Button variant="ghost" className="rounded-full h-12 sm:h-14 px-5 sm:px-7 font-black text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition-all text-sm sm:text-[15px]" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Avançar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- DOCK DE COMPRAS (Ilha Dinâmica de Alta Conversão) --- */}
      {isPurchaseMode && purchaseCart.length > 0 && (
        <div className="fixed bottom-6 sm:bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-3xl text-white shadow-[0_40px_100px_rgba(0,0,0,0.4)] ring-1 ring-white/10 rounded-[32px] sm:rounded-[40px] pl-4 sm:pl-5 pr-3 sm:pr-4 py-3 sm:py-4 flex items-center gap-4 sm:gap-8 z-50 animate-in slide-in-from-bottom-12 duration-500 w-[90vw] sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-4">
            <div className="bg-violet-500 rounded-full h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center font-black text-xl sm:text-2xl text-white shadow-inner">{purchaseCart.length}</div>
            <div className="flex flex-col pr-2">
              <span className="text-[15px] sm:text-[17px] font-black leading-tight tracking-tight">Carrinho</span>
              <span className="text-[10px] sm:text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Pronto para fechar</span>
            </div>
          </div>
          <Button className="bg-white text-violet-600 hover:bg-slate-50 font-black rounded-[24px] sm:rounded-[28px] pl-6 sm:pl-8 pr-4 sm:pr-6 h-14 sm:h-16 text-[15px] sm:text-[17px] flex items-center gap-2 sm:gap-3 shadow-[0_10px_30px_rgba(255,255,255,0.2)] active:scale-95 transition-all" onClick={() => setPurchaseDialogOpen(true)}>
            Revisar <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={3} />
          </Button>
        </div>
      )}

      {/* --- MODAIS BOTTOM SHEET (Padrão Ouro UX Mobile) --- */}

      {/* Modal Exclusão */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="w-full max-w-[100vw] sm:max-w-sm !rounded-b-none !rounded-t-[40px] sm:!rounded-[40px] p-8 sm:p-10 text-center bg-white dark:bg-slate-900 border-none shadow-[0_-20px_80px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl !top-auto !bottom-0 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%] absolute sm:fixed mx-auto">
          <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8 sm:hidden"></div>
          <div className="mx-auto bg-red-50 text-red-500 h-20 w-20 rounded-[28px] flex items-center justify-center mb-6 shadow-inner">
            <Trash2 className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-black text-center tracking-tight text-slate-900">Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-center font-semibold mt-3 text-slate-500">
              Esta ação removerá o item do sistema de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 mt-10">
            <AlertDialogCancel className="rounded-[24px] h-16 flex-1 mt-0 font-bold border-none bg-slate-100 hover:bg-slate-200 text-[17px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => productToDelete && deleteMutation.mutate(productToDelete)} className="rounded-[24px] h-16 flex-1 bg-red-500 hover:bg-red-600 font-bold shadow-xl shadow-red-500/20 text-[17px]">Sim, excluir</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL DE PREÇO */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent className={`w-full max-w-[100vw] sm:max-w-sm !rounded-b-none !rounded-t-[48px] sm:!rounded-[48px] p-8 sm:p-12 bg-white dark:bg-slate-900 border-none shadow-[0_-20px_80px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl gap-4 !top-auto !bottom-0 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%] absolute sm:fixed mx-auto`}>
          <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>
          
          <DialogHeader className="space-y-4">
            <div className={`mx-auto bg-${primaryColor}-50 dark:bg-${primaryColor}-900/30 text-${primaryColor}-500 p-5 rounded-[24px] w-fit shadow-sm`}>
              <CreditCard className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-center text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Ajustar Preço
            </DialogTitle>
            <p className="text-center text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {selectedProductForPrice?.name}
            </p>
          </DialogHeader>
          
          <form onSubmit={handleConfirmPrice} className="space-y-10 pt-6">
            <div className={`flex justify-center items-center gap-3 border-b-4 border-slate-100 dark:border-slate-800 pb-3 focus-within:border-${primaryColor}-500 transition-colors mx-auto w-fit px-4`}>
              <span className={`text-4xl font-black text-${primaryColor}-500`}>R$</span>
              <input
                type="number" step="0.01"
                className="text-6xl font-black w-full max-w-[200px] text-center bg-transparent text-slate-900 dark:text-white outline-none placeholder:text-slate-200 tracking-tighter [&::-webkit-inner-spin-button]:appearance-none"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                autoFocus
                placeholder="0,00"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" type="button" onClick={() => setPriceDialog(false)} className="rounded-[24px] h-16 flex-1 font-bold text-slate-500 border-slate-200 bg-slate-50 active:scale-95 transition-transform text-[18px] hidden sm:flex">Cancelar</Button>
              <Button type="submit" className={`rounded-[24px] h-16 flex-[2] font-black bg-${primaryColor}-500 hover:bg-${primaryColor}-600 text-white shadow-xl shadow-${primaryColor}-500/30 active:scale-95 transition-transform text-[18px]`}>Atualizar Valor</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Compra (Carrinho Drawer Perfeito) */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="w-full max-w-[100vw] sm:max-w-md !rounded-b-none !rounded-t-[48px] sm:!rounded-[48px] p-6 sm:p-10 bg-slate-50 dark:bg-slate-900 border-none shadow-[0_-30px_100px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl overflow-y-auto max-h-[90vh] !top-auto !bottom-0 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%] absolute sm:fixed mx-auto pb-8">
          <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-8 sm:hidden"></div>

          <DialogHeader className="mb-6 sm:mb-8 relative">
            <div className="absolute top-0 right-0 hidden sm:block">
              <Button variant="ghost" size="icon" onClick={() => setPurchaseDialogOpen(false)} className="rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 h-12 w-12"><X className="h-6 w-6"/></Button>
            </div>
            <div className="h-20 w-20 bg-white text-violet-600 rounded-[28px] flex items-center justify-center mb-6 mx-auto shadow-lg shadow-violet-500/10 border border-slate-100">
              <ShoppingBag className="h-10 w-10" strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-3xl font-black text-center text-slate-900 tracking-tight">Fechar Pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 sm:space-y-6">
            <div className="bg-white rounded-[32px] p-2 shadow-sm border border-slate-100 max-h-[35vh] overflow-y-auto custom-scrollbar">
              {purchaseCart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-[24px] transition-colors">
                  <div className="flex flex-col flex-1 pr-2 sm:pr-4 overflow-hidden">
                    <span className="font-black text-[15px] sm:text-[17px] truncate text-slate-800">{item.product.name}</span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.product.unit}</span>
                  </div>
                  <div className="w-24 sm:w-28 shrink-0 relative">
                    <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd</span>
                    <Input 
                      type="number" 
                      className="h-12 sm:h-14 pl-10 sm:pl-12 rounded-[16px] sm:rounded-[20px] text-center font-black text-[18px] sm:text-[20px] bg-slate-100/70 border-none focus:ring-4 focus:ring-violet-500/20 focus:bg-white transition-all shadow-inner [&::-webkit-inner-spin-button]:appearance-none" 
                      placeholder="0" 
                      value={item.quantity || ""} 
                      onChange={(e) => updateCartQuantity(item.product.id, parseFloat(e.target.value))} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Previsão</Label>
                <Input type="date" className="rounded-[20px] sm:rounded-[24px] h-14 sm:h-16 bg-white border-none font-bold text-sm sm:text-base px-4 sm:px-6 shadow-sm focus:ring-4 focus:ring-violet-500/20" value={purchaseDetails.date} onChange={(e) => setPurchaseDetails({ ...purchaseDetails, date: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Fornecedor</Label>
                <Input placeholder="Opcional" className="rounded-[20px] sm:rounded-[24px] h-14 sm:h-16 bg-white border-none font-bold text-sm sm:text-base px-4 sm:px-6 shadow-sm focus:ring-4 focus:ring-violet-500/20 placeholder:font-semibold placeholder:text-slate-300" value={purchaseDetails.note} onChange={(e) => setPurchaseDetails({ ...purchaseDetails, note: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="mt-8 sm:mt-10 flex flex-col gap-3">
            <Button onClick={handleFinalizePurchase} className="rounded-[24px] sm:rounded-[28px] h-16 sm:h-20 w-full font-black text-[18px] sm:text-[22px] bg-violet-600 hover:bg-violet-700 text-white shadow-2xl shadow-violet-500/30 active:scale-[0.98] transition-all" disabled={registerPurchaseMutation.isPending || purchaseCart.some((i) => !i.quantity || i.quantity <= 0)}>
              {registerPurchaseMutation.isPending ? "Processando..." : "Confirmar Compra"}
            </Button>
            <Button variant="ghost" onClick={() => setPurchaseDialogOpen(false)} className="rounded-[24px] sm:rounded-[28px] h-14 sm:h-16 font-bold text-slate-500 hover:bg-slate-100 sm:hidden">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
