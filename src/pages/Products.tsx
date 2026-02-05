import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DollarSign,
  AlertCircle,
  ShoppingBag,
  CheckCircle2,
  Calendar,
  ListChecks,
  Filter,
  Eraser,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

// --- 🎨 FUNÇÃO DE ESTILO DINÂMICO PARA TAGS ---
const getTagStyle = (tag: string) => {
  const styles = [
    "bg-red-100 text-red-700 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
    "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800",
    "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
    "bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
    "bg-lime-100 text-lime-700 border-lime-200 hover:bg-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800",
    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800",
  ];
  
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % styles.length;
  return styles[index];
};

export default function Products() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Estados de Controle
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Estado para Filtro de Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Edição
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Preço
  const [priceDialog, setPriceDialog] = useState(false);
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<any>(null);
  const [priceValue, setPriceValue] = useState("");

  // Modo Compra
  const [isPurchaseMode, setIsPurchaseMode] = useState(false);
  const [purchaseCart, setPurchaseCart] = useState<{ product: any; quantity: number }[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState({ date: "", note: "" });

  // Form
  const [useAutoSku, setUseAutoSku] = useState(true);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    unit: "",
    min_stock: "0",
    quantity: "0",
    unit_price: "0",
    tags: [] as string[],
  });

  const [tagInput, setTagInput] = useState("");

  // Permissões
  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";
  const canEditTags = profile?.role === "admin" || profile?.role === "almoxarife";
  const canEditPrice = profile?.role === "compras" || profile?.role === "admin";
  const isBuyer = profile?.role === "compras";

  // Produtos
  const { data: products, isLoading } = useQuery<any[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      
      return response.data.map((p: any) => {
        let normalizedTags: string[] = [];

        if (p.tags) {
            if (Array.isArray(p.tags)) {
               normalizedTags = p.tags;
            } else if (typeof p.tags === 'string') {
               try {
                  const parsed = JSON.parse(p.tags);
                  if (Array.isArray(parsed)) normalizedTags = parsed;
               } catch {
                  if (p.tags.trim() !== "" && p.tags !== "[]") {
                      normalizedTags = p.tags.replace(/[\[\]"]/g, '').split(',').map((t: string) => t.trim()).filter((t: string) => t !== "");
                  }
               }
            }
        }
        
        return { ...p, tags: normalizedTags };
      });
    },
  });

  // Calcular todas as tags disponíveis
  const availableTags = useMemo<string[]>(() => {
    if (!products) return [];
    const prodList = products as any[];
    const allTags = prodList.flatMap((p: any) => (p.tags as string[]) || []);
    return Array.from(new Set(allTags)).sort();
  }, [products]);

  // SKU sequencial
  const nextSku = useMemo(() => {
    const MIN_START = 236;
    if (!products || products.length === 0) return `9.99.${(MIN_START + 1).toString().padStart(4, "0")}`;

    const existingSequences = products.map((p: any) => {
      if (p.sku && p.sku.startsWith("9.99.")) {
        const numberPart = parseInt(p.sku.split(".")[2]);
        return isNaN(numberPart) ? 0 : numberPart;
      }
      return 0;
    });

    const maxExisting = Math.max(0, ...existingSequences);
    const nextSequence = Math.max(MIN_START, maxExisting) + 1;
    return `9.99.${nextSequence.toString().padStart(4, "0")}`;
  }, [products]);

  const currentSkuDisplay = useAutoSku ? nextSku : formData.sku;

  // CRUD Mutations
  const createMutation = useMutation({
    mutationFn: async (newProductData: any) => {
      const payload = {
        ...newProductData,
        tags: Array.isArray(newProductData.tags) ? newProductData.tags : []
      };
      const response = await api.post("/products", payload);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      toast.success(`Produto cadastrado! SKU: ${data.sku}`);
      resetForm();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = { ...data, tags: Array.isArray(data.tags) ? data.tags : [] };
      const response = await api.put(`/products/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      toast.success("Produto atualizado com sucesso!");
      resetForm();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      toast.success("Produto excluído!");
      setDeleteDialog(false);
      setProductToDelete(null);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao excluir"),
  });

  // --- ATUALIZAÇÃO DE PREÇO ROBUSTA (OPTIMISTIC UPDATE) ---
  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      // Envia o PUT. Se o backend suportar partial update no PUT, isso funcionará perfeitamente.
      await api.put(`/products/${id}`, { unit_price: price });
    },
    // Executado ANTES da mutação para atualizar a UI instantaneamente
    onMutate: async ({ id, price }) => {
        // Cancela queries pendentes para não sobrescrever nosso update otimista
        await queryClient.cancelQueries({ queryKey: ["products"] });
  
        // Tira um snapshot do estado anterior
        const previousProducts = queryClient.getQueryData<any[]>(["products"]);
  
        // Atualiza o cache otimistamente
        queryClient.setQueryData<any[]>(["products"], (old) => {
          if (!old) return [];
          return old.map((product) => 
            product.id === id ? { ...product, unit_price: price } : product
          );
        });
  
        // Retorna o contexto para caso de erro (rollback)
        return { previousProducts };
    },
    // Se der erro, volta ao estado anterior
    onError: (_err, _newPrice, context) => {
        if (context?.previousProducts) {
            queryClient.setQueryData(["products"], context.previousProducts);
        }
        toast.error("Falha ao atualizar o preço. Tente novamente.");
    },
    // Sempre revalida após sucesso ou erro para garantir consistência
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["stocks"] });
    },
    onSuccess: () => {
      toast.success("Valor unitário atualizado!");
      setPriceDialog(false);
    }
  });

  const registerPurchaseMutation = useMutation({
    mutationFn: async (data: { items: { product: any; quantity: number }[]; date: string; note: string }) => {
      const itemsValidos = data.items.filter((i) => Number(i.quantity) > 0);
      const promises = itemsValidos.map((item) => {
        const cleanNote = (data.note || "").trim();
        const finalNote = `[Compra Avulsa] Qtd: ${item.quantity} ${item.product.unit}${cleanNote ? ` | ${cleanNote}` : ""}`;
        return api.put(`/products/${item.product.id}/purchase-info`, {
          purchase_status: "comprado",
          purchase_note: finalNote,
          delivery_forecast: data.date || null,
        });
      });
      await Promise.all(promises);
      return { itemsValidos, date: data.date || null, note: data.note || "" };
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["products"] });
      const prev = queryClient.getQueryData<any[]>(["products"]);
      const itemsValidos = data.items.filter((i) => Number(i.quantity) > 0);
      queryClient.setQueryData<any[]>(["products"], (old) => {
        if (!old) return old;
        return old.map((p: any) => {
          const found = itemsValidos.find((x) => x.product.id === p.id);
          if (!found) return p;
          const cleanNote = (data.note || "").trim();
          const finalNote = `[Compra Avulsa] Qtd: ${found.quantity} ${found.product.unit}${cleanNote ? ` | ${cleanNote}` : ""}`;
          return {
            ...p,
            purchase_status: "comprado",
            purchase_note: finalNote,
            delivery_forecast: data.date || null,
          };
        });
      });
      return { prev };
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["products"], ctx.prev);
      toast.error("Erro ao registrar compras.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      toast.success("Compras registradas com sucesso!");
      setPurchaseDialogOpen(false);
      setIsPurchaseMode(false);
      setPurchaseCart([]);
      setPurchaseDetails({ date: "", note: "" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.unit) {
      toast.error("Preencha os campos obrigatórios (Nome e Unidade)");
      return;
    }

    const data = {
      ...formData,
      sku: useAutoSku ? nextSku : formData.sku,
      min_stock: formData.min_stock ? parseFloat(formData.min_stock) : null,
      quantity: formData.quantity ? parseFloat(formData.quantity) : 0,
      unit_price: formData.unit_price ? parseFloat(formData.unit_price) : 0,
      tags: formData.tags 
    };

    if (editingProduct) updateMutation.mutate({ id: editingProduct.id, data });
    else createMutation.mutate(data);
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setUseAutoSku(false);
    const currentStock = product.stock?.quantity_on_hand || "0";

    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      unit: product.unit,
      min_stock: product.min_stock?.toString() || "0",
      quantity: currentStock.toString(),
      unit_price: product.unit_price?.toString() || "0",
      tags: product.tags || [],
    });
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteDialog(true);
  };

  const resetForm = () => {
    setFormData({ sku: "", name: "", description: "", unit: "", min_stock: "0", quantity: "0", unit_price: "0", tags: [] });
    setEditingProduct(null);
    setUseAutoSku(true);
    setTagInput("");
  };

  const handleOpenPriceDialog = (product: any) => {
    setSelectedProductForPrice(product);
    // Garante que mostramos string vazia se for 0 ou null para facilitar edição
    setPriceValue(product.unit_price ? product.unit_price.toString() : "");
    setPriceDialog(true);
  };

  const handleConfirmPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductForPrice) {
      // --- CORREÇÃO DE INPUT: Tratamento de vírgula ---
      // Substitui vírgula por ponto para garantir parsing correto (Ex: "10,50" -> "10.50")
      const normalizedPrice = priceValue.replace(',', '.');
      const numericPrice = parseFloat(normalizedPrice);

      if (isNaN(numericPrice) || numericPrice < 0) {
        toast.error("Por favor, insira um valor válido.");
        return;
      }

      updatePriceMutation.mutate({ 
        id: selectedProductForPrice.id, 
        price: numericPrice 
      });
    }
  };

  const handleAddTag = () => {
    if (!canEditTags) return;
    const cleanTag = tagInput.trim();
    if (cleanTag && !formData.tags.includes(cleanTag)) {
      setFormData({ ...formData, tags: [...formData.tags, cleanTag] });
      setTagInput("");
    }
  };

  const handleAddTagFromSuggestion = (tagToAdd: string) => {
    if (!canEditTags) return;
    if (!formData.tags.includes(tagToAdd)) {
        setFormData({ ...formData, tags: [...formData.tags, tagToAdd] });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!canEditTags) return;
    setFormData({ ...formData, tags: formData.tags.filter((tag) => tag !== tagToRemove) });
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const toggleFilterTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
        setSelectedTags([...selectedTags, tag]);
    }
    setCurrentPage(1); 
  };

  const toggleProductInCart = (product: any) => {
    const exists = purchaseCart.find((i) => i.product.id === product.id);
    if (exists) setPurchaseCart(purchaseCart.filter((i) => i.product.id !== product.id));
    else setPurchaseCart([...purchaseCart, { product, quantity: 0 }]);
  };

  const updateCartQuantity = (productId: string, qty: number) => {
    setPurchaseCart(purchaseCart.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item)));
  };

  const handleFinalizePurchase = () => {
    registerPurchaseMutation.mutate({ items: purchaseCart, date: purchaseDetails.date, note: purchaseDetails.note });
  };

  // Filtros
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let result = products;

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        result = result.filter((product: any) => 
            product.name.toLowerCase().includes(term) || 
            product.sku.toLowerCase().includes(term) ||
            (product.tags && product.tags.some((t: string) => t.toLowerCase().includes(term)))
        );
    }

    if (selectedTags.length > 0) {
        result = result.filter((product: any) => 
            product.tags && Array.isArray(product.tags) && selectedTags.every((tag) => product.tags.includes(tag))
        );
    }

    return result;
  }, [products, searchTerm, selectedTags]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  // Sugestões de tags
  const suggestedTags = useMemo<string[]>(() => {
    return availableTags.filter((tag: string) => 
        !formData.tags.includes(tag) && 
        tag.toLowerCase().includes(tagInput.trim().toLowerCase())
    );
  }, [availableTags, formData.tags, tagInput]);

  return (
    <div className="space-y-6 h-full flex flex-col pb-20 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Package className="h-8 w-8 text-primary" />
            {isPurchaseMode ? <span className="text-purple-600">Modo de Compra</span> : (canManage ? "Gerenciamento de Produtos" : "Catálogo de Produtos")}
          </h1>
          <p className="text-muted-foreground">
            {isPurchaseMode ? "Selecione os produtos que deseja comprar." : (canManage ? "Cadastre, edite e gerencie o estoque." : "Consulte o estoque e gerencie valores unitários.")}
          </p>
        </div>

        {canEditPrice && !canManage && (
          <Button
            variant={isPurchaseMode ? "default" : "outline"}
            className={`gap-2 ${isPurchaseMode ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-purple-200 text-purple-700 hover:bg-purple-50"}`}
            onClick={() => { setIsPurchaseMode(!isPurchaseMode); setPurchaseCart([]); }}
          >
            {isPurchaseMode ? <X className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {isPurchaseMode ? "Cancelar Compra" : "Nova Compra"}
          </Button>
        )}

        {canManage && canEditPrice && (
          <Button
            variant={isPurchaseMode ? "destructive" : "secondary"}
            className={`gap-2 ${isPurchaseMode ? "" : "bg-purple-50 text-purple-700 hover:bg-purple-100"}`}
            onClick={() => { setIsPurchaseMode(!isPurchaseMode); setEditingProduct(null); setPurchaseCart([]); }}
          >
            {isPurchaseMode ? <X className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {isPurchaseMode ? "Sair do Modo Compra" : "Modo Compra"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Form (admin/almoxarife) */}
        {canManage && !isPurchaseMode && (
          <Card className={`lg:col-span-4 xl:col-span-3 h-fit shadow-lg sticky top-6 bg-card transition-all duration-300 ${editingProduct ? "border-2 border-amber-500 dark:border-amber-500 shadow-amber-500/20" : "border-t-4 border-t-primary border-x border-b border-slate-200 dark:border-slate-800"}`}>
            <CardHeader className={`pb-4 border-b border-slate-100 dark:border-slate-800 ${editingProduct ? "bg-amber-50 dark:bg-amber-950/30" : "bg-slate-50/50 dark:bg-slate-900/50"}`}>
              <CardTitle className={`flex items-center justify-between text-lg ${editingProduct ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-slate-100"}`}>
                <div className="flex items-center gap-2">
                  {editingProduct ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5 text-emerald-600" />}
                  {editingProduct ? "Editando Produto" : "Novo Cadastro"}
                </div>
                {editingProduct && (
                  <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0 hover:bg-white/50 dark:hover:bg-black/20 rounded-full text-amber-700 dark:text-amber-400">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-slate-600 dark:text-slate-300"><Tag className="h-3 w-3" /> Nome do Produto</Label>
                  <Input
                    placeholder="Ex: Parafuso Sextavado M8"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Unidade</Label>
                    <Select value={formData.unit} onValueChange={(val) => setFormData({ ...formData, unit: val })}>
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"><SelectValue placeholder="Sel." /></SelectTrigger>
                      <SelectContent>
                        {["UN", "KG", "M", "CX", "PCT", "L", "PAR", "JG"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Estoque Mínimo</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">{editingProduct ? "Ajustar Estoque (Físico)" : "Estoque Inicial"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className={`bg-slate-50 dark:bg-slate-800 ${editingProduct ? "border-amber-300 focus:ring-amber-200 dark:border-amber-700 dark:focus:ring-amber-900" : "border-slate-200 dark:border-slate-700"}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* --- SEÇÃO DE TAGS (COM SUGESTÕES) --- */}
                {canEditTags && (
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 transition-all">
                        <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> Etiquetas
                        </Label>
                        
                        <div className="flex gap-2">
                            <Input
                                placeholder="Nova tag..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleKeyDownTag}
                                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 flex-1 text-sm h-9"
                            />
                            <Button type="button" size="sm" onClick={handleAddTag} variant="secondary" className="h-9 px-3">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Lista de Tags Selecionadas */}
                        {formData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                {formData.tags.map((tag) => {
                                    const colorStyle = getTagStyle(tag);
                                    return (
                                        <Badge key={tag} className={`flex items-center gap-1 pr-1 font-normal rounded-full ${colorStyle}`} variant="outline">
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTag(tag)}
                                                className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}

                        {/* ÁREA DE SUGESTÕES INTELIGENTES */}
                        {suggestedTags.length > 0 && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-amber-500" /> Sugestões:
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                                    {suggestedTags.map((tag: string) => {
                                        const colorStyle = getTagStyle(tag);
                                        return (
                                            <Badge 
                                                key={tag} 
                                                onClick={() => handleAddTagFromSuggestion(tag)}
                                                className={`cursor-pointer opacity-70 hover:opacity-100 hover:scale-105 transition-all text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm ${colorStyle}`}
                                                variant="outline"
                                            >
                                                + {tag}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Código SKU</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{useAutoSku ? "Auto" : "Manual"}</span>
                      <Switch checked={useAutoSku} onCheckedChange={setUseAutoSku} className="scale-75" />
                    </div>
                  </div>
                  <Input
                    value={currentSkuDisplay}
                    onChange={(e) => !useAutoSku && setFormData({ ...formData, sku: e.target.value })}
                    readOnly={useAutoSku}
                    className={`font-mono text-sm h-8 ${useAutoSku ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-white dark:bg-slate-900 border-primary/50"}`}
                    placeholder="SKU Manual"
                  />
                </div>

                {canEditPrice && (
                  <div className={`rounded-xl border-2 p-4 transition-all ${isBuyer ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-800" : "border-slate-100 bg-slate-50 dark:bg-slate-900/30 dark:border-slate-800"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-full ${isBuyer ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-100" : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <span className={`font-semibold text-sm ${isBuyer ? "text-emerald-800 dark:text-emerald-200" : "text-slate-600 dark:text-slate-300"}`}>Dados Financeiros</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className={`text-xs ${isBuyer ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-slate-500 dark:text-slate-400"}`}>Valor Unitário (R$)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                            className="pl-9 text-lg font-bold h-11 bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 focus:ring-emerald-200 text-emerald-700 dark:text-emerald-400 shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {editingProduct && (
                    <Button type="button" variant="outline" className="w-1/3" onClick={resetForm}>Cancelar</Button>
                  )}
                  <Button
                    type="submit"
                    className={`font-bold shadow-md transition-all ${editingProduct ? "w-2/3 bg-amber-500 hover:bg-amber-600 text-white dark:text-slate-900" : "w-full bg-primary hover:bg-primary/90 text-primary-foreground"}`}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingProduct ? (updateMutation.isPending ? "Salvando..." : "Salvar Alterações") : (
                      <>
                        <Plus className="h-5 w-5 mr-2" /> {createMutation.isPending ? "Criando..." : "Cadastrar"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista */}
        <Card className={`${canManage && !isPurchaseMode ? "lg:col-span-8 xl:col-span-9" : "lg:col-span-12"} border-none shadow-none bg-transparent flex flex-col h-full overflow-hidden`}>
          <div className={`bg-white dark:bg-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4 flex flex-col gap-4 ${isPurchaseMode ? "ring-2 ring-purple-500 border-purple-500" : ""}`}>
            
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Package className="h-5 w-5" />
                <span className="font-medium hidden sm:inline">Total: {products?.length || 0} itens</span>
                {isPurchaseMode && <Badge className="bg-purple-100 text-purple-700 ml-2">Modo Seleção Ativo</Badge>}
                </div>

                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nome, SKU, tags..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-all"
                    />
                </div>
            </div>

            {/* Filtros de Tags */}
            {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 mr-2">
                        <Filter className="h-3.5 w-3.5" /> Filtrar por etiqueta:
                    </div>
                    {availableTags.map((tag: string) => {
                        const isSelected = selectedTags.includes(tag);
                        const colorStyle = getTagStyle(tag);
                        return (
                            <Badge 
                                key={tag} 
                                variant={isSelected ? "default" : "outline"}
                                className={`cursor-pointer transition-all hover:scale-105 rounded-full px-3 py-1 ${isSelected ? 'bg-primary text-primary-foreground border-primary' : `${colorStyle} bg-opacity-50`}`}
                                onClick={() => toggleFilterTag(tag)}
                            >
                                {tag}
                                {isSelected && <X className="ml-1 h-3 w-3" />}
                            </Badge>
                        );
                    })}
                    {selectedTags.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full"
                            onClick={() => setSelectedTags([])}
                        >
                            <Eraser className="h-3 w-3 mr-1" /> Limpar Filtros
                        </Button>
                    )}
                </div>
            )}

          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground animate-pulse">Carregando catálogo...</div>
            ) : filteredProducts?.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                <Box className="h-12 w-12 opacity-20 mb-2" />
                <p>Nenhum produto encontrado</p>
                {selectedTags.length > 0 && <p className="text-xs mt-1 text-slate-400">Tente remover alguns filtros de etiqueta.</p>}
              </div>
            ) : (
              <div className={`grid grid-cols-1 gap-4 pb-4 ${canManage && !isPurchaseMode ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-3 xl:grid-cols-4"}`}>
                {paginatedProducts.map((product: any) => {
                  const hasPrice = product.unit_price && parseFloat(product.unit_price) > 0;
                  const priceFormatted = hasPrice ? Number(product.unit_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
                  const isEditingThis = editingProduct?.id === product.id;
                  const stockDisplay = product.stock?.quantity_on_hand || 0;
                  const inCart = purchaseCart.find((i) => i.product.id === product.id);

                  return (
                    <div
                      key={product.id}
                      onClick={() => isPurchaseMode && toggleProductInCart(product)}
                      className={`
                        bg-white dark:bg-card rounded-xl border p-4 shadow-sm transition-all group relative overflow-hidden flex flex-col
                        ${isEditingThis ? "ring-2 ring-amber-400 border-amber-400 bg-amber-50 dark:bg-amber-950/20" : "border-slate-200 dark:border-slate-800"}
                        ${isPurchaseMode ? "cursor-pointer hover:border-purple-400 hover:shadow-purple-100" : "hover:shadow-md"}
                        ${inCart ? "ring-2 ring-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-600" : ""}
                      `}
                    >
                      {isPurchaseMode && (
                        <div className={`absolute top-2 right-2 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all z-20 ${inCart ? "bg-purple-600 border-purple-600" : "border-slate-300 bg-white"}`}>
                          {inCart && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </div>
                      )}

                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isEditingThis ? "bg-amber-500" : inCart ? "bg-purple-600" : "bg-primary opacity-0 group-hover:opacity-100"} transition-opacity`} />

                      <div className="flex justify-between items-start mb-2 pr-6">
                        <div className="flex gap-2">
                          <Badge variant="outline" className={`font-mono text-[10px] ${isEditingThis ? "border-amber-300 bg-amber-100 text-amber-800" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}>
                            {product.sku}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                            {product.unit}
                          </Badge>
                        </div>

                        {canManage && !isPurchaseMode && (
                          <div className={`flex gap-1 transition-opacity ${isEditingThis ? "opacity-100" : "opacity-100 sm:opacity-0 group-hover:opacity-100"}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={(e) => { e.stopPropagation(); handleEdit(product); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteClick(product.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <h3 className={`font-bold text-sm mb-1 line-clamp-2 min-h-[40px] ${isEditingThis ? "text-amber-900 dark:text-amber-100" : "text-slate-800 dark:text-slate-200"}`} title={product.name}>
                        {product.name}
                      </h3>

                      {/* Tags */}
                      {product.tags && Array.isArray(product.tags) && product.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 mb-3">
                              {product.tags.map((tag: string) => {
                                  const colorStyle = getTagStyle(tag);
                                  const isSelected = selectedTags.includes(tag);
                                  return (
                                    <Badge 
                                        key={tag} 
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium shadow-none cursor-pointer transition-transform hover:scale-105 ${isSelected ? 'ring-2 ring-primary ring-offset-1' : colorStyle}`}
                                        variant="outline"
                                        onClick={(e) => { e.stopPropagation(); toggleFilterTag(tag); }}
                                    >
                                        {tag}
                                    </Badge>
                                  );
                              })}
                          </div>
                      )}

                      <div className={`flex items-end justify-between mt-auto pt-3 border-t ${isEditingThis ? "border-amber-200 dark:border-amber-800" : "border-slate-100 dark:border-slate-800"}`}>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Estoque</p>
                          <div className={`flex items-center gap-1.5 ${isEditingThis ? "text-amber-800 dark:text-amber-200" : "text-slate-700 dark:text-slate-300"}`}>
                            <Box className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-bold text-sm">{stockDisplay}</span>
                          </div>
                        </div>

                        {/* --- LINK DE EDIÇÃO DE PREÇO --- */}
                        {canEditPrice && !isPurchaseMode && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Valor Unit.</p>
                            <div 
                                onClick={(e) => { e.stopPropagation(); handleOpenPriceDialog(product); }}
                                className={`font-bold flex items-center justify-end gap-1 cursor-pointer hover:opacity-80 transition-opacity ${hasPrice ? "text-emerald-600 dark:text-emerald-400 text-lg" : "text-slate-300 dark:text-slate-600 text-sm"}`}
                                title="Clique para editar o preço"
                            >
                              {!hasPrice && <AlertCircle className="h-3 w-3" />}
                              {hasPrice ? priceFormatted : "Sem Custo"}
                              <Pencil className="h-3 w-3 ml-1 text-slate-400" />
                            </div>
                          </div>
                        )}
                        {/* ------------------------------- */}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {filteredProducts.length > 0 && (
            <div className="bg-white dark:bg-card p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mt-auto">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      Anterior
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm text-muted-foreground mx-4">Página {currentPage} de {totalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Próximo
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>
      </div>

      {/* Barra flutuante compra */}
      {isPurchaseMode && purchaseCart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm">{purchaseCart.length}</div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Itens Selecionados</span>
              <span className="text-xs text-slate-400">Prontos para compra</span>
            </div>
          </div>
          <Button className="bg-white text-slate-900 hover:bg-slate-200 font-bold rounded-full px-6" onClick={() => setPurchaseDialogOpen(true)}>
            Finalizar Compra <ListChecks className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialog exclusão */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="dark:bg-slate-900 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-100">Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">Esta ação não pode ser desfeita. O produto será arquivado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => productToDelete && deleteMutation.mutate(productToDelete)} className="bg-red-600 hover:bg-red-700 text-white">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog compra */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-2xl dark:bg-slate-900 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShoppingBag className="h-6 w-6 text-purple-600" />
              Registrar Compra Avulsa
            </DialogTitle>
            <DialogDescription>
              Defina a quantidade adquirida para cada item. Eles aparecerão no acompanhamento de compras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold text-muted-foreground uppercase mb-2">
                <div className="col-span-6">Produto</div>
                <div className="col-span-3 text-center">Unidade</div>
                <div className="col-span-3">Qtd. Comprada</div>
              </div>

              {purchaseCart.map((item) => (
                <div key={item.product.id} className="grid grid-cols-12 gap-4 items-center border-b last:border-0 border-slate-100 dark:border-slate-700 pb-2 last:pb-0">
                  <div className="col-span-6">
                    <span className="font-medium text-sm block truncate" title={item.product.name}>{item.product.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{item.product.sku}</span>
                  </div>
                  <div className="col-span-3 text-center">
                    <Badge variant="outline">{item.product.unit}</Badge>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      className="h-8 dark:bg-slate-900"
                      placeholder="0"
                      value={item.quantity || ""}
                      onChange={(e) => updateCartQuantity(item.product.id, parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Previsão de Entrega (Opcional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-9 dark:bg-slate-800"
                    value={purchaseDetails.date}
                    onChange={(e) => setPurchaseDetails({ ...purchaseDetails, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ordem de Compra / Fornecedor</Label>
                <Input
                  placeholder="Ex: OC-9999 - Loja do Mecânico"
                  className="dark:bg-slate-800"
                  value={purchaseDetails.note}
                  onChange={(e) => setPurchaseDetails({ ...purchaseDetails, note: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleFinalizePurchase}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={registerPurchaseMutation.isPending || purchaseCart.some((i) => !i.quantity || i.quantity <= 0)}
            >
              {registerPurchaseMutation.isPending ? "Registrando..." : "Confirmar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog preço */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent className="dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Atualizar Valor Unitário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmPrice} className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-3 rounded text-sm mb-2 border border-emerald-100 dark:border-emerald-800">
              Você está alterando o preço base do produto <strong>{selectedProductForPrice?.name}</strong>.
            </div>

            <div>
              <Label className="dark:text-slate-300">Novo Valor Unitário (R$)</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  className="pl-9 text-lg font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setPriceDialog(false)} className="dark:bg-slate-800 dark:text-slate-200">Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Salvar Preço</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
