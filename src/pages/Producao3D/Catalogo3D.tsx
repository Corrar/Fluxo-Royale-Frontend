import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Pencil, Clock, Layers, Package, Loader2, UploadCloud, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Utilitário de formatação de tempo
const formatMinutes = (m: number) => {
  if (!m) return "0min";
  const h = Math.floor(m / 60);
  const min = Math.floor(m % 60); // Garantir que os minutos não ficam com casas decimais na exibição
  return h > 0 ? `${h}h ${min}min` : `${min}min`;
};

interface Part3D {
  id: string;
  sku: string;
  name: string;
  image_url: string | null;
  production_minutes: number;
  filament_grams: number;
  description: string | null;
  is_3d: boolean;
  tags: string | string[];
}

export default function Catalogo3D() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingPart, setEditingPart] = useState<Part3D | null>(null);
  
  // Referência oculta para o input de ficheiro
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await api.get("/products")).data,
  });

  const parts3D = useMemo(() => {
    return products
      .filter((p: any) => p.is_3d === true)
      .filter((p: any) => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.sku.toLowerCase().includes(search.toLowerCase())
      );
  }, [products, search]);

  const updateMutation = useMutation({
    mutationFn: async (updatedData: Partial<Part3D>) => {
      return api.put(`/products/${editingPart?.id}`, updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-active"] });
      toast.success("Dados técnicos da peça atualizados com sucesso!");
      setEditingPart(null);
    },
    onError: () => toast.error("Erro ao salvar alterações. A imagem pode ser demasiado grande ou houve falha na rede."),
  });

  // Função educativa: Processa o upload da imagem com validação de tamanho
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Verificar o tamanho do ficheiro (Exemplo: limite de 1 MB = 1048576 bytes)
      // Como estamos a usar Base64, ficheiros muito grandes dão erro no servidor
      const MAX_SIZE_IN_BYTES = 1 * 1024 * 1024; // 1 MB
      
      if (file.size > MAX_SIZE_IN_BYTES) {
        toast.error("Imagem muito grande! Por favor, envia uma imagem com menos de 1MB.");
        // Limpar o input para permitir selecionar novamente
        if (fileInputRef.current) fileInputRef.current.value = "";
        return; 
      }

      // FileReader é uma API nativa do navegador para ler ficheiros locais
      const reader = new FileReader();
      reader.onloadend = () => {
        // Quando a leitura termina, guardamos o resultado (a imagem em texto) no estado
        if (editingPart) {
          setEditingPart({ ...editingPart, image_url: reader.result as string });
        }
      };
      // Inicia a leitura do ficheiro
      reader.readAsDataURL(file);
    }
  };

  // Função para remover a imagem atual
  const handleRemoveImage = () => {
    if (editingPart) {
      setEditingPart({ ...editingPart, image_url: "" });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 p-2 lg:p-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-32 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Catálogo Técnico 3D
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {parts3D.length} modelos vinculados ao estoque
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            className="pl-9 bg-white dark:bg-black/20 border-slate-200 dark:border-white/10" 
            placeholder="Buscar peça por nome ou SKU..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl dark:bg-white/5" />)}
        </div>
      ) : parts3D.length === 0 ? (
        <Card className="border-dashed border-slate-200 dark:border-white/10 bg-transparent shadow-none">
          <CardContent className="py-20 text-center">
            <Package className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500">Nenhuma peça com tag "3D" encontrada no estoque.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {parts3D.map((p: Part3D) => (
            <Card key={p.id} className="overflow-hidden border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] group hover:shadow-lg transition-all rounded-2xl flex flex-col">
              <div className="aspect-video bg-slate-100 dark:bg-white/5 overflow-hidden flex items-center justify-center relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <Package className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                )}
                <div className="absolute top-2 right-2">
                   <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 backdrop-blur-md">Módulo 3D</Badge>
                </div>
              </div>
              
              <CardContent className="p-4 space-y-4 flex flex-col flex-1 justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">{p.sku}</p>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{p.name}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <Clock className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{formatMinutes(p.production_minutes)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      {/* Corrigida exibição do peso do filamento para suportar decimais visualmente */}
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{p.filament_grams}g</span>
                    </div>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4 rounded-xl border-slate-200 dark:border-white/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                  onClick={() => setEditingPart(p)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Ajustar Info Técnica
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DE EDIÇÃO TÉCNICA */}
      <Dialog open={!!editingPart} onOpenChange={(o) => !o && setEditingPart(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 rounded-3xl p-0 overflow-hidden shadow-2xl">
          
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <DialogHeader>
              <DialogTitle className="text-xl">Especificações Técnicas</DialogTitle>
              <DialogDescription>
                Atualiza os detalhes de produção e a imagem da peça: <strong className="text-slate-800 dark:text-slate-200">{editingPart?.name}</strong>
              </DialogDescription>
            </DialogHeader>
          </div>
          
          {editingPart && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-8">
              
              {/* COLUNA ESQUERDA: UPLOAD DE IMAGEM */}
              <div className="md:col-span-2 space-y-3">
                <Label className="text-slate-700 dark:text-slate-300 font-semibold">Imagem da Peça (Máx. 1MB)</Label>
                
                <div className="group relative aspect-square rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-colors bg-slate-50 dark:bg-white/5 flex flex-col items-center justify-center overflow-hidden">
                  
                  {editingPart.image_url ? (
                    <>
                      <img src={editingPart.image_url} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                          Trocar
                        </Button>
                        <Button variant="destructive" size="icon" onClick={handleRemoveImage}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="h-12 w-12 bg-white dark:bg-black/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100 dark:border-white/5">
                        <UploadCloud className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Clica para enviar</p>
                      <p className="text-xs text-slate-500">JPG, PNG ou WebP</p>
                    </div>
                  )}

                  {/* Input real invisível com filtro de formato */}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleImageUpload}
                  />
                </div>
                
                <div className="pt-2">
                  <Label className="text-xs text-slate-500 mb-1 block">Ou link externo (URL)</Label>
                  <div className="relative">
                    <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      className="h-8 pl-8 text-xs bg-transparent"
                      placeholder="https://..." 
                      value={editingPart.image_url?.startsWith('http') ? editingPart.image_url : ""} 
                      onChange={(e) => setEditingPart({ ...editingPart, image_url: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: INFORMAÇÕES TÉCNICAS */}
              <div className="md:col-span-3 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-500" /> Tempo (Minutos)
                    </Label>
                    <Input 
                      type="number"
                      step="any"
                      min="0"
                      className="bg-slate-50 dark:bg-white/5"
                      value={editingPart.production_minutes ?? ""} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingPart({ ...editingPart, production_minutes: val === "" ? 0 : parseFloat(val) })
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-500" /> Filamento (Gramas)
                    </Label>
                    {/* Alteração Principal: Adicionado step="0.01" para permitir decimais */}
                    <Input 
                      type="number"
                      step="0.01" // Permite números com casas decimais
                      min="0"
                      className="bg-slate-50 dark:bg-white/5"
                      value={editingPart.filament_grams ?? ""} 
                      onChange={(e) => {
                        // Converter adequadamente a string em número decimal
                        const val = e.target.value;
                        setEditingPart({ ...editingPart, filament_grams: val === "" ? 0 : parseFloat(val) })
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Descrição Técnica / Parâmetros de Impressão</Label>
                  <Textarea 
                    className="resize-none h-32 bg-slate-50 dark:bg-white/5 leading-relaxed"
                    placeholder="Ex: Utilizar suporte em árvore apenas na base. Preenchimento giroide a 20%. Velocidade de parede externa 60mm/s..."
                    value={editingPart.description || ""} 
                    onChange={(e) => setEditingPart({ ...editingPart, description: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" className="rounded-xl" onClick={() => setEditingPart(null)}>Cancelar</Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
                disabled={updateMutation.isPending}
                onClick={() => editingPart && updateMutation.mutate({
                  production_minutes: editingPart.production_minutes,
                  filament_grams: editingPart.filament_grams,
                  image_url: editingPart.image_url,
                  description: editingPart.description
                })}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" /> Salvando...
                  </>
                ) : "Salvar Configurações"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
