import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle 
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { 
  Plus, Trash2, Search, ShoppingCart, History, Box,
  Clock, CheckCircle2, XCircle, Truck, AlertTriangle, Send, Loader2,
  ChevronUp, Package, X, CalendarDays, Hash, Tag, Briefcase, RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// --- Configuração de Status Premium ---
const statusConfig = {
  aberto: { label: "Em Análise", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30", icon: XCircle },
  entregue: { label: "Entregue", color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/20", icon: Truck },
  devolvido: { label: "Devolvido", color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30", icon: RotateCcw },
};

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  tags?: string[];
  observation?: string;
}

// === FUNÇÃO DE PESQUISA INTELIGENTE ===
const normalizeString = (str: string) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function MyRequests() {
  const { profile, canAccess } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  // 🛡️ REGRAS DE PERMISSÃO GRANULARES:
  const canAdd = canAccess("minhas_solicitacoes:add");

  // Se o utilizador não tiver permissão para adicionar, a aba inicial padrão passa a ser o histórico
  const [activeTab, setActiveTab] = useState<"new" | "history">(canAdd ? "new" : "history");
  
  const [sector] = useState(profile?.sector || "Setor não definido");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(); 
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // 🟢 ESTADO: Guarda o número da OP
  const [opCode, setOpCode] = useState("");
  
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false); 

  // ==========================================
  // 1. SOCKET (Atualizações em Tempo Real Otimizadas)
  // ==========================================
  useEffect(() => {
    if (!socket) return;

    const handleRefreshRequests = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      }, Math.random() * 3000);
    };

    const handleRefreshStock = () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["products-list"] });
      }, Math.random() * 3000);
    };

    const handleNewRequest = (newRequestData: any) => {
        if (newRequestData && profile && newRequestData.requester_id === profile.id) {
           queryClient.setQueryData(["my-requests"], (oldData: any) => {
             if (!oldData) return [newRequestData];
             if (oldData.some((req: any) => req.id === newRequestData.id)) return oldData;
             return [newRequestData, ...oldData]; 
           });
        }
    };

    socket.on("refresh_requests", handleRefreshRequests);
    socket.on("refresh_stock", handleRefreshStock);
    socket.on("new_request", handleNewRequest);

    return () => {
      socket.off("refresh_requests", handleRefreshRequests);
      socket.off("refresh_stock", handleRefreshStock);
      socket.off("new_request", handleNewRequest);
    };
  }, [socket, queryClient, profile]);

  // ==========================================
  // 2. DADOS
  // ==========================================
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => (await api.get("/my-requests")).data,
    staleTime: Infinity, 
    placeholderData: keepPreviousData, 
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

  // ==========================================
  // 3. MUTAÇÃO INTELIGENTE (Cart Splitting)
  // ==========================================
  const createRequestMutation = useMutation({
    mutationFn: async (data: { sector: string; opCode: string; validItems: CartItem[] }) => {
      const { sector, opCode, validItems } = data;

      // 1. Separa os itens que PRECISAM de OP
      const requiresOpItems = validItems.filter(i => {
        const isExempt = i.tags?.some(t => [
            'CAMISETAS', 'CAMISETA', 'EPI', 'FERRAMENTAS', 'FERRAMENTA', 'INSUMOS', 'INSUMO'
        ].includes(t.trim().toUpperCase()));
        return !isExempt;
      });

      // 2. Separa os itens ISENTOS de OP
      const exemptItems = validItems.filter(i => {
        const isExempt = i.tags?.some(t => [
            'CAMISETAS', 'CAMISETA', 'EPI', 'FERRAMENTAS', 'FERRAMENTA', 'INSUMOS', 'INSUMO'
        ].includes(t.trim().toUpperCase()));
        return isExempt;
      });

      const requestsToMake = [];

      // 3. Cria a requisição COM OP (se houver itens)
      if (requiresOpItems.length > 0) {
          requestsToMake.push(api.post("/requests", {
              sector,
              op_code: opCode.trim(),
              items: requiresOpItems.map(item => ({ 
                product_id: item.product_id, 
                quantity: item.quantity, 
                observation: item.observation?.trim() || undefined
              }))
          }));
      }

      // 4. Cria a requisição SEM OP (se houver itens)
      if (exemptItems.length > 0) {
          requestsToMake.push(api.post("/requests", {
              sector,
              op_code: undefined, // Forçamos a que não tenha OP associada
              items: exemptItems.map(item => ({ 
                product_id: item.product_id, 
                quantity: item.quantity, 
                observation: item.observation?.trim() || undefined
              }))
          }));
      }

      // 5. Envia as duas requisições ao mesmo tempo
      await Promise.all(requestsToMake);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });

      toast.success("Solicitação enviada com sucesso!");
      setCart([]); 
      setOpCode(""); // Limpa a OP após sucesso
      setIsMobileCartOpen(false);
      setActiveTab("history"); 
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Erro ao criar solicitação.";
      toast.error(msg);
    },
  });

  // ==========================================
  // LÓGICA DE ESTOQUE, TAGS E PESQUISA
  // ==========================================
  const getAvailableStock = (product: any) => {
    const stockInfo = product.stock; 
    if (!stockInfo) return 0;
    if (stockInfo.quantity_available !== undefined) return Number(stockInfo.quantity_available);
    const physicalStock = Number(stockInfo.quantity_on_hand || stockInfo.quantity || 0);
    const reservedStock = Number(stockInfo.quantity_open || stockInfo.quantity_reserved || 0); 
    return Math.max(0, physicalStock - reservedStock);
  };

  const getProductTags = (product: any): string[] => {
    let extractedTags: string[] = [];
    if (Array.isArray(product.tags)) {
      extractedTags = [...product.tags];
    } else if (typeof product.tags === 'string') {
        try { extractedTags = JSON.parse(product.tags); } catch(e) {}
    }
    
    // 🟢 Se não houver tags, forçamos a usar a Categoria/Grupo como tag para a validação da OP funcionar!
    if (!extractedTags.length) {
      if (typeof product.category === 'string' && product.category) extractedTags.push(product.category);
      else if (typeof product.grupo === 'string' && product.grupo) extractedTags.push(product.grupo);
    }
    return extractedTags;
  };

  const availableTags = useMemo(() => {
    if (!products) return [];
    const tags = new Set<string>();
    
    products.forEach((p: any) => {
      const pTags = getProductTags(p);
      pTags.forEach((t: string) => tags.add(t));
    });
    
    return Array.from(tags).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let result = products;

    if (selectedTags && selectedTags.length > 0) {
      result = result.filter((p: any) => {
        let productTags = getProductTags(p);
        return selectedTags.some(tag => productTags.includes(tag));
      });
    }

    if (searchTerm) {
      const normalizedSearch = normalizeString(searchTerm);
      result = result.filter((p: any) => 
        normalizeString(p.name).includes(normalizedSearch) || 
        normalizeString(p.sku).includes(normalizedSearch)
      );
    }

    if (!searchTerm && (!selectedTags || selectedTags.length === 0)) {
      return result.slice(0, 50);
    }

    return result;
  }, [products, searchTerm, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const current = prev || [];
      return current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    });
  };

  // ==========================================
  // LÓGICA DE QUANTIDADE MANUAL E CARRINHO
  // ==========================================
  const handleRemoveItem = (id: string) => {
    const newCart = cart.filter(item => item.product_id !== id);
    setCart(newCart);
    if (newCart.length === 0) setIsMobileCartOpen(false); 
  };

  const setExactQuantity = (productId: string, value: string, available: number, e?: React.ChangeEvent<HTMLInputElement>) => {
    if (e) e.stopPropagation();
    const newQtyStr = value.replace(/\D/g, ''); 
    
    if (newQtyStr === '') {
       setCart(cart.map(i => i.product_id === productId ? { ...i, quantity: 0 } : i));
       return;
    }
    
    const newQty = parseInt(newQtyStr, 10);
    if (newQty > available) {
      toast.error(`Apenas ${Math.floor(available)} disponíveis em stock.`);
      setCart(cart.map(i => i.product_id === productId ? { ...i, quantity: Math.floor(available) } : i));
      return;
    }
    
    setCart(cart.map(i => i.product_id === productId ? { ...i, quantity: newQty } : i));
  };

  const handleQuantityBlur = (productId: string) => {
     const item = cart.find(i => i.product_id === productId);
     if (item && item.quantity === 0) handleRemoveItem(productId);
  };

  const handleSubmit = () => {
    if (!sector) return toast.error("Erro: Setor não identificado.");
    if (cart.length === 0) return toast.error("Carrinho vazio.");
    
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return toast.error("Adicione quantidades válidas.");

    // Verifica se algum item no carrinho exige OP
    const requiresOp = validItems.some(i => {
      const isExempt = i.tags?.some(t => [
          'CAMISETAS', 'CAMISETA', 'EPI', 'FERRAMENTAS', 'FERRAMENTA', 'INSUMOS', 'INSUMO'
      ].includes(t.trim().toUpperCase()));
      return !isExempt;
    });

    if (requiresOp && (!opCode || opCode.trim() === '')) {
        return toast.error("É obrigatório informar o Número da OP para os materiais selecionados.");
    }

    // Validação de EPI / CAMISETA / FERRAMENTAS obrigatória
    const isMissingObs = validItems.some(i => i.tags?.some(t => ['EPI', 'CAMISETA', 'FERRAMENTAS'].includes(t.trim().toUpperCase())) && (!i.observation || i.observation.trim() === ''));
    if (isMissingObs) return toast.error("Preencha para quem é o item (EPI/Camiseta/Ferramenta) nos itens assinalados.");

    // 🟢 Envia TUDO para a nossa nova Mutação Inteligente
    createRequestMutation.mutate({
      sector,
      opCode, 
      validItems 
    });
  };

  // ==========================================
  // FUNÇÃO VISUAL DO CARRINHO (100% Responsivo)
  // ==========================================
  const renderCartListContent = () => {
    
    // 🟢 Verifica se algum item no carrinho atual exige OP
    const isOpRequiredForCart = cart.some(i => {
        const isExempt = i.tags?.some(t => [
            'CAMISETAS', 'CAMISETA', 'EPI', 'FERRAMENTAS', 'FERRAMENTA', 'INSUMOS', 'INSUMO'
        ].includes(t.trim().toUpperCase()));
        return !isExempt;
    });

    return (
      <div className="flex flex-col h-full bg-background">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <div className="bg-slate-100 dark:bg-white/5 p-6 rounded-full">
                <ShoppingCart className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="font-medium">O seu carrinho está vazio.</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-3 py-4">
                {cart.map((item) => {
                  const productData = products?.find((p: any) => p.id === item.product_id);
                  const available = productData ? getAvailableStock(productData) : item.quantity;
                  
                  const requiresObs = item.tags?.some(t => ['EPI', 'CAMISETA', 'FERRAMENTAS'].includes(t.trim().toUpperCase()));
                  const obsLabel = item.tags?.some(t => t.trim().toUpperCase() === 'CAMISETA') ? 'esta Camiseta' : 
                                   item.tags?.some(t => t.trim().toUpperCase() === 'FERRAMENTAS') ? 'esta Ferramenta (Qual operador?)' : 
                                   'este EPI';
                  
                  const missingObs = requiresObs && !item.observation;
                  const hasError = missingObs; 

                  const updateQty = (change: number) => {
                     const newQty = item.quantity + change;
                     if (newQty <= 0) { handleRemoveItem(item.product_id); return; }
                     if (newQty > available) { toast.error(`Apenas ${Math.floor(available)} disponíveis.`); return; }
                     setCart(cart.map(i => i.product_id === item.product_id ? { ...i, quantity: newQty } : i));
                  };

                  return (
                    <div key={item.product_id} className={`flex flex-col gap-3 bg-white dark:bg-[#111] p-4 rounded-[1.25rem] border ${hasError ? 'border-rose-400 dark:border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 'border-slate-200/60 dark:border-white/5'} shadow-sm overflow-hidden group hover:border-blue-500/30 transition-colors`}>
                      
                      {/* Linha 1: Info e Lixo */}
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                            <Package className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="font-bold text-sm leading-snug text-slate-900 dark:text-white line-clamp-2 break-words" title={item.name}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">{item.sku}</span>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                            </div>
                          </div>
                        </div>

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full shrink-0 -mt-1 -mr-1" onClick={() => handleRemoveItem(item.product_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* OBSERVAÇÃO OBRIGATÓRIA (EPI / CAMISETA / FERRAMENTAS) */}
                      {requiresObs && (
                          <div className="px-1 py-1 animate-in fade-in slide-in-from-top-2">
                             <Label className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-1 ${missingObs ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-500'}`}>
                               <AlertTriangle className="w-3 h-3" /> Para quem é {obsLabel}? *
                             </Label>
                             <Input 
                                placeholder="Nome do colaborador..."
                                value={item.observation || ''}
                                onChange={(e) => setCart(cart.map(i => i.product_id === item.product_id ? { ...i, observation: e.target.value } : i))}
                                className={`h-9 text-xs focus:ring-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10 ${missingObs ? 'border-rose-300 dark:border-rose-500/50 text-rose-900 dark:text-rose-100' : 'border-amber-300 dark:border-amber-900/50 text-amber-900 dark:text-amber-100'}`}
                             />
                          </div>
                      )}

                      {/* Linha 2: Controlos de Quantidade */}
                      <div className="flex justify-end items-center pt-3 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center bg-slate-100 dark:bg-white/10 rounded-full border border-slate-200/60 dark:border-white/5 p-1 shadow-inner">
                          <button onClick={() => updateQty(-1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-[#222] text-slate-700 dark:text-slate-300 shadow-sm active:scale-90 transition-transform font-bold hover:bg-slate-200 dark:hover:bg-[#333]">
                            -
                          </button>
                          
                          <input 
                            type="number" 
                            min="1"
                            inputMode="numeric"
                            value={item.quantity || ''} 
                            onChange={(e) => setExactQuantity(item.product_id, e.target.value, available, e)}
                            onBlur={() => handleQuantityBlur(item.product_id)}
                            className="w-12 text-center text-[15px] font-black text-blue-700 dark:text-blue-400 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded p-1 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          
                          <button onClick={() => updateQty(1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-sm active:scale-90 transition-transform font-bold hover:bg-blue-700">
                            +
                          </button>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}

        <div className="p-4 border-t border-slate-200/50 dark:border-white/5 bg-white dark:bg-[#111] mt-auto pb-8 md:pb-4 flex flex-col gap-4">
           
           {/* 🟢 CAMPO GLOBAL DA OP NO RODAPÉ - Escondido se não for exigido */}
           {cart.length > 0 && isOpRequiredForCart && (
             <div className="bg-slate-50 dark:bg-white/5 p-3 sm:p-4 rounded-[1rem] border border-slate-200/60 dark:border-white/5 shadow-inner animate-in fade-in zoom-in-95 duration-200">
               <Label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                 <Briefcase className="w-4 h-4" /> Número da OP (Ordem de Produção)
               </Label>
               <Input 
                 placeholder="Ex: OP-1234"
                 value={opCode}
                 onChange={(e) => setOpCode(e.target.value)}
                 className="h-11 bg-white dark:bg-[#111] border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500/30 transition-all font-medium"
               />
               <p className="text-[10px] text-slate-500 mt-2 leading-snug">
                 * Obrigatório preencher caso existam componentes. Pode ser deixado em branco APENAS para retirar Insumos, EPIs, Camisetas ou Ferramentas.
               </p>
             </div>
           )}

           <div>
             <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-slate-500">Total de Itens</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">{cart.length}</span>
             </div>
             <Button 
                className={`w-full h-14 text-base font-bold rounded-2xl transition-all duration-300 ${cart.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)]' : 'bg-slate-200 dark:bg-white/10 text-slate-400'}`} 
                onClick={handleSubmit} 
                disabled={cart.length === 0 || createRequestMutation.isPending}
             >
                {createRequestMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Send className="mr-2 h-5 w-5" />}
                Confirmar Solicitação
             </Button>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-in fade-in duration-500 bg-[#F8FAFC] dark:bg-black selection:bg-blue-500/30">
      
      {/* ========================================== */}
      {/* CABEÇALHO */}
      {/* ========================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 px-4 md:px-0 mt-4 md:mt-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Minhas Solicitações</h1>
          <div className="text-sm md:text-base text-slate-500 font-medium mt-1.5 flex items-center gap-2">
            Setor: 
            <Badge variant="secondary" className="font-bold bg-slate-200/50 dark:bg-white/10 text-slate-700 dark:text-slate-300">
              {sector}
            </Badge>
          </div>
        </div>
        
        {/* Controle das abas visível apenas se tiver permissão para adicionar */}
        {canAdd && (
          <div className="flex bg-white dark:bg-[#111] p-1.5 rounded-full border border-slate-200/60 dark:border-white/5 shadow-sm w-full md:w-auto">
            <Button 
              variant={activeTab === "new" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setActiveTab("new")}
              className={`flex-1 md:flex-none gap-2 rounded-full font-bold transition-all ${activeTab === 'new' ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <Plus className="h-4 w-4" /> Novo Pedido
            </Button>
            <Button 
              variant={activeTab === "history" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setActiveTab("history")}
              className={`flex-1 md:flex-none gap-2 rounded-full font-bold transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <History className="h-4 w-4" /> Histórico
            </Button>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* ABA: NOVA SOLICITAÇÃO (CATÁLOGO + TAGS) */}
      {/* ========================================== */}
      {activeTab === "new" && canAdd && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 relative">
          
          {/* ESQUERDA: LISTA DE PRODUTOS */}
          <Card className="flex flex-col flex-[2] h-full border-slate-200/60 dark:border-white/5 shadow-sm overflow-hidden bg-white/50 dark:bg-[#0A0A0A]/50 backdrop-blur-xl rounded-[2rem] pb-24 lg:pb-0 mx-2 md:mx-0">
            
            <CardHeader className="pb-3 shrink-0 border-b border-slate-200/50 dark:border-white/5 p-4 sm:p-6 bg-white/30 dark:bg-white/5">
              {/* Barra de Pesquisa */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input 
                  placeholder="Procurar por nome (ex: fio) ou código..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-10 h-12 bg-white dark:bg-[#111] border border-slate-200/60 dark:border-white/5 rounded-full focus:ring-2 focus:ring-blue-500/30 transition-all font-medium text-[14px] w-full shadow-inner"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-300 hover:text-slate-500 dark:hover:text-slate-100 transition-colors bg-slate-100 dark:bg-white/10 rounded-full p-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* LISTA HORIZONTAL DE ETIQUETAS (TAGS) */}
              {availableTags.length > 0 && (
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 custom-scrollbar scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400 mr-1">
                    <Tag className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
                  </div>
                  {availableTags.map(tag => {
                    const isSelected = selectedTags?.includes(tag);
                    return (
                      <Badge
                        key={tag}
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => toggleTag(tag)}
                        className={`cursor-pointer px-3 py-1.5 text-xs font-bold transition-all shrink-0 border ${
                          isSelected 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md border-blue-600 dark:border-blue-500' 
                            : 'bg-white dark:bg-[#111] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-white/5'
                        }`}
                      >
                        {tag}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardHeader>
            
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-3 p-3 sm:p-4">
                {isLoadingProducts ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Box className="h-8 w-8 animate-bounce mb-3 text-blue-500" /> 
                    <span className="font-bold">A carregar catálogo...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-full mb-4">
                      <Search className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nenhum produto encontrado</h3>
                    <p className="text-slate-500 text-sm max-w-xs">Não encontrámos resultados para a sua procura.</p>
                    <Button variant="link" onClick={() => {setSearchTerm(""); setSelectedTags([])}} className="mt-2 text-blue-600">Limpar todos os filtros</Button>
                  </div>
                ) : (
                  filteredProducts.map((product: any) => {
                    const available = getAvailableStock(product);
                    const cartItem = cart.find(i => i.product_id === product.id);
                    const inCart = !!cartItem;
                    const pTags = getProductTags(product);
                    
                    const isRestricted = pTags.some((t: string) => t.trim().toUpperCase() === 'CAMISETA') && profile?.role !== "escritorio";
                    
                    const updateQuantity = (change: number, e: React.MouseEvent) => {
                      e.stopPropagation();
                      const currentQty = cartItem ? cartItem.quantity : 0;
                      const newQty = currentQty + change;
                
                      if (newQty <= 0) {
                        handleRemoveItem(product.id);
                        return;
                      }
                      if (newQty > available) {
                        toast.error(`Apenas ${Math.floor(available)} disponíveis em stock.`);
                        return;
                      }
                      
                      if (inCart) {
                        setCart(cart.map(i => i.product_id === product.id ? { ...i, quantity: newQty } : i));
                      } else {
                        setCart([...cart, { product_id: product.id, name: product.name, sku: product.sku, unit: product.unit, quantity: newQty, tags: pTags, observation: "" }]);
                      }
                    };

                    return (
                      <div 
                        key={product.id} 
                        className={`flex flex-col p-4 rounded-[1.25rem] shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-300 ${
                          isRestricted ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-[#111] border-slate-200/60 dark:border-white/5" :
                          available <= 0 ? "opacity-50 grayscale bg-white dark:bg-[#111] border-slate-200/60 dark:border-white/5" : 
                          inCart ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-500/50 ring-1 ring-blue-300 dark:ring-blue-500/50" : 
                          "bg-white dark:bg-[#111] border border-slate-200/60 dark:border-white/5 hover:shadow-md hover:border-blue-500/30"
                        }`}
                        onClick={() => {
                          if (isRestricted) {
                            toast.error("Somente o setor Escritório pode solicitar camisetas. Comunique com o setor escritório.");
                          }
                        }}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border ${inCart ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-transparent'}`}>
                            <Package className={`h-6 w-6 ${inCart ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={1.5} />
                          </div>
                  
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[15px] text-slate-900 dark:text-white leading-snug mb-1.5 break-words whitespace-normal">
                              {product.name}
                              {pTags.some((t: string) => t.trim().toUpperCase() === 'CAMISETA') && (
                                <Badge variant="outline" className="ml-2 text-[10px] bg-white dark:bg-black">Camiseta</Badge>
                              )}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] sm:text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${inCart ? 'text-blue-700 bg-blue-100/50 dark:text-blue-300 dark:bg-blue-500/20' : 'text-slate-400 bg-slate-100 dark:bg-white/10'}`}>
                                  {product.sku}
                                </span>
                                {available > 0 ? (
                                  <span className="text-[10px] sm:text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                    {Math.floor(available)} {product.unit} disp.
                                   </span>
                                ) : (
                                  <span className="text-[10px] sm:text-[11px] font-black text-rose-500">
                                    Esgotado
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>
                
                        <div className={`mt-3 pt-3 flex justify-end items-center border-t ${inCart ? 'border-blue-200/50 dark:border-blue-500/20' : 'border-slate-100 dark:border-white/5'}`}>
                          {isRestricted ? (
                             <span className="text-xs font-bold text-rose-500 dark:text-rose-400 flex items-center gap-1">
                               <AlertTriangle className="w-3 h-3" /> Restrito ao Escritório
                             </span>
                          ) : available > 0 && (
                            inCart ? (
                              <div className="flex items-center bg-white dark:bg-[#111] rounded-full border border-blue-200/60 dark:border-blue-500/30 shadow-inner p-1">
                                <button onClick={(e) => updateQuantity(-1, e)} className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-[#222] text-slate-700 dark:text-slate-300 shadow-sm active:scale-90 transition-transform font-bold hover:bg-slate-200 dark:hover:bg-[#333]">
                                  -
                                </button>
                                
                                <input 
                                  type="number" 
                                  min="1"
                                  inputMode="numeric"
                                  value={cartItem.quantity || ''}
                                  onChange={(e) => setExactQuantity(product.id, e.target.value, available, e)}
                                  onBlur={() => handleQuantityBlur(product.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-12 text-center text-[15px] font-black text-blue-700 dark:text-blue-400 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded p-1 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                
                                <button onClick={(e) => updateQuantity(1, e)} className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-sm active:scale-90 transition-transform font-bold hover:bg-blue-700">
                                  +
                                </button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                onClick={(e) => updateQuantity(1, e)}
                                className="h-10 px-4 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 font-bold text-sm transition-all"
                              >
                                <Plus className="h-4 w-4 mr-1" /> Adicionar
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* DIREITA: CARRINHO (Apenas Desktop) */}
          <Card className="hidden lg:flex flex-col flex-1 h-full border-slate-200/60 dark:border-white/5 shadow-lg bg-white dark:bg-[#0A0A0A] overflow-hidden rounded-[2rem]">
            <CardHeader className="pb-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/5 p-6">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-500" /> Carrinho
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              {renderCartListContent()}
            </CardContent>
          </Card>

          {/* === BARRA FIXA INFERIOR (Apenas Mobile) === */}
          {cart.length > 0 && (
            <div className="fixed bottom-28 left-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 p-4 z-30 lg:hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)] rounded-[2rem] animate-in slide-in-from-bottom-10 fade-in duration-300">
               <div className="flex items-center gap-4 max-w-md mx-auto">
                 <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
                    <p className="font-black text-xl text-slate-900 dark:text-white leading-none mt-0.5">{cart.length} item(s)</p>
                 </div>
                 <Button 
                    size="lg" 
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 rounded-xl h-14 shadow-[0_4px_20px_rgba(37,99,235,0.4)]"
                    onClick={() => setIsMobileCartOpen(true)}
                 >
                    Ver Carrinho <ChevronUp className="h-5 w-5" strokeWidth={3} />
                 </Button>
               </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* ABA: HISTÓRICO (UI Premium) */}
      {/* ========================================== */}
      {activeTab === "history" && (
        <Card className="flex-1 overflow-hidden border-slate-200/60 dark:border-white/5 shadow-sm bg-white/50 dark:bg-[#0A0A0A]/50 backdrop-blur-xl rounded-[2rem] mx-2 md:mx-0">
          
          {/* === DESKTOP TABLE === */}
          <div className="hidden md:block h-full overflow-auto rounded-[2rem] bg-white dark:bg-[#111]">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10 shadow-sm">
                <TableRow className="border-slate-200/50 dark:border-white/5">
                  <TableHead className="w-[160px] text-center font-bold text-slate-500 uppercase tracking-wider text-xs">Data do Pedido</TableHead>
                  <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-xs">Itens Solicitados</TableHead>
                  <TableHead className="w-[160px] text-center font-bold text-slate-500 uppercase tracking-wider text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRequests ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-32 font-medium text-slate-400">A carregar histórico...</TableCell></TableRow>
                ) : requests?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-64">
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-full mb-4">
                          <History className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nenhum histórico disponível</h3>
                        <p className="text-slate-500 text-sm">Você ainda não realizou nenhuma solicitação de material.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  requests?.map((request: any) => {
                    const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.aberto;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={request.id} className="hover:bg-slate-50 dark:hover:bg-white/5 border-slate-100 dark:border-white/5 transition-colors group">
                        
                        {/* Coluna Data */}
                        <TableCell className="align-top text-center p-5">
                          <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 group-hover:bg-white dark:group-hover:bg-[#222] transition-colors">
                            <span className="font-black text-slate-900 dark:text-white text-[15px]">{format(new Date(request.created_at), "dd/MM/yyyy")}</span>
                            <div className="flex items-center text-xs font-bold text-slate-400 mt-1 gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(request.created_at), "HH:mm")}
                            </div>
                          </div>
                        </TableCell>
                        
                        {/* Coluna Itens */}
                        <TableCell className="align-top p-5">
                          <div className="space-y-2">
                            {request.request_items?.map((item: any) => (
                              <div key={item.id} className="flex gap-3 items-center bg-white dark:bg-[#0A0A0A] border border-slate-100 dark:border-white/5 p-2 rounded-lg shadow-sm">
                                <Badge variant="secondary" className="h-6 px-2 font-mono text-[11px] bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-transparent shrink-0 font-bold">
                                  {Math.floor(item.quantity_requested)} {item.products?.unit}
                                </Badge>
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200 line-clamp-1">
                                    {item.products?.name || item.custom_product_name}
                                    {/* Mantive o client_service na visualização para dados antigos! */}
                                    {item.client_service && <span className="ml-2 text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-sm">OS/Cliente: {item.client_service}</span>}
                                    {item.observation && <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-sm">Para: {item.observation}</span>}
                                </span>
                              </div>
                            ))}
                            {/* Alerta de Recusa Destacado */}
                            {request.rejection_reason && (
                              <div className="mt-3 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 p-3 rounded-xl flex items-start gap-3 shadow-sm">
                                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500"/> 
                                <div>
                                  <strong className="block text-rose-800 dark:text-rose-300 mb-0.5">Motivo da Recusa</strong>
                                  <span className="opacity-90">{request.rejection_reason}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Coluna Status */}
                        <TableCell className="align-top text-center p-5">
                          <Badge variant="outline" className={`${status.color} px-3 py-1.5 font-bold border rounded-lg text-xs flex items-center justify-center w-full shadow-sm`}>
                            <StatusIcon className="h-4 w-4 mr-1.5" strokeWidth={2.5} /> {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* === MOBILE CARDS HISTÓRICO === */}
          <div className="md:hidden space-y-4 overflow-auto pb-6 p-4">
            {isLoadingRequests ? <div className="text-center p-4 font-medium text-slate-400">A carregar...</div> : 
             requests?.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white/50 dark:bg-[#111] rounded-[2rem] border border-slate-200/50 dark:border-white/5">
                 <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-full mb-4">
                   <History className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nenhum histórico</h3>
                 <p className="text-slate-500 text-sm">Ainda não solicitou materiais.</p>
               </div>
             ) :
             requests?.map((request: any) => {
               const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.aberto;
               const StatusIcon = status.icon;
               
               return (
                <Card key={request.id} className="shadow-[0_4px_15px_rgba(0,0,0,0.03)] border border-slate-200/60 dark:border-white/5 rounded-[1.5rem] overflow-hidden bg-white dark:bg-[#111]">
                  
                  {/* Cabeçalho do Card */}
                  <CardHeader className="p-4 pb-3 flex flex-row justify-between items-center space-y-0 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0A0A0A]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-white dark:bg-[#222] border border-slate-200/60 dark:border-white/10 rounded-full flex items-center justify-center shadow-sm">
                        <Hash className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-black text-slate-900 dark:text-white">
                          #{request.id.toString().substring(0,6)}
                        </CardTitle>
                        <CardDescription className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {format(new Date(request.created_at), "dd MMM, HH:mm")}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <Badge variant="secondary" className={`text-[10px] font-bold px-2.5 py-1 border rounded-lg ${status.color}`}>
                      <StatusIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} /> {status.label}
                    </Badge>
                  </CardHeader>
                  
                  {/* Corpo do Card (Itens) */}
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {request.request_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-start gap-3 text-sm bg-slate-50/50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-100 dark:border-white/5 flex-col sm:flex-row">
                          <div className="flex justify-between w-full">
                              <span className="font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug flex-1">
                                {item.products?.name || item.custom_product_name}
                              </span>
                              <span className="font-mono text-[12px] font-black text-slate-600 dark:text-slate-300 whitespace-nowrap bg-white dark:bg-black px-2 py-1 rounded-md shadow-sm border border-slate-200/50 dark:border-white/10 shrink-0">
                                {Math.floor(item.quantity_requested)} {item.products?.unit}
                              </span>
                          </div>
                          
                          <div className="flex gap-2 flex-wrap mt-1">
                            {item.client_service && <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-md w-fit">OS/Cliente: {item.client_service}</span>}
                            {item.observation && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-md w-fit">Para: {item.observation}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Alerta de Recusa Mobile */}
                    {request.rejection_reason && (
                      <div className="mt-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 p-3 rounded-xl flex items-start gap-2 shadow-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5"/> 
                        <span className="leading-snug"><strong className="text-rose-800 dark:text-rose-300">Recusado:</strong> {request.rejection_reason}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
               )
             })
            }
          </div>
        </Card>
      )}

      {/* ========================================== */}
      {/* DRAWER CARRINHO MOBILE (Design Premium) */}
      {/* ========================================== */}
      <Drawer open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DrawerContent className="bg-[#FAFAFA] dark:bg-[#0A0A0A] border-t border-slate-200/60 dark:border-white/10 rounded-t-[2rem]">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mt-4 mb-2" />
          <DrawerHeader className="text-left px-6 pb-4 border-b border-slate-200/50 dark:border-white/5">
            <DrawerTitle className="text-xl font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-500" strokeWidth={2.5} /> 
              Seu Carrinho
            </DrawerTitle>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Revise os itens antes de enviar para o almoxarifado.
            </p>
          </DrawerHeader>
          
          <div className="flex-1 overflow-y-auto max-h-[65vh] custom-scrollbar px-2">
            {renderCartListContent()}
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
