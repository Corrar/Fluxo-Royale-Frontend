import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Package, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Utilitário para formatar minutos em horas e minutos
const formatMinutes = (m: number) => {
  if (!m) return "N/A";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}min` : `${min}min`;
};

export default function Request3DPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  
  // Estados do Formulário de Pedido
  const [quantity, setQuantity] = useState(1);
  const [opCode, setOpCode] = useState("");
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Busca todos os produtos ativos do backend (O backend já nos envia as colunas de 3D agora)
  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await api.get("/products")).data,
  });

  // Filtra apenas os que são peças 3D e aplica a busca por texto do utilizador
  const filtered3DParts = useMemo(() => {
    return allProducts
      .filter((p: any) => p.is_3d === true)
      .filter((p: any) => 
         p.name.toLowerCase().includes(search.toLowerCase()) || 
         p.sku.toLowerCase().includes(search.toLowerCase())
      );
  }, [allProducts, search]);

  const handleOpenModal = (product: any) => {
    setSelectedProduct(product);
    setQuantity(1);
    setOpCode("");
    setObservation("");
  };

  const handleRequest = async () => {
    if (!profile?.sector) {
      toast.error("O seu perfil não tem um setor associado.");
      return;
    }

    setSubmitting(true);
    try {
      // Cria a solicitação exatamente como a página de "Meus Pedidos" faria
      // Graças à nossa Ponte Mágica no Backend, isso vai direto para o Kanban 3D!
      await api.post('/requests', {
        sector: profile.sector,
        op_code: opCode.trim() || undefined,
        items: [
          {
            product_id: selectedProduct.id,
            quantity: quantity,
            observation: observation
          }
        ]
      });

      toast.success("Solicitação enviada para a Produção 3D com sucesso!");
      setSelectedProduct(null); // Fecha o modal
    } catch (error: any) {
      const msg = error.response?.data?.error || "Erro ao enviar solicitação.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-2 lg:p-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-32 lg:pb-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Catálogo de Impressão 3D
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
          {filtered3DParts.map((p: any) => (
            <Card key={p.id} className="border-slate-200 dark:border-white/10 overflow-hidden group hover:shadow-md transition-all bg-white dark:bg-[#1A1A1A] flex flex-col rounded-2xl">
              <div className="aspect-video bg-slate-100 dark:bg-white/5 overflow-hidden flex items-center justify-center relative">
                {p.image_url ? (
                   <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                   <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                )}
                {/* Tempo de fabricação sobreposto na imagem */}
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                   <Clock className="h-3 w-3 text-emerald-400" /> Fabrico: {formatMinutes(p.production_minutes)}
                </div>
              </div>
              
              <CardContent className="p-5 flex flex-col flex-1">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mb-1">{p.sku}</p>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mb-2 leading-tight">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-5 flex-1">
                  {p.description || "Nenhuma descrição técnica informada para este modelo."}
                </p>
                
                <Button 
                   className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm mt-auto rounded-xl h-11"
                   onClick={() => handleOpenModal(p)}
                >
                  <Send className="h-4 w-4 mr-2" /> Solicitar Peça
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DE SOLICITAÇÃO */}
      <Dialog open={!!selectedProduct} onOpenChange={(o) => !o && setSelectedProduct(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Solicitar Fabricação 3D</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="grid gap-5 py-3">
              {/* Resumo da Peça selecionada */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                 {selectedProduct.image_url ? (
                   <img src={selectedProduct.image_url} alt="" className="h-14 w-14 rounded-xl object-cover shadow-sm" />
                 ) : (
                   <div className="h-14 w-14 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center">
                     <Package className="h-7 w-7 text-slate-400"/>
                   </div>
                 )}
                 <div className="flex flex-col justify-center">
                   <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{selectedProduct.name}</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-2">{selectedProduct.sku}</p>
                   <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                         Estimativa Total: {formatMinutes(selectedProduct.production_minutes * quantity)}
                      </Badge>
                   </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Quantidade</Label>
                  <Input 
                    type="number" min={1} 
                    className="h-11 rounded-xl bg-slate-50 dark:bg-black/20"
                    value={quantity} 
                    onChange={(e) => setQuantity(Math.max(1, +e.target.value))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Nº da OP</Label>
                  <Input 
                    placeholder="Ex: OP-1234" 
                    className="h-11 rounded-xl bg-slate-50 dark:bg-black/20"
                    value={opCode} 
                    onChange={(e) => setOpCode(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Observações / Requisitos Técnicos</Label>
                <Textarea 
                  placeholder="Ex: Preciso da peça na cor preta, preenchimento 100%..." 
                  className="resize-none h-24 rounded-xl bg-slate-50 dark:bg-black/20"
                  value={observation} 
                  onChange={(e) => setObservation(e.target.value)} 
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setSelectedProduct(null)}>
              Cancelar
            </Button>
            <Button 
               className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md" 
               onClick={handleRequest}
               disabled={submitting}
            >
              {submitting ? "A enviar..." : "Confirmar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
