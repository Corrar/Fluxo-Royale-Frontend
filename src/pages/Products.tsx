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
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; 
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

export default function Products() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Estados de Controle
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12; 
  
  // Estado de Edição (Geral)
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Estados para Edição de Preço (Compras)
  const [priceDialog, setPriceDialog] = useState(false);
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<any>(null);
  const [priceValue, setPriceValue] = useState("");

  // Estado do Formulário
  const [useAutoSku, setUseAutoSku] = useState(true);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    unit: "",
    min_stock: "0", 
    quantity: "0",
    unit_price: "0",
  });

  // --- PERMISSÕES ---
  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";
  const canEditPrice = profile?.role === "compras" || profile?.role === "admin";
  const isBuyer = profile?.role === "compras";

  // 1. BUSCAR PRODUTOS
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data;
    },
  });

  // Gerador de SKU Sequencial
  const nextSku = useMemo(() => {
    const MIN_START = 236; 
    if (!products || products.length === 0) return `9.99.${(MIN_START + 1).toString().padStart(4, '0')}`;
    const existingSequences = products
      .map((p: any) => {
        if (p.sku && p.sku.startsWith("9.99.")) {
          const numberPart = parseInt(p.sku.split(".")[2]);
          return isNaN(numberPart) ? 0 : numberPart;
        }
        return 0;
      });
    const maxExisting = Math.max(0, ...existingSequences);
    const nextSequence = Math.max(MIN_START, maxExisting) + 1;
    return `9.99.${nextSequence.toString().padStart(4, '0')}`;
  }, [products]);

  const currentSkuDisplay = useAutoSku ? nextSku : formData.sku;

  // Mutações
  const createMutation = useMutation({
    mutationFn: async (newProductData: any) => {
      const response = await api.post("/products", newProductData);
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
      const response = await api.put(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast.success("Produto atualizado com sucesso!");
      resetForm();
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído!");
      setDeleteDialog(false);
      setProductToDelete(null);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao excluir"),
  });

  // Mutação de Preço (Compras)
  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      await api.put(`/products/${id}`, { unit_price: price });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast.success("Valor unitário atualizado!");
      setPriceDialog(false);
    },
    onError: () => toast.error("Erro ao atualizar preço"),
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
      quantity: formData.quantity ? parseFloat(formData.quantity) : 0, // Envia a quantidade atualizada
      unit_price: formData.unit_price ? parseFloat(formData.unit_price) : 0,
    };
    if (editingProduct) updateMutation.mutate({ id: editingProduct.id, data });
    else createMutation.mutate(data);
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setUseAutoSku(false);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      unit: product.unit,
      min_stock: product.min_stock?.toString() || "0",
      quantity: product.stock?.[0]?.quantity_on_hand?.toString() || "0", // Pega a quantidade atual
      unit_price: product.unit_price?.toString() || "0",
    });
  };

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id);
    setDeleteDialog(true);
  };

  const resetForm = () => {
    setFormData({ sku: "", name: "", description: "", unit: "", min_stock: "0", quantity: "0", unit_price: "0" });
    setEditingProduct(null);
    setUseAutoSku(true);
  };

  const handleOpenPriceDialog = (product: any) => {
    setSelectedProductForPrice(product);
    setPriceValue(product.unit_price?.toString() || "0");
    setPriceDialog(true);
  };

  const handleConfirmPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductForPrice) {
      updatePriceMutation.mutate({ 
        id: selectedProductForPrice.id, 
        price: parseFloat(priceValue) 
      });
    }
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter((product: any) => 
      product.name.toLowerCase().includes(term) || 
      product.sku.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <Package className="h-8 w-8 text-primary" />
            {canManage ? "Gerenciamento de Produtos" : "Catálogo de Produtos"}
          </h1>
          <p className="text-muted-foreground">
            {canManage 
              ? "Cadastre, edite e gerencie o estoque." 
              : "Consulte o estoque e gerencie valores unitários."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* === COLUNA ESQUERDA: FORMULÁRIO (Somente para Almoxarife e Admin) === */}
        {canManage && (
          <Card className="lg:col-span-4 xl:col-span-3 h-fit border-t-4 border-t-primary shadow-lg sticky top-6">
            <CardHeader className="bg-slate-50/50 pb-4 border-b">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  {editingProduct ? <Pencil className="h-5 w-5 text-amber-600" /> : <Plus className="h-5 w-5 text-emerald-600" />}
                  {editingProduct ? "Editar Produto" : "Novo Cadastro"}
                </div>
                {editingProduct && (
                  <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 w-8 p-0 hover:bg-slate-200 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* DADOS BÁSICOS */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-slate-600"><Tag className="h-3 w-3" /> Nome do Produto</Label>
                  <Input 
                    placeholder="Ex: Parafuso Sextavado M8" 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    className="font-medium"
                  />
                </div>

                {/* Grid Compacto */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Unidade</Label>
                    <Select value={formData.unit} onValueChange={(val) => setFormData({ ...formData, unit: val })}>
                      <SelectTrigger><SelectValue placeholder="Sel." /></SelectTrigger>
                      <SelectContent>
                        {["UN", "KG", "M", "CX", "PCT", "L", "PAR", "JG"].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Estoque Mínimo</Label>
                    <Input type="number" step="0.01" value={formData.min_stock} onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })} />
                  </div>
                  
                  {/* Estoque (Liberado para edição) */}
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs text-slate-500">
                      {editingProduct ? "Ajustar Estoque (Físico)" : "Estoque Inicial"}
                    </Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.quantity} 
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} 
                      className={`bg-slate-50 ${editingProduct ? "border-amber-300 focus:ring-amber-200" : ""}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* SKU - CÓDIGO */}
                <div className="bg-slate-50 p-3 rounded-lg border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-600">Código SKU</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{useAutoSku ? "Auto" : "Manual"}</span>
                      <Switch checked={useAutoSku} onCheckedChange={setUseAutoSku} className="scale-75" />
                    </div>
                  </div>
                  <Input 
                    value={currentSkuDisplay} 
                    onChange={(e) => !useAutoSku && setFormData({...formData, sku: e.target.value})} 
                    readOnly={useAutoSku} 
                    className={`font-mono text-sm h-8 ${useAutoSku ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-primary/50'}`} 
                    placeholder="SKU Manual" 
                  />
                </div>

                {/* --- SEÇÃO FINANCEIRA (SOMENTE PARA ADMIN OU COMPRAS) --- */}
                {canEditPrice && (
                  <div className={`rounded-xl border-2 p-4 transition-all ${isBuyer ? "border-emerald-400 bg-emerald-50/50" : "border-slate-100 bg-slate-50"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-1.5 rounded-full ${isBuyer ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <span className={`font-semibold text-sm ${isBuyer ? "text-emerald-800" : "text-slate-600"}`}>Dados Financeiros</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className={`text-xs ${isBuyer ? "text-emerald-700 font-bold" : "text-slate-500"}`}>
                           Valor Unitário (R$)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={formData.unit_price} 
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} 
                            className="pl-9 text-lg font-bold h-11 bg-white border-emerald-300 focus:ring-emerald-200 text-emerald-700 shadow-sm" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* BOTÕES DE AÇÃO */}
                <div className="flex gap-3 pt-2">
                    {editingProduct && (
                      <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                        Cancelar
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      className={`flex-1 font-bold shadow-md transition-all
                        ${editingProduct ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary hover:bg-primary/90'}
                      `}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingProduct ? (
                        <>{updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}</>
                      ) : (
                        <><Plus className="h-5 w-5 mr-2" /> {createMutation.isPending ? "Criando..." : "Cadastrar"}</>
                      )}
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* === COLUNA DIREITA: LISTA DE PRODUTOS === */}
        <Card className={`${canManage ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} border-none shadow-none bg-transparent flex flex-col h-full overflow-hidden`}>
          {/* Barra de Pesquisa */}
          <div className="bg-white p-4 rounded-xl border shadow-sm mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
               <Package className="h-5 w-5" />
               <span className="font-medium hidden sm:inline">Total: {products?.length || 0} itens</span>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por nome, SKU..." 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
              />
            </div>
          </div>
          
          {/* Lista de Cards */}
          <div className="flex-1 overflow-y-auto pr-2">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground animate-pulse">Carregando catálogo...</div>
            ) : filteredProducts?.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                <Box className="h-12 w-12 opacity-20 mb-2" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              // GRID ADAPTÁVEL
              <div className={`grid grid-cols-1 gap-4 pb-4 ${canManage ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-3 xl:grid-cols-4"}`}>
                {paginatedProducts.map((product: any) => {
                  const hasPrice = product.unit_price && parseFloat(product.unit_price) > 0;
                  const priceFormatted = hasPrice ? Number(product.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00";
                  
                  return (
                    <div 
                      key={product.id} 
                      className={`
                        bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden
                        ${editingProduct?.id === product.id ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-50/30' : 'border-slate-200'}
                      `}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                            {product.sku}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100">
                            {product.unit}
                          </Badge>
                        </div>
                        
                        {/* AÇÕES DE GESTÃO (ADMIN/ALMOXARIFE) */}
                        {canManage && (
                          <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-amber-600 hover:bg-amber-50" onClick={() => handleEdit(product)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteClick(product.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                        {/* AÇÕES DE COMPRAS (EDITAR PREÇO) */}
                        {!canManage && canEditPrice && (
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" 
                             onClick={() => handleOpenPriceDialog(product)}
                             title="Alterar Valor Unitário"
                           >
                             <Pencil className="h-3.5 w-3.5" />
                           </Button>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2 min-h-[40px]" title={product.name}>
                        {product.name}
                      </h3>

                      <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Estoque Atual</p>
                          <div className="flex items-center gap-1.5 text-slate-700">
                             <Box className="h-3.5 w-3.5 text-slate-400" />
                             <span className="font-bold text-sm">{product.stock?.[0]?.quantity_on_hand || 0}</span>
                          </div>
                        </div>

                        {/* Valor Unitário Visível para quem pode editar (Admin/Compras) */}
                        {canEditPrice && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">Valor Unit.</p>
                            <div className={`font-bold flex items-center justify-end gap-1 ${hasPrice ? 'text-emerald-600 text-lg' : 'text-slate-300 text-sm'}`}>
                               {!hasPrice && <AlertCircle className="h-3 w-3" />}
                               {hasPrice ? priceFormatted : "Sem Custo"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Rodapé Paginação */}
          {filteredProducts.length > 0 && (
            <div className="bg-white p-2 rounded-xl border shadow-sm mt-auto">
              <Pagination>
                <PaginationContent>
                  <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button></PaginationItem>
                  <PaginationItem><span className="text-sm text-muted-foreground mx-4">Página {currentPage} de {totalPages}</span></PaginationItem>
                  <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próximo</Button></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>
      </div>

      {/* DIALOG DE EXCLUSÃO */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto será arquivado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => productToDelete && deleteMutation.mutate(productToDelete)} className="bg-red-600 hover:bg-red-700">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE EDIÇÃO DE PREÇO (PARA COMPRAS) */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atualizar Valor Unitário</DialogTitle></DialogHeader>
          <form onSubmit={handleConfirmPrice} className="space-y-4">
            <div className="bg-emerald-50 text-emerald-800 p-3 rounded text-sm mb-2 border border-emerald-100">
              Você está alterando o preço base do produto <strong>{selectedProductForPrice?.name}</strong>.
            </div>
            <div>
              <Label>Novo Valor Unitário (R$)</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  step="0.01" 
                  className="pl-9 text-lg font-bold"
                  value={priceValue} 
                  onChange={(e) => setPriceValue(e.target.value)} 
                  autoFocus 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setPriceDialog(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Salvar Preço</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}