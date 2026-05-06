import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { 
  Search as SearchIcon, ArrowLeft, Package, FileText, 
  ChevronRight, MapPin, Tag, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Função utilitária para normalizar texto (remove acentos e deixa minúsculo)
const normalizeStr = (str: string) => 
  str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const navigate = useNavigate();

  // Filtros de categoria
  const [activeTab, setActiveTab] = useState<"all" | "products" | "requests">("all");
  
  // Estado para forçar a visualização da animação de busca (Truque de UX)
  const [isSearching, setIsSearching] = useState(false);

  // Buscando dados reais da API simultaneamente
  const { data, isLoading } = useQuery({
    queryKey: ["globalSearchData"],
    queryFn: async () => {
      const [productsRes, requestsRes] = await Promise.all([
        api.get("/products").catch(() => ({ data: [] })),
        api.get("/requests").catch(() => ({ data: [] }))
      ]);
      return {
        products: productsRes.data || [],
        requests: requestsRes.data || []
      };
    },
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });

  // Efeito UX: Mostra a animação da lupa por 1.5 segundos sempre que o termo muda
  useEffect(() => {
    if (query && !isLoading) {
      setIsSearching(true);
      // Aumentamos o tempo para 1500ms (1.5 segundos)
      const timeout = setTimeout(() => setIsSearching(false), 1500);
      return () => clearTimeout(timeout);
    }
  }, [query, isLoading]);

  // Algoritmo Inteligente de Filtragem
  const searchResults = useMemo(() => {
    if (!data || !query.trim()) return [];

    const normalizedQuery = normalizeStr(query);
    const searchWords = normalizedQuery.split(" ").filter(w => w.length > 0);

    // 1. Filtrar Produtos
    const matchedProducts = data.products.filter((p: any) => {
      const pName = normalizeStr(p.name);
      const pSku = normalizeStr(p.sku).replace(/\./g, ""); 
      const pTags = normalizeStr((p.tags || []).join(" "));
      
      return searchWords.every(word => 
        pName.includes(word) || pSku.includes(word.replace(/\./g, "")) || pTags.includes(word)
      );
    }).map((p: any) => ({
      id: `prod_${p.id}`,
      type: "product",
      title: p.name,
      subtitle: `SKU: ${p.sku}`,
      extra: `${p.stock?.quantity_on_hand || 0} ${p.unit} no estoque`,
      badge: "Produto"
    }));

    // 2. Filtrar Solicitações (Pedidos)
    const matchedRequests = data.requests.filter((r: any) => {
      const rSector = normalizeStr(r.sector);
      const rRequester = normalizeStr(r.requester?.name);
      const rId = normalizeStr(`req-${r.id}`);
      const rItems = normalizeStr(
        r.request_items?.map((i: any) => i.products?.name || i.custom_product_name).join(" ")
      );

      return searchWords.every(word => 
        rSector.includes(word) || rRequester.includes(word) || rId.includes(word) || rItems.includes(word)
      );
    }).map((r: any) => ({
      id: `req_${r.id}`,
      type: "request",
      title: `Pedido de ${r.requester?.name || "Desconhecido"}`,
      subtitle: r.sector || "Setor Geral",
      extra: r.status === 'entregue' ? 'Concluído' : r.status === 'aberto' ? 'Em Análise' : r.status,
      badge: "Pedido"
    }));

    // Combina tudo
    const combined = [...matchedProducts, ...matchedRequests];

    // Aplica o filtro da aba atual
    if (activeTab === "products") return combined.filter(item => item.type === "product");
    if (activeTab === "requests") return combined.filter(item => item.type === "request");
    
    return combined;
  }, [data, query, activeTab]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#000000] animate-in fade-in duration-500 rounded-[2.5rem] lg:rounded-none overflow-hidden">
      
      {/* --- Cabeçalho da Página --- */}
      <div className="p-6 lg:p-8 border-b border-slate-200/60 dark:border-white/5 shrink-0 flex flex-col gap-6 bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-3xl z-10 relative">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="h-12 w-12 rounded-full bg-white dark:bg-[#111] border border-slate-200/60 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm active:scale-95 transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-300" strokeWidth={2.5} />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">
              Resultados da Busca
            </h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              Buscando por: <span className="font-black text-blue-600 dark:text-blue-400">"{query}"</span>
            </p>
          </div>
        </div>

        {/* Filtros (Tabs) */}
        {!(isLoading || isSearching) && query && (
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 sm:pb-0">
            <Badge 
              variant="outline"
              onClick={() => setActiveTab("all")}
              className={`cursor-pointer px-4 py-2 rounded-full font-bold text-[13px] transition-all border-none ${activeTab === 'all' ? 'bg-slate-800 text-white shadow-md dark:bg-white dark:text-black' : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
            >
              <Layers className="h-4 w-4 mr-1.5" /> Todos
            </Badge>
            <Badge 
              variant="outline"
              onClick={() => setActiveTab("products")}
              className={`cursor-pointer px-4 py-2 rounded-full font-bold text-[13px] transition-all border-none ${activeTab === 'products' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
            >
              <Package className="h-4 w-4 mr-1.5" /> Produtos
            </Badge>
            <Badge 
              variant="outline"
              onClick={() => setActiveTab("requests")}
              className={`cursor-pointer px-4 py-2 rounded-full font-bold text-[13px] transition-all border-none ${activeTab === 'requests' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'}`}
            >
              <FileText className="h-4 w-4 mr-1.5" /> Pedidos
            </Badge>
          </div>
        )}
      </div>

      {/* --- Área de Resultados --- */}
      <div className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar relative z-0">
        {(isLoading || isSearching) ? (
          
          // ==========================================
          // ESTADO: CARREGANDO (LUPA FLUIDA CLEAN)
          // ==========================================
          <div className="h-[50vh] flex flex-col items-center justify-center gap-8 relative">
            
            {/* CSS da animação fluida (Trajeto em formato de "oito" ou círculo suave) */}
            <style>{`
              @keyframes smooth-search {
                0%   { transform: translate(0px, 0px) rotate(0deg); }
                25%  { transform: translate(15px, -10px) rotate(15deg); }
                50%  { transform: translate(20px, 15px) rotate(5deg); }
                75%  { transform: translate(-10px, 20px) rotate(-15deg); }
                100% { transform: translate(0px, 0px) rotate(0deg); }
              }
              .animate-glass {
                animation: smooth-search 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
              }
            `}</style>

            {/* Ilustração Clean */}
            <div className="relative flex items-center justify-center w-32 h-32 mt-4">
              <div className="absolute z-10 animate-glass bg-white dark:bg-[#111] p-4 rounded-full shadow-[0_15px_40px_rgba(37,99,235,0.25)] dark:shadow-[0_15px_40px_rgba(37,99,235,0.15)] border border-slate-100 dark:border-white/10 ring-8 ring-blue-500/10 dark:ring-blue-500/20">
                <SearchIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
              </div>
            </div>

            {/* Texto Animado */}
            <div className="flex flex-col items-center gap-1.5 z-10">
              <h3 className="font-black text-xl text-slate-800 dark:text-slate-200 tracking-tight flex items-end gap-1">
                Buscando resultados
                <span className="flex gap-0.5 mb-1.5 ml-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
              </h3>
            </div>
          </div>
          
        ) : !query ? (
          // Estado: Nenhuma busca feita
          <div className="h-[50vh] flex flex-col items-center justify-center text-slate-400 gap-4">
            <div className="h-20 w-20 bg-white dark:bg-[#111] rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-white/5">
              <SearchIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={2} />
            </div>
            <p className="font-bold text-lg text-slate-500 dark:text-slate-400">Digite algo na barra de pesquisa acima.</p>
          </div>
        ) : searchResults.length === 0 ? (
          // Estado: Sem resultados
          <div className="h-[50vh] flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 bg-slate-100 dark:bg-[#111] rounded-[2rem] flex items-center justify-center shadow-inner mb-4">
              <SearchIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Nenhum resultado</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-sm mt-2">
              Não encontramos nenhum produto ou pedido que corresponda a <span className="font-bold">"{query}"</span>.
            </p>
          </div>
        ) : (
          // Estado: Com resultados
          <div className="flex flex-col gap-4 max-w-4xl mx-auto animate-in fade-in duration-500 slide-in-from-bottom-4">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 ml-2">
              {searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
            </p>

            {searchResults.map((item) => (
              <div 
                key={item.id} 
                onClick={() => navigate(item.type === 'product' ? '/products' : '/requests')}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 bg-white dark:bg-[#111] border border-slate-200/60 dark:border-white/5 rounded-[1.5rem] hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-[0_10px_40px_rgba(0,0,0,0.05)] transition-all cursor-pointer group active:scale-[0.98]"
              >
                {/* Ícone Redondo */}
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-colors ${item.type === 'product' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : 'bg-blue-50 text-blue-500 dark:bg-blue-500/10'}`}>
                  {item.type === 'product' ? <Package className="h-7 w-7" strokeWidth={2.5} /> : <FileText className="h-7 w-7" strokeWidth={2.5} />}
                </div>
                
                {/* Informação Central */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-lg border-none bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      {item.badge}
                    </Badge>
                  </div>
                  <h4 className="font-black text-lg text-slate-900 dark:text-white truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[14px] font-semibold text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    {item.type === 'product' ? <Tag className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                    {item.subtitle}
                  </p>
                </div>

                {/* Bloco da Direita (Status / Extra) */}
                <div className="flex items-center justify-between sm:justify-end sm:flex-col shrink-0 gap-2 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
                  <span className={`text-[12px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${item.type === 'product' ? 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                    {item.extra}
                  </span>
                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white text-slate-400 transition-colors shadow-sm">
                    <ChevronRight className="h-4 w-4" strokeWidth={3} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
