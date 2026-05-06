import React, { useState, useMemo } from "react";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pencil, Clock, Layers, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Utilitário de formatação de tempo
const formatMinutes = (m: number) => {
  if (!m) return "0min";
  const h = Math.floor(m / 60);
  const min = m % 60;
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

  // 1. Busca os produtos do banco real (O controller de produtos agora envia campos 3D)
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => (await api.get("/products")).data,
  });

  // 2. Filtra apenas o que é 3D e bate com a busca
  const parts3D = useMemo(() => {
    return products
      .filter((p: any) => p.is_3d === true)
      .filter((p: any) => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.sku.toLowerCase().includes(search.toLowerCase())
      );
  }, [products, search]);

  // 3. Mutação para salvar as alterações técnicas no banco
  const updateMutation = useMutation({
    mutationFn: async (updatedData: Partial<Part3D>) => {
      return api.put(`/products/${editingPart?.id}`, updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-active"] });
      toast.success("Dados técnicos da peça atualizados!");
      setEditingPart(null);
    },
    onError: () => toast.error("Erro ao salvar alterações."),
  });

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
            <Card key={p.id} className="overflow-hidden border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] group hover:shadow-lg transition-all rounded-2xl">
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
              
              <CardContent className="p-4 space-y-3">
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
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{p.filament_grams}g</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full rounded-xl border-slate-200 dark:border-white/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
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
        <DialogContent className="max-w-md bg-white dark:bg-[#111111] border-slate-200 dark:border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle>Especificações da Peça</DialogTitle>
          </DialogHeader>
          
          {editingPart && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tempo (Minutos)</Label>
                  <Input 
                    type="number" 
                    value={editingPart.production_minutes} 
                    onChange={(e) => setEditingPart({ ...editingPart, production_minutes: +e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Filamento (Gramas)</Label>
                  <Input 
                    type="number" 
                    value={editingPart.filament_grams} 
                    onChange={(e) => setEditingPart({ ...editingPart, filament_grams: +e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>URL da Imagem (Unsplash/Web)</Label>
                <Input 
                  placeholder="https://..." 
                  value={editingPart.image_url || ""} 
                  onChange={(e) => setEditingPart({ ...editingPart, image_url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição Técnica / Dicas de Impressão</Label>
                <Textarea 
                  className="resize-none h-24"
                  placeholder="Ex: Utilizar suporte em árvore, preenchimento 20%..."
                  value={editingPart.description || ""} 
                  onChange={(e) => setEditingPart({ ...editingPart, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPart(null)}>Cancelar</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              disabled={updateMutation.isPending}
              onClick={() => editingPart && updateMutation.mutate({
                production_minutes: editingPart.production_minutes,
                filament_grams: editingPart.filament_grams,
                image_url: editingPart.image_url,
                description: editingPart.description
              })}
            >
              {updateMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar no Estoque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
