import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  ArchiveRestore, 
  PackageX, 
  Search, 
  ShieldAlert, 
  ArrowLeft,
  XCircle,
  PackageOpen,
  Archive
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

// FRAMER MOTION PARA ANIMAÇÕES
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";

const smoothCurve: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export default function InactiveProducts() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  // 🛡️ Segurança: Se não for admin, bloqueia o ecrã
  if (profile?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-muted-foreground">
        <ShieldAlert className="h-20 w-20 text-destructive mb-4" />
        <h1 className="text-3xl font-black text-foreground tracking-tight">Acesso Restrito</h1>
        <p className="mt-2 text-lg">Apenas administradores podem aceder a esta área.</p>
      </div>
    );
  }

  // 1. Busca os produtos inativos
  const { data: inactiveProducts, isLoading } = useQuery<any[]>({
    queryKey: ["inactive-products"],
    queryFn: async () => {
      const response = await api.get("/products/inactive");
      return response.data;
    },
  });

  // 2. Função para reativar
  const reactivateMutation = useMutation({
    mutationFn: async (sku: string) => (await api.put(`/products/reactivate/${sku}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inactive-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto restaurado com sucesso!");
    },
    onError: (error: any) => toast.error(error.response?.data?.error || "Erro ao reativar o produto."),
  });

  // 3. Filtro de pesquisa
  const filteredProducts = useMemo(() => {
    if (!inactiveProducts) return [];
    if (!searchTerm) return inactiveProducts;
    
    const term = searchTerm.toLowerCase();
    return inactiveProducts.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term)
    );
  }, [inactiveProducts, searchTerm]);

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-background text-foreground font-sans pb-24 overflow-x-hidden">
        
        {/* HEADER IDÊNTICO AO SEPARATIONS.TSX */}
        <m.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: smoothCurve }}
          className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
        >
            <div className="container px-4 py-5 flex items-center justify-between gap-4 max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    <m.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate(-1)} 
                        className="flex items-center justify-center hover:bg-muted/80 rounded-full h-12 w-12 shrink-0 transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </m.button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-sm border border-amber-500/20 shrink-0">
                        <Archive className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black leading-none tracking-tight">Arquivo Morto</h1>
                        <p className="text-sm font-medium text-muted-foreground mt-0.5">
                            {inactiveProducts?.length || 0} {(inactiveProducts?.length === 1) ? 'item inativo' : 'itens inativos'}
                        </p>
                    </div>
                </div>
            </div>
        </m.header>

        {/* CORPO PRINCIPAL */}
        <main className="container px-4 py-8 max-w-7xl mx-auto">
          
          {/* BARRA DE PESQUISA PADRONIZADA */}
          <m.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: smoothCurve, delay: 0.1 }}
            className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8"
          >
             <div className="relative w-full md:max-w-xl group bg-background rounded-2xl shadow-sm border border-border focus-within:border-primary/50 focus-within:ring-4 ring-primary/10 transition-all">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Buscar produto arquivado por nome ou SKU..." 
                    className="pl-12 h-12 border-0 bg-transparent shadow-none text-base focus-visible:ring-0 placeholder:font-semibold"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 active:scale-90"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
             </div>
          </m.div>

          {/* LISTA DE ITENS EM GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 pb-10">
            {isLoading ? (
              // SKELETONS
              [1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-card border border-border/50 rounded-[28px] p-5 flex flex-col justify-between h-[180px] animate-pulse shadow-sm">
                  <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-[20px] bg-muted shrink-0"></div>
                      <div className="flex-1 space-y-3 mt-1">
                        <div className="h-5 w-3/4 bg-muted rounded-md"></div>
                        <div className="h-4 w-1/2 bg-muted rounded-md"></div>
                      </div>
                  </div>
                  <div className="h-12 w-full bg-muted rounded-[20px] mt-4"></div>
                </div>
              ))
            ) : filteredProducts.length === 0 ? (
              // EMPTY STATE
              <m.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-muted/30 rounded-[40px] border border-dashed border-border"
              >
                <div className="h-24 w-24 bg-background rounded-full flex items-center justify-center mb-6 shadow-sm border border-border/50">
                  <PackageX className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-black text-foreground tracking-tight">Nenhum produto arquivado</h3>
                <p className="text-muted-foreground font-medium mt-2 max-w-sm">
                  {searchTerm ? "Não encontramos nada com essa pesquisa." : "A lixeira está vazia e organizada!"}
                </p>
              </m.div>
            ) : (
              // CARTÕES MODERNOS E SEMÂNTICOS
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => (
                  <m.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: smoothCurve }}
                    key={product.id}
                    className="group flex flex-col justify-between gap-4 p-5 rounded-[28px] bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all duration-300 h-full"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="h-14 w-14 rounded-[20px] bg-muted/50 flex items-center justify-center shrink-0 border border-border/50 group-hover:bg-muted transition-colors mt-1">
                        <PackageOpen className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="secondary" className="text-[10px] font-mono font-medium tracking-wider text-muted-foreground bg-muted/50 border-0 px-2 py-0.5 rounded-md">
                            {product.sku}
                          </Badge>
                        </div>
                        <h4 className="font-black text-[17px] text-foreground leading-tight line-clamp-2">
                          {product.name}
                        </h4>
                        <p className="text-sm font-semibold text-muted-foreground mt-1">
                          Unidade: <span className="text-foreground">{product.unit}</span>
                        </p>
                      </div>
                    </div>

                    <Button 
                      onClick={() => reactivateMutation.mutate(product.sku)}
                      disabled={reactivateMutation.isPending}
                      className="mt-auto h-12 w-full rounded-[20px] bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white font-black shadow-none transition-all active:scale-95"
                    >
                      <ArchiveRestore className="h-5 w-5 mr-2" strokeWidth={2.5} />
                      Restaurar Produto
                    </Button>
                  </m.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </main>

      </div>
    </LazyMotion>
  );
}
