import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Search, Package, Clock, Send, ShieldAlert, AlertCircle, CheckCircle2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Utilitário para formatar minutos em horas e minutos
const formatMinutes = (m: number) => {
  if (!m || m <= 0) return "Pronta Entrega";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}min` : `${min}min`;
};

// Descrição que corta em 2 linhas por padrão, mas oferece "Ver mais" quando o
// texto realmente transborda — assim peças com descrição longa podem ser lidas
// por inteiro sem quebrar o alinhamento do grid.
const ExpandableDescription = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      // Mede com o clamp aplicado: se o conteúdo é maior que a área visível,
      // há texto escondido → mostramos o botão "Ver mais".
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [text]);

  return (
    <div className="mb-5 flex-1">
      <p
        ref={ref}
        title={text}
        className={`text-xs text-slate-500 dark:text-slate-400 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {(isClamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  );
};

export default function Request3DPage() {
  const { profile, canAccess } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  
  // Estados do Formulário de Pedido
  const [quantity, setQuantity] = useState(1);
  const [opCode, setOpCode] = useState("");
  const [observation, setObservation] = useState("");
  const [priority, setPriority] = useState("Média"); // NOVO: Estado de Prioridade
  const [submitting, setSubmitting] = useState(false);

  // --- VALIDAÇÃO DE PERMISSÕES RBAC ---
  const hasViewPermission = canAccess("solicitar_3d:view") || canAccess("producao_3d") || canAccess("solicitar_3d");
  const hasAddPermission = canAccess("solicitar_3d:add") || canAccess("producao_3d");

  // 1. Busca os Produtos (Catálogo)
  const { data: allProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await api.get("/products")).data,
    enabled: hasViewPermission,
  });

  // 2. Busca o Estoque Físico para cruzar a informação
  const { data: stockData = [], isLoading: loadingStock } = useQuery({
    queryKey: ["stock-all"],
    queryFn: async () => (await api.get("/stock")).data,
    enabled: hasViewPermission,
  });

  // 3. Busca os clientes/OPs para o seletor de OP (mesmo padrão da página de Solicitações)
  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients-3d"],
    queryFn: async () => {
      const res = await api.get("/clients");
      return res.data.map((c: any) => ({
        ...c,
        services: Array.isArray(c.services) ? c.services : (typeof c.services === 'string' ? JSON.parse(c.services) : []),
      }));
    },
    enabled: hasViewPermission,
  });

  const isLoading = loadingProducts || loadingStock;

  // Cruzamento Inteligente: Junta o catálogo de produtos com as quantidades em estoque
  const filtered3DParts = useMemo(() => {
    return allProducts
      .filter((p: any) => p.is_3d === true)
      .filter((p: any) => 
         p.name.toLowerCase().includes(search.toLowerCase()) || 
         p.sku.toLowerCase().includes(search.toLowerCase())
      )
      .map((p: any) => {
         // Procura se existe informação deste produto na tabela de estoque
         // Funciona tanto para /stock (product_id) quanto para /stock/display (id)
         const s = stockData.find((item: any) => item.product_id === p.id || item.id === p.id);
         
         // Dá prioridade ao que vem do estoque, com fallback seguro para número
         const onHand = s?.quantity_on_hand !== undefined ? s.quantity_on_hand : p.quantity_on_hand;
         const reserved = s?.quantity_reserved !== undefined ? s.quantity_reserved : p.quantity_reserved;

         return {
           ...p,
           quantity_on_hand: Number(onHand) || 0,
           quantity_reserved: Number(reserved) || 0
         };
      });
  }, [allProducts, stockData, search]);

  const handleOpenModal = (product: any) => {
    setSelectedProduct(product);
    setQuantity(1);
    setOpCode("");
    setObservation("");
    setPriority("Média"); // Reseta para o padrão ao abrir
  };

  const handleRequest = async () => {
    if (!hasAddPermission) {
      toast.error("Não tens permissão para solicitar peças.");
      return;
    }

    if (!profile?.sector) {
      toast.error("O teu perfil não tem um setor associado.");
      return;
    }

    // OP é obrigatória para peças 3D (não têm tags isentas; o backend rejeita sem OP)
    if (!opCode || !opCode.trim()) {
      toast.error("Selecione a OP correspondente para solicitar a peça.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/requests', {
        sector: profile.sector,
        op_code: opCode.trim(),
        items: [
          {
            product_id: selectedProduct.id,
            quantity: quantity,
            observation: observation,
            priority: priority // <-- Enviando a prioridade para o backend
          }
        ]
      });

      // Atualiza a vitrine (estoque/reserva mudaram) e as solicitações
      queryClient.invalidateQueries({ queryKey: ["stock-all"] });
      queryClient.invalidateQueries({ queryKey: ["products-active"] });
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });

      toast.success("Solicitação enviada com sucesso!");
      setSelectedProduct(null);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Erro ao enviar solicitação.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDERIZAÇÃO DE ACESSO NEGADO ---
  if (!hasViewPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-in fade-in">
        <div className="p-4 bg-red-500/10 rounded-full text-red-500">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acesso Negado</h2>
          <p className="text-slate-500 dark:text-slate-400">Não tens permissão para aceder à Vitrine 3D.</p>
        </div>
      </div>
    );
  }

  // --- CÁLCULOS INTELIGENTES DO MODAL ---
  // Descobre quanto tem na prateleira física e força como Número
  const availableStock = selectedProduct ? Math.max(0, Number(selectedProduct.quantity_on_hand) - Number(selectedProduct.quantity_reserved)) : 0;
  // Calcula quanto realmente vai precisar ir para a máquina
  const missingQty = Math.max(0, quantity - availableStock);
  // Calcula o tempo SOMENTE das peças que faltam
  const estimatedTime = selectedProduct ? (missingQty * Number(selectedProduct.production_minutes || 0)) : 0;

  return (
    <div className="space-y-6 p-2 lg:p-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-32 lg:pb-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Vitrine 3D
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Solicite peças para fabricação sob demanda.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white dark:bg-black/20 border-slate-200 dark:border-white/10" 
            placeholder="Buscar peça por nome ou código..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {/* LISTAGEM DAS PEÇAS */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-[300px] w-full rounded-2xl dark:bg-white/5" />)}
        </div>
      ) : filtered3DParts.length === 0 ? (
        <Card className="border-dashed border-slate-200 dark:border-white/10 bg-transparent shadow-none">
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma peça 3D encontrada no catálogo com estes termos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered3DParts.map((p: any) => {
            const stock = Math.max(0, p.quantity_on_hand - p.quantity_reserved);
            return (
              <Card key={p.id} className="border-slate-200 dark:border-white/10 overflow-hidden group hover:shadow-md transition-all bg-white dark:bg-[#1A1A1A] flex flex-col rounded-2xl">
                <div className="aspect-video bg-slate-100 dark:bg-white/5 overflow-hidden flex items-center justify-center relative">
                  {p.image_url ? (
                     <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                     <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  )}
                  
                  {/* ETIQUETA VISUAL NO CARTÃO */}
                  <div className="absolute top-2 right-2">
                    {stock > 0 ? (
                      <Badge className="bg-emerald-500/90 hover:bg-emerald-500/90 text-white shadow-sm flex items-center gap-1 backdrop-blur-md">
                        <CheckCircle2 className="h-3 w-3"/> {stock} em Stock
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-500/90 hover:bg-orange-500/90 text-white shadow-sm flex items-center gap-1 backdrop-blur-md">
                        <Clock className="h-3 w-3"/> {formatMinutes(p.production_minutes)}/un.
                      </Badge>
                    )}
                  </div>
                </div>
                
                <CardContent className="p-5 flex flex-col flex-1">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mb-1">{p.sku}</p>
                  <h3 title={p.name} className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mb-2 leading-tight">
                    {p.name}
                  </h3>
                  <ExpandableDescription text={p.description || "Nenhuma descrição técnica informada para este modelo."} />
                  
                  {hasAddPermission ? (
                      <Button 
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm mt-auto rounded-xl h-11"
                          onClick={() => handleOpenModal(p)}
                      >
                          <Send className="h-4 w-4 mr-2" /> Solicitar Peça
                      </Button>
                  ) : (
                      <Badge variant="secondary" className="w-full py-2 justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5">
                          Apenas Leitura
                      </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE SOLICITAÇÃO PROFISSIONAL */}
      <Dialog open={!!selectedProduct} onOpenChange={(o) => !o && setSelectedProduct(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 sm:rounded-3xl p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <DialogTitle className="text-xl">Configurar Solicitação</DialogTitle>
          </div>
          
          {selectedProduct && (
            <div className="px-6 py-4 grid gap-5">
              
              {/* --- PAINEL DE INTELIGÊNCIA --- */}
              <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${missingQty > 0 ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20' : 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20'}`}>
                 <div className="flex flex-col gap-1 mb-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white flex-1">{selectedProduct.name}</span>
                    {selectedProduct.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-h-28 overflow-y-auto pr-1 whitespace-pre-wrap">
                        {selectedProduct.description}
                      </p>
                    )}
                 </div>

                 <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-black/20 p-2 rounded-xl text-center border border-slate-100 dark:border-white/5">
                       <p className="text-[10px] text-slate-500 uppercase font-bold">Em Stock</p>
                       <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{availableStock} un.</p>
                    </div>
                    <div className="bg-white dark:bg-black/20 p-2 rounded-xl text-center border border-slate-100 dark:border-white/5">
                       <p className="text-[10px] text-slate-500 uppercase font-bold">A Produzir</p>
                       <p className="text-sm font-black text-orange-600 dark:text-orange-400">{missingQty} un.</p>
                    </div>
                    <div className="bg-white dark:bg-black/20 p-2 rounded-xl text-center border border-slate-100 dark:border-white/5">
                       <p className="text-[10px] text-slate-500 uppercase font-bold">Tempo Add.</p>
                       <p className="text-sm font-black text-blue-600 dark:text-blue-400">{formatMinutes(estimatedTime)}</p>
                    </div>
                 </div>
                 
                 {/* MENSAGEM DINÂMICA DE FEEDBACK */}
                 {missingQty === 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Estoque suficiente. O pedido vai direto para separação!
                    </p>
                 )}
                 {missingQty > 0 && availableStock > 0 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="h-3 w-3" /> Reservaremos {availableStock} peças. Faltam {missingQty} ir para a fábrica.
                    </p>
                 )}
                 {missingQty > 0 && availableStock === 0 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1 font-medium">
                      <Clock className="h-3 w-3" /> Sem stock atual. Todas as peças vão para a fábrica.
                    </p>
                 )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Qtd.</Label>
                  <Input
                    type="number" min={1}
                    className="h-11 rounded-xl bg-slate-50 dark:bg-black/20"
                    value={quantity}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); setQuantity(isNaN(v) || v < 1 ? 1 : v); }}
                  />
                </div>
                {/* --- SELETOR DE PRIORIDADE --- */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-black/20 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* --- SELETOR DE OP (OBRIGATÓRIO) — abre todas as OPs disponíveis, agrupadas por cliente --- */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Número da OP <span className="text-red-500">*</span>
                </Label>
                <Select value={opCode} onValueChange={setOpCode}>
                  <SelectTrigger className={`h-11 rounded-xl bg-slate-50 dark:bg-black/20 text-[13px] ${!opCode ? 'border-red-300 dark:border-red-800' : ''}`}>
                    <SelectValue placeholder="Selecione a OP correspondente..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {clientsData.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">Nenhum cliente/OP encontrado no sistema.</div>
                    ) : (
                      clientsData.map((client: any) => {
                        const ops = (client.services || []).filter((op: any) => {
                          const status = (op.status || "").toLowerCase();
                          return !['concluido', 'finalizada', 'encerrada'].includes(status);
                        });
                        if (ops.length === 0) return null;
                        return (
                          <SelectGroup key={client.id || client.name}>
                            <SelectLabel className="bg-slate-100 dark:bg-[#222] text-slate-700 dark:text-slate-300 font-bold px-3 py-2 text-xs uppercase tracking-wider sticky top-0 z-10">
                              {client.name}
                            </SelectLabel>
                            {ops.map((op: any) => (
                              <SelectItem key={op.id} value={String(op.op_code)} className="font-medium cursor-pointer py-2.5">
                                OP-{op.op_code}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Requisitos Técnicos / Cores</Label>
                <Textarea 
                  placeholder="Ex: Preciso da peça na cor preta, preenchimento 100%..." 
                  className="resize-none h-20 rounded-xl bg-slate-50 dark:bg-black/20 text-sm"
                  value={observation} 
                  onChange={(e) => setObservation(e.target.value)} 
                />
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" className="rounded-xl" onClick={() => setSelectedProduct(null)}>
                Cancelar
              </Button>
              <Button 
                 className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md" 
                 onClick={handleRequest}
                 disabled={submitting}
              >
                {submitting ? "A processar..." : "Confirmar Solicitação"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
